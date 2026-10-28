import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_and_crud():
    with TestClient(app) as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        payload = {
            "company": "Tkxel", "job_title": "Associate DevOps Engineer", "location": "Islamabad",
            "employment_type": "Full-time", "application_date": "2026-10-28", "status": "Applied",
        }
        response = client.post("/api/v1/applications", json=payload)
        assert response.status_code == 201
        application_id = response.json()["id"]
        assert client.get("/api/v1/applications").json()["total"] == 1
        assert client.get(f"/api/v1/applications/{application_id}").status_code == 200
        assert client.delete(f"/api/v1/applications/{application_id}").status_code == 204


def test_validation_and_missing_resource():
    with TestClient(app) as client:
        assert client.post("/api/v1/applications", json={"company": ""}).status_code == 422
        assert client.get("/api/v1/applications/not-found").status_code == 404


def test_blank_optional_values_are_accepted():
    with TestClient(app) as client:
        response = client.post("/api/v1/applications", json={
            "company": "Example", "job_title": "Engineer", "location": "Remote",
            "employment_type": "Full-time", "application_date": "2026-10-28",
            "status": "Applied", "job_url": "", "interview_date": "",
        })
        assert response.status_code == 201
