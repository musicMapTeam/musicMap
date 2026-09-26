# 界面克制：原生滚动与渐进展示

研究日期：**2026-09-27**。范围限定为 **OverlayScrollbars、SimpleBar、Codrops / Daniel Velasquez 的 Grid-to-Fullscreen** 三个项目，只读官方仓库、官方教程及 npm 发布包。用户本轮要求是减少页面说明文字与粗重滚动条，同时允许直接采用合适的开源代码。

**采用建议：直接引入 `overlayscrollbars@2.16.0`，用于确有溢出的面板；页面以主画面、一个主动作和按需展开的细节组织。** 原生滚轮、触控和键盘滚动继续由浏览器处理。主页面不为装下过多介绍而设置多个滚动盒，也不通过永久裁切溢出来实现“一屏”。

本研究未安装依赖、修改应用或第三方声明，没有构建、测试或浏览器操作。以下为采用依据与接入建议，不表示应用已经完成接入或通过检查。

## 1. 两个滚动库：选择 OverlayScrollbars

| 项目 | 已核实版本与许可 | 适用范围与采用决定 |
| --- | --- | --- |
| [OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars) | **2.16.0**，npm 发布于 **2026-05-09**；MIT，Copyright (c) 2022 Rene Haas；无 npm 运行时依赖 | 保留原生滚动，支持 body、指定现有 viewport、自动更新与显式销毁；选择它作为一个统一的小模块，首先应用在长面板 / 对话框。 |
| [SimpleBar](https://github.com/Grsmto/simplebar) | **6.3.3**，npm 发布于 **2025-11-09**；MIT，Copyright (c) 2015 Jonathan Nicol；依赖 `simplebar-core ^1.3.2` | 同样保留原生 `overflow:auto`，适合内部小滚动区。官方 README 明确不建议用于 body；体积更小，但本轮不与 OverlayScrollbars 重复引入。 |

版本来源：[OverlayScrollbars npm 2.16.0 元数据](https://registry.npmjs.org/overlayscrollbars/2.16.0)、[SimpleBar npm 6.3.3 元数据](https://registry.npmjs.org/simplebar/6.3.3)。日期来自各包 registry 的 `time` 字段，均为 UTC 发布日期。

### 固定源码与实际读取

- OverlayScrollbars 固定提交 [`dfa819688a529db0085c6416a94e816bfbaeaf29`](https://github.com/KingSora/OverlayScrollbars/tree/dfa819688a529db0085c6416a94e816bfbaeaf29)。读取了 [README 的初始化 / 样式 / 选项](https://github.com/KingSora/OverlayScrollbars/blob/dfa819688a529db0085c6416a94e816bfbaeaf29/README.md)、[实例与销毁源码](https://github.com/KingSora/OverlayScrollbars/blob/dfa819688a529db0085c6416a94e816bfbaeaf29/packages/overlayscrollbars/src/overlayscrollbars.ts)、[选项类型](https://github.com/KingSora/OverlayScrollbars/blob/dfa819688a529db0085c6416a94e816bfbaeaf29/packages/overlayscrollbars/src/options.ts)以及 [MIT 许可](https://github.com/KingSora/OverlayScrollbars/blob/dfa819688a529db0085c6416a94e816bfbaeaf29/LICENSE)。源码中实例通过目标元素登记，`destroy()` 负责解除实例与生成结构；现有 viewport 可以显式传入。
- SimpleBar 固定提交 [`dfbb9def64f3408b693859764922c454d1e86df9`](https://github.com/Grsmto/simplebar/tree/dfbb9def64f3408b693859764922c454d1e86df9)。读取了 [包 README](https://github.com/Grsmto/simplebar/blob/dfbb9def64f3408b693859764922c454d1e86df9/packages/simplebar/README.md)、[入口源码](https://github.com/Grsmto/simplebar/blob/dfbb9def64f3408b693859764922c454d1e86df9/packages/simplebar/src/index.ts)与 [MIT 许可](https://github.com/Grsmto/simplebar/blob/dfbb9def64f3408b693859764922c454d1e86df9/LICENSE)。实现扩展 `SimpleBarCore`，创建轨道节点，以 MutationObserver 管理声明式实例，并提供 `unMount()`。官方包 `simplebar-core@1.3.2` 的依赖包括 `lodash` 与 `lodash-es`；不能据此推断它们会全部进入生产包。

### 体积口径

从 npm 官方 registry 指向的 tarball **在内存中解包读取**发布文件，使用 gzip level 9 计算压缩尺寸；没有执行库代码、打包或写入应用。这些是独立发布文件的尺寸，**不是 Music Map 构建增量**。

| 发布文件 | 原始字节 | gzip 字节 |
| --- | ---: | ---: |
| OverlayScrollbars `browser/overlayscrollbars.browser.es6.min.js` | 30,803 | 14,864 |
| OverlayScrollbars `styles/overlayscrollbars.min.css` | 13,968 | 2,578 |
| OverlayScrollbars 实际 ESM 入口 `overlayscrollbars.mjs`，未压缩 | 74,785 | 20,456 |
| SimpleBar `dist/simplebar.min.js` | 27,246 | 7,070 |
| SimpleBar `dist/simplebar.min.css` | 3,269 | 904 |

体积上 SimpleBar 更小。选择 OverlayScrollbars 的理由是原生 JS 接入、现有容器控制和生命周期更适合当前页面重绘方式；不宣称它最小。Vite 使用 ESM 入口并按实际引用构建，初期只导入 `OverlayScrollbars` 与 CSS，不注册 ClickScroll、旧浏览器兼容或框架包装等额外插件。源码仓库的 package.json 指向 TypeScript 源码，npm 发布包的 `exports` 则指向 `.mjs` 和发布 CSS；安装发布包即可，无需自行编译上游仓库。

## 2. 最小接入方式

```sh
npm install --save-exact overlayscrollbars@2.16.0
```

```js
import 'overlayscrollbars/overlayscrollbars.css';
import { OverlayScrollbars } from 'overlayscrollbars';

// scrollHost 是确实需要内部滚动的区域，不是页面所有容器。
const instance = OverlayScrollbars(scrollHost, {
  scrollbars: {
    theme: 'os-theme-music',
    visibility: 'auto',
    autoHide: 'leave',
    autoHideDelay: 650,
    dragScroll: true,
    clickScroll: false,
  },
});

// 路由销毁或重建该容器前处理；不在每次轮询时重复挂载。
function disposeScroll() {
  instance.destroy();
}
```

```css
.os-theme-music {
  --os-size: 6px;
  --os-padding-perpendicular: 1px;
  --os-track-bg: transparent;
  --os-handle-border-radius: 999px;
  --os-handle-bg: var(--scroll-thumb, rgb(112 221 207 / 28%));
  --os-handle-bg-hover: var(--scroll-thumb-hover, rgb(112 221 207 / 48%));
  --os-handle-bg-active: var(--scroll-thumb-active, rgb(112 221 207 / 65%));
  --os-handle-interactive-area-offset: 3px;
}
```

三主题分别给滑块变量赋色，保留细线、透明轨道和足够的拖动命中区。使用自动隐藏，不永久移除可拖动入口。若接入改变实际滚动元素，保存滚动位置与监听时使用 `instance.elements().scrollOffsetElement` / `scrollEventElement`，或初始化时明确复用现有 viewport，避免继续读错原容器的 `scrollTop`。

**本轮接入顺序：** 先定位当前粗条出现的长说明 / 记录 / 票根区域，减少不必要的常驻内容，再给剩余的真正滚动区接入一个实例。body 支持是可用能力，不意味着必须接管整页。Map 图、短表单、hero 不因此新增内层滚动；移动端仍可自然滑动，焦点内容应保持可到达。

接入后按项目原流程查看鼠标、键盘与手机相关路径即可，不为此增加测试框架。引入实际代码时由实施者将精确版本与完整 MIT 许可加入第三方声明及发布产物，本研究不代填“已采用”。

## 3. 一个视觉参考：点开以后，再展开内容

**Codrops / Daniel Velasquez：Creating Grid-to-Fullscreen Animations with Three.js**，官方教程发布于 **2019-05-22**。[教程](https://tympanus.net/codrops/2019/05/22/creating-grid-to-fullscreen-animations-with-three-js/) · [官方 Demo](https://tympanus.net/Tutorials/GridToFullscreenAnimations/) · [作者仓库固定提交 `884fe4f`](https://github.com/Anemolo/GridToFullscreenAnimations/tree/884fe4fbb1192a1013cccc51e580b4c14f9df480)。

已读 [README](https://github.com/Anemolo/GridToFullscreenAnimations/blob/884fe4fbb1192a1013cccc51e580b4c14f9df480/README.md)、[`index.html`](https://github.com/Anemolo/GridToFullscreenAnimations/blob/884fe4fbb1192a1013cccc51e580b4c14f9df480/index.html)、[`basicDemo.js`](https://github.com/Anemolo/GridToFullscreenAnimations/blob/884fe4fbb1192a1013cccc51e580b4c14f9df480/js/basicDemo.js)和 [`GridToFullscreenEffect.js`](https://github.com/Anemolo/GridToFullscreenAnimations/blob/884fe4fbb1192a1013cccc51e580b4c14f9df480/js/GridToFullscreenEffect.js) 的点击、展开与返回实现。普通卡片保留为 HTML，选中后放大一张图，视觉注意力转到当前对象；单个 WebGL 平面承担转场，返回时恢复网格。这里值得采用的是展示层级。

**许可并非 MIT。** README 使用自己的示例资源条款：允许在个人或商业项目中集成 / 改造，但限制把资源原样重新发布或插件化出售，并要求分别考虑附带库与图片的许可。仓库使用旧版 Three、TweenLite / EasePack、imagesLoaded，页面还引用 Typekit 与外部摄影。它是可读源码的官方示例，不能统一当成宽松开源依赖。**本轮只借鉴交互，不复制其代码、照片、字体或整套依赖。**

### 对 Music Map / Space 的具体采用

1. **Space 首屏保留一张主画面、一句主张、一个主动作。** 创建 / 加入与本地体验保留清晰入口；权限、流程解释放到操作发生的位置，避免整屏把功能逐项讲完。场景不是新的可滚动说明页。
2. **卡墙先看照片、名字和一个视角。** 点击卡片再展开感受、具体共同点和申请按钮；确认时再并列两卡。两张卡确认与“对方接受”这些决定性信息仍明确可见。
3. **Map 先看当前艺人与这一步的作品。** 展开作品时展示版本、共同演唱署名和来源链接；将长篇图谱说明收进按需打开的“依据”，不堆在主画面。
4. **结果先看双联与保存。** 技术解释、数据边界放到相关帮助或记录说明；保留实际隐私选择、出错反馈和 AI 示例标识。用短标题与状态代替重复段落，不以删文案为由移除影响用户选择的信息。

这些是本项目的布局建议，可用现有 DOM、原生 dialog / details 与 CSS 过渡实现。无需把 2019 年示例的 WebGL 特效管线迁入已经使用 Three 0.186.1 的应用。短屏和长文内容继续允许自然滚动，“沉浸一屏”是首屏内容取舍，不是锁住视口。

## 结论与尚未验证点

- **直接采用候选：OverlayScrollbars 2.16.0。** 版本、MIT、零运行时依赖、发布入口、相关 API 和发布文件尺寸已读。
- **备选：SimpleBar 6.3.3。** 若最终只做一个小型内部滚动区且更重视尺寸，可以重新比较；本轮不同时安装两个库。
- **视觉参考：Codrops 的卡片到全屏展开。** 借鉴渐进展示，现有栈独立实现；未复制其资源。
- 未运行三个项目或当前应用，未在浏览器体验 Demo，未测真实构建增量、滚动手感、焦点与移动端表现。这些由接入后的实际小范围检查决定，不把文档与源码阅读当作运行通过。
