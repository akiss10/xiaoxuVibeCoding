import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 只在 SELFTEST=1 / SHOTS=1 时，把 tools/ 下的开发脚本注入页面。
 * 走 Vite 插件而不是外部改文件，是为了让注入完全在 UTF-8 下进行，
 * 避免经过 PowerShell 时把中文和 HTML 结构弄坏。
 */
function injectTool(envName, file) {
  const abs = fileURLToPath(new URL(file, import.meta.url));
  return {
    name: `inject-${envName.toLowerCase()}`,
    apply: "build",
    transformIndexHtml(html) {
      if (process.env[envName] !== "1") return html;
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
  plugins: [
    injectTool("SELFTEST", "./tools/selftest.js"),
    injectTool("SHOTS", "./tools/screenshots.js"),
    injectTool("PROBE", "./tools/probebox.js"),
  ],
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});
