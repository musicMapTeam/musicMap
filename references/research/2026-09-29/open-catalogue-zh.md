# 开放曲库改为华语共同署名曲库

执行日期：2026-09-29。数据源仍是 [maharshipandya/spotify-tracks-dataset](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset/tree/635b034f69257814eff850a5c2b3346fe458134f) 固定提交 `635b034f…`，本地 `dataset.csv` 哈希 `b202fa49…77bd` 与固定值一致，本轮没有重新下载 CSV。

## 为什么改

产品已收敛为华语音乐发现 Map。原 120 首按全库 popularity 选取，没有一首来自 mandopop / cantopop，也没有一个中文曲名或艺人名（如 Unholy、雷鬼音乐），与华语主线不符。改为只取华语流派的共同署名作品。

## 选取规则

脚本：`scripts/datasets/download_hf_catalogue.py`。输出结构不变（`web/js/open-catalogue.js` 与 `vite.config.js` 读取的字段都保留）。

1. 只取 `track_genre` 为 `mandopop` 或 `cantopop` 的记录；数据中没有 c-pop、chinese 等其他华语流派。
2. `artists` 按 `;` 拆分去重后有 2–5 个不同字符串，曲名、专辑非空。这一步也排除了 26 人署名的《Our Singapore – NDP 2019 Theme Song》。
3. 排除列有下列任一字符串的记录：
   - 内容风险：`Namewee`、`Kris Wu`、`明日花綺羅`。
   - 占位或录音室 / 制作署名：`Unknown`、`Sony Studio`、`Tom Brown`、`Joe Wong and Tom Brown`、`Tom Brown and Joe Wong`、`Rico Fung and David at Studio A`、`David Ling Jr. and Johnny at CBS`、`Zhang Yong Fu and Eric Chen`。
4. 按 `track_id` 去重。同一 ID 出现在两个流派时，保留 popularity 较高的一行；数值相同时保留先出现的一行。
5. 按 popularity 降序、原始行索引升序排列，再按“曲名 + 艺人名单”去重。曲名先做 NFKC 与大小写折叠，再去掉末尾的括注和“ - …”后缀；若去掉后为空则保留原文，例如 `(......醉鬼阿Q)(feat. 孫燕姿)` 归为 `(......醉鬼阿Q)`。
6. 同一首位艺人最多 3 首。满足条件的剩余作品全部收录，不设总数上限。

popularity 是采集时（2023-06 前）的 0–100 值，只用于去重取舍和列表顺序，不表示当前热度，也不作排名展示。`creditMeaning` 不变：只表示共同署名，演唱、词曲、制作分工未知。

## 数量

| 步骤 | 数量 |
| --- | ---: |
| 全库记录 | 114,000 |
| mandopop + cantopop 记录 | 2,000 |
| 其中 2–5 名艺人、曲名专辑非空 | 175 条记录 |
| 因排除字符串去掉 | 19 条记录 |
| 按 track_id 去重后 | 149 |
| 曲名 + 艺人名单重复 | 7 |
| 超出首位艺人 3 首上限 | 16 |
| **收录** | **126 首** |

126 首中，所选记录来自 mandopop 64 首、cantopop 62 首。按署名人数分：两人 117 首、三人 6 首、四人 2 首、五人 1 首。共 193 个不同艺人字符串；117 首的曲名或艺人名含汉字。与旧 120 首没有相同 ID。

上限去掉的 16 首包括：
- 周杰伦《等你下課》2 个 track_id，因周杰伦作首位的名额已被《珊瑚海》《說好不哭》《不該》占满；
- 林俊杰《Stay With You – 英文版》；
- 蔡依林《布拉格廣場》；
- 吴青峰《马拉美的星期二》9 首；
- Byejack 2 首；
- 林子祥《這一個夜》。

## 与已核实合唱网的重合

对照 2026-09-28 `network-expansion.json`：既有 13 份加新增 24 份，共 37 份已核实录音。

- **18 首同曲且艺人对一致。** 既有 5 首：不該、說好不哭、畫沙、小酒窩、手心的薔薇。新增 13 首：屋頂、珊瑚海、Try、對等關係、我有多麼喜歡你、致姗姗来迟的你、別勉強、愛我的時候、溫柔 #MaydayBlue20th、（......醉鬼阿Q）、今天妳要嫁給我、我是誰、再也沒有你。
  - 其中《今天妳要嫁給我》所选记录出自蔡依林《唯舞獨尊演唱會鮮聽版&特別混音專輯》，与已核实的《太美丽》录音室版不是同一录音。
- **1 首同曲但署名不同。** 《私奔到月球》在 HF 中署名为 `Mayday · Cheer Chen`，已核实的演唱者是阿信与陈绮贞。
- **2 首已核实录音在 HF 华语记录中存在，但被首位艺人上限去掉**：《等你下課》《Stay With You – 英文版》。《布拉格廣場》经核实不是周杰伦与蔡依林的合唱，本来就不能作为合作边。
- 曲库中有 28 首至少包含一位网络内艺人，涉及 29 位中的 25 位。

重合行只说明同一首歌在两处都有记录。开放曲库仍只标“共同署名”，不因为重合而改为合唱边。

| 曲库序号 | HF ID | 对应核实录音 |
| ---: | --- | --- |
| 2 | `hf-07DWACsD58aEdq6XnDadLh` | 手心的蔷薇 `real-beautiful` |
| 4 | `hf-4JY5s40ymnG18f6wxQtzPw` | 珊瑚海 `real-coral-sea` |
| 7 | `hf-77BQceOpfvUBXgokOFHYMm` | 说好不哭 `real-wont-cry` |
| 12 | `hf-6us212S3fCRIQwOwNExqLH` | 爱我的时候 `real-when-you-loved-me` |
| 15 | `hf-7LyCtbxher5m97MImn5M3l` | 不该 `real-bu-gai` |
| 17 | `hf-4PMakIBWXujbe2MIsuZtOc` | 对等关系 `real-equal-terms` |
| 21 | `hf-53WV5mAY2opmFC0r0LjRdM` | 小酒窝 `real-dimples` |
| 22 | `hf-01PSJFZbSRujjSk9d2Gbla` | 再也没有你 `real-no-more-u` |
| 28 | `hf-40fcXSuSb80MekMZM1ei2J` | 温柔 #MaydayBlue20th `real-tenderness-20th` |
| 29 | `hf-6tzOEJ2tqSiAxHw9CAT9Ru` | 别勉强 `real-dont-force-it` |
| 35 | `hf-4eH9ujPhZSF0HZ1c004wtb` | 致姗姗来迟的你 `real-sincerely-yours` |
| 38 | `hf-2edBRoaI2F2ST6WK0jdLUX` | 屋顶 `real-rooftop` |
| 50 | `hf-5ZFN0GcP1IA5jUp9kf1X03` | 今天你要嫁给我 `real-marry-me-today`（版本不同） |
| 52 | `hf-7F92rki4H1RZ68OrOZQy4u` | 画沙 `real-sand-painting` |
| 55 | `hf-3oTmOv9KjIcOfRTfGH5c62` | 我是谁 `real-who-am-i` |
| 64 | `hf-0tSbBmOAukoqCsFfYYAI2A` | （......醉鬼阿Q） `real-drunk-ah-q` |
| 75 | `hf-0a0z74CqgCXrC3UyYATdLC` | Try `real-try` |
| 102 | `hf-6MwdxH1iD9lNKNZcg9Gy28` | 我有多么喜欢你 `real-how-much-i-love-you` |
| 25 | `hf-0WzdHebEnoKHlTxq5x2e67` | 私奔到月球 `real-elope-to-the-moon`（署名不同） |

## 排除与残留噪声

19 条被排除的记录包括：
- Namewee 的 5 首、6 条记录：飄向北方、我愛的、漂向北方、玻璃心 ×2、牆外；
- Lu Han 与 Kris Wu 的《咖啡》；
- 10 条粤语老歌的录音室、制作或占位署名：Danny Chan、Sally Yeh、陳潔玲的记录中出现 Tom Brown、Unknown、Sony Studio 等；
- 《渴望》的 2 条记录，署名含 `Zhang Yong Fu and Eric Chen`。

以下记录没有命中给定的排除名单，按规则保留。它们确实在 `artists` 中，但不能当作合唱理解，由产品负责人决定是否追加排除：

- **身份不明或疑似非演唱署名**：《開始懂了》`Jerry`、`Lin Zheng-Zhong`；《綠光》`Shen Darren`；《敢愛敢做》《把歌談心》《追憶》的 `David Ling Jr`；《舊居中的鋼琴》`David Ling`；《一生何求》`Bryan Choy Hin Lok`、`David Ling Jr`。
- **自我别名**：《我們萬歲》《漸漸》，`Eason Chan` 与 `eason and the duo band`。
- **泛用名字符串**：`Frankie`（《鐵幕誘惑》）、`Midnight.`（《聽海浪》）、`sunkis`（《Work》）。
- **可能的内容风险**：Leehom Wang 的 2 首，《好心分手》《另一個天堂》。
- **非华语嘉宾**：AURORA、Anne-Marie、Namie Amuro、大橋三重唱、Regine Velasquez。它们是真实的共同署名，保留。

抽看 10 首（序号 1、11、20、31、57、65、71、86、112、126）：
- 《I'm Alive》《凉凉》《相愛很難》《熱力節拍》《苦口良藥》的署名正常。《苦口良藥》出自合辑，popularity 为 0。
- 《開始懂了》《我們萬歲》《敢愛敢做》《鐵幕誘惑》属于上面的残留噪声。
- 《[Jiang Yanli & Jin Zixuan] Yong Ge》是《陈情令》原声的拼音曲名，署名正常，但曲名不易读。

## 输出与脚本

- `web/assets/data/hf-collaborations.json`：**126 首，43,825 B，LF 换行**；SHA-256 `06a8e0b7f9f5644face8b85a1de85b995cd333d4005c561d3e8043d9dc19f3d7`。
- 新增字段：`counts` 加入 `zhGenreRows`、`zhCoCreditRows`、`excludedRows`、`eligibleUniqueTrackIds`；顶层加入 `genres`。其余键和每首的结构（`id/title/artists/album/source{rowIndex,recordNumber,trackId}`）不变，`counts.rows` 仍为 114,000。
- 脚本改动：
  - 本地 CSV 存在且哈希一致时直接复用。`--offline` 完全不联网；`--force` 重新下载，二者不能同时使用。
  - 数据卡、API 快照等来源文件只在缺失时补取，补取失败只给出警告。
  - 输出统一写 LF，先写临时文件再原子替换。
  - 可用 `--output` 把结果写到别处预检。
- 本轮先用 `--offline --output /tmp/…` 生成并逐行对照 CSV 校验，再一次性写入仓库文件。默认模式补取了缺失的 `file-tree.json`（2,103 B，哈希与 2026-09-27 记录一致）。
- 构建：`vite build` 成功，单文件 HTML 中的 HF 声明为“126 factual track credits”。

## 旧收藏

旧曲库的收藏 ID 仍是 `hf-<track_id>`。`music-library.js` 保存的是快照（id、曲名、艺人、来源、`dataset: 'hf'`），“留下的歌”直接渲染快照，不回查曲库，因此不需要迁移。旧歌只是不会再出现在开放曲库列表里。

## 历史哈希说明

2026-09-27 的 `huggingface-download.md` 记录的是 **43,631 B / `cfc60aa9…`**，对应在 Windows 上以 CRLF 写出的副本。实际提交的 LF 文件是 **41,885 B / `3889e1cc…`**。原因是旧脚本用 `write_text` 按平台换行写文件，本轮已固定为 LF。旧文档保留原样，作为历史记录。

## 仍待更新

以下文件仍写“120 首 / 120-record”，不在本轮范围内：
- 仓库说明：`THIRD_PARTY_NOTICES.md`、`AGENTS.md`、`CHANGELOG.md`、`RUN-ME.md`；
- 状态与交付：`docs/PROJECT_STATUS.md`（含 Sam Smith / Unholy 的操作记录）、`delivery/README.md`；
- 产品文档：`product/README.md`、`product/docs/01-product-plan.md`、`02-delivery-plan.md`、`03-build-guide.md`。

另外，`open-catalogue.js` 的列表序号是 01、02……，形似排名，建议改为无序号或按曲名排列。
