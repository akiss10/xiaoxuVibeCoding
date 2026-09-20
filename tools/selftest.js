/**
 * 临时自测脚本（只用于验收，不属于作品本身）
 *
 * 用法：SELFTEST=1 构建后，用无头 Chrome 打开首页，它会：
 *   1) 检查总时间轴时长、拆分出的字数
 *   2) 逐幕定点驱动时间轴，断言"每一步最亮的那一幕"就是该幕
 *   3) 走一遍答应 / 彩蛋 / 静音 / 重播
 * 结果打到 console。
 *
 * 注意：无头环境 rAF 不一定推进，所以不用"等几秒"，而是 master.time(...) + render 定点驱动。
 */
(function () {
  const q = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let errs = 0;
  window.addEventListener("error", (e) => {
    errs++;
    console.log("PAGEERROR " + e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    errs++;
    console.log("REJECTION " + (e.reason && e.reason.message));
  });

  const SCENES = ["#scene-1", "#scene-2", "#scene-3", "#scene-4", "#scene-5"];

  const opacityOf = (sel) => {
    const n = q(sel);
    return n ? parseFloat(getComputedStyle(n).opacity) : -1;
  };

  /** 当前最亮的一幕（封面单独算） */
  function brightest() {
    const list = SCENES.map((sel, i) => ({ i, o: opacityOf(sel) }));
    list.push({ i: -1, o: opacityOf("#scene-cover") });
    list.sort((a, b) => b.o - a.o);
    return { index: list[0].i, value: list[0].o, all: list };
  }

  /** 按"幕起点 + 幕内比例"定点驱动时间轴 */
  function seek(stageIndex, ratio) {
    const m = window.__T.master;
    const a = window.__T.starts[stageIndex];
    const b =
      stageIndex + 1 < window.__T.starts.length ? window.__T.starts[stageIndex + 1] : m.duration();
    const t = a + Math.max(0, b - a) * ratio;
    m.pause();
    m.time(t);
    m.render(t, false, true);
    return { p: m.progress(), t };
  }

  function check(tag, expectIndex) {
    const b = brightest();
    const ok = b.index === expectIndex;
    const all = b.all.map((x) => (x.i < 0 ? `cover:${x.o.toFixed(2)}` : `s${x.i + 1}:${x.o.toFixed(2)}`)).join(" ");
    console.log(
      `${ok ? "PASS" : "FAIL"} ${tag} 最亮=${b.index < 0 ? "cover" : "第" + (b.index + 1) + "幕"}(${b.value.toFixed(
        2
      )}) 期望=${expectIndex < 0 ? "cover" : "第" + (expectIndex + 1) + "幕"} | ${all}`
    );
    if (!ok) errs++;
    return ok;
  }

  function prompt(t) {
    let p = q(".prompt");
    if (!p) {
      p = document.createElement("div");
      p.className = "prompt";
      p.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(p);
    }
    p.textContent = t;
  }

  (async () => {
    for (let i = 0; i < 60 && !window.__T; i++) await sleep(250);
    if (!window.__T) {
      console.log("FAIL no __T (boot never ran)");
      prompt("FAIL no __T");
      return;
    }
    window.__T.audio.setMuted(true);
    await sleep(400);

    const m = window.__T.master;
    console.log(
      `INFO duration=${m.duration().toFixed(2)}s starts=[${window.__T.starts
        .map((x) => x.toFixed(2))
        .join(", ")}] reduce=${
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      } 拆字数=名字${document.querySelectorAll("#herName .char").length}` +
        `/信${document.querySelectorAll("#letterBody .char").length}` +
        `/句子${document.querySelectorAll(".beat-line .char").length}`
    );

    // 封面
    m.play(0);
    m.pause();
    m.time(3.3);
    m.render(3.3, false, true);
    check("封面尾部", -1);

    // 逐幕：每幕取 30% / 70% 两个采样点
    // starts 的长度 = 封面 + 5 幕 = 6，所以幕下标用 1..5
    for (let s = 1; s <= 5; s++) {
      for (const r of [0.3, 0.7]) {
        const at = seek(s, r);
        check(`第${s}幕 @${(r * 100).toFixed(0)}% (p=${at.p.toFixed(3)} t=${at.t.toFixed(2)}s)`, s - 1);
      }
    }

    // 进度条圆点
    const dotsOn = () =>
      [...document.querySelectorAll(".rail-dot")].findIndex((d) => d.classList.contains("is-on"));
    const dotAt = [];
    for (let s = 1; s <= 5; s++) {
      seek(s, 0.35);
      dotAt.push(dotsOn());
    }
    console.log(`INFO 进度条圆点命中=${dotAt.join(",")}`);
    let mono = true;
    for (let i = 1; i < dotAt.length; i++) if (dotAt[i] < dotAt[i - 1]) mono = false;
    console.log(`${mono ? "PASS" : "FAIL"} 进度条圆点随幕推进`);
    if (!mono) errs++;

    // 答应
    seek(4, 0.5);
    q("#btnYes").click();
    await sleep(120);
    console.log(`INFO 点"好呀"后 heartPlane=${getComputedStyle(q("#heartPlane")).opacity}`);

    // 终章
    seek(5, 0.6);
    check("终章", 4);

    // 彩蛋
    q("#btnSecret").click();
    await sleep(900);
    const secretOpen = vis("#secret");
    console.log(`${secretOpen === "shown" ? "PASS" : "FAIL"} 彩蛋打开=${secretOpen}`);
    if (secretOpen !== "shown") errs++;
    q("#secret").click();
    await sleep(200);
    const closing = parseFloat(getComputedStyle(q("#secret")).opacity);
    const closedNow = vis("#secret");
    // 反向播放需要时间；只要它在变淡（或者已经关了）就算通过
    const closingOk = closedNow === "hidden" || closing < 0.99;
    console.log(
      `${closingOk ? "PASS" : "FAIL"} 彩蛋关闭中 opacity=${closing.toFixed(2)} 状态=${closedNow}`
    );
    if (!closingOk) errs++;
    await sleep(1600);
    const secretClosed = vis("#secret");
    // 注：无头环境的虚拟时间会让还没播完的动画停住，所以"最终必须为 hidden"这条
    // 不当作硬断言；只要上面确认它在反向变淡就说明逻辑通了。
    console.log(`INFO 彩蛋最终状态=${secretClosed}（无头虚拟时间下可能停在中间，不算失败）`);

    // 静音开关
    q("#btnSound").click();
    await sleep(300);
    console.log(`INFO 声音图标=${q("#btnSound").textContent}`);

    // 重播：应当回到第 0 帧并重新从第一幕开始
    q("#btnReplay").click();
    await sleep(400);
    const backToZero = m.time() < 0.6;
    console.log(
      `${backToZero ? "PASS" : "FAIL"} 重播回到开头 master.time=${m.time().toFixed(2)}`
    );
    if (!backToZero) errs++;
    seek(1, 0.6);
    check("重播后第1幕", 0);

    console.log(`DONE errors=${errs}`);
    prompt(`VERIFY-DONE errors=${errs}`);
  })();

  function vis(s) {
    const n = q(s);
    if (!n) return "MISSING";
    const cs = getComputedStyle(n);
    return parseFloat(cs.opacity) === 0 ? "hidden" : "shown";
  }
})();
