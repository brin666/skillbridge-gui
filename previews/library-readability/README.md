# 资料卡片可读性与快速浏览预览

状态：用户于 2026-11-11 确认，已接入正式 GUI；此目录保留当时的独立预览。

## 参考与范围

沿用用户已确认的 `D:/skillbridge/previews/cart-v2`：浅灰底、白卡片、紫色选中态、左侧分类与右侧交接包。保留原有导航关系；本次预览调整卡片信息层级和列表响应。

- Skill：中文名称释义、原名、两行用途简介；详情保留完整原始 description。
- 记忆：优先显示 Codex 实际会话名，标注名称来源、项目与日期；文件路径放入详情。
- 原有分类、搜索和试选可操作。试选只保存在页面内存，不写入正式交接包或常用偏好。
- 顶部“当前文案 / 新版文案”只比较卡片文案与间距，两种模式都采用快速渲染，不能用于比较旧版性能。

预览采用原设计底色 `#f5f5f2`、正文 `#141418`、强调色 `#5346f2` 和 24px 卡片圆角。卡片增加说明行，代价是单屏信息密度稍降；不增加新的导航层级。

## 响应方式

移除按卡片序号累加的出现延迟、分类切换时新旧两套列表同时渲染，以及全卡片 3D 倾斜。保留按钮轻微按下反馈和 120ms 选中色过渡；启用系统“减少动态效果”时取消这些变化。

列表仅渲染可见区域附近的卡片，并复用节点；搜索在本地执行。中文简介预先准备并缓存，不在页面打开时调用翻译。原 description 的哈希变化后，旧译文不会继续套用。

## 数据与运行

数据来自现有 `D:/SkillBridgeData/codex-local` 档案和 Codex skill 目录。会话名只查询记忆关联的 ID，SQLite 使用只读连接，仅查询名称字段，不读取会话正文。

2026-11-11 预览数据：164 个可见 Skill、189 份记忆、7 个 MCP、2 份规则、1 份整理记录。164 个 Skill 均有中文简介；177 份记忆匹配实际会话名，其余为概览、长期记忆及补充文档。不同路径的同名资产保留独立身份；旧版记忆和当前记忆标注来源，不按名字合并。

生成数据：

```powershell
python scripts/catalog_presentation.py --data-dir D:/SkillBridgeData/codex-local --codex-home D:/CodexData --catalog ui/.qa/readability-skills.json
```

`ui/.qa/readability-skills.json` 是本机 Codex `skills/list` 的只读结果。它和截图、浏览器证据均在被忽略的 QA 目录内。生成的私有数据只存于 `D:/SkillBridgeData/codex-local/presentation-preview.json`，不要加入仓库或公开部署。

启动前检查 17334 端口；已有本预览服务时直接复用：

```powershell
python scripts/serve_library_preview.py --data D:/SkillBridgeData/codex-local/presentation-preview.json --port 17334
```

浏览 `http://127.0.0.1:17334/`。服务只绑定本机回环地址，提供固定资源，无写入接口。现有正式 GUI 仍在 `http://127.0.0.1:5174/`。

## 验证

- `python -m unittest discover -s tests -p test_catalog_presentation.py`：4 项通过，涵盖只读名称查询、索引回退及来源标注、文档标题回退、译文过期识别；验证不重命名原资产、不修改源文件。
- JavaScript 语法检查与两个 Python 脚本编译检查通过。
- ego-browser 实际浏览器：中文/英文搜索、详情及原文、切换分类保留试选、连续加入/移除、清单移除、新旧文案切换通过。
- 189 份记忆滚动到底可到达最后一项。1440 CSS 像素桌面只渲染 24 张附近卡片；390 CSS 像素窄屏渲染 6 张，无横向溢出；已实际查看截图。
- 系统减少动态效果模拟：过渡时长为 0，卡片无入场动画。
- 本次样本筛选和更新 DOM 耗时约 0.3–4.1ms，仅代表同步 JavaScript 工作，不代表总交互延迟、绘制耗时或帧率。

浏览器证据位于 `ui/.qa/readability-checks*.json` 和 `readability-*-desktop.png`、`readability-*-mobile-390.png`。窄屏为桌面浏览器模拟，未做真机测试或完整键盘/读屏验收。正式集成后的完整业务链路仍需重新验证；此预览不代表导出、调用或迁移已成功。

## 正式集成约束

确认的卡片内容与快速列表方式已接回正式 GUI，继续使用现有资产 ID、版本、常用偏好和交接包后端。名称映射仅作展示；不更改源文件和长期记忆。正式运行时不使用此私有预览快照作接口失败的静默回退。实际集成记录见 `ui/VALIDATION.md` 和 `docs/codex-local.md`。
