# Codex 本机资料接入

GUI：<http://127.0.0.1:5174/>。档案：`D:/SkillBridgeData/codex-local`。后端：`127.0.0.1:17322`。

现有 `5173` / `17321` 的 `gui-dev` 合成测试档案保留。正式 GUI 继续使用已确认的 cart-v2 外观和“交接包”名称。

## 在 Codex 中使用

本机入口已安装到 `C:/Users/BL/.agents/skills/skillbridge/SKILL.md`，依赖完整项目 `D:/skillbridge`。Codex CLI 的 `skills/list` 已实际识别该入口。新对话中可以说：

> 使用 skillbridge 整理我的 Codex 资料，并打开 GUI。

当前对话尚未刷新技能列表时，也可直接让 Codex 阅读上述文件。

启动并更新资料：

```powershell
powershell -NoProfile -File D:/skillbridge/scripts/start-codex.ps1 -Refresh
```

只打开已有资料时去掉 `-Refresh`。脚本会先验证端口服务与实际档案，复用匹配的服务；遇到其他服务占用会报错，不终止已有进程。默认不发布外网。

单独整理或预查：

```powershell
python D:/skillbridge/scripts/codex_inventory.py --data-dir D:/SkillBridgeData/codex-local
python D:/skillbridge/scripts/codex_inventory.py --data-dir D:/SkillBridgeData/codex-local --dry-run
```

需要 Python 3.11+、可用的 Codex CLI，以及项目现有的前端依赖。可传 `--project ABSOLUTE_PATH` 读取该项目对应的技能和规则；默认项目为本 checkout。

## 数据来源

- **Skills**：向本机 Codex app-server 请求当前项目的 `skills/list`，使用真实名称、路径、插件归属、启用状态和 scope。按规范化后的完整路径去重；同名不同路径保留。没有遍历所有缓存版本冒充已安装技能。
- **MCP**：全局与当前项目的 `config.toml` 中的每个服务，以及技能清单确认的插件中声明的 MCP。每项保留配置文件路径和 `serverName`；禁用项标题注明“已禁用”。Codex 的 `http_headers` / `env_http_headers` 映射为 workspace JSON 的 `headers`，凭据引用和字面值交给既有后端脱敏。不会读取环境变量中的凭据值。
- **记忆**：`memories` 和 `memories_v2` 中的 Markdown 文件，排除隐藏目录、衍生技能目录和链接。两个版本的存储分别标明；摘要中明确的 `cwd` 保留为项目范围，其余保留个人范围。展示名称按摘要中的会话 ID，从本机 Codex SQLite 只读查询对应 `name/title`，必要时用 `session_index.jsonl` 补充；不读取原始聊天或账号凭据，不修改 Codex 数据库。
- **规则**：Codex 全局 `AGENTS.md` / `AGENTS.override.md`、命令规则，以及当前项目及祖先目录的规则文件。
- **账本**：“Codex 资料整理记录”是本次实际登记清单、数量、来源、失败项与覆盖边界，不代表技能使用次数、性能、费用或排名。

所有资产通过现有 workspace 路由登记，复用身份、修订、脱敏和错误处理。没有改写后端 API 契约、源配置、源记忆或源 Skill。重复整理不改变常用偏好与交接包选择；已选修订不会被自动替换。不存在的旧记录保留，生成前由原有预览检查来源。

GUI 的文件来源详情仍遵循当前接口：展示元信息与文件清单；MCP 的脱敏 JSON、整理账本为内联资料，可直接查看正文。

## 中文用途与会话名称

用户确认 `previews/library-readability` 后，正式页面采用中文 Skill 名称释义、用途简介和可展开原文，记忆使用真实会话名或可读文档标题。中文简介在 `resources/catalog.zh-CN.json` 中维护，匹配原始 description 哈希；不在浏览时请求模型翻译。

`scripts/codex_inventory.py` 登记时通过已有 `environment.presentation` 可扩展元信息保存展示说明，不用译名替换资产标题，不改变身份或导出规则。展示元信息绑定对应源文件的 SHA-256，刷新后的文件不匹配时停用旧说明，显示真实资产原名；需要重新整理才能更新。中文内容是简要释义，不是完整逐字译文。

现有档案可只补充说明，不重新发现或登记其他资料：

```powershell
python D:/skillbridge/scripts/catalog_presentation.py --data-dir D:/SkillBridgeData/codex-local --codex-home D:/CodexData --apply
```

该命令读取当前 CLI 技能目录，仅处理已有可见的 Skill 和记忆。源文件变化时跳过并报告 `SOURCE_CHANGED`，不替换交接包中的修订；相同说明不重复写入。初次应用补充了 353 条说明（164 Skill、189 记忆），其中 177 份记忆匹配真实会话名。

正式列表按可见区域渲染；搜索索引、名称与日期格式化复用本地结果。按用户最新要求，保留 cart-v2 全套原有动效，包括悬停、搜索展开、分类进出场及交接包飞行；卡片入场延迟不随全部资料数量无限累计。加入状态由实际 HTTP 写入确认，写入中的按钮显示禁用；不等待动画，也不按动画时长吞掉后续点击。资料仍来自 `/api/v1/assets`，没有使用预览 JSON 或 mock 回退。

## 2026-11-11 首次实际接入

| 分类 | 发现 | 登记 | 默认 GUI 可见 |
|---|---:|---:|---:|
| Skill | 171 | 169 | 164 |
| 记忆 | 189 | 189 | 189 |
| MCP | 7 | 7 | 7 |
| 规则 | 2 | 2 | 2 |
| 整理账本 | 1 | 1 | 1 |

5 个系统 Skill 按既有规则默认隐藏且不能加入交接包。2 个 Skill 包含超过 32 MiB 的文件，被现有后端返回 `FILE_TOO_LARGE`，未伪装成已完整登记：

- `D:/CodexData/plugins/cache/chatcut-inc/chatcut/0.2.25/skills/asset-import`
- `C:/Users/BL/.agents/skills/local-background-removal`

可在 GUI 的“账本 → Codex 资料整理记录”查看完整结果，或读取 `D:/SkillBridgeData/codex-local/codex-inventory.json`。后续刷新时数量可能变化。

这份清单覆盖本机 Codex CLI 与所选项目的可读资料，不等于所有云端连接器、所有项目、正在运行的全部 Codex 会话或所有历史安装。MCP 配置已登记不代表连接成功；没有启动 MCP、执行 Skill 脚本、推断常用或自动生成真实资料交接包。

## 验证

- `python -m unittest discover -s tests -p test_codex_inventory.py -v`：检查路径身份、重复整理、来源不变、交接包修订和偏好不变、MCP 头字段脱敏、部分失败、记忆项目范围、可读整理账本。
- `npm.cmd run build`：类型检查及构建通过；保留现有 bundle 大小提示。
- 真实 HTTP：验证 GUI 代理连接 `codex-local`，逐个检查 23 个 MCP 字面值字段已替换为引用。
- 真实浏览器：五类数量、记忆搜索、来源与待确认状态、MCP 脱敏详情、整理记录中的失败项，以及 `skillbridge` 新入口均已查看。

导入器退出码：`0` 全部成功，`2` 部分失败但可用资料已登记，`1` 致命失败。详细报告只保留来源和错误码，不打印凭据内容。
