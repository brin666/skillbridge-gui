# 资料购物车 v2 · 设计规则

状态：设计预览，待用户评审；不代表正式 GUI 已获批准。

## 结构
- 桌面：左侧 72px 悬浮图标导航（5 类）；中间卡片网格（自动列宽 ≥262px）；右侧 76px 细长购物车，点击展开为 388px 面板（覆盖在内容上，背景轻微模糊）。
- ≤900px：顶部吸附分类条（仅当前分类显示文字）；单列卡片；底部悬浮「购物车」胶囊，打开 Astryx Drawer。

## 视觉
- 背景 #F5F5F2，卡片 #FFFFFF，正文 #141418，次要 #5C5C66，弱化 #9B9BA3。
- 唯一强调色 #5346F2（选中、计数、飞行副本、已复制）；主按钮沿用 Neutral 主题的墨色。
- 警示只用一个 7px 琥珀色圆点 #E0951F，悬停显示「缺少文件 / 已过期」。
- 卡片圆角 24px，图标块 15px，胶囊控件全圆角；阴影只在悬停与浮层出现。
- 标题 52px / 680；卡片名 17.5px / 620；用途一行 13.5px，超出省略。

## 动效
- 弹簧曲线由 src/motion.js 模拟阻尼弹簧，生成 CSS `linear()` 缓动（snappy / bouncy / soft / gentle），不支持时回退为 cubic-bezier。
- 详见 CHANGES.md 的动效清单。

## 使用的 Astryx 组件
Theme、Button、IconButton、Card、TextInput、Drawer、Dialog、Tooltip。v1 的 SideNav 换成了自绘图标导航（为了实现共享指示器滑动）。
