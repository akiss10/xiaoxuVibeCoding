/**
 * ============================================================
 *  五幕剧情 —— 全部用 GSAP 时间轴编排
 * ============================================================
 *  每一幕返回一个"从 0 开始"的 paused timeline，
 *  由 main.js 拼接成一个总时间轴，方便整体播放 / 跳转 / 重播。
 */
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { config } from "./config.js";

gsap.registerPlugin(SplitText, DrawSVGPlugin, MotionPathPlugin);

const prefersReduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 字与字之间错开一点，但减少动效偏好时整体压缩 */
function stagger(amount, from = "start") {
  return prefersReduced() ? 0 : { amount, from };
}

/* ============================================================
   "一直在循环"的小动效（心跳、呼吸、按钮光圈……）
   ------------------------------------------------------------
   这些不能放进总时间轴：repeat: -1 会让整条时间轴的时长变成无穷大，
   于是拖动进度、跳幕、重播全都失效。所以做成"由每一幕单独启停"的循环补间。
   ============================================================ */
const loops = new Map();

export function startLoop(key, vars) {
  stopLoop(key);
  loops.set(key, gsap.to(vars.target, vars.to));
}

export function stopLoop(...keys) {
  keys.forEach((key) => {
    const tween = loops.get(key);
    if (tween) {
      tween.kill();
      loops.delete(key);
    }
  });
}

export function stopAllLoops() {
  loops.forEach((tween) => tween.kill());
  loops.clear();
}

/** 把所有被循环补间改过的属性复位（重播时用） */
export function resetSceneVisuals() {
  resetLoopTargets();
}

/** 循环补间里"永远不要动"的属性要显式写出来，否则会停在被杀掉的中间值上 */
function resetLoopTargets() {
  gsap.set(".cover-heart", { scale: 1 });
  gsap.set(".enter-ring", { scale: 1, autoAlpha: 0 });
  gsap.set("#pulseHeart", { scale: 1, autoAlpha: 1 });
  gsap.set("#question", { scale: 1 });
  gsap.set("#finalHeart", {
    scale: 1,
    filter: "drop-shadow(0 0 34px rgba(255,92,138,.6))",
  });
  gsap.set("#herName .char", { y: 0 });
}

/* ============================================================
   封面
   说明：所有 buildSceneX 统一返回 { tl }，方便 main.js 拼总时间轴

   这里刻意全部用 fromTo（而不是 from）：
   from() 的起始状态会被压在暂停的时间轴上，导致"打开页面只有背景、
   一个字都不显示"。fromTo 的 t=0 帧就是封面的完整样子，暂停时也正常可见。
   ============================================================ */
export function buildCover(el) {
  const titleSplit = SplitText.create(el.coverTitle, {
    type: "chars",
    smartWrap: true,
    charsClass: "char",
  });

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  const show = { autoAlpha: 1, visibility: "inherit" };

  tl.addLabel("in")
    .fromTo(
      titleSplit.chars,
      { y: 34, autoAlpha: 0, rotationX: -55 },
      { ...show, y: 0, rotationX: 0, stagger: stagger(0.5, "start"), duration: 1.1 }
    )
    .fromTo(
      el.coverHeartPath,
      { drawSVG: "0% 0%" },
      { drawSVG: "0% 100%", duration: 1.5, ease: "power2.inOut" },
      "-=0.5"
    )
    .fromTo(
      el.coverHeart,
      { scale: 0.86, autoAlpha: 0 },
      { ...show, scale: 1, duration: 1, ease: "back.out(1.6)" },
      "<"
    )
    .fromTo(el.coverSub, { y: 16, autoAlpha: 0 }, { ...show, y: 0, duration: 0.9 }, "-=0.8")
    .fromTo(el.enterBtn, { y: 20, autoAlpha: 0 }, { ...show, y: 0, duration: 0.8 }, "-=0.5")
    .fromTo(el.coverTip, { autoAlpha: 0 }, { ...show, duration: 0.8 }, "-=0.4");

  // 封面心跳、按钮光圈的循环动效由 main.js 在开场时启动
  return { tl };
}

/* ============================================================
   第一幕：把她的名字一笔一笔写出来
   ============================================================ */
export function buildScene1(el, ctx) {
  // 注意：GSAP 3.15 的 SplitText 不会自动加 class，必须显式指定，
  // 否则拆出来的元素没有类名，CSS 选中不了、也不好调试。
  const nameSplit = SplitText.create(el.herName, {
    type: "chars",
    smartWrap: true,
    charsClass: "char",
  });
  gsap.set([el.herName, el.s1Pre, el.s1After], { autoAlpha: 0 });

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  tl.addLabel("start")
    .from(el.s1Eyebrow, { autoAlpha: 0, y: 10, duration: 0.8 })
    .from(el.s1Pre, { autoAlpha: 0, y: 18, duration: 0.9 }, "-=0.4")
    .addLabel("name")
    .fromTo(
      el.herName,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.01, immediateRender: false }
    )
    .from(nameSplit.chars, {
      autoAlpha: 0,
      yPercent: 45,
      rotationY: -70,
      scale: 0.7,
      filter: "blur(9px)",
      duration: 1.15,
      stagger: stagger(0.85, "start"),
      ease: "power3.out",
    })
    .addLabel("sparkle")
    // 名字定型后，甩出一圈光点
    .to(
      el.herName,
      { textShadow: "0 0 34px rgba(255,92,138,.85)", duration: 0.6, yoyo: true, repeat: 1 },
      "-=0.3"
    )
    .fromTo(
      el.s1After,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, duration: 1, immediateRender: false },
      "-=0.6"
    )
    .addLabel("hold", "+=0.4");

  if (!prefersReduced()) {
    // 名字轻轻浮动（循环，不进时间轴）
    tl.add(() => {
      startLoop("nameFloat", {
        target: nameSplit.chars,
        to: {
          y: -8,
          duration: 1.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: { each: 0.12, from: "center" },
        },
      });
    }, "sparkle");

    // 名字周围撒星星
    tl.add(() => {
      const box = el.herName.getBoundingClientRect();
      ctx.burst(
        box.left + box.width / 2,
        box.top + box.height / 2,
        gsap.utils.random(16, 26, 1),
        { spread: 0.9, distance: box.width * 0.62 }
      );
    }, "sparkle+=0.2");
  }

  return { tl, nameSplit };
}

/* ============================================================
   第二幕：一句一句靠近，心跳越来越明显
   ============================================================ */
export function buildScene2(el) {
  const lineSplits = el.beatLineEls.map((line) =>
    SplitText.create(line, { type: "lines,chars", linesClass: "line", charsClass: "char" })
  );

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  tl.from(el.s2Eyebrow, { autoAlpha: 0, y: 10, duration: 0.8 });

  el.beatLineEls.forEach((line, i) => {
    const split = lineSplits[i];
    tl.addLabel(`line${i}`)
      .fromTo(line, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false })
      .from(split.chars, {
        autoAlpha: 0,
        y: 26,
        filter: "blur(7px)",
        duration: 0.85,
        stagger: stagger(0.42, "start"),
      })
      .from(
        line,
        {
          letterSpacing: "0.3em",
          duration: 0.8,
          ease: "power2.out",
        },
        "<"
      );

    // 每说一句，心跳快一点点
    if (!prefersReduced()) {
      tl.to(
        el.pulseHeart,
        { scale: 1 + (i + 1) * 0.07, duration: 0.6, ease: "back.out(2)" },
        "<0.25"
      );
    }
    tl.to({}, { duration: 0.35 });
  });

  if (!prefersReduced()) {
    // 心跳的持续律动（循环，不进时间轴）
    tl.add(() => {
      startLoop("pulseHeart", {
        target: el.pulseHeart,
        to: {
          scale: 1.42,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        },
      });
      startLoop("pulseGlow", {
        target: el.pulseHeart,
        to: {
          autoAlpha: 0.35,
          duration: 0.32,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
        },
      });
    }, "line0");
  }

  tl.addLabel("hold", "+=0.6");
  return { tl, lineSplits };
}

/** 第一幕和第二幕里那些"一直循环"的小动效，换幕时统一关掉并复位 */
export function stopSceneLoops(i) {
  if (i === 0) stopLoop("coverHeart", "coverRing", "nameFloat");
  if (i === 1) stopLoop("pulseHeart", "pulseGlow");
  if (i === 3) stopLoop("questionBreathe");
  if (i === 4) stopLoop("finalBeat", "finalGlow");
  resetLoopTargets();
}

/* ============================================================
   第三幕：信
   ============================================================ */
export function buildScene3(el) {
  // 逐段拆字：每一段是独立的块，段间空行是真实的元素，
  // 所以不会出现"空行被 SplitText 吃掉"的问题。
  const entries = gsap.utils.toArray(".letter-entry", el.letterBody);
  const splits = entries.map((p) =>
    SplitText.create(p, { type: "lines,chars", linesClass: "line", charsClass: "char" })
  );
  const allChars = splits.flatMap((s) => s.chars);
  const allLines = splits.flatMap((s) => s.lines);
  gsap.set([el.letterBody, el.s3Sign, el.signName], { autoAlpha: 0 });

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  tl.from(el.s3Eyebrow, { autoAlpha: 0, y: 10, duration: 0.8 })
    .from(el.letterPaper, {
      autoAlpha: 0,
      y: 40,
      rotationX: -14,
      transformOrigin: "50% 0%",
      duration: 1.2,
      ease: "power3.out",
    })
    .fromTo(
      el.letterBody,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.01, immediateRender: false },
      "-=0.8"
    )
    // 逐行淡入 + 逐字浮现，像墨水一点点渗出来
    .from(
      allLines,
      {
        autoAlpha: 0,
        y: 14,
        duration: 0.5,
        stagger: 0.42,
      },
      "-=0.7"
    )
    .from(
      allChars,
      {
        autoAlpha: 0,
        filter: "blur(6px)",
        duration: 0.5,
        stagger: 0.028,
      },
      "<"
    )
    .from(
      [el.s3Sign, el.signName],
      { autoAlpha: 0, x: 26, duration: 0.9, stagger: 0.18 },
      "+=0.35"
    )
    .addLabel("hold", "+=0.5");

  // 信纸上缓缓扫过一道光（transform + opacity，不触发重排）
  if (!prefersReduced()) {
    tl.fromTo(
      el.letterSheen,
      { yPercent: -70, autoAlpha: 0 },
      { yPercent: 320, autoAlpha: 1, duration: 3.6, ease: "power1.inOut" },
      1.0
    );
  }

  return { tl, splits };
}

/* ============================================================
   第四幕：提问（"不要"会逃跑）
   ============================================================ */
export function buildScene4(el, ctx) {
  const mobile = window.matchMedia("(max-width: 640px)").matches;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  const show = { autoAlpha: 1, visibility: "inherit" };

  tl.addLabel("q")
    .fromTo(
      el.s4Eyebrow,
      { autoAlpha: 0, y: 10 },
      { ...show, y: 0, duration: 0.8 }
    )
    .fromTo(
      el.question,
      { autoAlpha: 0, scale: 0.86, filter: "blur(10px)" },
      { ...show, scale: 1, filter: "blur(0px)", duration: 1.1, ease: "back.out(1.5)" },
      "q+=0.5"
    )
    .fromTo(
      el.btnYes,
      { autoAlpha: 0, y: 26, scale: 0.8 },
      { ...show, y: 0, scale: 1, duration: 0.8 },
      "-=0.5"
    )
    .fromTo(
      el.btnNo,
      { autoAlpha: 0, y: 26, scale: 0.8 },
      { ...show, y: 0, scale: 1, duration: 0.8 },
      "<0.1"
    )
    .addLabel("ready");

  if (!prefersReduced()) {
    tl.add(() => {
      startLoop("questionBreathe", {
        target: el.question,
        to: { scale: 1.025, duration: 2.2, repeat: -1, yoyo: true, ease: "sine.inOut" },
      });
    }, "ready");
  }

  /* ============================================================
     "不要"按钮的逃跑逻辑
     ------------------------------------------------------------
     关键：必须监听**全局**指针位置，不能只挂在按钮自己身上。
     按钮是 <button>，指针一旦真的移到它上面，浏览器就会先派发 click ——
     等 pointermove 再躲已经太晚了。所以在整个窗口上监听，指针进到
     安全距离内就提前跑掉，这样"点不到"才成立。
     ============================================================ */
  const noHome = { x: 0, y: 0 };
  let dodges = 0;
  let lastTaunt = 0;
  let armed = false; // 这一幕是否正在进行

  const noX = gsap.quickTo(el.btnNo, "x", { duration: 0.32, ease: "power3" });
  const noY = gsap.quickTo(el.btnNo, "y", { duration: 0.32, ease: "power3" });

  const clamp = gsap.utils.clamp;

  /** 记录按钮的原位（等入场动画结束、位置稳定后再量） */
  function captureHome() {
    gsap.set(el.btnNo, { x: 0, y: 0 });
    const r = el.btnNo.getBoundingClientRect();
    noHome.x = 0;
    noHome.y = 0;
    noHome.w = r.width;
    noHome.h = r.height;
    noHome.left = r.left;
    noHome.top = r.top;
  }

  function dodgeAt(px, py) {
    // 只看"这一幕在不在演"，不参考"整部片播完没有"。
    // 之前这里用 ctx.isDone()，而它表示整部影片播到结尾 ——
    // 一旦看完整片再回第四幕，按钮就再也不躲了。
    if (!armed) return;
    if (px === undefined || py === undefined) return;

    const r = el.btnNo.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - px;
    const dy = cy - py;
    const dist = Math.hypot(dx, dy) || 1;

    // 离得远就先不动，进到安全距离才慌
    const safe = mobile ? 118 : 104;
    if (dist > safe) return;

    const push = dist < 45 ? 340 : 270;
    const margin = 18;
    // 以"当前可视位置"为基准往外跳，再夹回视口内
    let nx = gsap.getProperty(el.btnNo, "x") + (dx / dist) * push + gsap.utils.random(-70, 70);
    let ny = gsap.getProperty(el.btnNo, "y") + (dy / dist) * push + gsap.utils.random(-60, 60);
    nx = clamp(-(r.left - margin), window.innerWidth - r.right - margin, nx);
    ny = clamp(-(r.top - margin), window.innerHeight - r.bottom - margin, ny);

    noX(nx);
    noY(ny);

    // ---- 挑衅文案：换得别太勤 ----
    const now = performance.now();
    if (now - lastTaunt < 420) return;
    lastTaunt = now;

    const taunts = config.scene4.noTaunts;
    el.btnNo.textContent = taunts[Math.min(dodges, taunts.length - 1)];
    dodges++;

    gsap.fromTo(
      el.btnNo,
      { scale: 0.94 },
      { scale: 1, duration: 0.45, ease: "back.out(3)", overwrite: "auto" }
    );
    // 每躲一次，"好呀"就长大一点
    gsap.to(el.btnYes, {
      scale: 1 + Math.min(dodges, 6) * 0.07,
      duration: 0.5,
      ease: "back.out(2)",
      overwrite: "auto",
    });

    if (dodges === 3) ctx.chime(false);
    if (dodges === 3) ctx.whisper("……点左边那个才对");
  }

  /* 全局指针监听：这样指针还没碰到按钮就能提前躲开 */
  const onPointerMove = (e) => dodgeAt(e.clientX, e.clientY);
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // 兜底：万一真的点到/摸到了，也别让它生效
  el.btnNo.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dodgeAt(e.clientX, e.clientY);
    },
    true
  );
  el.btnNo.addEventListener("touchstart", (e) => dodgeAt(e.touches[0]?.clientX, e.touches[0]?.clientY), {
    passive: true,
  });

  /* ---------- "好呀"：答应的瞬间 ---------- */
  el.btnYes.addEventListener("pointerenter", () => {
    gsap.to(el.btnYes, { scale: 1.09, duration: 0.4, ease: "back.out(2.5)" });
  });
  el.btnYes.addEventListener("pointerleave", () => {
    gsap.to(el.btnYes, { scale: 1, duration: 0.5, ease: "power2.out" });
  });

  /** 由 main.js 在进入/离开这一幕时调用 */
  function setActive(on) {
    armed = on;
    if (on) {
      dodges = 0;
      lastTaunt = 0;
      gsap.set(el.btnNo, { x: 0, y: 0, scale: 1 });
      el.btnNo.textContent = config.scene4.no;
      // 等入场动画把按钮放稳再量原位
      gsap.delayedCall(1.1, captureHome);
      captureHome();
    } else {
      gsap.set(el.btnNo, { x: 0, y: 0, scale: 1 });
    }
  }

  return { tl, btnYes: el.btnYes, btnNo: el.btnNo, setActive };
}

/* ============================================================
   第五幕：终章
   ============================================================ */
export function buildScene5(el, ctx) {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  tl.from(el.s5Eyebrow, { autoAlpha: 0, y: 10, duration: 0.8 })
    .addLabel("heart")
    .from(el.finalHeart, {
      autoAlpha: 0,
      scale: 0.2,
      rotation: -25,
      duration: 1.3,
      ease: "elastic.out(1, 0.5)",
    })
    .from(
      el.finalHeart,
      { filter: "brightness(2.4) blur(14px)", duration: 1.1, ease: "power2.out" },
      "<0.15"
    )
    .from(el.finalBig, {
      autoAlpha: 0,
      y: 30,
      filter: "blur(12px)",
      duration: 1.2,
    }, "-=0.7")
    .from([el.finalDate, el.btnSecret, el.btnReplay], {
      autoAlpha: 0,
      y: 18,
      duration: 0.8,
      stagger: 0.14,
    }, "-=0.5")
    .addLabel("hold", "+=0.3");

  // 心跳 + 呼吸光（循环，不进时间轴）
  if (!prefersReduced()) {
    tl.add(() => {
      startLoop("finalBeat", {
        target: el.finalHeart,
        to: { scale: 1.1, duration: 0.46, repeat: -1, yoyo: true, ease: "sine.inOut" },
      });
      startLoop("finalGlow", {
        target: el.finalHeart,
        to: {
          filter: "drop-shadow(0 0 54px rgba(255,92,138,.95))",
          duration: 1.1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        },
      });
    }, "heart");
  }

  return { tl };
}
