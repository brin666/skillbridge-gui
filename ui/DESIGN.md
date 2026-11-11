---
name: SkillBridge 工作区
description: 本机 Agent 资料的浏览、选择与交接工作台
colors:
  canvas: "#f5f5f2"
  surface: "#ffffff"
  ink: "#141418"
  ink-muted: "#5c5c66"
  ink-faint: "#9b9ba3"
  line: "rgba(20, 20, 40, 0.075)"
  fill: "#f1f1ee"
  fill-strong: "#eaeae6"
  accent: "#5346f2"
  accent-strong: "#4236db"
  accent-soft: "#eeedfe"
  accent-glow: "rgba(83, 70, 242, 0.35)"
  warning: "#e0951f"
typography:
  display:
    fontFamily: '"Inter", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "52px"
    fontWeight: 680
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  body:
    fontFamily: '"Inter", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Inter", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, "Noto Sans Mono CJK SC", monospace'
    fontSize: "12px"
    lineHeight: 1.8
rounded:
  control: "12px"
  action: "16px"
  tile: "15px"
  surface: "20px"
  card: "24px"
  floating: "26px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
    height: "52px"
    padding: "0 20px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "48px"
  asset-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "22px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px"
  category-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.floating}"
    width: "72px"
  cart-pill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "56px"
---

# Design System: SkillBridge 工作区

## Overview

**Creative North Star: "安静的资料工作台"**

工作区以大块暖灰留白承载本机资料，黑色文字与细分隔线维持清晰层级，紫色只提示选择和操作反馈。桌面分类栏与购物车收在两侧，中央用网格浏览资料；卡片保持一行真实状态信息，来源、文件、错误和报告放入详情或交接面板。

窄屏将分类栏改为顶部横向条，购物车收为底部胶囊，辅助入口留在抽屉中。购物车选择、计数和交接结果跟随真实接口状态；弹簧、弧线飞行、反向动画与复制反馈帮助确认操作，减少动态效果时保留状态和撤回提示。

**Key Characteristics:**
- 暖灰底、白色内容面与墨色文字，紫色作为唯一强调色。
- 稀疏网格卡片配一行事实摘要，深层资料放入面板。
- 桌面侧边浮栏与购物车、窄屏顶部分类条与底部购物车胶囊。

## Colors

暖灰与白色组成低对比底面，墨色承载标题和主要操作；紫色集中标记选中与反馈，琥珀色只提示待核对状态。

### Primary
- **明亮紫**: 用于资料选择、数量反馈、焦点与复制完成状态。

### Secondary
- **深紫**: 用于品牌渐变的暗端与强调色变化。

### Tertiary
- **琥珀提示**: 仅用于资料缺失、过期等需留意状态点。

### Neutral
- **暖灰底**: 页面背景。
- **白色表面**: 卡片、浮栏和面板背景。
- **墨色正文**: 主文字、选中导航及主要按钮。
- **柔灰文字** 与 **淡灰文字**: 次级说明、计数和弱化标签。
- **轻分隔线**: 卡片、面板和列表分组边界。
- **浅灰填充**: 图标块、输入辅助面和轻交互底色。
- **淡紫底**: 选中图标块和强调筛选。

**The Single Accent Rule.** 紫色只标记选择与即时反馈；主要按钮和当前分类指示器使用墨色。

## Typography

**Display Font:** Inter (优先系统 UI 字体与中文无衬线回退)
**Body Font:** Inter (同一系统字体栈)
**Label/Mono Font:** JetBrains Mono (系统等宽回退)

**Character:** 单一无衬线字体家族保持工作区紧凑直接；标题以较大字号和紧字距拉开层级，来源路径与文件信息切换为等宽字。

### Hierarchy
- **Display** (680，52px；1180px 以下 44px；900px 以下 38px，行高 1.05，字距 -0.04em): 当前资料分类标题。
- **Title** (620，17.5px，行高 1.3): 卡片名称。
- **Body** (400，13.5–14.5px，行高 1.5–1.8): 卡片事实行、购物车条目和面板正文。
- **Label** (400–600，11–13px，行高 1.6–1.8): 来源、状态、字段标签及辅助说明。
- **Mono** (400，11–12.5px，行高 1.7–1.8): 路径、文件名和技术细节。

## Layout

桌面主区留在 72px 左侧浮动分类栏与 76px 右侧购物车之间；主内容左右保留侧栏空间，网格按可用宽度自动排布，卡片最小列宽 262px、间隔 20px。购物车展开至 388px，并覆盖主区。

1180px 以下标题与网格收紧，网格最小列宽降至 230px、间隔 16px。900px 以下分类栏吸附顶部，五类横向滚动且只给当前类显示文字；卡片变单列，购物车改为带安全区间距的 56px 底部胶囊，打开后使用全宽抽屉。整理、档案和历史入口沿用图标与抽屉。

交接预览使用居中对话框；面板内容可在限定高度内滚动。卡片用途行单行截断：接口没有用途摘要字段时，只显示真实的常用／推荐、范围及确认状态。

## Elevation & Depth

默认表面以近乎不可见的描边和极轻阴影分层。卡片悬停上浮 5px 并加深阴影，选中态使用紫色描边与柔和色光；侧栏和购物车使用更明显的低扩散阴影，展开购物车时背景轻微模糊。窄屏顶部导航使用半透明底和背景模糊。

### Shadow Vocabulary
- **卡片静置** (0 0 0 1px var(--line), 0 1px 2px rgba(20, 20, 40, 0.03)): 页面卡片边界。
- **卡片悬停** (0 0 0 1px rgba(20, 20, 40, 0.04), 0 24px 48px -22px rgba(20, 20, 50, 0.28), 0 6px 14px -8px rgba(20, 20, 50, 0.1)): 指针聚焦时抬升卡片。
- **浮栏静置** (0 0 0 1px var(--line), 0 10px 30px -18px rgba(20, 20, 40, 0.18)): 桌面导航与购物车。
- **购物车展开** (0 0 0 1px var(--line), 0 40px 80px -30px rgba(20, 20, 50, 0.35), 0 10px 24px -12px rgba(20, 20, 50, 0.12)): 展开面板高于页面内容。

**The Resting Surface Rule.** 静置卡片不做明显悬浮；更深的阴影只表达悬停或浮层状态。

## Shapes

卡片使用圆角方形（24px），桌面浮栏更圆（26px）；图标块较紧凑（15px），表单字段与购物车行使用 12–16px 圆角。筛选器、状态胶囊和窄屏购物车采用全圆角。边线轻而克制，状态优先通过底色、文字和图标表达。

## Components

### Buttons
- **主要操作：** 墨色底、白色文字；购物车预览按钮高 52px、圆角 16px。
- **加入／移出：** 卡片右下角圆形按钮，加入符号切换为勾选；选中时使用强调紫。
- **状态：** 保持清晰焦点轮廓；按下轻微缩小。复制成功以颜色、勾选与提示反馈确认。

### Chips
- **来源筛选：** 浅灰胶囊底，白色滑块弹簧移至当前来源。
- **交接资料：** 浅灰 40px 胶囊，内含图标、名称和移除按钮。

### Cards / Containers
- **资料卡：** 白底、24px 圆角、最小高度 196px；图标块、名称、一行真实事实摘要、来源图标和圆形加入按钮。
- **选中／悬停：** 选中描紫边并柔和发光；悬停时轻抬并显示随指针移动的淡紫光。
- **购物车条目：** 54px 高的轻量列表行，悬停时改用页面底色。

### Inputs / Fields
- **搜索：** 恢复 cart-v2 胶囊形输入框聚焦展开（桌面 210px → 290px），支持中文用途与原名搜索。
- **表单：** 白底、1px 浅灰边、12px 圆角与 11px 内边距；全局焦点环为 2px 强调色并外移 3px。

### Navigation
- **桌面：** 72px 白色浮动图标栏，48px 标签；当前项由墨色共享指示块标出，悬停以提示文字补足名称。
- **窄屏：** 顶部吸附横条横向滚动；当前分类同时显示图标和文字。
- **辅助入口：** 整理、档案、历史和减少动态效果沿用图标按钮；资料详情与操作表单使用抽屉。

### 购物车浮栏

桌面浮栏默认宽 76px，堆叠所选资料图标和数量，点击侧栏任意空白处即可沿用原动效展开为 388px 面板；顶部交接包按钮仍可切换展开和收起，底部预览按钮直接预览。展开后点击面板内部保持展开，点击外部或按 Escape 收起。窄屏切换为底部胶囊与全宽购物车抽屉。数量随真实购物车状态滚动更新。

### 交接预览

使用 720px 居中对话框。任务与项目位置位于首屏，操作范围和实际文件清单按需展开；检查、生成和复制状态使用按钮与摘要反馈。长内容在 75dvh 高度限制内滚动。

### Motion

2026-11-11 用户明确要求恢复原来全部动效：以 `previews/cart-v2` 为基准，恢复悬停倾斜、光晕跟随、抬升阴影、图标回弹、搜索聚焦展开、分类及标题方向进出场、加入和移出飞行、尾迹、落点反馈、粒子与计数。中文用途和会话标题保留。

列表仍按可见区域渲染。离场层只保留当前已渲染窗口的装饰副本，240ms 后清理，没有可操作身份或事件；快速切换从当前视觉位置离场。入场沿用原先 42ms 间隔与弹簧／淡入曲线，延迟最多 522ms，不随全部记忆数量累计。真实选择写入不等待动画；保留减少动态效果设置。

## Do's and Don'ts

### Do:
- **Do** Skill 卡片优先显示有来源、文件指纹匹配的中文用途简介与原名；记忆优先显示 Codex 会话名，保留范围、确认状态和来源。原文说明、路径、文件与报告放入详情。
- **Do** 让紫色承担选择与反馈，让墨色承担主要操作和当前导航状态。
- **Do** 保留桌面悬浮导航／购物车与窄屏顶部分类条／底部购物车胶囊的响应切换。
- **Do** 支持系统与页面的减少动态效果设置；减少时仍提供真实状态和撤回入口。
- **Do** 让选择、数量、检查和复制反馈对应已确认的实际状态。

### Don't:
- **Don't** 为资料卡补写接口未提供的用途摘要或来源结论。
- **Don't** 把报告中的自述状态画成接收方已独立验证。
- **Don't** 用紫色填满中性表面；它只强调选择、焦点和操作反馈。
- **Don't** 在窄屏保留桌面两侧浮栏布局。
