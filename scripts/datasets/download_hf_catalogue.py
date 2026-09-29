"""Download pinned public music metadata and make the small 华语 browser catalogue.

Run from the repository root: python scripts/datasets/download_hf_catalogue.py
Only the Python standard library is required. No credentials, models or audio.

The pinned dataset.csv is the only required input. If a local copy already
matches CSV_SHA256 it is reused as is; the small provenance files (card, API
snapshots) are fetched only when missing. Use --offline to never touch the
network, and --force to redownload every pinned file.
"""

import argparse
import collections
import csv
import hashlib
import http.client
import json
import os
import re
import sys
import unicodedata
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

# 华语 selection: only these track_genre labels (the file has no c-pop / chinese genre).
ZH_GENRES = ("mandopop", "cantopop")
MIN_ARTISTS, MAX_ARTISTS = 2, 5  # 2–5 also drops the 26-credit NDP theme song
MAX_PER_PRIMARY = 3
# Rows listing any of these exact artist strings are skipped. Content risk for
# a 华语 music entry: Namewee, Kris Wu, 明日花綺羅. Credit noise (studio,
# producer or placeholder strings, not performers): the rest.
EXCLUDED_ARTISTS = (
    "Namewee",
    "Kris Wu",
    "明日花綺羅",
    "Unknown",
    "Sony Studio",
    "Tom Brown",
    "Joe Wong and Tom Brown",
    "Tom Brown and Joe Wong",
    "Rico Fung and David at Studio A",
    "David Ling Jr. and Johnny at CBS",
    "Zhang Yong Fu and Eric Chen",
)
SELECTION = (
    "仅取固定快照中 track_genre 为 mandopop 或 cantopop 的记录，要求列出 2–5 名不同艺人且曲名、专辑非空；"
    f"排除列有 {len(EXCLUDED_ARTISTS)} 个指定字符串之一的记录：内容风险姓名 Namewee、Kris Wu、明日花綺羅，以及 Unknown、Sony Studio、Tom Brown 等占位或录音室 / 制作署名。"
    "先按 track_id 去重，再按去掉末尾版本括注与“ - ”后缀的曲名 + 艺人名单去重；同一首位艺人最多 3 首，剩余全部收录，共 {count} 首。"
    "采集时的 popularity 只用于去重取舍和列表顺序，不表示当前热度或排名；不是榜单或统计抽样。"
)
FIELDS = {
    "": "原始 CSV 行索引；HF Viewer 将此列显示为 Unnamed: 0",
    "track_id": "原始 Spotify 曲目 ID；不作为收听链接或版本互认依据",
    "artists": "分号分隔的艺人名单；不区分演唱、词曲、制作、混音等角色",
    "album_name": "原始专辑名称",
    "track_name": "原始曲目名称，可能包含版本标记",
    "popularity": "数据采集时的 0–100 流行度，仅用于去重取舍与排序；不表示实时热度",
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

TRAILING_BRACKET = re.compile(r"\s*[(\[【][^()\[\]【】]*[)\]】]\s*$")
TRAILING_DASH = re.compile(r"\s+[-–—]\s*[^-–—]*$")


def title_key(title):
    """Casefolded title without trailing version brackets or a trailing " - …" suffix.

    Stripping stops before the title would become empty, so bracket-only titles
    such as "(......醉鬼阿Q)(feat. 孫燕姿)" keep their core "(......醉鬼阿Q)".
    """
    text = " ".join(unicodedata.normalize("NFKC", title).casefold().split())
    while (stripped := TRAILING_BRACKET.sub("", text).strip()) and stripped != text:
        text = stripped
    stripped = TRAILING_DASH.sub("", text).strip()
    return stripped or text


def download(url, destination, force=False):
    if destination.exists() and not force:
        return
    request = Request(url, headers={"User-Agent": "MusicMap-metadata-import/1.0"})
    partial = destination.with_name(destination.name + ".part")
    with urlopen(request, timeout=60) as response, partial.open("wb") as output:
        while block := response.read(1024 * 1024):
            output.write(block)
    os.replace(partial, destination)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    """Write UTF-8 JSON with LF line endings on every OS, replacing the file atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    os.replace(temporary, path)


def display_path(path):
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def fetch_sources(sources, offline, force):
    csv_path = RAW_DIR / "dataset.csv"
    if not offline and (force or not csv_path.exists() or sha256(csv_path) != CSV_SHA256):
        download(sources["dataset.csv"], csv_path, force=True)
    if not csv_path.exists():
        raise FileNotFoundError(f"{csv_path} is missing; run once without --offline to fetch the pinned CSV")
    for filename, url in sources.items():
        if filename == "dataset.csv" or offline:
            continue
        try:
            download(url, RAW_DIR / filename, force)
        except (OSError, http.client.HTTPException) as error:
            print(f"warning: provenance file {filename} not fetched ({error}); continuing with the verified CSV", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="Redownload the pinned source files")
    parser.add_argument("--offline", action="store_true", help="Use local files only; never open a network connection")
    parser.add_argument("--output", type=Path, default=OUTPUT, help="Browser JSON destination (default: the tracked web asset)")
    args = parser.parse_args()
    if args.offline and args.force:
        parser.error("--offline and --force cannot be combined")
    output_path = args.output.resolve()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    sources = {
        "dataset.csv": f"{BASE}/resolve/{REVISION}/dataset.csv",
        "README.md": f"{BASE}/resolve/{REVISION}/README.md",
        "dataset-info.json": f"https://huggingface.co/api/datasets/{REPO_ID}/revision/{REVISION}",
        "file-tree.json": f"https://huggingface.co/api/datasets/{REPO_ID}/tree/{REVISION}?expand=true",
    }
    fetch_sources(sources, args.offline, args.force)
    actual_hash = sha256(RAW_DIR / "dataset.csv")
    if actual_hash != CSV_SHA256:
        raise ValueError(f"dataset.csv SHA-256 does not match the pinned HF LFS object: {actual_hash}")

    metadata = {}
    if (RAW_DIR / "dataset-info.json").exists():
        metadata = json.loads((RAW_DIR / "dataset-info.json").read_text(encoding="utf-8"))
        if metadata["sha"] != REVISION:
            raise ValueError("Downloaded repository metadata has a different revision")

    excluded = set(EXCLUDED_ARTISTS)
    genres = collections.Counter()
    missing = collections.Counter()
    track_ids = set()
    names = set()
    candidates = {}
    multi_artist_rows = 0
    row_count = 0
    zh_rows = 0
    zh_co_credit_rows = 0
    zh_excluded_rows = 0
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
            if row["track_genre"] not in ZH_GENRES:
                continue
            zh_rows += 1
            if not MIN_ARTISTS <= len(artists) <= MAX_ARTISTS or not row["track_name"].strip() or not row["album_name"].strip():
                continue
            zh_co_credit_rows += 1
            if excluded.intersection(artists):
                zh_excluded_rows += 1
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
    duplicate_titles = 0
    over_primary_cap = 0
    for track in sorted(candidates.values(), key=lambda entry: (-entry["_popularity"], entry["source"]["rowIndex"])):
        identity = (title_key(track["title"]), tuple(sorted(name.casefold() for name in track["artists"])))
        if identity in selected_keys:
            duplicate_titles += 1
            continue
        primary = track["artists"][0]
        if primary_counts[primary] >= MAX_PER_PRIMARY:
            over_primary_cap += 1
            continue
        selected_keys.add(identity)
        primary_counts[primary] += 1
        selected.append({key: value for key, value in track.items() if not key.startswith("_")})

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
        "zhGenreRows": zh_rows,
        "zhCoCreditRows": zh_co_credit_rows,
        "excludedRows": zh_excluded_rows,
        "eligibleUniqueTrackIds": len(candidates),
        "duplicateTitleTracks": duplicate_titles,
        "overPrimaryCapTracks": over_primary_cap,
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
        "counts": {
            key: stats[key]
            for key in [
                "rows", "uniqueTrackIds", "multiArtistRows", "genres",
                "zhGenreRows", "zhCoCreditRows", "excludedRows", "eligibleUniqueTrackIds", "selectedTracks",
            ]
        },
        "genres": list(ZH_GENRES),
        "creditMeaning": "原始 artists 字段列出的共同署名艺人；具体演唱、词曲、编曲、制作与演奏分工未提供。",
        "selection": SELECTION.format(count=len(selected)),
        "tracks": selected,
    }
    write_json(output_path, browser_data)
    manifest = {
        "repository": REPO_ID,
        "revision": REVISION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "offline": args.offline,
        "files": {
            filename: (
                {"url": url, "bytes": (RAW_DIR / filename).stat().st_size, "sha256": sha256(RAW_DIR / filename)}
                if (RAW_DIR / filename).exists() else {"url": url, "present": False}
            )
            for filename, url in sources.items()
        },
        "license": {"cardLabel": metadata.get("cardData", {}).get("license"), "standaloneLicenseFile": False},
        "selection": {
            "genres": list(ZH_GENRES),
            "artistsPerTrack": [MIN_ARTISTS, MAX_ARTISTS],
            "maxPerPrimaryArtist": MAX_PER_PRIMARY,
            "excludedArtists": list(EXCLUDED_ARTISTS),
        },
        "statistics": stats,
        "fields": [{"name": field, "meaning": FIELDS.get(field, FIELDS[""] if field == "Unnamed: 0" else "未描述")} for field in fields],
        "derivedFile": {"path": display_path(output_path), "bytes": output_path.stat().st_size, "sha256": sha256(output_path)},
    }
    write_json(RAW_DIR / "manifest.json", manifest)
    print(json.dumps({"rawDirectory": str(RAW_DIR), "csvBytes": (RAW_DIR / "dataset.csv").stat().st_size, "csvSha256": actual_hash, "statistics": stats, "derivedFile": manifest["derivedFile"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
