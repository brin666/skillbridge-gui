// 全部为官网演示用的合成示例数据：名称、会话、文件与数量均为虚构，
// 不来自任何真实档案、会话记录、路径或配置。
export const SAMPLE_NOTE = '示例数据';

export const categories = [
  {id: 'skills', label: 'Skills', icon: 'layers'},
  {id: 'rules', label: '规则', icon: 'file'},
  {id: 'memory', label: '记忆', icon: 'memory'},
  {id: 'mcp', label: 'MCP', icon: 'plug'},
  {id: 'ledger', label: '账本', icon: 'chart'},
];

// Skill：中文用途在上，原名在下（与正式界面一致）。
const skill = (id, title, original, description, extra = {}) => ({
  id, type: 'skills', icon: 'layers', title, subtitle: original, description,
  footer: ['Codex', extra.location || '共享技能', extra.translation || '中文简介'].join(' · '),
  files: ['SKILL.md', ...(extra.files || [])], ...extra,
});
// 记忆：标题使用自然的会话名称。
const memory = (id, title, description, date, extra = {}) => ({
  id, type: 'memory', icon: 'memory', title, subtitle: 'Codex 会话名称（示例）', description,
  footer: ['Codex', '待确认', date].join(' · '), files: ['memory.md'], ...extra,
});

export const assets = [
  skill('s-release', '发布说明撰写', 'release-notes-writer', '把一组提交整理成面向用户的更新说明，按新增、修复、变更分组。', {frequent: true, files: ['references/template.md']}),
  skill('s-sheet', '表格数据清洗', 'sheet-cleaner', '去重、统一日期与金额格式，输出一份可核对的清洗记录。', {frequent: true, files: ['scripts/clean.py']}),
  skill('s-tests', '单元测试补写', 'unit-test-helper', '按现有函数行为补写测试用例，先说明覆盖了哪些情况。', {location: '插件技能', files: ['references/patterns.md']}),
  skill('s-slides', '演示文稿大纲', 'deck-outline', '从一段需求生成分页大纲，每页一个要点和备注。'),
  skill('s-i18n', '界面文案翻译', 'ui-copy-translate', '翻译界面文案并保留占位符、长度限制和术语表。', {files: ['references/glossary.md']}),
  skill('s-meeting', '会议纪要整理', 'meeting-notes', '把会议记录整理成决定、待办和负责人三部分。'),
  skill('s-image', '图片批量压缩', 'image-batch-compress', 'Batch-resize and compress images for the web.', {location: 'Codex 技能', translation: '尚未准备中文简介', files: ['scripts/compress.mjs'], state: '有待补事项'}),
  skill('s-api', '接口文档速读', 'api-docs-reader', '读取接口文档，列出鉴权方式、主要端点和示例请求。', {location: '插件技能'}),

  {id: 'r-global', type: 'rules', icon: 'file', title: '全局 AGENTS.md', subtitle: '规则文件', description: '回答使用中文；改动前先说明计划；不删除未确认的文件。', footer: 'Codex · 个人 · 待确认', files: ['AGENTS.md'], body: '示例规则：\n- 回答使用中文。\n- 改动文件前先说明计划。\n- 不删除未经确认的文件。'},
  {id: 'r-project', type: 'rules', icon: 'file', title: '项目 AGENTS.md', subtitle: '项目：demo-notes', description: '提交前运行测试；界面文案统一放在语言包里。', footer: 'Codex · 项目 · 待确认', files: ['AGENTS.md'], body: '示例规则：\n- 提交前运行 npm test。\n- 界面文案统一放在 locales/ 中。'},
  {id: 'r-command', type: 'rules', icon: 'file', title: '命令规则', subtitle: '命令规则文件', description: '允许只读命令自动执行，写入和联网命令需要确认。', footer: 'Codex · 个人 · 待确认', files: ['default.rules']},

  memory('m-weekly', '把周报模板改成表格版', '项目：demo-notes', '11月8日', {body: '示例记忆：周报改为三列表格（完成 / 进行中 / 风险），每周五生成。'}),
  memory('m-trip', '整理东京五日行程预算', '个人记忆', '11月6日', {body: '示例记忆：预算按交通、住宿、餐饮三类汇总，币种统一为人民币。'}),
  memory('m-login', '修复登录页在手机上错位', '项目：demo-shop', '11月3日', {body: '示例记忆：问题来自固定宽度的输入框，已改为百分比宽度。'}),
  memory('m-readme', '给 README 补上安装说明', '项目：demo-notes', '10月29日'),
  memory('m-old', '旧版同步方案讨论', '旧版存档', '9月12日', {state: '已过期', footer: 'Codex · 已过期 · 9月12日'}),

  {id: 'c-files', type: 'mcp', icon: 'plug', title: 'filesystem', subtitle: 'config.toml · 全局', description: '本地文件访问配置。仅登记配置，未启动、未测试连接。', footer: 'Codex · 个人', files: ['mcp.json'], body: '{\n  "command": "npx",\n  "args": ["-y", "example-filesystem-server", "${PROJECT_DIR}"]\n}\n\n示例配置 · 连接状态：未检查'},
  {id: 'c-browser', type: 'mcp', icon: 'plug', title: 'browser-tools', subtitle: '插件声明', description: '网页自动化工具的配置。凭据已替换为变量引用。', footer: 'Codex · 个人 · 有待补事项', state: '有待补事项', files: ['mcp.json'], body: '{\n  "url": "https://mcp.example.com/browser",\n  "headers": {"Authorization": "${BROWSER_TOOLS_TOKEN}"}\n}\n\n示例配置 · 接收方需重新填写凭据'},
  {id: 'c-docs', type: 'mcp', icon: 'plug', title: 'docs-search · 已禁用', subtitle: 'config.toml · 项目', description: '文档检索服务，配置中已禁用。', footer: 'Codex · 项目', files: ['mcp.json']},

  {id: 'l-run', type: 'ledger', icon: 'chart', title: 'Codex 资料整理记录', subtitle: '整理账本（示例）', description: '本次登记的数量、来源和失败项，不代表使用次数或排名。', footer: 'Codex · 个人', files: ['codex-inventory.json'], body: '示例记录（虚构数量）\n发现：Skill 9 · 记忆 5 · 规则 3 · MCP 3\n登记：Skill 8 · 记忆 5 · 规则 3 · MCP 3\n未登记：1 个 Skill —— FILE_TOO_LARGE（单个文件超过 32 MiB）\n未启动 MCP，未运行任何 Skill。'},
];
