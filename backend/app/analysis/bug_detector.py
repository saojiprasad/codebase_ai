import re
from typing import Any


SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{12,}['\"]"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]


def detect_issues(parsed_files: list[dict[str, Any]], graph: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    for file in parsed_files:
        content = "\n".join(chunk["content"] for chunk in file.get("chunks", []))
        issues.extend(detect_file_issues(file, content))
    for cycle in graph.get("cycles", []):
        issues.append(
            {
                "severity": "High",
                "category": "Architecture",
                "title": "Circular dependency detected",
                "file": cycle[0] if cycle else None,
                "line": None,
                "details": " -> ".join(cycle[:8]),
                "recommendation": "Break the cycle by extracting an interface, shared module, or dependency inversion boundary.",
            }
        )
    severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    issues.sort(key=lambda issue: severity_order.get(issue["severity"], 99))
    return {
        "issues": issues,
        "summary": summarize_issues(issues),
        "score": calculate_quality_score(issues),
    }


def detect_file_issues(file: dict[str, Any], content: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for pattern in SECRET_PATTERNS:
        for match in pattern.finditer(content):
            issues.append(issue("Critical", "Security", "Possible hardcoded secret", file, content, match.start(), "Move secrets to environment variables or a secret manager."))
    if re.search(r"\beval\s*\(", content):
        issues.append(issue("High", "Security", "Use of eval detected", file, content, content.find("eval"), "Avoid eval and use structured parsers or whitelisted operations."))
    if re.search(r"shell\s*=\s*True", content):
        issues.append(issue("High", "Security", "Shell execution enabled", file, content, content.find("shell"), "Use subprocess argument arrays and avoid shell=True."))
    if re.search(r"SELECT .*?\+|f['\"].*SELECT|format\(.*SELECT", content, flags=re.IGNORECASE | re.DOTALL):
        issues.append(issue("High", "Security", "Possible SQL injection risk", file, content, content.lower().find("select"), "Use parameterized queries or an ORM query builder."))
    if len(file.get("functions", [])) == 0 and file.get("line_count", 0) > 600:
        issues.append(
            {
                "severity": "Medium",
                "category": "Maintainability",
                "title": "Large file with few detected functions",
                "file": file["path"],
                "line": 1,
                "details": f"{file['path']} has {file.get('line_count')} lines and little structural separation.",
                "recommendation": "Split responsibilities into focused modules or components.",
            }
        )
    for chunk in file.get("chunks", []):
        if chunk["end_line"] - chunk["start_line"] > 180:
            issues.append(
                {
                    "severity": "Low",
                    "category": "Maintainability",
                    "title": "Large code chunk",
                    "file": file["path"],
                    "line": chunk["start_line"],
                    "details": "This region is large enough to deserve focused review.",
                    "recommendation": "Extract smaller functions and add tests around the behavior before refactoring.",
                }
            )
    if "TODO" in content or "FIXME" in content:
        issues.append(issue("Low", "Code Quality", "TODO/FIXME comments found", file, content, min([pos for pos in [content.find("TODO"), content.find("FIXME")] if pos >= 0]), "Triage these comments into tracked work items."))
    return issues


def issue(
    severity: str,
    category: str,
    title: str,
    file: dict[str, Any],
    content: str,
    offset: int,
    recommendation: str,
) -> dict[str, Any]:
    line = content[: max(offset, 0)].count("\n") + 1
    return {
        "severity": severity,
        "category": category,
        "title": title,
        "file": file["path"],
        "line": line,
        "details": title,
        "recommendation": recommendation,
    }


def summarize_issues(issues: list[dict[str, Any]]) -> dict[str, int]:
    summary = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for issue_item in issues:
        summary[issue_item["severity"]] = summary.get(issue_item["severity"], 0) + 1
    return summary


def calculate_quality_score(issues: list[dict[str, Any]]) -> int:
    penalty = 0
    weights = {"Critical": 25, "High": 14, "Medium": 7, "Low": 2}
    for issue_item in issues:
        penalty += weights.get(issue_item["severity"], 1)
    return max(0, 100 - penalty)

