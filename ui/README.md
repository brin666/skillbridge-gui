# SkillBridge workspace GUI

Codex 真实资料入口为 <http://127.0.0.1:5174/>，使用独立 `codex-local` 档案。启动、通过 Skill 更新资料和覆盖边界见 [Codex 本机接入](../docs/codex-local.md)。下文 `5173` / `gui-dev` 保留为合成测试环境。

正式入口使用本会话确认的 `previews/cart-v2`：悬浮分类导航、简洁卡片、细长／展开购物车、窄屏购物车胶囊，以及原有弹簧、弧线与复制反馈。`previews/cart-v2` 保持原样；正式代码在 `src/workspace/`。

## 启动

先核查端口，不重复启动，也不停止其他会话的进程：

```powershell
Get-NetTCPConnection -LocalPort 17321,5173 -State Listen -ErrorAction SilentlyContinue
```

在 `D:\skillbridge` 的终端中启动独立测试档案：

```powershell
python backend/main.py workspace --data-dir D:/SkillBridgeData/gui-dev serve --port 17321
```

另一个终端启动 GUI：

```powershell
cd D:\skillbridge\ui
npm ci
npm run dev -- --host 127.0.0.1 --strictPort
```

打开 <http://127.0.0.1:5173>。前端仅请求相对 `/api/v1`，由现有 Vite 代理到 `127.0.0.1:17321`。CLI 准备资料时必须使用同一个 `--data-dir`。新页面不调用旧 dashboard 的同步或兼容性预热接口。

## 操作

1. 点 `+` 整理明确输入的 Skill 目录，或登记资料。扫描不自动发现 Agent；Skill 使用包含 `SKILL.md` 的绝对目录，其他资料使用文件路径或内联内容。MCP 服务集合必须填写 `serverName`。
2. 切换五种分类，用卡片圆形按钮加入或移出。点击卡片查看来源、范围、修订、正文／文件清单、报告及常用确认。
3. 点购物车展开，填写任务，或打开交接预览填写项目位置、目标与操作范围。修改后保存，再检查实际文件与待补事项。
4. 生成实际交接包。只有任务达到 `complete` 才显示“包已生成”，随后取得后端提示词。复制失败时保留文本供手动复制。
5. 历史入口可重新打开包、复制提示词、核验文件与查看有来源的接收报告。窄屏在右上“档案与历史”中进入辅助功能。

“档案”面板显示实际目录、环境，提供 Harness／Agent 常用范围和资料筛选。已确认常用优先显示；Agent 推荐与用户确认独立；二者均不自动加入购物车。

## 状态与实现

- `api.ts` / `types.ts`：按 `docs/backend-api.md` 建立请求与响应类型。写请求统一 JSON，空参数为 `{}`。
- `cartSession.ts`：串行购物车写入；每次提交使用上一次响应的购物车版本。冲突读回最新草稿并暂停后续写入，用户核对后恢复。
- `useWorkspace.ts`：档案、列表、偏好、草稿恢复、预览、导出请求及轮询。资产、偏好和购物车版本不混用。
- `AppV2.tsx` / `Visuals.tsx` / `CartV2.tsx` / `motion.ts`：复用确认稿视觉和动效。动效仅在后端确认后反馈，不决定实际选择。
- `CollectPanel.tsx` / `AssetPanel.tsx` / `HandoffV2.tsx` / `PackagePanel.tsx` / `PromptView.tsx`：实际操作流程、状态和恢复入口。

浏览器只保存按实际档案路径区分的当前 `cartId` 和未确认导出的 `requestId`／版本，不保存另一套资产或购物车内容。导出响应丢失时沿用请求编号；失败任务重新生成用新编号。页面刷新会从 HTTP 读取草稿并恢复未完成导出。

`SOURCE_CHANGED` 不会自动替换选择。刷新文件资料后，用户需明确选择新修订。检测到服务切换档案时清除旧列表并要求刷新页面，避免混用不同档案。

## 检查

```powershell
npm run typecheck
npm run build
npm run test:integration
```

集成测试要求上述真实 HTTP 服务在线，并校验实际 `dataHome` 是 `D:/SkillBridgeData/gui-dev`。它在 `D:/SkillBridgeData/gui-dev-fixtures/gui-<时间戳>` 创建合成资料，向独立测试档案写入资产、草稿、导出和明确标注为合成的报告；不扫描真实 Agent 配置，不运行资料中的脚本。测试产生的文件会保留供核查。

测试中的响应丢失、网络阻断与剪贴板拒绝只用于验证错误处理，不存在正式运行时的 mock 或演示数据回退。浏览器截图与执行记录位于被 Git 忽略的 `.qa/`；验收结论见 `VALIDATION.md`。

## 当前接口边界

- 文件来源详情不返回正文。页面显示真实元信息与文件清单；内联来源显示接口返回的内容。
- 显式扫描根目录附带的环境会出现在资产上，但当前不会写入独立 `/environments` 清单。常用范围从真实环境记录与资产环境共同提取。
- 资产列表没有用途摘要字段，因此卡片的一行简介展示真实常用／推荐、范围和确认状态，不生成虚构用途。
- 文件包仍在后端提供的本机原路径中；生成不意味着安装、迁移或目标执行成功。`verify` 仅检查文件完整性；`receipts` 是有来源的自述报告，即使声称 `verified`，也不代表独立运行验证。
- 无阻断首版交接流程的接口缺口。规则转换、自动安装、MCP 启停／连接测试、监控、评分和云同步不在本轮范围内。

## 2026-11-11 多 Harness 验证入口

- [独立 QA 档案](http://127.0.0.1:5175/)：API `127.0.0.1:17323`，档案 `D:/SkillBridgeData/harness-qa-20261111/profile`。
- [真实多来源档案](http://127.0.0.1:5174/)：API `127.0.0.1:17322`，沿用 `D:/SkillBridgeData/codex-local`；已核对原草稿及常用偏好均保留。

多 Harness 验证范围、盘点结果及待补检查见[验证记录](../docs/harness-validation.md)。
