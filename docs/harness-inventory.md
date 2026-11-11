# 多 Harness 资料汇总

将 Codex、Claude Code、Hermes、Pi 的本地资料登记到同一档案，沿用现有分类、来源筛选、常用确认及交接包。资料整理只在显式运行时发生；切换页面、输入搜索和刷新清单都不重新扫描。

## 启动

Python 3.11+、Node.js/npm。Codex 目录使用已安装 CLI 的 `skills/list`；其他三种来源直接读取明确的本地文件，不需要启动 Agent。YAML 配置和 Skill 文档头使用 PyYAML：

```powershell
python -m pip install -r scripts/requirements-inventory.txt
npm.cmd --prefix ui ci
powershell -NoProfile -File scripts/start-gui.ps1 -Refresh
```

默认地址 `http://127.0.0.1:5175/`，API 17323；档案采用 `SKILLBRIDGE_HOME` 或 `~/.skillbridge`。不传 `-Refresh` 只打开已有资料。启动器会核对端口对应的档案，不结束其他进程。

继续使用已有 Codex GUI 的档案和端口：

```powershell
powershell -NoProfile -File scripts/start-gui.ps1 -DataDir D:/SkillBridgeData/codex-local -ApiPort 17322 -GuiPort 5174 -Refresh
```

选择来源、项目或不同配置目录：

```powershell
python scripts/harness_inventory.py --data-dir D:/SkillBridgeData/my-profile --project D:/my-project --harness claude hermes pi --dry-run
python scripts/harness_inventory.py --data-dir D:/SkillBridgeData/my-profile --project D:/my-project --harness all --hermes-home D:/HermesData --pi-home D:/PiData/agent
```

`--dry-run` 不创建档案；省略它才登记。默认目录分别遵循 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`、`HERMES_HOME`、`PI_CODING_AGENT_DIR`，或各应用的标准用户目录。Hermes 多 profile 可通过 `--hermes-home` 分次整理到同一档案。返回码 0 表示没有报告错误；2 表示部分失败，仍保留成功项。

## 首版覆盖

| 来源 | Skills | 规则 | 记忆 | MCP |
| --- | --- | --- | --- | --- |
| Codex | CLI 对当前项目返回的实际目录 | 全局、项目祖先 AGENTS 与全局命令规则 | memories、memories_v2；可用时读取记忆关联的会话名称 | 全局／项目 TOML，以及 CLI 报告的插件配置 |
| Claude Code | 用户及当前项目祖先的 .claude/skills | CLAUDE.md、CLAUDE.local.md、.claude/rules | projects/*/memory 与明确配置的 autoMemoryDirectory | .claude.json 中用户及当前项目项、项目 .mcp.json |
| Hermes | 当前 home/skills、配置的 external_dirs/create_dir、项目 .hermes/skills 和 .agents/skills | SOUL.md、项目祖先的 .hermes.md/HERMES.md/AGENTS.md/CLAUDE.md | 当前 home/memories 下 Markdown | config.yaml 的 mcp_servers 转为 JSON 后交给现有后端处理 |
| Pi | agent/skills、.pi/skills、.agents/skills、settings.json 中普通路径 | 全局／项目上下文文件与 SYSTEM.md、APPEND_SYSTEM.md | 无统一扩展记忆目录，需明确登记 | agent/mcp.json、项目 .pi/mcp.json |

这些是本地资料候选，不模拟各应用的加载优先级、项目授权、插件激活或运行会话。禁用 MCP 保留禁用标记；Pi 的单字段项目覆盖保留为原配置片段，不合成为另一份运行配置。已知 Hermes bundled 清单中的系统 Skill 默认排除。

Claude 插件、受管配置、远程／云端资料，以及 Pi 插件包和记忆扩展不自动探测。独立 Markdown 命令不能冒充含完整目录的 Skill。含变量或 glob 的额外路径需明确指定实际位置；目录链接不会被静默跟随。可在现有“整理与登记”面板补充任意 Harness 的明确文件或 Skill 目录，因此不限制只能使用上述四种名称。

## 数据和显示

- 资产身份、修订、凭据清理、常用偏好及交接导出继续使用 workspace 的原契约。同名不同文件保持独立；同一文件由多个 Harness 引用时，合并来源关系，不重复计入交接包。
- `environment.sources` 保存观察到的 Harness／Agent／配置目录关系。原 `environment.harness` 保留为兼容字段。来源筛选、搜索及常用范围使用完整来源集合；单独刷新一个来源不会擦掉其他来源关系。
- 原有中文 Skill 简介仅在名称及描述指纹匹配时复用。未覆盖的资料显示原描述和“尚未准备中文简介”；记忆优先显示文档标题，不能把编码目录猜成项目名称或会话名。
- 不自动移除历史登记和来源关系，不重写草稿里的修订，也不改动常用标记。源文件变化由交接预览继续报告 `SOURCE_CHANGED`。
- `harness-inventory.json` 和“跨应用资料整理记录”账本保存本次发现、部分失败和覆盖限制。无目录显示 `not_found`，不是“已安装但没有能力”。已生成包、已复制、目标读取与实际调用验证保持区分。

## 已知接口边界

`POST /scan` 仍只扫描 Skill。多 Harness 全量整理目前从 CLI／启动器触发，GUI 的刷新只重新读取登记结果。未另建后端扫描契约或静默 mock 回退。

文件来源登记尚无元数据专用的带版本更新接口；使用已有 `POST /assets`，遵循其行为。多来源关系属于可选 environment 元数据，读取后合并不是跨进程原子操作；不要并发运行两个整理命令。缺少来源撤销／完整刷新事务接口，因此不自动删除旧来源。

原后端文件大小、文件数量和敏感内容限制仍适用；失败项不会用虚构正文或路径替代。目录链接需用户明确选择真实目录。Pi 扩展记忆没有统一可用的读取契约。

## 格式依据

核对日期：2026-11-11。本地不同版本的格式可能有差异。

- Claude Code：[Skills](https://code.claude.com/docs/en/skills)、[记忆](https://code.claude.com/docs/en/memory)、[MCP](https://code.claude.com/docs/en/mcp)。
- Hermes：[Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)、[记忆](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)、[MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)、[上下文文件](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)。
- Pi：[配置目录](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/configuration.md)、[Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)、[MCP](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md)。
