# 产品文档与应用

文档版本：**3.0 · 2026-09-29**，对应应用 **MVP 0.16.0**（分支 `feat/map-mainline`，经 PR #6 合并到 `main`）。

**Music Map：从喜欢，走向未知。** 从一位喜欢的华语歌手出发，沿着每一条都有真实录音依据的合唱，走到下一位、找到下一首，把路线和歌留下，再把一道不剧透的题发给朋友。

在线 Demo：<https://musicmapteam.github.io/musicMap/>。这是 GitHub Pages 上的公开静态构建，只部署了构建文件；FAQ Q10 风险见交付方案。

![小院首页](../docs/assets/themes/home-desktop-v016.png)

## 文档 3.0 改了什么

- **Map 单主线。** 用户 2026-09-28 决定：参赛只保留 Music Map，Music Space 移出参赛入口。Space 保留在 main 的 `3dd102c`（MVP 0.15.0）。转向细节尚待与产品负责人对齐。
- **以 PRD v0.2 为基线。** 产品负责人 igohomealone216 的 [PRD v0.2 原文](../references/original-ideas/music-map-prd-v0.2/README.md)已原样复制。产品方案逐项对照，写明偏差与待确认问题。
- **自由漫游与回顾。** 在「完整图鉴」点相邻歌手就能走过去，本次发现 · N 首，结束后按 PRD 顺序回顾。
- **分享闭环。** 出题给朋友（只带起点和终点）、「朋友出的题」、战绩卡与发现卡片 PNG。
- **数据。**
  - 共唱网扩到 29 位歌手 / 37 份录音，每条边都有官方来源。
  - 开放曲库改为 126 首华语共同署名作品。
  - 37 份录音中 31 份核到 QQ 音乐同版本页面。按用户 2026-09-29 的决定只链接同一版本。入口「去 QQ 音乐听」在 `b5939d9`，已随 `7fa4147` 的构建上线，在线核对见项目状态。
- **交付。** 静态单文件，无后端；已部署到 GitHub Pages，当前为 `7fa4147` 的构建（`e710bf8`）。

## 当前只读这三份

| 文档 | 回答什么 |
| --- | --- |
| [产品方案](docs/01-product-plan.md) | 定位与目标用户、核心闭环、规则、与 PRD v0.2 的范围对照、非目标、待产品负责人确认的问题、2026-09-28 转向记录 |
| [交付方案](docs/02-delivery-plan.md) | 静态单文件与 GitHub Pages、FAQ Q10、参赛材料、≤3 分钟视频路线、评审维度对照、到 10-08 / 10-09 的时间线 |
| [实施规格](docs/03-build-guide.md) | 模块与职责、存储键与迁移、场景机位、数据文件与扩网、QQ 链接数据、出图流程、构建与部署命令、删除内容、历史证据 |

相关文件：

- 实际构建、画面、部署与验证证据：[项目状态](../docs/PROJECT_STATUS.md)
- 介绍文案、分镜与提交核对：[参赛材料](../docs/competition/README.md)
- 美术规范与画面登记：[视觉规范](../docs/VISUAL_THEMES.md)
- 视频与封面文件：[交付清单](../delivery/README.md)
- 数据与参考来源：[资源台账](data/resource-register.json)

## 当前应用

前端在 [`web/`](../web/)，只有三个页面：

- **小院**：搜索歌手出发，或继续、新开一局寻声。
- **唱片店**：
  - 寻声：给定起点和终点，逐张翻开合唱唱片；
  - 完整图鉴：摊开全部合唱，可以自由漫游。
- **我的发现**：探索记录与留下的歌。

应用内没有音频播放器；记录只存在当前浏览器。美术方向是冻结的「樱下放映 · 夜场」，讲成一家夜场唱片店。

数据来源：

- [2026-09-28 扩网记录](../references/research/2026-09-28/network-expansion.md)
- [QQ 同版本核对](../references/research/2026-09-29/qq-music-links.md)
- [华语开放曲库](../references/research/2026-09-29/open-catalogue-zh.md)

“完整”只指当前精选，“最短”只指本专题收录范围。

已做：多轮 Tabbit 浏览器验证（五种模拟视口、减少动态、无 WebGL、第二个干净上下文扮演朋友）；构建通过；在线版本点开 3 条「去 QQ 音乐听」，未登录时三页都没有显示歌名，其中两页截图里有登录框。

未做：实体手机、中国大陆网络、QQ 音乐登录后的表现与播放、目标用户试用、视频录制、WorkBuddy、产品负责人评审。

## 历史参考

- [prototype/](prototype/index.html)：产品负责人 2026-09-26 的 Map 可点击原型，使用虚构艺人，无声模拟播放。[截图](assets/cover-prototype.png)与[核验记录](verification/report.md)只对应它。
- [PRD v0.2 与配套文档](../references/original-ideas/music-map-prd-v0.2/README.md)：`9ce4f3d` 的原文。
- [原始创意材料](../references/original-ideas/README.md)：双 App 与《同场》方案，用于追溯 Space 与早期取舍。
- [v0.3 私人唱片馆归档](../archive/README.md)：不作为当前界面目标。
- 文档 2.6（Music Map × Music Space）：`git show 3dd102c:product/docs/<文件>`。
- [官方资料](../references/official/2026-09-26/README.md)与 [9 月 27 日赛事复核](../references/research/2026-09-27/competition-review.md)。

当前三份文档优先于旧方案和原型代码；后续修改在三份中同步。
