from typing import Any

import networkx as nx


def build_knowledge_graph(parsed_files: list[dict[str, Any]]) -> dict[str, Any]:
    graph = nx.DiGraph()
    path_index = {file["path"]: file for file in parsed_files}
    module_index = build_module_index(parsed_files)

    for file in parsed_files:
        graph.add_node(file["path"], kind="file", language=file["language"])
        for symbol in file.get("classes", []):
            symbol_id = f"{file['path']}::{symbol['name']}"
            graph.add_node(symbol_id, kind="class", name=symbol["name"])
            graph.add_edge(file["path"], symbol_id, relation="declares")
            if symbol.get("inherits"):
                graph.add_edge(symbol_id, symbol["inherits"], relation="inherits")
        for symbol in file.get("functions", []):
            symbol_id = f"{file['path']}::{symbol['name']}"
            graph.add_node(symbol_id, kind="function", name=symbol["name"])
            graph.add_edge(file["path"], symbol_id, relation="declares")
        for imported in file.get("imports", []):
            target = resolve_import(imported, module_index, path_index)
            graph.add_node(imported, kind="external" if target is None else "file")
            graph.add_edge(file["path"], target or imported, relation="imports")
        for api in file.get("apis", []):
            api_id = f"API {','.join(api['methods'])} {api['path']}"
            graph.add_node(api_id, kind="api", path=api["path"], methods=api["methods"])
            graph.add_edge(api_id, file["path"], relation="handled_by")

    cycles = []
    try:
        cycles = list(nx.simple_cycles(graph.subgraph([node for node, data in graph.nodes(data=True) if data.get("kind") == "file"])))[:25]
    except nx.NetworkXException:
        cycles = []

    return {
        "nodes": [{"id": node, **data} for node, data in graph.nodes(data=True)],
        "edges": [{"source": source, "target": target, **data} for source, target, data in graph.edges(data=True)],
        "cycles": cycles,
        "stats": {
            "nodes": graph.number_of_nodes(),
            "edges": graph.number_of_edges(),
            "cycles": len(cycles),
        },
    }


def build_module_index(parsed_files: list[dict[str, Any]]) -> dict[str, str]:
    index: dict[str, str] = {}
    for file in parsed_files:
        path = file["path"]
        without_suffix = path.rsplit(".", 1)[0].replace("/", ".")
        index[without_suffix] = path
        index[without_suffix.split(".")[-1]] = path
    return index


def resolve_import(imported: str, module_index: dict[str, str], path_index: dict[str, dict[str, Any]]) -> str | None:
    normalized = imported.strip("./").replace("/", ".")
    if normalized in module_index:
        return module_index[normalized]
    for module, path in module_index.items():
        if normalized.endswith(module) or module.endswith(normalized):
            return path
    for path in path_index:
        if path.endswith(imported.strip("./")):
            return path
    return None

