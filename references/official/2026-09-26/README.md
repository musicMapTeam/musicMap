# 腾讯音乐高校 AI Hackathon — 官方资料留档

采集日期：**2026-09-26（Asia/Shanghai）**。本次主要采集时间为北京时间 22:38–22:44；各 JSON 保留精确 UTC 时间。网站及表格均未显示可核实的统一发布日期，采集日期不等于发布日期。

这是从官方页面当次实际读取的档案，包含官网原始 HTML、页面原文、六张工作表的公式栏原文和截图。**腾讯文档没有成功导出原始 XLSX**；请勿把此目录称为原始工作簿备份，也勿把正文提取稿视为官方发布的 Markdown 文件。

## 官方来源

- 官网：[Build With AI · 腾讯音乐首届高校 AI Hackathon](https://join.tencentmusic.com/h5/ai-hackathon/index.html)
- 官方赛题包：[腾讯音乐首届高校AI Hackathon·官方赛题包](https://saas.docs.qq.com/sheet/DR2VHa0JGT3ZGVFNKTmpybUdJ?tab=000001)。此链接同时存在于官网“查看官方赛题包”入口，已记录在 `website/visible-page.json` 的 `links` 中。
- 官方报名与提交入口链接也记录在上述 JSON；本次未打开、填写或提交表单。

## 快速阅读

| 官方工作表 | 本地原文 | 主要截图 | 本次读取覆盖 |
| --- | --- | --- | --- |
| 🏠目录&导航（000001） | [单元格原文](spreadsheet/01-navigation-cells.md) | [顶部海报](spreadsheet/01-navigation-top.png)、[导航及底部](spreadsheet/01-navigation-overview-1.png) | A1:C15；关键文字 A4:A6、A8:B13；海报和群二维码由截图保存 |
| 📄初赛提交指引（000002） | [单元格原文](spreadsheet/02-submission-cells.md) | [顶部](spreadsheet/02-submission-cells-1.png)、[下半部](spreadsheet/02-submission-bottom.png) | A1:C11；包含完整 C8 两个填写示例；C7 赛道图片、C11 封面示例见截图 |
| 🌍赛题说明（000003） | [单元格原文](spreadsheet/03-topics-cells.md) | [全表](spreadsheet/03-topics-cells-2.png) | A1:F6，合并单元格去重；下方显示空白行 |
| 🏆赛程&奖项说明（000004） | [单元格原文](spreadsheet/04-schedule-cells.md) | [全表](spreadsheet/04-schedule-top-1.png) | A1:C18；内容止于第 16 行，含日期、奖项人数及奖金 |
| 📈评审标准（000005） | [单元格原文](spreadsheet/05-scoring-cells.md) | [全表](spreadsheet/05-scoring-cells-1.png) | A1:B6；3 个评审维度，内容止于第 5 行 |
| 🙋常见参赛问题Q&A（000006） | [单元格原文](spreadsheet/06-faq-cells.md) | [顶部 Q1–Q9](spreadsheet/06-faq-cells-1.png)、[中部 Q8–Q14](spreadsheet/06-faq-middle-1.png)、[底部 Q12–Q16](spreadsheet/06-faq-bottom-1.png) | B1、B2、B3 全部 Q1–Q11、B4 全部 Q12–Q16；另读周围空单元格；Q14 内嵌图片另作人工转写 |

官网阅读入口：

- [页面全文](website/page-text.txt)：展开全部 5 个“详细规则”栏目后读取 `body.innerText`，不改写正文。
- [完整展开长截图](website/complete-expanded-page-1.png)：1083 × 7553 PNG；请用图片查看器放大阅读。
- [作品要求局部截图](website/requirements-visible-1.png)：清晰显示初赛和决赛材料要求。
- [原始 HTML](website/index-original.html)：公开 HTTP GET 响应原样保存，HTTP 200；外部图片等资源没有打包，离线打开不保证完整外观。
- [HTTP 来源记录](website/http-metadata.json)、[浏览器提取记录](website/complete-expanded-page.json)。

## 方法与文件解释

1. 沿用用户指定的 Tabbit 实例，通过正常浏览器 UI 打开官网及赛题表。原来留存的赛题表标签不在当时库存中，因此本次新开官方 URL，没有登录操作。
2. 表格是 Canvas 渲染。通过工作表标签切换、地址框选择单元格，读取公式栏 DOM 中当前单元格的原文；未读取隐藏应用内部数据，也未编辑、复制生成副本或分享文档。
3. 每张 `*-cells.json` 保存请求地址 `requestedCell`、应用显示的实际地址 `selectedCell`、原文 `text`、来源 URL 和时间。合并区域可能多次返回相同起始单元格，保留在 JSON 中；对应 Markdown 仅按实际地址去重、略去空白单元格并增加定位标题。
4. FAQ 标题 B1/B2 在第二次选择时读取，原始记录位于 `01-navigation-overview.json` 的 `faqHeader` 字段；已合并进入 FAQ 可读稿。`coverage-counts.json` 记录各表读取数量。
5. 截图未做裁剪、拼接、重绘或去水印；以浏览器输出的 PNG 原文件复制留档。截图中的页面水印、群二维码、页面头像和会话状态属于当时 UI，不是规则正文。
6. `03-topics-cells-1.png` 实际是切换工作表前保存的目录顶部截图，另复制为清晰命名的 `01-navigation-top.png`；`03-topics-cells-2.png` 才是赛题说明。原记录保留，避免丢失采集次序。
7. `website/visible-page*` 是官网首次加载、规则尚未展开的记录，首屏部分图片当时尚未载入；`expanded-page*` 为展开后的中间记录；**最终完整记录以 `complete-expanded-page*` 为准**。原始过程文件保留，不混称最终全页。

## 导出限制与覆盖边界

- 腾讯文档显示“只能查看”；正常文件菜单中的“导出为”具有 `aria-disabled="true"`，下载和打印也呈灰色。证据：[文件菜单截图](spreadsheet/export-menu-1.png)，以及 `02-submission-cells.json` 的 `exportControls`。
- 因此没有 XLSX、PDF、原始腾讯文档文件或完整可重建的表格对象；本次留档是“截图 + 当前可见公式栏原文”，不包含修订历史、评论、隐藏表、所有单元格格式和链接对象元数据。
- 六个可见工作表均覆盖了其主要内容区；截图范围和读取范围如上。这里的“完整”限于所列单元格中实际可读的正文，不声称遍历了无限空行、隐藏单元格或服务器端全部结构。
- 图片没有单元格文本，公式栏可能返回空白；其内容以截图为准。FAQ Q14 的任务表另见 [图片文字人工转写](spreadsheet/image-text-transcription.md)，明确与 DOM 原文区分。
- 表格原文有不可见分隔符、连续空行、全半角混用，正文提取稿保留这些内容。日期单元格的公式栏可能显示 `2026/9/22`，而画布显示 `9月22日`；两种显示均留证。
- 正常权限下没有登录、下载音乐、调用音乐接口或绕过访问限制；音乐歌单链接只保留为 FAQ 原文，不代表本档案保存了歌单条目或音频授权文件。

## 两个关键问题的证据定位

以下是对原文的阅读结论，并非新增官方规则；原文保存在上面的文件中。

### 初赛是否必须完整前后端？

官网“作品要求”明确将初赛的产品方案简介（含问题洞察、解决方案、Demo）与决赛的完整产品方案（成功部署上线）、路演 PPT 区分。FAQ B3 / Q3 又说明可以用 AI Coding 制作可演示的页面、功能、原型，强调初赛“想法优先”。**本次读取的官方规则没有出现“初赛必须完整前后端”这一条件。**

这也不等于可以提交无法展示的空想：提交指引 B9 要求浏览器可直接访问的在线链接；评分标准 B4 考察 Demo 完成度及可落地性。

### 是否强制真实音频播放？

FAQ B3 / Q11 以“如果在 Demo 中需要使用音乐素材的”引出使用范围，属于条件性音乐素材条款。**本次读取的官方规则没有将“真实音频播放/试听”列为所有项目统一必交功能。** 音乐体验项目是否值得实现试听，属于项目设计与说服力判断。

### 必须保留的提交口径差异

- FAQ B4 / Q13 写的是“原型截图、演示视频/Demo链接(二选一)”。
- 初赛提交指引分列“作品Demo链接”（A9/B9）和“上传作品演示视频”（A10/B10），并对可访问性、3 分钟和 500M 作出要求。

本档案同时保留两处，没有擅自合并成唯一官方要求。当前项目如何准备材料，见 [交付计划](../../../product/docs/02-delivery-plan.md)；该计划是团队决策，不是官方原文。

## 校验与生命周期

- [SHA256SUMS.txt](SHA256SUMS.txt) 覆盖本目录除校验清单自身之外的全部文件，路径相对本目录；清单在文档和截图写入后生成。
- SHA256 用于发现本地文件后续变化，不证明官方数字签名，也不替代未来规则更新核对。
- Tabbit 任务已正常 `finish`，`keep=true`、`forcedCleanup=false`、`closedTabIds=[]`；官方网页及赛题表保留供用户复查，未关闭用户原有标签。
- 当次保留组：`B793E40F79ACED7214744C262C389846`。没有提交 Git commit 或推送。
