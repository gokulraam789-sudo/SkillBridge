from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_student, log
from ..models import (
    Application,
    Document,
    Evidence,
    Opportunity,
    RoadmapItem,
    Role,
    Skill,
    Student,
    StudentSkill,
)
from ..schemas import (
    ApplicationIn,
    AssistantIn,
    EvidenceIn,
    ExtractionCommit,
    RoadmapStatusIn,
    SkillUpsert,
    TargetRoleIn,
    VerificationIn,
)
from ..services import assistant as assistant_service
from ..services import roadmap as roadmap_service
from ..services.extraction import extract_from_text, read_document
from ..services.graph import evidence_summary, industry_demand, student_graph
from ..services.matching import analyse, match_student_to_opportunity, rank_opportunities, role_requirements, student_levels

router = APIRouter(prefix="/student", tags=["student"])


def _gap(db: Session, student: Student) -> dict:
    if not student.target_role:
        return {"readiness": 0, "have": [], "improve": [], "missing": [], "requirement_count": 0}
    return analyse(student, role_requirements(student.target_role))


@router.get("/overview")
def overview(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    gap = _gap(db, student)
    matches = rank_opportunities(db, student, limit=3)
    roadmap = db.query(RoadmapItem).filter(RoadmapItem.student_id == student.id).all()
    return {
        "name": student.user.name if student.user else "",
        "headline": student.headline,
        "institute": student.institute.name if student.institute else "",
        "department": student.department,
        "batch": student.batch,
        "target_role": {"slug": student.target_role.slug, "title": student.target_role.title}
        if student.target_role
        else None,
        "readiness": gap["readiness"],
        "skill_count": len(student.skills),
        "verified_skills": sum(1 for s in student.skills if s.verified),
        "gap_counts": {"have": len(gap["have"]), "improve": len(gap["improve"]), "missing": len(gap["missing"])},
        "top_gaps": (gap["missing"] + gap["improve"])[:4],
        "top_matches": matches,
        "roadmap_progress": {
            "total": len(roadmap),
            "done": sum(1 for r in roadmap if r.status == "done"),
        },
        "evidence": evidence_summary(student),
        "documents": len(student.documents),
        "industry_demand": industry_demand(db, limit=6),
    }


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    kind: str = "resume",
    student: Student = Depends(current_student),
    db: Session = Depends(get_db),
):
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(413, "Keep uploads under 8 MB.")
    text = read_document(file.filename, content)
    if not text.strip():
        raise HTTPException(422, "No readable text in that file. A text-based PDF, DOCX or TXT works best.")

    doc = Document(student_id=student.id, filename=file.filename, kind=kind, raw_text=text[:200000])
    db.add(doc)
    db.commit()

    proposal = extract_from_text(db, text)
    doc.status = "extracted"
    doc.extraction_note = proposal["note"]
    db.commit()
    log(db, student.user, "document_uploaded", file.filename)
    return {"document_id": doc.id, "filename": doc.filename, **proposal}


@router.post("/documents/text")
def paste_text(payload: dict, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    text = (payload or {}).get("text", "")
    if len(text.strip()) < 40:
        raise HTTPException(422, "Paste at least a few lines so there is something to read.")
    doc = Document(student_id=student.id, filename="pasted-text", kind=payload.get("kind", "resume"), raw_text=text[:200000])
    db.add(doc)
    db.commit()
    proposal = extract_from_text(db, text)
    doc.status = "extracted"
    doc.extraction_note = proposal["note"]
    db.commit()
    return {"document_id": doc.id, "filename": doc.filename, **proposal}


@router.post("/extraction/commit")
def commit_extraction(
    body: ExtractionCommit, student: Student = Depends(current_student), db: Session = Depends(get_db)
):
    added, updated = 0, 0
    for proposal in body.skills:
        if not proposal.accepted:
            continue
        skill = db.query(Skill).filter(Skill.slug == proposal.slug).first()
        if not skill:
            continue
        row = (
            db.query(StudentSkill)
            .filter(StudentSkill.student_id == student.id, StudentSkill.skill_id == skill.id)
            .first()
        )
        if row:
            if proposal.level > row.level:
                row.level = proposal.level
                row.evidence_text = proposal.evidence_text or row.evidence_text
                updated += 1
        else:
            db.add(
                StudentSkill(
                    student_id=student.id,
                    skill_id=skill.id,
                    level=max(1, min(5, proposal.level)),
                    confidence=proposal.confidence,
                    source=proposal.source,
                    evidence_text=proposal.evidence_text,
                )
            )
            added += 1

    evidence_added = 0
    for ev in body.evidence:
        if not ev.accepted:
            continue
        db.add(
            Evidence(
                student_id=student.id,
                kind=ev.kind,
                title=ev.title,
                description=ev.description,
                issuer=ev.issuer,
                url=ev.url,
                verification_status="unverified",
            )
        )
        evidence_added += 1

    if body.cgpa:
        student.cgpa = body.cgpa
    if body.document_id:
        doc = db.query(Document).filter(Document.id == body.document_id, Document.student_id == student.id).first()
        if doc:
            doc.status = "reviewed"
    db.commit()
    log(db, student.user, "skills_committed", f"{added} new, {updated} raised")
    return {"skills_added": added, "skills_raised": updated, "evidence_added": evidence_added}


@router.get("/graph")
def graph(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    return student_graph(db, student)


@router.get("/skills")
def list_skills(student: Student = Depends(current_student)):
    return [
        {
            "slug": ss.skill.slug,
            "name": ss.skill.name,
            "category": ss.skill.category,
            "level": ss.level,
            "confidence": ss.confidence,
            "source": ss.source,
            "verified": ss.verified,
            "evidence": ss.evidence_text,
        }
        for ss in student.skills
        if ss.skill
    ]


@router.post("/skills")
def upsert_skill(body: SkillUpsert, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.slug == body.slug).first()
    if not skill:
        raise HTTPException(404, "That skill is not in the taxonomy yet. An admin can add it.")
    row = (
        db.query(StudentSkill)
        .filter(StudentSkill.student_id == student.id, StudentSkill.skill_id == skill.id)
        .first()
    )
    if row:
        row.level = max(1, min(5, body.level))
        row.evidence_text = body.evidence_text or row.evidence_text
        row.source = body.source
    else:
        db.add(
            StudentSkill(
                student_id=student.id,
                skill_id=skill.id,
                level=max(1, min(5, body.level)),
                source=body.source,
                confidence=0.6,
                evidence_text=body.evidence_text,
            )
        )
    db.commit()
    return {"ok": True}


@router.delete("/skills/{slug}")
def remove_skill(slug: str, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.slug == slug).first()
    if skill:
        db.query(StudentSkill).filter(
            StudentSkill.student_id == student.id, StudentSkill.skill_id == skill.id
        ).delete()
        db.commit()
    return {"ok": True}


@router.put("/target-role")
def set_target_role(body: TargetRoleIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.slug == body.role_slug).first()
    if not role:
        raise HTTPException(404, "Unknown role.")
    student.target_role_id = role.id
    db.commit()
    log(db, student.user, "target_role_set", role.title)
    return {"ok": True, "role": {"slug": role.slug, "title": role.title}}


@router.get("/gap")
def gap(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    if not student.target_role:
        raise HTTPException(400, "Choose a target role first - the gap analysis compares against one.")
    result = _gap(db, student)
    result["role"] = {"slug": student.target_role.slug, "title": student.target_role.title,
                      "summary": student.target_role.summary}
    return result


@router.post("/roadmap/generate")
def generate_roadmap(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    if not student.target_role:
        raise HTTPException(400, "Choose a target role first.")
    result = _gap(db, student)
    items = roadmap_service.generate(result, student_levels(student))

    db.query(RoadmapItem).filter(RoadmapItem.student_id == student.id, RoadmapItem.status != "done").delete()
    done_slugs = {
        r.skill.slug
        for r in db.query(RoadmapItem).filter(RoadmapItem.student_id == student.id).all()
        if r.skill
    }
    for item in items:
        if item["skill_slug"] in done_slugs:
            continue
        skill = db.query(Skill).filter(Skill.slug == item["skill_slug"]).first()
        if not skill:
            continue
        db.add(
            RoadmapItem(
                student_id=student.id,
                skill_id=skill.id,
                step=item["step"],
                action=f"{item['action']} {item['why']}".strip(),
                project_idea=item["project_idea"],
                resource=item["resource"],
                estimated_weeks=item["estimated_weeks"],
            )
        )
    db.commit()
    log(db, student.user, "roadmap_generated", student.target_role.title)
    return get_roadmap(student, db)


@router.get("/roadmap")
def get_roadmap(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = (
        db.query(RoadmapItem)
        .filter(RoadmapItem.student_id == student.id)
        .order_by(RoadmapItem.step)
        .all()
    )
    return [
        {
            "id": r.id,
            "step": r.step,
            "skill": r.skill.name if r.skill else "",
            "skill_slug": r.skill.slug if r.skill else "",
            "action": r.action,
            "project_idea": r.project_idea,
            "resource": r.resource,
            "estimated_weeks": r.estimated_weeks,
            "status": r.status,
        }
        for r in rows
    ]


@router.put("/roadmap/{item_id}")
def update_roadmap(
    item_id: str,
    body: RoadmapStatusIn,
    student: Student = Depends(current_student),
    db: Session = Depends(get_db),
):
    row = db.query(RoadmapItem).filter(RoadmapItem.id == item_id, RoadmapItem.student_id == student.id).first()
    if not row:
        raise HTTPException(404, "That roadmap step is not on your plan.")
    row.status = body.status
    # Completing a step raises the skill in the shared graph - this is what the
    # institute and industry dashboards then see.
    if body.status == "done" and row.skill:
        ss = (
            db.query(StudentSkill)
            .filter(StudentSkill.student_id == student.id, StudentSkill.skill_id == row.skill_id)
            .first()
        )
        if ss:
            ss.level = min(5, ss.level + 1)
            ss.source = "roadmap"
        else:
            db.add(
                StudentSkill(
                    student_id=student.id,
                    skill_id=row.skill_id,
                    level=3,
                    confidence=0.7,
                    source="roadmap",
                    evidence_text=row.project_idea,
                )
            )
    db.commit()
    log(db, student.user, "roadmap_step_updated", f"{row.skill.name if row.skill else ''} -> {body.status}")
    return {"ok": True}


@router.get("/opportunities")
def opportunities(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    applied = {
        a.opportunity_id: a.status
        for a in db.query(Application).filter(Application.student_id == student.id).all()
    }
    matches = rank_opportunities(db, student, limit=25)
    for m in matches:
        m["application_status"] = applied.get(m["opportunity_id"])
    return matches


@router.post("/applications")
def apply(body: ApplicationIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    opp = db.query(Opportunity).filter(Opportunity.id == body.opportunity_id).first()
    if not opp:
        raise HTTPException(404, "That opportunity is no longer listed.")
    existing = (
        db.query(Application)
        .filter(Application.student_id == student.id, Application.opportunity_id == opp.id)
        .first()
    )
    if existing:
        return {"ok": True, "status": existing.status}
    match = match_student_to_opportunity(student, opp)
    db.add(Application(student_id=student.id, opportunity_id=opp.id, match_score=match["score"]))
    db.commit()
    log(db, student.user, "applied", opp.title)
    return {"ok": True, "status": "applied", "score": match["score"]}


@router.get("/applications")
def applications(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    rows = db.query(Application).filter(Application.student_id == student.id).all()
    return [
        {
            "id": a.id,
            "title": a.opportunity.title if a.opportunity else "",
            "company": a.opportunity.company.name if a.opportunity and a.opportunity.company else "",
            "kind": a.opportunity.kind if a.opportunity else "",
            "status": a.status,
            "score": a.match_score,
        }
        for a in rows
    ]


@router.get("/passport")
def passport(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    return {
        "student": {
            "name": student.user.name if student.user else "",
            "institute": student.institute.name if student.institute else "",
            "department": student.department,
            "batch": student.batch,
            "cgpa": student.cgpa,
            "headline": student.headline,
            "target_role": student.target_role.title if student.target_role else "",
        },
        "skills": [
            {
                "name": ss.skill.name,
                "slug": ss.skill.slug,
                "category": ss.skill.category,
                "level": ss.level,
                "verified": ss.verified,
                "source": ss.source,
                "evidence": ss.evidence_text,
            }
            for ss in student.skills
            if ss.skill
        ],
        "evidence": [
            {
                "id": e.id,
                "kind": e.kind,
                "title": e.title,
                "description": e.description,
                "issuer": e.issuer,
                "url": e.url,
                "verification_status": e.verification_status,
                "verification_source": e.verification_source,
            }
            for e in student.evidence
        ],
        "summary": evidence_summary(student),
    }


@router.post("/evidence")
def add_evidence(body: EvidenceIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    ev = Evidence(
        student_id=student.id,
        kind=body.kind,
        title=body.title,
        description=body.description,
        issuer=body.issuer,
        url=body.url,
    )
    db.add(ev)
    db.commit()
    return {"ok": True, "id": ev.id}


@router.post("/evidence/verify")
def request_verification(
    body: VerificationIn, student: Student = Depends(current_student), db: Session = Depends(get_db)
):
    """Credential verification hook.

    The provider adapter is stubbed: it marks the credential pending and, for the
    demo provider, resolves it. Swap `_call_provider` for DigiLocker / API Setu
    without touching anything else - the rest of the platform only reads
    `verification_status`.
    """
    ev = db.query(Evidence).filter(Evidence.id == body.evidence_id, Evidence.student_id == student.id).first()
    if not ev:
        raise HTTPException(404, "That credential is not on your passport.")
    if ev.kind not in ("certification", "achievement", "course"):
        raise HTTPException(400, "Only certifications and awards can be checked against a credential provider.")

    ev.verification_status = "pending"
    db.commit()

    verified = _call_provider(body.source, ev)
    if verified:
        ev.verification_status = "verified"
        ev.verification_source = body.source
        ev.verified_at = datetime.now(timezone.utc)
        for ss in student.skills:
            if ss.skill and ss.skill.name.lower() in (ev.title or "").lower():
                ss.verified = True
    db.commit()
    log(db, student.user, "verification_requested", f"{ev.title} via {body.source}")
    return {"status": ev.verification_status, "source": ev.verification_source}


def _call_provider(source: str, evidence: Evidence) -> bool:
    """Stub adapter. Returns True only for providers wired up in this deployment."""
    return source in {"digilocker-sandbox", "digilocker", "institute"}


@router.post("/assistant")
def ask(body: AssistantIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    gap_result = _gap(db, student)
    context = {
        "student": student.user.name if student.user else "",
        "target_role": student.target_role.title if student.target_role else "",
        "gap": gap_result,
        "roadmap": get_roadmap(student, db),
        "matches": rank_opportunities(db, student, limit=5),
        "skills": [
            {"name": ss.skill.name, "level": ss.level, "verified": ss.verified}
            for ss in student.skills
            if ss.skill
        ],
        "industry_demand": industry_demand(db, limit=8),
    }
    return assistant_service.answer(body.question, context)
