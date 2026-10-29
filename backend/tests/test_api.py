import json
import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.main import Application, Base, Document, ReportJob, SessionLocal, app, engine
from app.worker import process_once


def reset_database():
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        session.execute(delete(Document))
        session.execute(delete(ReportJob))
        session.execute(delete(Application))
        session.commit()


def application_payload(**overrides):
    payload = {
        "company": "Tkxel",
        "job_title": "Associate DevOps Engineer",
        "location": "Islamabad",
        "employment_type": "Full-time",
        "application_date": "2026-10-28",
        "status": "Applied",
        "notes": "Follow up next week",
    }
    payload.update(overrides)
    return payload


def create_application(client, **overrides):
    response = client.post("/api/v1/applications", json=application_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def test_health_readiness_request_id_and_crud():
    reset_database()
    with TestClient(app) as client:
        assert client.get("/api/v1/health", headers={"X-Request-ID": "test-request"}).headers["x-request-id"] == "test-request"
        assert client.get("/api/v1/ready").json() == {"status": "ready", "database": "ok"}
        application = create_application(client)
        application_id = application["id"]
        assert client.get(f"/api/v1/applications/{application_id}").json()["company"] == "Tkxel"
        updated = client.patch(f"/api/v1/applications/{application_id}", json=application_payload(company="Updated Co", status="Interview")).json()
        assert updated["company"] == "Updated Co"
        assert updated["status"] == "Interview"
        assert client.delete(f"/api/v1/applications/{application_id}").status_code == 204
        assert client.get(f"/api/v1/applications/{application_id}").status_code == 404


def test_validation_and_missing_resources():
    reset_database()
    with TestClient(app) as client:
        assert client.post("/api/v1/applications", json={"company": ""}).status_code == 422
        assert client.post("/api/v1/applications", json=application_payload(job_url="not-a-url")).status_code == 422
        assert client.post("/api/v1/applications", json=application_payload(interview_date="1899-01-01")).status_code == 422
        assert client.get("/api/v1/applications/not-found").status_code == 404
        assert client.get("/api/v1/reports/not-found").status_code == 404


def test_filters_sorting_and_pagination():
    reset_database()
    with TestClient(app) as client:
        create_application(client, company="Zeta", job_title="Platform Engineer", location="Lahore", status="Interview", application_date="2026-10-20")
        create_application(client, company="Alpha", job_title="Backend Engineer", location="Remote", status="Applied", application_date="2026-10-25")
        create_application(client, company="Beta", job_title="DevOps Engineer", location="Lahore", status="Rejected", application_date="2026-10-27")
        response = client.get("/api/v1/applications", params={"search": "Engineer", "location": "Lahore", "status": "Interview", "page": 1, "page_size": 1, "sort": "company", "order": "asc"})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["company"] == "Zeta"
        assert data["page_size"] == 1
        assert client.get("/api/v1/applications", params={"sort": "unsupported"}).status_code == 422


def test_dashboard_stats_are_database_derived():
    reset_database()
    with TestClient(app) as client:
        create_application(client, status="Offer")
        create_application(client, status="Rejected", interview_date="2026-12-01")
        data = client.get("/api/v1/dashboard/stats").json()
        assert data["total"] == 2
        assert data["this_month"] == 2
        assert data["offers"] == 1
        assert data["rejected"] == 1
        assert data["distribution"]["Offer"] == 1


def test_blank_optional_values_are_accepted():
    reset_database()
    with TestClient(app) as client:
        response = client.post("/api/v1/applications", json=application_payload(job_url="", interview_date="", follow_up_date=""))
        assert response.status_code == 201
        assert response.json()["job_url"] is None


def test_pdf_upload_list_download_and_invalid_content():
    reset_database()
    valid_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
    with TestClient(app) as client:
        application = create_application(client)
        url = f"/api/v1/applications/{application['id']}/documents"
        invalid = client.post(url, files={"file": ("bad.pdf", b"not a pdf", "application/pdf")})
        assert invalid.status_code == 422
        uploaded = client.post(url, files={"file": ("resume.pdf", valid_pdf, "application/pdf")})
        assert uploaded.status_code == 201
        document = uploaded.json()
        assert client.get(url).json()[0]["original_name"] == "resume.pdf"
        downloaded = client.get(f"/api/v1/documents/{document['id']}")
        assert downloaded.status_code == 200
        assert downloaded.content == valid_pdf
        assert client.get("/api/v1/documents/not-found").status_code == 404


def test_report_job_is_processed_by_worker():
    reset_database()
    with TestClient(app) as client:
        create_application(client)
        submitted = client.post("/api/v1/reports")
        assert submitted.status_code == 202
        job_id = submitted.json()["job_id"]
        assert submitted.json()["state"] == "pending"
        assert process_once() is True
        result = client.get(f"/api/v1/reports/{job_id}").json()
        assert result["state"] == "completed"
        assert json.loads(result["result"])["application_count"] == 1
