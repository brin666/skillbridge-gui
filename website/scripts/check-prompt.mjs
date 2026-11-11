// 确认 LAUNCH_PROMPT.md 中的指令与页面实际复制的 src/launch-prompt.txt 一字不差。
import fs from 'node:fs';
const norm = s => s.replace(/\r\n/g, '\n');
const txt = norm(fs.readFileSync(new URL('../src/launch-prompt.txt', import.meta.url), 'utf8')).trim();
const md = norm(fs.readFileSync(new URL('../LAUNCH_PROMPT.md', import.meta.url), 'utf8'));
const block = md.match(/<!-- PROMPT:BEGIN -->\n```text\n([\s\S]*?)\n```\n<!-- PROMPT:END -->/)?.[1]?.trim();
if (block !== txt) { console.error('LAUNCH_PROMPT.md 与 src/launch-prompt.txt 不一致'); process.exit(1); }
console.log('LAUNCH_PROMPT.md 与页面复制内容一致（' + [...txt].length + ' 字）');
