# Music Map × Music Space · 完整运行包

MVP 0.2.0 · 2026-09-27

## 打开演示

1. 安装 Node.js 24 或更新版本。
2. 解压运行包，在含有 `server/`、`dist/` 和 `package.json` 的目录打开终端。
3. 执行 `node server/index.js`，打开 http://127.0.0.1:8787/ 。

这是已构建的完整运行包，不需要 `npm install`、外部数据库、音频文件或模型。保持终端运行，结束时按 Ctrl+C。

一人体验：在「同场」制卡，发送申请，切到阿遥并接受，保存或下载双联票根。两人体验：在「和朋友同场」创建房间，另一独立浏览器输入邀请码，再各自制卡、发起、接受。后者由 Node + SQLite 保存真实交换记录。

默认只监听本机。另一台设备不能使用你的 `127.0.0.1`；需要同一网络可访问的地址或部署后的评审链接。服务支持 `HOST`、`PORT`、`DATA_DIR`，对外部署需 HTTPS 和持久磁盘，详见[实施规格](https://github.com/musicMapTeam/musicMap/blob/main/product/docs/03-build-guide.md)。

## 数据

首次启动会新建 `data/music-map.sqlite`。保留该目录才能保留房间与记录；本包不附带任何已有会话、用户照片或数据库。身份保存在浏览器中，清除站点数据会失去身份访问能力，暂不支持找回。

`dist/index.html` 可单独打开，包含 Map 与本地角色情景；没有后端时，邀请码房间不可用。示例艺人、场次、歌曲和预置现场图为虚构内容，未接入音频。

源码、第三方说明和材料：[musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap)。
