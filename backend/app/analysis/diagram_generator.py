from typing import Any


def generate_diagrams(scan: dict[str, Any], tech_stack: dict[str, Any], api_map: dict[str, Any], graph: dict[str, Any]) -> dict[str, str]:
    return {
        "architecture": architecture_mermaid(scan, tech_stack, api_map),
        "dependencies": dependency_mermaid(graph),
        "api_flow": api_mermaid(api_map),
    }


def architecture_mermaid(scan: dict[str, Any], tech_stack: dict[str, Any], api_map: dict[str, Any]) -> str:
    stack = tech_stack.get("detected", [])
    has_frontend = any(item in stack for item in ["React", "Angular", "Vue"])
    has_backend = any(item in stack for item in ["FastAPI", "Flask", "Django", "Express", "Spring Boot", "Node.js"])
    has_db = any(item in stack for item in ["PostgreSQL", "MySQL", "MongoDB", "Oracle", "Firebase"])
    lines = ["flowchart LR", "  Repo[Repository] --> Scanner[Static Scanner]", "  Scanner --> Graph[Knowledge Graph]", "  Scanner --> Vectors[Vector Index]"]
    if has_frontend:
        lines.append("  Frontend[Frontend App] --> API[API Layer]")
    if has_backend:
        lines.append("  API[API Layer] --> Services[Services]")
    if has_db:
        lines.append("  Services --> DB[(Database)]")
    if api_map.get("count"):
        lines.append("  API --> Routes[Detected Endpoints]")
    lines.append("  Vectors --> Chat[Grounded AI Chat]")
    lines.append("  Graph --> Diagrams[Architecture Diagrams]")
    return "\n".join(lines)


def dependency_mermaid(graph: dict[str, Any]) -> str:
    lines = ["flowchart TD"]
    edges = [edge for edge in graph.get("edges", []) if edge.get("relation") == "imports"][:60]
    if not edges:
        return "flowchart TD\n  A[No import relationships detected]"
    for edge in edges:
        source = sanitize_node(edge["source"])
        target = sanitize_node(edge["target"])
        lines.append(f"  {source}[\"{edge['source']}\"] --> {target}[\"{edge['target']}\"]")
    return "\n".join(lines)


def api_mermaid(api_map: dict[str, Any]) -> str:
    lines = ["sequenceDiagram", "  participant Client", "  participant API", "  participant Handler"]
    endpoints = api_map.get("endpoints", [])[:20]
    if not endpoints:
        return "sequenceDiagram\n  participant Client\n  participant API\n  Client->>API: No endpoints detected"
    for endpoint in endpoints:
        method = ",".join(endpoint["methods"])
        route = endpoint["path"]
        handler = endpoint["handler_file"]
        lines.append(f"  Client->>API: {method} {route}")
        lines.append(f"  API->>Handler: {handler}")
        lines.append("  Handler-->>API: response")
        lines.append("  API-->>Client: JSON/result")
    return "\n".join(lines)


def sanitize_node(value: str) -> str:
    return "N" + "".join(ch if ch.isalnum() else "_" for ch in value)[:80]

