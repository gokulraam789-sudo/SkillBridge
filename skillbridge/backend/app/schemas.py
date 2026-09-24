from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "student"
    institute_id: Optional[str] = None
    company_id: Optional[str] = None
    department: Optional[str] = ""
    batch: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TargetRoleIn(BaseModel):
    role_slug: str


class SkillProposal(BaseModel):
    slug: str
    name: str = ""
    level: int = 2
    confidence: float = 0.5
    evidence_text: str = ""
    source: str = "resume"
    accepted: bool = True


class EvidenceProposal(BaseModel):
    kind: str = "project"
    title: str
    description: str = ""
    issuer: str = ""
    url: str = ""
    verification_status: str = "unverified"
    accepted: bool = True


class ExtractionCommit(BaseModel):
    document_id: Optional[str] = None
    skills: List[SkillProposal] = []
    evidence: List[EvidenceProposal] = []
    cgpa: Optional[float] = None


class SkillUpsert(BaseModel):
    slug: str
    level: int = 2
    source: str = "self"
    evidence_text: str = ""


class EvidenceIn(BaseModel):
    kind: str = "project"
    title: str
    description: str = ""
    issuer: str = ""
    url: str = ""


class RoadmapStatusIn(BaseModel):
    status: str = "done"


class AssistantIn(BaseModel):
    question: str


class OpportunityIn(BaseModel):
    title: str
    kind: str = "internship"
    description: str = ""
    location: str = "Remote"
    stipend: str = ""
    role_slug: Optional[str] = None
    open_positions: int = 1
    skills: List[dict] = []  # {slug, importance, expected_level}


class CandidateSearchIn(BaseModel):
    skills: List[str] = []
    min_level: int = 2
    verified_only: bool = False
    role_slug: str = ""


class ApplicationIn(BaseModel):
    opportunity_id: str


class ApplicationStatusIn(BaseModel):
    status: str


class TrainingSignalIn(BaseModel):
    skill_slug: str
    title: str
    rationale: str = ""
    batch: str = ""
    department: str = ""


class VerificationIn(BaseModel):
    evidence_id: str
    source: str = "digilocker"


class SkillIn(BaseModel):
    name: str
    slug: str
    category: str = "technical"
    description: str = ""
