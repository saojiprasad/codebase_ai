import re
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.security.sandbox import safe_read_text


IMPORT_PATTERNS = [
    re.compile(r"^\s*import\s+([\w\.\-/@]+)", re.MULTILINE),
    re.compile(r"^\s*from\s+([\w\.]+)\s+import\s+", re.MULTILINE),
    re.compile(r"^\s*const\s+\w+\s*=\s*require\(['\"]([^'\"]+)['\"]\)", re.MULTILINE),
    re.compile(r"^\s*import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]", re.MULTILINE),
    re.compile(r"^\s*use\s+([\w:]+)", re.MULTILINE),
    re.compile(r"^\s*#include\s+[<\"]([^>\"]+)[>\"]", re.MULTILINE),
]

FUNCTION_PATTERNS = [
    re.compile(r"^\s*(?:async\s+)?def\s+(\w+)\s*\(", re.MULTILINE),
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(", re.MULTILINE),
    re.compile(r"^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>", re.MULTILINE),
    re.compile(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{", re.MULTILINE),
    re.compile(r"^\s*fn\s+(\w+)\s*\(", re.MULTILINE),
    re.compile(r"^\s*func\s+(\w+)\s*\(", re.MULTILINE),
]

CLASS_PATTERNS = [
    re.compile(r"^\s*class\s+(\w+)(?:\(([^)]*)\))?", re.MULTILINE),
    re.compile(r"^\s*(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?", re.MULTILINE),
    re.compile(r"^\s*(?:public\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?", re.MULTILINE),
    re.compile(r"^\s*struct\s+(\w+)", re.MULTILINE),
    re.compile(r"^\s*interface\s+(\w+)", re.MULTILINE),
]

API_PATTERNS = [
    re.compile(r"@(?:app|router|blueprint)\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.IGNORECASE),
    re.compile(r"@(?:app|router)\.route\(['\"]([^'\"]+)['\"].*?methods=\[([^\]]+)\]", re.IGNORECASE | re.DOTALL),
    re.compile(r"\b(?:app|router)\.(get|post|put|patch|delete)\(['\"]([^'\"]+)['\"]", re.IGNORECASE),
]


def parse_repository_files(root: Path, files: list[dict[str, Any]], settings: Settings) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    for file_info in files:
        if not file_info.get("indexed"):
            continue
        path = root / file_info["path"]
        text = safe_read_text(path, settings.max_file_size_bytes)
        if text is None:
            continue
        parsed.append(parse_code_text(file_info, text, settings))
    return parsed


def parse_code_text(file_info: dict[str, Any], text: str, settings: Settings) -> dict[str, Any]:
    lines = text.splitlines()
    symbols = extract_symbols(text)
    return {
        "path": file_info["path"],
        "language": file_info["language"],
        "line_count": len(lines),
        "ast": tree_sitter_summary(text, file_info["language"]),
        "imports": extract_imports(text),
        "classes": symbols["classes"],
        "functions": symbols["functions"],
        "apis": extract_apis(text, file_info["path"]),
        "comments": extract_comments(text, file_info["language"])[:20],
        "chunks": chunk_text(file_info, lines, settings, symbols),
    }


def extract_imports(text: str) -> list[str]:
    imports: set[str] = set()
    for pattern in IMPORT_PATTERNS:
        for match in pattern.finditer(text):
            imports.add(match.group(1).strip())
    return sorted(imports)


def tree_sitter_summary(text: str, language: str) -> dict[str, Any] | None:
    grammar = {
        "Python": "python",
        "JavaScript": "javascript",
        "JavaScript React": "javascript",
        "TypeScript": "typescript",
        "TypeScript React": "tsx",
        "Java": "java",
        "C++": "cpp",
        "C": "c",
        "Go": "go",
        "Rust": "rust",
    }.get(language)
    if not grammar:
        return None
    try:
        from tree_sitter_language_pack import get_parser

        parser = get_parser(grammar)
        tree = parser.parse(text.encode("utf-8", errors="replace"))
        return {
            "grammar": grammar,
            "root_type": tree.root_node.type,
            "has_error": bool(tree.root_node.has_error),
            "node_count_estimate": count_tree_nodes(tree.root_node, limit=2500),
        }
    except Exception:
        return None


def count_tree_nodes(node: Any, limit: int) -> int:
    count = 1
    stack = list(getattr(node, "children", []))
    while stack and count < limit:
        current = stack.pop()
        count += 1
        stack.extend(getattr(current, "children", []))
    return count


def extract_symbols(text: str) -> dict[str, list[dict[str, Any]]]:
    classes: list[dict[str, Any]] = []
    functions: list[dict[str, Any]] = []
    for pattern in CLASS_PATTERNS:
        for match in pattern.finditer(text):
            classes.append(
                {
                    "name": match.group(1),
                    "inherits": match.group(2).strip() if len(match.groups()) > 1 and match.group(2) else None,
                    "line": text[: match.start()].count("\n") + 1,
                }
            )
    for pattern in FUNCTION_PATTERNS:
        for match in pattern.finditer(text):
            functions.append(
                {
                    "name": match.group(1),
                    "line": text[: match.start()].count("\n") + 1,
                }
            )
    return {"classes": dedupe_symbols(classes), "functions": dedupe_symbols(functions)}


def dedupe_symbols(symbols: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, int]] = set()
    unique: list[dict[str, Any]] = []
    for symbol in symbols:
        key = (symbol["name"], symbol["line"])
        if key not in seen:
            unique.append(symbol)
            seen.add(key)
    return unique


def extract_apis(text: str, path: str) -> list[dict[str, Any]]:
    endpoints: list[dict[str, Any]] = []
    for pattern in API_PATTERNS:
        for match in pattern.finditer(text):
            if pattern.pattern.startswith("@(?:app|router)\\.route"):
                route = match.group(1)
                methods = [method.strip(" '\"\n").upper() for method in match.group(2).split(",")]
            else:
                methods = [match.group(1).upper()]
                route = match.group(2)
            endpoints.append(
                {
                    "path": route,
                    "methods": methods,
                    "source_file": path,
                    "line": text[: match.start()].count("\n") + 1,
                }
            )
    return endpoints


def extract_comments(text: str, language: str) -> list[str]:
    if "Python" in language:
        comments = re.findall(r'"""(.*?)"""|#\s*(.*)$', text, flags=re.MULTILINE | re.DOTALL)
        return [first or second for first, second in comments if (first or second).strip()]
    comments = re.findall(r"//\s*(.*)$|/\*(.*?)\*/", text, flags=re.MULTILINE | re.DOTALL)
    return [first or second for first, second in comments if (first or second).strip()]


def chunk_text(
    file_info: dict[str, Any],
    lines: list[str],
    settings: Settings,
    symbols: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    symbol_lines = {symbol["line"]: symbol["name"] for symbol in symbols["classes"] + symbols["functions"]}
    start = 0
    chunk_index = 0
    while start < len(lines):
        end = min(len(lines), start + settings.chunk_target_lines)
        content = "\n".join(lines[start:end]).strip()
        if content:
            nearby_symbols = [
                name
                for line, name in symbol_lines.items()
                if start + 1 <= line <= end
            ]
            chunks.append(
                {
                    "id": f"{file_info['path']}::{chunk_index}",
                    "path": file_info["path"],
                    "language": file_info["language"],
                    "start_line": start + 1,
                    "end_line": end,
                    "symbols": nearby_symbols,
                    "content": content,
                }
            )
            chunk_index += 1
        if end >= len(lines):
            break
        start = max(end - settings.chunk_overlap_lines, start + 1)
    return chunks
