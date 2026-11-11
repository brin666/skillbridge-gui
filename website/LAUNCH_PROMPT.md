# 复制给 Agent 的启动指令

官网“复制启动指令”按钮逐字复制 `src/launch-prompt.txt`；下方提示词块由 `npm.cmd run check` 检查一致性。它是交给可访问本机文件和终端的 Agent 的任务，不是粘贴进终端的命令，也不是 `curl` 下载后直接执行。启动脚本实测环境为 Windows + PowerShell；这不构成其他系统或 Agent 的兼容实测。

<!-- PROMPT:BEGIN -->
```text
请帮我安装并运行 SkillBridge：
https://github.com/brin666/skillbridge-gui

先检查当前系统、文件与终端权限、已有 SkillBridge 项目目录和资料档案。当前启动脚本实测环境是 Windows + PowerShell；其他操作系统请先依据项目文档说明脚本是否适用，不要改写脚本，也不要承诺自动兼容。执行这项任务的 Agent 可以是任何能访问本机文件、运行终端命令并遵循项目文档的 Agent；这不代表所有 Agent 或操作系统都经过实测。

读取项目的 README.md、SKILL.md 和 docs/harness-inventory.md。按文档下载完整项目；已有项目目录和档案时继续使用，不要重复下载或另建档案。按项目文档检查各来源依赖，确认 Python 3.11+、Node.js/npm 可用，并运行 python -m pip install -r scripts/requirements-inventory.txt 安装资料整理依赖。缺少基础运行环境时说明实际缺项，按当前 Agent 的权限安装或给出安装步骤。

整理本机 Codex、Claude Code、Hermes、Pi 中当前可读取的 Skills、记忆、规则和 MCP 配置，并保留来源信息。Codex Skill 通过 Codex CLI 查询；其他 Harness 的本地文件扫描不要求启动相应 Agent。Pi 扩展记忆、插件、受管配置和云端资料不会完整自动发现；无法自动发现的来源可在界面中人工登记。配置路径只被发现不代表会话已加载或 MCP 可连接。区分并说明发现或读取问题、尚未自动支持的资料、登记失败项；不要把未找到目录说成“已安装但没有能力”。

默认整理四种来源的用户目录和当前 SkillBridge 仓库对应的项目资料，不代表扫描电脑上的所有项目。只有在我明确给出要整理的现有项目后，才通过 -Project 指向该目录。

所有来源文件只读；源配置和记忆保持原样。不执行发现的 Skill，不启动或测试 MCP，不上传本机资料，也不自动生成或发送交接包。

使用项目已有的 workspace 后端和 GUI。先按文档确认依赖；在项目根目录执行 npm.cmd --prefix ui ci。Windows 上用 powershell -NoProfile -File scripts/start-gui.ps1 -Refresh 启动并整理资料；如需复用已确认的其他档案，再追加 -DataDir "<档案绝对路径>"。

- 默认整理来源为 all（Codex、Claude Code、Hermes、Pi）。
- 档案目录默认取 SKILLBRIDGE_HOME；未设置时使用 ~/.skillbridge。发现已有档案时通过 -DataDir 明确复用同一绝对路径，不要另建档案。例如，仅当确认 D:/SkillBridgeData/codex-local 是要沿用的档案时，才传入该路径。
- 首次整理加 -Refresh；只打开已有档案时不加。
- 默认端口为后端 17323、界面 5175。端口被其他服务占用时使用 -ApiPort / -GuiPort 换端口，不要终止其他进程。
- 如需预查，可运行 python scripts/harness_inventory.py --data-dir "<档案绝对路径>" --dry-run；指定项目时再加 --project "<我给出的现有项目目录>"。

为所有来源的 Skill 补齐中文名称和用途，保留原名。运行 python scripts/skill_translations.py prepare --data-dir "<档案绝对路径>" --output "<档案绝对路径>/skill-translations.pending.json"；根据其中的原描述逐条填写 titleZh 和 summaryZh，不改标识、版本和来源指纹，再运行 python scripts/skill_translations.py apply --data-dir "<档案绝对路径>" --input "<档案绝对路径>/skill-translations.pending.json"。由你直接完成翻译，不另接翻译服务；源文件不改，译文保存在本地档案。无可读用途或源文件变化时明确报告，不编造用途。刷新 GUI 清单核对中文用途和原名都能显示。

完成后打开启动脚本输出的地址，告诉我实际访问地址、档案目录，以及 harness-inventory.json 中按来源和类别统计的发现数、登记数与失败项，并说明中文简介补齐结果。分别说明读取/发现失败、未自动支持和登记失败。报告只代表本地资料盘点，不代表 Agent 会话加载或 MCP 实际调用成功。如果无法访问本机环境，请明确说明并给出本机执行步骤，不要用示例数据代替实际结果。
```
<!-- PROMPT:END -->

## 文案依据

| 内容 | 依据 |
|---|---|
| 自动整理 Codex、Claude Code、Hermes、Pi 的本地资料；默认来源为 `all` | `scripts/start-gui.ps1` 与 `scripts/harness_inventory.py` 的参数默认值 |
| 根据文档检查各来源依赖 | `docs/harness-inventory.md` 的启动与覆盖说明 |
| 所有来源的 Skill 补齐中文用途并保留原名 | `scripts/skill_translations.py` 导出与回填元信息；按原名和描述指纹缓存到本地档案，刷新时复用 |
| Python 3.11+、Node.js/npm、PyYAML | Codex 导入器使用 `tomllib`；前端依赖通过 npm 安装；`scripts/requirements-inventory.txt` 声明 PyYAML |
| 档案、端口与项目范围 | `start-gui.ps1` 默认 `SKILLBRIDGE_HOME` 或 `~/.skillbridge`、API 17323、GUI 5175；`-Project` 接收指定的现有目录，默认项目是当前 checkout，不是全盘扫描 |
| 指定已有档案 | `-DataDir` 可显式使用已存在的档案，例如用户确认要沿用时的 `D:/SkillBridgeData/codex-local` |
| Pi 扩展记忆、插件、受管或云端资料范围有限；未知来源可手工登记 | `docs/harness-inventory.md` 和 `scripts/harness_inventory.py` 的覆盖说明 |
| 不执行 Skill、不启动 MCP、不上传或自动创建交接包 | 启动脚本与整理器只盘点并登记本地资料；交接包需在 GUI 中另行操作 |
| 报告包含发现数、登记数和错误 | 整理结果写入档案中的 `harness-inventory.json`，每个来源包含状态和类别数量 |

`start-gui.ps1` 使用 Windows PowerShell 网络端口检查；目前没有承诺它在其他操作系统上自动适用。
