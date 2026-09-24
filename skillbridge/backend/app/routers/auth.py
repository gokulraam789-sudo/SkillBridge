from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user, log
from ..models import Company, Institute, Role, Skill, Student, User
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, hash_password, verify_password

router = APIRouter(tags=["auth"])

ROLES = {"student", "institute", "industry", "admin"}


def profile_payload(db: Session, user: User) -> dict:
    data = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "institute_id": user.institute_id,
        "company_id": user.company_id,
        "organisation": "",
    }
    if user.institute_id:
        inst = db.query(Institute).filter(Institute.id == user.institute_id).first()
        data["organisation"] = inst.name if inst else ""
    if user.company_id:
        company = db.query(Company).filter(Company.id == user.company_id).first()
        data["organisation"] = company.name if company else ""
    if user.role == "student":
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if student:
            data["student_id"] = student.id
            data["department"] = student.department
            data["batch"] = student.batch
            data["headline"] = student.headline
            data["target_role"] = (
                {"slug": student.target_role.slug, "title": student.target_role.title}
                if student.target_role
                else None
            )
            data["organisation"] = student.institute.name if student.institute else ""
    return data


@router.post("/auth/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(400, "Pick one of: student, institute, industry, admin.")
    if body.role == "admin":
        raise HTTPException(403, "Admin accounts are created from the admin dashboard.")
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(409, "An account already uses this email address.")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name,
        role=body.role,
        institute_id=body.institute_id or None,
        company_id=body.company_id or None,
    )
    db.add(user)
    db.flush()

    if body.role == "student":
        db.add(
            Student(
                user_id=user.id,
                institute_id=body.institute_id or None,
                department=body.department or "",
                batch=body.batch or "",
                headline="",
            )
        )
    db.commit()
    log(db, user, "account_created", f"{body.role} account")
    return {"token": create_token(user.id, user.role), "user": profile_payload(db, user)}


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "That email and password combination did not match an account.")
    return {"token": create_token(user.id, user.role), "user": profile_payload(db, user)}


@router.get("/auth/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return profile_payload(db, user)


@router.get("/reference/roles")
def roles(db: Session = Depends(get_db)):
    return [
        {
            "slug": r.slug,
            "title": r.title,
            "summary": r.summary,
            "skill_count": len(r.requirements),
            "skills": [
                {
                    "slug": rs.skill.slug,
                    "name": rs.skill.name,
                    "importance": rs.importance,
                    "expected_level": rs.expected_level,
                    "why": rs.rationale,
                }
                for rs in sorted(r.requirements, key=lambda x: -x.importance)
                if rs.skill
            ],
        }
        for r in db.query(Role).all()
    ]


@router.get("/reference/skills")
def skills(db: Session = Depends(get_db)):
    return [
        {"slug": s.slug, "name": s.name, "category": s.category}
        for s in db.query(Skill).order_by(Skill.name).all()
    ]


@router.get("/reference/institutes")
def institutes(db: Session = Depends(get_db)):
    return [{"id": i.id, "name": i.name, "city": i.city} for i in db.query(Institute).all()]


@router.get("/reference/companies")
def companies(db: Session = Depends(get_db)):
    return [{"id": c.id, "name": c.name, "sector": c.sector} for c in db.query(Company).all()]
