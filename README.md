# Music Map × Music Space

**沿音乐认识新的声音，在同一场现场遇见有共同记忆的人。**

Music Map 用艺人和作品的关系组织音乐发现；Music Space 让同场观众用现场卡交换各自的视角。当前版本 **0.1.0**，为可运行的本地双角色情景演示。

## 现在可以体验

- **探索音乐**：9 位示例艺人、合作 / 风格关系、空间旋转、作品依据、留下曲目与探索记录。
- **合作挑战**：自选起终点、沿合作关系移动、回退、恢复未完成挑战，按有效路径计步。
- **进入同场**：制作照片卡、选择音乐时刻、写一句感受，自行决定是否展示。
- **交换视角**：Lin 发起具体卡片的交换，切到阿遥接受 / 拒绝；发起者也可以取消。
- **留下记忆**：同意后生成双联票根，各自保存记忆，再从音乐回到 Map。

页面会明确标示示例场次、虚构曲目与本地角色。当前没有真实音频、真人联网或跨设备同步，照片与进度保存在当前浏览器。

## 本地运行

使用 Node.js 24（见 `.nvmrc`）：

```sh
npm ci
npm run dev
```

打开命令输出的本地地址。生产构建与预览：

```sh
npm run build
npm run preview
```

构建输出 **`dist/index.html`**，图片、样式与脚本嵌入同一文件，可下载后用浏览器打开。建议开发时使用本地地址；文件模式的浏览器存储行为可能不同。更换域名或从本地文件转到网站，不会自动迁移原浏览器记录。

每次推送 `main`，GitHub Actions 会构建并保存名为 **music-map-space-demo** 的产物，保留 14 天。打开 [Actions](https://github.com/musicMapTeam/musicMap/actions/workflows/build.yml) 中成功的运行即可下载。仓库同步不等于网站已发布。

### 两分钟体验

1. 从林间进入“回声现场”，点击“制作我的现场卡”。
2. 选舞台照片和返场，写一句话；卡片默认仅自己可见。
3. 展示到本场，用自己的卡向阿遥发出交换申请。
4. 切换到阿遥，查看申请并接受；保存双联记忆。
5. 去“我的记录”打开记忆，或回到 Map 继续探索。

WorkBuddy 可尝试发布构建后的单 HTML；本轮未操作发布。正式参赛仍需在线链接、视频和封面，见[交付计划](product/docs/02-delivery-plan.md)。

## 目录与协作

| 入口 | 用途 |
| --- | --- |
| `web/` | 当前应用：Map、Space、公共外壳与素材 |
| [项目状态](docs/PROJECT_STATUS.md) | Todo / Doing / Done、完成证据与下一步 |
| [协作指南](CONTRIBUTING.md) · [代理约定](AGENTS.md) | 文件职责、小步提交、必要检查 |
| [更新记录](CHANGELOG.md) | 版本变化 |
| [第三方说明](THIRD_PARTY_NOTICES.md) | 开源版本、许可与生成素材来源 |
| `product/prototype/` | 旧 Map v0.2 原型，保留作历史参考 |

当前采用 HTML / CSS / JavaScript ES 模块，Vite 负责开发和单文件构建。只安排构建及改动相关的人工检查，没有增加测试框架、后端或模型依赖。

## 产品与来源

1. [产品方案](product/docs/01-product-plan.md)：定位、主流程、产品规则与视觉。
2. [交付与部署](product/docs/02-delivery-plan.md)：比赛要求、WorkBuddy、音频、材料与演示脚本。
3. [实施规格](product/docs/03-build-guide.md)：技术、数据、状态与实际完成边界。

[官方资料留档](references/official/2026-09-26/README.md) · [原始产品材料](references/original-ideas/README.md) · [旧方案归档](archive/README.md)

产品文档版本为 **1.0 / 2026-09-26**；应用版本与文档版本分别记录。
