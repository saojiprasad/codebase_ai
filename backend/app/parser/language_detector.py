from pathlib import Path


LANGUAGE_BY_SUFFIX = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".java": "Java",
    ".kt": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".scala": "Scala",
    ".sql": "SQL",
    ".graphql": "GraphQL",
    ".gql": "GraphQL",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".json": "JSON",
    ".toml": "TOML",
    ".xml": "XML",
    ".md": "Markdown",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".Dockerfile": "Dockerfile",
}

CONFIG_FILES = {
    "Dockerfile": "Dockerfile",
    "docker-compose.yml": "Docker Compose",
    "docker-compose.yaml": "Docker Compose",
    "package.json": "Node Package Manifest",
    "requirements.txt": "Python Requirements",
    "pyproject.toml": "Python Project",
    "pom.xml": "Maven Project",
    "build.gradle": "Gradle Project",
    "Cargo.toml": "Rust Cargo Project",
    "go.mod": "Go Module",
}


def detect_language(path: Path) -> str:
    if path.name in CONFIG_FILES:
        return CONFIG_FILES[path.name]
    return LANGUAGE_BY_SUFFIX.get(path.suffix.lower(), "Text")


def is_code_like(language: str) -> bool:
    return language not in {"Text", "Markdown", "JSON", "YAML", "TOML", "XML", "CSS", "SCSS"}

