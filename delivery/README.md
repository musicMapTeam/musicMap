# MVP 0.5.0 交付清单

2026-09-27。应用与运行包为 0.5.0；现有操作视频和比赛封面保留 0.4 版本，新主题实际画面另列。评审链接尚未部署，未代填报名或提交赛事。

| 文件 | 用途 | 规格 |
| --- | --- | --- |
| [music-map-space-demo.mp4](music-map-space-demo.mp4) | 0.4 实际操作演示视频 | 106秒、1920×1080、30fps、H.264、7,199,962字节（约6.87MiB）；中文字幕、无音轨，不含新主题 |
| [cover.png](cover.png) | 0.4 参赛封面 | 1920×1080、385,709字节、PNG；已目视 |
| [三套主题预览](../docs/VISUAL_THEMES.md) | 0.5 生产页面实际截图 | 三张1440×1000 PNG，声浪现场 / 樱下放映 / 独立刊物；与源码一同留档 |
| `music-map-space-runtime.zip` | 0.5 本地完整运行包，不提交Git | 468,909字节，6个文件；构建页面 + Node/SQLite后端 + 运行说明；不含数据库、用户照片或凭据 |
| `../dist/index.html` | 0.5 本地单文件情景演示，不提交Git | 1,226,498字节；含三套主题与Three完整许可，无需后端可展示真实Map和本地Space，联网照片需要完整服务 |
| [recording-source/](recording-source/) | 0.4录屏和封面的编辑源 | 原片摘要、精确剪点、FFmpeg字幕合成脚本、HTML封面、实际导出票根 |
| [video-source/](video-source/) | 0.2 / 0.3历史展示源 | 旧截图编排源；旧视频和封面可由Git历史取得，不作为本轮录屏 |
| [报名材料](../docs/competition/README.md) | 介绍与演示脚本 | 待团队补齐身份信息、访问链接和提交回执 |

## 运行完整版本

解压运行包，安装 Node.js 24+，在包根目录执行：

```sh
node server/index.js
```

打开 http://127.0.0.1:8787/ 。无需安装 npm 依赖；两个人用独立浏览器身份操作。详见包内 `RUN-ME.md`。本地服务与公开评审链接是两个不同交付状态。

## 从源码重新打包

先在仓库根目录执行 `npm ci` 和 `npm run build`，再用 PowerShell：

```powershell
Compress-Archive -Path dist,server,package.json,RUN-ME.md,THIRD_PARTY_NOTICES.md -DestinationPath delivery/music-map-space-runtime.zip -Force
```

GitHub Actions 同时提供 `music-map-space-demo` 和 `music-map-space-runtime` 两份构建产物，保留14天。视频和封面已保存在仓库，[重渲染方式](recording-source/README.md)另有说明。

## 0.5 视觉与构建

三主题切换、桌面与390px关键画面、输入保持和两套新双联 PNG 已实际操作，修正了标题越界与浅色表单 / 地图 / 记录的对比。构建产物内保留 Phosphor、QR 和 Three 的完整 MIT 许可。详细检查范围、保留的旧证据及未完成项见[项目状态](../docs/PROJECT_STATUS.md)；未重复后端全流程。

## 0.4 录屏与检查

视频来自0.4实际浏览器操作：新建活动、文件选择上传、私藏与单卡下载、另一身份入场并展示、两卡确认、接收者接受、双方留存与导出、真实合作专题。按原操作顺序剪辑，删去等待，末帧定格供阅读的部分明确标记；未添加虚假成功状态。

A森森使用127.0.0.1、B小舟使用localhost，同一浏览器的两个来源隔离身份；不代表实体双手机。上传素材是本项目AI生成的虚构现场图，不是真实观众资料。成片持续标注这些边界，素材与第三方工具见[来源说明](../THIRD_PARTY_NOTICES.md)。

FFmpeg全片解码通过；视频协作者检查片头、制卡、邀请及46/55/60/70/80/98/105秒关键帧，整合者另查看片头、70秒接受结果、98秒真实作品依据与最终封面。没有声称两名真实用户参与，也未正式提交或部署外网。

成片 SHA256：`2129B8228FFD0EB3FECA328DD407DCB6F9A49C063CFE9C800EF5BF3A8E03F15C`。
