# 多 Harness 验证记录

日期：2026-11-11。本记录描述多 Harness 资料整理和来源图标的本地验证；发布状态以仓库提交和 GitHub Actions 为准。

## 入口与浏览器核查

- 独立验证档案：[QA 界面](http://127.0.0.1:5175/)（API `127.0.0.1:17323`），档案 `D:/SkillBridgeData/harness-qa-20261111/profile`。包含同名异路径 Skill 4 项、记忆 2 项、共享规则 1 项、MCP 1 项和账本 1 项。切换来源与分类后选择保留，刷新后状态恢复，已生成 `complete` 交接包。复制按钮显示成功；Windows 剪贴板与后端提示词在统一 CRLF/LF 换行后完全相等。390px 窄屏无横向溢出，搜索容器保持 999px 圆角焦点环，输入框无内层矩形轮廓。
- 真实档案：[Codex 界面](http://127.0.0.1:5174/)（API `127.0.0.1:17322`），档案 `D:/SkillBridgeData/codex-local`。已核对整理前后草稿与偏好完全相等；本轮未改源资料。
- 实际盘点报告保留在用户自己的档案目录 `harness-inventory.json`，不上传个人资源清单。已检查目录缺失、目录链接、文档头格式警告、文件大小限制和敏感内容导致的部分失败。Hermes 系统 Skill 计入盘点数，但 `/assets` 默认过滤系统资料，只有显式设置 `includeSystem=true` 才列出；登记数不证明会话加载或可调用。

## 自动化检查

- 完整 Python `unittest`：248 项通过；旧用例仍有 `HTTPError` 资源清理 warning。最近相关用例：16 项通过。
- `npm run typecheck`、`npm run build` 通过；展示元信息与来源关系测试共 5 项通过。
- `ui/tests/workspace.integration.test.ts` 的 2 项测试通过，连接真实 HTTP 服务并覆盖 14 组核心检查：五类资料、串行写入、重复项、版本冲突、源变化、导出、取消等。

盘点只读取本地资料，不验证 Harness 是否加载或执行资料，也不验证 MCP 连接。浏览器截图和数据证据保存在本机 `ui/.qa/harness-20261111/`（不纳入发布）。一次独立代码审查未发现可确认的高价值缺陷。
