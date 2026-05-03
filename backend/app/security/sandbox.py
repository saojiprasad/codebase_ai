import os
import zipfile
from pathlib import Path

from app.core.config import Settings
from app.core.errors import UnsafeInputError


IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".idea",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "target",
    "venv",
    ".venv",
    "env",
    ".next",
    ".nuxt",
    ".turbo",
    "vendor",
}

BINARY_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".rar",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".jar",
    ".wasm",
    ".mp4",
    ".mov",
    ".mp3",
    ".wav",
    ".bin",
}


def is_ignored_path(path: Path) -> bool:
    return any(part in IGNORED_DIRS for part in path.parts)


def is_probably_binary(path: Path) -> bool:
    return path.suffix.lower() in BINARY_SUFFIXES


def validate_local_path(path_value: str) -> Path:
    path = Path(path_value).expanduser().resolve()
    if not path.exists():
        raise UnsafeInputError(f"Path does not exist: {path_value}")
    if not path.is_dir():
        raise UnsafeInputError("Local path ingestion requires a directory.")
    return path


def ensure_within_directory(base: Path, target: Path) -> None:
    base_resolved = base.resolve()
    target_resolved = target.resolve()
    try:
        target_resolved.relative_to(base_resolved)
    except ValueError as exc:
        raise UnsafeInputError("Archive attempted to write outside the extraction directory.") from exc


def safe_extract_zip(zip_path: Path, destination: Path, settings: Settings) -> Path:
    if zip_path.stat().st_size > settings.max_zip_size_bytes:
        raise UnsafeInputError("ZIP file is larger than the configured safety limit.")

    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            member_path = destination / member.filename
            ensure_within_directory(destination, member_path)
            if member.file_size > settings.max_file_size_bytes * 20:
                continue
            archive.extract(member, destination)

    roots = [p for p in destination.iterdir() if p.is_dir()]
    if len(roots) == 1:
        return roots[0]
    return destination


def safe_read_text(path: Path, max_bytes: int) -> str | None:
    if is_probably_binary(path):
        return None
    try:
        if path.stat().st_size > max_bytes:
            return None
        with path.open("rb") as handle:
            sample = handle.read(4096)
            if b"\x00" in sample:
                return None
            rest = handle.read(max(0, max_bytes - len(sample)))
        return (sample + rest).decode("utf-8", errors="replace")
    except (OSError, UnicodeDecodeError):
        return None


def safe_repo_name(raw: str) -> str:
    candidate = "".join(ch if ch.isalnum() or ch in {"-", "_", "."} else "-" for ch in raw)
    candidate = candidate.strip(".-_")
    return candidate or "repository"


def safe_environment() -> dict[str, str]:
    allowed = {"PATH", "SYSTEMROOT", "WINDIR", "HOME", "USERPROFILE"}
    return {key: value for key, value in os.environ.items() if key.upper() in allowed}

