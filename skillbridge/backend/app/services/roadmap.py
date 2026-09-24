"""Learning roadmap generation.

Gaps are ordered by priority, then by prerequisite before dependant, so a student
is never told to learn Kubernetes before Docker.
"""

from typing import Dict, List

from .semantic import RELATED

PROJECT_IDEAS: Dict[str, str] = {
    "sql": "Load a public dataset into Postgres and answer five business questions with joins and window functions.",
    "powerbi": "Rebuild your best spreadsheet analysis as a three-page Power BI report with drill-through.",
    "excel": "Model a small business P&L with lookups, pivots and a one-screen summary tab.",
    "python": "Automate a repetitive task you actually do each week and put it on a schedule.",
    "statistics": "Run an A/B test on a public dataset and write up the result with confidence intervals.",
    "data-cleaning": "Take a deliberately messy CSV and document every cleaning decision you make.",
    "data-viz": "Take one dataset and design three charts for three different audiences.",
    "ml": "Train a baseline and one tuned model on a tabular problem and explain the gap between them.",
    "deep-learning": "Fine-tune a small pretrained model on a dataset you collected yourself.",
    "nlp": "Build a document question-answering tool over your own course notes.",
    "mlops": "Wrap one of your models in an API, containerise it and add basic monitoring.",
    "dsa": "Work through a structured set of problems by pattern and write up each pattern in your own words.",
    "react": "Rebuild an app you use daily as a React front end with real routing and state.",
    "nodejs": "Serve one of your React apps from an API you wrote, with auth.",
    "rest-api": "Design and document an API for a small product, including error and pagination behaviour.",
    "git": "Run one of your projects properly: branches, pull requests, reviews and a clean history.",
    "docker": "Containerise one of your existing projects so it runs anywhere with one command.",
    "kubernetes": "Deploy a two-service app to a local cluster with health checks and rolling updates.",
    "aws": "Host a full project on AWS: storage, compute, a managed database and a custom domain.",
    "terraform": "Recreate that AWS setup entirely in code, then tear it down and rebuild it.",
    "ci-cd": "Add a pipeline that runs your tests and deploys on merge to main.",
    "testing": "Take an untested project of yours to meaningful coverage on its critical paths.",
    "linux": "Run a service on a bare VM and manage it with systemd, logs and a firewall.",
    "networking": "Capture and read your own traffic, then explain a full request path end to end.",
    "security-fundamentals": "Audit one of your own applications against the OWASP Top Ten and fix what you find.",
    "threat-analysis": "Work a vulnerable-by-design lab environment and write a findings report.",
    "siem": "Ship logs from two machines into a SIEM and build detection rules for three scenarios.",
    "incident-response": "Write and rehearse a runbook for one realistic incident scenario.",
    "cryptography": "Implement and then break a naive scheme to show why the standard one exists.",
    "system-design": "Write a design doc for a system you use daily, with capacity estimates and trade-offs.",
    "communication": "Present one of your projects in five minutes to a non-technical audience.",
    "teamwork": "Ship a project with two other people using real issue tracking and code review.",
    "problem-solving": "Keep a decision log for a project, recording what you chose and why.",
}

RESOURCES: Dict[str, str] = {
    "sql": "Mode SQL Tutorial, then PostgreSQL official docs on window functions",
    "powerbi": "Microsoft Learn: Power BI Data Analyst (PL-300) path",
    "python": "Python official tutorial, then Automate the Boring Stuff",
    "statistics": "StatQuest, then Think Stats",
    "ml": "Andrew Ng Machine Learning Specialization",
    "deep-learning": "fast.ai Practical Deep Learning for Coders",
    "nlp": "Hugging Face NLP Course",
    "dsa": "NeetCode roadmap by pattern",
    "react": "react.dev Learn, then the React docs on data fetching",
    "docker": "Docker official getting-started, then Docker Curriculum",
    "kubernetes": "Kubernetes Basics interactive tutorials",
    "aws": "AWS Skill Builder Cloud Practitioner, then Solutions Architect Associate",
    "terraform": "HashiCorp Learn: Terraform fundamentals",
    "linux": "Linux Journey, then OverTheWire Bandit",
    "networking": "Computer Networking: A Top-Down Approach, chapters 1-4",
    "security-fundamentals": "OWASP Top Ten, then TryHackMe Pre Security",
    "threat-analysis": "TryHackMe Jr Penetration Tester path",
    "siem": "Splunk Fundamentals 1, or the Wazuh documentation",
    "ci-cd": "GitHub Actions documentation, starting from workflow syntax",
    "system-design": "System Design Primer",
}


def _prerequisites(slug: str) -> List[str]:
    return [dep for dep, weight in RELATED.get(slug, {}).items() if weight >= 0.5]


def generate(gap_result: dict, held: Dict[str, int], max_items: int = 8) -> List[dict]:
    candidates = gap_result["missing"] + gap_result["improve"]
    candidates = sorted(candidates, key=lambda i: -i["priority"])[:max_items]

    chosen = {c["slug"]: c for c in candidates}
    ordered: List[dict] = []
    placed = set()

    def place(slug: str):
        if slug in placed or slug not in chosen:
            return
        for dep in _prerequisites(slug):
            if dep in chosen and dep not in placed:
                place(dep)
        placed.add(slug)
        ordered.append(chosen[slug])

    for c in candidates:
        place(c["slug"])

    items = []
    for i, item in enumerate(ordered, start=1):
        slug = item["slug"]
        gap_size = max(1, item["expected_level"] - item["level"])
        action = (
            f"Get {item['name']} from {item['level_label'].lower()} to "
            f"{'working' if item['expected_level'] <= 3 else 'strong'} level."
            if item["level"] > 0
            else f"Start {item['name']} from the fundamentals and build one piece of evidence."
        )
        items.append(
            {
                "step": i,
                "skill_slug": slug,
                "skill": item["name"],
                "action": action,
                "why": item["why"],
                "project_idea": PROJECT_IDEAS.get(slug, f"Build something small that only works if you understand {item['name']}."),
                "resource": RESOURCES.get(slug, ""),
                "estimated_weeks": min(8, 2 * gap_size),
                "priority": item["priority"],
            }
        )
    return items
