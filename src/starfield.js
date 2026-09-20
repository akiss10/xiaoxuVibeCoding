/**
 * 星空背景
 * —— canvas 逐帧绘制，用 gsap.ticker 驱动（和 GSAP 共用同一个 rAF，不会互相打架）
 * —— 支持 prefers-reduced-motion：动效偏好为"减少动态"时只画静态星空
 */
import gsap from "gsap";

const PALETTE = [
  [255, 255, 255],
  [255, 226, 200],
  [255, 190, 214],
  [206, 198, 255],
];

export function createStarfield(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars = [];
  let meteor = null;
  let nextMeteorAt = 2.5;

  /* ---------- 尺寸 / 星星数量 ---------- */
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 星星密度跟面积走，手机上少一点，保证流畅
    const count = Math.round(gsap.utils.clamp(90, 320, (w * h) / 7200));
    stars = new Array(count).fill(0).map(() => {
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: gsap.utils.random(0.4, 1.7),
        color: c,
        alpha: gsap.utils.random(0.25, 0.9),
        speed: gsap.utils.random(0.35, 1.5),
        phase: Math.random() * Math.PI * 2,
        // 少量大星星带十字光芒
        flare: Math.random() > 0.94,
      };
    });
  }

  /* ---------- 流星 ---------- */
  function spawnMeteor() {
    const fromTop = Math.random() > 0.35;
    meteor = {
      x: fromTop ? gsap.utils.random(w * 0.1, w * 0.9) : -60,
      y: fromTop ? -40 : gsap.utils.random(h * 0.05, h * 0.45),
      vx: gsap.utils.random(3.4, 5.6),
      vy: gsap.utils.random(1.5, 2.6),
      life: 1,
      len: gsap.utils.random(90, 190),
    };
  }

  /* ---------- 每帧 ---------- */
  let t = 0;
  function render() {
    t += gsap.ticker.deltaRatio(60) / 60;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = reduce ? 1 : 0.62 + 0.38 * Math.sin(t * s.speed * 2.2 + s.phase);
      const a = s.alpha * tw;
      if (a <= 0.02) continue;

      const [r, g, b] = s.color;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      if (s.flare && tw > 0.85) {
        // 十字光芒：用一根渐变线省性能
        const len = s.r * 9 * (tw - 0.85) * 6;
        const grad = ctx.createLinearGradient(s.x - len, s.y, s.x + len, s.y);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${(a * 0.55).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(s.x - len, s.y);
        ctx.lineTo(s.x + len, s.y);
        ctx.moveTo(s.x, s.y - len);
        ctx.lineTo(s.x, s.y + len);
        ctx.stroke();
      }
    }

    /* 流星 */
    if (!reduce) {
      if (!meteor && t > nextMeteorAt) {
        spawnMeteor();
        nextMeteorAt = t + gsap.utils.random(4.5, 11);
      }
      if (meteor) {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= 0.008;
        const nx = meteor.x - meteor.vx * (meteor.len / 8);
        const ny = meteor.y - meteor.vy * (meteor.len / 8);
        const grad = ctx.createLinearGradient(meteor.x, meteor.y, nx, ny);
        grad.addColorStop(0, `rgba(255,246,225,${(0.85 * meteor.life).toFixed(3)})`);
        grad.addColorStop(0.35, `rgba(255,180,205,${(0.35 * meteor.life).toFixed(3)})`);
        grad.addColorStop(1, "rgba(255,180,205,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        if (meteor.life <= 0 || meteor.x > w + 160 || meteor.y > h + 160) meteor = null;
      }
    }
  }

  let running = true;
  build();
  render();

  gsap.ticker.add(render);
  window.addEventListener("resize", build, { passive: true });

  // 切到后台就停掉，省电
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      gsap.ticker.remove(render);
      running = false;
    } else if (!document.hidden && !running) {
      gsap.ticker.add(render);
      running = true;
    }
  });

  return { rebuild: build };
}
