import {defineConfig} from 'vite';

// GitHub Pages 项目子路径。可用 SITE_BASE 环境变量或 `vite build --base=/xxx/` 覆盖。
const PAGES_BASE = '/skillbridge-gui/';

export default defineConfig(({command, isPreview}) => ({
  base: command === 'serve' && !isPreview ? '/' : (process.env.SITE_BASE || PAGES_BASE),
  esbuild: {jsx: 'automatic'},
  server: {host: '127.0.0.1', port: 17351, strictPort: true},
  preview: {host: '127.0.0.1', port: 17351, strictPort: true},
  build: {
    outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900,
    // Astryx 组件带 "use client" 指令，打包时会被忽略，属于无害提示。
    rollupOptions: {onwarn(w, warn) { if (w.code !== 'MODULE_LEVEL_DIRECTIVE') warn(w); }},
  },
}));
