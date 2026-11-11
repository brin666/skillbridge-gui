# 复制给 Agent 的启动指令

官网“复制启动指令”按钮写入剪贴板的就是下面这段文字（源文件：`src/launch-prompt.txt`，`npm run check` 会核对两处一致）。它是交给本机 Agent 的自然语言任务，不是让用户粘贴进终端的命令，也没有“curl 下载后直接执行”的一行命令。

<!-- PROMPT:BEGIN -->
```text
请帮我安装并运行 SkillBridge：
https://github.com/brin666/skillbridge-gui

先检查当前系统、终端权限和已有安装。首版已验证的环境是 Windows + PowerShell + Codex；如果我的系统不是 Windows，请先告诉我现有启动脚本是否适用，不要擅自改写脚本。读取项目的 README.md、SKILL.md 和 docs/codex-local.md，按实际文档下载完整项目（git clone 或 GitHub 压缩包均可）。电脑上已有 SkillBridge 时，复用原有目录和档案，不要重复下载或另建档案。

确认 Python 3.11+、Node.js/npm 和 Codex CLI 可用；在项目根目录用 npm --prefix ui ci 安装界面依赖。缺少的软件请先告诉我，经我同意再安装。

整理当前支持且可读取的 Agent 资料。目前自动整理只覆盖本机 Codex：Skills、记忆、规则和 MCP 配置。即使你本身不是 Codex，也只整理本机 Codex 的资料，并说明你自己的资料尚未支持自动整理。展示来源、用途和实际发现的问题；读取失败、尚未支持和登记失败的部分请分别说明。

源配置和记忆保持原样，不执行发现的 Skill，不启动或测试 MCP，不上传本机资料，也不自动生成或发送交接包。

使用项目已有的 workspace 后端和 GUI：运行 scripts/start-codex.ps1，并用 -DataDir 指定一个本机可写的绝对路径作为档案目录（脚本默认是 D:/SkillBridgeData/codex-local）；首次整理加 -Refresh，需要预查时可先运行 python scripts/codex_inventory.py --data-dir "<同一个档案目录的绝对路径>" --dry-run。默认端口是后端 17322、界面 5174；脚本会检查端口并复用匹配的服务。端口被其他程序占用时，换用 -ApiPort / -GuiPort，不要终止其他进程。

完成后在浏览器打开脚本输出的地址，并告诉我实际访问地址、档案目录，以及档案中 codex-inventory.json 记录的各类数量和失败项。MCP 配置被登记不代表连接成功。

如果你无法访问我的本机环境，请明确说明，并给我本机执行步骤。不要用示例数据代替实际结果。
```
<!-- PROMPT:END -->

## 相对原稿的改动和原因

| 改动 | 原因（核对来源） |
|---|---|
| 写明“首版已验证 Windows + PowerShell + Codex”，非 Windows 先说明、不擅自改脚本 | `scripts/start-codex.ps1` 用 PowerShell 和 `Get-NetTCPConnection`，只适用于 Windows；`metadata.json` 的 platforms 只有 windows |
| 写明下载方式“git clone 或 GitHub 压缩包” | 2026-11-11 核对：`brin666/skillbridge-gui` 为公开仓库，未登录也能打开页面并下载 main 分支 zip |
| 点名 Python 3.11+、Node.js/npm、Codex CLI，以及 `npm --prefix ui ci` | README.md 与 docs/codex-local.md；`scripts/codex_inventory.py` 依赖 `tomllib`（3.11+），并通过 `codex app-server` 读取技能清单，找不到 CLI 时报 `CODEX_NOT_FOUND`；启动脚本直接运行 `ui/node_modules/vite` |
| 缺少软件时“先告诉我，经我同意再安装” | 原稿要求“安装必要依赖”；为避免 Agent 自行装系统级软件，加了确认步骤 |
| 明确“目前自动整理只覆盖本机 Codex”，执行任务的 Agent 不是 Codex 时也只整理 Codex，并说明自己的资料尚未支持 | 启动脚本的 `-Refresh` 只调用 `codex_inventory.py`；没有 Claude、Cursor 等的记忆／规则／MCP 自动整理入口。区分“执行启动的 Agent”和“被整理资料的 Agent” |
| “MCP”改为“MCP 配置”，并加“MCP 配置被登记不代表连接成功” | `codex_inventory.py` 只读取 `config.toml` 与插件声明，文档写明不启动、不测试连接 |
| “不启动 MCP”改为“不启动或测试 MCP” | 同上 |
| 指定用 `scripts/start-codex.ps1`，用 `-DataDir` 给本机可写的绝对路径；注明默认值 `D:/SkillBridgeData/codex-local` | 脚本参数；默认路径在没有 D 盘的电脑上会失败；`codex_inventory.py` 要求 `--data-dir` 为绝对路径 |
| 首次整理加 `-Refresh`；可先 `codex_inventory.py --dry-run` 预查 | 不加 `-Refresh` 只打开已有档案；`--dry-run` 只发现、不写档案 |
| 写明默认端口 17322／5174，占用时换 `-ApiPort` / `-GuiPort`，不终止其他进程 | 脚本先用 `/api/v1/status` 的 `dataHome` 判断端口上的服务是否属于同一档案，匹配则复用，否则报错且不结束任何进程 |
| “返回实际访问地址和简要整理结果”具体化为：脚本输出的地址、档案目录、`codex-inventory.json` 的数量和失败项 | 脚本输出 `SkillBridge: http://127.0.0.1:<端口>/` 与 `Profile: <目录>`；整理报告保存在档案目录的 `codex-inventory.json`，含 discovered／registered／errors |
| 删掉了“复用已有安装和档案”中笼统的说法，改成“已有 SkillBridge 时复用原有目录和档案，不重复下载或另建档案” | 启动脚本按档案路径识别服务；换档案目录会被当成另一份档案 |
| 保留原稿：读取 README、SKILL.md、docs/codex-local.md；源配置和记忆保持原样；不执行 Skill；不上传；不自动生成或发送交接包；无法访问本机时说明并给步骤；不用示例数据代替结果 | 三个文件都在公开仓库根目录与 docs/ 中；其余是行为约束，与代码一致 |

## 没有核对到的部分

- 没有在一台全新的 Windows 电脑上，让 Agent 从头执行这段指令。
- `codex app-server` 自身在读取技能清单时会做什么，属于 Codex CLI 的行为，本项目代码无法证明。
- 启动脚本只整理 SkillBridge 自己这个目录对应的“项目级”技能和规则（`--project` 传的是项目根目录）。整理其他项目要单独运行 `codex_inventory.py --project`，指令里没有展开。
