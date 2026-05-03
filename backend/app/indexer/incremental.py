from pathlib import Path
from typing import Any


def build_file_fingerprint(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "path": str(path),
        "size": stat.st_size,
        "mtime": stat.st_mtime,
    }


def changed_files(previous: dict[str, Any], current: dict[str, Any]) -> list[str]:
    changed: list[str] = []
    for path, fingerprint in current.items():
        if previous.get(path) != fingerprint:
            changed.append(path)
    return changed

