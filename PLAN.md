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
  createdAt   // 上传时间（毫秒）；无 date 时作为排序依据
  coverMediaId? // 设为缩略图的图片 media.id；为空/失效时回退到第一张图片
}

Media {
  id
  memoryId
  type        // image | audio
  path        // media/ 下的相对路径
  order       // 图片顺序
  caption?
  focalX      // 裁剪焦点 X 百分比（默认 50）
  focalY      // 裁剪焦点 Y 百分比（默认 50）
  cropScale   // 裁剪缩放百分比（100-600，默认 100）
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
| P4 Agent 能力 ✅ | Provider 配置化、tool calling（检索/导航/上传/遗忘）、与星空联动 | 4–5d |
| P5 打磨 | 动效、音效、性能、响应式（并入 §13 1.0 上线路线图） | 余量 |

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
- **Step 6 完成（服务端会话真相源）**：
  1. `messages` 表存**完整 AI SDK 消息**（`data` JSON，含 `tool-call`/`tool-result`）与可读 `content`；`cards` 记录助手消息的卡片结果（历史重开时重现）。
  2. `/api/agent` 入参改为 `{ conversationId?, text, categoryId? }`：自动建会话、回灌完整历史、流结束后把 `responseMessages` 落库；SSE 新增 `meta` 事件回传会话 id/标题。
  3. 新增 `showMemories` 工具：模型检索、过滤后**显式指定**展示条目（每批 ≤3，服务端兜底），卡片由此下发；`searchMemories` 降为数据源。正文要求 2–3 句概括 + 分批提示。
  4. `conversations` API（列表 / 详情 / 多选删除 / 一键清空）与 `HistoryPanel`（列表、切换、多选删除、清空、新对话）。
  5. 前端 `ChatPanel` 只渲染后端内容：仅发 `conversationId + text`，`localStorage` 记住当前会话，刷新自动恢复。
- **Step 7 收尾**：完成。`.env.example`、`.gitattributes`、迁移路径修复见 §13.7；部署与访问保护纳入 1.0 上线路线图。后续 Phase 1 的准确性与体验优化见 §13.2（已完成）。

## 13. 1.0 上线路线图（部署公网 + 手机访问）

### 13.1 已确认方案
- **目标机器**：Windows x86 + Docker（WSL2）。
- **隧道**：Cloudflare Tunnel（自购域名并托管 Cloudflare）。不用 Vercel/Vercel 类 serverless：本项目依赖 SQLite 持久化、本地媒体文件与长流式请求，需常驻 Node + 持久卷。
- **访问保护**：应用内密码（`middleware` + 登录页 + 签名 cookie）。
- **数据**：部署机与开发机均重新 seed，不迁移 `data/`。
- **手机端 1.0 范围**：导航 / 看回忆 / 上传 / 对话 / 历史。

### 13.2 Phase 1 — Agent 准确性与体验优化 ✅ 已完成
1. ✅ `searchMemories` 结果补 `location`（+ 类别名），模型可直接判断"是否在某地"，减少多轮检索。
2. ✅ prompt 收紧检索策略（先一次尽量查全再过滤）；`searchMemories` 的 `limit` 默认 20、上限 50。
3. ✅ 助手空文本兜底：仅调工具未输出时给一句提示。
4. ✅ 流式期间「停止」按钮（`AbortController`）；发送中锁定历史切换。
5. ✅ SSE 断开/超时的错误提示与重试。
6. ✅ 图片懒加载 + 异步解码（`loading="lazy"` / `decoding="async"`）。
7. ✅ **回复重复修复**（`3f8361e`）：按 `start-step`/`finish-step` 做步骤级文本缓冲，**仅下发未调用工具的最终步骤文本**；落库 `content` 对含工具调用的消息置空；`/api/conversations/[id]` 过滤「无 content 也无 cards」的 assistant。实测回复不再重复。
8. ✅ **「这里/这片星空」绑定当前类别**（`3ae0bd5`）：把当前 `categoryId` 注入 prompt，模型据此检索当前子树。实测「中国」页 5 条、7.5s。
9. ✅ **dev server 绑定 `127.0.0.1`**（`fdba254`）：`dev` 脚本改 `next dev -H 127.0.0.1`，消除同网段内网暴露（原监听 `*:3000` 且 macOS 防火墙关闭 → 可读数据/白嫖 AI 额度/删数据）。

> 效果对比：同类多步检索任务由约 42s 降至约 13.5s。

### 13.3 Phase 2 — 移动端适配（Step 1–6 ✅ 已完成）
**统一「双轨」布局（用户确认）**：宽屏（≥640px）= 上下两行横向轨道；窄屏 = 左右两列纵向轨道；手机横屏（矮容器）自动横向 + 紧凑/迷你卡片。
- 模式判定：每轨容量 `min(几何容量, PER_TRACK_MAX=3)` → 阈值 `2×3=6`；`n ≤ 6` **平铺**（格内随机偏移 + 轻微旋转 + 缓缓浮动 + 第 2 轨错开半卡），`n > 6` **流动**（大半径滚筒 `R=max(长边×2.5,1200)`、仅渲染可见+屏外缓冲、两端 CSS mask 渐隐、随机起点、由旧至新、拖拽+惯性）。
- 同屏完整缩略图 ≤ 6；1 段居中、2 段间距 `1.5×卡宽`（受可用区约束）。
- 星轨：横向在底部（常规 140px / 矮容器 64px），纵向在**左侧**（56px），**上旧下新**；光标跟随弧线 x，十字星芒「竖短 3×18 + 横长 26×3」；交叉方向必须避让星轨占位。
- 图片预热：裁剪缓冲 `max(step, 屏长×0.25)` + `loading="eager"` + 加载完成 300ms 淡入（含 `img.complete` 缓存命中处理）。

**Step 1 ✅ 地基**（`898bca4`）：`layout.tsx` 导出 `viewport`（`viewport-fit: cover`、`themeColor #05060a`、`interactiveWidget: "resizes-content"`）；`globals.css` 加 `--safe-*` 变量、`touch-action: manipulation`（禁双击缩放）、`overscroll-behavior-y: none`、`-webkit-tap-highlight-color: transparent`、`body min-height: 100dvh`；全站 `h-screen`/`min-h-screen` → `h-dvh`/`min-h-dvh`。实测 375/390/360 无横向溢出。
**Step 2 ✅ 小精灵底部抽屉**（`fc3d586`）：新增 `useMediaQuery`/`useIsMobile`（`useSyncExternalStore`，断点 `(max-width: 639px)`）；窄屏面板改底部抽屉（`h-[min(78dvh,560px)] w-full rounded-t-2xl pb-[var(--safe-bottom)]`、遮罩 z-[65] 点击关闭、面板 z-[70]），锁 body 滚动、悬浮球避让安全区。桌面 360×460 面板无回归。
**Step 3 ✅ 面板内部窄屏化**（`36e7aba`）：输入框 `text-base sm:text-sm`（防 iOS 聚焦放大）、主按钮 ≥44px、次要控件 ≥36px、`enterKeyHint="send"`、`DialogContent` 加 `max-h-[85dvh] overflow-y-auto`、`ActionBar` 窄屏三等分。
**Step 4 ✅ 星空页**（`9e20e17` + `d72d583`）：`useElementSize` 让星距随容器收敛；窄屏纵向滚筒（`rotateX`、上下拖拽、背面剔除）；`VerticalTimelineRail`（左侧、上旧下新、光标对齐弧线、竖短横长星芒）；纵向滚筒自动上滚 1.5°/s；横竖滚筒均剔除背面卡片（带淡出）；手机横屏紧凑布局；header 安全区。
**双轨统一重塑 ✅**（`67c9ffb` + `40fbedf` + `d031bb2`）：`MemoryCylinder.tsx` 重写为「双轨统一」（`MemoryCylinder` 判定 + `TileBoard` + `FlowTracks`）；`layout-seed.ts` 删除 `gridScatter`/`timelineScatter`，新增 `TRACK_GAP=24`/`trackCapacity`/`trackCrossPositions`/`tileJitter`/`flowTilt`；星轨占位避让、每轨 ≤3 张稀疏化、平铺偏移限制在格内并双轨交错、横屏迷你卡片 + 星轨压缩；`memories.created_at` 加列（无日期排序用）；图片预热 / 1~2 段居中 / `seed:demo` 测试数据脚本。
**Step 5 ✅ 详情页**（`76ba34a`）：`PlayButton`（▶/❚❚ + 呼吸光晕，`failed` 红框提示）、**移除自动播放**；左右滑动切图（`|dx|>40 且 |dx|>|dy|×1.5`）；header/main 窄屏 padding + 安全区；标题响应式；背景图 `blur-sm → blur-xs` + `draggable={false}`；**窄屏 fixed 底栏 `grid grid-cols-3`**（‹ / ▶ / › 同水平线）；`Sprite` 窄屏默认球位置上移 64px 避开底栏。实测窄屏图片宽 341（91% 视口）、底栏三按钮 48px 同高、无横向溢出。
**Step 6 ✅ 收尾（降载 + 回归 + 全流程）**：
- **降载**：`StarBackground` 窄屏 `dpr ≤ 1.5`（桌面仍 `≤2`）、星数上限窄屏降为 220、`prefers-reduced-motion` 下**只静态画一帧**（无 rAF/闪烁/视差）、`document.hidden` 时暂停重绘；`Sprite` reduced-motion 关呼吸与常驻粒子、窄屏粒子减半（20→10）+ 星尘减半、reduced-motion 下不产生拖尾/星尘；`MemoryCylinder` 平铺卡片浮动动画按 reduced-motion 关闭；`MemoryScene` reduced-motion 下进退场**直接切换**（`motion-reduce:animate-none` + 返回时立即跳转，避免依赖 `animationend`）。
- **回归**：桌面 1440×900 + 窄屏 375 全页无横向溢出；`5/7/100 段` 卡片均为 **3:2**（200×133 / 150×100）、100 段仅渲染 10–12 张（视口裁剪正常）；详情页/面板/编辑/裁剪无回归；控制台无报错。
- **全流程**：窄屏 星空 → 点卡片进详情 → 小精灵抽屉 → 编辑 → **双击瓷砖弹出裁剪框**（353×391 完全适配 375 视口）→ 保存。

### 13.4 Phase 3 — 部署改造（代码层）
1. `MEDIA_ROOT` 环境变量：`api/media`、`api/memories` 路径可配（默认 `./media`）。
2. 访问保护：`middleware.ts` 保护页面与 `/api`（含 `/api/media`），放行 `/login`、`/api/auth/*`、`/_next/*`、favicon；`/login` 页 + `/api/auth/login|logout`；cookie 用 `AUTH_SECRET` 签名（httpOnly/secure/sameSite）。
3. `next.config.ts` 加 `output: "standalone"`。
4. `/api/health` 健康检查。
5. `Dockerfile`（多阶段、linux、编译 `better-sqlite3`）+ `docker-compose.yml`（`app` + `cloudflared` + 卷 `data`/`media` + healthcheck + `restart: unless-stopped`）。
6. 容器内初始化入口（`db:push` + `seed`）。
7. 备份脚本/说明；本地 `docker compose up` 先行验证。

### 13.5 Phase 4 — Windows 上机 + Cloudflare 上线
1. 目标机装 WSL2 + Docker Desktop。
2. 代码分发：GitHub 私有仓库 → clone。
3. 买域名 → 托管 Cloudflare → 创建 Tunnel（token 方式）。
4. `.env.production`：`AGENT_SECRET`/`AUTH_SECRET`/`ACCESS_PASSWORD`/`DATABASE_URL=/data/app.db`/`MEDIA_ROOT=/media`。
5. `docker compose up -d` → 初始化 DB + seed。
6. Cloudflare：Public hostname → `http://app:3000`；SSL=Full；**关闭 Rocket Loader / Auto Minify**；验证 SSE 不被缓冲。
7. Windows：关闭睡眠/休眠、确保 Docker 与隧道自启。
8. 手机验收：登录 → 导航 → 看回忆 → 上传 → 对话 → 历史（4G/5G 各测）。

### 13.6 Phase 5 — 维护
- 定时备份 `data/` + `media/`（robocopy 到另一磁盘/网盘）；日志；更新流程：`git pull` → `docker compose build && up -d`。

### 13.7 迁移到 Windows 开发机（已处理的迁移修复）
- **已完成**：`data/.gitkeep` + `src/lib/db/index.ts` 目录兜底；`.gitattributes`（统一 LF、标记二进制媒体）；`.env.example`（含 `DATABASE_URL`/`AGENT_SECRET`/`MEDIA_ROOT`/`ACCESS_PASSWORD`/`AUTH_SECRET`）。
- **步骤**：装 Git + Node 24 → clone 私有仓库 → 新建 `.env`（`DATABASE_URL="./data/app.db"`）→ `npm ci` → `npm run db:push` → `npm run seed` → `npm run dev`（**浏览器一律用 `http://localhost:3000`**）→ 设置面板重填 AI API Key。
- **注意**：`dev` 脚本已固定 `next dev -H 127.0.0.1`（仅回环监听、不暴露内网）；Next 16 dev 若用 `127.0.0.1` 作为浏览器地址会拦开发资源导致 React 不 hydrate，故浏览器用 `localhost`。`data/`（含 API Key 密文）与 `media/uploads/` 不上传；`better-sqlite3` 若报编译错误需装 VS Build Tools；保持 Node 版本一致（24）。

## 14. 细节打磨（回忆编辑等，已完成）

### 14.1 回忆编辑
- **入口只走小精灵面板**（符合「操作统一走小精灵」约定）：详情页 header 的「编辑」按钮与 Agent 工具 `openEditMemory` 都只是切到面板的编辑视图（`store.view = "edit"` + `editMemoryId`）。
- **共享表单** `MemoryForm`（`mode: "create" | "edit"`）取代原 `UploadMemoryForm`：编辑态先 `GET /api/memories/[id]` 回填；可改标题/描述/类别/日期，增删图片、设封面、替换或删除音乐。
- **API**：`GET /api/memories/[id]`；`PATCH /api/memories/[id]`（multipart）字段 `title/categoryId/date/description/location`、`imageMeta`（有序 JSON `[{id,x,y,scale}]`，含保留顺序与裁剪）、`newFocal`（与 `images[]` 同序的 `[{x,y,scale}]`）、`coverRef`（现有 mediaId 或 `new:<index>`）、`removeAudio`、`images[]`、`audio`。图片顺序 = 保留的旧图（按 `imageMeta`）在前、新增图在后；`PATCH` 只接受确实属于该回忆的图片 id（防越权）。
- **迁移类别**：编辑表单里改类别即可；小精灵侧新增 `moveMemory` 工具（**双保险二次确认**：工具 `confirm` + 服务端校验最后一条用户消息含确认词），迁移后重算 `location` 并下发 `moved` 动作触发刷新。

### 14.2 缩略图（封面）
- 新增 `memories.coverMediaId`（可空）。`listMemoryCards` 封面 = 显式封面（若仍存在）否则**第一张图片**；**删除当前封面 → 自动退回首张**；一张不剩则 `null`。

### 14.3 标题长度
- 规则：**按显示宽度**，汉字/全角/emoji = 2 半角单位，英数/半角符号 = 1，上限 **40 半角（= 20 汉字 / 40 英文字母）**。`src/lib/title-limit.ts` 前后端共用；表单实时计数（`n/20 字`）并禁用超限提交，POST/PATCH 服务端再次校验。历史超限数据不迁移，卡片仍靠 CSS 截断。

### 14.4 其他
- **历史对话多选删除**也加二次确认弹层（原本只有「清空全部」有）。
- **宽屏小精灵面板可拖动**（标题栏，`cursor-grab`），手动拖过后与悬浮球解耦；**位置不持久化**，刷新回默认。窄屏抽屉不变。
- **回忆描述保留换行**：详情页描述用 `whitespace-pre-wrap break-words`（`pre-line` 会折叠前导空格，ASCII 画会坏）。
- **标题/描述不做 trim**：POST/PATCH 原样保存（保留首尾空白与换行），仅必填校验时用 `trim()` 判断纯空白。曾因整串 `.trim()` 导致描述开头的缩进被吃掉。
- **图片裁剪（焦点 + 缩放）**：`media` 加 `focalX`/`focalY`（百分比，默认 50）+ `cropScale`（百分比 100–600，默认 100）。三者用同一套 CSS（`object-position` + `transform: scale` + `transform-origin`，见 `src/lib/crop.ts` 的 `coverStyle`）在**瓷砖 / 卡片 / 详情主图 / 详情背景 / 裁剪弹窗**里完全一致（背景额外叠 1.05 基础缩放）。表单瓷砖：**单击 = 设封面**、**双击 = 打开裁剪弹窗**（单击动作延迟 230ms，双击时取消，避免误设封面）。弹窗内固定 3:2 框，图片可拖动平移（按溢出比 1:1 跟手）、滚轮 / 双指捏合 / 滑杆缩放（100–600），可重置。提交 `newFocal`（与 `images[]` 同序的 `[{x,y,scale}]`）与 `imageMeta`（有序 `[{id,x,y,scale}]`），服务端 clamp。不生成新图片文件。
- **卡片比例统一为 3:2**：`CARD_NORMAL {200,133}`、`COMPACT {150,100}`、`TINY {120,80}`，与详情页一致，预览所见即所得。
- **页面快捷键守卫**（`src/lib/dom.ts` 的 `shouldIgnorePageShortcut`）：焦点在输入控件内 / 有 `[role="dialog"]` / 小精灵面板打开时，`MemoryScene`（←/→ 切图、空格播放、Esc 返回）与 `StarfieldPage`（Esc 上级）不再抢占按键——否则在小精灵面板里输入时 ←/→ 无法移动光标、空格打不出、Esc 误返回。

## 15. 后续打磨（E 计划）

> A（Phase 2 Step 6）已完成；B/C/D（部署与上线）在另一台机器上做。
> 范围已裁剪：**E2 / E3 / E7 / E8 不做**（每图 caption、多音乐、批量导入、精灵形象与语音）；命名与 favicon/OG 等视觉附件留待单独阶段。
> 执行顺序：**E1 ✅ → 搜索(原 E5+E6) ✅ → E4 → E9**（E9 全局改色放最后，避免与前面反复冲突）。

### E1 分类树重命名 / 移动 ✅ 已完成
- `PATCH /api/categories/[id]`（body `{name?, parentId?}`），校验五件套：根「地球」不可改、目标父级存在且非自身、**防环**（目标父级不得落在自身子树内）、**深度**（`depth(新父) + 子树高度 ≤ 5`）、目标同级重名。移动到新父级时追加到同级末尾（`sortOrder`）。
- `src/lib/db/mutations.ts`：`updateCategory` + **`resyncSubtreeLocation`**——`location` 由类别路径派生（去掉根「地球」），改名/移动后必须重算**子树内全部回忆**的 `location`，否则详情页与面包屑不一致。
- UI：`src/components/starfield/CategoryEditDialog.tsx`（复用 `ui/dialog.tsx`）；父级候选**排除自身子树**（UI 侧再挡一道防环）；星空页右上角新增「编辑」，位于「遗忘」左侧。父级选择用**弹层内联可折叠 cmdk 列表**而非 `Combobox`——Radix Dialog 内用 Portal 型 Popover 会被弹层盖住（`z-[80]` < `z-[91]`）、`body` 被设 `pointer-events:none`、且与焦点陷阱冲突（详见 `WORKBUDDY_MEMORY.md`）。**移动到新父级后 URL（按 id 组织）会失效 → 客户端算出新完整路径并 `router.push`**；仅改名则 `router.refresh()`。
- 验证：用一次性测试类别覆盖改名 / 同级重名 409 / 防环 400 / 超深 400（含临界合法 5 级）/ 根类别 400 / 不存在 404 / 合法移动；API 实测 `location` 随父级与子树改名同步（`E1R / E1S-改名` → 改名父级后 `E1R-改名 / E1S-改名` → 移动后 `E1S-改名`）；UI（桌面 1440 + 移动 375）用 **CDP 真实坐标点击/触摸**确认入口、弹层、候选排除自身子树、**候选列表无 Portal 且命中测试通过（不被弹层遮挡）**、改名后 header 更新、移动后 URL 变为新路径、展开后弹层仍在视口内（375 下 345×566 ≤ 85dvh）且无控制台报错；真实数据回归无异常。（首轮 UI 测试因用 JS `.click()` 绕过层叠顺序漏掉了「下拉被弹层盖住」的 bug，已改用坐标点击复验。）

### 搜索（原 E5 + E6）✅ 已完成
- **一套内核两个入口**：`src/lib/memory-search.ts` 抽出检索内核（`collectMemories` / `buildCategoryPaths` / `searchMemories`，关键词匹配标题·描述·location、类别含子树、日期闭区间、按日期由新到旧）；`SEARCH_DEFAULT_LIMIT=30`、`SEARCH_MAX_LIMIT=100`。Agent 的 `searchMemories` 工具与 `GET /api/memories/search` **共用同一函数**，语义不会漂移。`queries.ts` 抽出 `attachCovers()`（`listMemoryCards` 复用），检索结果直接带封面裁剪参数。
- **API**：`GET /api/memories/search?q=&categoryId=&from=&to=&limit=` → `{ total, count, items, maxLimit }`，items 含 `location`、`category`（路径）、`cover`。
- **UI**：`ActionBar` 加「搜索」（`SpriteView` 加 `"search"`）；新 `src/components/sprite/SearchPanel.tsx` = 关键词（250ms 防抖）+ 类别（`Combobox`，含「全部类别」）+ 日期区间（原生 `type=date`，`[color-scheme:dark]`）+ **纵向滚动列表**，一次列出全部结果（超过上限时提示「仅显示前 N 条」），点击进详情（星空页走迷雾过渡）；窄屏点击后自动收起抽屉。
- **共享卡片**：`src/components/memory/MemoryListItem.tsx`（缩略图 + 标题 + 日期 + 地点），**对话检索卡片用 compact 档**（无封面时不占位，兼容旧消息）与搜索面板共用；`showMemories` 工具补 `cover`/`location`/`category`，`agent/route.ts` 的 `CardItem` 同步扩展。
- **Agent 侧**：新增 `openSearch` 工具 + `ClientAction.openSearch`，SYSTEM_PROMPT 说明「结果多/想自己翻找时打开搜索面板」；`searchMemories` 的 limit 说明改为默认 30 / 最大 100。
- 与聊天搜索**不冲突**：同一份数据、同一份过滤逻辑；差别只是聊天受「每批 3 张卡」限制且需 LLM 往返，面板直接查库、零延迟。
- 验证：API（`q=浅草`→1、无匹配→0、`categoryId=jp`→11 含东京子树、`categoryId=tokyo`→10、日期区间→26、`limit=200`→截断 100）；桌面 1440 与移动 375 均用 **CDP 真实坐标点击/触摸**：ActionBar 4 键单行不换行、面板标题「搜索回忆」、初始 30/共 137 条带缩略图、关键词 11 条、类别「地球 / 日本」11 条、+2024 年区间 5 条、清除复位；点击结果 → `/memory/m_ginza`（窄屏抽屉自动收起）；真实调 Agent 一轮确认 `memories` 事件已带 `cover`（测试会话已删除）；对话旧卡片无封面时正常降级；无横向溢出、无控制台报错。

### E4 详情页图片放大 —— 待做
- 新 `ImageViewer`：详情主图单击 → 全屏 Lightbox（`object-contain` + 双指/滚轮/双击缩放 + 拖动平移 + Esc/点背景关闭）；复用 `lib/crop.ts` 的 clamp 思路；弹层带 `role="dialog"`，靠 `shouldIgnorePageShortcut` 保证 Esc 不误返回。
- 注意与窄屏 swipe 切图的手势冲突（单击 vs 拖动阈值）。

### E9 主题色 token 化 + 调色 —— 待做
- **已定**：token 化 + 调色；**不做浅色模式**（dark-only，删 `prefers-color-scheme` 死代码）；CTA 用**方案 A**（`indigo-500` → `--accent-deep`）；**双强调色语义**——冷蓝 = 交互/导航，暖金 = 时间/回忆；**基色 `#05060a` 不变**；星云**加强到可见**（现两团 alpha 仅 `0.18/0.14`，实测≈不可见 → 提到 `~0.35/~0.28` 并补一团）。
- token 集（CSS 变量为唯一来源）：`--sky-void #05060a`、`--sky-veil #070a14`、`--sky-panel #0b0f18`、`--sky-star 220 235 255`、`--sky-beam 150 180 255`、`--accent #7cc4ff`、`--accent-deep #2f7fd0`、`--warm #fff3d8`、`--warm-glow 255 238 180`、`--ok #34d399`；配 Tailwind v4 `@theme inline` 映射。
- canvas（`StarBackground`）与 SVG（`TimelineRail` 的 `stopColor`）读不到 Tailwind 类 → `src/lib/theme.ts` 的 `readTheme()` 从 `getComputedStyle` 取值，避免变量与 JS 常量两份。
