from typing import Any


def build_test_generation_prompt(file_context: dict[str, Any], framework: str) -> str:
    path = file_context.get("path", "unknown")
    content = file_context.get("content", "")
    return f"""Generate high-value {framework} tests for `{path}`.

Rules:
- Cover normal behavior, edge cases, and error paths.
- Use mocks for external services and network calls.
- Keep tests deterministic.
- Include imports and setup code.

Source:
```text
{content}
```
"""

