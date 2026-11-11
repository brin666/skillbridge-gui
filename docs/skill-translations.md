# Skill 中文用途与原名

Codex、Claude Code、Hermes、Pi 及手动登记的 Skill 共用同一展示格式。翻译由当前运行 SkillBridge 的 Agent 完成，工具负责导出待补项、核对来源并回填本地档案；前端读取已保存的文字，不在切换分类或搜索时调用模型。

先完成资料整理，再执行：

```powershell
python scripts/skill_translations.py prepare --data-dir D:/SkillBridgeData/my-profile --output D:/SkillBridgeData/my-profile/skill-translations.pending.json
```

Agent 阅读每项 `originalDescription`，填写 `titleZh`（简短中文名称）和 `summaryZh`（具体中文用途）。保留 `originalName`、`assetId`、`version` 和 `sourceSha256` 原值；同名但描述不同的 Skill 分开翻译。已有有效中文简介的资料无需重复翻译。没有可读用途时报告待补，不凭名称猜测。

```powershell
python scripts/skill_translations.py apply --data-dir D:/SkillBridgeData/my-profile --input D:/SkillBridgeData/my-profile/skill-translations.pending.json
```

刷新 GUI 清单后，卡片显示中文名称、中文用途和原名。返回码 2 表示仍有待处理项，按输出核对；源文件变化或版本冲突时重新整理并准备新的待补清单，不修改旧文件中的版本来绕过检查。

翻译缓存位于档案内的 `skill-translations.zh-CN.json`，按原名与原描述的指纹保存，后续整理会复用。原描述变化后旧译文不再自动匹配。个人待补清单和缓存不提交 GitHub。

只修改已有 `environment.presentation` 展示元信息；源目录、原始名称、交接包选择、常用偏好不变。仍遵循后端的大小、敏感内容和系统资产限制。

现有文件登记接口没有原子的元数据版本更新：工具在回填前检查版本与整个目录快照，但不要同时运行整理或编辑同一资产。此流程未修改后端契约。
