# AI Codebase Explainer Platform

Local-first AI software architect for repositories. It scans projects, detects tech stacks, builds a knowledge graph, indexes code chunks with embeddings, generates diagrams and README drafts, detects code quality/security issues, and powers grounded chat over the codebase.

## What Is Included

- FastAPI backend with safe ZIP, GitHub, and local-path ingestion
- Static scanner with ignored generated folders and file size limits
- Language, manifest, dependency, API, database, bug, and architecture analysis
- NetworkX knowledge graph and Mermaid diagram generation
- ChromaDB vector store with hash fallback embeddings
- Ollama-compatible local LLM RAG chat
- React + TypeScript + Tailwind frontend
- Docker setup and local run instructions

## Start Here

Use [INSTALL_AND_RUN.md](./INSTALL_AND_RUN.md) for all setup commands, model downloads, Docker options, and laptop-to-laptop instructions.
