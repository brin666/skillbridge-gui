# MVP 后端与 GUI 接入

实现版本：0.2.0-mvp，2026-11-11。本文描述已实现的 CLI、HTTP 和数据字段。产品完整目标见 [PRODUCT.md](../PRODUCT.md)。新版 GUI 在另一会话开发，本轮没有修改 ui/。

## 启动与数据目录

在项目根目录运行（Python 3.10+，本模块仅使用标准库）：

```powershell
python backend/main.py workspace serve --port 17321
```

监听 http://127.0.0.1:17321，接口前缀 /api/v1。不自动扫描，也不启动旧兼容性预热。开发中的 GUI 通过 Vite 的 /api 代理访问；请求使用相对 URL，不要求跨域配置。旧 dashboard 与此服务不能同时占用 17321。

所有入口按同一顺序解析档案位置：CLI 的 --data-dir → SKILLBRIDGE_HOME 环境变量 → 当前系统用户的 ~/.skillbridge。显式路径必须是绝对路径；无效时返回错误。

```powershell
# 为 GUI 联调创建独立测试档案；不要放到源码仓库内。
python backend/main.py workspace --data-dir D:/SkillBridgeData/dev serve
python backend/main.py workspace --data-dir D:/SkillBridgeData/dev status
```

数据目录包含 profile.sqlite3、COMMON_SKILLS.md、handoffs/<package-id>/。SQLite schemaVersion=1；旧 cache、library、history 原样保留，不自动迁移。另一应用使用同一系统用户与数据目录即可读取已有档案。不同设置会产生独立档案。

## HTTP 通用约定

- GET 列表返回 {"items": [...]}，扫描和预览有专用形状。单对象与写入操作直接返回对象。
- POST、PUT、PATCH、DELETE 必须带 Content-Type: application/json；无参数时发送 {}。请求上限 8 MiB。
- 只允许 loopback Host／Origin。没有浏览器跨域通配授权，GUI 使用同源或开发代理。
- ID 由后端生成；报告 ID 和 requestId 由调用方生成，限定 1–120 个字母、数字、点、下划线、冒号或连字符。
- 时间为 UTC ISO 8601。version 是并发控制整数，不是内容版本。revisionId 是内容指纹对应的修订。
- 可修改草稿和偏好需要 expectedVersion；409 VERSION_CONFLICT 时重新读取并让用户核对，不盲目覆盖。
- 错误形状：{"code":"VERSION_CONFLICT","message":"...","details":{"currentVersion":3}}。details 可省略。GUI 依据 code 显示中文消息。

## 路由一览

下列路径均相对 /api/v1。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | /status | 数据根目录、版本、数量和能力 |
| GET | /environments | 曾经发现的环境位置；version 可为 null |
| POST | /scan | 指定目录扫描或按已有适配器发现 Skill 位置 |
| GET／POST | /assets | 列表／登记资料 |
| GET／PATCH | /assets/:id | 详情／改标题、确认状态、归档状态 |
| POST | /assets/:id/refresh | 重新读取文件来源，生成当前修订 |
| GET／POST | /reports | Agent 观察、推荐与草稿引用 |
| GET | /preferences | 用户确认过的常用偏好 |
| PUT | /preferences/:assetId | 确认／取消指定范围的常用偏好 |
| GET | /profile/common-skills | 重新生成并返回可读档案 {path, content} |
| GET／POST | /carts | 草稿列表／新建 |
| GET／PATCH | /carts/:id | 读取／更新任务、项目、目标提示、操作范围 |
| POST | /carts/:id/items | 加入或更新一个选择项 |
| DELETE | /carts/:id/items/:assetId | 移除选择项 |
| DELETE | /carts/:id/items | 清空草稿 |
| POST | /carts/:id/preview | 核对所选资料、文件及待补事项 |
| POST | /carts/:id/export | 创建导出任务 |
| GET | /exports、/exports/:id | 导出列表／轮询任务 |
| POST | /exports/:id/cancel | 请求取消尚未完成的任务 |
| GET | /packages、/packages/:id | 包记录列表／清单与提示词 |
| GET | /packages/:id/prompt | 可复制文本 {packageId, path, text} |
| GET | /packages/:id/verify | 文件完整性 {valid, problems, runtimeVerified:false} |
| GET／POST | /receipts | 接收报告列表／提交；列表可用 ?packageId=... |

## 1. 发现与登记

扫描只登记 Skill 目录，不自动遍历所有应用的规则、记忆或 MCP 配置：

```json
{"roots":["D:/example/skills"],"discoverAgents":false}
```

roots 也可包含 {"path":"D:/example/skills","environment":{"harness":"example","agent":"author"}}。discoverAgents=true 复用现有适配器的位置发现，可附 projectPath；不会做版本探测或兼容性预检。结果为 {assets, environments, errors, scanned}，一处失败不掩盖其他结果。空目录可返回零条；不声称自动发现每个应用。

POST /assets：kind 是 skill、rule、memory、mcp、ledger 之一。path 与 content 必须且只能提供一个。

```json
{
  "kind":"skill",
  "path":"D:/example/skills/writer",
  "title":"写作助手",
  "ownership":"user",
  "scope":{"type":"personal"},
  "environment":{"harness":"example","agent":"author"}
}
```

Skill 必须是含 SKILL.md 的文件夹。rule、memory 可登记一个原文文件，或提供内联文本；ledger 接受选定 JSON 记录或摘要，不自动计算排名。

```json
{
  "kind":"memory",
  "sourceKey":"demo-project-summary",
  "title":"项目摘要",
  "content":"已完成初稿，下一步核对测试结果。",
  "scope":{"type":"project","path":"D:/example/project"},
  "environment":{"harness":"example","agent":"author"}
}
```

scope.type 为 personal、project 或 environment；其余信息保留到包中。sourceKey 省略时生成，结果 source.sourceKey 会返回。编辑内联资料时，以相同 kind、sourceKey 重新 POST，并传 expectedVersion 和新 content；没有提供的标题、范围和环境保留。新内容的规则／记忆恢复 draft。文件资料由 refresh 重新读取；原文件不会被 SkillBridge 改写。

Asset 主要字段：id、kind、title、source、revisionId、version、scope、environment、ownership、confirmation、archived、files、omissions、followUps、createdAt、updatedAt。列表隐藏内联正文，详情返回正文与 preferences。文件清单含相对 path、size、sha256。

ownership 为 user／unknown／system。文件来源默认为 unknown，内联来源默认为 user，路径中的 .system 目录标记为 system。系统资料默认隐藏且不可加入购物车；未知来源可见可选。不根据 Skill 名字猜测归属。

GET /assets 支持 kind、frequent=true、includeSystem=true、includeArchived=true、preferenceScope。常用优先排列。没有 preferenceScope 时常用为各范围确认记录的合集；指定时精确匹配该范围，不推测继承关系。

PATCH /assets/:id 支持 {expectedVersion, title?, confirmation?, archived?}。confirmation 可为 draft／confirmed／outdated；Skill 等初始为 not_required。归档后默认隐藏，不能继续导出；显式 archived=false 可恢复。归档不删除源文件或已经生成的包。

### MCP 的 MVP 范围

```json
{
  "kind":"mcp",
  "title":"示例工具",
  "sourceKey":"example-mcp",
  "serverName":"example",
  "content":{"mcpServers":{"example":{"command":"node","args":["D:/example/server.js"],"env":{"MODE":"demo"}}}}
}
```

可提供 JSON 文件 path，或 content 对象／JSON 文本。顶层有 mcpServers／servers 时必须指定 serverName，只导出所选服务；单服务配置对象可直接提交。暂不自动转换 TOML、YAML 或写入目标应用配置。

env、headers 的字面值及识别到的凭据字段／参数会替换为变量引用，并列入 followUps；URL 查询值、认证信息也会处理。为避免凭据遗漏，普通环境变量值也可能需要目标端重新填写。内联 MCP 原始凭据不保存进档案。该处理覆盖已识别形式，不能替代用户审阅任意自定义字段；不要把秘密放进标题、任务、报告或 sourceKey。

## 2. Agent 推荐与用户确认

先登记资料，再 POST /reports：

```json
{"id":"report-example-1","type":"recommendation","source":"harness:example:agent:author","assetIds":["asset_EXAMPLE"],"evidence":"用户在本次任务中再次选择此技能。","observedAt":"2026-11-11T01:00:00Z"}
```

type 为 recommendation／usage／memory_draft／rule_suggestion。后两者引用已登记的草稿；不是直接自动转换。相同 ID、相同内容返回 duplicate=true；ID 内容不一致返回 REQUEST_MISMATCH。没有实际观察时间可省略 observedAt；不要捏造使用次数。报告不会修改常用清单。

用户确认后 PUT /preferences/:assetId：

```json
{"frequent":true,"scope":"harness:example:agent:author"}
```

scope 是调用方维护的稳定范围标识，缺省 personal。首次创建无需 expectedVersion，更新同一资产＋范围必须提供返回的偏好 version。取消时 frequent=false。GUI 可用 GET /assets?frequent=true&preferenceScope=... 展示当前 Agent 常用；这些建议不会自动勾选或导出。

每次确认会刷新 COMMON_SKILLS.md；任何应用也可用 CLI common 或 GET /profile/common-skills 读取最新视图。不要让 Agent 直接覆盖该生成文件。

## 3. 购物车

POST /carts：

```json
{
  "task":{"description":"继续完成这个项目"},
  "project":{"path":"D:/example/project","label":"示例项目"},
  "targetHint":{"harness":"new-agent"},
  "operationScope":"读取所选资料并提出接续使用方案；不修改目标配置。"
}
```

字段均可省略。project／targetHint 可为 null。不指定目标也能导出；项目位置只是工作上下文，不自动打包整个项目。结果含 id、version=1、status=draft、items、上述上下文及时间。

POST /carts/:id/items：

```json
{"expectedVersion":1,"assetId":"asset_EXAMPLE","purpose":"用于下一轮写作"}
```

默认选当前 revisionId，也可明确给修订。每个选择项返回 assetId、revisionId、purpose、addedAt、metadata（title、scope、confirmation 的选择快照）。同资产、同修订、用途与元信息相同的重复加入不重复计数，也不增加版本；同资产不同修订替换原选择。不同资产即使同名也独立。

每次有效变更使用返回的 cart.version 继续操作。移除／清空请求仍带 {expectedVersion}。加入、移除、清空只影响本次草稿，不改变常用确认或源文件。重新加入当前资产可更新已选择的标题、范围和确认状态。

POST /carts/:id/preview，body 为 {expectedVersion}：

```json
{"cart":{"id":"cart_EXAMPLE","version":2},"items":[],"errors":[],"canExport":true,"status":"ready","compatibilityChecked":false}
```

上例只示意响应字段；实际 items 包含各项文件、范围、确认状态、排除项和 followUps。空购物车 canExport=false。源变化返回 SOURCE_CHANGED，先 refresh 资产、展示新的选择，再重新加入；不要直接换掉用户选定修订。内联旧修订已保存，可继续按原选择导出；文件来源不会在扫描时建立全部历史副本。

## 4. 导出、复制与结果

POST /carts/:id/export：

```json
{"expectedVersion":2,"requestId":"handoff-example-1"}
```

HTTP 返回 202 与 job：id、requestId、cartId、cartVersion、status、phase、cancelRequested、packageId、error、时间。轮询 GET /exports/:id，建议间隔 500–1000 ms。

- status：running → complete／failed／cancelled。
- phase：queued／checking／copying／verifying／publishing／finished，仅用于状态文字，不虚构百分比。
- complete 后才有 packageId、packagePath，且完整文件已发布。
- 同一 requestId＋cartId＋expectedVersion 返回原任务，不重复导出；内容不符返回 REQUEST_MISMATCH。失败后重试使用新的 requestId。
- POST /exports/:id/cancel 是取消请求；以轮询的终态为准。已完成包不会因取消被删除。
- worker 超过 120 秒没有续期，查询时标记 EXPORT_INTERRUPTED；需要新请求重试。进程被强制结束后可能留下 .tmp 目录，程序不把它列为完整包，也不主动清理未知历史目录。
- 导出中修改购物车会使该次发布失败，保留新草稿。成功包不随之后的源文件修改而变化。

取得 GET /packages/:id/prompt 的 text 后交给剪贴板。复制成功只是 GUI 状态，不提交接收成功回执。包记录 status 为 ready 或 ready_with_followups；receiptStatus 初始 unknown。

包目录：manifest.json、README.md、HANDOFF.md、payload/<skills|rules|memories|mcp|ledger>/<asset-id>/...。所选 Skill 的脚本和素材一起复制；其他资料分别有自己的目录。文件 SHA-256 保存于 manifest。

排除 Git 历史、node_modules、虚拟环境、缓存、凭据文件和符号链接，逐项记录 omissions；凭据和链接生成 followUps。单文件上限 32 MiB、单资产 128 MiB／4000 文件、目录深度 24。未知 Harness、草稿资料、待补凭据不触发兼容性门槛；读取失败、已选源变更、复制校验失败则不发布。

GET /packages/:id/verify 验证包内容，runtimeVerified 永远为 false，不能当作目标工具运行测试。元数据被改写时详情／prompt 返回 PACKAGE_CHANGED；缺失或链接路径返回 PACKAGE_UNAVAILABLE，verify 返回 valid=false。移动包后原提示词路径不会自动修正；首版以同机原包位置为准。

有实际接收报告时 POST /receipts：

```json
{"id":"receipt-example-1","packageId":"pack_EXAMPLE","source":"receiving-agent","target":{"harness":"new-agent"},"items":[{"assetId":"asset_EXAMPLE","status":"read","evidence":"已读取 README 与所选 Skill 文档。"}]}
```

逐项 status：read／written／recognized／verified／needs_action／failed／unknown。只能引用该包所选资产。报告会注明 verification=reported，即使报告称 verified，也不冒充 SkillBridge 独立验证。回执不执行安装、脚本或 MCP。无报告保持 unknown。

## CLI 共用入口

```powershell
python backend/main.py workspace --help
python backend/main.py workspace status
python backend/main.py workspace scan --root D:/example/skills
python backend/main.py workspace assets --kind skill --frequent
python backend/main.py workspace add --input D:/example/asset.json
python backend/main.py workspace report --input D:/example/report.json
python backend/main.py workspace common
python backend/main.py workspace request POST /api/v1/carts --input D:/example/cart.json
python backend/main.py workspace request GET /api/v1/carts/cart_EXAMPLE
python backend/main.py workspace export cart_EXAMPLE --version 2 --request-id export-example-1
```

request 支持 GET／POST／PUT／PATCH／DELETE，可调用上表所有接口；--input - 从标准输入读取 JSON。也可用 python -m backend.workspace。JSON 返回 stdout；错误 JSON 返回 stderr，退出码 2；同步导出 failed／cancelled 返回退出码 1。CLI 导出同步完成，不要求 HTTP 服务在线。

## GUI 实施顺序与边界

1. GET /status 显示真实数据目录；GET /assets、/preferences、/reports 加载资产与推荐。
2. 用户整理／刷新时 POST /scan，或由 Agent 通过 CLI 登记资料；不要把扫描次数当使用次数。
3. 用 /carts 保存本次上下文；分类视图共享一个 cartId 与 version。
4. 导出前调用 /preview，展示草稿状态、文件、排除和待补信息，再提交 /export。
5. 轮询成功后显示包位置与 prompt；复制反馈留在 GUI，接收结果来自 /receipts。

常见错误：NOT_FOUND（404）、VERSION_CONFLICT（409）、SOURCE_CHANGED／SOURCE_MISSING（409）、ASSET_UNAVAILABLE（409）、EMPTY_CART（400）、MCP_SERVER_REQUIRED（400）、SENSITIVE_CONTENT（400）、REQUEST_MISMATCH（409）、PROFILE_VERSION_UNSUPPORTED／PROFILE_UNREADABLE（409）。导出中的错误在 job.error 内，HTTP 成功读取任务不等于任务成功。

本轮未实现：新版 GUI、规则自动转换、目标配置写入、MCP 启停／连接测试、后台监控使用频率、任务榜单、真实 Harness 接收验证、云服务。旧 /api 接口仍由旧 dashboard 服务提供，新流程请使用本文契约。
