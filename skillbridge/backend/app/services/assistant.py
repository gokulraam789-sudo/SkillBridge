"""Student assistant.

Answers are grounded in the student's own skill graph, gap analysis and matches -
never invented. If ANTHROPIC_API_KEY is set, that grounded context is handed to the
model for a better-written answer; if not, the deterministic answers below are used
and the platform still demonstrates end to end.
"""

import json
from typing import List

import httpx

from ..config import settings

SYSTEM = (
    "You are the SkillBridge study advisor. You answer a student's questions using only the "
    "JSON context provided, which comes from their own skill graph, gap analysis and matched "
    "opportunities. Be concrete and brief - at most 150 words. Name specific skills and "
    "opportunities from the context. Never invent a skill, score or employer that is not in "
    "the context. If the context does not answer the question, say what the student needs to "
    "add to their profile first."
)


def llm_available() -> bool:
    return bool(settings.anthropic_api_key)


def ask_llm(question: str, context: dict) -> str | None:
    if not llm_available():
        return None
    try:
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.anthropic_model,
                "max_tokens": 600,
                "system": SYSTEM,
                "messages": [
                    {
                        "role": "user",
                        "content": f"Context:\n{json.dumps(context)[:12000]}\n\nQuestion: {question}",
                    }
                ],
            },
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()
        return "\n".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()
    except Exception:  # noqa: BLE001
        return None


def _bullets(lines: List[str]) -> str:
    return "\n".join(f"- {line}" for line in lines)


def fallback_answer(question: str, context: dict) -> str:
    q = question.lower()
    gaps = context.get("gap", {})
    role = context.get("target_role") or "your target role"
    missing = gaps.get("missing", [])
    improve = gaps.get("improve", [])
    have = gaps.get("have", [])
    matches = context.get("matches", [])
    roadmap = context.get("roadmap", [])

    if not context.get("target_role"):
        return (
            "Pick a target role first - gap analysis, the roadmap and opportunity matching all "
            "compare your graph against a role. You can set one from your dashboard."
        )

    if any(k in q for k in ["missing", "lack", "don't have", "dont have", "gap"]):
        if not missing and not improve:
            return f"Nothing is missing for {role} right now. Your graph covers every requirement."
        lines = [f"{m['name']} - {m['why']}" for m in (missing or improve)[:5]]
        return f"Against {role} you are short on:\n{_bullets(lines)}"

    if any(k in q for k in ["next", "learn", "start", "roadmap", "study"]):
        if not roadmap:
            return "Your roadmap is empty - generate it from the Roadmap page and it will order your gaps for you."
        first = roadmap[0]
        rest = ", ".join(r["skill"] for r in roadmap[1:4])
        lines = [
            f"Start with {first['skill']}. {first['action']}",
            f"Evidence to build: {first['project_idea']}",
        ]
        if rest:
            lines.append(f"After that: {rest}.")
        return "\n".join(lines)

    if any(k in q for k in ["why", "not matching", "rejected", "score"]):
        if matches:
            top = matches[0]
            return (
                f"Your closest match is {top['title']} at {top['company']} at {top['score']}%.\n"
                + _bullets(top["reasons"])
            )
        return f"You are at {gaps.get('readiness', 0)}% readiness for {role}. " + _bullets(
            [f"{m['name']}: {m.get('reason', m['why'])}" for m in (missing + improve)[:4]]
        )

    if any(k in q for k in ["opportunit", "intern", "job", "apply", "fit"]):
        if not matches:
            return "No open opportunities match your graph yet. Adding evidence for your top gaps will change that."
        lines = [f"{m['title']} at {m['company']} - {m['score']}% match" for m in matches[:4]]
        return f"Best fits for your current graph:\n{_bullets(lines)}"

    if any(k in q for k in ["ready", "readiness", "improve", "prepare"]):
        return (
            f"You are at {gaps.get('readiness', 0)}% readiness for {role}, covering {len(have)} requirements.\n"
            + _bullets([f"Close {m['name']} - {m.get('reason', m['why'])}" for m in (missing + improve)[:3]])
        )

    if any(k in q for k in ["strength", "good at", "have"]):
        if not have:
            return "Nothing is evidenced at the required level yet - upload a resume or projects to start."
        return f"Strongest evidenced skills for {role}:\n" + _bullets(
            [f"{h['name']} at {h['level_label'].lower()} level" for h in have[:6]]
        )

    return (
        f"You are at {gaps.get('readiness', 0)}% readiness for {role}. Ask me what you are missing, "
        "what to learn next, why you are not matching a role, or which opportunities fit."
    )


def answer(question: str, context: dict) -> dict:
    text = ask_llm(question, context)
    if text:
        return {"answer": text, "engine": "anthropic"}
    return {"answer": fallback_answer(question, context), "engine": "built-in"}
