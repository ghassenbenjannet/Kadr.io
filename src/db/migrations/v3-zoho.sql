ALTER TABLE champs ADD COLUMN disparu_le TEXT;
ALTER TABLE modules ADD COLUMN disparu_le TEXT;

CREATE TABLE imports (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  version_api TEXT NOT NULL,
  resume_json TEXT NOT NULL
);
