from dataclasses import dataclass


@dataclass(frozen=True)
class GitHubRepository:
    owner: str
    name: str
    clone_url: str


def parse_github_url(url: str) -> GitHubRepository | None:
    normalized = url.removesuffix(".git").rstrip("/")
    parts = normalized.split("/")
    if "github.com" not in normalized or len(parts) < 2:
        return None
    owner, name = parts[-2], parts[-1]
    if not owner or not name:
        return None
    return GitHubRepository(owner=owner, name=name, clone_url=f"https://github.com/{owner}/{name}.git")

