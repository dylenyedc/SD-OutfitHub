# SD-OutfitHub
一个轻量的本地化项目，用于管理和检索 Stable Diffusion 服装相关提示词数据。

主要文件
- `index.html` — 前端界面
- `server.js` — 提供静态页面的简易本地服务器
- `assets/resource-pack.json` — 图标资源包索引
- `assets/icons/` — 默认应用图标与 favicon
- `prompt-data.json` — 本地提示数据（已加入 `.gitignore`，不随仓库提交）
- `package.json` — 依赖与启动脚本
- `start-windows.bat` — 便于在 Windows 下启动

前端架构（简版）
- `scripts/core/`：基础层（状态、工具、数据读写、启动入口）
	- `state.js`：全局状态与 DOM 引用
	- `utils.js`：通用工具函数（转义、深拷贝、ID、标签解析）
	- `data.js`：与 `/api/prompts` 的读写和数据标准化
	- `main.js`：应用初始化与启动
- `scripts/features/`：功能层（界面渲染、业务动作、事件绑定）
	- `render.js`：卡片与筛选渲染、切页显示
	- `actions.js`：增删改、复制、Toast 等业务动作
	- `events.js`：按钮与输入框事件绑定
- 加载顺序：`core/state -> core/utils -> core/data -> features/render -> features/actions -> features/events -> core/main`

快速使用
1. 在项目目录运行：`npm install`
2. 启动：`npm start` 或 双击 `start-windows.bat`
3. 打开浏览器访问 `http://localhost:3000`（端口以 `server.js` 配置为准）

Agent Skill（关键词检索提示词）
- 接口：`GET /api/agent-skill/search`
- 作用：允许 Agent 按关键词访问本地提示词数据库，并返回匹配结果
- 支持：模糊检索（名称、分组标题、标签、prompt 内容）

查询参数
- `keyword` 或 `q`：检索关键词（必填）
- `limit`：返回数量，默认 10，最大 100
- `section`：限定检索范围，可选 `chars` / `actions` / `env`

示例
- `/api/agent-skill/search?keyword=goldenglow`
- `/api/agent-skill/search?q=礼服&section=chars&limit=20`

返回结构（简要）
- `skill`：技能名（固定为 `prompt-search`）
- `query`：原始检索词
- `section`：检索范围
- `total`：命中条数
- `results`：结果列表（含 `itemName`、`prompt`、`score`、`matchedFields` 等）

重要声明
该项目纯属个人 vibe coding 产物，缺乏安全性、输入校验和错误处理。强烈不建议在生产环境或公开场合使用或直接共享。