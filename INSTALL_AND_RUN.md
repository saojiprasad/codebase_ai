# Install And Run Guide

This repo was created without installing or running anything on the current machine. Use these commands on the laptop where you want to run the app.

## 1. Required Software

Install:

- Git
- Python 3.11
- Node.js 22 LTS
- Ollama
- Docker Desktop, optional but recommended

Optional:

- NVIDIA drivers and CUDA for faster local models
- VS Code

## 2. Clone Your GitHub Repo

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

## 3. Create Environment File

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Recommended `.env` values:

```bash
ACE_LLM_PROVIDER=ollama
ACE_OLLAMA_BASE_URL=http://localhost:11434
ACE_OLLAMA_MODEL=qwen2.5-coder:7b
ACE_LLAMA_CPP_BASE_URL=http://localhost:8080
ACE_EMBEDDING_PROVIDER=sentence-transformers
ACE_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ACE_VECTOR_BACKEND=chroma
```

## 4. Install And Start Ollama

Install Ollama from the official installer for your OS, then pull one local model:

```bash
ollama pull qwen2.5-coder:7b
```

Lower-memory alternatives:

```bash
ollama pull phi3:mini
ollama pull codellama:7b
ollama pull deepseek-coder:6.7b
```

Start Ollama if it is not already running:

```bash
ollama serve
```

Alternative llama.cpp server mode:

```bash
ACE_LLM_PROVIDER=llamacpp
ACE_LLAMA_CPP_BASE_URL=http://localhost:8080
```

Start your llama.cpp server separately with a GGUF coder model, then run the backend normally.

## 5. Run Backend Locally

Windows PowerShell:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS/Linux:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:

```text
http://localhost:8000
```

API docs:

```text
http://localhost:8000/docs
```

## 6. Run Frontend Locally

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## 7. Docker Option

From repo root:

```bash
cp .env.example .env
docker compose up --build
```

With the optional Ollama container:

```bash
docker compose --profile local-ai up --build
```

Then pull the model inside the Ollama container:

```bash
docker compose exec ollama ollama pull qwen2.5-coder:7b
```

## 8. First Use

1. Open `http://localhost:5173`.
2. Go to Upload.
3. Choose GitHub URL, ZIP upload, or local path.
4. Wait for indexing to complete.
5. Open Dashboard, Overview, Chat, Architecture, API, Bugs, or README.

Example chat prompts:

```text
How does authentication work?
Where is payment logic?
Find SQL queries and explain risk.
Explain the API request flow.
What should be refactored first?
Generate pytest tests for the user service.
```

## 9. Folder Structure

```text
backend/
  app/
    api/          FastAPI routes
    analysis/     tech stack, graph, API, DB, bugs, improvements, diagrams
    chat/         grounded RAG chat
    core/         config, logging, dependency wiring
    embeddings/   sentence-transformers or hash embeddings
    github/       GitHub URL helpers
    indexer/      incremental indexing hooks
    parser/       scanning, language detection, code chunking
    readme/       README generator
    security/     safe file handling and ZIP extraction
    services/     ingestion orchestration
    tests/        AI test generation prompts
    vectorstore/  ChromaDB or local vector store
    workers/      local background task runner
frontend/
  src/
    api/          API client
    components/   reusable UI
    hooks/        repository hooks
    pages/        product views
docs/             API docs and example repositories
```

## 10. Large Repository Settings

For large repositories, edit `.env`:

```bash
ACE_MAX_INDEX_FILES=25000
ACE_MAX_FILE_SIZE_BYTES=750000
ACE_CHUNK_TARGET_LINES=120
ACE_CHUNK_OVERLAP_LINES=16
```

If RAM is limited, use:

```bash
ACE_EMBEDDING_PROVIDER=hash
ACE_VECTOR_BACKEND=local
ACE_OLLAMA_MODEL=phi3:mini
```

## 11. Safety Notes

- Uploaded code is read and parsed, not executed.
- ZIP extraction blocks path traversal.
- Generated folders such as `node_modules`, `dist`, `build`, `.git`, `.venv`, and `target` are ignored.
- GitHub clone uses `git clone --depth 1`.
- Do not point local path ingestion at private folders that should not be indexed.

## 12. Troubleshooting

Backend cannot connect to Ollama:

```bash
ollama list
ollama serve
```

Frontend cannot reach backend:

```bash
curl http://localhost:8000/api/health
```

Embeddings install is slow:

```bash
ACE_EMBEDDING_PROVIDER=hash
```

ChromaDB issues:

```bash
ACE_VECTOR_BACKEND=local
```

Rebuild from scratch:

```bash
rm -rf backend/data
mkdir -p backend/data
```

On Windows PowerShell, use:

```powershell
Remove-Item -Recurse -Force .\backend\data
New-Item -ItemType Directory .\backend\data
```
