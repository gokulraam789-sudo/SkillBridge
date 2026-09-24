from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import log, require_roles
from ..models import Application, Opportunity, OpportunitySkill, Role, Skill, Student, User
from ..schemas import ApplicationStatusIn, CandidateSearchIn, OpportunityIn
from ..services.graph import industry_demand
from ..services.matching import analyse, rank_candidates, search_candidates

router = APIRouter(prefix="/industry", tags=["industry"])

Auth = Depends(require_roles("industry", "admin"))


def _company_filter(query, user: User):
    if user.role == "industry":
        if not user.company_id:
            raise HTTPException(400, "This account is not linked to a company yet.")
        return query.filter(Opportunity.company_id == user.company_id)
    return query


@router.get("/overview")
def overview(user: User = Auth, db: Session = Depends(get_db)):
    opps = _company_filter(db.query(Opportunity), user).all()
    opp_ids = [o.id for o in opps]
    applications = (
        db.query(Application).filter(Application.opportunity_id.in_(opp_ids)).all() if opp_ids else []
    )
    pipeline = {}
    for a in applications:
        pipeline[a.status] = pipeline.get(a.status, 0) + 1

    top_matches = []
    for opp in opps[:3]:
        candidates = rank_candidates(db, opp, limit=3)
        top_matches.append({"opportunity": opp.title, "opportunity_id": opp.id, "candidates": candidates})

    talent_pool = db.query(Student).filter(Student.open_to_work.is_(True)).count()
    return {
        "company": opps[0].company.name if opps and opps[0].company else "",
        "open_opportunities": sum(1 for o in opps if o.is_open),
        "total_applications": len(applications),
        "pipeline": pipeline,
        "talent_pool": talent_pool,
        "demand": industry_demand(db, limit=8),
        "top_matches": top_matches,
    }


@router.get("/opportunities")
def opportunities(user: User = Auth, db: Session = Depends(get_db)):
    opps = _company_filter(db.query(Opportunity), user).order_by(Opportunity.created_at.desc()).all()
    out = []
    for o in opps:
        applicants = db.query(Application).filter(Application.opportunity_id == o.id).count()
        out.append(
            {
                "id": o.id,
                "title": o.title,
                "kind": o.kind,
                "description": o.description,
                "location": o.location,
                "stipend": o.stipend,
                "open_positions": o.open_positions,
                "is_open": o.is_open,
                "role": o.role.title if o.role else "",
                "applicants": applicants,
                "skills": [
                    {"slug": r.skill.slug, "name": r.skill.name, "importance": r.importance,
                     "expected_level": r.expected_level}
                    for r in o.requirements
                    if r.skill
                ],
            }
        )
    return out


@router.post("/opportunities")
def create_opportunity(body: OpportunityIn, user: User = Auth, db: Session = Depends(get_db)):
    if user.role == "industry" and not user.company_id:
        raise HTTPException(400, "This account is not linked to a company yet.")
    role = db.query(Role).filter(Role.slug == body.role_slug).first() if body.role_slug else None
    opp = Opportunity(
        company_id=user.company_id,
        title=body.title,
        kind=body.kind,
        description=body.description,
        location=body.location,
        stipend=body.stipend,
        role_id=role.id if role else None,
        open_positions=max(1, body.open_positions),
    )
    db.add(opp)
    db.flush()

    requested = body.skills or []
    if not requested and role:
        requested = [
            {"slug": r.skill.slug, "importance": r.importance, "expected_level": r.expected_level}
            for r in role.requirements
            if r.skill
        ][:8]
    for entry in requested:
        skill = db.query(Skill).filter(Skill.slug == entry.get("slug")).first()
        if not skill:
            continue
        db.add(
            OpportunitySkill(
                opportunity_id=opp.id,
                skill_id=skill.id,
                importance=int(entry.get("importance", 3)),
                expected_level=int(entry.get("expected_level", 3)),
            )
        )
    db.commit()
    log(db, user, "opportunity_created", body.title)
    return {"ok": True, "id": opp.id}


@router.delete("/opportunities/{opp_id}")
def close_opportunity(opp_id: str, user: User = Auth, db: Session = Depends(get_db)):
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id).first()
    if not opp:
        raise HTTPException(404, "No such opportunity.")
    if user.role == "industry" and opp.company_id != user.company_id:
        raise HTTPException(403, "That opportunity belongs to another company.")
    opp.is_open = False
    db.commit()
    return {"ok": True}


@router.get("/opportunities/{opp_id}/candidates")
def candidates(opp_id: str, user: User = Auth, db: Session = Depends(get_db)):
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id).first()
    if not opp:
        raise HTTPException(404, "No such opportunity.")
    if user.role == "industry" and opp.company_id != user.company_id:
        raise HTTPException(403, "That opportunity belongs to another company.")
    applied = {
        a.student_id: a.status for a in db.query(Application).filter(Application.opportunity_id == opp_id).all()
    }
    rows = rank_candidates(db, opp, limit=40)
    for r in rows:
        r["application_status"] = applied.get(r["student_id"])
    return {"opportunity": {"id": opp.id, "title": opp.title, "kind": opp.kind}, "candidates": rows}


@router.post("/search")
def search(body: CandidateSearchIn, user: User = Auth, db: Session = Depends(get_db)):
    log(db, user, "talent_search", ", ".join(body.skills))
    return search_candidates(
        db,
        skill_slugs=body.skills,
        min_level=body.min_level,
        verified_only=body.verified_only,
        role_slug=body.role_slug,
    )


@router.get("/candidates/{student_id}")
def candidate_profile(student_id: str, role_slug: str = "", user: User = Auth, db: Session = Depends(get_db)):
    """The student's passport as industry sees it: verified status always visible."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "No such candidate.")
    if not student.open_to_work:
        raise HTTPException(403, "This student is not currently open to opportunities.")
    role = db.query(Role).filter(Role.slug == role_slug).first() if role_slug else student.target_role
    from ..services.matching import role_requirements

    result = analyse(student, role_requirements(role)) if role else None
    return {
        "id": student.id,
        "name": student.user.name if student.user else "",
        "headline": student.headline,
        "institute": student.institute.name if student.institute else "",
        "department": student.department,
        "batch": student.batch,
        "cgpa": student.cgpa,
        "target_role": student.target_role.title if student.target_role else "",
        "compared_against": role.title if role else "",
        "readiness": result["readiness"] if result else None,
        "matched": result["have"] if result else [],
        "partial": result["improve"] if result else [],
        "missing": result["missing"] if result else [],
        "skills": [
            {
                "name": ss.skill.name,
                "slug": ss.skill.slug,
                "category": ss.skill.category,
                "level": ss.level,
                "verified": ss.verified,
                "evidence": ss.evidence_text,
            }
            for ss in student.skills
            if ss.skill
        ],
        "evidence": [
            {
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
    }


@router.get("/applications")
def applications(user: User = Auth, db: Session = Depends(get_db)):
    opps = _company_filter(db.query(Opportunity), user).all()
    ids = [o.id for o in opps]
    rows = db.query(Application).filter(Application.opportunity_id.in_(ids)).all() if ids else []
    return [
        {
            "id": a.id,
            "student_id": a.student_id,
            "student": a.student.user.name if a.student and a.student.user else "",
            "institute": a.student.institute.name if a.student and a.student.institute else "",
            "opportunity": a.opportunity.title if a.opportunity else "",
            "status": a.status,
            "score": a.match_score,
        }
        for a in rows
    ]


@router.put("/applications/{application_id}")
def update_application(
    application_id: str, body: ApplicationStatusIn, user: User = Auth, db: Session = Depends(get_db)
):
    app_row = db.query(Application).filter(Application.id == application_id).first()
    if not app_row:
        raise HTTPException(404, "No such application.")
    if user.role == "industry" and app_row.opportunity and app_row.opportunity.company_id != user.company_id:
        raise HTTPException(403, "That application belongs to another company.")
    app_row.status = body.status
    db.commit()
    log(db, user, "application_updated", f"{app_row.id} -> {body.status}")
    return {"ok": True}
