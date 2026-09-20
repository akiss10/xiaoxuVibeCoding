/**
 * 光标跟随 + 花瓣 + 点击爱心
 * —— 高频更新的属性用 gsap.quickTo()，只复用同一个补间，不每帧新建
 */
import gsap from "gsap";

export function createCursor({ cursor, dot, glow }) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine) {
    gsap.set([cursor, dot, glow], { autoAlpha: 0 });
    return { setHot() {}, moveTo() {} };
  }

  gsap.set(glow, { autoAlpha: 0 });

  const cx = gsap.quickTo(cursor, "x", { duration: 0.42, ease: "power3" });
  const cy = gsap.quickTo(cursor, "y", { duration: 0.42, ease: "power3" });
  const dx = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power2" });
  const dy = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power2" });
  const gx = gsap.quickTo(glow, "x", { duration: 1.1, ease: "power3" });
  const gy = gsap.quickTo(glow, "y", { duration: 1.1, ease: "power3" });

  let shown = false;
  function move(e) {
    const x = e.clientX;
    const y = e.clientY;
    if (!shown) {
      shown = true;
      gsap.to([cursor, dot], { autoAlpha: 1, duration: 0.4 });
      gsap.to(glow, { autoAlpha: 1, duration: 1.4 });
      gsap.set([cursor, dot, glow], { x, y });
    }
    cx(x);
    cy(y);
    dx(x);
    dy(y);
    gx(x);
    gy(y);
  }

  document.addEventListener("pointermove", move, { passive: true });

  // 悬停到可点区域时，光圈收一下
  function setHot(hot) {
    cursor.classList.toggle("is-hot", hot);
    gsap.to(cursor, { scale: hot ? 1.7 : 1, duration: 0.35, ease: "power2.out" });
  }

  document.addEventListener(
    "pointerover",
    (e) => {
      if (e.target instanceof Element && e.target.closest("button, a, [data-hot]")) setHot(true);
    },
    { passive: true }
  );
  document.addEventListener(
    "pointerout",
    (e) => {
      if (e.target instanceof Element && e.target.closest("button, a, [data-hot]")) setHot(false);
    },
    { passive: true }
  );

  return { setHot, moveTo: (x, y) => move({ clientX: x, clientY: y }) };
}

/* ------------------------------------------------------------------ */
/* 飘落的花瓣                                                          */
/* ------------------------------------------------------------------ */
export function createPetals(host, count = 14) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "petal";
    const scale = gsap.utils.random(0.55, 1.25);
    gsap.set(el, { left: `${gsap.utils.random(2, 98)}%`, scale });

    const fall = () => {
      gsap.fromTo(
        el,
        { y: -60, x: 0, rotation: 0, autoAlpha: 0 },
        {
          y: window.innerHeight + 80,
          x: gsap.utils.random(-180, 180),
          rotation: gsap.utils.random(-260, 260),
          autoAlpha: gsap.utils.random(0.25, 0.7),
          duration: gsap.utils.random(13, 26),
          ease: "none",
          onComplete: fall,
        }
      );
    };
    gsap.delayedCall(gsap.utils.random(0, 14), fall);
    host.appendChild(el);
  }
}

/* ------------------------------------------------------------------ */
/* 点击冒爱心                                                          */
/* ------------------------------------------------------------------ */
export function createClickHearts(count = 8) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (reduce) return;
      const burst = gsap.utils.random(3, count, 1);
      for (let i = 0; i < burst; i++) {
        const el = document.createElement("span");
        el.className = "spark";
        document.body.appendChild(el);
        gsap.set(el, {
          left: e.clientX,
          top: e.clientY,
          scale: gsap.utils.random(0.4, 1),
          rotation: gsap.utils.random(-45, 45),
        });
        gsap.to(el, {
          x: gsap.utils.random(-130, 130),
          y: gsap.utils.random(-170, -60),
          rotation: gsap.utils.random(-160, 160),
          scale: 0,
          autoAlpha: 0,
          duration: gsap.utils.random(0.9, 1.8),
          ease: "power2.out",
          onComplete: () => el.remove(),
        });
      }
    },
    { passive: true }
  );
}

/* ------------------------------------------------------------------ */
/* 爱心爆炸（终章用）                                                  */
/* ------------------------------------------------------------------ */
export function heartExplosion(x = window.innerWidth / 2, y = window.innerHeight / 2, n = 90) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.className = "spark";
    const size = gsap.utils.random(7, 22);
    document.body.appendChild(el);

    const angle = (i / n) * Math.PI * 2 + gsap.utils.random(-0.2, 0.2);
    const dist = gsap.utils.random(90, Math.max(window.innerWidth, 620) * 0.55);

    gsap.set(el, {
      left: x,
      top: y,
      width: size,
      height: size,
      margin: `${-size / 2}px 0 0 ${-size / 2}px`,
      scale: 0,
    });

    gsap
      .timeline({ onComplete: () => el.remove() })
      .to(el, { scale: 1, duration: 0.24, ease: "back.out(3)" })
      .to(
        el,
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist + gsap.utils.random(-40, 120), // 稍微受重力影响
          rotation: gsap.utils.random(-220, 220),
          duration: gsap.utils.random(1.5, 3),
          ease: "power2.out",
        },
        "<"
      )
      .to(el, { autoAlpha: 0, scale: 0.2, duration: 1, ease: "power1.in" }, "-=1.2");
  }

  // 中心的一圈冲击波
  const ring = document.createElement("span");
  ring.className = "spark";
  document.body.appendChild(ring);
  gsap.set(ring, {
    left: x,
    top: y,
    width: 40,
    height: 40,
    margin: "-20px 0 0 -20px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,92,138,.75), transparent 70%)",
  });
  gsap.to(ring, {
    scale: 26,
    autoAlpha: 0,
    duration: 1.1,
    ease: "power2.out",
    onComplete: () => ring.remove(),
  });
}
