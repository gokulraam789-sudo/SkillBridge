"""Seed the platform with the taxonomy plus a demo ecosystem.

Run: python -m app.seed        (safe to re-run; it skips if users already exist)
     python -m app.seed --reset (drops every table first)
"""

import random
import sys

from .data.taxonomy import ROLES, SKILLS
from .database import Base, SessionLocal, engine
from .models import (
    Company,
    Evidence,
    Institute,
    Opportunity,
    OpportunitySkill,
    Role,
    RoleSkill,
    Skill,
    Student,
    StudentSkill,
    User,
)
from .security import hash_password

random.seed(11)

FIRST = ["Aarav", "Diya", "Rohan", "Meera", "Kabir", "Ananya", "Vikram", "Ishita", "Arjun", "Nandini",
         "Farhan", "Sneha", "Karthik", "Priya", "Aditya", "Riya", "Tanvi", "Nikhil", "Zoya", "Harish",
         "Lakshmi", "Dev", "Aisha", "Manav", "Pooja", "Siddharth", "Neha", "Rahul"]
LAST = ["Sharma", "Iyer", "Nair", "Patel", "Reddy", "Khan", "Menon", "Bose", "Gupta", "Rao",
        "Fernandes", "Chauhan", "Krishnan", "Joshi", "Verma", "Das"]

PROJECT_TITLES = [
    ("Campus event booking app", "project"),
    ("Sales dashboard for a local retailer", "project"),
    ("Crop disease classifier", "project"),
    ("Log anomaly detector", "project"),
    ("Hostel mess feedback analytics", "project"),
    ("Personal finance tracker API", "project"),
]
CERTS = [
    ("AWS Cloud Practitioner", "Amazon Web Services", "certification"),
    ("Google Data Analytics Certificate", "Google", "certification"),
    ("NPTEL Data Structures", "NPTEL", "certification"),
    ("Microsoft PL-300 Power BI", "Microsoft", "certification"),
    ("TryHackMe Pre Security", "TryHackMe", "certification"),
]

# Role -> skills a typical student in that track actually has, with the usual weak spots.
PROFILES = {
    "software-developer": (
        ["javascript", "react", "html-css", "git", "oop", "dsa", "problem-solving", "teamwork"],
        ["sql", "nodejs", "testing", "system-design", "rest-api"],
    ),
    "data-analyst": (
        ["excel", "python", "statistics", "communication", "data-viz"],
        ["sql", "powerbi", "data-cleaning", "business-analysis"],
    ),
    "ai-ml-engineer": (
        ["python", "ml", "statistics", "data-cleaning", "problem-solving"],
        ["mlops", "deep-learning", "docker", "nlp"],
    ),
    "cybersecurity-analyst": (
        ["networking", "linux", "security-fundamentals", "python"],
        ["siem", "threat-analysis", "incident-response", "cryptography"],
    ),
    "cloud-engineer": (
        ["linux", "git", "python", "networking"],
        ["aws", "docker", "kubernetes", "terraform", "ci-cd"],
    ),
    "full-stack-developer": (
        ["javascript", "react", "html-css", "git", "nodejs"],
        ["sql", "rest-api", "docker", "testing"],
    ),
}

DEPARTMENTS = ["Computer Science", "Information Technology", "Electronics"]
BATCHES = ["2026", "2027"]


def seed(reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0 and not reset:
            print("Database already has users. Nothing to do. Use --reset to rebuild.")
            return

        skills = {}
        for slug, name, category, _aliases in SKILLS:
            skill = db.query(Skill).filter(Skill.slug == slug).first()
            if not skill:
                skill = Skill(slug=slug, name=name, category=category)
                db.add(skill)
            skills[slug] = skill
        db.flush()

        roles = {}
        for slug, title, summary, requirements in ROLES:
            role = db.query(Role).filter(Role.slug == slug).first()
            if not role:
                role = Role(slug=slug, title=title, summary=summary)
                db.add(role)
                db.flush()
            for skill_slug, importance, expected, rationale in requirements:
                if skill_slug not in skills:
                    continue
                exists = (
                    db.query(RoleSkill)
                    .filter(RoleSkill.role_id == role.id, RoleSkill.skill_id == skills[skill_slug].id)
                    .first()
                )
                if not exists:
                    db.add(
                        RoleSkill(
                            role_id=role.id,
                            skill_id=skills[skill_slug].id,
                            importance=importance,
                            expected_level=expected,
                            rationale=rationale,
                        )
                    )
            roles[slug] = role
        db.flush()

        institutes = [
            Institute(name="Anna Institute of Technology", city="Chennai"),
            Institute(name="Sardar Patel Institute of Engineering", city="Pune"),
        ]
        companies = [
            Company(name="Lumina Systems", sector="Enterprise software"),
            Company(name="Northstar Analytics", sector="Data consulting"),
            Company(name="Arcwave Cloud", sector="Cloud infrastructure"),
            Company(name="Sentinel Labs", sector="Security"),
        ]
        for row in institutes + companies:
            db.add(row)
        db.flush()

        db.add(
            User(
                name="Platform Admin",
                email="admin@skillbridge.dev",
                password_hash=hash_password("admin123"),
                role="admin",
            )
        )
        db.add(
            User(
                name="Dr. Revathi Menon",
                email="tpo@anna.edu",
                password_hash=hash_password("institute123"),
                role="institute",
                institute_id=institutes[0].id,
            )
        )
        db.add(
            User(
                name="Placement Cell",
                email="tpo@spie.edu",
                password_hash=hash_password("institute123"),
                role="institute",
                institute_id=institutes[1].id,
            )
        )
        db.add(
            User(
                name="Sanjay Balaji",
                email="hiring@lumina.dev",
                password_hash=hash_password("industry123"),
                role="industry",
                company_id=companies[0].id,
            )
        )
        db.add(
            User(
                name="Elena Fischer",
                email="talent@northstar.dev",
                password_hash=hash_password("industry123"),
                role="industry",
                company_id=companies[1].id,
            )
        )
        db.flush()

        role_slugs = list(PROFILES.keys())
        students = []
        for i in range(34):
            first, last = random.choice(FIRST), random.choice(LAST)
            name = f"{first} {last}"
            email = f"{first.lower()}.{last.lower()}{i}@student.dev"
            institute = institutes[0] if i < 22 else institutes[1]
            role_slug = role_slugs[i % len(role_slugs)]
            user = User(
                name=name,
                email=email,
                password_hash=hash_password("student123"),
                role="student",
                institute_id=institute.id,
            )
            db.add(user)
            db.flush()
            student = Student(
                user_id=user.id,
                institute_id=institute.id,
                department=random.choice(DEPARTMENTS),
                batch=random.choice(BATCHES),
                headline=f"Final year student working towards {roles[role_slug].title}",
                target_role_id=roles[role_slug].id,
                cgpa=round(random.uniform(6.8, 9.4), 2),
            )
            db.add(student)
            db.flush()
            students.append(student)

            strong, weak = PROFILES[role_slug]
            for slug in strong:
                if slug not in skills:
                    continue
                db.add(
                    StudentSkill(
                        student_id=student.id,
                        skill_id=skills[slug].id,
                        level=random.choice([3, 3, 4, 4, 5]),
                        confidence=round(random.uniform(0.7, 0.95), 2),
                        source=random.choice(["resume", "project", "certificate"]),
                        evidence_text=f"Used across coursework and projects in {student.department}.",
                        verified=random.random() < 0.3,
                    )
                )
            for slug in weak:
                if slug not in skills or random.random() < 0.55:
                    continue
                db.add(
                    StudentSkill(
                        student_id=student.id,
                        skill_id=skills[slug].id,
                        level=random.choice([1, 2, 2]),
                        confidence=round(random.uniform(0.4, 0.7), 2),
                        source="resume",
                        evidence_text="Mentioned once in coursework; no substantial evidence yet.",
                    )
                )

            for title, kind in random.sample(PROJECT_TITLES, k=random.randint(1, 3)):
                db.add(
                    Evidence(
                        student_id=student.id,
                        kind=kind,
                        title=title,
                        description=f"{title} built during the {student.batch} academic year.",
                        verification_status="unverified",
                    )
                )
            if random.random() < 0.6:
                cert_title, issuer, kind = random.choice(CERTS)
                verified = random.random() < 0.5
                db.add(
                    Evidence(
                        student_id=student.id,
                        kind=kind,
                        title=cert_title,
                        issuer=issuer,
                        description=f"Issued by {issuer}.",
                        verification_status="verified" if verified else "unverified",
                        verification_source="digilocker-sandbox" if verified else "",
                    )
                )

        # Demo student account with a deliberately thin graph, so the full journey
        # (upload -> extract -> gap -> roadmap -> match) has something to show.
        demo_user = User(
            name="Ravi Shankar",
            email="student@skillbridge.dev",
            password_hash=hash_password("student123"),
            role="student",
            institute_id=institutes[0].id,
        )
        db.add(demo_user)
        db.flush()
        demo = Student(
            user_id=demo_user.id,
            institute_id=institutes[0].id,
            department="Computer Science",
            batch="2026",
            headline="Third year CS student, aiming at data roles",
            target_role_id=roles["data-analyst"].id,
            cgpa=8.1,
        )
        db.add(demo)
        db.flush()
        for slug, level in [("python", 3), ("excel", 3), ("statistics", 2), ("communication", 3), ("git", 2)]:
            db.add(
                StudentSkill(
                    student_id=demo.id,
                    skill_id=skills[slug].id,
                    level=level,
                    confidence=0.8,
                    source="resume",
                    evidence_text="From an uploaded resume.",
                )
            )
        db.add(
            Evidence(
                student_id=demo.id,
                kind="project",
                title="Hostel mess feedback analytics",
                description="Collected 400 responses and summarised them in a spreadsheet report.",
            )
        )
        students.append(demo)

        opportunity_specs = [
            (companies[0], "Backend Engineering Intern", "internship", "software-developer",
             "Six month internship on the payments service. You will own small features end to end.",
             "Chennai (hybrid)", "Rs 35,000/month", 4),
            (companies[0], "Frontend Developer - Graduate", "job", "full-stack-developer",
             "Graduate role on the product team, building customer-facing interfaces.",
             "Bengaluru", "Rs 9 LPA", 6),
            (companies[1], "Data Analyst Intern", "internship", "data-analyst",
             "Work with the consulting team on client reporting and dashboards.",
             "Remote", "Rs 25,000/month", 5),
            (companies[1], "Retail Demand Forecasting Project", "project", "ai-ml-engineer",
             "Eight week industry project forecasting demand for a retail client. Mentored.",
             "Remote", "Stipend on completion", 3),
            (companies[2], "Cloud Platform Intern", "internship", "cloud-engineer",
             "Join the platform team automating environment provisioning.",
             "Pune (onsite)", "Rs 30,000/month", 3),
            (companies[2], "Infrastructure Automation Challenge", "challenge", "cloud-engineer",
             "Two week challenge: provision a reference environment with Terraform. Top entries interview directly.",
             "Remote", "Prize pool + interview", 20),
            (companies[3], "Security Operations Trainee", "internship", "cybersecurity-analyst",
             "Shadow the SOC team on triage and detection engineering.",
             "Chennai", "Rs 28,000/month", 2),
        ]
        for company, title, kind, role_slug, description, location, stipend, positions in opportunity_specs:
            opp = Opportunity(
                company_id=company.id,
                title=title,
                kind=kind,
                description=description,
                location=location,
                stipend=stipend,
                role_id=roles[role_slug].id,
                open_positions=positions,
            )
            db.add(opp)
            db.flush()
            for rs in sorted(roles[role_slug].requirements, key=lambda r: -r.importance)[:7]:
                db.add(
                    OpportunitySkill(
                        opportunity_id=opp.id,
                        skill_id=rs.skill_id,
                        importance=rs.importance,
                        expected_level=rs.expected_level,
                    )
                )

        db.commit()
        print(f"Seeded {len(students)} students, {len(opportunity_specs)} opportunities, {len(skills)} skills.")
        print("\nDemo sign-ins (password shown):")
        print("  student    student@skillbridge.dev / student123")
        print("  institute  tpo@anna.edu           / institute123")
        print("  industry   hiring@lumina.dev      / industry123")
        print("  admin      admin@skillbridge.dev  / admin123")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
