from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import admin, auth, industry, institutes, students
from .services.assistant import llm_available

app = FastAPI(
    title="SkillBridge API",
    version="1.0.0",
    description=(
        "One engine, one shared skill graph, three dashboards. "
        "Students, institutes and industry all read and write the same skill representation."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_origin_regex=r"https://.*\.(app\.github\.dev|githubpreview\.dev|gitpod\.io)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "database": "postgres" if settings.database_url.startswith("postgres") else "sqlite",
        "llm_enrichment": llm_available(),
    }


app.include_router(auth.router)
app.include_router(students.router)
app.include_router(institutes.router)
app.include_router(industry.router)
app.include_router(admin.router)
