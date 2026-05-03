import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from app.security.sandbox import safe_read_text


STACK_RULES = [
    ("React", ["react", "next"]),
    ("Angular", ["@angular/core"]),
    ("Vue", ["vue", "nuxt"]),
    ("Node.js", ["express", "fastify", "nest", "koa"]),
    ("Express", ["express"]),
    ("FastAPI", ["fastapi"]),
    ("Flask", ["flask"]),
    ("Django", ["django"]),
    ("Spring Boot", ["spring-boot", "springframework.boot"]),
    ("Kafka", ["kafka", "confluent"]),
    ("Redis", ["redis", "ioredis"]),
    ("MongoDB", ["mongodb", "mongoose", "pymongo"]),
    ("PostgreSQL", ["pg", "psycopg", "postgresql", "asyncpg"]),
    ("MySQL", ["mysql", "pymysql", "mysqlclient"]),
    ("Oracle", ["oracledb", "cx_oracle"]),
    ("Firebase", ["firebase", "@firebase"]),
    ("Docker", ["Dockerfile", "docker-compose"]),
    ("Kubernetes", ["apiVersion:", "kind: Deployment", "kind: Service"]),
    ("GitHub Actions", [".github/workflows"]),
]


def detect_tech_stack(root: Path, files: list[dict[str, Any]]) -> dict[str, Any]:
    manifests = find_manifests(root, files)
    dependencies = collect_dependencies(root, manifests)
    haystack = "\n".join(
        [dep.lower() for dep in dependencies]
        + [manifest["path"].lower() for manifest in manifests]
        + sample_manifest_text(root, manifests).lower().splitlines()
    )
    detected = []
    for name, needles in STACK_RULES:
        if any(needle.lower() in haystack for needle in needles):
            detected.append(name)

    languages = {}
    for file_info in files:
        languages[file_info["language"]] = languages.get(file_info["language"], 0) + 1

    return {
        "detected": sorted(set(detected)),
        "languages": languages,
        "manifests": manifests,
        "dependencies": sorted(set(dependencies)),
        "summary": build_stack_summary(detected, languages, manifests),
    }


def find_manifests(root: Path, files: list[dict[str, Any]]) -> list[dict[str, str]]:
    names = {
        "package.json",
        "requirements.txt",
        "pyproject.toml",
        "poetry.lock",
        "Pipfile",
        "pom.xml",
        "build.gradle",
        "settings.gradle",
        "go.mod",
        "Cargo.toml",
        "docker-compose.yml",
        "docker-compose.yaml",
        "Dockerfile",
        "Makefile",
        "tsconfig.json",
    }
    manifests = []
    for file_info in files:
        if Path(file_info["path"]).name in names or file_info["path"].startswith(".github/workflows/"):
            manifests.append({"path": file_info["path"], "kind": Path(file_info["path"]).name})
    return manifests


def collect_dependencies(root: Path, manifests: list[dict[str, str]]) -> list[str]:
    dependencies: list[str] = []
    for manifest in manifests:
        path = root / manifest["path"]
        text = safe_read_text(path, 1_500_000)
        if not text:
            continue
        name = path.name
        if name == "package.json":
            dependencies.extend(parse_package_json(text))
        elif name == "requirements.txt":
            dependencies.extend(parse_requirements(text))
        elif name == "pom.xml":
            dependencies.extend(parse_pom(text))
        elif name == "go.mod":
            dependencies.extend(parse_go_mod(text))
        elif name == "Cargo.toml":
            dependencies.extend(parse_toml_dependencies(text))
        elif name in {"pyproject.toml", "Pipfile"}:
            dependencies.extend(parse_toml_dependencies(text))
        else:
            dependencies.extend(extract_known_tokens(text))
    return dependencies


def parse_package_json(text: str) -> list[str]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return []
    deps: list[str] = []
    for key in ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]:
        deps.extend(payload.get(key, {}).keys())
    return deps


def parse_requirements(text: str) -> list[str]:
    deps = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        deps.append(re.split(r"[<>=~! ]+", line)[0])
    return deps


def parse_pom(text: str) -> list[str]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    deps: list[str] = []
    for dependency in root.findall(".//{*}dependency"):
        artifact = dependency.find("{*}artifactId")
        group = dependency.find("{*}groupId")
        parts = [item.text for item in [group, artifact] if item is not None and item.text]
        if parts:
            deps.append(":".join(parts))
    return deps


def parse_go_mod(text: str) -> list[str]:
    deps = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith(("module ", "go ", "require (", ")")):
            deps.append(stripped.split()[0])
    return deps


def parse_toml_dependencies(text: str) -> list[str]:
    deps: list[str] = []
    in_deps = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("[") and "depend" in stripped.lower():
            in_deps = True
            continue
        if stripped.startswith("[") and in_deps:
            in_deps = False
        if in_deps and "=" in stripped and not stripped.startswith("#"):
            deps.append(stripped.split("=", 1)[0].strip().strip('"'))
    return deps


def extract_known_tokens(text: str) -> list[str]:
    lowered = text.lower()
    return [name for name, needles in STACK_RULES for needle in needles if needle.lower() in lowered]


def sample_manifest_text(root: Path, manifests: list[dict[str, str]]) -> str:
    snippets = []
    for manifest in manifests[:20]:
        text = safe_read_text(root / manifest["path"], 60_000)
        if text:
            snippets.append(text[:20_000])
    return "\n".join(snippets)


def build_stack_summary(detected: list[str], languages: dict[str, int], manifests: list[dict[str, str]]) -> str:
    primary_languages = ", ".join([language for language, _ in sorted(languages.items(), key=lambda x: x[1], reverse=True)[:4]])
    stack = ", ".join(sorted(set(detected))) or "No high-confidence framework detected"
    manifest_names = ", ".join(sorted({manifest["kind"] for manifest in manifests})[:10]) or "no manifest files"
    return f"Primary languages: {primary_languages}. Detected stack: {stack}. Manifests: {manifest_names}."

