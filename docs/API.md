# API Reference

Base URL: `http://localhost:8000/api`

## Health

`GET /health`

Returns backend status.

## Projects

`GET /projects`

Lists indexed repositories.

`POST /projects/ingest`

Starts indexing from a local path or GitHub URL.

```json
{
  "source_type": "github_url",
  "repo_url": "https://github.com/org/repo.git",
  "name": "repo"
}
```

```json
{
  "source_type": "local_path",
  "local_path": "/Users/me/projects/repo",
  "name": "repo"
}
```

`POST /projects/upload`

Multipart form upload for a `.zip` repository archive.

`GET /projects/{project_id}`

Returns project metadata and scan result.

## Jobs

`GET /jobs/{job_id}`

Polls ingestion progress.

## Search and Chat

`POST /projects/{project_id}/search`

```json
{
  "query": "where is JWT validated?",
  "top_k": 10,
  "filters": {}
}
```

`POST /projects/{project_id}/chat`

```json
{
  "message": "How does authentication work?",
  "top_k": 8,
  "stream": false
}
```

## Analysis Views

`GET /projects/{project_id}/overview`

`GET /projects/{project_id}/architecture`

`GET /projects/{project_id}/api`

`GET /projects/{project_id}/bugs`

`GET /projects/{project_id}/database`

`GET /projects/{project_id}/improvements`

`POST /projects/{project_id}/tests`

```json
{
  "path": "src/auth/service.py",
  "framework": "pytest"
}
```

`GET /projects/{project_id}/readme`
