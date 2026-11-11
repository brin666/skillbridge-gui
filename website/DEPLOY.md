# SkillBridge 官网：预览、构建与 GitHub Pages 部署

官网放在独立的 `website/`，只负责介绍、演示和提供“复制启动指令”。它是纯静态页面：不请求访客的 localhost，不读取本机文件，没有注册、登录、付费或邮箱收集。页面中的界面演示全部是虚构的示例数据，已在页面上标明“示例数据”。

现有 `ui/`、`backend/`、`scripts/` 都没有改动。

> 当前状态：**尚未部署**。下面写的 Pages 地址是“部署成功后预计的地址”，现在打开会是 404。

## 1. 本地预览（Windows）

```powershell
cd D:\skillbridge\website
npm.cmd ci
npm.cmd run dev
```

打开 <http://127.0.0.1:17351/>。端口被占用时，开发服务器会直接报错退出，不会改用其他端口，也不会结束已有进程。

依赖从 `registry.npmmirror.com` 安装（`website/.npmrc` 和 `package-lock.json` 都指向它，和 `previews/cart-v2` 一致）。

## 2. 按 Pages 子路径构建和预览

```powershell
npm.cmd run build      # 生成 dist/，资源路径以 /skillbridge-gui/ 开头
npm.cmd run preview    # 打开 http://127.0.0.1:17351/skillbridge-gui/
```

`preview` 和 `dev` 用同一个端口，先停掉 `dev` 再运行。

- 换仓库名或用自定义域名时，可以设置 `SITE_BASE`，例如 `$env:SITE_BASE='/'; npm.cmd run build`。
- 想在根路径打开构建结果，可以运行 `npm.cmd run build:local`。
- `npm.cmd run check` 会核对 `LAUNCH_PROMPT.md` 和页面实际复制的指令（`src/launch-prompt.txt`）是否一字不差。

构建产物只包含 `index.html`、`favicon.svg` 和 `assets/` 下的一个 JS 和一个 CSS 文件，不含 `ui/`、`backend/`、本机档案、测试截图或任何真实资料。

## 3. GitHub Pages 设置步骤（需要你确认后再做）

工作流文件是 `.github/workflows/pages.yml`。它只在 `website/` 里运行 `npm ci` 和 `npm run build`，只上传 `website/dist`（`actions/upload-pages-artifact` + `actions/deploy-pages`）。触发条件是：推送到 `main` 且改动了 `website/**` 或工作流文件本身，或者在 Actions 页面手动运行（`workflow_dispatch`）。构建时用仓库名作子路径，所以在 `skillbridge-gui` 仓库里就是 `/skillbridge-gui/`。

1. 把 `website/`（不含 `node_modules/`、`dist/`）和 `.github/workflows/pages.yml` 提交并推送到 `brin666/skillbridge-gui` 的 `main`。根目录 `.gitignore` 已经忽略了 `node_modules/` 和 `dist/`。
2. 打开仓库 **Settings → Pages → Build and deployment**，把 **Source** 选成 **GitHub Actions**。
3. 到 **Actions → Deploy website to GitHub Pages**，点 **Run workflow**（第 1 步的推送本身也会触发一次）。
4. 运行成功后，预计地址是 `https://brin666.github.io/skillbridge-gui/`。确认能打开以后，再把它填到仓库的 About → Website，或写进 README。

## 4. 仓库可见性核查（2026-11-11 约 02:00，美东时间）

| 项目 | 结果 |
|---|---|
| `brin666/skillbridge-gui` | **公开**（public），默认分支 `main`，许可证 MIT；创建并推送于 2026-11-11 01:49（美东时间），目前只有 1 个提交 `add994df`（Publish SkillBridge workspace GUI and Codex integration） |
| 普通访客能否下载 | **可以**。未登录访问 `https://github.com/brin666/skillbridge-gui` 返回 200，`https://codeload.github.com/brin666/skillbridge-gui/zip/refs/heads/main` 返回 200。下载解压后与本机快照逐个比对（忽略换行符差异）：内容一致，只有远端多一个 `cache/.gitkeep`、本机多一个被忽略的 `ui/.uizze` |
| 启动所需文件是否在远端 | 在。`README.md`、`SKILL.md`、`docs/codex-local.md`、`docs/backend-api.md`、`scripts/start-codex.ps1`、`scripts/codex_inventory.py`、`backend/workspace/`、`ui/src/workspace/` 都已在 `main` 上 |
| Pages | 未启用（`has_pages: false`）；仓库里没有任何 Actions 工作流 |
| `website/`、`pages.yml` | 不在远端，只在这次交付里 |
| `brin666/skillbridge`（旧仓库） | 也是公开的，最后推送于 2026-10-13，没有 workspace GUI、`docs/`、`scripts/` |

## 5. 公开分发和 Pages 还差什么

1. **官网代码没推送**：`website/` 和 `.github/workflows/pages.yml` 还不在任何远端仓库里。
2. **Pages 没开**：要在 Settings → Pages 把 Source 改成 GitHub Actions。
3. **本机 git 远端指向旧仓库**：据了解，`D:\skillbridge` 的 `origin` 是 `https://github.com/brin666/skillbridge.git`，而官网和启动指令用的是 `skillbridge-gui`。推送前要确认推到哪个仓库，比如加一个指向 `skillbridge-gui` 的远端。这一点我没能直接核对，因为快照里没有 `.git`。
4. **只支持 Windows**：启动脚本依赖 PowerShell 和 `Get-NetTCPConnection`，默认档案目录在 D 盘。macOS、Linux 用户目前没有可用的一键入口，指令里已经要求 Agent 先说明情况。
5. **没有发布版本**：仓库没有 tag 或 release，访客拿到的是 `main` 的最新代码。建议给能用的版本打 tag，并在 README 里写清楚。
6. **公开文档里有个人路径**：`docs/codex-local.md`、`docs/current-state.md`、`docs/frequent-skills-proposal.md`、`previews/library-readability/README.md` 写了 `C:/Users/BL/...`、`D:/CodexData/...` 这类本机路径；`resources/catalog.zh-CN.json` 列出了本机装过的 Skill 名称。这些不是凭据，我也没有扫到 token 或私钥格式的字符串，但它们已经公开了，要不要处理由你决定。官网本身不包含这些内容。
7. **仓库安全设置**：Secret scanning 和 push protection 都是关闭状态，建议在公开分发前打开。
8. **依赖源**：`package-lock.json` 的下载地址是 npmmirror，GitHub Actions 也会从 npmmirror 下载。在本机环境中，干净安装和构建都已跑通，但 GitHub 机房访问 npmmirror 的速度没验证过。如果 CI 太慢或失败，可以用 npmjs 源重新生成锁文件。

## 6. 已核对的内容

都是在无头 Chromium 里跑的，开发服务器和 `/skillbridge-gui/` 子路径下的构建产物各跑一遍，50/50 通过，没有控制台错误，也没有 4xx/5xx 请求：

- 复制成功：授予剪贴板权限后，剪贴板内容和启动指令一字不差。“已复制”要等写入的 promise 完成后才出现（把写入人为延迟 900ms 也测过），约 2.6 秒后恢复。
- 复制失败：写入被拒绝、或者浏览器没有剪贴板 API 时，按钮不显示“已复制”，而是显示一个已经全选并聚焦的全文文本框，可以手动复制。
- “查看完整指令”能展开和收起，内容和复制的一致。
- 演示：五个分类都能切换；按名称、原名和用途都能搜到，没有结果时显示空状态；加入、移出和撤回都正常；点右侧栏空白处能展开交接包；交接预览和示例提示词都标了“示例数据”；MCP 详情写明“未检查”连接；按 Esc 能关闭。
- 390px 窄屏：页面没有横向溢出；分类变成顶部横条，交接包变成底部按钮和抽屉。
- 减少动态效果（系统设置或演示里的按钮）：没有飞行动画，卡片不倾斜，主视觉停在“已加入 2 项”的静止状态，加入后立即生效并有文字提示。
- 外部链接：`https://github.com/brin666/skillbridge-gui` 未登录也返回 200。

## 7. 没有验证的部分

- 没有在 GitHub 上真正运行过这个工作流，也没有真正部署过 Pages。
- 没在你的 Windows 电脑、Chrome 和中文字体下看过实际效果，也没在真机触屏、Safari 或 Firefox 上测过剪贴板。
- 没有让任何 Agent 在一台全新的 Windows 电脑上把启动指令完整执行一遍。
