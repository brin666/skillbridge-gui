# SkillBridge 资料购物车 · 交互预览

独立预览，使用 Astryx 0.7.13 的真实组件与 Neutral 主题。所有条目、来源、文件数量与状态均为示例；不扫描、改写或导出用户资料，不调用正式后端。

## 运行

在本目录执行 `npm.cmd ci`，然后 `npm.cmd run dev`，打开 http://127.0.0.1:17331 。构建：`npm.cmd run build`。

## 预览范围

- Skills、规则、记忆、MCP、账本分类，搜索、来源过滤与列表／卡片视图。
- 详情与加入分别操作，跨分类保留选择，重复点击不会累计。
- 加入后立即更新状态；轻量副本飞入购物车，连续加入、反向移除与减少动态效果。
- 本机浏览器保存独立的预览草稿；空状态、缺失文件与接收状态的明确表达。
- 桌面常驻购物车、窄屏购物车抽屉、交接内容预览。

资料包导出尚未接入。示例提示词不能冒充实际生成的交接包。

## 设计参考

- [Astryx Card Grid](https://astryx.atmeta.com/templates?preview=library)：搜索、分类筛选与条目卡片。
- [Astryx SideNav](https://astryx.atmeta.com/components/side-nav)：分类导航与计数。
- [Astryx Drawer](https://astryx.atmeta.com/components/drawer)：详情和窄屏购物车。
- [Astryx Neutral](https://astryx.atmeta.com/themes?theme=neutral)：中性色层级、文字与控件。
- 项目 `docs/ux-spec.md`：分类、选择、预览和动效行为。

购物车的分组摘要、加入轨迹和交接预览编排是本次设计，待用户评审。配色和布局仅属于该预览，不替换项目根目录的 DESIGN.md。
