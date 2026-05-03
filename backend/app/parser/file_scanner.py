from collections import Counter
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.parser.language_detector import detect_language
from app.security.sandbox import is_ignored_path, safe_read_text


def scan_repository(root: Path, settings: Settings) -> dict[str, Any]:
    root = root.resolve()
    files: list[dict[str, Any]] = []
    folders: set[str] = set()
    language_counts: Counter[str] = Counter()
    total_size = 0
    skipped = 0

    for path in root.rglob("*"):
        rel_path = path.relative_to(root)
        if is_ignored_path(rel_path):
            if path.is_file():
                skipped += 1
            continue
        if path.is_dir():
            folders.add(rel_path.as_posix())
            continue
        if len(files) >= settings.max_index_files:
            skipped += 1
            continue

        size = path.stat().st_size
        total_size += size
        language = detect_language(path)
        text = safe_read_text(path, settings.max_file_size_bytes)
        is_indexed = text is not None
        if not is_indexed:
            skipped += 1

        language_counts[language] += 1
        files.append(
            {
                "path": rel_path.as_posix(),
                "name": path.name,
                "extension": path.suffix.lower(),
                "language": language,
                "size_bytes": size,
                "indexed": is_indexed,
                "line_count": text.count("\n") + 1 if text else None,
            }
        )

    tree = build_tree(files)
    return {
        "root": str(root),
        "file_count": len(files),
        "folder_count": len(folders),
        "skipped_files": skipped,
        "total_size_bytes": total_size,
        "languages": dict(language_counts.most_common()),
        "files": files,
        "tree": tree,
    }


def build_tree(files: list[dict[str, Any]]) -> dict[str, Any]:
    root: dict[str, Any] = {"name": "root", "type": "folder", "children": {}}
    for file_info in files:
        parts = file_info["path"].split("/")
        node = root
        for folder in parts[:-1]:
            node = node["children"].setdefault(
                folder,
                {"name": folder, "type": "folder", "children": {}},
            )
        node["children"][parts[-1]] = {
            "name": parts[-1],
            "type": "file",
            "path": file_info["path"],
            "language": file_info["language"],
            "size_bytes": file_info["size_bytes"],
        }
    return normalize_tree(root)


def normalize_tree(node: dict[str, Any]) -> dict[str, Any]:
    children = node.get("children")
    if isinstance(children, dict):
        normalized = [normalize_tree(child) for child in children.values()]
        node["children"] = sorted(normalized, key=lambda item: (item["type"] == "file", item["name"].lower()))
    return node

