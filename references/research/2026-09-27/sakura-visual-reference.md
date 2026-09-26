# Sakura Crossing 视觉参考与采用决定

研究日期：**2026-09-27**。用途：Music Map × Music Space 0.5.0 的可切换视觉主题研究；这是参考记录，不是新主题已完成或已验收的证明。实际实施状态见 [PROJECT_STATUS](../../../docs/PROJECT_STATUS.md)。

## 固定来源与读取范围

- 官方仓库：[Kenton-GMI/sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing)。
- 固定提交：[`de01898e89c7f6ab3fad93fa802f0f5ac66fbd81`](https://github.com/Kenton-GMI/sakura-crossing/tree/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81)，提交日期 2026-07-29，标题 `Sakura Crossing: initial public release`。
- 本地只读参考：`work/references/sakura-crossing/`，位于忽略目录，不作为应用源码或发布素材。
- 读取了 README 的简介、渲染、运行与许可相关部分，完整 LICENSE、package.json、`src/core/toon.js`、`post.js`，以及 `palette.js`、`outline.js`、`textures.js`、`src/world/petals.js`、`src/main.js` 的相关片段；未通读庞大街区实现，未安装、启动或测试参考项目。
- 目视查看了官方 [道口图](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/docs/hero-1-crossing.jpg) 与 [商店街图](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/docs/hero-2-shotengai.jpg)。本地路径分别为 `work/references/sakura-crossing/docs/hero-1-crossing.jpg` 和 `hero-2-shotengai.jpg`。这些图只供参考，不放入产品。
- 当前查阅的 README 未发现单独部署的在线演示地址；仓库提供本地运行说明。

## 已读事实：视觉是怎样形成的

1. **有限色阶与有颜色的阴影。** [`toon.js`](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/toon.js) 用 `MeshToonMaterial` 与手工渐变色阶形成平涂面，并给阴影偏紫的色相。它对 Three 内部 shader 文本做匹配替换；这种实现依赖具体版本，不作为本项目移植方案。
2. **轮廓有主次。** [`post.js`](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/post.js) 根据深度的二阶差分描边，远处逐渐减弱；[`outline.js`](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/outline.js) 给重点物体另加外壳轮廓。它们是 WebGL 场景方法，不能直接当 DOM 或照片滤镜使用。
3. **低饱和大面与少量招牌色。** [`palette.js`](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/palette.js) 将暖白、紫灰、浅蓝、樱粉用于大面积，红、黄、蓝、青绿用于焦点。演示图中的明暗分块与线条比单独的粉色更能决定画风。
4. **场景文字也是美术。** [`textures.js`](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/textures.js) 用 Canvas2D 绘制招牌、海报和花瓣遮罩。无需下载照片或纹理也能形成清楚的场所特征。
5. **动态来自环境。** [`petals.js`](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/world/petals.js) 用实例化平面模拟花瓣摆动和风，原版数量为 980，并依赖街区坐标；不应直接搬到产品首屏。

## 五条适配建议与本轮采用范围

下表是设计建议与已确定的实施边界，不表示五项均已实现。最初研究暂称“樱色站台”，本轮主题名称以整合方案的 **“樱下放映”** 为准；与“声浪现场”“独立刊物”并列。

| 建议 | 对 Music Map / Space 的具体处理 | 本轮采用边界 |
| --- | --- | --- |
| 1. 完整的日系平涂主题 | 暖白底、紫灰阴影、樱粉背景与少量强调色；按钮、标题、卡片、弹窗采用一致的硬边和平涂层次。切换主题保留业务状态和草稿。 | 采用视觉原则，独立设计样式与色值；现有音乐节风格继续作为可选主题。 |
| 2. Map 的音乐沿线表达 | 用站点与沿线的视觉隐喻强调当前艺人、合作路径和下一跳收获；真实合作证据继续清楚展示。 | 可用 DOM / SVG 的线条层次表达，不把普通图谱改成 3D 漫游，不改变真实合作数据。具体版式由主题实现决定。 |
| 3. Space 的原创小音乐街角 | 固定镜头的小场景，以招牌、舞台或唱片店、樱树与光影形成地点感，活动与换卡操作继续使用普通页面控件。 | 已决定使用 **Three 0.186.1** 独立编写程序场景，限定 Space hero；仅在 sakura 主题与 Space 页面创建，退出即销毁。不搬参考项目的世界、模型、纹理、shader patch 或后处理管线。 |
| 4. 轻量的环境动态 | 少量花瓣、轻微摇摆与场景光影营造空气感，避开表单和正文，支持减少动态效果。 | 独立实现；以小场景需要决定数量和渲染预算。参考项目的 980 花瓣、1.5–2 倍离屏渲染不作为性能目标或默认配置。移动端效果与性能须由实际检查记录支持。 |
| 5. 主题贯穿可保存的票根 | 单卡和双联采用主题对应的标题、线条、日期标签与印刷细节；照片、两种视角、活动信息与同意结果完整保留。 | 各主题导出由本项目独立设计与绘制；不使用参考图或日文商店招牌，不给用户照片套虚构场景或改变内容。 |

## 许可：参考项目与实际依赖分开

### Sakura Crossing：仅视觉借鉴

- 固定提交的 [LICENSE](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/LICENSE) 为 **MIT，Copyright (c) 2026 Kenton Wang**。如未来复制其代码或实质部分，需要随分发保留版权与完整许可，并记录修改。
- [README 许可段](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/README.md#licence) 明确说明 `src/` 的程序生成艺术随代码采用 MIT；`public/audio/` 的库存音乐 `bfcmusic-divine-sakura-garden-fairytale-music-283353.mp3` **不在该 MIT 范围内**。
- 本轮决定为视觉参考：**不复制其代码、原图、音频或场景**。原作 MIT 的可复用范围不等于本项目已经采用代码；本记录也不为其音频提供额外授权。
- 上游 [package.json](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/package.json) 使用 Three `^0.180.0` 与 Vite `^6.0.0`，不作为本项目依赖版本。

### Three：实际使用的运行时库

- 本项目已安装并读取本地包信息：**Three 0.186.1**，MIT，`Copyright © 2010-2026 three.js authors`。
- 官方项目：[mrdoob/three.js](https://github.com/mrdoob/three.js)；本地完整许可来源为 `node_modules/three/LICENSE`，具体版本与完整性由 `package-lock.json` 记录。
- Three 库代码会进入前端构建，发布需携带完整 MIT 许可；本地许可副本与构建中的保留由整合任务负责，本研究未执行构建或检查发布产物。
- 统一来源说明见 [THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md)。

## 检查边界

本轮仅阅读固定源代码、许可和官方静态演示图，输出采用决定。没有运行参考项目或本项目的构建、测试，没有使用浏览器验证新场景，也不据此宣称新主题性能、无障碍或移动端表现已经通过。
