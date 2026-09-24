"""Gap analysis and matching.

One scoring function backs all four directions the brief asks for:
student <-> target role, student <-> internship, student <-> industry project and
industry requirement <-> student graph. Every result carries the per-skill reasons
that produced it, so nothing in the UI has to show a bare number.
"""

from typing import Dict, List, Sequence, Tuple

from sqlalchemy.orm import Session

from ..models import Opportunity, Role, Student, StudentSkill
from .semantic import transfer_credit

LEVEL_LABELS = {1: "Aware", 2: "Learning", 3: "Working", 4: "Strong", 5: "Expert"}


def student_levels(student: Student) -> Dict[str, int]:
    return {ss.skill.slug: ss.level for ss in student.skills if ss.skill}


def student_skill_map(student: Student) -> Dict[str, StudentSkill]:
    return {ss.skill.slug: ss for ss in student.skills if ss.skill}


Requirement = Tuple[str, str, int, int, str]  # slug, name, importance, expected_level, rationale


def role_requirements(role: Role) -> List[Requirement]:
    return [
        (r.skill.slug, r.skill.name, r.importance, r.expected_level, r.rationale)
        for r in role.requirements
        if r.skill
    ]


def opportunity_requirements(opp: Opportunity) -> List[Requirement]:
    return [
        (
            r.skill.slug,
            r.skill.name,
            r.importance,
            r.expected_level,
            f"Listed on {opp.title} at {opp.company.name if opp.company else 'this employer'}.",
        )
        for r in opp.requirements
        if r.skill
    ]


def analyse(student: Student, requirements: Sequence[Requirement]) -> dict:
    """Compare one student against one set of requirements."""
    held = student_levels(student)
    skill_rows = student_skill_map(student)

    have, improve, missing = [], [], []
    weighted, total_weight = 0.0, 0.0

    for slug, name, importance, expected, rationale in requirements:
        expected = max(1, expected)
        level = held.get(slug, 0)
        credit, credit_from = (0.0, "")
        if level == 0:
            credit, credit_from = transfer_credit(held, slug)
        effective = max(level, credit * expected)
        coverage = min(1.0, effective / expected)
        weighted += importance * coverage
        total_weight += importance

        row = skill_rows.get(slug)
        item = {
            "slug": slug,
            "name": name,
            "importance": importance,
            "expected_level": expected,
            "level": level,
            "level_label": LEVEL_LABELS.get(level, "Not evidenced"),
            "coverage": round(coverage, 2),
            "verified": bool(row.verified) if row else False,
            "evidence": (row.evidence_text if row else "") or "",
            "why": rationale,
            "priority": round(importance * (1 - coverage), 2),
            "transfer_from": credit_from,
        }
        if coverage >= 0.999:
            have.append(item)
        elif level > 0 or credit >= 0.35:
            item["reason"] = (
                f"You are at {LEVEL_LABELS.get(level, 'no direct evidence')} and this role expects "
                f"{LEVEL_LABELS[expected]}."
                if level > 0
                else f"No direct evidence, but your {credit_from.replace('-', ' ')} work covers part of it."
            )
            improve.append(item)
        else:
            item["reason"] = "Nothing in your graph evidences this yet."
            missing.append(item)

    readiness = round(100 * weighted / total_weight, 1) if total_weight else 0.0
    improve.sort(key=lambda i: -i["priority"])
    missing.sort(key=lambda i: -i["priority"])

    return {
        "readiness": readiness,
        "have": sorted(have, key=lambda i: -i["importance"]),
        "improve": improve,
        "missing": missing,
        "requirement_count": len(requirements),
    }


def explain(result: dict, subject: str) -> List[str]:
    """Turn an analysis into the sentences shown instead of a black-box score."""
    lines = []
    have = result["have"]
    if have:
        top = ", ".join(i["name"] for i in have[:4])
        lines.append(f"Covers {len(have)} of {result['requirement_count']} requirements, including {top}.")
    verified = [i for i in have if i["verified"]]
    if verified:
        lines.append(f"{len(verified)} of those are backed by verified credentials.")
    if result["improve"]:
        near = result["improve"][0]
        lines.append(
            f"{near['name']} is present but below the level {subject} expects "
            f"({near['level_label']} vs {LEVEL_LABELS[near['expected_level']]})."
        )
    if result["missing"]:
        gaps = ", ".join(i["name"] for i in result["missing"][:3])
        lines.append(f"Not evidenced yet: {gaps}.")
    if not lines:
        lines.append("No requirements were defined, so there is nothing to compare against.")
    return lines


def match_student_to_opportunity(student: Student, opp: Opportunity) -> dict:
    reqs = opportunity_requirements(opp)
    result = analyse(student, reqs)
    subject = f"{opp.company.name if opp.company else 'the employer'}"
    return {
        "opportunity_id": opp.id,
        "title": opp.title,
        "kind": opp.kind,
        "company": opp.company.name if opp.company else "",
        "location": opp.location,
        "stipend": opp.stipend,
        "score": result["readiness"],
        "matched": result["have"],
        "partial": result["improve"],
        "missing": result["missing"],
        "reasons": explain(result, subject),
    }


def rank_opportunities(db: Session, student: Student, limit: int = 20) -> List[dict]:
    opps = db.query(Opportunity).filter(Opportunity.is_open.is_(True)).all()
    scored = [match_student_to_opportunity(student, o) for o in opps]
    scored.sort(key=lambda m: -m["score"])
    return scored[:limit]


def rank_candidates(db: Session, opp: Opportunity, limit: int = 30) -> List[dict]:
    students = db.query(Student).filter(Student.open_to_work.is_(True)).all()
    reqs = opportunity_requirements(opp)
    out = []
    for s in students:
        result = analyse(s, reqs)
        if result["readiness"] <= 0:
            continue
        out.append(
            {
                "student_id": s.id,
                "name": s.user.name if s.user else "Student",
                "institute": s.institute.name if s.institute else "",
                "department": s.department,
                "batch": s.batch,
                "headline": s.headline,
                "score": result["readiness"],
                "matched": result["have"],
                "partial": result["improve"],
                "missing": result["missing"],
                "verified_count": sum(1 for ss in s.skills if ss.verified),
                "reasons": explain(result, opp.title),
            }
        )
    out.sort(key=lambda c: -c["score"])
    return out[:limit]


def search_candidates(db: Session, skill_slugs: List[str], min_level: int = 2, verified_only: bool = False,
                      role_slug: str = "", limit: int = 40) -> List[dict]:
    """Skill-graph search used by industry talent discovery."""
    students = db.query(Student).filter(Student.open_to_work.is_(True)).all()
    reqs: List[Requirement] = []
    for slug in skill_slugs:
        reqs.append((slug, slug.replace("-", " ").title(), 4, min_level, "Requested in this search."))

    results = []
    for s in students:
        if role_slug and (not s.target_role or s.target_role.slug != role_slug):
            continue
        rows = student_skill_map(s)
        if verified_only and skill_slugs:
            if not all(rows.get(slug) and rows[slug].verified for slug in skill_slugs):
                continue
        result = analyse(s, reqs) if reqs else {"readiness": 0, "have": [], "improve": [], "missing": [],
                                                "requirement_count": 0}
        if skill_slugs and result["readiness"] <= 0:
            continue
        results.append(
            {
                "student_id": s.id,
                "name": s.user.name if s.user else "Student",
                "institute": s.institute.name if s.institute else "",
                "department": s.department,
                "batch": s.batch,
                "headline": s.headline,
                "target_role": s.target_role.title if s.target_role else "",
                "score": result["readiness"],
                "matched": result["have"],
                "partial": result["improve"],
                "missing": result["missing"],
                "verified_count": sum(1 for ss in s.skills if ss.verified),
                "reasons": explain(result, "this search") if reqs else ["No skill filter applied."],
            }
        )
    results.sort(key=lambda c: -c["score"])
    return results[:limit]
