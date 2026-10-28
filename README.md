# Trackly — Job Application Tracker

Trackly is a local-first job search workspace with a React/Vite dashboard and a FastAPI API. It stores real applications in SQLite for quick development or PostgreSQL in Compose, validates PDF uploads, and provides a persistent report-job API.

## Features

- Application CRUD with search, pagination, sorting, filters, validation, and status badges.
- Database-backed dashboard statistics and upcoming-interview counts.
- Private local PDF storage with random object names and authorized download endpoints.
- Persistent report jobs with asynchronous-style `202` submission and status retrieval.
- Health/readiness endpoints, request IDs, explicit CORS, OpenAPI docs, and Docker Compose.

Authentication, Redis cache wiring, Alembic CLI migrations, and AWS adapters are intentionally documented as next steps rather than claimed as implemented. The current local API has no user identity boundary and should not be exposed publicly.

## Local development

Prerequisites: Python 3.12+, Node 20+, and npm.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. API docs are at http://localhost:8000/docs. The default SQLite database is created on first API startup; for production-like local testing set `DATABASE_URL` to PostgreSQL before starting the API.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose runs a one-shot `init-db` service before the API and worker so all tables exist before they query PostgreSQL. The Compose API uses PostgreSQL and the frontend is available at http://localhost:5173. Inspect logs with `docker compose logs -f api`; rebuild with `docker compose build --no-cache`. Stop services with `docker compose down` (add `-v` only when intentionally deleting local data).

## Tests

```bash
cd backend
pytest -q
```

The test suite uses SQLite in-memory mode. Run PostgreSQL integration checks by setting `DATABASE_URL` to a test database and starting the Compose `db` service. Upload limits are 10 MB and only PDF content types/extensions are accepted.

## API summary

- `GET /api/v1/health`, `GET /api/v1/ready`
- `GET|POST /api/v1/applications`
- `GET|PATCH|DELETE /api/v1/applications/{id}`
- `GET /api/v1/dashboard/stats`
- `POST|GET /api/v1/applications/{id}/documents`, `GET /api/v1/documents/{id}`
- `POST /api/v1/reports`, `GET /api/v1/reports/{job_id}`

## Architecture and AWS readiness

The browser calls the API, which owns persistence and private file access. Compose supplies PostgreSQL and Redis-compatible infrastructure; the current API uses SQLite by default and has a replaceable database configuration. Future work should add Alembic migrations, authentication/user ownership, a Redis cache abstraction, a separate worker/queue consumer, and S3 storage with presigned URLs. ECS/ECR, RDS, ElastiCache, SQS, CloudFront, Secrets Manager, and CloudWatch deployment configuration are not provisioned by this repository.
