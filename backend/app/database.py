import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    """Small SQLite persistence layer for local-first operation."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()

    def init(self) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    root_path TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    scan_result_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    kind TEXT NOT NULL,
                    status TEXT NOT NULL,
                    phase TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    message TEXT NOT NULL DEFAULT '',
                    result_json TEXT NOT NULL DEFAULT '{}',
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    citations_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL
                )
                """
            )

    def create_project(self, project: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO projects (
                    id, name, root_path, source_type, status,
                    metadata_json, scan_result_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project["id"],
                    project["name"],
                    project["root_path"],
                    project["source_type"],
                    project.get("status", "queued"),
                    json.dumps(project.get("metadata", {})),
                    json.dumps(project.get("scan_result", {})),
                    now,
                    now,
                ),
            )
        return self.get_project(project["id"])

    def update_project(self, project_id: str, **fields: Any) -> dict[str, Any]:
        allowed = {"name", "root_path", "source_type", "status"}
        assignments: list[str] = []
        values: list[Any] = []
        for key, value in fields.items():
            if key in allowed:
                assignments.append(f"{key} = ?")
                values.append(value)
            elif key == "metadata":
                assignments.append("metadata_json = ?")
                values.append(json.dumps(value))
            elif key == "scan_result":
                assignments.append("scan_result_json = ?")
                values.append(json.dumps(value))
        assignments.append("updated_at = ?")
        values.append(utc_now())
        values.append(project_id)
        with self._lock, self._conn:
            self._conn.execute(
                f"UPDATE projects SET {', '.join(assignments)} WHERE id = ?",
                values,
            )
        return self.get_project(project_id)

    def get_project(self, project_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row is None:
            raise KeyError(project_id)
        return self._project_from_row(row)

    def list_projects(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return [self._project_from_row(row) for row in rows]

    def create_job(self, job: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO jobs (
                    id, project_id, kind, status, phase, progress, message,
                    result_json, error, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job["id"],
                    job.get("project_id"),
                    job["kind"],
                    job.get("status", "queued"),
                    job.get("phase", "queued"),
                    job.get("progress", 0),
                    job.get("message", ""),
                    json.dumps(job.get("result", {})),
                    job.get("error"),
                    now,
                    now,
                ),
            )
        return self.get_job(job["id"])

    def update_job(self, job_id: str, **fields: Any) -> dict[str, Any]:
        allowed = {"project_id", "kind", "status", "phase", "progress", "message", "error"}
        assignments: list[str] = []
        values: list[Any] = []
        for key, value in fields.items():
            if key in allowed:
                assignments.append(f"{key} = ?")
                values.append(value)
            elif key == "result":
                assignments.append("result_json = ?")
                values.append(json.dumps(value))
        assignments.append("updated_at = ?")
        values.append(utc_now())
        values.append(job_id)
        with self._lock, self._conn:
            self._conn.execute(f"UPDATE jobs SET {', '.join(assignments)} WHERE id = ?", values)
        return self.get_job(job_id)

    def get_job(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row is None:
            raise KeyError(job_id)
        return self._job_from_row(row)

    def add_chat_message(self, message: dict[str, Any]) -> dict[str, Any]:
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO chat_messages (id, project_id, role, content, citations_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    message["id"],
                    message["project_id"],
                    message["role"],
                    message["content"],
                    json.dumps(message.get("citations", [])),
                    utc_now(),
                ),
            )
        return message

    def list_chat_messages(self, project_id: str, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT * FROM chat_messages
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (project_id, limit),
            ).fetchall()
        messages = [
            {
                "id": row["id"],
                "project_id": row["project_id"],
                "role": row["role"],
                "content": row["content"],
                "citations": json.loads(row["citations_json"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
        return list(reversed(messages))

    @staticmethod
    def _project_from_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "root_path": row["root_path"],
            "source_type": row["source_type"],
            "status": row["status"],
            "metadata": json.loads(row["metadata_json"]),
            "scan_result": json.loads(row["scan_result_json"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    @staticmethod
    def _job_from_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "project_id": row["project_id"],
            "kind": row["kind"],
            "status": row["status"],
            "phase": row["phase"],
            "progress": row["progress"],
            "message": row["message"],
            "result": json.loads(row["result_json"]),
            "error": row["error"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

