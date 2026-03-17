# Legacy 脚本说明

本目录用于存放历史/一次性数据处理脚本。

## 脚本列表

- `migrate-json-to-sqlite.js`
  - 用途：把根目录 `data.json` 或 `prompt-data.json` 全量迁移到 SQLite。
  - 运行：`npm run migrate:sqlite`
  - 可选环境变量：
    - `MIGRATE_USERNAME`（默认 `local`）
    - `MIGRATE_PASSWORD`（默认 `local123456`）

- `smart-update-from-legacy.js`
  - 用途：基于 `prompt-data.json` 做“智能合并更新”（按标题/来源角色去重，尽量不覆盖已有有效值）。
  - 运行：`node scripts/legacy/smart-update-from-legacy.js`

- `smart-separate-role-outfit.js`
  - 用途：智能分离“角色特征/服装特征”，并把手持物、武器、附加项拆成独立配件条目。
  - 运行：`node scripts/legacy/smart-separate-role-outfit.js`

## 注意事项

- 执行前请确保服务已停止，避免并发写库。
- 涉及批量改写的脚本会自动生成数据库备份（`data.backup-*.sqlite`）。
- 如果要回滚，先备份当前库，再用备份文件覆盖 `data.sqlite`。