# SmartShorts Python AI Service

This optional local FastAPI service provides heavier AI analysis for SmartShorts Studio.

Run on the other laptop after installing `requirements.txt`:

```powershell
cd backend\python_ai
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Endpoints:

```text
GET  /health
POST /transcribe
POST /audio/analyze
POST /face/track
POST /emotion/analyze
POST /clips/select
```

The Node backend can continue without this service. If the service is not running, the existing Node/FFmpeg fallback pipeline still renders clips.
