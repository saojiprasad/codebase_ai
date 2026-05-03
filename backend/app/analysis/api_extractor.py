from typing import Any


def extract_api_map(parsed_files: list[dict[str, Any]]) -> dict[str, Any]:
    endpoints: list[dict[str, Any]] = []
    for file in parsed_files:
        for api in file.get("apis", []):
            endpoints.append(
                {
                    **api,
                    "handler_file": file["path"],
                    "auth_hint": infer_auth_hint(file, api),
                    "request_hint": infer_request_hint(file),
                    "response_hint": infer_response_hint(file),
                }
            )
    return {
        "endpoints": sorted(endpoints, key=lambda item: (item["path"], item["methods"])),
        "count": len(endpoints),
    }


def infer_auth_hint(file: dict[str, Any], api: dict[str, Any]) -> str:
    content = " ".join(file.get("imports", []))
    route = api["path"].lower()
    if "jwt" in content.lower() or "auth" in route or "token" in route:
        return "Authentication-related code detected near this endpoint."
    return "No direct auth signal found by static scan."


def infer_request_hint(file: dict[str, Any]) -> str:
    imports = " ".join(file.get("imports", [])).lower()
    if "pydantic" in imports or "body" in imports:
        return "Likely uses typed request models or request body parsing."
    return "Request shape requires deeper model analysis."


def infer_response_hint(file: dict[str, Any]) -> str:
    imports = " ".join(file.get("imports", [])).lower()
    if "response" in imports or "json" in imports:
        return "Likely returns JSON or explicit response objects."
    return "Response shape inferred from handler implementation."

