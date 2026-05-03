from typing import Any


def suggest_improvements(scan_result: dict[str, Any]) -> dict[str, Any]:
    suggestions: list[dict[str, str]] = []
    bugs = scan_result.get("bugs", {})
    graph = scan_result.get("knowledge_graph", {})
    api_map = scan_result.get("api_map", {})
    tech_stack = scan_result.get("tech_stack", {})
    database_map = scan_result.get("database_map", {})

    if bugs.get("summary", {}).get("Critical", 0):
        suggestions.append(item("Critical", "Security", "Resolve critical security findings before feature work."))
    if graph.get("stats", {}).get("cycles", 0):
        suggestions.append(item("High", "Architecture", "Break circular dependencies by extracting stable interfaces or shared modules."))
    if api_map.get("count", 0) and not any("OpenAPI" in dep or "swagger" in dep.lower() for dep in tech_stack.get("dependencies", [])):
        suggestions.append(item("Medium", "API", "Add generated API documentation and request/response validation coverage."))
    if database_map.get("relationships") and not any("migration" in dep.lower() or "alembic" in dep.lower() for dep in tech_stack.get("dependencies", [])):
        suggestions.append(item("Medium", "Database", "Add an explicit migration tool and document schema ownership."))
    if scan_result.get("embedding_count", 0) > 5000:
        suggestions.append(item("Low", "Performance", "Enable incremental indexing and cache embeddings by file fingerprint."))
    if not suggestions:
        suggestions.append(item("Low", "Maintainability", "Add focused tests around the highest-change modules before larger refactors."))

    return {"suggestions": suggestions}


def item(severity: str, category: str, recommendation: str) -> dict[str, str]:
    return {"severity": severity, "category": category, "recommendation": recommendation}

