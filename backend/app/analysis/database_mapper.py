import re
from pathlib import Path
from typing import Any

from app.security.sandbox import safe_read_text

CREATE_TABLE = re.compile(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([\w.]+)", re.IGNORECASE)
FOREIGN_KEY = re.compile(r"FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`\"\[]?([\w.]+)", re.IGNORECASE)
ORM_HINTS = {
    "sqlalchemy": "SQLAlchemy",
    "django.db": "Django ORM",
    "prisma": "Prisma",
    "sequelize": "Sequelize",
    "typeorm": "TypeORM",
    "mongoose": "Mongoose",
    "hibernate": "Hibernate",
    "jdbc": "JDBC",
}


def map_database_relationships(root: Path, parsed_files: list[dict[str, Any]]) -> dict[str, Any]:
    tables: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []
    orm_usage: dict[str, list[str]] = {}

    for file in parsed_files:
        path = root / file["path"]
        text = safe_read_text(path, 1_500_000) or ""
        lower_imports = " ".join(file.get("imports", [])).lower()
        for needle, orm in ORM_HINTS.items():
            if needle in lower_imports or needle in text.lower():
                orm_usage.setdefault(orm, []).append(file["path"])
        for match in CREATE_TABLE.finditer(text):
            tables.append({"name": match.group(1), "file": file["path"], "line": text[: match.start()].count("\n") + 1})
        for match in FOREIGN_KEY.finditer(text):
            relationships.append(
                {
                    "from_column": match.group(1).strip(),
                    "to_table": match.group(2).strip(),
                    "file": file["path"],
                    "line": text[: match.start()].count("\n") + 1,
                }
            )

    return {
        "tables": dedupe_dicts(tables),
        "relationships": dedupe_dicts(relationships),
        "orm_usage": orm_usage,
        "summary": build_summary(tables, relationships, orm_usage),
    }


def dedupe_dicts(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[tuple[str, str], ...]] = set()
    unique: list[dict[str, Any]] = []
    for item in items:
        key = tuple(sorted((str(k), str(v)) for k, v in item.items()))
        if key not in seen:
            unique.append(item)
            seen.add(key)
    return unique


def build_summary(tables: list[dict[str, Any]], relationships: list[dict[str, Any]], orm_usage: dict[str, list[str]]) -> str:
    orm_names = ", ".join(sorted(orm_usage)) or "no ORM detected"
    return f"Detected {len(tables)} table declarations, {len(relationships)} foreign-key relationships, and {orm_names}."

