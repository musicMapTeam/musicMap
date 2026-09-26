# 0.6：从展示页到独立音乐应用

2026-09-27。起点是用户明确反馈：当前项目像 PDF 报告，缺少精致的小众独立应用审美。0.5.1 的减字没有解决海报式首页、重页眉和纵向章节的结构问题。

## 本轮采用

- 用悬浮导轨和手机底部胶囊导航承载稳定入口，去掉横向页眉分隔。
- 同场以照片卡叠作为可选物件；舞台 / 人海原位切换，制卡与邀请是短操作。示例身份与 AI 图仍有标记。
- 音乐图谱用唱片、细关系线与轻量作品浮卡组成画布。来源与挑战按需打开，官方歌曲仍为外链，没有伪造播放器。
- 记录使用小型照片收藏和探索条目，房间以真实卡片与交换动作为主体。
- 三种材质保留：暗色唱片桌、樱下小音乐街角、纸张与荧光色唱片封套。减少页面里的大口号、边框章节和无用说明。

## 实际采用的源码

Sakura Crossing 固定提交 `de01898e89c7f6ab3fad93fa802f0f5ac66fbd81`：

- [toon.js](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/toon.js)：分层明暗与彩色阴影。
- [post.js](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/post.js)：深度描线 → 调色 → FXAA。
- [palette.js](https://github.com/Kenton-GMI/sakura-crossing/blob/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81/src/core/palette.js)：配色常量。

MIT 原文已附源码和单 HTML。适配当前 Three 0.186.1、正交相机、小场景距离与独立资源释放。模块来源及修改详见 `web/js/vendor/sakura/SOURCE.json`。音乐店模型、街区构图与交互由本项目实现；没有搬入漫游系统、原作完整街区或音频。

## 其他资料读取范围

- [Poolsuite](https://poolsuite.net/)：本轮实际打开，但页面停在启动进度 30%，未看到可交互主界面。不能把它写成已完整分析或已采用的 UI 参考；没有复制代码或素材。
- [Cosmos](https://www.cosmos.so/)：只读取了公开网站文本，未完成登录后的产品界面观察；不以此作为具体构图的验证证据。

这轮设计取舍主要来自当前产品的照片交换 / 音乐探索对象和用户反馈。构建、画面观察与交付状态统一见 [项目状态](../../../docs/PROJECT_STATUS.md)，本记录不替代用户试用或性能测量。
