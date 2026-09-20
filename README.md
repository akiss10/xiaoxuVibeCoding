# 表白页面 · 一个用 GSAP 做的多幕互动作品

一个可以直接发给对方看的网页：点一下开始，然后像短片一样一幕一幕演下去，
中间还可以点屏幕翻页、点"好呀"、点小彩蛋。

- 全程用 **GSAP** 编排（时间轴、SplitText 拆字、DrawSVG 画心、MotionPath 飞心）
- 用 **Vite** 打包，构建产物完全离线可用（没有任何外部 CDN / 字体 / 音频请求）
- 背景音乐是 **Web Audio 现场合成**的，不依赖任何音频文件，所以没有版权问题
- 所有文案都在 `src/config.js` 里，改完刷新即可

---

## 快速开始

```bash
npm install        # 第一次需要（已装过可跳过）
npm run dev        # 开发预览，改代码自动刷新
npm run build      # 打包到 dist/
npm run preview    # 预览打包结果
```

打开终端里给出的地址（默认 http://localhost:5173 ）即可。

> 建议用 Chrome / Edge，全屏观看，戴上耳机。
> 部署：把 `dist/` 整个目录丢到任意静态托管（Vercel / Netlify / GitHub Pages / 自己的服务器）即可。

---

## 改成你自己的内容

**只需要动 `src/config.js` 这一个文件。**

| 字段 | 作用 |
| --- | --- |
| `her` | 对方的名字（第一幕会一笔一笔"写"出来） |
| `me` | 你的自称（信的落款） |
| `cover.*` | 封面标题、副标题、提示语 |
| `scene1.*` | 第一幕：星夜下写名字 |
| `scene2.lines[]` | 第二幕：一句一句靠近（数组，一句一行） |
| `scene3.letter[]` | 第三幕：信的内容（数组，空字符串 `""` 表示空一行） |
| `scene3.signature` | 落款前缀 |
| `scene4.*` | 第四幕：提问。`noTaunts` 是"不要"按钮的挑衅文案，会按顺序换 |
| `scene5.*` | 第五幕：终章大字与纪念日 |
| `ui.*` | 提示语、按钮文字、彩蛋内容、点击是否冒爱心 |
| `theme.*` | 配色（会写进 CSS 变量） |
| `audio.*` | 音乐：音量、BPM、和弦进行 |

例子：

```js
export const config = {
  her: "小雨",
  me: "阿哲",
  scene3: {
    letter: ["第一次见你是在图书馆，", "", "你抬头笑了一下，", "我就把那天记住了。"],
    signature: "—— 一直喜欢你的",
  },
  scene5: { date: "2026.05.20" },
};
```

---

## 剧情结构

| 幕 | 内容 | 动画要点 |
| --- | --- | --- |
| 封面 | 需要点一次"开始" | 标题逐字翻入、SVG 爱心 DrawSVG 画出来、心跳循环、按钮光圈扩散 |
| 第一幕 | 星夜下写出名字 | SplitText 逐字 3D 翻入 + 模糊消散、名字定型后甩出光点 |
| 第二幕 | 一句一句靠近 | 逐句逐字浮现、字距收缩、心跳越跳越大 |
| 第三幕 | 一封信 | 信纸翻入、逐行逐字"写"出来、一道光扫过纸面 |
| 第四幕 | 可以做我女朋友吗 | "好呀"会变大，"不要"会躲开鼠标并换挑衅文案；点"好呀"后一颗心飞向屏幕中心 |
| 终章 | 喜欢你这件事，我终于说出口了 | 爱心弹性放大、爱心炸开、心跳呼吸光、纪念日、小彩蛋与重播 |

交互：**点屏幕任意处**翻到下一幕；顶部有进度条；右上角可以静音；键盘空格/→ 也能翻页；`Esc` 关彩蛋。

---

## 目录说明

```
index.html            页面结构（五幕的骨架）
vite.config.js        构建配置（含可选的验收脚本注入）
src/
  config.js           ★ 只改这个文件就能变成你的表白
  main.js             总控制器：拼总时间轴、HUD、翻页、彩蛋、重播
  scenes.js           五幕的 GSAP 时间轴
  starfield.js        星空背景（canvas + gsap.ticker）
  audio.js            背景音乐（Web Audio 现场合成）
  effects.js          光标跟随、花瓣、点击爱心、爱心爆炸
  style.css           视觉样式
tools/selftest.js     验收脚本（只在 SELFTEST=1 时注入，正常构建不会带上）
.dsh/skills/          从 greensock/gsap-skills 安装的官方 GSAP 技能包
```

---

## 关于 GSAP 技能包

按 `npx skills add https://github.com/greensock/gsap-skills` 装到了本项目，
共 8 个 skill（`gsap-core` / `gsap-timeline` / `gsap-plugins` / `gsap-utils` /
`gsap-performance` / `gsap-scrolltrigger` / `gsap-react` / `gsap-frameworks`）。

这个项目实际用到并遵循的建议：

- 用**时间轴 + 位置参数**编排，不用一串 `delay` 串起来
- 只动 **transform / opacity**（`x`、`y`、`scale`、`rotationX`、`autoAlpha`），不碰 `width/height/top/left`
- 高频更新的属性（鼠标跟随）用 **`gsap.quickTo()`**，不每帧新建补间
- 逐字/逐行效果用 **`SplitText`**；SVG 画线用 **`DrawSVGPlugin`**；飞行轨迹用 **`MotionPathPlugin`**
- 用 **`gsap.matchMedia()` 的等价判断**处理 `prefers-reduced-motion`：动效偏好为"减少动态"时
  自动压缩成几乎无动画，但内容照常可看
- 用 **`gsap.utils.clamp / random / toArray`** 做钳制与随机

### 踩过的三个坑（留在这里免得以后又踩）

1. **paused 的时间轴不能 add 进 paused 的时间轴** —— 父级时长会算成 0，
   于是进度条、跳幕、重播全失效。做法：所有子时间轴不设 `paused`，构造完再
   `master.pause(0)`。
2. **`repeat: -1` 的补间不能放进总时间轴** —— 会让整条时间轴的时长变成无穷大。
   做法：这类循环动效单独管理，由每一幕开始/结束时启停（`startLoop` / `stopLoop`）。
3. **GSAP 3.13+ 的 SplitText 默认不给拆出来的元素加类名** —— 要显式写
   `charsClass: "char"` / `linesClass: "line"`，否则 CSS 和调试选择器都选不中。

---

## 验收（可选）

项目自带一个无头浏览器验收脚本，会检查时间轴结构、每一幕的显隐、
进度条、彩蛋、静音和重播：

```bash
# 1) 构建时把验收脚本注入页面
#    PowerShell:  $env:SELFTEST=1; npm run build; Remove-Item Env:\SELFTEST
#    bash:        SELFTEST=1 npm run build
# 2) 起服务
npm run preview
# 3) 用无头 Chrome 跑
chrome --headless=new --disable-gpu --virtual-time-budget=60000 \
       --enable-logging=stderr --dump-dom http://localhost:4173/
# 看输出里的 PASS / FAIL / DONE errors=N
```

正常 `npm run build` 不会带上这个脚本。

---

## 无障碍与兼容

- 尊重 `prefers-reduced-motion`：系统开了"减少动态效果"时不做电影式演出，内容直接呈现
- 拆字后会给容器加 `aria-label`，屏幕阅读器读的是完整句子，不是一个个单字
- 触屏设备会自动隐藏自定义光标；手机尺寸下场景和字号都有适配
- 页面切到后台会自动暂停时间轴，不浪费电

---

用 GSAP 3.15 · Vite 8 · 无外部资源依赖
