from typing import Any, Literal

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    source_type: Literal["local_path", "github_url"]
    local_path: str | None = None
    repo_url: str | None = None
    name: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    root_path: str
    source_type: str
    status: str
    metadata: dict[str, Any]
    scan_result: dict[str, Any]
    created_at: str
    updated_at: str


class JobResponse(BaseModel):
    id: str
    project_id: str | None = None
    kind: str
    status: str
    phase: str
    progress: int
    message: str
    result: dict[str, Any]
    error: str | None = None
    created_at: str
    updated_at: str


class IngestResponse(BaseModel):
    project: ProjectResponse
    job: JobResponse


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=8000)
    top_k: int = Field(default=8, ge=1, le=20)
    stream: bool = False


class ChatResponse(BaseModel):
    answer: str
    citations: list[dict[str, Any]]


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    top_k: int = Field(default=10, ge=1, le=50)
    filters: dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    results: list[dict[str, Any]]


class TestGenerationRequest(BaseModel):
    path: str = Field(min_length=1, max_length=1000)
    framework: Literal["pytest", "jest", "junit"] = "pytest"
