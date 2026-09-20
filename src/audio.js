/**
 * 背景音乐：用 Web Audio 现场合成
 * —— 不用任何音频文件，所以完全没有版权问题，也不需要联网
 * —— 浏览器要求"先有用户手势"才能出声，所以由封面的"开始"按钮调用 ensure()
 */
import { config } from "./config.js";

export function createAudio(opts = {}) {
  const cfg = { ...config.audio, ...opts };

  let ctx = null;
  let master = null;
  let padBus = null;
  let started = false;
  let muted = false;
  let step = 0;
  let timer = null;

  const supported =
    typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);

  /* ---------- 混响脉冲 ---------- */
  function impulse(seconds = 2.2, decay = 2.6) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* ---------- 初始化音频图 ---------- */
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0; // 淡入
    master.connect(ctx.destination);

    const conv = ctx.createConvolver();
    conv.buffer = impulse();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    conv.connect(wet).connect(master);

    padBus = ctx.createGain();
    padBus.gain.value = 0.09;
    padBus.connect(master); // 干声
    padBus.connect(conv); // 送混响
  }

  /* ---------- 事件音：柔和的正弦 + 缓慢包络 ---------- */
  function note(freq, when, { dur = 2.6, gain = 0.5, type = "sine", bus = padBus } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 12; // 轻微失谐，更暖

    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(g).connect(bus);
    osc.start(when);
    osc.stop(when + dur + 0.1);
  }

  /* ---------- 和弦进行：每分钟若干拍，温柔地来回走 ---------- */
  function schedule() {
    const beats = 60 / cfg.bpm * 2; // 每两拍换一次和弦
    const chord = cfg.progression[step % cfg.progression.length];
    const t0 = ctx.currentTime + 0.06;

    // 低音 + 和弦铺底
    note(chord[0] / 2, t0, { dur: beats * 1.5, gain: 0.42, type: "sine" });
    chord.forEach((f, i) => {
      note(f, t0 + i * 0.06, { dur: beats * 1.4, gain: 0.3 });
      note(f * 2, t0 + 0.2 + i * 0.06, { dur: beats, gain: 0.09, type: "triangle" });
    });

    // 偶尔来一颗高音，像钢琴的装饰音
    if (Math.random() > 0.45) {
      const f = chord[Math.floor(Math.random() * chord.length)] * 4;
      note(f, t0 + gsapLikeRandom(0.4, beats * 0.6), { dur: 3.2, gain: 0.07, type: "triangle" });
    }

    step++;
    timer = window.setTimeout(schedule, beats * 1000);
  }

  function gsapLikeRandom(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ---------- 对外接口 ---------- */
  async function ensure() {
    if (!supported || !cfg.enabled) return false;
    init();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* 用户没允许就先算了 */
      }
    }
    if (!started) {
      started = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : cfg.volume, ctx.currentTime + 2.5);
      schedule();
    }
    return ctx.state === "running";
  }

  function setMuted(next) {
    muted = next;
    if (!ctx || !master) return muted;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.linearRampToValueAtTime(muted ? 0.0001 : cfg.volume, now + 0.8);
    return muted;
  }

  function toggle() {
    return setMuted(!muted);
  }

  /** 一次性的"花瓣落下"音效：上行琶音 */
  function chime(up = true) {
    if (!ctx || muted) return;
    const base = [523.25, 659.25, 783.99, 1046.5];
    const list = up ? base : [...base].reverse();
    const t0 = ctx.currentTime + 0.02;
    list.forEach((f, i) => {
      note(f, t0 + i * 0.09, { dur: 1.9, gain: 0.16, type: "triangle", bus: master });
    });
  }

  function dispose() {
    if (timer) window.clearTimeout(timer);
    if (ctx) ctx.close();
    ctx = null;
    started = false;
  }

  return { ensure, toggle, setMuted, chime, dispose, get muted() { return muted; }, supported };
}
