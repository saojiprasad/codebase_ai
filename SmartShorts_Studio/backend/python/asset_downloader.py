import argparse
import hashlib
import json
import os
import pathlib
import time
import urllib.request


ASSET_TREE = {
    "sfx": ["impacts", "whooshes", "risers", "bass_drops", "glitches", "cinematic", "crowd", "laugh", "meme", "transitions"],
    "bgm": ["lofi", "cinematic", "motivational", "dark", "gaming", "emotional"],
    "overlays": ["particles", "fire", "smoke", "light_leaks", "glitches", "lens_flares", "flashes", "rain", "anime", "speed_lines"],
    "transitions": ["zoom", "whip", "blur", "spin", "shake", "flash"],
    "broll": ["gameplay", "satisfying", "luxury", "finance", "podcast", "cinematic", "city", "nature", "memes", "anime", "technology"],
    "reactions": ["shocked", "laughing", "crowd", "meme"],
    "stickers": ["arrows", "emojis", "subscribe", "engagement"],
}


def ensure_tree(root: pathlib.Path) -> None:
    for asset_type, categories in ASSET_TREE.items():
        for category in categories:
            (root / asset_type / category).mkdir(parents=True, exist_ok=True)


def file_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_name(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() or ch in "._-" else "_" for ch in value)
    return cleaned.strip("_")[:90] or "asset"


def download(url: str, retries: int = 3) -> bytes:
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                return response.read()
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(0.45 * attempt)
    raise RuntimeError(f"download failed: {last_error}")


def save_asset(root: pathlib.Path, url: str, asset_type: str, category: str, name: str) -> dict:
    if asset_type not in ASSET_TREE or category not in ASSET_TREE[asset_type]:
        raise ValueError(f"unsupported category {asset_type}/{category}")

    data = download(url)
    digest = file_hash(data)
    suffix = pathlib.Path(url.split("?")[0]).suffix or ".bin"
    target = root / asset_type / category / f"{safe_name(name)}_{digest[:8]}{suffix}"

    for existing in root.rglob("*"):
        if existing.is_file() and existing.stat().st_size == len(data):
            try:
                if file_hash(existing.read_bytes()) == digest:
                    return {"skipped": True, "reason": "duplicate", "duplicateOf": str(existing), "hash": digest}
            except OSError:
                continue

    target.write_bytes(data)
    return {"skipped": False, "path": str(target), "hash": digest, "sizeBytes": len(data)}


def main() -> None:
    parser = argparse.ArgumentParser(description="SmartShorts local free-asset downloader helper")
    parser.add_argument("--root", default=str(pathlib.Path(__file__).resolve().parents[1] / "assets"))
    parser.add_argument("--url", required=True)
    parser.add_argument("--type", required=True)
    parser.add_argument("--category", required=True)
    parser.add_argument("--name", default="downloaded_asset")
    args = parser.parse_args()

    root = pathlib.Path(args.root)
    ensure_tree(root)
    result = save_asset(root, args.url, args.type, args.category, args.name)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
