-- Reference migration for PostgreSQL deployments. Local development may use
-- SQLAlchemy's bootstrap until Alembic is introduced.
CREATE TABLE IF NOT EXISTS applications (
  id varchar(36) PRIMARY KEY,
  company varchar(160) NOT NULL,
  job_title varchar(160) NOT NULL,
  location varchar(160) NOT NULL,
  employment_type varchar(60) NOT NULL,
  job_url varchar(500),
  application_date date NOT NULL,
  status varchar(30) NOT NULL,
  salary_range varchar(120),
  interview_date date,
  follow_up_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS ix_applications_application_date ON applications(application_date);
CREATE INDEX IF NOT EXISTS ix_applications_company ON applications(company);
