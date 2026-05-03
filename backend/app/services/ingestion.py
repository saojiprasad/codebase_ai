import asyncio
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any

from app.analysis.api_extractor import extract_api_map
from app.analysis.bug_detector import detect_issues
from app.analysis.database_mapper import map_database_relationships
from app.analysis.diagram_generator import generate_diagrams
from app.analysis.graph_builder import build_knowledge_graph
from app.analysis.improvement_engine import suggest_improvements
from app.analysis.tech_stack import detect_tech_stack
from app.core.config import Settings
from app.core.errors import UnsafeInputError
from app.database import Database
from app.parser.code_parser import parse_repository_files
from app.parser.file_scanner import scan_repository
from app.readme.generator import generate_readme
from app.security.sandbox import safe_environment, safe_extract_zip, safe_repo_name, validate_local_path
from app.vectorstore.store import VectorStore


class IngestionService:
    def __init__(self, settings: Settings, db: Database, vectors: VectorStore) -> None:
        self.settings = settings
        self.db = db
        self.vectors = vectors

    def create_local_project(self, local_path: str, name: str | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        root = validate_local_path(local_path)
        return self._create_project(root, "local_path", name or root.name)

    def create_github_project(self, repo_url: str, name: str | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        project_id = str(uuid.uuid4())
        repo_name = safe_repo_name(name or repo_url.rstrip("/").split("/")[-1].replace(".git", ""))
        root = self.settings.project_dir / project_id / repo_name
        root.parent.mkdir(parents=True, exist_ok=True)
        project = self.db.create_project(
            {
                "id": project_id,
                "name": repo_name,
                "root_path": str(root),
                "source_type": "github_url",
                "status": "queued",
                "metadata": {"repo_url": repo_url},
            }
        )
        job = self.db.create_job({"id": str(uuid.uuid4()), "project_id": project_id, "kind": "ingest"})
        return project, job

    def create_zip_project(self, zip_path: Path, name: str | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        project_id = str(uuid.uuid4())
        destination = self.settings.project_dir / project_id
        root = safe_extract_zip(zip_path, destination, self.settings)
        return self._create_project(root, "zip_upload", name or root.name, project_id=project_id)

    async def run_ingestion(self, project_id: str, job_id: str) -> None:
        try:
            await self._update(job_id, "running", "preparing", 5, "Preparing repository")
            project = self.db.get_project(project_id)
            self.db.update_project(project_id, status="running")
            if project["source_type"] == "github_url":
                await asyncio.to_thread(self._clone_repository, project)
                project = self.db.get_project(project_id)

            root = Path(project["root_path"]).resolve()
            await self._update(job_id, "running", "scanning", 15, "Scanning files")
            scan = await asyncio.to_thread(scan_repository, root, self.settings)

            await self._update(job_id, "running", "parsing", 32, "Parsing code structure")
            parsed_files = await asyncio.to_thread(parse_repository_files, root, scan["files"], self.settings)

            await self._update(job_id, "running", "analysis", 50, "Detecting stack and relationships")
            tech_stack = await asyncio.to_thread(detect_tech_stack, root, scan["files"])
            graph = await asyncio.to_thread(build_knowledge_graph, parsed_files)
            api_map = extract_api_map(parsed_files)
            database_map = await asyncio.to_thread(map_database_relationships, root, parsed_files)
            bugs = detect_issues(parsed_files, graph)
            diagrams = generate_diagrams(scan, tech_stack, api_map, graph)

            await self._update(job_id, "running", "embedding", 75, "Building vector index")
            chunks = [chunk for file in parsed_files for chunk in file.get("chunks", [])]
            self.vectors.reset_project(project_id)
            embedded_count = await asyncio.to_thread(self.vectors.upsert_chunks, project_id, chunks)

            result = {
                **scan,
                "parsed_files": compact_parsed_files(parsed_files),
                "tech_stack": tech_stack,
                "knowledge_graph": graph,
                "api_map": api_map,
                "database_map": database_map,
                "bugs": bugs,
                "diagrams": diagrams,
                "embedding_count": embedded_count,
            }
            result["improvements"] = suggest_improvements(result)
            readme = generate_readme({**project, "scan_result": result})
            result["generated_readme"] = readme

            self.db.update_project(project_id, status="ready", scan_result=result)
            await self._update(job_id, "completed", "done", 100, "Repository indexed", result={"project_id": project_id})
        except Exception as exc:
            self.db.update_project(project_id, status="failed")
            await self._update(job_id, "failed", "error", 100, "Indexing failed", error=str(exc))

    def _create_project(
        self,
        root: Path,
        source_type: str,
        name: str,
        project_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        project_id = project_id or str(uuid.uuid4())
        project = self.db.create_project(
            {
                "id": project_id,
                "name": safe_repo_name(name),
                "root_path": str(root.resolve()),
                "source_type": source_type,
                "status": "queued",
            }
        )
        job = self.db.create_job({"id": str(uuid.uuid4()), "project_id": project_id, "kind": "ingest"})
        return project, job

    def _clone_repository(self, project: dict[str, Any]) -> None:
        repo_url = project.get("metadata", {}).get("repo_url")
        if not repo_url:
            raise UnsafeInputError("Missing GitHub repository URL.")
        root = Path(project["root_path"])
        if root.exists() and any(root.iterdir()):
            return
        if root.exists():
            shutil.rmtree(root)
        root.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, str(root)],
            check=True,
            env=safe_environment(),
            capture_output=True,
            text=True,
            timeout=600,
        )

    async def _update(
        self,
        job_id: str,
        status: str,
        phase: str,
        progress: int,
        message: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        self.db.update_job(
            job_id,
            status=status,
            phase=phase,
            progress=progress,
            message=message,
            result=result or {},
            error=error,
        )


def compact_parsed_files(parsed_files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for file in parsed_files:
        compacted.append(
            {
                "path": file["path"],
                "language": file["language"],
                "line_count": file["line_count"],
                "ast": file.get("ast"),
                "imports": file.get("imports", []),
                "classes": file.get("classes", []),
                "functions": file.get("functions", []),
                "apis": file.get("apis", []),
                "comments": file.get("comments", [])[:5],
                "chunk_count": len(file.get("chunks", [])),
            }
        )
    return compacted
