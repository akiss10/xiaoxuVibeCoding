/**
 * ============================================================
 *  表白页 · 总控制器
 * ============================================================
 *  一条总时间轴（master）串起：封面 → 五幕 → 终章
 *  · 点击任意处 = 跳到下一幕（像翻页）
 *  · 顶部进度条、右上角声音开关
 *  · 时间轴驱动所有场景的淡入淡出，所以"往回拖 / 重播"也不会错乱
 */
import gsap from "gsap";
import "./style.css";
import { config } from "./config.js";
import { createStarfield } from "./starfield.js";
import { createAudio } from "./audio.js";
import { createCursor, createPetals, createClickHearts, heartExplosion } from "./effects.js";
import {
  buildCover,
  buildScene1,
  buildScene2,
  buildScene3,
  buildScene4,
  buildScene5,
  startLoop,
  stopLoop,
  stopAllLoops,
  stopSceneLoops,
  resetSceneVisuals,
} from "./scenes.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 场景容器的显示切换。
 * 不用 autoAlpha：它在"只改透明度、不改 visibility"的补间路径里会让两者对不上，
 * 出现 opacity=1 但 visibility:hidden 的诡异状态（文字整段不显示）。
 * 这里显式写 visibility，并且做成幂等的，重复调用也安全。
 */
const visibleNow = new Set();

function setSceneVisible(node, on, instant = false) {
  if (!node) return;
  if (on && visibleNow.has(node)) return;
  if (!on && !visibleNow.has(node)) return;
  if (on) visibleNow.add(node);
  else visibleNow.delete(node);

  if (instant) {
    gsap.set(node, { visibility: on ? "inherit" : "hidden" });
    return;
  }
  gsap.to(node, { visibility: on ? "inherit" : "hidden", duration: 0.01 });
}

/* ---------------- 主题色：把 config 里的配色灌进 CSS 变量 ---------------- */
function applyTheme(theme) {
  const root = document.documentElement;
  const map = {
    "--bg-deep": theme.bgDeep,
    "--bg-warm": theme.bgWarm,
    "--rose": theme.rose,
    "--gold": theme.gold,
    "--text": theme.text,
    "--text-dim": theme.textDim,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) root.style.setProperty(k, v);
  }
}

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);

const el = {
  // 封面
  cover: $("scene-cover"),
  coverTitle: $("coverTitle"),
  coverSub: $("coverSub"),
  coverTip: $("coverTip"),
  coverHeart: document.querySelector(".cover-heart"),
  coverHeartPath: $("coverHeartPath"),
  coverHeartSvg: document.querySelector(".cover-heart svg"),
  enterBtn: $("enterBtn"),
  enterRing: document.querySelector(".enter-ring"),

  // 各幕
  s1: $("scene-1"),
  s1Eyebrow: $("s1Eyebrow"),
  s1Pre: $("s1Pre"),
  s1After: $("s1After"),
  herName: $("herName"),

  s2: $("scene-2"),
  s2Eyebrow: $("s2Eyebrow"),
  beatLines: $("beatLines"),
  beatLineEls: [], // populate() 之后填
  pulseHeart: $("pulseHeart"),

  s3: $("scene-3"),
  s3Eyebrow: $("s3Eyebrow"),
  letter: $("letter"),
  letterPaper: document.querySelector(".letter-paper"),
  letterSheen: $("letterSheen"),
  letterBody: $("letterBody"),
  s3Sign: $("s3Sign"),
  signName: $("signName"),

  s4: $("scene-4"),
  s4Eyebrow: $("s4Eyebrow"),
  question: $("question"),
  btnYes: $("btnYes"),
  btnNo: $("btnNo"),
  answerRow: $("answerRow"),
  whisper: $("whisper"),
  heartPlane: $("heartPlane"),

  s5: $("scene-5"),
  s5Eyebrow: $("s5Eyebrow"),
  finalBig: $("finalBig"),
  finalHeart: $("finalHeart"),
  finalDate: $("finalDate"),
  btnSecret: $("btnSecret"),
  btnReplay: $("btnReplay"),

  // HUD
  hud: $("hud"),
  railFill: $("railFill"),
  railDots: gsap.utils.toArray(".rail-dot"),
  btnSound: $("btnSound"),
  skipHint: $("skipHint"),

  // 彩蛋
  secret: $("secret"),
  secretLabel: $("secretLabel"),
  secretTitle: $("secretTitle"),
  secretBody: $("secretBody"),

  // 光标
  cursor: $("cursor"),
  cursorDot: $("cursorDot"),
  mouseGlow: $("mouseGlow"),
};

/* ---------------- 把 config 的文字灌进页面 ---------------- */
function text(key, value) {
  const node = el[key];
  if (!node) throw new Error(`[配置渲染] 页面里找不到元素：${key}`);
  node.textContent = value;
}

function populate() {
  const c = config;

  text("coverTitle", c.cover.title);
  text("coverSub", c.cover.sub);
  text("coverTip", c.cover.tip);

  text("s1Eyebrow", c.scene1.eyebrow);
  text("s1Pre", c.scene1.pre);
  text("herName", c.her);
  text("s1After", c.scene1.after);

  text("s2Eyebrow", c.scene2.eyebrow);
  el.beatLines.innerHTML = "";
  el.beatLineEls = c.scene2.lines.map((line) => {
    const p = document.createElement("p");
    p.className = "beat-line";
    p.textContent = line;
    el.beatLines.appendChild(p);
    return p;
  });

  text("s3Eyebrow", c.scene3.eyebrow);
  // 段落各自成一个块，空字符串当成"真正的空行"元素 —— 这样不依赖换行符，
  // 也不用担心 SplitText 把连续换行折叠掉。
  el.letterBody.innerHTML = "";
  c.scene3.letter.forEach((line) => {
    if (line.trim() === "") {
      const gap = document.createElement("span");
      gap.className = "letter-gap";
      gap.setAttribute("aria-hidden", "true");
      el.letterBody.appendChild(gap);
      return;
    }
    const p = document.createElement("p");
    p.className = "letter-entry";
    p.textContent = line;
    el.letterBody.appendChild(p);
  });
  el.letterBody.setAttribute("aria-label", c.scene3.letter.join(" "));
  text("s3Sign", c.scene3.signature);
  text("signName", c.me);

  text("s4Eyebrow", c.scene4.eyebrow);
  text("question", c.scene4.question);
  text("btnYes", c.scene4.yes);
  text("btnNo", c.scene4.no);

  text("s5Eyebrow", c.scene5.eyebrow);
  text("finalBig", c.scene5.big);
  text("finalDate", c.scene5.date);

  text("skipHint", c.ui.skipHint);
  text("btnSecret", c.ui.secretLabel);
  text("btnReplay", c.ui.replay);
  text("secretLabel", c.ui.secretLabel);
  text("secretTitle", c.ui.secretTitle);
  text("secretBody", c.ui.secretBody);
}

/* ---------------- 运行环境 ---------------- */
const audio = createAudio();
const cursor = createCursor({
  cursor: el.cursor,
  dot: el.cursorDot,
  glow: el.mouseGlow,
});

createStarfield($("starfield"));
createPetals($("petals"), window.innerWidth < 640 ? 9 : 16);
if (config.ui.clickHearts) createClickHearts();

/* ---------------- 场景运行期的公共能力 ---------------- */
const state = { index: -1, done: false };

const ctx = {
  burst: (x, y, n, opts = {}) => heartExplosion(x, y, n, opts),
  chime: (up) => audio.chime(up),
  setHot: (hot) => cursor.setHot(hot),
  whisper: (text) => {
    el.whisper.textContent = text || "";
    gsap.fromTo(el.whisper, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6 });
  },
  isDone: () => state.done,
};

const sceneEls = [el.s1, el.s2, el.s3, el.s4, el.s5];
const hotRects = [];

/* ---------------- 声音开关 ---------------- */
function paintSound(muted) {
  el.btnSound.textContent = muted ? config.ui.soundOff : config.ui.soundOn;
  el.btnSound.setAttribute("aria-label", muted ? "打开声音" : "关闭声音");
}
paintSound(audio.muted);

el.btnSound.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!audio.supported) return;
  await audio.ensure();
  paintSound(audio.toggle());
});

/* ---------------- 进度条 ---------------- */
function setRail(p) {
  gsap.set(el.railFill, { width: `${gsap.utils.clamp(0, 100, p * 100)}%` });
  // 有 5 幕，所以把进度切成 5 段；之前 clamp 到 4 会导致永远只亮第一个点
  const active = gsap.utils.clamp(0, el.railDots.length - 1, Math.floor(p * el.railDots.length));
  el.railDots.forEach((dot, i) => dot.classList.toggle("is-on", i === active));
}

/** 封面那两个"一直在循环"的心跳/光圈；开场时启动，重复调用也安全 */
function startCoverLoops() {
  if (reduce) return;
  startLoop("coverHeart", {
    target: el.coverHeart,
    to: { scale: 1.08, duration: 0.42, repeat: -1, yoyo: true, ease: "sine.inOut" },
  });
  startLoop("coverRing", {
    target: el.enterRing,
    to: { scale: 1.25, autoAlpha: 0.9, duration: 1.6, repeat: -1, ease: "power1.out" },
  });
}

/**
 * 把封面摆成"入场动画已经演完"的样子。
 *
 * 为什么必须显式做：主时间轴暂停在 0 时，GSAP 认为第 0 帧就是补间的**起始状态**，
 * 于是 from()/fromTo() 的起始值（透明、缩小、模糊）会一直压在元素上 ——
 * 打开页面就只有背景，一个字都看不见。所以构造完直接把封面设成完成态。
 */
function showCoverReady() {
  visibleNow.add(el.cover);
  gsap.set(el.cover, { opacity: 1, visibility: "inherit" });
  gsap.set(el.coverTitle.querySelectorAll(".char"), {
    autoAlpha: 1,
    y: 0,
    rotationX: 0,
  });
  gsap.set([el.coverSub, el.enterBtn, el.coverTip, el.coverHeart], {
    autoAlpha: 1,
    x: 0,
    y: 0,
    scale: 1,
  });
  if (!reduce) gsap.set(el.coverHeartPath, { drawSVG: "0% 100%" });
  gsap.set(el.enterRing, { autoAlpha: 0 });
}

/* ---------------- 组装总时间轴 ---------------- */
let master = null;
let sceneStarts = [];
let intro = null;
let scene4 = null; // 第四幕的控制器（启停"不要"按钮的逃跑逻辑）
const FADE = 0.7;

function build() {
  if (master) master.kill();
  stopAllLoops();
  hotRects.length = 0;
  sceneStarts.length = 0; // 重建时必须清空，否则起点表会累积成两份
  state.index = -1;

  // 注意：总时间轴先不要设 paused。
  // GSAP 的一个坑：把 paused 的时间轴 add() 进 paused 的时间轴，父级时长会算成 0，
  // 于是"跳幕/进度条/重播"全部失效。所以子时间轴一律不 paused，
  // 由父级管播放；构造过程中若父级自己跑起来了，末尾再 pause 回来。
  master = gsap.timeline({
    onStart: startCoverLoops,
    onUpdate: () => {
      setRail(master.progress());
      // "不要"按钮在乱跑，所以每帧重新量一遍可点区域
      hotRects.length = 0;
      measure();
    },
    onComplete: () => {
      state.done = true;
      gsap.to(el.skipHint, { autoAlpha: 0, duration: 0.6 });
    },
  });

  /* --- 封面 --- */
  intro = buildCover(el).tl;
  master.add(intro, 0);
  // 注意：这里不要再 push 一个 0。
  // sceneStarts 现在的含义是"每一幕的起点"，第一幕的起点由下面的游标写入。
  // 旧写法在这里给封面占了一项，改成游标法后没删，会让整张表多一项、全体右移，
  // 结果就是第四幕被算到第三幕的位置上（点进去看不到"可以做我女朋友吗"）。

  // t=0 的定义：只有封面，五幕一律透明且不可见。
  // 不写这一条的话，封面入场期间五幕会以不透明度 1 叠在封面背后
  // （往后拖时间轴或往回拖时会露馅）。
  master.set(sceneEls, { opacity: 0, visibility: "hidden" }, 0);

  /* --- 五幕 ---
     注意顺序：先把每一幕的时间轴补完整（含它自己的淡入淡出），再 add 进 master。
     反过来（先 add 再往幕里加补间）会让幕的时长在加入之后变化，
     master 缓存的时长不更新，后面每一幕的起点就全算错 ——
     表现是中间几幕互相重叠、某几幕的内容永远不出现。 */
  const s1 = buildScene1(el, ctx);
  const s2 = buildScene2(el);
  const s3 = buildScene3(el);
  const s4 = buildScene4(el, ctx); // 需要留着它，换幕时要启停"不要"按钮的逃跑逻辑
  const s5 = buildScene5(el, ctx);
  const scenes = [
    { tl: s1.tl, label: "星夜" },
    { tl: s2.tl, label: "心迹" },
    { tl: s3.tl, label: "一封信" },
    { tl: s4.tl, label: "提问" },
    { tl: s5.tl, label: "终章" },
  ];
  scene4 = s4;

  scenes.forEach((scene, i) => {
    if (!scene.tl || typeof scene.tl.eventCallback !== "function") {
      throw new Error(
        `[编排] 第 ${i + 1} 幕（${scene.label}）没有返回 timeline，拿到的是：${Object.prototype.toString.call(
          scene.tl
        )}`
      );
    }

    const self = sceneEls[i];
    const prev = i > 0 ? sceneEls[i - 1] : null;
    const next = sceneEls[i + 1] || null;

    // 这一幕淡入
    scene.tl.set(self, { opacity: 0, visibility: "inherit" }, 0);
    scene.tl.to(self, { opacity: 1, duration: FADE }, 0);
    // 上一幕淡出
    if (prev) scene.tl.to(prev, { opacity: 0, duration: FADE }, 0);
    // 若这一幕够长，结尾把下一幕"预亮"出来
    const room = scene.tl.duration() - FADE;
    if (next && room > 0.25) {
      scene.tl.set(next, { opacity: 0, visibility: "inherit" }, room);
      scene.tl.to(next, { opacity: 1, duration: FADE }, room);
    }
  });

  // 拼装：用自己维护的游标累加位置，并显式传给 add()。
  //
  // 为什么不能写成 master.add(scene.tl) 然后取 master.duration()：
  // 主时间轴是"暂停在 0"的，GSAP 对它远端子时间轴的时长是惰性缓存的 ——
  // 播放头没走到那里，_dur 就不会增长；而 add() 不带位置时是相对"播放头"摆放的。
  // 两者一叠加，后面每一幕的起点都会算错（中间几幕重叠、内容永远不出现）。
  let cursor = intro.duration(); // 封面先占一段时间，第一幕从它结束后开始
  scenes.forEach((scene, i) => {
    scene.tl.eventCallback("onStart", () => enterScene(i));
    sceneStarts.push(cursor);
    master.add(scene.tl, cursor);
    cursor += scene.tl.duration();
  });

  // 第一幕开始时，封面同步淡出（和 s1 的淡入有 0.35s 交叠）
  master.to(el.cover, { opacity: 0, duration: FADE }, sceneStarts[1] + 0.35);

  /* ---------------------------------------------------------------
     构造完成：把时间轴停在 0 并**强制渲染第 0 帧**，然后暂停。

     这里必须走 render(0)，不能只是 master.pause(0)：
     pause(0) 会把播放头回卷，GSAP 顺手把 from() 补间的起始状态又压回元素上，
     而主时间轴是暂停的，于是就永远停在"封面准备好了但一个字都没显示"的那一帧
     —— 表现就是打开页面只有背景，没有文字。
     render(0, false, true) 则会真正把 t=0 这一帧算出来。
     --------------------------------------------------------------- */
  sceneEls.forEach((node) => setSceneVisible(node, false, true));
  visibleNow.add(el.cover);
  gsap.set(el.cover, { opacity: 1, visibility: "inherit" });
  gsap.set([el.hud, el.skipHint], { autoAlpha: 0 });
  setRail(0);

  master.pause();
  showCoverReady();
  startCoverLoops();

  /* --- "好呀" 被点了 --- */
  // 单独用一个标志防连点，不要借 state.done —— 那个表示"整部影片播完了"，
  // 借来当防抖会造成两个问题：看完一遍后回第四幕点不了"好呀"，以及按钮不躲（见 scenes.js）。
  let yesFlying = false;
  el.btnYes.onclick = () => {
    if (yesFlying) return;
    yesFlying = true;
    master.pause();
    ctx.chime(true);

    const b = el.btnYes.getBoundingClientRect();
    const sx = b.left + b.width / 2;
    const sy = b.top + b.height / 2;
    const ex = window.innerWidth / 2;
    const ey = window.innerHeight * 0.42;

    gsap.set(el.heartPlane, { x: sx, y: sy, scale: 0, autoAlpha: 1, rotation: -20 });
    gsap
      .timeline({
        onComplete: () => {
          gsap.set(el.heartPlane, { autoAlpha: 0 });
          ctx.burst(ex, ey, 70);
          master.play(sceneStarts[4]);
          yesFlying = false;
        },
      })
      .to(el.heartPlane, { scale: 1.35, duration: 0.3, ease: "back.out(3)" })
      .to(el.heartPlane, {
        duration: 1.15,
        ease: "power1.inOut",
        motionPath: {
          path: [
            { x: sx, y: sy },
            { x: (sx + ex) / 2, y: sy - 170 },
            { x: ex, y: ey },
          ],
          curviness: 1.5,
        },
        rotation: 25,
      })
      .to(el.heartPlane, { scale: 0.2, autoAlpha: 0, duration: 0.3 }, "-=0.3")
      .to(el.answerRow, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1 }, 0)
      // 第四幕整体压暗（只动透明度，visibility 交给 setSceneVisible 管）
      .to(el.s4, { opacity: 0.15, duration: 0.5 }, 0.5);
  };

  /* --- 重播 --- */
  el.btnReplay.addEventListener("click", (e) => {
    e.stopPropagation();
    state.done = false;
    closeSecret(); // 彩蛋开着的话先收掉
    stopAllLoops();
    resetSceneVisuals();
    gsap.set(el.heartPlane, { autoAlpha: 0 });
    // 先把第 0 帧渲染出来复位画面，再从头播
    master.pause(0);
    master.render(0, false, true);
    master.play(0);
    gsap.fromTo(
      el.cursor,
      { scale: 0.4, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.5, overwrite: "auto" }
    );
  });

  /* --- 小秘密彩蛋 --- */
  let secretOpen = false;
  let secretTl = null;
  // 注意：这个函数在下面的重播按钮里会被用到，所以用函数声明（有提升），
  // 不能写成 const 箭头函数，否则重播时会撞上暂时性死区。
  function closeSecret() {
    if (!secretOpen) return;
    secretOpen = false;
    secretTl.timeScale(1.5).reverse();
    gsap.delayedCall(0.6, () => el.secret.setAttribute("aria-hidden", "true"));
  }
  el.btnSecret.addEventListener("click", (e) => {
    e.stopPropagation();
    if (secretOpen) return closeSecret();
    secretOpen = true;
    el.secret.setAttribute("aria-hidden", "false");
    secretTl = gsap
      .timeline()
      .fromTo(el.secret, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 })
      .fromTo(
        el.secret.querySelector(".secret-card"),
        { scale: 0.9, y: 24 },
        { scale: 1, y: 0, duration: 0.9, ease: "power3.out" },
        "<0.05"
      );
  });
  el.secret.addEventListener("click", closeSecret);

  /* --- 更新可点区域（"不要"按钮在乱跑，所以要经常量） --- */
  measure();
  master.eventCallback("onStart", () => {
    hotRects.length = 0;
    measure();
  });
}

const measure = () => {
  const push = (node) => {
    if (!node || !node.isConnected) return;
    const r = node.getBoundingClientRect();
    if (r.width > 1 && r.height > 1) hotRects.push({ node, r });
  };
  push(el.btnYes);
  push(el.btnNo);
  push(el.btnSound);
  push(el.btnReplay);
  push(el.btnSecret);
};

/* ---------------- 进入某一幕 ---------------- */
function enterScene(i) {
  // 除了封面，上一幕的循环动效都关掉并复位
  if (i > 0) stopSceneLoops(i - 1);
  state.index = i;

  // 这一刻的场景必须可见、其它幕必须不可见。
  // 同时把所有透明度先归零：否则那些"预亮下一幕"的补间（或往后拖时间轴之后）
  // 会在当前幕没盖住的地方露出一大块后面的内容。
  sceneEls.forEach((node, k) => {
    const on = k === i;
    setSceneVisible(node, on, true);
    if (!on) gsap.set(node, { opacity: 0 });
  });

  // 上了第一幕就把 HUD 亮出来
  if (i === 0) {
    gsap.to(el.hud, { autoAlpha: 1, duration: 1.2 });
    gsap.to(el.skipHint, { autoAlpha: 1, duration: 1.2, delay: 1.6 });
  }

  // 第四幕：开启"不要"按钮的逃跑逻辑（换幕时复位）
  if (scene4 && scene4.setActive) {
    scene4.setActive(i === 3);
    if (i === 3) el.whisper.textContent = "";
  }

  // 进了终章就把提示收掉
  if (i === 4) gsap.to(el.skipHint, { autoAlpha: 0, duration: 0.6 });
}

/* ---------------- 点击翻页 ---------------- */
let skipping = false;

/**
 * 跳到下一幕。
 * 关键是"只往前"：state.index 是由每一幕的 onStart 更新的，
 * 而 onStart 要等主时间轴真正播到那一刻才触发 —— 手快连点两下时，
 * state.index 还是旧值，按它算出来的目标会落在播放头后面，画面会往回跳。
 * 所以这里用播放头位置兜一道底。
 */
function goNextScene() {
  if (!master || state.done || skipping) return;
  if (state.index < 0) return; // 封面还没走完

  const head = master.time() + 0.05;
  let next = Math.max(state.index + 1, 0);
  // 找到第一个"确实在当前播放头之后"的幕起点
  while (next < sceneEls.length && sceneStarts[next] <= head) next++;
  if (next >= sceneEls.length) return;

  skipping = true;
  gsap.delayedCall(0.35, () => (skipping = false));
  master.play(sceneStarts[next]);
}

document.addEventListener(
  "pointerdown",
  (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest("button, a, .secret")) return;
    goNextScene();
  },
  { passive: true }
);

/* ---------------- 键盘 ---------------- */
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowRight" || e.code === "Enter") {
    e.preventDefault();
    goNextScene();
  }
  if (e.code === "Escape") {
    const s = el.secret;
    if (s.getAttribute("aria-hidden") === "false") s.click();
  }
});

/* ---------------- 开始 ----------------
   直接在总时间轴上从 0 播：封面入场 → 第一幕，中间不做任何额外补间。
   以前这里用 intro.tweenTo() 收尾，它依赖 rAF 触发 onComplete，
   在"标签页不在前台"这类 rAF 被挂起的场景下会卡住不动。 */
function startExperience() {
  if (!master) return;
  showCoverReady();
  master.pause(0);
  master.play(0);
}

el.enterBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (audio.supported) {
    await audio.ensure();
    paintSound(audio.muted);
  }
  el.enterBtn.disabled = true;
  startExperience();
});

/* ---------------- 标签页切走就暂停（音乐和动画都不浪费） ---------------- */
document.addEventListener("visibilitychange", () => {
  if (!master) return;
  if (document.hidden) {
    if (master.isActive()) {
      master.pause();
      master.datasetWasPlaying = "1";
    }
  } else if (master.datasetWasPlaying === "1") {
    master.datasetWasPlaying = "";
    master.play();
  }
});

/* ---------------- 窗口变化：重新量一下尺寸 ----------------
   注意：这里不重新拆分文字（SplitText 的 autoSplit 会重建元素，
   而时间轴已经绑定了旧元素），所以只刷新可点区域和坐标。 */
let resizeTimer = null;
window.addEventListener(
  "resize",
  () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      hotRects.length = 0;
    }, 220);
  },
  { passive: true }
);

/* ---------------- 启动 ---------------- */
applyTheme(config.theme);
populate();

/**
 * 一个很小的调试接口：在控制台里可以
 *   __T.master.play(__T.starts[3])   // 直接跳到第四幕
 *   __T.audio.setMuted(true)         // 静音
 */
window.__T = {
  get master() {
    return master;
  },
  get starts() {
    return sceneStarts;
  },
  /**
   * 分幕边界，供调试/截图工具用：[封面起点, 第1幕起点, 第2幕起点, ..., 末尾]
   * 总时间轴的顺序是 [封面, 第1幕, 第2幕, ...]，所以 spans[0]=0、spans[1]=封面时长。
   */
  get spans() {
    if (!master) return [];
    return [0, intro ? intro.duration() : 0, ...sceneStarts, master.duration()];
  },
  get state() {
    return state;
  },
  audio,
  config,
};

let booted = false;
function boot() {
  // 只在"还没点开始、封面也还没开演"时才允许重建，避免换掉正在用的 master 实例
  if (booted && (state.index >= 0 || (master && (master.time() > 0 || master.isActive())))) return;
  booted = true;
  stopAllLoops();
  build();

  // 光标悬到按钮上时，光圈变大
  document.addEventListener(
    "pointermove",
    (e) => {
      if (!hotRects.length) return;
      const t = e.target;
      if (t instanceof Element && t.closest("button, a")) return cursor.setHot(true);
      if (t instanceof Element && t.closest(".scene") && state.index >= 0) {
        // 看看有没有飘在附近的按钮
        const near = hotRects.some(
          (h) =>
            h.node.isConnected &&
            e.clientX > h.r.left - 10 &&
            e.clientX < h.r.right + 10 &&
            e.clientY > h.r.top - 10 &&
            e.clientY < h.r.bottom + 10
        );
        return cursor.setHot(near);
      }
    },
    { passive: true }
  );
}

/* ---------------- 启动 ----------------
   先立刻拆字上屏（封面第一眼要快），等字体真正加载完再重建一次时间轴，
   避免中文换行和字距算错。两次都走同一个 boot 守卫，字体接口卡住也不会白屏。 */
boot();

if (document.fonts && document.fonts.ready) {
  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    rebuild();
  };
  document.fonts.ready.then(settle);
  // 注意用普通的 setTimeout：gsap.delayedCall 依赖 rAF，
  // 在 rAF 被挂起的环境（后台标签页、无头浏览器）里不会触发。
  window.setTimeout(settle, 2500);
}

/** 字体就绪后重新拆一次字并重建时间轴（只在还没开演时做） */
function rebuild() {
  // 已经开演（点了开始、翻过页、或封面已经在放）就别动，免得换掉 master 实例把人搞晕
  if (state.index >= 0 || !master || master.time() > 0 || master.isActive()) return;
  booted = false;
  boot();
}
