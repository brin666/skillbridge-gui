# 来源图标局部预览

用户于 2026-11-11 确认本预览，图形已接入正式 `ui/` 来源筛选及卡片标识。

- 保留当前 36 × 34px 按钮、3px 胶囊内边距、灰黑状态及白色滑动指示器。只替换来源图形。
- Hermes 使用 NousResearch/hermes-agent 官方网站仓库 favicon，保留头像轮廓。18–19px 下能与其官网图标对应；不使用通用文件夹。原 SVG 保留在 assets/hermes-favicon.svg。
- Pi 使用 earendil-works/pi-website 的像素字形路径，收紧 viewBox 留白，以适应小尺寸。
- Claude 使用基于品牌星芒的简化图形；Codex 沿用已确认的终端六边形；SkillBridge 复用当前页面的拱桥。
- 点击、方向键、Home/End 可试选中状态；支持减少动态效果。此页面不读取真实资料，不执行后端请求。

来源：
- https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/static/img/favicon.svg
- https://raw.githubusercontent.com/earendil-works/pi-website/main/src/logo.svg
- https://claude.com/
- 当前 ui/src/workspace/Glyph.tsx 和 Visuals.tsx。

图形用于标识资料来源，不表示品牌方背书。原品牌资产的权利不因项目 MIT 许可而改变。
