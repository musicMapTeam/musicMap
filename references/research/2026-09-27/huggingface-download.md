# Hugging Face 音乐元数据下载

执行日期：2026-09-27。用户本轮明确要求下载 Hugging Face 数据库；本记录替代此前“仅留作调研、暂不下载”的实施决定。下载对象是完整曲目元数据 CSV，不是模型权重、音频或歌词。

## 下载了什么

采用 [maharshipandya/spotify-tracks-dataset](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset)，固定提交 **`635b034f69257814eff850a5c2b3346fe458134f`**。数据卡描述其来源为 Spotify Web API，包含曲目、专辑、艺人名单及音乐特征；它没有详细制作人员表，也没有稳定艺人 ID。

原始文件位于 `data/external/spotify-tracks-dataset/`，沿用仓库 `data/` 忽略规则，不进入 Git。该目录还保存原始 `README.md`、固定提交的 API 信息、文件树和含完整字段说明的 `manifest.json`。

| 实际解析结果 | 数量 |
| --- | ---: |
| CSV 文件字节数 | 20,118,244 B，约 19.19 MiB |
| 数据记录 | 114,000 |
| 列数 | 21 |
| 不同 `track_id` | 89,741 |
| 重复曲目 ID 的额外记录 | 24,259 |
| 多人艺人名单记录 | 30,075 |
| 不同艺人姓名字符串 | 29,858 |
| 流派 | 114，每类 1,000 行 |
| 空值 | `artists`、`album_name`、`track_name` 各 1 个 |

数据卡正文写 125 个流派，实际下载文件为 **114** 个；产品使用实际解析数。姓名字符串数不能当作经过消歧的真实艺人数，重复曲目 ID 也不能直接当成不同作品。

### 固定来源与文件指纹

- [固定 CSV](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset/resolve/635b034f69257814eff850a5c2b3346fe458134f/dataset.csv)：SHA-256 `b202fa49909b2d5cef71a04b1d21243cfeb36414535f2ca9272aa646721177bd`；与 HF 文件树中的 LFS 对象哈希一致。
- [固定数据卡](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset/blob/635b034f69257814eff850a5c2b3346fe458134f/README.md)：4,678 B；SHA-256 `3e5c1b474910366ff994d5544a2339094f8f7977951d8f71aa6b0f8fd30e0a53`。
- [固定提交 API](https://huggingface.co/api/datasets/maharshipandya/spotify-tracks-dataset/revision/635b034f69257814eff850a5c2b3346fe458134f)：本次快照 1,644 B；SHA-256 `3c172d8590b871a9164109b89c3e5d88586ec1feacded046396ce8a4f40ab4da`。
- [文件树 API](https://huggingface.co/api/datasets/maharshipandya/spotify-tracks-dataset/tree/635b034f69257814eff850a5c2b3346fe458134f?expand=true)：本次快照 2,103 B；SHA-256 `7183a0bd71aa0e009340cc275448e5ea8f4baa7bae5b39726c930b8907e8bd36`。

API 响应中的站点统计等附加元数据可能随时间变化；脚本固定数据提交并核验 CSV 内容哈希，不要求后续 API 响应逐字相同。

## 字段怎么用

| 字段 | 含义与使用方式 |
| --- | --- |
| 空标题首列（Viewer 显示 `Unnamed: 0`） | 原 CSV 行索引，作为回溯位置保留 |
| `track_id` | Spotify 曲目 ID；只作来源身份，不生成收听链接 |
| `artists` | 以 `;` 分隔的共同署名艺人；保留原姓名和顺序 |
| `album_name` / `track_name` | 原始专辑名、曲目名，保留 remix / live 等版本字样 |
| `popularity` | 采集时的 0–100 值，仅用于挑选前端样本，不展示成实时排行榜 |
| `duration_ms` / `explicit` | 时长和原始内容标记；不进入前端派生数据 |
| `danceability` / `energy` / `loudness` | 舞蹈适配、强度、响度等特征；暂不用于推荐或给用户评分 |
| `key` / `mode` / `tempo` / `time_signature` | 调性、大小调、BPM、拍号等估计信息；保留在原始数据 |
| `speechiness` / `acousticness` / `instrumentalness` / `liveness` / `valence` | 口语、原声、器乐、现场与情绪特征估计；不视为版权、现场认证或模型推理证据 |
| `track_genre` | 原始流派标签；不等同于两位艺人的合作证明 |

`artists` 中可以同时出现歌手、制作艺人、组合、混音者等。例如此文件把 `Charlie Puth;Jung Kook;BTS` 列为一首作品的艺人名单，不能据此宣称三个独立演唱者均在作品中演唱，更不能分配词曲、编曲或制作职务。因此开放曲库与逐首人工核实的真实合作精选分开：前者显示“共同署名”，后者才展示有具体依据的分工。

## 前端派生文件

文件：`web/assets/data/hf-collaborations.json`，**120 首 / 43,631 B**；SHA-256 `cfc60aa97aa5fdc6db0f4b7be963c0166f25e3c6a43f032c2f6b8a756a8ad0ca`。

选择规则可复现：

1. 使用具有 2–5 个不同艺人姓名且曲名、专辑名非空的记录。
2. 按 `track_id` 去重；同 ID 取较高的历史 `popularity`，相同值保留先出现行。
3. 按历史 `popularity` 降序、原始行索引升序排列；再次按曲名与艺人名单去重。
4. 同一首位艺人最多 3 首，取满 120 首。该集合偏向采集时较流行的多人作品，不声称覆盖所有流派或代表当前市场。

```json
{
  "schemaVersion": 1,
  "dataset": "hf-open-catalogue",
  "title": "开放曲库",
  "source": { "repository": "…", "revision": "…", "url": "…", "sha256": "…" },
  "counts": { "rows": 114000, "selectedTracks": 120 },
  "creditMeaning": "原始 artists 字段列出的共同署名艺人；具体分工未提供。",
  "tracks": [{
    "id": "hf-3nqQXoyQOWXiESFLlDF1hG",
    "title": "Unholy (feat. Kim Petras)",
    "artists": ["Sam Smith", "Kim Petras"],
    "album": "Unholy (feat. Kim Petras)",
    "source": { "rowIndex": 20001, "recordNumber": 20002, "trackId": "3nqQXoyQOWXiESFLlDF1hG" }
  }]
}
```

`rowIndex` 是 CSV 首列的原始索引；`recordNumber` 是不含表头、从 1 开始的 CSV **记录序号**，不是文本编辑器中的物理行号。每首共享顶层固定仓库/提交/文件来源，不把 HF 页面误标为听歌平台。

接入建议：单独“开放曲库”入口，支持按姓名或曲名查找，展开作品时列出共同署名和专辑。它不进入现有 10 首精确合作精选的挑战边，不从此名单推断职业分工。遵照用户本轮偏好，派生文件不生成 Spotify、YouTube 或猜测的 QQ 音乐链接；已有确切 QQ 音乐版本才能提供收听入口。

## 许可与内容范围

固定数据卡 YAML 仅声明 **`license: bsd`**；固定文件树没有独立 `LICENSE` 文件，也未指定 BSD 2-Clause / 3-Clause 等版本。项目如实保留该声明与数据卡来源，不替上游补写一个不存在的许可证。该标签不能证明歌曲、封面、歌词或音频的使用权。

公开提交的派生文件仅包含曲名、艺人名、专辑名与可回溯出处，不包含音频、歌词、封面、用户记录或音乐模型。完整数据只在本地留档，发布前仍应按实际使用范围确认来源条款；本次下载和事实元数据展示不代表采购到了可播放的曲库。

## 重现

在仓库根目录运行（Python 3.9+ 标准库，无新增包）：

```powershell
python scripts/datasets/download_hf_catalogue.py
```

脚本下载固定提交的四个原始文件，核验 CSV 哈希，一次遍历统计字段并生成派生 JSON 与本地 manifest。已有原始文件直接复用；明确需要重新下载同一固定版本时增加 `--force`。没有使用用户令牌或 Hugging Face 登录。

本轮已实际运行成功，并读取生成清单及前 8 首派生内容确认字段含义。没有新增测试框架、训练任务或音频处理流程。
