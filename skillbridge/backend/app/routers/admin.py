from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import log, require_roles
from ..models import (
    ActivityLog,
    Application,
    Company,
    Evidence,
    Institute,
    Opportunity,
    Role,
    RoleSkill,
    Skill,
    Student,
    StudentSkill,
    User,
)
from ..schemas import SkillIn
from ..services.graph import industry_demand

router = APIRouter(prefix="/admin", tags=["admin"])

Auth = Depends(require_roles("admin"))


@router.get("/overview")
def overview(user: User = Auth, db: Session = Depends(get_db)):
    verified_evidence = db.query(Evidence).filter(Evidence.verification_status == "verified").count()
    return {
        "counts": {
            "students": db.query(Student).count(),
            "institutes": db.query(Institute).count(),
            "companies": db.query(Company).count(),
            "users": db.query(User).count(),
            "skills": db.query(Skill).count(),
            "roles": db.query(Role).count(),
            "opportunities": db.query(Opportunity).count(),
            "applications": db.query(Application).count(),
            "skill_edges": db.query(StudentSkill).count(),
            "credentials": db.query(Evidence).count(),
            "verified_credentials": verified_evidence,
        },
        "demand": industry_demand(db, limit=10),
        "activity": [
            {
                "id": a.id,
                "actor_role": a.actor_role,
                "action": a.action,
                "detail": a.detail,
                "at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(40).all()
        ],
    }


@router.get("/users")
def users(role: str = "", user: User = Auth, db: Session = Depends(get_db)):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "institute_id": u.institute_id,
            "company_id": u.company_id,
            "created_at": u.created_at.isoformat() if u.created_at else "",
        }
        for u in query.order_by(User.created_at.desc()).limit(300).all()
    ]


@router.delete("/users/{user_id}")
def delete_user(user_id: str, user: User = Auth, db: Session = Depends(get_db)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "No such user.")
    if target.id == user.id:
        raise HTTPException(400, "You cannot remove the account you are signed in with.")
    student = db.query(Student).filter(Student.user_id == target.id).first()
    if student:
        db.delete(student)
    db.delete(target)
    db.commit()
    log(db, user, "user_removed", target.email)
    return {"ok": True}


@router.post("/institutes")
def create_institute(payload: dict, user: User = Auth, db: Session = Depends(get_db)):
    inst = Institute(name=payload.get("name", "").strip(), city=payload.get("city", ""))
    if not inst.name:
        raise HTTPException(400, "Give the institute a name.")
    db.add(inst)
    db.commit()
    return {"ok": True, "id": inst.id}


@router.post("/companies")
def create_company(payload: dict, user: User = Auth, db: Session = Depends(get_db)):
    company = Company(name=payload.get("name", "").strip(), sector=payload.get("sector", ""))
    if not company.name:
        raise HTTPException(400, "Give the company a name.")
    db.add(company)
    db.commit()
    return {"ok": True, "id": company.id}


@router.get("/skills")
def skills(user: User = Auth, db: Session = Depends(get_db)):
    rows = db.query(Skill).order_by(Skill.category, Skill.name).all()
    usage = {}
    for ss in db.query(StudentSkill).all():
        usage[ss.skill_id] = usage.get(ss.skill_id, 0) + 1
    return [
        {
            "id": s.id,
            "slug": s.slug,
            "name": s.name,
            "category": s.category,
            "description": s.description,
            "students": usage.get(s.id, 0),
        }
        for s in rows
    ]


@router.post("/skills")
def create_skill(body: SkillIn, user: User = Auth, db: Session = Depends(get_db)):
    if db.query(Skill).filter(Skill.slug == body.slug).first():
        raise HTTPException(409, "That slug is already in the taxonomy.")
    skill = Skill(slug=body.slug, name=body.name, category=body.category, description=body.description)
    db.add(skill)
    db.commit()
    log(db, user, "skill_added", body.name)
    return {"ok": True, "id": skill.id}


@router.delete("/skills/{slug}")
def delete_skill(slug: str, user: User = Auth, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.slug == slug).first()
    if not skill:
        raise HTTPException(404, "No such skill.")
    in_use = db.query(StudentSkill).filter(StudentSkill.skill_id == skill.id).count()
    if in_use:
        raise HTTPException(
            409, f"{in_use} student graphs reference this skill. Retire it from roles first."
        )
    db.query(RoleSkill).filter(RoleSkill.skill_id == skill.id).delete()
    db.delete(skill)
    db.commit()
    log(db, user, "skill_removed", slug)
    return {"ok": True}


@router.get("/opportunities")
def opportunities(user: User = Auth, db: Session = Depends(get_db)):
    return [
        {
            "id": o.id,
            "title": o.title,
            "company": o.company.name if o.company else "",
            "kind": o.kind,
            "is_open": o.is_open,
            "applicants": db.query(Application).filter(Application.opportunity_id == o.id).count(),
        }
        for o in db.query(Opportunity).order_by(Opportunity.created_at.desc()).all()
    ]


@router.get("/credentials")
def credentials(status: str = "", user: User = Auth, db: Session = Depends(get_db)):
    query = db.query(Evidence)
    if status:
        query = query.filter(Evidence.verification_status == status)
    return [
        {
            "id": e.id,
            "student": e.student.user.name if e.student and e.student.user else "",
            "kind": e.kind,
            "title": e.title,
            "issuer": e.issuer,
            "verification_status": e.verification_status,
            "verification_source": e.verification_source,
        }
        for e in query.order_by(Evidence.created_at.desc()).limit(200).all()
    ]


@router.put("/credentials/{evidence_id}")
def review_credential(evidence_id: str, payload: dict, user: User = Auth, db: Session = Depends(get_db)):
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(404, "No such credential.")
    status = payload.get("status", "verified")
    if status not in {"verified", "unverified", "pending"}:
        raise HTTPException(400, "Status must be verified, unverified or pending.")
    ev.verification_status = status
    ev.verification_source = "platform-review" if status == "verified" else ""
    db.commit()
    log(db, user, "credential_reviewed", f"{ev.title} -> {status}")
    return {"ok": True}
