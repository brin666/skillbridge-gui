# GUI 接入验收记录

日期：2026-11-11。范围：`ui/`，确认稿为 `previews/cart-v2`。未修改 workspace 后端契约，未推送或部署。

## 环境与产物

- HTTP：`http://127.0.0.1:17321/api/v1`；状态返回实际档案 `D:\SkillBridgeData\gui-dev`，`legacySyncUsed=false`。
- GUI：`http://127.0.0.1:5173`，Vite 相对路径代理。
- 启动前端口为空；本轮启动的后端 PID 为 43780，Vite PID 为 48492。交付前再次核对监听；既有 17331 预览服务 PID 19988 保留。PID 仅代表本次验证时状态。
- 合成来源：`D:\SkillBridgeData\gui-dev-fixtures\gui-1794367469698`。测试仅扫描此类明确指定目录，未扫描真实 Agent 配置，未运行合成 Skill 脚本。
- 最终草稿：`cart_7bd8514f7cbc44e08962c79af1014f37`，version 25，包含 Skill、规则、记忆、MCP、账本各一项。
- 最终文件包：`D:\SkillBridgeData\gui-dev\handoffs\pack_6dcb94f8149941b7a83e08c2a5aab9f5`。5 项资料、7 个 payload 文件，包含 Skill 的 `scripts/example.py` 与 `assets/palette.json`；逐文件独立计算 SHA-256 与清单一致。`/verify` 返回 `valid=true`、`runtimeVerified=false`。

## 真实 HTTP 检查

`tests/workspace.integration.test.ts` 通过真实 workspace 服务验证了 14 组流程：

| 行为 | 结果 |
|---|---|
| 显式 Skill 扫描；有效目录与不存在目录同时提交 | 可用结果与部分失败分开返回 |
| 五类资料登记、MCP 集合明确选择 serverName | 均能进入同一购物车 |
| 多个加入操作同时发起 | CartSession 串行提交，使用后端最新版本 |
| 重复加入、同名但不同资产 | 同资产不重复；不同资产独立计数 |
| 常用的确认、取消、scope 隔离与偏好版本冲突 | 不改变购物车；偏好版本独立校验 |
| 移除、清空、读取草稿 | 不改变源文件和常用偏好；选择可从 HTTP 恢复 |
| 外部更新购物车后再提交，且后面还有排队写入 | 冲突后读回最新草稿，后续写入暂停，需明确核对 |
| 真实导出响应丢失后重试同一 requestId | 返回同一个任务，不重复生成 |
| 生成实际包、读取后端 prompt、核验脚本与素材 | 文件与后端文本一致 |
| 无回执与合成 reported 回执 | 不冒充独立执行验证 |
| 修改已选源文件，再预览与导出 | 预览阻断；异步任务返回 failed/SOURCE_CHANGED |
| 刷新资产，明确重新选择修订，再用新 requestId | 可重新生成；刷新本身不替换购物车选择 |
| 空车导出 | canExport=false，导出请求被拒绝 |
| 大型合成 Skill 导出时取消 | 终态 cancelled，无完整包 |

另有针对本轮修复的测试：真实 HTTP 写请求已完成、响应被测试层延迟时使 CartSession 失效，旧响应不会恢复旧档案购物车。该检查通过；它验证前端失效保护，不宣称做过真实服务进程切换档案测试。

执行命令：

```powershell
npx tsx --test tests/workspace.integration.test.ts
npx tsx --test --test-name-pattern="profile invalidation" tests/workspace.integration.test.ts
```

第一条执行时包含原有 14 组流程；第二条为新增失效保护用例的针对性验证。对应日志与字段证据保留在 `.qa/http-evidence.json`、`.qa/final-file-verification.json`。

## 浏览器联调

使用 Ego Lite 的独立 TaskSpace 16，真实 HTTP 与合成档案。18 项浏览器操作记录保存在 `.qa/browser-flows.json`。

| 项目 | 实际检查 |
|---|---|
| 分类与加入 | v2 五分类逐一加入；快速双击不重复；刷新后仍为五项 |
| 购物车 | 清空与空车禁用、撤回清空、移除与撤回、恢复其他草稿 |
| 上下文 | 任务、项目位置、目标 Harness／Agent、操作范围真实保存并重新预览 |
| 常用 | 详情中确认与取消常用；不自动加入购物车 |
| 整理登记 | 表单扫描有效与无效根目录，显示部分失败；表单登记内联规则成功 |
| 版本冲突 | 外部真实 PATCH 使页面版本过期，UI 停止写入并要求核对最新草稿 |
| 源变化 | 在测试目录修改文件；UI 显示 SOURCE_CHANGED；刷新后需明确替换修订 |
| 导出失败 | 预览后修改源文件，HTTP 成功返回的 job 进入 failed；UI 不显示提示词或生成成功 |
| 取消 | 从 UI 取消真实运行中的大型导出，轮询 cancelled 后解除锁定，原草稿可恢复 |
| 预览断网 | 浏览器阻断 preview 请求后旧 canExport 被清除；解除阻断、重试成功 |
| 部分加载失败 | 阻断 assets 请求，清除旧卡片并显示加载失败；恢复后读回真实资料 |
| 服务不可达 | 阻断 status 请求，操作禁用、错误可重试；无演示数据回退 |
| 复制 | Clipboard API 成功后才显示已复制；Windows Get-Clipboard 与后端提示词比较为 True |
| 复制被拒绝 | 仅在测试页临时注入拒绝；成功状态清除，正文仍可手动复制；测试后恢复原 API |
| 历史与结果 | 实际包可重开与校验；回执显示来源、read、recognized、声称 verified，并标为 reported |
| 视觉与可达性 | 1440×960 桌面、390×844 窄屏；五分类无横向溢出，购物车与生成态复制按钮可达 |
| 减少动效 | 切换后清除飞行装饰，状态和数量仍可用 |
| 接口隔离 | 观察到的页面 API 请求均为 `/api/v1/`，没有旧 dashboard API |

窄屏为浏览器视口模拟；多数脚本操作使用 DOM 事件，复制使用真实 Clipboard API。未声称真机触控、帧率或读屏软件验证。网络阻断与响应丢失是明确的测试故障注入，不属于正式运行时回退。

## 构建与独立复核

- `npm run typecheck`：通过。
- `npm run build`：通过（包含 `tsc --noEmit`）；Vite 保留大于 500 kB 的 chunk 提示，非构建错误。最终主 JS 约 611 kB，gzip 约 196 kB。
- `git diff --check -- ui`：通过；Git 仅提示本机 LF/CRLF 规范化。
- 独立审查最终结论：**ship**，限本轮 MVP GUI。已关闭三处状态恢复问题及生成态复制区域滚动问题。详见 `.qa/gui-review.md`。

截图：`v2-desktop.png`、`v2-dock.png`、`v2-mobile.png`、`v2-mobile-cart.png`、`v2-preview.png`、`v2-generated-copy.png`、`v2-mobile-generated-copy.png`、`v2-receipts.png`，均位于 `.qa/`。

## 接口边界与未验证项

本轮首版流程无阻断性接口缺口。文件来源正文未由接口提供、显式扫描环境未写入独立环境清单、资产列表无用途摘要字段，均按实际接口展示，见 README。

未测试真实手机、Safari/Firefox、真实读屏软件、跨机器文件可达性或真实 Agent 调用。文件校验和提交方自述回执均不代表独立运行验证。未实现本轮明确排除的自动安装、规则转换、MCP 启停、评分、监控和云同步。

## 2026-11-11：已确认的资料卡片预览接入

用户确认 `previews/library-readability` 后，在既有正式 GUI 接入中文 Skill 用途、Codex 会话名称与快速列表。本轮没有修改 backend/workspace 契约，没有使用私有预览 JSON 作为正式运行时数据源。

- 正式档案 `codex-local`：真实 HTTP 共 363 个可见资产，353 条指纹绑定的展示元信息；164 个 Skill 有中文简介，177 份记忆匹配 Codex 会话名，其余 12 份使用概览或文档标题。
- `test_catalog_presentation.py` 5 项、`test_codex_inventory.py` 4 项通过：元信息只读来源、缓存过期、写入后资产身份／用户标题／修订／偏好／交接包不变，完整源变化时跳过补充说明。
- `ui/tests/presentation.test.ts` 3 项通过：中文与原名搜索、文件修订后停用旧译文、保留禁用状态、无效元信息回退到实际资产原名。
- 前端类型检查及构建通过，保留既有约 612 kB 主 JS 的 chunk 提示。Python 语法检查通过。
- 重新运行 `npm run test:integration`：2 项顶层测试、14 组实际 HTTP 业务检查通过，涵盖跨分类、版本冲突、源变化、重试、实际完整目录导出与取消。
- Ego Lite TaskSpace 20：正式档案检查中英文搜索、中文与原文详情、189 项记忆滚动到底、跨虚拟渲染边界的 Tab、深处搜索回到结果；没有双列表或卡片入场等待。390 CSS 像素窄屏无横向溢出，卡片左对齐，6 张附近卡片在 DOM 中；已检查截图。
- 同一浏览器任务在独立 `gui-dev` 档案逐类加入 5 项合成资料，刷新后仍保留，生成 `pack_434c4348f3fa4eb7a78ef4ae5a2c52ee`（5 类、7 个文件）。浏览器提示词与后端 text 相同；Clipboard API 成功，Windows 剪贴板内容经 CRLF/LF 归一化后与后端完全一致。
- 包详情、历史重新打开与文件校验通过；界面明确显示没有接收报告、未独立验证运行。

本轮证据：`.qa/readability-live-checks.json`、`.qa/readability-live-keyboard.json`、`.qa/readability-live-export.json`、`.qa/readability-live-history.json`、`.qa/readability-live-*-desktop.png` 与 `readability-live-*-mobile*.png`。浏览器与测试数据均为本机验证；未做真机或帧率基准测试。真实 Codex 资料只用于浏览和补充展示元信息，导出与常用修改回归使用合成测试档案。

现有 API 没有专用展示元信息更新路由；本轮复用 `POST /assets` 的 `environment` 字段，资产 version 因元信息登记递增，购物车／偏好版本不变。该接口对文件来源登记没有 expectedVersion 冲突保护（内联资料有）；脚本先检查完整源文件清单、遗漏项和待补事项，跳过变化来源，但检查和登记并非一个原子操作。后续若支持并发 GUI 编辑展示说明，需要后端提供相应版本保护；本轮未重写契约。

## 2026-11-11：恢复 cart-v2 动效及侧栏展开

用户要求恢复已确认的原有整套动效，并让右侧交接包栏空白处也能点击展开。本节替代上一轮关于取消卡片入场动效的决定；中文用途、会话名称与长列表窗口渲染保留。

- `npm run build` 通过，包含 `tsc --noEmit`；主 JS 618.04 kB，gzip 198.42 kB，仍有既有 chunk 大小提示。
- Ego Lite TaskSpace 21 实际检查悬停倾斜、跟随光晕、上浮阴影与搜索聚焦展开。搜索宽度从 210px 变为约 290px；悬停实测有旋转矩阵、-5px 抬升与可见光晕，已查看截图。
- 分类及标题恢复方向进出场；快速连续切换最终显示正确的 189 项记忆，当前视口仅渲染 42 张卡片。离场副本 240ms 后清理，没有重复的交互标识；入场延迟上限 522ms。
- 独立 `gui-dev` 档案真实移除／加入：移出和加入飞行、尾迹、8 个粒子及数量变化均出现；计数方向分别为 `tick-down` 和 `tick-up`，最终恢复 5 项。没有通过动效定时器决定后端选择状态。
- 右侧栏上、中、下三处空白区使用浏览器指针点击，均展开至约 388px；收起按钮与顶部交接包按钮正常。底部预览按钮直接打开预览对话框，侧栏不被误展开。正式档案原有 1 项选择保持不变。
- 390 CSS 像素模拟窄屏无横向溢出；系统和页面减少动态效果设置均有效，倾斜为 `none`、光晕隐藏，增减仍更新真实状态。

证据：`.qa/motion-restore-checks.json`、`.qa/motion-restore-cart.json`、`.qa/motion-restore-final.json`、`.qa/motion-restore-sidebar.json`、`.qa/motion-restored-hover-final.png`、`.qa/motion-restored-sidebar.png`。本轮属于本机浏览器验证，未做真机或帧率基准测试。
