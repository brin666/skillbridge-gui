# SkillBridge 官网（website/）

正式网址：<https://brin666.github.io/skillbridge-gui/>，已于 2026-11-11 发布。

静态产品官网：首屏、复制启动指令、界面演示（Codex 合成示例数据）和能力范围。产品支持整理 Codex、Claude Code、Hermes、Pi 的可读取本地资料；官网演示不读取用户电脑。React 19 + Vite 5 + Astryx 0.7.13，视觉与动效沿用 `previews/cart-v2`。

- 本地预览：`npm.cmd ci`，然后 `npm.cmd run dev`，打开 <http://127.0.0.1:17351/>
- 构建：`npm.cmd run build`，产物在 `dist/`，默认子路径 `/skillbridge-gui/`
- 部署说明：[DEPLOY.md](DEPLOY.md)
- 启动指令全文和核对说明：[LAUNCH_PROMPT.md](LAUNCH_PROMPT.md)

目录：`src/main.jsx` 是页面本体；`src/demo/` 是界面演示（`data.js` 全部是虚构数据）；`src/launch-prompt.txt` 是复制按钮写入剪贴板的原文。
