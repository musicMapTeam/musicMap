"""Download pinned public music metadata and make the small browser catalogue.

Run from the repository root: python scripts/datasets/download_hf_catalogue.py
Only the Python standard library is required. No credentials, models or audio.
"""

import argparse
import collections
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


REPO_ID = "maharshipandya/spotify-tracks-dataset"
REVISION = "635b034f69257814eff850a5c2b3346fe458134f"
CSV_SHA256 = "b202fa49909b2d5cef71a04b1d21243cfeb36414535f2ca9272aa646721177bd"
ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "external" / "spotify-tracks-dataset"
OUTPUT = ROOT / "web" / "assets" / "data" / "hf-collaborations.json"
BASE = f"https://huggingface.co/datasets/{REPO_ID}"
FIELDS = {
    "": "原始 CSV 行索引；HF Viewer 将此列显示为 Unnamed: 0",
    "track_id": "原始 Spotify 曲目 ID；不作为收听链接或版本互认依据",
    "artists": "分号分隔的艺人名单；不区分演唱、词曲、制作、混音等角色",
    "album_name": "原始专辑名称",
    "track_name": "原始曲目名称，可能包含版本标记",
    "popularity": "数据采集时的 0–100 流行度，用于选取样本；不表示实时热度",
    "duration_ms": "时长，毫秒",
    "explicit": "原始显式内容标记；false 也可能表示未知",
    "danceability": "舞蹈适配特征，0–1",
    "energy": "强度特征，0–1",
    "key": "调性编号，0–11；-1 表示未知",
    "loudness": "整体响度，dB",
    "mode": "大调 1 / 小调 0",
    "speechiness": "口语占比特征",
    "acousticness": "原声特征置信度",
    "instrumentalness": "器乐特征估计",
    "liveness": "现场特征估计，不证明真实现场或用户到场",
    "valence": "情绪正向程度特征",
    "tempo": "估计速度，BPM",
    "time_signature": "估计拍号",
    "track_genre": "原始流派标签",
}


def download(url, destination, force=False):
    if destination.exists() and not force:
        return
    request = Request(url, headers={"User-Agent": "MusicMap-metadata-import/1.0"})
    with urlopen(request, timeout=60) as response, destination.open("wb") as output:
        while block := response.read(1024 * 1024):
            output.write(block)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Redownload the pinned source files")
    args = parser.parse_args()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    sources = {
        "dataset.csv": f"{BASE}/resolve/{REVISION}/dataset.csv",
        "README.md": f"{BASE}/resolve/{REVISION}/README.md",
        "dataset-info.json": f"https://huggingface.co/api/datasets/{REPO_ID}/revision/{REVISION}",
        "file-tree.json": f"https://huggingface.co/api/datasets/{REPO_ID}/tree/{REVISION}?expand=true",
    }
    for filename, url in sources.items():
        download(url, RAW_DIR / filename, args.force)
    actual_hash = sha256(RAW_DIR / "dataset.csv")
    if actual_hash != CSV_SHA256:
        raise ValueError(f"dataset.csv SHA-256 does not match the pinned HF LFS object: {actual_hash}")

    metadata = json.loads((RAW_DIR / "dataset-info.json").read_text(encoding="utf-8"))
    if metadata["sha"] != REVISION:
        raise ValueError("Downloaded repository metadata has a different revision")

    genres = collections.Counter()
    missing = collections.Counter()
    track_ids = set()
    names = set()
    candidates = {}
    multi_artist_rows = 0
    row_count = 0
    with (RAW_DIR / "dataset.csv").open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fields = reader.fieldnames
        for record_number, row in enumerate(reader, start=1):
            row_count += 1
            genres[row["track_genre"]] += 1
            for field, value in row.items():
                if not value.strip():
                    missing[field] += 1
            if row["track_id"]:
                track_ids.add(row["track_id"])
            artists = list(dict.fromkeys(name.strip() for name in row["artists"].split(";") if name.strip()))
            names.update(artists)
            if len(artists) > 1:
                multi_artist_rows += 1
            if not 2 <= len(artists) <= 5 or not row["track_name"].strip() or not row["album_name"].strip():
                continue
            candidate = {
                "id": f"hf-{row['track_id']}",
                "title": row["track_name"],
                "artists": artists,
                "album": row["album_name"],
                "source": {
                    "rowIndex": int(row[fields[0]]),
                    "recordNumber": record_number,
                    "trackId": row["track_id"],
                },
                "_popularity": int(row["popularity"]),
            }
            previous = candidates.get(candidate["id"])
            if previous is None or candidate["_popularity"] > previous["_popularity"]:
                candidates[candidate["id"]] = candidate

    selected = []
    selected_keys = set()
    primary_counts = collections.Counter()
    for track in sorted(candidates.values(), key=lambda entry: (-entry["_popularity"], entry["source"]["rowIndex"])):
        identity = (track["title"].casefold(), tuple(sorted(name.casefold() for name in track["artists"])))
        primary = track["artists"][0]
        if identity in selected_keys or primary_counts[primary] >= 3:
            continue
        selected_keys.add(identity)
        primary_counts[primary] += 1
        selected.append({key: value for key, value in track.items() if not key.startswith("_")})
        if len(selected) == 120:
            break

    stats = {
        "rows": row_count,
        "columns": len(fields),
        "uniqueTrackIds": len(track_ids),
        "duplicateTrackIdRows": row_count - len(track_ids),
        "uniqueArtistNames": len(names),
        "multiArtistRows": multi_artist_rows,
        "genres": len(genres),
        "genreCounts": dict(sorted(genres.items())),
        "missingValues": dict(missing),
        "eligibleUniqueTrackIds": len(candidates),
        "selectedTracks": len(selected),
    }
    browser_data = {
        "schemaVersion": 1,
        "dataset": "hf-open-catalogue",
        "title": "开放曲库",
        "source": {
            "repository": REPO_ID,
            "revision": REVISION,
            "url": f"{BASE}/tree/{REVISION}",
            "cardUrl": f"{BASE}/blob/{REVISION}/README.md",
            "file": "dataset.csv",
            "sha256": CSV_SHA256,
            "licenseLabel": "bsd",
            "licenseNote": "上游数据卡仅标 bsd，未提供独立 LICENSE 或具体 BSD 版本；不构成音频授权。",
        },
        "counts": {key: stats[key] for key in ["rows", "uniqueTrackIds", "multiArtistRows", "genres", "selectedTracks"]},
        "creditMeaning": "原始 artists 字段列出的共同署名艺人；具体演唱、词曲、编曲、制作与演奏分工未提供。",
        "selection": "从 2–5 名艺人的记录中按采集时 popularity 降序选取；track_id 去重，再按曲名+艺人名单去重；同一首位艺人最多 3 首，共 120 首。不是当前榜单或统计抽样。",
        "tracks": selected,
    }
    write_json(OUTPUT, browser_data)
    manifest = {
        "repository": REPO_ID,
        "revision": REVISION,
        "downloadedAt": datetime.now(timezone.utc).isoformat(),
        "files": {
            filename: {"url": url, "bytes": (RAW_DIR / filename).stat().st_size, "sha256": sha256(RAW_DIR / filename)}
            for filename, url in sources.items()
        },
        "license": {"cardLabel": metadata.get("cardData", {}).get("license"), "standaloneLicenseFile": False},
        "statistics": stats,
        "fields": [{"name": field, "meaning": FIELDS.get(field, FIELDS[""] if field == "Unnamed: 0" else "未描述")} for field in fields],
        "derivedFile": {"path": OUTPUT.relative_to(ROOT).as_posix(), "bytes": OUTPUT.stat().st_size, "sha256": sha256(OUTPUT)},
    }
    write_json(RAW_DIR / "manifest.json", manifest)
    print(json.dumps({"rawDirectory": str(RAW_DIR), "csvBytes": (RAW_DIR / "dataset.csv").stat().st_size, "csvSha256": actual_hash, "statistics": stats, "derivedFile": manifest["derivedFile"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
