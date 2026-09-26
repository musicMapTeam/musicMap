# 产品文档与应用

定稿版本：1.0 · 2026-09-26。主定位是 **音乐关系探索 + 音乐现场社交**。

## 当前只读这三份

| 文档 | 回答什么 |
|---|---|
| [产品方案](docs/01-product-plan.md) | Space 是什么、与 Map 怎么接、做哪些场景、如何设计 |
| [交付与部署](docs/02-delivery-plan.md) | 初赛交什么、要不要后端和音频、WorkBuddy 怎样用 |
| [实施规格](docs/03-build-guide.md) | 最少数据、交换状态、开发顺序、实际完成边界 |

[资源台账](data/resource-register.json)只登记当前相关来源；大数据集与模型权重均不是定稿依赖。

## 当前应用与历史参考

新版代码在 [`web/`](../web/)，当前应用版本 **0.1.0**。已实现音乐关系探索、现场卡、双角色申请 / 接受 / 拒绝 / 取消、双联记忆与本地记录。运行及构建见[根 README](../README.md)，实际检查范围见[项目状态](../docs/PROJECT_STATUS.md)。

当前是本地情景演示，没有真实音频或跨设备交换；在线发布、视频与正式提交仍待完成。

[prototype/index.html](prototype/index.html) 是旧 Map 可点击原型，艺人、歌曲和关系为示例，播放无声模拟。旧[截图](assets/cover-prototype.png)和[核验记录](verification/report.md)仅对应它。

v0.3 私人唱片馆方案及概念图已[归档](../archive/README.md)，不作为当前界面目标。

[官方资料](../references/official/2026-09-26/README.md)与[原始创意材料](../references/original-ideas/README.md)分别留存。当前三份定稿优先于旧方案和原型代码；后续修改也在这三份里同步，不继续叠加平行版本。
