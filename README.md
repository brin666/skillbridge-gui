# SkillBridge

[产品官网与交互演示](https://brin666.github.io/skillbridge-gui/) · [复制启动指令说明](website/LAUNCH_PROMPT.md)

> Discover, understand, manage, and sync all your AI Skills.

SkillBridge is a local-first AI Skills visual management tool launched from an Agent Skill. It discovers AI agents on your computer, scans their installed Skills, and presents a dashboard.

## 当前 GUI：资料浏览与交接包

现已增加 Codex、Claude Code、Hermes、Pi 的统一资料整理入口，来源筛选沿用现有界面。运行 `python -m pip install -r scripts/requirements-inventory.txt` 后，使用 `powershell -NoProfile -File scripts/start-gui.ps1 -Refresh`。已有档案、自定义目录、覆盖范围和限制见[多 Harness 汇总说明](docs/harness-inventory.md)。

当前正式界面在 `ui/src/workspace/`，使用 Astryx 组件和已确认的 cart-v2 设计。支持 Skill、规则、记忆、MCP 和账本分类浏览，中文 Skill 用途、Codex 会话名称、持久化交接包、真实文件导出、后端提示词复制以及历史和接收报告。卡片悬停、搜索展开、分类切换及加入／移出动效已接入；点击右侧栏空白处可展开交接包。

Windows 本机启动需要 Python 3.11+、Node.js/npm；只有整理 Codex 资料时需要可用的 Codex CLI。从仓库根目录执行：

```powershell
python -m pip install -r scripts/requirements-inventory.txt
npm --prefix ui ci
powershell -NoProfile -File scripts/start-gui.ps1
```

打开 <http://127.0.0.1:5175/>。首次启动没有资料时显示空状态；主动整理本机四种 Harness 的资料时再执行：

```powershell
powershell -NoProfile -File scripts/start-gui.ps1 -Refresh
```

默认档案遵循 `SKILLBRIDGE_HOME` 或 `~/.skillbridge`，可通过 `-DataDir` 沿用已有档案的绝对目录；用 `-Project` 指定要整理的项目。原 `start-codex.ps1` 入口仍保留。源配置与记忆不写入仓库，运行时档案、导出包和浏览器测试证据保留在本机。npm 会按锁文件安装 Astryx，无需下载它的完整源码。

详细说明：[GUI 启动与操作](ui/README.md)、[Codex 资料接入](docs/codex-local.md)、[验证记录](ui/VALIDATION.md)。下方保留早期后端及 v0.1 dashboard 说明；当前 GUI 使用 workspace API。

## Cart handoff MVP — backend available

The new Python workspace backend stores a shared local profile, Agent reports, confirmed frequent preferences, and carts for Skills, rules, memories, MCP information and selected ledger records. It exports actual files, a manifest and a pasteable prompt. Frequent Skills are suggestions; explicit cart selection determines each handoff. Export checks file integrity, not universal Harness compatibility.

```powershell
python backend/main.py workspace status
python backend/main.py workspace serve --port 17321
```

The new API is `/api/v1`, bound to `127.0.0.1`. It uses `~/.skillbridge` by default; set `SKILLBRIDGE_HOME` or pass `workspace --data-dir D:/SkillBridgeData/dev` before a subcommand to isolate a development profile. Python 3.10+ is required; the workspace module uses the standard library. CLI commands also work without the HTTP server.

Start with [the backend API and GUI integration guide](docs/backend-api.md), [the documentation index](docs/README.md), and [product requirements](PRODUCT.md). The workspace GUI is implemented in `ui/src/workspace/`; see the current startup instructions above. Target installation, automatic rule conversion and real Harness validation are not implemented in this backend milestone. The sections below describe the retained v0.1 dashboard; its compatibility warmup and sync path are separate from the new workspace server.

## Retained v0.1 features

- [x] Phase 1: Project directory initialization
- [x] Phase 1: Backend base structure
- [x] Phase 1: `BaseAdapter` contract
- [x] Phase 1: Windows Agent Scanner
- [x] Phase 2: Unified Skill data model
- [x] Phase 2: Skill Scanner
- [x] Phase 2: SKILL.md Parser
- [x] Phase 2: Skill source detection
- [x] Phase 2: Rule-based summary generation
- [x] Phase 2: Cache system
- [x] Phase 2: Skills API
- [x] Phase 3: React + TypeScript + Vite + Tailwind + Motion UI
- [x] Phase 3: Dashboard / Skills / Skill Detail pages
- [x] Phase 3: Backend static file serving
- [x] Phase 3: Dashboard auto open browser
- [x] Phase 4A: Open Skill folder
- [x] Phase 4A: Open SKILL.md
- [x] Phase 4A: Enable / Disable Skill
- [x] Phase 4A: Safe uninstall to local trash
- [x] Phase 4A: Frontend management buttons
- [x] Phase 5A: Preflight safety check system
- [x] Phase 5A: Skill Detail Sync Check dialog
- [x] Phase 5B: Safe Sync + Temporary Install + Validation + Atomic Commit
- [x] Phase 5B: Sync API and Sync dialog flow
- [x] Phase 5C: Sync history persistence
- [x] Phase 5C: Batch sync to multiple Agents
- [x] Phase 5C: Sync progress / polling UI
- [x] Phase 5C: Sync History page
- [x] Phase 6A: Central Skill Library
- [x] Phase 6A: Import to Library
- [x] Phase 6A: Library deployment status
- [x] Phase 6A: Library → Agent Safe Deploy
- [x] Phase 6A: Library UI pages
- [x] Phase 6C: Frontend i18n (zh-CN / en-US)
- [x] Phase 6C: Language persistence
- [x] Phase 6C: Bilingual Skill summaries
- [x] Phase 6C: Summary cache migration
- [x] Mutual Harness sync: SKILL.md-only, static compatibility preflight, explicit opt-out respected
- [ ] Phase 6B: Marketplace / remote library / advanced conflict resolution

## Quick start

```bash
cd ui
npm install
npm run build
cd ..
python backend/main.py dashboard
```

Language is persisted in `localStorage` under `skillbridge.language`.

## i18n architecture

- `ui/src/i18n/index.ts`
- `ui/src/i18n/locales/zh-CN.json`
- `ui/src/i18n/locales/en-US.json`

## Summary architecture

- `backend/core/summary/manager.py`
- `backend/core/summary/rule_provider.py`
- `backend/core/summary/ai_provider.py` (placeholder)
- Skill model now contains `summaries: { "zh-CN": string, "en-US": string }`
- Cache entries now store `summaries`; old `summary` string is kept for compatibility.

## API endpoints

### Mutual Harness sync

On each app launch, SkillBridge runs a background, read-only compatibility precheck for the installed Harnesses and keeps the default all-Harness plan in memory. Opening the sync dialog reuses this warmed result; choosing a different subset runs a fresh plan using the warmed static-check cache. No files are changed during startup checks.

Files are written only after you click Sync. Current sync execution copies only `SKILL.md`, including library deployments. The preflight source check accepts an explicit opt-in such as:

```yaml
metadata:
  skillbridge-sync: allow
```

The current source check also passes an unspecified value; an explicit `deny`, `denied`, or `never` blocks it. Uncertain Harness support/version or local references can require review. Mutual sync does not overwrite different existing `SKILL.md` versions. Static preflight does not guarantee identical runtime behavior. The new workspace cart exporter uses its own complete-folder export path and does not call this legacy preflight.

### Read

- `GET /api/environment`
- `GET /api/agents`
- `GET /api/skills`
- `GET /api/skills/<id>`
- `GET /api/rescan`
- `GET /api/sync/mutual/warmup`

### Library

- `GET /api/library`
- `GET /api/library/skills/<id>`
- `POST /api/library/import`
- `POST /api/library/skills/<id>/deploy`
- `DELETE /api/library/skills/<id>`

### Management / Sync

- `POST /api/skills/<id>/open-folder`
- `POST /api/skills/<id>/open-file`
- `POST /api/skills/<id>/enable`
- `POST /api/skills/<id>/disable`
- `DELETE /api/skills/<id>`
- `POST /api/skills/<id>/preflight`
- `POST /api/skills/<id>/sync`
- `POST /api/skills/<id>/batch-sync`
- `POST /api/sync/mutual/plan`
- `POST /api/sync/mutual` (requires a current reviewed `planId`)
- `GET /api/sync/{transaction_id}`
- `GET /api/sync/history`

## Design rules

- Local First: all scanning/reading stays local.
- Server binds to `127.0.0.1` only.
- No `node_modules` in packaged Skill.
- Frontend is prebuilt into `ui/dist`.
- Library import is non-destructive.
- Library removal never uninstalls Agent copies.
- Library → Agent deployment reuses Safe Sync.
- UI strings are fully i18n-based; no hardcoded user-facing copy.
