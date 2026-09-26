# 真实合作精选：来源登记

日期：2026-09-27。数据版本 `real-vocal-2026-09-v1`，实现入口 `web/js/map-catalogue.js`。11 位艺人、10 首作品、10 条共同演唱关系；没有收录艺人照片、专辑封面、歌词或音频。

## 核对方法与边界

- 逐项查看唱片公司作品/新闻页面或官方频道的歌曲标题、发布说明，核对共同演唱者。合作边只表达下表两位艺人的演唱署名，不把作词、作曲、制作或 MV 出演当成共同演唱。
- 2026-09-27 对以下 10 个 MV 请求 YouTube 官方 oEmbed 元数据，均返回标题、作者与频道 URL；返回字段与下表对应。没有播放或下载视频，也没有核验目标手机、所在地区、账号条件下能否播放。
- 《一眼瞬间》和《Hello》的链接同时来自华纳官网文章内的 YouTube 嵌入；《手心的蔷薇》的 MV 来自华纳官网推荐文章内嵌视频。不是根据标题猜测视频 ID。
- 数据为人工精选的小专题，不是完整艺人曲库，不是自动推荐或音频模型结果。仅显示事实性曲名、艺人、署名、版本说明和外链；发布页本身与作品的权利仍属于原权利人。
- 这些官方 MV 位于 YouTube，可能需要登录或受地区限制。前端明确外部跳转和无内置试听。未找到可靠 QQ 歌曲直达页时，不编造 QQ ID，也不把搜索链接标成直接播放。
- 同日对 [QQ 音乐官网](https://y.qq.com/) 及其实际加载的 `Page.chunk.13d4d9f31d4be78947d0.js` 做了有界阅读；首页确有搜索框，但未在此次阅读中获得可确认的站内搜索 URL 构造方式。因此本轮没有加入猜测的 QQ 搜索链接；国内播放入口仍待核对。

## 逐项依据与聆听入口

| 作品 ID / 作品 | 两位共同演唱者 | 关系依据 | 官方 MV 与元数据发布方 |
| --- | --- | --- | --- |
| `real-bu-gai` / 不该 | 周杰伦、张惠妹 | [杰威尔《幻城》作品页](https://jvrmusic.com.tw/artist/gallery/detail/1212682331903627264?lang=zh_CN&type=) 明确主题曲二人对唱及曲目署名 | [官方 MV](https://www.youtube.com/watch?v=_VxLOj3TB5k)，周杰倫 Jay Chou，[@JVRmuzic](https://www.youtube.com/@JVRmuzic)；标题为 Jay Chou X aMEI |
| `real-far-away` / 千里之外 | 周杰伦、费玉清 | [周杰伦官方 MV 发布页](https://www.youtube.com/watch?v=ocDo3ySyHSI) 标题 feat. 費玉清，发布说明明确合唱 | [官方 MV](https://www.youtube.com/watch?v=ocDo3ySyHSI)，周杰倫 Jay Chou，[@JVRmuzic](https://www.youtube.com/@JVRmuzic) |
| `real-wont-cry` / 说好不哭 | 周杰伦、阿信 | [杰威尔合作发布说明](https://www.jvrmusic.com.tw/news/detail/1173815022741229568) 明确邀请阿信对唱；不是五月天全团的演唱署名 | [官方 MV](https://www.youtube.com/watch?v=HK7SPnGSxLM)，周杰倫 Jay Chou，[@JVRmuzic](https://www.youtube.com/@JVRmuzic) |
| `real-waiting-for-you` / 等你下课 | 周杰伦、杨瑞代 | [杰威尔单曲说明](https://www.jvrmusic.com.tw/artist/news/detail/1152141405221687296?lang=zh_CN) 明确二人合唱；聆听入口为之后发布的导演版 MV | [官方导演版 MV](https://www.youtube.com/watch?v=QQucPUfXUQQ)，周杰倫 Jay Chou，[@JVRmuzic](https://www.youtube.com/@JVRmuzic) |
| `real-sand-painting` / 画沙 | 袁咏琳、周杰伦 | [袁咏琳官方 MV](https://www.youtube.com/watch?v=rSojry19bOA) 的 ft. 署名和对唱说明；[杰威尔艺人作品介绍](https://www.jvrmusic.com.tw/artist/gallery/detail/1164843376978300928?lang=en_US&type=) 亦明确合唱《画沙》 | [官方 MV](https://www.youtube.com/watch?v=rSojry19bOA)，袁詠琳 Cindy Yen，[@cindyyenofficial](https://www.youtube.com/@cindyyenofficial) |
| `real-a-moment` / 一眼瞬间 | 张惠妹、萧敬腾 | [华纳合唱作品文章](https://www.warnermusic.com.tw/blog/posts/與蕭敬騰與合唱的必聽歌曲-蕭敬騰合唱-禁愛條款-張惠妹一眼瞬間-林俊傑hello) 明确两人合唱并嵌入所列 MV；[正式发行元数据](https://music.amazon.com/tracks/B0FMYHHCFH) 标为張惠妹 feat. 蕭敬騰、专辑 STAR | [官网文章内嵌的官方完整版 MV](https://www.youtube.com/watch?v=Egrpx5g0UgI)，Timeless Music，[@TimelessMusicAsia](https://www.youtube.com/@TimelessMusicAsia) |
| `real-hello` / Hello | 萧敬腾、林俊杰 | [华纳合唱作品文章](https://www.warnermusic.com.tw/blog/posts/與蕭敬騰與合唱的必聽歌曲-蕭敬騰合唱-禁愛條款-張惠妹一眼瞬間-林俊傑hello) 的合唱段落与正式 MV；不是仅按二人共同作曲推断 | [官方 MV](https://www.youtube.com/watch?v=dmhhfSkC-Kg)，蕭敬騰 Jam Hsiao，[@jamhsiaoofficial](https://www.youtube.com/@jamhsiaoofficial) |
| `real-dimples` / 小酒窝 | 林俊杰、蔡卓妍 | [太合官方 MV](https://www.youtube.com/watch?v=h-woMj_Vt0A) 标题明确“合唱：蔡卓妍 A-Sa”；[正式发行元数据](https://www.youtube.com/watch?v=6axxQqjRzkE) 同列二人 | [官方完整版 MV](https://www.youtube.com/watch?v=h-woMj_Vt0A)，太合音樂 Taihe Music-精選，[@TaiheMusicGroup](https://www.youtube.com/@TaiheMusicGroup) |
| `real-summer-breeze` / 被风吹过的夏天 | 林俊杰、金莎 | [太合官方 MV](https://www.youtube.com/watch?v=JbFrE_UbVyI) 标题明确“合唱：金莎”；[太合艺人作品页](https://music.taihe.com/artist/1079) 同列二人 | [官方完整版 MV](https://www.youtube.com/watch?v=JbFrE_UbVyI)，太合音樂 Taihe Music-精選，[@TaiheMusicGroup](https://www.youtube.com/@TaiheMusicGroup) |
| `real-beautiful` / 手心的蔷薇 | 林俊杰、邓紫棋 | [华纳《新地球》正式专辑页](https://www.warnermusic.com.tw/products/《新地球-genesis-發行版-─-天sky》) 明列 feat. G.E.M. 鄧紫棋和男女对唱；[华纳推荐文章](https://www.warnermusic.com.tw/blog/posts/林俊傑的歌必聽五大經典歌曲歌單推薦修煉愛情-不為誰而作的歌－手心的薔薇) 嵌入所列 MV | [官方 MV](https://www.youtube.com/watch?v=onYP5u0b3yw)，JJ Lin林俊傑，[@jjlin](https://www.youtube.com/@jjlin) |

## 稳定身份与保留范围

真实艺人：`real-jay` 周杰伦、`real-amei` 张惠妹、`real-jam` 萧敬腾、`real-jj` 林俊杰、`real-fei` 费玉清、`real-ashin` 阿信、`real-gary` 杨瑞代、`real-cindy` 袁咏琳、`real-charlene` 蔡卓妍、`real-jinsha` 金莎、`real-gem` 邓紫棋。

真实数据使用 `dataset:'real'`，原 a…i / co-* / style-* 仍属 `dataset:'fictional'`，旧 ID 不替换。真实专题没有风格边；情景示例的风格边只标为人工策展示例标签。未增补 MBID，因为本轮尚未逐一核对其录音版本与稳定身份映射。

真实合作节点不关联“回声现场”；真实专题入口只引导用户创建自己的同场空间。图谱中的艺人署名不表示他们参加用户房间、支持本产品或参与赛事。

## 可复核入口

官方 oEmbed 请求形式：`https://www.youtube.com/oembed?url=<编码后的上述watch链接>&format=json`。本次记录标题与发布方，不保存缩略图或媒体，不调用任何带密钥的接口。元数据可读与实际音视频可播放是两项不同状态。
