from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import log, require_roles
from ..models import Role, Skill, Student, TrainingSignal, User
from ..schemas import TrainingSignalIn
from ..services.graph import (
    batch_gap_analytics,
    industry_demand,
    supply_vs_demand,
    training_recommendations,
)
from ..services.matching import analyse, role_requirements

router = APIRouter(prefix="/institute", tags=["institute"])

Auth = Depends(require_roles("institute", "admin"))


def _cohort(db: Session, user: User, batch: str = "", department: str = ""):
    query = db.query(Student)
    if user.role == "institute":
        if not user.institute_id:
            raise HTTPException(400, "This account is not linked to an institute yet.")
        query = query.filter(Student.institute_id == user.institute_id)
    if batch:
        query = query.filter(Student.batch == batch)
    if department:
        query = query.filter(Student.department == department)
    return query.all()


@router.get("/overview")
def overview(
    batch: str = "",
    department: str = "",
    role_slug: str = "",
    user: User = Auth,
    db: Session = Depends(get_db),
):
    students = _cohort(db, user, batch, department)
    role = None
    if role_slug:
        role = db.query(Role).filter(Role.slug == role_slug).first()
    elif students:
        # Default to whatever this cohort is actually aiming at.
        counts = {}
        for s in students:
            if s.target_role:
                counts[s.target_role.id] = counts.get(s.target_role.id, 0) + 1
        if counts:
            role_id = max(counts, key=counts.get)
            role = db.query(Role).filter(Role.id == role_id).first()

    analytics = batch_gap_analytics(db, students, role)
    return {
        "cohort": {
            "batch": batch,
            "department": department,
            "students": analytics["total_students"],
            "role": analytics.get("role", ""),
            "role_slug": role.slug if role else "",
        },
        "analytics": analytics,
        "recommendations": training_recommendations(analytics, user.institute_id or "", batch),
        "industry_demand": industry_demand(db, limit=10),
        "supply_vs_demand": supply_vs_demand(db, students, limit=8),
        "filters": {
            "batches": sorted({s.batch for s in _cohort(db, user) if s.batch}),
            "departments": sorted({s.department for s in _cohort(db, user) if s.department}),
        },
        "placement_ready": sum(
            1
            for s in students
            if role and analyse(s, role_requirements(role))["readiness"] >= 70
        ),
    }


@router.get("/students")
def students(
    batch: str = "",
    department: str = "",
    role_slug: str = "",
    user: User = Auth,
    db: Session = Depends(get_db),
):
    """Roster view. Aggregate signals only - no resume text or contact details."""
    cohort = _cohort(db, user, batch, department)
    role = db.query(Role).filter(Role.slug == role_slug).first() if role_slug else None
    rows = []
    for s in cohort:
        target = role or s.target_role
        result = analyse(s, role_requirements(target)) if target else None
        rows.append(
            {
                "id": s.id,
                "name": s.user.name if s.user else "",
                "department": s.department,
                "batch": s.batch,
                "target_role": s.target_role.title if s.target_role else "",
                "skills": len(s.skills),
                "verified_skills": sum(1 for ss in s.skills if ss.verified),
                "readiness": result["readiness"] if result else None,
                "top_gaps": [g["name"] for g in (result["missing"][:3] if result else [])],
            }
        )
    rows.sort(key=lambda r: -(r["readiness"] or 0))
    return rows


@router.get("/students/{student_id}")
def student_detail(student_id: str, user: User = Auth, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "No such student.")
    if user.role == "institute" and student.institute_id != user.institute_id:
        raise HTTPException(403, "That student is not enrolled at your institute.")
    result = analyse(student, role_requirements(student.target_role)) if student.target_role else None
    return {
        "id": student.id,
        "name": student.user.name if student.user else "",
        "department": student.department,
        "batch": student.batch,
        "target_role": student.target_role.title if student.target_role else "",
        "readiness": result["readiness"] if result else None,
        "skills": [
            {"name": ss.skill.name, "level": ss.level, "verified": ss.verified, "category": ss.skill.category}
            for ss in student.skills
            if ss.skill
        ],
        "missing": result["missing"] if result else [],
        "improve": result["improve"] if result else [],
        "evidence_counts": {
            "projects": sum(1 for e in student.evidence if e.kind == "project"),
            "certifications": sum(1 for e in student.evidence if e.kind == "certification"),
            "verified": sum(1 for e in student.evidence if e.verification_status == "verified"),
        },
    }


@router.get("/training")
def training(user: User = Auth, db: Session = Depends(get_db)):
    query = db.query(TrainingSignal)
    if user.role == "institute":
        query = query.filter(TrainingSignal.institute_id == user.institute_id)
    return [
        {
            "id": t.id,
            "title": t.title,
            "skill": t.skill.name if t.skill else "",
            "batch": t.batch,
            "department": t.department,
            "rationale": t.rationale,
            "status": t.status,
        }
        for t in query.order_by(TrainingSignal.created_at.desc()).all()
    ]


@router.post("/training")
def create_training(body: TrainingSignalIn, user: User = Auth, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.slug == body.skill_slug).first()
    if not skill:
        raise HTTPException(404, "Unknown skill.")
    if not user.institute_id:
        raise HTTPException(400, "This account is not linked to an institute yet.")
    signal = TrainingSignal(
        institute_id=user.institute_id,
        skill_id=skill.id,
        title=body.title,
        rationale=body.rationale,
        batch=body.batch,
        department=body.department,
    )
    db.add(signal)
    db.commit()
    log(db, user, "training_planned", body.title)
    return {"ok": True, "id": signal.id}


@router.put("/training/{signal_id}")
def update_training(signal_id: str, payload: dict, user: User = Auth, db: Session = Depends(get_db)):
    signal = db.query(TrainingSignal).filter(TrainingSignal.id == signal_id).first()
    if not signal:
        raise HTTPException(404, "No such training plan.")
    if user.role == "institute" and signal.institute_id != user.institute_id:
        raise HTTPException(403, "That plan belongs to another institute.")
    signal.status = payload.get("status", signal.status)
    db.commit()
    return {"ok": True}
