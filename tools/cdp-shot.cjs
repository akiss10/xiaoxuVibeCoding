/**
 * 用 Chrome DevTools Protocol 抓真实渲染像素 + 控制台报错。
 * 这是唯一能确认"用户到底看到什么"的办法 —— 普通 --screenshot 有时拿不到真实合成结果。
 *
 * 用法: node tools/cdp-shot.cjs <url> <输出png> [等待毫秒]
 */
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [, , url = "http://localhost:4173/", out = "shot.png", waitMs = "3000"] = process.argv;

const port = 9333;
const profile = path.join(__dirname, "..", "_cdp-profile");

const get = (p) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path: p }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error("bad json: " + d.slice(0, 200)));
          }
        });
      })
      .on("error", reject);
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1440,900",
      "--hide-scrollbars",
      url,
    ],
    { stdio: "ignore" }
  );

  // 等调试端口起来
  let version = null;
  for (let i = 0; i < 40 && !version; i++) {
    await sleep(300);
    try {
      version = await get("/json/version");
    } catch {
      /* 还没起来 */
    }
  }
  if (!version) {
    console.log("无法连接调试端口");
    chrome.kill();
    process.exit(1);
  }

  const targets = await get("/json/list");
  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.log("没有找到 page target");
    chrome.kill();
    process.exit(1);
  }

  const WS = require("node:worker_threads"); // 只为确认 node 版本能力
  const ws = new (require("node:events").EventEmitter)();
  void WS;

  // 用原生 WebSocket（Node 22+ 自带）
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      socket.send(JSON.stringify({ id: mid, method, params }));
    });

  socket.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? a.type)
        .join(" ");
      logs.push(`[${msg.params.type}] ${text}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      logs.push(`[exception] ${msg.params.exceptionDetails?.exception?.description || "?"}`);
    }
  });

  await new Promise((r) => socket.addEventListener("open", r));
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.bringToFront");

  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    return r && r.result ? r.result.value : undefined;
  };

  await sleep(Number(waitMs));

  // 若 URL 带 ?play=秒数，就真实播放到那个时间点再截图（而不是定点 seek）
  const m = url.match(/[?&]play=([\d.]+)/);
  if (m) {
    const target = Number(m[1]);
    await evalJs(`(() => {
      const btn = document.querySelector("#enterBtn"); if (btn) btn.click();
      return true;
    })()`);
    const t0 = Date.now();
    let last = -1;
    while (Date.now() - t0 < 60000) {
      await sleep(300);
      const t = await evalJs(`window.__T && window.__T.master ? window.__T.master.time() : -1`);
      if (t >= target) break;
      last = t;
    }
    console.log(`PLAY 到达 t=${await evalJs(`window.__T.master.time().toFixed(2)`)} (目标 ${target})`);
    await evalJs(`window.__T.master.pause()`);
    await sleep(300);
  }

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  if (shot && shot.data) {
    fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log("已保存截图: " + out);
  } else {
    console.log("截图失败");
  }

  // 顺便把关键元素的可见性也报一下
  const probe = await send("Runtime.evaluate", {
    expression: `(() => {
      const rep = (sel) => {
        const n = document.querySelector(sel);
        if (!n) return sel + ":MISSING";
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return sel + "(op=" + (parseFloat(cs.opacity).toFixed(2)) + ",vis=" + cs.visibility +
          ",color=" + cs.color + ",fill=" + cs.webkitTextFillColor + ",box=" +
          r.left.toFixed(0) + "," + r.top.toFixed(0) + " " + r.width.toFixed(0) + "x" + r.height.toFixed(0) + ")";
      };
      return [".eyebrow", "#coverTitle", ".cover-title .char", ".cover-heart", "#coverSub", "#enterBtn", "#coverTip"]
        .map(rep).join(" | ");
    })()`,
    returnByValue: true,
  });
  console.log("DOM: " + (probe && probe.result && probe.result.value));

  const fonts = await send("Runtime.evaluate", {
    expression: `document.fonts.status + " | 字体数=" + document.fonts.size`,
    returnByValue: true,
  });
  console.log("字体: " + (fonts && fonts.result && fonts.result.value));

  console.log("--- 控制台 ---");
  console.log(logs.length ? logs.join("\n") : "(无输出)");

  socket.close();
  chrome.kill();
  process.exit(0);
})();
