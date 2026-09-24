import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


def uid() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(timezone.utc)


class Institute(Base):
    __tablename__ = "institutes"
    id = Column(String(32), primary_key=True, default=uid)
    name = Column(String(200), nullable=False)
    city = Column(String(120), default="")
    created_at = Column(DateTime, default=now)

    students = relationship("Student", back_populates="institute")


class Company(Base):
    __tablename__ = "companies"
    id = Column(String(32), primary_key=True, default=uid)
    name = Column(String(200), nullable=False)
    sector = Column(String(120), default="")
    created_at = Column(DateTime, default=now)


class User(Base):
    __tablename__ = "users"
    id = Column(String(32), primary_key=True, default=uid)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    name = Column(String(200), nullable=False)
    # student | institute | industry | admin
    role = Column(String(20), nullable=False)
    institute_id = Column(String(32), ForeignKey("institutes.id"), nullable=True)
    company_id = Column(String(32), ForeignKey("companies.id"), nullable=True)
    created_at = Column(DateTime, default=now)

    student = relationship("Student", back_populates="user", uselist=False)


class Student(Base):
    __tablename__ = "students"
    id = Column(String(32), primary_key=True, default=uid)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    institute_id = Column(String(32), ForeignKey("institutes.id"), nullable=True)
    department = Column(String(120), default="")
    batch = Column(String(40), default="")
    headline = Column(String(240), default="")
    target_role_id = Column(String(32), ForeignKey("roles.id"), nullable=True)
    cgpa = Column(Float, nullable=True)
    open_to_work = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)

    user = relationship("User", back_populates="student")
    institute = relationship("Institute", back_populates="students")
    target_role = relationship("Role")
    skills = relationship("StudentSkill", back_populates="student", cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="student", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="student", cascade="all, delete-orphan")
    roadmap = relationship("RoadmapItem", back_populates="student", cascade="all, delete-orphan")


class Skill(Base):
    __tablename__ = "skills"
    id = Column(String(32), primary_key=True, default=uid)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    # technical | tool | domain | soft
    category = Column(String(40), default="technical")
    description = Column(Text, default="")


class Role(Base):
    __tablename__ = "roles"
    id = Column(String(32), primary_key=True, default=uid)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(140), nullable=False)
    summary = Column(Text, default="")

    requirements = relationship("RoleSkill", back_populates="role", cascade="all, delete-orphan")


class RoleSkill(Base):
    __tablename__ = "role_skills"
    __table_args__ = (UniqueConstraint("role_id", "skill_id"),)
    id = Column(String(32), primary_key=True, default=uid)
    role_id = Column(String(32), ForeignKey("roles.id"), nullable=False)
    skill_id = Column(String(32), ForeignKey("skills.id"), nullable=False)
    importance = Column(Integer, default=3)  # 1..5
    expected_level = Column(Integer, default=3)  # 1..5
    rationale = Column(Text, default="")

    role = relationship("Role", back_populates="requirements")
    skill = relationship("Skill")


class StudentSkill(Base):
    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_id", "skill_id"),)
    id = Column(String(32), primary_key=True, default=uid)
    student_id = Column(String(32), ForeignKey("students.id"), nullable=False)
    skill_id = Column(String(32), ForeignKey("skills.id"), nullable=False)
    level = Column(Integer, default=2)  # 1 aware .. 5 expert
    confidence = Column(Float, default=0.5)
    # resume | transcript | project | certificate | self | roadmap
    source = Column(String(40), default="resume")
    evidence_text = Column(Text, default="")
    verified = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=now, onupdate=now)

    student = relationship("Student", back_populates="skills")
    skill = relationship("Skill")


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(String(32), primary_key=True, default=uid)
    student_id = Column(String(32), ForeignKey("students.id"), nullable=False)
    # project | certification | achievement | experience | course
    kind = Column(String(40), default="project")
    title = Column(String(240), nullable=False)
    description = Column(Text, default="")
    issuer = Column(String(200), default="")
    url = Column(String(400), default="")
    # unverified | pending | verified
    verification_status = Column(String(20), default="unverified")
    verification_source = Column(String(80), default="")
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now)

    student = relationship("Student", back_populates="evidence")


class Document(Base):
    __tablename__ = "documents"
    id = Column(String(32), primary_key=True, default=uid)
    student_id = Column(String(32), ForeignKey("students.id"), nullable=False)
    filename = Column(String(300), default="")
    kind = Column(String(40), default="resume")
    raw_text = Column(Text, default="")
    # uploaded | extracted | reviewed
    status = Column(String(20), default="uploaded")
    extraction_note = Column(Text, default="")
    created_at = Column(DateTime, default=now)

    student = relationship("Student", back_populates="documents")


class Opportunity(Base):
    __tablename__ = "opportunities"
    id = Column(String(32), primary_key=True, default=uid)
    company_id = Column(String(32), ForeignKey("companies.id"), nullable=False)
    title = Column(String(200), nullable=False)
    # internship | job | project | challenge
    kind = Column(String(30), default="internship")
    description = Column(Text, default="")
    location = Column(String(140), default="Remote")
    stipend = Column(String(80), default="")
    role_id = Column(String(32), ForeignKey("roles.id"), nullable=True)
    open_positions = Column(Integer, default=1)
    is_open = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)

    company = relationship("Company")
    role = relationship("Role")
    requirements = relationship(
        "OpportunitySkill", back_populates="opportunity", cascade="all, delete-orphan"
    )


class OpportunitySkill(Base):
    __tablename__ = "opportunity_skills"
    __table_args__ = (UniqueConstraint("opportunity_id", "skill_id"),)
    id = Column(String(32), primary_key=True, default=uid)
    opportunity_id = Column(String(32), ForeignKey("opportunities.id"), nullable=False)
    skill_id = Column(String(32), ForeignKey("skills.id"), nullable=False)
    importance = Column(Integer, default=3)
    expected_level = Column(Integer, default=3)

    opportunity = relationship("Opportunity", back_populates="requirements")
    skill = relationship("Skill")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("student_id", "opportunity_id"),)
    id = Column(String(32), primary_key=True, default=uid)
    student_id = Column(String(32), ForeignKey("students.id"), nullable=False)
    opportunity_id = Column(String(32), ForeignKey("opportunities.id"), nullable=False)
    # applied | shortlisted | interviewing | offered | closed
    status = Column(String(30), default="applied")
    match_score = Column(Float, default=0.0)
    note = Column(Text, default="")
    created_at = Column(DateTime, default=now)

    student = relationship("Student")
    opportunity = relationship("Opportunity")


class RoadmapItem(Base):
    __tablename__ = "roadmap_items"
    id = Column(String(32), primary_key=True, default=uid)
    student_id = Column(String(32), ForeignKey("students.id"), nullable=False)
    skill_id = Column(String(32), ForeignKey("skills.id"), nullable=False)
    step = Column(Integer, default=1)
    action = Column(Text, default="")
    project_idea = Column(Text, default="")
    resource = Column(String(300), default="")
    estimated_weeks = Column(Integer, default=2)
    # todo | in_progress | done
    status = Column(String(20), default="todo")
    created_at = Column(DateTime, default=now)

    student = relationship("Student", back_populates="roadmap")
    skill = relationship("Skill")


class TrainingSignal(Base):
    """A training/curriculum action an institute has committed to, derived from batch gaps."""

    __tablename__ = "training_signals"
    id = Column(String(32), primary_key=True, default=uid)
    institute_id = Column(String(32), ForeignKey("institutes.id"), nullable=False)
    skill_id = Column(String(32), ForeignKey("skills.id"), nullable=False)
    batch = Column(String(40), default="")
    department = Column(String(120), default="")
    title = Column(String(240), default="")
    rationale = Column(Text, default="")
    # planned | running | complete
    status = Column(String(20), default="planned")
    created_at = Column(DateTime, default=now)

    skill = relationship("Skill")


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(String(32), primary_key=True, default=uid)
    actor_id = Column(String(32), nullable=True)
    actor_role = Column(String(20), default="")
    action = Column(String(120), default="")
    detail = Column(Text, default="")
    created_at = Column(DateTime, default=now)
