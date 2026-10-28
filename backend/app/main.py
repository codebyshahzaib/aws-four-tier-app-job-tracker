from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, create_engine, func, select
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("job-tracker")

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'job_tracker.db'}")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
pool_args = {"poolclass": StaticPool} if DATABASE_URL == "sqlite:///:memory:" else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, **pool_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class JobStatus(str, Enum):
    wishlist = "Wishlist"
    applied = "Applied"
    screening = "Screening"
    interview = "Interview"
    offer = "Offer"
    rejected = "Rejected"
    withdrawn = "Withdrawn"


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        Index("ix_applications_status", "status"),
        Index("ix_applications_application_date", "application_date"),
        Index("ix_applications_company", "company"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company: Mapped[str] = mapped_column(String(160), nullable=False)
    job_title: Mapped[str] = mapped_column(String(160), nullable=False)
    location: Mapped[str] = mapped_column(String(160), nullable=False)
    employment_type: Mapped[str] = mapped_column(String(60), nullable=False)
    job_url: Mapped[str | None] = mapped_column(String(500))
    application_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=JobStatus.applied.value)
    salary_range: Mapped[str | None] = mapped_column(String(120))
    interview_date: Mapped[date | None] = mapped_column(Date)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ReportJob(Base):
    __tablename__ = "report_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    result: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Job Application Tracker API", version="1.0.0", lifespan=lifespan)
origins = [value.strip() for value in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if value.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


def db_session():
    with SessionLocal() as session:
        yield session


class ApplicationInput(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    company: str = Field(min_length=1, max_length=160)
    job_title: str = Field(min_length=1, max_length=160)
    location: str = Field(min_length=1, max_length=160)
    employment_type: str = Field(min_length=1, max_length=60)
    job_url: HttpUrl | None = None
    application_date: date
    status: JobStatus = JobStatus.applied
    salary_range: str | None = Field(default=None, max_length=120)
    interview_date: date | None = None
    follow_up_date: date | None = None
    notes: str = Field(default="", max_length=10000)

    @field_validator("job_url", "interview_date", "follow_up_date", mode="before")
    @classmethod
    def blank_optional_values_are_null(cls, value):
        return None if value == "" else value

    @field_validator("interview_date", "follow_up_date")
    @classmethod
    def dates_are_valid(cls, value: date | None):
        if value and value < date(2000, 1, 1):
            raise ValueError("date is not valid")
        return value


class ApplicationOutput(ApplicationInput):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)
    id: str
    created_at: datetime
    updated_at: datetime


class Page(BaseModel):
    items: list[ApplicationOutput]
    total: int
    page: int
    page_size: int


def get_application(session: Session, application_id: str) -> Application:
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/ready")
def ready(session: Annotated[Session, Depends(db_session)]):
    try:
        session.execute(select(func.count()).select_from(Application)).scalar_one()
    except Exception as exc:
        logger.exception("readiness check failed")
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ready", "database": "ok"}


@app.post("/api/v1/applications", response_model=ApplicationOutput, status_code=201)
def create_application(payload: ApplicationInput, session: Annotated[Session, Depends(db_session)]):
    values = payload.model_dump()
    if values["job_url"] is not None:
        values["job_url"] = str(values["job_url"])
    application = Application(**values)
    session.add(application)
    session.commit()
    session.refresh(application)
    return application


@app.get("/api/v1/applications", response_model=Page)
def list_applications(
    session: Annotated[Session, Depends(db_session)],
    search: str | None = None,
    status_filter: Annotated[JobStatus | None, Query(alias="status")] = None,
    location: str | None = None,
    employment_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = Query("application_date"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
):
    allowed_sort = {"application_date": Application.application_date, "company": Application.company, "job_title": Application.job_title, "interview_date": Application.interview_date}
    if sort not in allowed_sort:
        raise HTTPException(status_code=422, detail="unsupported sort field")
    query = select(Application)
    count_query = select(func.count()).select_from(Application)
    filters = []
    if search:
        filters.append((Application.company.ilike(f"%{search}%")) | (Application.job_title.ilike(f"%{search}%")))
    if status_filter:
        filters.append(Application.status == status_filter.value)
    if location:
        filters.append(Application.location.ilike(f"%{location}%"))
    if employment_type:
        filters.append(Application.employment_type == employment_type)
    query = query.where(*filters)
    count_query = count_query.where(*filters)
    sort_column = allowed_sort[sort]
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc()).offset((page - 1) * page_size).limit(page_size)
    items = session.scalars(query).all()
    return Page(items=items, total=session.scalar(count_query) or 0, page=page, page_size=page_size)


@app.get("/api/v1/applications/{application_id}", response_model=ApplicationOutput)
def read_application(application_id: str, session: Annotated[Session, Depends(db_session)]):
    return get_application(session, application_id)


@app.patch("/api/v1/applications/{application_id}", response_model=ApplicationOutput)
def update_application(application_id: str, payload: ApplicationInput, session: Annotated[Session, Depends(db_session)]):
    application = get_application(session, application_id)
    values = payload.model_dump()
    if values["job_url"] is not None:
        values["job_url"] = str(values["job_url"])
    for key, value in values.items():
        setattr(application, key, value)
    session.commit()
    session.refresh(application)
    return application


@app.delete("/api/v1/applications/{application_id}", status_code=204)
def delete_application(application_id: str, session: Annotated[Session, Depends(db_session)]):
    application = get_application(session, application_id)
    session.delete(application)
    session.commit()


@app.get("/api/v1/dashboard/stats")
def dashboard_stats(session: Annotated[Session, Depends(db_session)]):
    rows = session.execute(select(Application.status, func.count()).group_by(Application.status)).all()
    distribution = {status.value: 0 for status in JobStatus}
    distribution.update({name: count for name, count in rows})
    month = datetime.now(timezone.utc).date().replace(day=1)
    total = session.scalar(select(func.count()).select_from(Application)) or 0
    monthly = session.scalar(select(func.count()).select_from(Application).where(Application.application_date >= month)) or 0
    interviews = session.scalar(select(func.count()).select_from(Application).where(Application.interview_date >= date.today())) or 0
    recent = session.scalars(select(Application).order_by(Application.created_at.desc()).limit(5)).all()
    return {"total": total, "this_month": monthly, "interviews": interviews, "offers": distribution[JobStatus.offer.value], "rejected": distribution[JobStatus.rejected.value], "distribution": distribution, "recent": [ApplicationOutput.model_validate(item) for item in recent]}


@app.post("/api/v1/applications/{application_id}/documents", status_code=201)
async def upload_document(application_id: str, file: UploadFile = File(...), session: Session = Depends(db_session)):
    get_application(session, application_id)
    if file.content_type != "application/pdf" or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="only PDF documents are supported")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="file must be 10 MB or smaller")
    object_name = f"{uuid.uuid4()}.pdf"
    (UPLOAD_DIR / object_name).write_bytes(content)
    document = Document(application_id=application_id, original_name=file.filename, object_name=object_name, content_type=file.content_type, size=len(content))
    session.add(document)
    session.commit()
    return {"id": document.id, "name": document.original_name, "size": document.size}


@app.get("/api/v1/applications/{application_id}/documents")
def list_documents(application_id: str, session: Annotated[Session, Depends(db_session)]):
    get_application(session, application_id)
    return session.scalars(select(Document).where(Document.application_id == application_id).order_by(Document.created_at.desc())).all()


@app.get("/api/v1/documents/{document_id}")
def download_document(document_id: str, session: Annotated[Session, Depends(db_session)]):
    document = session.get(Document, document_id)
    if not document or not (UPLOAD_DIR / document.object_name).is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(UPLOAD_DIR / document.object_name, media_type=document.content_type, filename=document.original_name)


@app.post("/api/v1/reports", status_code=202)
def create_report(session: Annotated[Session, Depends(db_session)]):
    job = ReportJob()
    session.add(job)
    session.commit()
    return {"job_id": job.id, "state": job.state}


@app.get("/api/v1/reports/{job_id}")
def get_report(job_id: str, session: Annotated[Session, Depends(db_session)]):
    job = session.get(ReportJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Report job not found")
    return {"job_id": job.id, "state": job.state, "result": job.result, "error": job.error}
