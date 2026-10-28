"""Small database-backed worker for local development.

Run with `python -m app.worker`; a production deployment can replace this
polling loop with an SQS consumer without changing the report model.
"""
import json
import time
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError, ProgrammingError

from .main import Application, Base, ReportJob, SessionLocal, engine


def process_once() -> bool:
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        job = session.scalar(select(ReportJob).where(ReportJob.state == "pending").order_by(ReportJob.created_at).with_for_update().limit(1))
        if not job:
            return False
        job.state, job.attempts = "processing", job.attempts + 1
        session.commit()
        try:
            count = session.scalar(select(func.count()).select_from(Application)) or 0
            job.result = json.dumps({"summary": f"Job search contains {count} applications.", "application_count": count})
            job.state = "completed"
        except Exception as exc:
            job.state, job.error = "failed", str(exc)
        job.completed_at = datetime.now(timezone.utc)
        session.commit()
        return True


if __name__ == "__main__":
    while True:
        try:
            process_once()
        except (OperationalError, ProgrammingError):
            time.sleep(2)
            continue
        time.sleep(2)
