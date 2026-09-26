# Music Map × Music Space · 视频源

2026-09-27 制作。影片使用实际运行页面截图与实际下载的双联票根，以原创音乐节排版和克制转场组成 **94 秒功能流程展示**，并非连续录屏。中文字幕，静音，无旁白、配乐或模型权重。

## 产物

- `../music-map-space-demo.mp4`：H.264，1920 × 1080，30 fps，94.000 秒，2,820 帧，15,930,421 字节，无音轨。
- `../cover.png`：1920 × 1080 独立参赛封面，来自 `cover.html`；去掉了影片说明、页码与静音标签。

## 源文件

- `index.html`：八镜视频合成与 GSAP 时间线。
- `cover.html`：独立封面合成。
- `DESIGN.md`：颜色、字体、运动规则。
- `STORYBOARD.md`：时间与分镜。
- `assets/`：实际引用的截图和票根，未经伪造页面状态。

`ticket.png` 是产品点击「保存票根图片」导出的实际产物。小满、阿遥是两个独立验收会话的示例昵称。场次、艺人、歌曲及预置现场图属于项目示例内容；影片明确区分本地 A/B 情景与联网房间，片尾注明未接真实音频、尚未公网部署。

## 重渲染

要求 Node 22+、FFmpeg、HyperFrames 可用浏览器，以及本机 Microsoft YaHei / Consolas 字体。没有复制或分发系统字体。

在当前目录执行：

```powershell
npm run check
npm run render
npm run cover
Copy-Item -LiteralPath cover-frames/frame_000003.png -Destination ../cover.png
```

脚本固定 HyperFrames **0.8.78**。视频高质量 30 fps、2 workers；封面输出 3 帧 PNG，第三帧是全部元素到位后的成稿。没有发布脚本或部署步骤。

## 实际检查

- HyperFrames `check`：运行 0 错误 / 0 警告；布局 0 错误 / 0 警告；62 项文字对比度通过。
- 八个关键时间点的 `inspect`：0 问题。该 CLI 版本已将 `inspect` 合并进 `check`，重渲染使用 `npm run check` 即可。
- 唯一 lint 警告是同一 `ticket.png` 在三个镜头中引用，已目视确认属于有意复用。
- 已查看最终 MP4 的八镜抽帧与独立封面；FFprobe 核对上述视频参数。
- 旧技能 `animation-map.mjs` 因缺少其开发依赖 `@hyperframes/producer` 无法执行；不声称该报告通过。没有给应用新增或运行自动测试。
- 检查截图、报告与官方重复脚手架已移到本次任务工作区 `work/video-production-review/`，不混入交付源码。

## 工具来源

- [HyperFrames](https://github.com/heygen-com/hyperframes)：`0.8.78`，[Apache-2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE)。通过固定版本的 CLI 制作影片与封面；源码中不附带 HyperFrames CLI 包。
- [GSAP 3.14.2 CDN 文件](https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js)：适用官方 [Standard “No Charge” GSAP License](https://gsap.com/community/standard-license/)，Copyright (c) 2025 Webflow。2026-09-27 已核对官方许可页（页面标注最后修改于 2025-05-30）；HTML 源文件引用未经修改的 CDN 脚本，HyperFrames 将其内嵌到临时渲染页面，保留库的专有声明。
- FFmpeg `9.0.1`，Node `26.7.0`；本机 Windows 渲染。未改应用根依赖。

HyperFrames 与 GSAP 仅用于视频制作，未加入 Music Map / Music Space 的运行依赖；本目录不分发其库文件，交付的 MP4 / PNG 也不包含工具运行代码。作品的合成、排版与动效编排为本项目原创，截图与票根来自实际应用。完整来源边界见根目录 `THIRD_PARTY_NOTICES.md`。
