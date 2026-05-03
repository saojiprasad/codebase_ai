import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.chat.rag import RepositoryChatService
from app.core.config import Settings, get_settings
from app.core.dependencies import get_chat_service, get_database, get_ingestion_service, get_vector_store
from app.database import Database
from app.models.schemas import ChatRequest, ChatResponse, IngestRequest, IngestResponse, JobResponse, ProjectResponse, SearchRequest, SearchResponse, TestGenerationRequest
from app.services.ingestion import IngestionService
from app.tests.generator import build_test_generation_prompt
from app.vectorstore.store import VectorStore

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(db: Database = Depends(get_database)) -> list[dict]:
    return db.list_projects()


@router.post("/projects/ingest", response_model=IngestResponse)
async def ingest_project(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    service: IngestionService = Depends(get_ingestion_service),
) -> dict:
    try:
        if request.source_type == "local_path":
            if not request.local_path:
                raise HTTPException(status_code=422, detail="local_path is required")
            project, job = service.create_local_project(request.local_path, request.name)
        else:
            if not request.repo_url:
                raise HTTPException(status_code=422, detail="repo_url is required")
            project, job = service.create_github_project(request.repo_url, request.name)
        background_tasks.add_task(_run_ingestion_task, service, project["id"], job["id"])
        return {"project": project, "job": job}
    except Exception as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 500), detail=str(exc)) from exc


@router.post("/projects/upload", response_model=IngestResponse)
async def upload_zip(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    service: IngestionService = Depends(get_ingestion_service),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=422, detail="Upload must be a ZIP file.")
    upload_path = settings.upload_dir / f"{uuid.uuid4()}-{Path(file.filename).name}"
    size = 0
    with upload_path.open("wb") as handle:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > settings.max_zip_size_bytes:
                raise HTTPException(status_code=413, detail="ZIP file exceeds configured size limit.")
            handle.write(chunk)
    try:
        project, job = service.create_zip_project(upload_path, name)
        background_tasks.add_task(_run_ingestion_task, service, project["id"], job["id"])
        return {"project": project, "job": job}
    except Exception as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 500), detail=str(exc)) from exc


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: Database = Depends(get_database)) -> dict:
    try:
        return db.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: Database = Depends(get_database)) -> dict:
    try:
        return db.get_project(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


@router.get("/projects/{project_id}/overview")
async def get_overview(project_id: str, db: Database = Depends(get_database)) -> dict:
    project = _project_or_404(project_id, db)
    scan = project.get("scan_result", {})
    return {
        "project": project,
        "tech_stack": scan.get("tech_stack", {}),
        "summary": {
            "files": scan.get("file_count", 0),
            "folders": scan.get("folder_count", 0),
            "embeddings": scan.get("embedding_count", 0),
            "quality_score": scan.get("bugs", {}).get("score"),
            "api_count": scan.get("api_map", {}).get("count", 0),
        },
    }


@router.post("/projects/{project_id}/search", response_model=SearchResponse)
async def search_project(
    project_id: str,
    request: SearchRequest,
    db: Database = Depends(get_database),
    vectors: VectorStore = Depends(get_vector_store),
) -> dict:
    _project_or_404(project_id, db)
    results = vectors.query(project_id, request.query, request.top_k, request.filters)
    return {"query": request.query, "results": results}


@router.post("/projects/{project_id}/chat", response_model=ChatResponse)
async def chat_project(
    project_id: str,
    request: ChatRequest,
    db: Database = Depends(get_database),
    chat: RepositoryChatService = Depends(get_chat_service),
):
    _project_or_404(project_id, db)
    if request.stream:
        async def event_stream():
            async for token in chat.stream_answer(project_id, request.message, request.top_k):
                yield f"data: {token}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")
    return await chat.answer(project_id, request.message, request.top_k)


@router.get("/projects/{project_id}/architecture")
async def architecture(project_id: str, db: Database = Depends(get_database)) -> dict:
    project = _project_or_404(project_id, db)
    scan = project.get("scan_result", {})
    return {
        "diagrams": scan.get("diagrams", {}),
        "graph": scan.get("knowledge_graph", {}),
    }


@router.get("/projects/{project_id}/api")
async def api_explorer(project_id: str, db: Database = Depends(get_database)) -> dict:
    project = _project_or_404(project_id, db)
    return project.get("scan_result", {}).get("api_map", {"endpoints": [], "count": 0})


@router.get("/projects/{project_id}/bugs")
async def bug_report(project_id: str, db: Database = Depends(get_database)) -> dict:
    project = _project_or_404(project_id, db)
    return project.get("scan_result", {}).get("bugs", {"issues": [], "summary": {}, "score": None})


@router.get("/projects/{project_id}/database")
async def database_map(project_id: str, db: Database = Depends(get_database)) -> dict:
    project = _project_or_404(project_id, db)
    return project.get("scan_result", {}).get("database_map", {"tables": [], "relationships": [], "orm_usage": {}})


@router.get("/projects/{project_id}/improvements")
async def improvements(project_id: str, db: Database = Depends(get_database)) -> dict:
    project = _project_or_404(project_id, db)
    return project.get("scan_result", {}).get("improvements", {"suggestions": []})


@router.post("/projects/{project_id}/tests")
async def generate_tests(
    project_id: str,
    request: TestGenerationRequest,
    db: Database = Depends(get_database),
    vectors: VectorStore = Depends(get_vector_store),
    chat: RepositoryChatService = Depends(get_chat_service),
) -> dict:
    _project_or_404(project_id, db)
    chunks = vectors.query(project_id, request.path, top_k=6, filters={"path": request.path})
    if not chunks:
        return {
            "path": request.path,
            "framework": request.framework,
            "tests": "",
            "citations": [],
            "message": "No indexed chunks were found for that file path.",
        }
    context = "\n\n".join(chunk["content"] for chunk in chunks)
    prompt = build_test_generation_prompt({"path": request.path, "content": context}, request.framework)
    generated = await chat.llm.generate(prompt)
    return {"path": request.path, "framework": request.framework, "tests": generated, "citations": [chunk["metadata"] for chunk in chunks]}


@router.get("/projects/{project_id}/readme", response_class=PlainTextResponse)
async def readme(project_id: str, db: Database = Depends(get_database)) -> str:
    project = _project_or_404(project_id, db)
    return project.get("scan_result", {}).get("generated_readme", "")


def _project_or_404(project_id: str, db: Database) -> dict:
    try:
        return db.get_project(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


def _run_ingestion_task(service: IngestionService, project_id: str, job_id: str) -> None:
    asyncio.run(service.run_ingestion(project_id, job_id))
