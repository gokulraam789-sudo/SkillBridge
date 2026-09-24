"""The shared skill graph.

One representation, read by three dashboards: the student sees their own nodes and
evidence, the institute sees the same nodes aggregated across a batch, and industry
searches across them. Nothing here is per-dashboard.
"""

from typing import Dict, List

from sqlalchemy.orm import Session

from ..models import Evidence, Role, Skill, Student, StudentSkill, TrainingSignal
from .matching import analyse, role_requirements
from .semantic import RELATED

CATEGORY_LABEL = {
    "technical": "Technical",
    "tool": "Tools & Platforms",
    "domain": "Domain",
    "soft": "Ways of working",
}


def student_graph(db: Session, student: Student) -> dict:
    """Nodes and edges for one student, including target-role requirement edges."""
    nodes: List[dict] = [
        {
            "id": f"student:{student.id}",
            "type": "student",
            "label": student.user.name if student.user else "Student",
            "meta": student.headline or "",
        }
    ]
    edges: List[dict] = []

    categories = set()
    for ss in student.skills:
        if not ss.skill:
            continue
        categories.add(ss.skill.category)

    for cat in sorted(categories):
        nodes.append(
            {
                "id": f"category:{cat}",
                "type": "category",
                "label": CATEGORY_LABEL.get(cat, cat.title()),
            }
        )
        edges.append({"source": f"student:{student.id}", "target": f"category:{cat}", "kind": "has_area"})

    required = set()
    if student.target_role:
        required = {r.skill.slug for r in student.target_role.requirements if r.skill}

    for ss in student.skills:
        if not ss.skill:
            continue
        nid = f"skill:{ss.skill.slug}"
        nodes.append(
            {
                "id": nid,
                "type": "skill",
                "label": ss.skill.name,
                "category": ss.skill.category,
                "level": ss.level,
                "verified": bool(ss.verified),
                "confidence": ss.confidence,
                "source": ss.source,
                "evidence": ss.evidence_text or "",
                "required_by_target": ss.skill.slug in required,
            }
        )
        edges.append({"source": f"category:{ss.skill.category}", "target": nid, "kind": "contains"})

    for ev in student.evidence:
        nid = f"evidence:{ev.id}"
        nodes.append(
            {
                "id": nid,
                "type": "evidence",
                "label": ev.title,
                "kind": ev.kind,
                "verification_status": ev.verification_status,
            }
        )
        edges.append({"source": f"student:{student.id}", "target": nid, "kind": "evidenced_by"})

    held = {ss.skill.slug for ss in student.skills if ss.skill}
    for slug in held:
        for neighbour, weight in RELATED.get(slug, {}).items():
            if neighbour in held:
                edges.append(
                    {
                        "source": f"skill:{slug}",
                        "target": f"skill:{neighbour}",
                        "kind": "related",
                        "weight": weight,
                    }
                )

    if student.target_role:
        nodes.append(
            {
                "id": f"role:{student.target_role.slug}",
                "type": "role",
                "label": student.target_role.title,
            }
        )
        for r in student.target_role.requirements:
            if not r.skill:
                continue
            target = f"skill:{r.skill.slug}"
            if r.skill.slug not in held:
                nodes.append(
                    {
                        "id": target,
                        "type": "skill",
                        "label": r.skill.name,
                        "category": r.skill.category,
                        "level": 0,
                        "verified": False,
                        "missing": True,
                        "required_by_target": True,
                    }
                )
            edges.append(
                {
                    "source": f"role:{student.target_role.slug}",
                    "target": target,
                    "kind": "requires",
                    "weight": r.importance / 5,
                }
            )

    seen, unique_nodes = set(), []
    for n in nodes:
        if n["id"] in seen:
            continue
        seen.add(n["id"])
        unique_nodes.append(n)
    return {"nodes": unique_nodes, "edges": edges}


def batch_gap_analytics(db: Session, students: List[Student], role: Role | None) -> dict:
    """Aggregate view for institutes. No individual free-text evidence leaves this function."""
    total = len(students)
    if total == 0:
        return {"total_students": 0, "gaps": [], "strengths": [], "average_readiness": 0.0, "readiness_bands": []}

    reqs = role_requirements(role) if role else []
    gap_counts: Dict[str, dict] = {}
    strength_counts: Dict[str, dict] = {}
    readiness_values = []

    for s in students:
        held = {ss.skill.slug: ss for ss in s.skills if ss.skill}
        for slug, ss in held.items():
            entry = strength_counts.setdefault(
                slug, {"slug": slug, "name": ss.skill.name, "count": 0, "verified": 0}
            )
            entry["count"] += 1
            if ss.verified:
                entry["verified"] += 1

        if reqs:
            result = analyse(s, reqs)
            readiness_values.append(result["readiness"])
            for item in result["missing"] + result["improve"]:
                entry = gap_counts.setdefault(
                    item["slug"],
                    {
                        "slug": item["slug"],
                        "name": item["name"],
                        "missing": 0,
                        "needs_improvement": 0,
                        "importance": item["importance"],
                        "why": item["why"],
                    },
                )
                if item["level"] == 0:
                    entry["missing"] += 1
                else:
                    entry["needs_improvement"] += 1

    gaps = []
    for entry in gap_counts.values():
        affected = entry["missing"] + entry["needs_improvement"]
        entry["affected"] = affected
        entry["percent"] = round(100 * affected / total, 1)
        entry["missing_percent"] = round(100 * entry["missing"] / total, 1)
        gaps.append(entry)
    gaps.sort(key=lambda g: (-g["percent"], -g["importance"]))

    strengths = sorted(strength_counts.values(), key=lambda s: -s["count"])
    for s in strengths:
        s["percent"] = round(100 * s["count"] / total, 1)

    bands = [
        {"band": "Below 40%", "count": sum(1 for r in readiness_values if r < 40)},
        {"band": "40-59%", "count": sum(1 for r in readiness_values if 40 <= r < 60)},
        {"band": "60-79%", "count": sum(1 for r in readiness_values if 60 <= r < 80)},
        {"band": "80%+", "count": sum(1 for r in readiness_values if r >= 80)},
    ]

    return {
        "total_students": total,
        "role": role.title if role else "",
        "average_readiness": round(sum(readiness_values) / len(readiness_values), 1) if readiness_values else 0.0,
        "gaps": gaps[:15],
        "strengths": strengths[:15],
        "readiness_bands": bands,
    }


def training_recommendations(analytics: dict, institute_id: str, batch: str = "") -> List[dict]:
    """Turn batch gaps into concrete training actions an institute can act on."""
    recs = []
    for gap in analytics.get("gaps", [])[:6]:
        if gap["percent"] < 25:
            continue
        recs.append(
            {
                "skill_slug": gap["slug"],
                "skill": gap["name"],
                "title": f"Run a {gap['name']} lab track for {batch or 'this cohort'}",
                "affected_percent": gap["percent"],
                "rationale": (
                    f"{gap['percent']}% of this cohort is short on {gap['name']} against "
                    f"{analytics.get('role') or 'the target role'}. {gap['why']}"
                ),
                "urgency": "high" if gap["percent"] >= 55 and gap["importance"] >= 4 else "medium",
            }
        )
    return recs


def industry_demand(db: Session, limit: int = 12) -> List[dict]:
    """Which skills open opportunities are actually asking for. Read by all three dashboards."""
    from ..models import Opportunity, OpportunitySkill

    rows = (
        db.query(OpportunitySkill, Skill, Opportunity)
        .join(Skill, Skill.id == OpportunitySkill.skill_id)
        .join(Opportunity, Opportunity.id == OpportunitySkill.opportunity_id)
        .filter(Opportunity.is_open.is_(True))
        .all()
    )
    counts: Dict[str, dict] = {}
    for os_row, skill, opp in rows:
        entry = counts.setdefault(
            skill.slug,
            {"slug": skill.slug, "name": skill.name, "openings": 0, "weighted": 0, "employers": set()},
        )
        entry["openings"] += opp.open_positions or 1
        entry["weighted"] += (os_row.importance or 3) * (opp.open_positions or 1)
        entry["employers"].add(opp.company.name if opp.company else "")

    demand = []
    for entry in counts.values():
        entry["employers"] = len([e for e in entry["employers"] if e])
        demand.append(entry)
    demand.sort(key=lambda d: -d["weighted"])
    return demand[:limit]


def supply_vs_demand(db: Session, students: List[Student], limit: int = 10) -> List[dict]:
    """The loop the brief asks for: what industry wants against what a cohort has."""
    demand = industry_demand(db, limit=limit)
    total = max(1, len(students))
    supply: Dict[str, int] = {}
    for s in students:
        for ss in s.skills:
            if ss.skill and ss.level >= 3:
                supply[ss.skill.slug] = supply.get(ss.skill.slug, 0) + 1
    out = []
    for d in demand:
        have_pct = round(100 * supply.get(d["slug"], 0) / total, 1)
        out.append(
            {
                "skill": d["name"],
                "slug": d["slug"],
                "demand": d["weighted"],
                "openings": d["openings"],
                "cohort_supply_percent": have_pct,
            }
        )
    return out


def evidence_summary(student: Student) -> dict:
    verified = sum(1 for e in student.evidence if e.verification_status == "verified")
    return {
        "total": len(student.evidence),
        "verified": verified,
        "unverified": len(student.evidence) - verified,
    }
