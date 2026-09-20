/**
 * 临时截图脚本（只在 SHOTS=1 构建时注入）
 *
 * 无头浏览器的虚拟时间会把动画直接快进到结尾，所以这里完全不做"播放"，
 * 只用总时间轴的定点 seek；取样点用"幕末回退 N 秒"，正好落在
 * "内容都浮现完、还没开始淡出"的那一小段。
 *
 * 用法：?shot=cover | 1..5   可选 &beforeEnd=3
 */
(function () {
  const q = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const params = new URLSearchParams(location.search);
  const which = params.get("shot");
  const beforeEnd = Number(params.get("beforeEnd") || 3);

  /**
   * 把播放头拨到某一幕的"内容已浮现、还没淡出"的位置。
   *
   * 约定：?shot=0 封面；?shot=1..5 第 1..5 幕。
   * 分幕边界直接用 main.js 给的 __T.spans（它在构造时就记好了），
   * 不在这里重新推算 —— 之前两边各算一遍就是错位的根源。
   */
  function seekNearEnd(shotNo, back) {
    const m = window.__T.master;
    const spans = window.__T.spans;
    const a = spans[shotNo];
    const b = spans[shotNo + 1] !== undefined ? spans[shotNo + 1] : m.duration();
    const span = Math.max(0, b - a);
    const t = a + Math.max(0, span - back);
    m.pause();
    // 先把播放头停在幕起点前一瞬、再前进到目标时间：
    // 让 GSAP 走过"幕的 t=0"这条边界，否则幕开头那些补间不会被初始化。
    const pre = Math.max(0, a - 0.05);
    m.time(pre);
    m.render(pre, false, true);
    m.time(t);
    m.render(t, false, true); // 强制刷新一帧
    return { t, p: m.progress(), a, b };
  }

  (async () => {
    for (let i = 0; i < 80 && !window.__T; i++) await sleep(100);
    if (!window.__T) {
      console.log("SHOT FAIL no __T");
      return;
    }
    window.__T.audio.setMuted(true);
    await sleep(300);

    if (!which) {
      // 自检：每幕都拨一遍，打印各幕透明度 + 关键元素状态
      for (let s = 0; s <= 5; s++) {
        const at = seekNearEnd(s, s === 0 ? 0 : beforeEnd);
        const ops = ["#scene-cover", "#scene-1", "#scene-2", "#scene-3", "#scene-4", "#scene-5"]
          .map((sel) => parseFloat(getComputedStyle(q(sel)).opacity).toFixed(2))
          .join(",");
        const stat = (sel) => {
          const n = q(sel);
          if (!n) return sel + ":MISSING";
          const cs = getComputedStyle(n);
          const r = n.getBoundingClientRect();
          return `${sel}(op=${parseFloat(cs.opacity).toFixed(2)},vis=${cs.visibility},filter=${cs.filter},box=${r.width.toFixed(
            0
          )}x${r.height.toFixed(0)})`;
        };
        console.log(
          `SHOT s${s} t=${at.t.toFixed(2)} 幕透明度=[${ops}] ` +
            stat("#herName") +
            " " +
            stat(".beat-line") +
            " " +
            stat("#letterBody") +
            " " +
            stat("#finalBig") +
            " " +
            stat("#finalHeart") +
            " " +
            stat("#question") +
            " " +
            stat("#btnYes")
        );
      }
      console.log("SHOT READY all");
      return;
    }

    const shotNo = Number(which);
    if (!Number.isFinite(shotNo)) {
      console.log(`SHOT FAIL 无法识别的 shot 参数：${which}`);
      return;
    }
    const at = seekNearEnd(shotNo, shotNo === 0 ? 0 : beforeEnd);
    if (!at || at.t === undefined) {
      console.log("SHOT FAIL seek 失败");
      return;
    }
    // 报一下"谁盖在最上面"：逐幕透明度 + 封面 + 该幕的主内容
    const ops = ["#scene-cover", "#scene-1", "#scene-2", "#scene-3", "#scene-4", "#scene-5"]
      .map((sel) => {
        const cs = getComputedStyle(q(sel));
        return `${sel.replace("#scene-", "")}=${parseFloat(cs.opacity).toFixed(2)}/${cs.visibility}`;
      })
      .join(" ");
    console.log(
      `SHOT ${which} t=${at.t.toFixed(2)} 区间=[${at.a.toFixed(2)}, ${at.b.toFixed(2)}] ${ops}`
    );

    // 调试：把该幕主内容的内联样式打出来（看 GSAP 到底写了什么）
    const dumpStyles = (label, node) => {
      if (!node) return console.log(`SHOT ${label}: 元素不存在`);
      const cs = getComputedStyle(node);
      console.log(
        `SHOT ${label}: 内联="${node.getAttribute("style") || "(空)"}" | 计算 op=${cs.opacity} vis=${cs.visibility} filter=${cs.filter}`
      );
    };
    if (which === "4") {
      dumpStyles("question", q("#question"));
      dumpStyles("btnYes", q("#btnYes"));
      dumpStyles("s4容器", q("#scene-4"));
      // 关键数字：总时间轴的时长、各幕起点、以及"第4幕"的幕内时间
      const m = window.__T.master;
      const st = window.__T.starts;
      console.log(
        `SHOT 数字: master.duration=${m.duration().toFixed(2)} time=${m.time().toFixed(2)} ` +
          `starts=[${st.map((x) => x.toFixed(2)).join(", ")}]`
      );
      const s4Start = st[4];
      console.log(
        `SHOT 第4幕幕内时间=${(m.time() - s4Start).toFixed(2)}s（应为正数且在幕长之内）`
      );
    }
    if (which === "5") {
      dumpStyles("finalBig", q("#finalBig"));
      dumpStyles("finalHeart", q("#finalHeart"));
      dumpStyles("s5容器", q("#scene-5"));
    }

    await sleep(200);
    console.log(`SHOT READY ${which} t=${at.t.toFixed(2)} p=${at.p.toFixed(3)}`);
  })();
})();
