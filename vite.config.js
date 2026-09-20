import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 只在 SELFTEST=1 时把 tools/selftest.js 注入页面（用于无头浏览器验收）。
 * 走 Vite 插件而不是外部改 dist/index.html，是为了让注入完全在 UTF-8 下进行，
 * 避免经过 PowerShell 时把中文和 HTML 结构弄坏。
 * 正常 `npm run build` 不会带上它。
 */
function injectSelftest() {
  const abs = fileURLToPath(new URL("./tools/selftest.js", import.meta.url));
  return {
    name: "inject-selftest",
    apply: "build",
    transformIndexHtml(html) {
      if (process.env.SELFTEST !== "1") return html;
      return {
        html,
        tags: [
          {
            tag: "script",
            children: readFileSync(abs, "utf8"),
            injectTo: "body",
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [injectSelftest()],
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});
