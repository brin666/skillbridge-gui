# 当前实现与改造差距

核查日期：2026-11-11。源码基线：46180617333c4ba183c1434fe5607af28d364a47。

工作目录为 D:\skillbridge，关联 brin666/skillbridge。以下旧代码核查以该提交为基线；新增后端见下一节，完整产品仍未全部完成。

## 本轮新增的 MVP 后端

- backend/workspace 提供用户级 SQLite 档案、修订、Agent 报告和分 Agent／Harness 范围的常用确认。
- 五类资产均可登记、加入同一购物车，并生成包含实际文件、清单、README 和提示词的固定包。
- CLI 与 /api/v1 共用数据和业务层；完整 Skill 目录导出不经过旧 SyncManager 或兼容矩阵。
- 有并发版本检查、请求去重、异步任务／取消、文件完整性验证，以及注明来源的接收报告。
- [接口文档](backend-api.md)描述可调用能力。本轮不改 ui/；规则转换、目标 MCP 配置、任务排名、受管写入恢复及真实 Harness 验证仍未完成。

## 原基线可复用的已有实现

| 能力 | 主要源码 | 边界 |
|---|---|---|
| 应用与技能扫描 | [agent_scanner.py](../backend/core/agent_scanner.py)、[adapters](../backend/adapters) | 代码中有 8 个适配器；不代表当前机器全部安装，也不代表支持它们所有配置格式 |
| Skill 解析与检索 | [skill_scanner.py](../backend/core/skill_scanner.py)、[skill_parser.py](../backend/core/skill_parser.py)、[Skills.tsx](../ui/src/pages/Skills.tsx) | 现有按 ID／名字／哈希合并，需加强身份与不同修订的区分 |
| 来源与规则摘要 | [source_detector.py](../backend/core/source_detector.py)、[summary](../backend/core/summary) | 不含实际使用统计；AI 摘要 provider 为占位实现 |
| 文件打开、启停、卸载 | [skill_manager.py](../backend/core/skill_manager.py) | 当前管理动作与新购物车选择不同，不能混用按钮含义 |
| 中央库 | [library_manager.py](../backend/core/library_manager.py) | 导入会复制完整目录，可复用为保存副本基础 |
| 同步和预检 | [sync_manager.py](../backend/core/sync_manager.py)、[preflight.py](../backend/core/preflight.py) | 当前执行只复制 SKILL.md；不满足完整交接包要求 |
| 互相同步和后台预热 | [skills.py](../backend/api/skills.py)、[mutual_sync.py](../backend/core/mutual_sync.py) | 按多 Harness 规划；新核心流程不依赖其兼容判断 |
| 历史与失败回滚 | [sync_history.py](../backend/core/sync_history.py)、[rollback.py](../backend/core/rollback.py) | 不等同于用户可浏览并恢复的完整配置快照系统 |
| 本地 GUI／API／CLI | [App.tsx](../ui/src/App.tsx)、[server.py](../backend/server.py)、[main.py](../backend/main.py) | 旧 UI 尚未接入新购物车；新增 CLI 与 /api/v1 见本轮实现 |

## 已发现的文档与数据限制

- server.py 的环境接口中，health 使用简化值，unsyncedCount 与 issueCount 固定为 0；新版不能把它们作为真实健康诊断结果。
- README 原有“必须显式 allow”的描述与 preflight.py 不一致。实际代码对未声明值放行该项，仅对明确 deny／denied／never 阻止。本次已纠正文档，没有改动行为。
- SKILL.md 已随 MVP 更新为档案与交接操作说明，并保留旧 dashboard 入口的边界。
- PRODUCT.md 原先记录的本机 Agent／Skill 数量为历史数据，已完整归档，不作为当前扫描结果。

## 原差距清单（完整产品目标）

下表保留最初差距范围；档案、报告、购物车、导出与回执的后端部分已由本轮覆盖。GUI 与真实环境能力不得据此标为完成。

| 产品需求 | 差距 |
|---|---|
| F01 | 统一档案根目录、实例身份、项目范围和首次无档案流程 |
| F02 | Agent 报告、证据去重、常用确认、系统资产归属与多修订 |
| F03 | 跨分类购物车、草稿、预览、实际加入动效和复制反馈 |
| F04 | 全内容快照、清单、完整性验证、提示词生成、导出历史 |
| F05 | 跨应用规则索引、可审阅转换、差异和冲突处理 |
| F06 | 带来源的记忆、用户确认、更新／删除和交接范围 |
| F07 | MCP 配置资产、脱敏交接、实际目标上的配置和连接结果 |
| F08 | 带环境／模型和证据的任务记录、反馈、成本来源与比较 |
| F09 | 导出／接收状态分离、回执、受管快照恢复及数据导出 |

## 验证记录的适用范围

前次核查在原始开发目录中执行了 199 项现有 Python 测试并通过，前端 TypeScript 检查通过；当时已逐文件比较，源码与本仓库基线一致（排除换行差异）。测试输出中存在资源清理警告，结果为 OK。

本轮在 D:\skillbridge 运行完整 Python 测试，232 项通过（199 项原有测试＋33 项新增测试），仍有旧测试的 HTTPError 资源清理警告。新增测试覆盖 CLI／HTTP、本地持久化与真实文件导出；未进行真实 Harness 接收或 GUI 验证。详情见[验收清单](acceptance.md)。
