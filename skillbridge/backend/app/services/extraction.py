"""Document -> structured skill graph.

Stage 1 reads the file into plain text (PDF, DOCX, TXT/MD).
Stage 2 pulls out skills and evidence, and returns a *proposal* the student
reviews before anything is written to their graph. Nothing here writes to the
database - review and commit happens in routers/students.py.
"""

import io
import re
from typing import Dict, List

from sqlalchemy.orm import Session

from ..models import Skill
from .semantic import SkillIndex, normalise

SECTION_HINTS = {
    "project": ["project", "projects", "personal project", "academic project", "capstone"],
    "certification": ["certification", "certifications", "certificate", "licenses", "courses"],
    "experience": ["experience", "internship", "internships", "employment", "work history"],
    "achievement": ["achievement", "achievements", "awards", "honours", "honors", "activities"],
    "education": ["education", "academics", "qualification", "transcript"],
    "skills": ["skill", "skills", "technical skills", "technologies", "toolkit"],
}

DEPTH_MARKERS = [
    (r"\b(led|architected|owned|designed and built|production|deployed to production)\b", 2),
    (r"\b(built|developed|implemented|engineered|shipped)\b", 1),
    (r"\b(\d+\s*(months?|years?))\b", 1),
    (r"\b(familiar|basic|exposure|coursework|learning|beginner)\b", -1),
]


def read_document(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:  # noqa: BLE001
            return f"[Could not read this PDF: {exc}]"
    if name.endswith(".docx"):
        try:
            import docx

            doc = docx.Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as exc:  # noqa: BLE001
            return f"[Could not read this Word file: {exc}]"
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:  # noqa: BLE001
        return ""


def build_index(db: Session) -> SkillIndex:
    from ..data.taxonomy import SKILLS

    alias_map = {slug: aliases for slug, _n, _c, aliases in SKILLS}
    rows = db.query(Skill).all()
    return SkillIndex([(r.slug, r.name, alias_map.get(r.slug, [])) for r in rows])


def _level_from_context(strength: float, context: str) -> int:
    level = 2 if strength < 0.95 else 3
    text = normalise(context)
    for pattern, delta in DEPTH_MARKERS:
        if re.search(pattern, text):
            level += delta
    return max(1, min(5, level))


def _split_sections(text: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {k: [] for k in SECTION_HINTS}
    sections["other"] = []
    current = "other"
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        head = normalise(line).strip(":-• ")
        if len(head) <= 40:
            for key, hints in SECTION_HINTS.items():
                if head in hints or any(head.startswith(h) for h in hints):
                    current = key
                    break
            else:
                sections[current].append(line)
                continue
            continue
        sections[current].append(line)
    return sections


def _title_of(line: str) -> str:
    cleaned = re.sub(r"^[-•*\d.\s]+", "", line).strip()
    parts = re.split(r"[-–—:|]", cleaned)
    title = parts[0].strip()
    return (title or cleaned)[:200]


def extract_from_text(db: Session, text: str) -> dict:
    """Return a reviewable extraction proposal."""
    index = build_index(db)
    sections = _split_sections(text)
    mentions = index.mentions(text)

    skills = []
    for slug, (strength, context) in sorted(mentions.items(), key=lambda kv: -kv[1][0]):
        skills.append(
            {
                "slug": slug,
                "name": index.names.get(slug, slug),
                "level": _level_from_context(strength, context),
                "confidence": round(min(0.99, strength), 2),
                "evidence_text": context,
                "source": "resume",
                "accepted": True,
            }
        )

    evidence = []
    for kind in ("project", "certification", "experience", "achievement"):
        for line in sections.get(kind, []):
            if len(line) < 8:
                continue
            title = _title_of(line)
            if not title:
                continue
            evidence.append(
                {
                    "kind": kind,
                    "title": title,
                    "description": line[:600],
                    "issuer": "",
                    "verification_status": "unverified",
                    "accepted": True,
                }
            )

    cgpa = None
    m = re.search(r"\b(?:cgpa|gpa)\s*[:\-]?\s*(\d(?:\.\d{1,2})?)\b", normalise(text))
    if m:
        try:
            value = float(m.group(1))
            cgpa = value if value <= 10 else None
        except ValueError:
            cgpa = None

    return {
        "skills": skills[:60],
        "evidence": evidence[:30],
        "cgpa": cgpa,
        "note": (
            f"Read {len(text.split())} words and matched {len(skills)} skills in your taxonomy. "
            "Review and correct anything below before it is added to your skill graph."
        ),
    }
