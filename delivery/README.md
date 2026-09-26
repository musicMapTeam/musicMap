# MVP 0.3.0 交付清单

2026-09-27。产品与展示材料已完成，评审链接尚未部署，未代填报名或提交赛事。

| 文件 | 用途 | 规格 |
| --- | --- | --- |
| [music-map-space-demo.mp4](music-map-space-demo.mp4) | 演示视频 | 94秒、1920×1080、30fps、H.264、16,162,634字节（约15.4MiB）；中文字幕、静音 |
| [cover.png](cover.png) | 参赛封面 | 1920×1080、PNG |
| `music-map-space-runtime.zip` | 本地完整运行包，不提交Git | 286,796字节，6个文件；构建页面 + Node/SQLite后端 + 运行说明；不含数据库和凭据 |
| `../dist/index.html` | 本地单文件情景演示，不提交Git | 531,809字节；无需后端可展示Map和本地Space |
| [video-source/](video-source/) | 视频和封面的可编辑源文件 | 原创HTML合成、真实页面截图、实际导出票根 |
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

GitHub Actions 同时提供 `music-map-space-demo` 和 `music-map-space-runtime` 两份构建产物，保留14天。视频和封面已保存在仓库，[重渲染方式](video-source/README.md)另有说明。

视频由实际界面截图和实际票根组成，片中明确标注为功能流程展示；并非连续录屏。素材与第三方工具来源见[来源说明](../THIRD_PARTY_NOTICES.md)。

0.3.0更新了Map、Space画面与流程说明，并重渲染视频和封面；本轮查看更新的两镜和封面。其余未改变的界面与票根沿用0.2阶段实际素材，捕捉方式和复用范围见[视频源记录](video-source/README.md)。
