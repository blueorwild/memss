# 回忆星空（暂名）— 项目计划

> 一个纯爱好向的本地个人网站：以「星空」为外壳承载个人回忆，并常驻一只可对话、可操作回忆空间的悬浮小精灵智能体。

---

## 1. 项目概述

- **性质**：个人探索项目，非求职作品，重体验与乐趣。
- **形态**：本地单体全栈应用，一条命令启动，浏览器打开 `localhost`，支持热更新实时调试。
- **用户**：单用户（本人），加一层简单密码保护。
- **核心诉求**：
  1. 回忆空间：回忆体 = 图片（主）+ 可选文字 + 可选背景音乐，三位一体。
  2. 悬浮小精灵：独立常驻的智能体，可对话，也可通过功能按钮「做事情」（首个能力：上传回忆）。

## 2. 目标与非目标

**目标**
- 沉浸式、层级化地浏览回忆。
- 录入与智能体对话统一，小精灵既是聊天入口也是操作入口。
- 架构解耦，渲染引擎与 Agent provider 均可替换升级。

**非目标（本期不做）**
- 多用户、注册登录体系、社交分享。
- 云端部署运维、移动端原生 App。
- 真实 3D 引擎（本期用伪 3D，架构预留升级空间）。

## 3. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js (App Router) + TypeScript | 前后端一体，生态最全 |
| 样式 | Tailwind CSS | 快速构建 |
| 数据 | SQLite + Drizzle ORM (better-sqlite3) | 本地零依赖，元数据持久化 |
| 媒体 | 本地 `media/` 目录 + API 流式提供 | 图片/音乐原文件，不入库 |
| 状态 | Zustand | 导航路径、当前类别、UI 状态 |
| 动画 | Framer Motion | 星空钻入/钻出、场景过渡 |
| 星空渲染 | Canvas 粒子 + DOM 视差层 | 伪 3D，性能与开发效率平衡 |
| Agent | Vercel AI SDK（流式 + tool calling） | OpenAI 兼容接口 |
| 音频 | Web Audio API（GainNode） | 音乐淡入淡出 |

## 4. 数据模型

```
Category {
  id          // 主键
  parentId?   // 自引用，构成可生长分类树
  name
  kind        // globe | country | region | custom
  order       // 同级排序
}

Memory {
  id
  categoryId  // 归属节点（允许任意节点，不强制叶子）
  title
  date?       // 回忆发生时间
  description?// 可选文字
  location    // 地点文本（冗余，便于展示与检索）
  seed        // 确定性散落布局的随机种子
}

Media {
  id
  memoryId
  type        // image | audio
  path        // media/ 下的相对路径
  order       // 图片顺序
  caption?
}
```

**关键规则**
- 回忆可挂在**任意节点**（含非叶子）；该节点可同时拥有子星与回忆缩略图。
- 某节点「可点」的判定按**子树递归**：子树内存在任意回忆即可点，否则灰暗不可点。
- `seed` 由 `memory.id`/`date` 派生，保证同一子类每次进入缩略图位置一致，形成稳定的「记忆星图」。

## 5. 目录结构（草案）

```
ai_try/
├─ drizzle/                    # drizzle-kit 生成的迁移
├─ data/                       # SQLite 数据库文件（gitignore）
├─ media/                      # 图片/音乐原文件（gitignore）
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              # 星空入口
│  │  ├─ login/page.tsx        # 简单密码登录
│  │  └─ api/
│  │     ├─ agent/route.ts     # 对话 + tool calling
│  │     ├─ memories/...       # 回忆 CRUD
│  │     └─ media/[...]/route.ts  # 媒体文件流
│  ├─ components/
│  │  ├─ starfield/            # 星空渲染（分层视差 + 钻入钻出 + 面包屑）
│  │  ├─ memory-scene/         # 沉浸式场景（图片轮播/文字/音乐淡入）
│  │  └─ sprite/               # 悬浮小精灵（对话 + 功能按钮）
│  ├─ lib/
│  │  ├─ db/                    # drizzle 连接与 schema（index.ts / schema.ts）
│  │  ├─ providers.ts          # LLM provider 配置
│  │  ├─ agent-tools.ts        # 工具定义（上传/检索/导航/…）
│  │  └─ layout-seed.ts        # 确定性散落布局
│  ├─ store/                   # Zustand stores
│  └─ middleware.ts            # 访问保护
```

## 6. 核心模块设计

### 6.1 星空导航
- 层级：地球 → 国家 → 地区 → （用户自定义子类，可继续下钻）。
- 每个类别以一颗「星星」呈现；有内容（递归）的星可点并带特效，否则灰暗。
- 交互：点击星星 → 镜头推进（scale + opacity 过渡）进入下一层；提供**面包屑/层级路径**与**返回上级**，防止迷路。
- 末级：该子类下的多张回忆以缩略图按 `seed` **确定性散落全屏**，并用时间线索串联。
- 渲染分层：导航状态 / 数据层 / 渲染层解耦，便于日后升级为 React Three Fiber。

### 6.2 沉浸式回忆场景
- 由缩略图点击进入，镜头拉近作为过渡。
- 呈现：主图轮播 + 文字淡入 + 背景音乐淡入（离开淡出）。
- 点击缩略图即用户交互，可绕过浏览器自动播放限制。

### 6.3 悬浮小精灵
- 全局常驻、与页面路由解耦；右下角悬浮，点击展开对话面板。
- 能力：
  - **对话**：流式输出，可触达回忆操作工具。
  - **功能按钮**：可扩展按钮区，首个为「上传回忆」；后续候选：导航回忆、AI 润色描述、配乐推荐。
- 上传流程：点「上传回忆」→ 默认归属**当前所在类别** → 表单填图片（主）/文字/音乐/时间/地点 → 地点可搜索或新建分类节点。
- 对话与按钮**共享同一套 tool 层**，因此「帮我把这组照片存成回忆」也能走对话完成。

## 7. Agent 设计

### 7.1 可扩展 Provider
- 目标：可填 DeepSeek、智谱、opencode 系网关等任意 **OpenAI 兼容**服务。
- 统一用 OpenAI SDK / Vercel AI SDK，通过 `createOpenAI({ baseURL, apiKey })` 动态创建。
- 配置结构（`lib/providers.ts` + `.env.local`）：
  ```
  { id, name, baseURL, apiKey, model, supportsTools }
  ```
- 支持默认 provider 与运行时切换；密钥仅存 `.env.local`，不提交。

### 7.2 Tool Calling 与降级
- 小精灵「做事情」依赖 tool calling。
- 部分 OpenAI 兼容端点在 `tools` / 流式上存在兼容差异 → 配置 `supportsTools` 能力标记，接入时验证，不支持则**降级为纯对话**，保证换 provider 仍可用。
- 初版工具集：`uploadMemory`、`searchMemories`、`navigateToCategory`、`createCategory`；后续扩展 `polishDescription`、`recommendMusic`。

## 8. 访问保护
- `src/middleware.ts` 拦截所有页面与 API。
- 密码存 `.env.local`，校验通过后种 `httpOnly` **签名 cookie**。
- 媒体路由一并保护；本地使用无额外负担。

## 9. 分阶段里程碑（约 1 个月）

| 阶段 | 内容 | 预估 |
|---|---|---|
| P0 环境 ✅ | 安装 nvm + Node、初始化 Next.js、Drizzle + SQLite 跑通 | 0.5d |
| P1 数据 + 最简呈现 ✅ | schema、种子数据、回忆详情页（图/文/乐）；上传 API 顺延至 P3 | 3–4d |
| P2 星空导航 ✅ | 分类树、星区、3D 滚筒回忆、镜头推进、面包屑 | 5–6d |
| P3 小精灵 ✅ | 悬浮组件、对话面板、流式输出、功能按钮框架、上传回忆表单 | 5–6d |
| P4 Agent 能力 🔄 | Provider 配置化、tool calling（检索/导航/上传/遗忘）、与星空联动 | 4–5d |
| P5 打磨 | 动效、音效、性能、响应式 | 余量 |

> 说明：里程碑顺序按「先跑通数据与呈现，再叠加智能体」排列，保证每阶段都有可验收产物。

## 10. 待定项与后续设计

- 项目正式命名、视觉主题色与星空风格。
- 回忆体在星空末级的具体排布算法与时间线视觉表达。
- 小精灵的形象（2D/局部动效）、是否引入语音（TTS/STT）。
- 小精灵功能按钮的完整清单与优先级（②③④待定）。
- 是否支持按地点/日期批量导入（相册目录）。
- 分类树的编辑交互（重命名、移动、删除的级联策略）。
- 音乐是否支持一个回忆多首/播放列表。

## 11. P2 详细设计（已定稿）

- **基调**：极简深空（近黑底 + 白/淡蓝星点 + 极弱星云）。
- **布局**：顶部面包屑 / 返回；星区（约 30%）+ 滚筒回忆区（约 70%）。
- **星区**：当前节点子类别渲染为星；可点（子树回忆数 > 0）发光脉动，不可点黯淡；点击镜头推进。
- **滚筒回忆区**：垂直轴水平旋转的透明滚筒；缩略图按时间顺序沿圆周分布，高度 / 半径 / 自转按 seed 抖动；背面变暗半透明；下沿圆弧光轨 + 年份刻度；拖拽 + 惯性，静止后自动缓转。
- **过渡**：点击星 → 白点放大铺满 → 新层淡入（framer-motion）。
- **路由**：`/star/[...path]`；`/` 重定向 `/star/globe`；`Esc` / 面包屑 / 返回按钮上级。
- **技术**：CSS 3D transform 实现滚筒；zustand 状态；`lib/layout-seed.ts` 提供确定性伪随机与柱面坐标。
- **验收**：`/star/globe` → 点「日本」→ `/star/globe/jp` → 「东京」→ 滚筒显示回忆；点击缩略图进详情。

## 12. P4 实施记录（Agent 能力）

### 12.1 技术选型
- `ai@7` + `@ai-sdk/openai-compatible@3` + `zod@4`；**不引入 `@ai-sdk/react`**（前端手写 SSE 解析，前端零额外依赖）。
- 服务端 `/api/agent` 用 `streamText({ tools, stopWhen: isStepCount(8) })`，工具多步调用由 AI SDK 自动完成；遍历 `result.fullStream` 自行编码为 SSE。

### 12.2 Provider 与设置
- 内置服务收敛为 **DeepSeek** 与 **OpenCode Go**（`ProviderId = "deepseek" | "opencode-go"`）；`baseURL` / `headers` 属内部适配，**不暴露给用户**，用户只需选服务、填 API Key、选模型。
- OpenCode Go 需 `x-opencode-session`（服务端按对话注入）与自定义 UA。
- **密钥加密入库**：AES-256-GCM（`lib/crypto.ts`），主密钥优先环境变量 `AGENT_SECRET`，本地回退自动生成 `data/secret.key`（600，gitignore）。`GET /api/settings` 只回传掩码。
- 模型列表经 `GET /api/agent/models?providerId=` 服务端代理获取，前端用 Combobox 搜索选择；模型列表加载失败可手填。
- 设置面板为**可折叠区块**结构（首块「模型服务」默认收起），对话面板顶部显示「使用中：服务 · 模型」，设置内以「使用中」绿点区分生效 vs 编辑。

### 12.3 工具集（`lib/agent-tools.ts`）
| 工具 | 作用 | 前端动作 |
|---|---|---|
| `searchMemories` | 关键词/类别/日期检索（数据源） | — |
| `navigateToCategory` | 跳转到类别（名称或 id） | `navigate` |
| `openMemory` | 打开某条回忆详情 | `navigate` |
| `uploadMemory` | 打开上传面板并预填 | `openUpload` |
| `forgetMemory` | 遗忘回忆（二次确认） | `forgotten` |
| `forgetCategory` | 遗忘类别（含回忆时选 move/purge，二次确认） | `forgotten` |

- 二次确认：工具 `confirm` 参数 **且** 服务端校验「最后一条用户消息含确认词」才执行；未确认时只返回待确认信息。
- 动作通过 `action` 事件下发；`navigate` 在星空页走**迷雾过渡**，`forgotten` 与按钮删除行为一致（当前正在看被删对象则回上一层，否则刷新）。
- 搜索卡片：`memories` 事件绑定到当前 assistant 消息、最多展示 3 条；正文只做 2–3 句概括，禁止逐条罗列。

### 12.4 过渡性能优化
- 移除大尺寸 `filter: blur` 与 `mixBlendMode`，光斑 5→3，加 `willChange`/`translateZ`，`scale 12→7`、时长 `0.1→0.18s`。
- 星空 canvas 改为每 2 帧绘制一次，并在 `sceneTransitioning` 期间暂停。

### 12.5 状态
- **Step 0–5 完成**：依赖、数据层（含 settings 加密）、接口、设置 UI、流式对话、工具与动作；另含用户追加的 `openMemory`、遗忘工具、搜索卡片、过渡优化。
- **Step 6 重定义（重做计划）**：原计划仅「存文本 + 历史列表 UI」，现结合需求升级为：
  1. **服务端会话真相源**：`messages` 存**完整 AI SDK 消息（含 tool-call/tool-result）**；前端 `send` 只发 `conversationId` + 输入，打开面板从后端拉历史，前端**只渲染**。
  2. **卡片由后端决定与分页**：后端决定每批展示条目（≤3）与 total；模型因"看得到完整会话"可分批、过滤、调整；前端不持有分页/已展示状态。
  3. `conversations`/`messages` API（列表 / 新建 / 多选删除 / 一键清空）与多会话历史面板 `HistoryPanel`。
- **Step 7 收尾**：降级/文档/`tsc`+`lint`/提交（未做）。
