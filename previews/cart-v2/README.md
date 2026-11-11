# SkillBridge 资料购物车 · v2 交互预览

独立预览。基于 Astryx 0.7.13 真实组件（@astryxdesign/core + theme-neutral），React 19 + Vite 5。
所有条目、来源、文件与状态均为示例；不扫描、不改写、不导出任何本机资料。

## 运行（Windows）

```
cd D:\skillbridge\previews\cart-v2
npm.cmd ci
npm.cmd run dev
```

打开 http://127.0.0.1:17332 。构建：`npm.cmd run build`。

依赖解析自 registry.npmmirror.com（与 v1 相同，见 package-lock.json）。

改动说明见 [CHANGES.md](CHANGES.md)；设计规则见 [DESIGN.md](DESIGN.md)；功能需求仍以 ux-spec.md / user-flows.md / handoff-contract.md 为准。
