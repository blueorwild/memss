# memss（memory star sky）— 项目计划

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
- 层级：根（memss）→ 国家 → 地区 → （用户自定义子类，可继续下钻）。
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

### 13.4 Phase 3 — 部署改造（代码层）✅ 已完成（2026-09-22）

> 实施细节与踩到的坑见 **§13.8**；下面保留原计划并标注实际结果。

1. ✅ **`MEDIA_ROOT` 环境变量**：新增 `src/lib/paths.ts`（`mediaRoot()` / `uploadDir()`）；改 `api/media/[...path]`、`db/mutations`、`media-upload`、`scripts/seed.mjs`、`scripts/seed-demo.mjs`。不设时回退 `<项目根>/media`，本机行为完全不变。
2. ✅ **访问保护——已用更简洁的方式实现，取消 `middleware.ts`**：
   - 页面：3 个 Server Component 在渲染前 `redirect`（`page.tsx` / `memory/[id]` / `star/[...path]`）
   - 数据：`requireOwner()`（写）/ `requireReadAccess()`（读，看「允许访客浏览」开关）
   - 口令：scrypt 哈希存 DB `settings` 表；会话 token 只以 sha256 存库、明文仅存 httpOnly cookie
   - **不需要 middleware，也没有 `/login` 页**（登录入口在小精灵面板）；原计划的 `AUTH_SECRET` / `ACCESS_PASSWORD` 是早期设计残留，代码里 0 处引用，已从 `.env.example` 移除
3. ✅ `next.config.ts` 加 `output: "standalone"`，并加 `outputFileTracingExcludes` 排除 `data/`、`media/`、`.env*`、`*.md`。
4. ✅ `/api/health`：不设登录门禁，`select 1` 探活，失败返 503（给容器 healthcheck 与 CF 用）。
5. ✅ `Dockerfile`（多阶段 `node:24-bookworm-slim` + `better-sqlite3` 编译兜底 + 显式覆盖 native/migrator）+ `docker-compose.yml`（`app` + `cloudflared` token 方式 + 卷 `data`/`media` + healthcheck + `restart: unless-stopped`）+ `.dockerignore`。
6. ✅ **容器内初始化**：新增 `scripts/migrate.mjs`（drizzle 官方 migrator，幂等）+ `npm run db:migrate`；容器 `CMD` = `node scripts/migrate.mjs && exec node server.js`。**seed 不自动跑**（首次手动 `docker compose exec app node scripts/seed.mjs`），避免误覆盖线上数据。
7. ⏳ 备份脚本/说明待做（§13.6）；**本地 `docker compose up` 验证已跳过**（开发机没装 Docker），改为直接在 Windows 上机验证。


### 13.5 Phase 4 — Windows 上机 + Cloudflare 上线
1. 目标机装 WSL2 + Docker Desktop。
2. 代码分发：GitHub 私有仓库 → clone。
3. 买域名 → 托管 Cloudflare（**已完成，见 §13.5.1**）→ 创建 Tunnel（token 方式，待做）。
4. `.env.production`：`AGENT_SECRET`/`AUTH_SECRET`/`ACCESS_PASSWORD`/`DATABASE_URL=/data/app.db`/`MEDIA_ROOT=/media`。
5. `docker compose up -d` → 初始化 DB + seed。
6. Cloudflare：Public hostname → `http://app:3000`；SSL=Full；**关闭 Rocket Loader / Auto Minify**；验证 SSE 不被缓冲。
7. Windows：关闭睡眠/休眠、确保 Docker 与隧道自启。
8. 手机验收：登录 → 导航 → 看回忆 → 上传 → 对话 → 历史（4G/5G 各测）。

### 13.5.1 域名申请与 Cloudflare 托管（已完成 2026-09-22）

#### 决策口径
- 付款方式只有**支付宝/微信** → CF Registrar 不支持支付宝，选 **Dynadot**（支持支付宝 + 人民币计价 + 免费 WHOIS 隐私）。
- **永远走 CF Tunnel、不做 ICP 备案** → 后缀可自由选（不受工信部白名单限制）。
- 主体名就用 **`memss`**；面向**家人朋友、大陆为主**（故家里上行带宽是后续瓶颈，缓存策略见 §13.5 步骤 6）。
- 已核实：`memss.com`（2005 年注册）与 `memss.net`（2015 年注册）**已被占**；`memss.top` / `memss.xyz` 可注册。
- 价格对比（2026-09-22 实查）：`memss.top` @ Dynadot **首年 ¥18 / 续费 ¥29**（最省）；`memss.cc` @ Dynadot ¥30/¥53；`memss.top` @ 阿里云/腾讯云 ¥14/¥34-39（需实名认证）；`memss.xyz` 首年 ¥14 但**续费 ¥104（陷阱，已排除）**。
- **最终：`memss.top` @ Dynadot**。

#### 已完成
- **注册**：`memss.top` @ Dynadot LLC，创建 2026-09-22T07:13Z，**到期 2027-09-22**（1 年），WHOIS 隐私已开启（Registrant 全 REDACTED），状态 `clientTransferProhibited` + `addPeriod`（新注册 60 天转移锁，正常）。
- **托管**：NS 已切到 Cloudflare —— `lloyd.ns.cloudflare.com` / `rosemary.ns.cloudflare.com`；CF 侧已 **Active**（判据见下）。
- **SSL/TLS 模式 = Full**（CF 的 SSL/TLS → Overview → 需先点 `Custom` 才看得到 Full/Flexible 选项）。

#### 关键坑：CF「Add a site」只是分配 NS，必须回注册商填
- 在 CF 添加站点时，CF 只是**分配**两个 `*.ns.cloudflare.com`，**不会自动生效**；必须回 Dynadot 把这两个地址填进「名称服务器」并**保存**，注册局才会改委派。
- Dynadot 路径（中文界面）：**我的域名 → 管理域名 → 点域名 → 左侧「名称服务器」(Name Servers) → 类型选「名称服务器/自定义」→ 填两个 CF NS → 保存**。
- **别和「导入/导出 DNS」(Import DNS) 搞混**：那个是把 A/CNAME/MX 记录批量塞进 Dynadot 自己的 DNS（前提是 NS 还用 Dynadot）；我们要的是**把整个解析权交给 CF**。
- 判别标准：要填的是 `xxx.ns.cloudflare.com` 这种带 `ns` 的地址，不是 A / CNAME 记录。
- 第一次改完**没生效**（注册局仍是 `ns1/ns2.dyna-ns.net`），第二次改完才成功 —— 教训：**改完必须回查注册局**，别信 CF 页面的等待。

#### 验收命令（以后每次改 NS 都跑这组）
```bash
dig +trace +nodnssec NS memss.top | tail -4        # 注册局委派（最权威，绕过缓存）
whois memss.top | grep -i "name server"            # 注册商侧
dig +short A memss.top @lloyd.ns.cloudflare.com    # CF zone 内容
curl -sI --resolve memss.top:443:104.21.39.179 https://memss.top   # CF 边缘链路
```
- **CF 是否 Active 的硬判据**：域名还是 Pending 时，CF 权威返回**真实源 IP**；Active 后，若记录是橙云代理，CF 权威返回 **CF 自己的 IP**（`104.21.x` / `172.67.x`）。实测：切换后 CF 权威从 `185.53.179.128` 变成 `172.67.171.41` + `104.21.39.179`，且边缘返回 `HTTP/2 522 + server: cloudflare + cf-ray` → 确认已代理。
- **注意递归缓存会骗人**：`8.8.8.8` / 腾讯 DNSPod 在 TTL 3600 内仍返回旧委派（`dyna-ns.net`），而阿里/百度/OpenDNS 已更新 —— 判断生效一律看 `dig +trace` 或直接问 TLD 权威（`.top` 的 TLD 是 **ZDNS**：`a.zdnscloud.cn` 等）。
- 附带确认：`185.53.179.128` 是 **Sedo 停放服务器**；`*.memss.top` / `memss.top` / `www.memss.top` 三条 A 记录都是 CF 扫描 Dynadot 停放页**自动导入**的（不是手工加的），共 3/200 条。

#### 待做（域名侧收尾）
1. **删掉 3 条停放记录**（`*.memss.top` / `memss.top` / `www.memss.top` → A 185.53.179.128）。
   - 理由：① 指向的是广告停放页；② **同名的 A 记录会挡住 Tunnel 的 CNAME**（DNS 规范里 A 与 CNAME 不能同名共存），配 Tunnel 时 CF 会要求先删；③ `*.` 通配符会让任意随机子域都解析到停放页。
   - **删记录不影响 NS**（NS 是注册局层委派，DNS 记录是 zone 内容，两回事）。
   - **用户决定暂留**：为的是能在浏览器里亲眼验证 `memss.top` 可达（哪怕是广告页）—— 属于「可感知验证优先」，等配 Tunnel 前再删。
2. 配 Tunnel 前把 **SSL/TLS 保持 Full**；再开 **Always Use HTTPS**（SSL/TLS → Edge Certificates）、**关 Rocket Loader / Auto Minify**（Speed → Optimization）。
3. 可选：**开 DNSSEC**（CF → DNS → Settings → DNSSEC → Enable，再把 DS 记录填到 Dynadot；当前 `unsigned`）—— 免费，能防 DNS 劫持，对大陆网络环境有价值。
4. 可选：**Email Routing**（免费）→ 把 `hi@memss.top` 转发到邮箱。

#### 已知观察 / 风险
- **本机到 CF 边缘很慢**：`https://www.cloudflare.com` 耗时约 20s，`cf-ray` 落在 LAX。用户目标是「家人朋友、大陆为主」→ **CF 免费版在大陆的实际速度必须实测**（可能要开 Tiered Cache + 把 `/_next/static/*` 与 `/api/media/*` 缓存做足，见 §13.5 步骤 6）。
- 现在访问 `https://memss.top` 是 **CF 的错误页（实测 520，切换前是 522）** —— **预期状态**：应用未部署（§13.4 未做），源站还是 Sedo 停放页。
- **「留着停放记录就能在浏览器看到广告页」这个目的达不到**：SSL 设为 **Full** 后 CF 用 **HTTPS 回源**（匹配访客协议），而 Sedo 停放服务器对 CF 回源返回无效响应 → CF 直接吐 520/525 错误页，不会透出停放页。
  想真看到停放页只能把模式临时改回 **Flexible**（CF 用 HTTP 回源），但 Sedo 对数据中心 IP 是否放行未知，且**配 Tunnel 前必须改回 Full**。
  → 结论：**看到 CF 错误页本身就等于「域名配置全通」的证明**（NS 已委派 + CF 已 Active + 边缘在服务 + 正在尝试回源），不必执着于广告页。
- 本机网络对境外目标限制严重（`185.53.179.128` 直接 `Network is down`，`cloudflare.com` 约 20s），**从开发机 curl 判断不了浏览器实际所见**，浏览器结果要以用户实机为准。
- `.top` 的注册局是 **ZDNS（中国）**，从 `dig +trace` 的 `a.zdnscloud.cn` 可见；对「不备案 + CF Tunnel」路线无影响。

### 13.6 Phase 5 — 维护
- 定时备份 `data/` + `media/`（robocopy 到另一磁盘/网盘）；日志；更新流程：`git pull` → `docker compose build && up -d`。

### 13.7 迁移到 Windows 开发机（已处理的迁移修复）
- **已完成**：`data/.gitkeep` + `src/lib/db/index.ts` 目录兜底；`.gitattributes`（统一 LF、标记二进制媒体）；`.env.example`（`DATABASE_URL` / `MEDIA_ROOT` / `AGENT_SECRET` / `COOKIE_SECURE` / `TUNNEL_TOKEN`；口令不入此文件）。
- **步骤**：装 Git + Node 24 → clone 私有仓库 → 新建 `.env`（`DATABASE_URL="./data/app.db"`）→ `npm ci` → `npm run db:migrate`（空库建表，幂等）→ `npm run seed` → `npm run dev`（**浏览器一律用 `http://localhost:3000`**）→ 设置面板重填 AI API Key。
- **注意**：`dev` 脚本已固定 `next dev -H 127.0.0.1`（仅回环监听、不暴露内网）；Next 16 dev 若用 `127.0.0.1` 作为浏览器地址会拦开发资源导致 React 不 hydrate，故浏览器用 `localhost`。`data/`（含 API Key 密文）与 `media/uploads/` 不上传；`better-sqlite3` 若报编译错误需装 VS Build Tools；保持 Node 版本一致（24）。
- **`db:migrate` 与 `drizzle-kit push` 的分工**：`npm run db:migrate` 只用于**全新空库**（容器 / 新机器）；
  **本开发机的库是 `npx drizzle-kit push` 建的，没有 `__drizzle_migrations` 记录，在本机不要跑它**（会重复建表报错），本机继续用 `npx drizzle-kit push`。

### 13.8 部署改造实施记录（2026-09-22）

**改动的文件**
- 新增：`src/lib/paths.ts`、`src/app/api/health/route.ts`、`scripts/migrate.mjs`、`Dockerfile`、`docker-compose.yml`、`.dockerignore`
- 修改：`next.config.ts`（standalone + 追踪排除）、`api/media/[...path]/route.ts`、`lib/db/mutations.ts`、`lib/media-upload.ts`、`scripts/seed.mjs`、`scripts/seed-demo.mjs`、`package.json`（`db:migrate`）、`.env.example`

**踩到的坑（重要）**
1. **`output: "standalone"` 会把项目根整个拷进 `.next/standalone`** —— 实测含 `data/app.db`、`data/secret.key`、`media/`、`.env`、`*.md`（60M）。
   三重防护：① `outputFileTracingExcludes` 排除 `data/`/`media/`/`.env*`/`*.md`（→ 47M）；② `.dockerignore` 让构建上下文本身就没有这些；
   ③ Dockerfile 里 `npm run build && rm -f .next/standalone/.env`（`.env` 是 Next 自己拷的，排除规则拦不住）。
2. **standalone 不会带 native 产物与 migrator 子路径**：实测 `.next/standalone/node_modules/better-sqlite3/build/Release/` 缺失、
   `drizzle-orm/better-sqlite3/` 为空 → Dockerfile 里显式 `COPY` 覆盖 `better-sqlite3`、`bindings`、`drizzle-orm` 三个包。
3. **`better-sqlite3` 预编译包从 GitHub 下载，国内网络可能失败** → deps 阶段装 `python3 make g++` 让 node-gyp 能兜底编译（`.npmrc` 已配 npmmirror，随上下文进镜像）。
4. **`drizzle-kit` 是 devDependency**，生产镜像里没有 → 迁移改用 `drizzle-orm/better-sqlite3/migrator`。
5. **卷必须挂目录**：SQLite 有 `-wal`/`-shm`；`data/secret.key` 必须随 `data/` 一起备份，否则 API Key 解不开。
6. **非 root 运行**（uid 1001）在 Linux 主机的 bind mount 上可能 `EACCES` → compose 里留了 `# user: "0:0"` 的后路注释。
7. **healthcheck 不能用 curl**（slim 镜像没有）→ 用 `node -e "fetch(...)"`。

**本机验证结果（无 Docker，仅代码层）**
- `npm run db:migrate`：空库建出 7 张表 + `__drizzle_migrations`，**重复执行幂等** ✓
- `MEDIA_ROOT=/tmp/mtest` + 临时库跑 `seed`：38 个文件落在 `/tmp/mtest/seed`，**真实 `media/seed` 159 个文件未被污染** ✓，DB 内仍存相对路径（`seed/xxx.svg`）✓
- `next build` ✓、`/api/health` 路由进入构建产物 ✓、standalone 不再含 `data`/`media`/`*.md` ✓
- `tsc` / `eslint` 全绿 ✓
- **未验证**：Docker 镜像构建与容器运行（开发机无 Docker）→ 上机时验证


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
> 执行顺序：**E1 ✅ → 搜索(原 E5+E6) ✅ → E4 ✅ → E9 ✅**（E 打磨全部完成）。

### E1 分类树重命名 / 移动 ✅ 已完成
- `PATCH /api/categories/[id]`（body `{name?, parentId?}`），校验五件套：根节点不可改、目标父级存在且非自身、**防环**（目标父级不得落在自身子树内）、**深度**（`depth(新父) + 子树高度 ≤ 5`）、目标同级重名。移动到新父级时追加到同级末尾（`sortOrder`）。
- `src/lib/db/mutations.ts`：`updateCategory` + **`resyncSubtreeLocation`**——`location` 由类别路径派生（去掉根节点），改名/移动后必须重算**子树内全部回忆**的 `location`，否则详情页与面包屑不一致。
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

### E4 详情页图片放大 ✅ 已完成
- 新 `src/components/memory-scene/ImageViewer.tsx`（全屏 Lightbox）：`object-contain` 展示**完整原图**（不做焦点裁剪），滚轮（以光标为锚点）/ 双指捏合 / 双击缩放（1–5 倍，双击 2.5 倍往返），放大后拖动平移（按容器尺寸夹紧），未放大时横向滑动或 ←/→ 切图，Esc / 点图片外留白 / ✕ 关闭；顶部有 `n / m` 计数与提示条（`bg-black/40 backdrop-blur`，避免在亮图上不可读）。
- 详情主图**单击**打开（与既有左右滑动共用 pointerdown/up：位移 < 8px 判定为点按），容器加 `cursor-zoom-in` + `title="点击放大查看"`；组件用 `key={图片 id}` 挂载，切图即重置缩放/位移。
- 与页面快捷键的冲突：Lightbox 容器带 `role="dialog"`，`shouldIgnorePageShortcut` 因此让详情页的 ←/→ 切图、空格播放、**Esc 返回**全部失效，改由查看器自己处理（实测 Esc 关闭后 URL 不变）。
- **踩坑**：触摸点击会在 `pointerup` 之后再补发一次合成 `click`，其落点若在图片外的留白处会**立刻把刚打开的查看器关掉**（表现为「点了没反应」）。解决：记录打开时刻，`< 400ms` 的空白点击一律忽略。
- 验证：桌面 1440 —— 打开后 `transform: matrix(1,0,0,1,0,0)`、计数 `1 / 2`、`z-index: 85`；空格不触发播放、←/→ 切图；滚轮缩放 `scale 2.23`（带光标锚点 translate）；拖动平移生效且不误关；双击复位为 1；点图片外留白关闭且 URL 不变；Esc 关闭不返回上级。移动 375（触摸）—— 单击打开铺满 375×667、双指捏合 `scale 3.1`、放大态单指拖动仍打开、双击复位、未放大左滑切到 `2 / 2`、Esc 关闭且 URL 不变；无控制台报错。
- 附带修复：上传/编辑表单的日期输入补 `[color-scheme:dark]`，日历图标与搜索框一致显示为白色（原先在暗色下几乎不可见）。

### E9 主题色 token 化 + 调色 ✅ 已完成
- **token 唯一来源**：`src/app/globals.css` 的 `:root` 定义 `--sky-void/--sky-veil/--sky-panel`（底色三层）、`--sky-nebula-1/2`（星云两团）、`--sky-star/--sky-beam`（星点/光带）、`--accent/--accent-deep`（星光蓝与深一档）、`--warm/--warm-glow`（暖金）、`--ok`。**颜色一律写成空格分隔的 RGB 分量**，于是 CSS / 内联样式 / SVG 都能用 `rgb(var(--x) / <alpha>)` 叠透明度；配 `@theme inline` 映射出 `bg-void`、`bg-panel/95`、`bg-veil`、`text-accent`、`bg-accent-deep`、`text-warm`、`text-ok`、`border-accent` 等工具类。
- **调色**：① 星云：原 alpha 0.18/0.14 实测近乎不可见 → 一度提到 0.35/0.28 又偏显眼 → **最终定为冷蓝 0.22 + 暖紫 0.17 两团**（第三团冷青已删，反正看不出来），渐变终点用同色 0 透明度避免过渡发灰；底色 `#05060a` **不变**。② CTA（原 Tailwind `indigo-500`，共 11 处）统一为 `--accent-deep #2f7fd0`，与 `--accent #7cc4ff` 同族（`Sprite` 的球体/拖尾/星尘也改走 `--accent`）。③ 固化**双强调色语义**：冷蓝 = 交互/导航，暖金 = 时间/回忆（`TimelineRail` 的日期点与年份、光带走 `--sky-beam`）。
- **JS 侧**：新增 `src/lib/theme.ts` 的 `readTheme()` / `rgba()`（canvas 拿不到 CSS 类，仅 `StarBackground` 的星点用），带一份与 CSS 一致的兜底值；`layout.tsx` 的 `themeColor` 用导出的 `SKY_VOID_HEX`。
- **dark-only**：删除 `prefers-color-scheme` 死代码，`--background` 直接指向 `--sky-void`。
- 验证：token 计算值正确（`--accent` = `124 196 255` 等）；星云层 `background-image`（当时三团）渐变到位（最终已改为两团，见 §16）；`bg-accent-deep/80` 的 CTA 计算结果换算回 sRGB 即 `#2f7fd0`；`TimelineRail` 的 SVG `style={{ stopColor: "rgb(var(--sky-beam) / …)" }}` 计算值 `rgba(150,180,255,…)`；详情页底色 `rgb(5,6,10)`；桌面 1440 与移动 375 各页无横向滚动/溢出、无控制台报错（详情页动画期间 `scrollWidth` 短暂 +3px 是 `memoryIn` 的 `scale(1.04)` 造成，动画结束后归零，改动前即如此）。

## 16. 交付前微调（第二轮，已完成）

1. **二次确认改为「语义由模型判断 + 服务端只校验先问过」**（`agent/route.ts` / `agent-tools.ts`）
   - 删掉了原先的**关键词硬表**（`/(确认|确定|同意|删吧|…)/`）：它既不认「是的 / 可以 / 嗯」，又会被「不要删」误判；也**不做**确认按钮。
   - 现在：危险操作（遗忘 / 迁移）的 `confirm` 由模型读懂用户回复后决定，服务端只加一条**上下文要求**——`consentAsked`（上一轮工具确实返回过 `needConfirm`，即小精灵真的问过一次）为真时才认 `confirm=true`；该标记**一次性**（执行即消费，本轮没问过就清掉）。
   - 为什么必须留这一层：纯靠 prompt 时，首句祈使句「把它删了吧」会被模型当成同意**当场删除**（实测踩到，且旧词表也拦不住「遗忘」二字）。有了它，模型再笃定也必须先把对象复述出来问一次。
   - prompt 同步强化：肯定回复（是的 / 好的 / 可以 / 嗯 / 行 / OK…）都算同意，不必要求对方说「确认」；但**首次收到请求一律先问一次**。
   - 实测：①「把它遗忘掉吧」→ 不删、先问；② 回「是的」→ 删除成功（旧词表里没有「是的」）；③ 回「先别删，我再看一眼」→ 不删。
2. **对话页直接可新建会话**：`ChatPanel` 顶部细条右侧加「＋ 新对话」（在「历史」左侧），`streaming` 中禁用；旧会话仍保留在历史里。
3. **星云再调淡**：冷蓝 `0.35 → 0.22`、暖紫 `0.28 → 0.17`，并**删除第三团冷青**（连带清理 `--sky-nebula-3` token 与 `theme.ts` 兜底）。
4. **宽屏与窄屏统一降载**：`StarBackground` 的 `MAX_DPR` 统一 **1.5**（原宽屏 2）、星数上限统一 **220**（原宽屏 420）；`Sprite` 常驻粒子统一 **10**（原宽屏 20）、拖尾星尘统一 **1 颗**（原宽屏 2–3）。窄屏原有表现不变，宽屏 canvas 像素减少约 44%（Retina 上星点略软，为可接受的取舍）。
5. **右上角操作收进「⋯」菜单**：星空页与记忆详情页原先把「编辑 / 遗忘」并排放在右上，现统一收进一个「⋯」按钮（`src/components/ui/more-menu.tsx`）——内联菜单（**不用 Portal 浮层**，避免与 Radix Dialog 的 z-index / pointer-events / 焦点陷阱冲突），「遗忘」用红色；`role="menu"` + 点外部关闭 + **Esc 只关菜单**（在捕获阶段 `stopPropagation`，不会触发页面级返回）。
6. **返回按钮改为纯图标**：两页左上角的「← 返回」文字换成 `src/components/ui/back-button.tsx` 的**弯曲左箭头 SVG**（无文字，保留 `aria-label`）；历史面板里的「＋ 新对话」删掉（已挪到对话页顶部细条）。
   - 验证：桌面 1440 与移动 375 —— header 内文本按钮为空、返回为 SVG（`aria-label="返回上一级"`）、「⋯」菜单项 `["编辑","遗忘"]`、点「编辑」打开编辑面板、点「遗忘」弹确认层、**Esc 后菜单关闭且 URL 不变（未误返回）**、菜单不超出视口、无横向溢出、无控制台报错；历史面板顶部只剩「‹ 返回对话」。

## 17. 小精灵造型替换（方案 A，已完成）

**目标**：把「56px 发光蓝球」换成外部资源包里的「白色线稿角色」，且不丢任何既有能力。

### 17.1 方案与职责边界
- 采用**方案 A：只取美术，宿主保留全部交互**。美术包 `src/components/xiaoriyue-drag/` 里只留下 `PetArt.tsx`（内联 SVG，纯展示）+ `PetArt.module.css`（姿态层倾斜）+ `SPEC.md`（接入契约）；原 `FloatingPet.tsx` / `.module.css` / `examples/` / `README.md` 全部删除（README 描述的拖拽内核未被采用，留着会误导）。
- **美术包负责**：造型、SVG 分组、CSS 动效、倾斜的施加点（读 `--pet-angle`）。
  **宿主（`sprite/Sprite.tsx`）负责**：定位、拖拽、位置持久化、层级、点击开面板、面板避让、粒子/拖尾、reduced-motion 降载。
- 弃用资源包这些能力（它们在宿主里已有更完整的实现）：Pointer Capture 拖拽内核、`margin`/`zIndex` props、`position: fixed` 定位层、`all: unset`、矩形整框命中区。**位置持久化、安全区避让、点击开面板、拖尾/粒子都是资源包没有的，直接采用会功能倒退。**

### 17.2 尺寸与几何（关键换算）
美术包声明 `FRAME = {15,95,440,390}`、`CHAR = {35,111,402,304}`（viewBox 单位），宿主按 `PET_H = 80` 换算（**桌面与移动一致**，原球直径 56）：
- 外框 `PET_W × PET_BOX_H = 115.8 × 102.6`；角色主体 `105.8 × 80`。
- **命中区 = 角色主体**（外框内的 `4.55% / 4.10% / 91.36% / 77.95%`），点底部影子与顶部空白不再拖走角色。
- 粒子 / 拖尾原点 = 角色主体中心（`CORE`），不再是球心。
- 已核实 `viewBox` 四边余量足够 ±6° 倾斜不裁切（左 20 / 右 18 / 下 19 单位）。

### 17.3 层级与面板避让
- 角色 **`z-[62]`**：高于桌面面板（`z-60`），低于窄屏遮罩（`z-65`）与抽屉（`z-70`）。移动端打开抽屉时角色被遮罩盖住，天然满足「不进入面板区域」，故避让逻辑只在桌面浮动面板下运行。
- **角色与面板永不重叠**（双向）：
  - 拖动**角色**时把面板当静态障碍：`clampViewport` → 相交则 `pushOut` 沿最小位移推出 → 再夹取。
  - 拖动**面板**时把角色挤开（只更新内存位置，**不写 localStorage**，因为面板位置本身不持久化）。
  - `pushOut` 按位移从小到大挑**第一个「夹取到视口内仍不重叠」**的方向，并留 1px `OUT_GAP`；四个方向都不可行时才退回最小位移方向（下一步修复：旧实现只用最小位移、被视口夹住后会与面板重叠）。
  - 面板默认位置由候选序列决定（左上 → 左下 → 左 → 右 → 右上），取第一个与角色主体不重叠的候选；推导时用**即将生效的角色位置**，避免与下一帧渲染错位一拍。
- **顺带修掉的旧隐患**：原先 56px 球与面板同层且在面板之后渲染，球被拖到屏幕上方时（`derivedPanelPos` 的 `top` 被 `max(8,…)` 夹住）**已经会重叠**，只是太小看不出来。
- **视口尺寸变化后重新夹取**（用户反馈：把窗口由大拖小时角色跑到屏幕外看不见）：原先只有「窄屏抽屉打开」这一条分支注册了 `resize`，宽屏（或面板关闭时）缩窗**完全不处理**，localStorage 里存的右下角坐标在新视口里就成了屏幕外。现在独立一个 `resize` 监听：重算底部安全区 → `clampViewport` → 窄屏抽屉打开时再 `clampAboveDrawer`，宽屏面板打开时再按面板避让 → 同时把（手动拖过的）面板也 `clampPanel` 回视口内。
  - **顺序坑**：必须**先裁面板、再判角色避让**。先判避让、后裁面板，会出现「角色避开了旧面板位置，面板随后被裁到角色身上」的错序重叠（CDP 实测复现：760×520 下角色落在面板矩形内部）。
  - 复用：`clampPanel()` 抽成公共函数（拖动面板与缩窗共用），并顺手补上「视口比面板还小时至少留在左上角可见处」的保护；安全区读取抽成 `readSafeBottom(isMobile)`。
  - 实测（`/tmp/resize-verify.mjs` 14/14）：角色拖到右下角后 1440→700 / →390 都完整可见且贴在新边界内；面板打开并拖到右下角后缩到 760×520，角色与面板都在视口内且**不重叠**（角色被推到面板左侧 `x=285`）；再放大回去位置不漂移。

### 17.4 视觉与手感
- **去掉呼吸光晕**（角色自带天线光点，再叠呼吸层会显乱）；**保留**常驻 10 粒子 + 拖尾光带 + 星尘。
- 配色并入 token：线稿 `stroke="currentColor"` + 外层 `text-star`（`--sky-star`）；光点/高亮 `var(--pet-glow)`，在 `globals.css` 定义为 `rgb(var(--warm-glow))`。**SVG 里的 `var()` 必须走 `style`**，写进 presentation attribute 解析不可靠。
- **拖拽倾斜 ±6°**：按水平速度 `v = dx / max(8, dt)` → `angle = clamp(v*5)`，由 CSS `transition: transform 200ms` 平滑跟随并回正；`reduced-motion` 下恒为 0（CSS 与 JS 双保险）。旋转轴心 `transform-origin: 235px 265px` 由美术定；`pet-shadow` 在姿态层之外，不参与倾斜。

### 17.5 接入契约（`SPEC.md`）
9 节：交付目录与文件 / 组件契约 / 尺寸与 `FRAME`·`CHAR` 声明 / 颜色变量 / 姿态层与 `--pet-angle` / 分组 id 清单（`pet-character`、`pet-antenna`、`pet-antenna-glow`、`pet-body`、`pet-body-inner`、`pet-face`、`pet-eye-left/right`、`pet-mouth`、`pet-hand-left/right`、`pet-tail`、`pet-shadow`）/ 动效约定 / breaking 变更规则 / 宿主验收清单。
- 要点：美术包**纯展示**（不定位、不 portal、不监听事件、不读 window）；尺寸由宿主容器决定；根 `<svg>` 默认裁剪，内容与动作极值必须留在 `viewBox` 内；分组 id 一旦发布不得改名（后续眨眼/天线摆动等动作由美术包在 `PetArt.module.css` 里加，宿主只提供 `--pet-angle` 与尺寸）；`:global()` 或 CSS Modules 局部类名，**不要写裸 `#id`**（会被改写）。

### 17.6 验证（CDP 真实鼠标/触摸事件）
| 项 | 结果 |
| --- | --- |
| 几何 | 外框 `115.8×102.6`、命中区 `105.8×80`、13 个分组 id 齐全、`z-index: 62` ✅ |
| 颜色 | 线稿 `rgb(220,235,255)`（`--sky-star`）、光点 `rgb(255,238,180)`（`--warm-glow`）✅ |
| 命中区边界 | 外框左上角空白 / 底部影子处 `elementFromPoint` 为页面 DIV，点击不弹面板、不移动；主体中心为 BUTTON，点击弹面板 ✅ |
| 点击 vs 拖拽 | 点击开面板；拖动 240px 后位置更新并写入 localStorage、**不误触弹面板**、松手后角度回 0 ✅ |
| 倾斜 | 拖拽中实测 `-2.99deg`；prod 里手动设 `--pet-angle: 6deg` 过渡后为 `matrix(0.9945,0.1045,…)` 即精确 6°；20° 视觉验证旋转轴心在角色体内、`pet-shadow` 不跟随 ✅ |
| 双向避让 | 面板压向角色 / 角色撞向面板，**全过程逐帧采样重叠面积 = 0**；重开面板仍保持 1px 间隙 ✅ |
| reduced-motion | 拖拽中与松手后角度恒为 `0deg`、粒子数 0，拖动本身仍可用 ✅ |
| 四角与小窗 | 拖到四角分别停在 `12,12` / `1335.4,12` / `12,805.9`（第四角被面板挡住属预期）；缩到 600×480 后仍在视口内 ✅ |
| 移动端 375 / 390 | 外框不溢出（横向溢出 0）、层级 `pet 62 < mask 65 < drawer 70`、遮罩打开时角色中心命中页面元素（被盖住）、点遮罩可关闭 ✅ |
| 构建 | `tsc` / `lint` / `next build`（11 路由）全绿；生产构建复测倾斜与命中区 ✅ |

### 17.7 全动作接入（美术包 v6 · 宿主调度）
美术包 v6 提供 12 个动作（`idle`/`sleep`/`drag-shy`/`think-curious`/`think-spin` 循环，其余一次性），并导出 `ACTIONS[action] = { kind, durationMs, next }`、`ACTION_DURATION_MS`、`PetAction`。**宿主侧新增 `src/store/pet-actor.ts`** 承担 README 要求的全部计时、优先级与「恢复目标」；改动文件只有 `store/pet-actor.ts`（新）、`Sprite.tsx`、`ChatPanel.tsx`——美术包、`FRAME/CHAR` 与定位 / 尺寸 / 命中区 / 避让数学零改动。

- **`resume`（恢复目标）只允许持续状态**：`idle` / `sleep` / `think-curious` / `think-spin`；一次性动作结束后按 `spec.next`（`sleep` / `resume`）收尾，`after` 回调优先于 `next`（用于 `wake → greet`、`wake → happy` 这类链式）。
- **触发口径**（本次已定）：
  - 点角色开面板 → `happy`；睡着 / 入睡中先 `wake` 再 `happy`。其它开面板入口（点星尘记忆、ActionBar、对话工具）不播。
  - **「面板消失」即关闭语义** → `bye` → `sleep`（✕ / 遮罩 / `MemoryForm onDone` / 搜索窄屏跳转统一走 `useSpriteStore.subscribe` 的 `open` 真→假）；`sleep` 满 30s 自然 `wake`；拖动中收到关闭指令则抬手后再 `bye`。
  - 开局或空闲 30s（面板收起 + 无请求 + 未拖动）→ `doze` → `sleep`；**面板打开期间不睡**；`sleep` 满 20s 自然 `wake`。
  - 悬停命中区（仅 `pointerType === "mouse"`，250ms 确认、每次进入一次、8s 冷却；思考 / 拖动 / `bye` / `doze` 期间不问好）→ `greet`；睡着则 `wake` 后重新核对光标与业务状态再决定 `greet`。
  - 拖动超过既有 4px 阈值 → `drag-shy`；抬手恢复：请求仍在 → 思考动作，否则 `idle`。
  - 拖动**面板**造成避让（碰撞会话 0→1 时一次）→ `grumpy`；主动拖角色顶住面板不算「被挤开」。
  - 请求：开始 → `think-curious`；4s 无有效正文 → `think-spin`；**首个非空 `text` 增量** → `idea`（拖动中丢弃顿悟、只更新恢复目标）；失败 / 取消 / 无正文自然结束 → `idle` 且不播 `idea`。`requestId` 逐请求递增，关闭面板或 `ChatPanel` 卸载即作废（仅取消计时器挡不住旧网络回调）。
- **优先级**：主动拖动 > 有效回复 / 思考 > 问好、挤开；动作代次 `generation` 令牌保证过期计时器回调不生效；`actionKey` 只在动作切换或重播时 +1（绝不逐帧，否则包内动作层每帧重建）。
- **`prefers-reduced-motion`**：包内 CSS 已把所有造型统一静态化（传任何 `action` 视觉一致），宿主因此**完全不驱动动作**——`pet-actor` 每次事件直接查 media query 早退，既不起生活 / 悬停计时，也不上报请求动作。
- **窄屏抽屉打开时的层级与让位**（用户要求「遮罩后面也要看得见小精灵」）：抽屉高 `h-[min(78dvh,560px)]` → 其上方留出 125~284px 的可视带；角色在「窄屏 + 抽屉打开」时 ① 层级由 `z-[62]` 抬到 `z-[68]`（遮罩 65 之上、抽屉 70 之下，两个类名都写成字面量以便 Tailwind 扫到）；② 自动让位到可视带内（`y ≤ 抽屉顶 − 外框高 − MARGIN`，`drawerTop()` 与 `DRAWER_H_RATIO`/`DRAWER_H_MAX` 必须和抽屉的 class 同步），关闭后回让位前坐标；③ 让位期间仍可点可拖，但拖动被夹在可视带内、**不写 localStorage**；被用户主动挪过就不回原位（与桌面「被挤开不回退」一致）。窄屏**不做**桌面的面板避让（`clampAboveDrawer` 与 `pushOut` 二选一）。
- 拖动监听改为由 `dragging` 驱动的 effect 统一挂 / 卸 `pointermove` / `pointerup` / `pointercancel` / `lostpointercapture`（原写法在 `pointerdown` 里挂一次性监听再于 `onPointerUp` 里自引用解绑，会被 `react-hooks/immutability` 拦下）。
- **`think-curious` 的面部**（用户反馈「只是多了个问号，整体还是笑脸」）：包内升级 v6.1，改为「眯眼 `squintEye` + 一高一低眉 `pet-brows-think` + 抿嘴 `mouthThink`」，与 `normalEye`/`normalMouth` 交叉淡入 220ms，**问号与歪头扫视保留**；眨眼动效在思考期关闭。纯包内改动（新增 class / 分组与 `@keyframes thinkFace{In,Out}`，接口与 `FRAME/CHAR` 零变化），宿主无改动。**两条硬约束**：新零件必须默认 `opacity: 0`，且必须出现在 `prefers-reduced-motion` 的 `opacity: 0 !important` 白名单里，否则降载模式下会与基础脸叠画。包是美术交付物，故同时写进 `SPEC.md` §6/v6.1 与 `README.md` 动作表，避免下次交付把这里改回笑脸。

验收（隔离背景后逐相位抓图 + 真实鼠标 / 触摸事件）：

| 项 | 结果 |
| --- | --- |
| 交互链路 | 点开 → `happy`；关闭 → `bye` → `sleep`；睡中点击 → `wake` → `happy`；睡中悬停 → `wake` → `greet`；拖动 → `drag-shy` → 抬手回 `idle`；拖面板挤开 → `grumpy` ✅ |
| 请求链路 | `think-curious` →(4s)→ `think-spin` →(首字)→ `idea` → `idle`；无正文结束 / 500 失败 → 不播 `idea`、回 `idle` ✅ |
| 思考中拖动 | `drag-shy` → 抬手恢复 `think-spin`（请求仍在）✅ |
| 生活计时 | 空闲 30s → `doze`；关闭 → `bye` → `sleep`；睡满 20s → `wake` → `idle`（实测 19.1s / 30.0s）✅ |
| reduced-motion | 点击 / 关闭 / 悬停均不进入任何动作（恒 `idle`）✅ |
| 裁切 | 154 个「动作 × ±6°」相位中 2 个（`think-spin@-6°`、`idea@-6°`）hidden/visible 抓图有差异，外溢 ≤2px 且在顶部极淡光晕边缘；几何探针报的 ≤2.7px 系「旋转包围盒再取包围盒」放大，故判定不可见、接受 ✅ |
| 窄屏 390×844 | 触摸点角色开抽屉 + `happy`；点遮罩关闭 + `bye` → `sleep`；命中区 `105.8×80` 在视口内 ✅ |
| 窄屏抽屉让位 | 抽屉打开：`z=68`、角色整条在抽屉顶（284）之上（实测 bottom 272）、`elementFromPoint` 命中角色自身（可见又可点）；关闭：`z` 回 62、坐标精确回到让位前；让位期间往下拖仍被夹住且 `localStorage` 不变；矮屏 390×600 同样不越界 ✅ |
| 构建 | `tsc` / `eslint` / `next build` 全绿 ✅ |


## 18. 品牌与根节点改名（已完成）

用户要求：① 标签页图标用小精灵 idle 态；② 站名「回忆星空」→ **memss**（memory star sky）；③ 根路径上的「地球」→ **memss**。

- **图标**：新增 `src/app/icon.svg`（Next 文件约定，自动注入 `<link rel="icon" type="image/svg+xml">`），**删除 `src/app/favicon.ico`**（两者并存时浏览器仍优先 .ico，不删等于没换）。图标是**头部特写**（去掉手/尾/影子）——实测 16px 下整只会糊成一团；路径取自包内 idle，坐标未改，只把描边加粗到 20/12/28（用户单位）保证小尺寸可读，外加 `#05060a` 圆角底，深浅标签栏都清楚。色值为 token 字面量：线稿 `rgb(220 235 255)`、光点 `#ffeeB4`。
- **站名**：`src/app/layout.tsx` 的 `title` → `memss`（唯一 metadata 导出）；`/api/agent` 人格里的「回忆星空」→「memss」。
- **根节点改名**：数据库类别树唯一根 `id="globe"`，原名「地球」→ **「memss」**（当前根路径 `/` → `/star/globe` 的 URL **不变**，id 是主键且代码里两处兜底写入 `"globe"`）。落点：`data/app.db` 一条 UPDATE（本地数据，`data/` 已 gitignore）+ `scripts/seed.mjs` 种子名同步。
- **改名必须配套的代码修复**：`PATCH /api/categories/[id]` 明确禁止修改根，所以根改名只能走数据；但代码里有 **3 处按名字字面量「地球」判断「去掉根节点」**，改名后会静默失效（记忆的 `location` 会变成「memss / 日本 / 东京」）。新增 `isRootCategory(c) = c.parentId === null`（`lib/category-path.ts`）统一替换：`lib/db/mutations.ts` 的 `resyncSubtreeLocation`、`lib/agent-tools.ts` 的 `locationOfCategory`、`lib/memory-search.ts` 的 `buildCategoryPaths`；其余注释里的「地球」改为「根节点」。
- 验证：浏览器实测 `document.title === "memss"`、`<link rel="icon">` 指向 `/icon.svg`（`/favicon.ico` 已 404）、`/star/globe` 面包屑 `memss`、`/star/globe/jp` 为 `memss / 日本`、`GET /api/categories` 根名 `memss`；**回归陷阱实测**——改名后把 `jp` 改成 `日本X` 再改回，11 条回忆的 `location` 变成 `日本X / 东京`、**没有**混入 `memss`，确认结构化判断生效。`tsc` / `eslint` / `next build` 全绿（`next build` 会产出 `○ /icon.svg`）。
- ⚠️ **注意**：走 PATCH 改名会触发 `resyncSubtreeLocation`，把该子树的 `location` 从「种子里的自由文本」（如 `日本 · 东京 · 浅草`）重写成**类别路径格式**（`日本 / 东京`），不可逆。本次实测触发后已按 `scripts/seed.mjs` 的原始值逐条还原 11 条。

## 19. 星图布局一致性与星星呈现（已完成）

用户五条：① 只有记忆的页与「有子类别+记忆」的页，记忆区高度占比一致（前者换成后者）；② 有子类别时宽屏滚筒换单排、缩略图与「只有记忆」时一样大；③ `memss` → **MemSS**；④ 有子类别+记忆时星星从「一排均分」改成随机；⑤ 单页星星数量随屏宽设上限、超出时沿用记忆滚筒的流动做法。

- **①的根因**：`MemoryCylinder` 按**自身 section 高度**选卡片档位（`<420 tiny`/`<520 compact`）。「有子类别」时该 section 只占 7/10 → 1440×800 上掉到 150×100，而「只有记忆」时是满高 → 200×133。**修法**：只有记忆的页面完全不动（仍占满），把档位基准从「本区块高度」换成**整页可用高度**（`StarfieldPage` 量 header 以下的 `flex-1` 区，传 `basisH`）——单排本来放得下常规档，空间小才需要单排。实测 900/800/700 与窄屏 390×844 下两种页面**卡片尺寸完全一致**、星轨位置一致，且只有记忆页仍占满可用高度。
- **②**：`MemoryCylinder` 新增 `rows: 1|2`（仅宽屏生效，窄屏仍左右两列）；`trackCrossPositions(..., tracks)` 支持单轨居中。阈值口径（用户指定）：**有子类别时 >3 张即走滚筒**（`threshold = capacity × tracks`，单排 3 / 双排 6）。
- **③**：站点标题、agent 人格、图标 aria-label、数据库根节点名、`scripts/seed.mjs`、相关注释与文档里的 `memss` → `MemSS`；类别 id `globe` 与 URL `/star/globe` 不变。
- **④**：`CategoryStars` 删除 `arc`（等分一排）分支，统一 `scatterPos`（黄金角 + 类别 id 定种子，刷新稳定）；随机位置按实测容器尺寸夹在可视区内，矮星星带里名字不再被裁。
- **⑤**：`starCapacity(w, maxCap) = clamp(floor(w×0.9/120), 3, maxCap)`（宽度未测到前返回 maxCap，避免首帧误判成流动）；`n > cap` 时改用**单行流动轨道**：缓慢自走 + 可拖 + 惯性 + 循环回绕 + 两端 mask 渐隐 + 按 id 定种子的错落。抽出 `src/lib/use-track-flow.ts`（offset/rAF 自走/惯性/拖动/ready 淡入）供记忆 `FlowTracks` 与星星共用，记忆侧行为不变。
- 验证：CDP **32/32 PASS**（占比尺寸三档一致性、单排平铺/单排滚筒/双轨滚筒的聚簇判定、星星随机非等分、超限转流动、星星自走与拖动跟手、拖动不误跳转、记忆滚筒自走/拖动/点击进详情、窄屏 390×844 一致性与无横向溢出）；七个页面无 console 报错或 hydration 警告。临时分类 `zzl-tmp`（12 子类 + 4 无图记忆）造场景后已 purge，categories/memories/media 行数回到 12/137/161。`tsc` / `eslint` / `next build` 全绿。

## 20. 星轨高度一致（宽屏）+ 星星流动深验（已完成）

### 星轨高度
- 现象：`TimelineRail` 的 `compact`（140 → 64）判据是**本区块高度 < 420**；有子类别时区块只占 7/10，于是**可用高度 420~600（视口约 480~660）的窗口里，有子类别页是 64、只有记忆页是 140**。
- 修法（用户选 A：以有子类别页为准）：两页都按「有子类别时那块的高度」判定 —— `StarfieldPage` 算 `railCompact = roomH × MEMORY_FLEX_RATIO(0.7) < RAIL_COMPACT_BELOW(420)` 传给 `MemoryCylinder`；该值同时决定 `RAIL_MAIN/RAIL_MAIN_COMPACT` 与 `TimelineRail compact`。`0.7` 与 `flex-[7]` 比例同步（常量注释标明）。窄屏是竖向星轨 + `RAIL_CROSS`，天然不受影响。
- 实测（1440 宽，8 档高度）：vh ≥ 700 两页都 140、vh ≤ 650 两页都 64；卡片尺寸两页始终一致；卡片底边到星轨顶边始终有 7~142px 余量（无重叠）。

### 星星流动深验（造数据：20 / 40 / 12 子类三个临时分类 + 2 条无图记忆）
- **上限口径（用户最终指定）**：无记忆页同屏 **20**、有记忆页 **10**，且**随屏宽等比**（`STAR_CAP_MAX` / `STAR_CAP_MAX_WITH_MEMORIES` + `STAR_CAP_REF_WIDTH = 1440`；`starCapacity(w, maxCap) = clamp(round(maxCap × w / 1440), 3, maxCap)`，删掉了原来的 `STAR_MIN_DENSITY_GAP = 52` 折算）。`slot = w / cap`——**不是** `0.9w / cap`，否则屏幕上会多出 1/0.9 倍（实测 23 颗而非 20）。实测：1440 → 20 / 10，2000 → 仍封顶 20 / 10，1100 → 15 / 8，390 → 5 / 3；超过上限走流动轨道（演示A 8 子类 → 散布；演示B 20 子类 → 流动；演示C 40 子类 → 流动）。
- **流动几何**：可见星数 ≈ cap；每颗星（含名字）都在星区内；两端 mask 渐隐生效；无横向溢出。
- **流动形态 = 整片区域 2D 随机**（用户三轮反馈后的最终形态）：① 发现"水平间距像等分"（原来是等距点阵 + ±9% 抖动）→ 改**环形随机间隔**；② 提密度时试过分排，**被否**（"一排排太丑，本质目的是星星在它所在的区域整体随机分布，流动的时候也是"）→ 改**纵向纯随机 + 横向逐对下限**；③ 用户仍反馈"20 分类的流动明显看出一条线" → 定量复盘：根因是**同屏太多（17~20 颗）+ 间距几乎等距（85~98px）+ 星星固定在一条横向走廊里匀速滑动**三者叠加。于是**降密度（20/10）+ 拉大间距差异**，并把纵向随机**按"横向挤不挤"分成两种模式**（`needCrossSep = 最宽名字下限 > slot`，即 `(w_i+w_{i+1})/2+8` 的最大值是否超过 slot）：
  - **横向够宽时**（有记忆页 10 颗，slot 144 > 名字下限 ~104）→ **纵向纯随机**（按 id 定种子，刷新稳定）。关键坑：此时若还强行"相邻错开 68px"，242px 高的矮星区里 11 颗星会被逼成上下两排，**反而更像一条线**（实测同一水平带最多 5~7 颗、只剩 3 个带）。
  - **横向挤时**（无记忆页 20 颗，slot 72 < 名字下限 ~99）→ **纵向蓝色噪声**：每颗星 5 个随机候选里挑"离前两颗最远"的那个，要求 ≥ `MIN_CROSS_SEP = 68`（`= ITEM_HALF_H × 2`）；横向下限回到 `MIN_PAIR_GAP = 44`，且 `needs` 要多看**隔一颗**（i 与 i+2 的累计横向距离可能仍放不下名字）。星区高（~668px）所以不会被逼成排。
- **实测**（1440）：演示C 同屏 21、间距 52/71/89（波动 37，几何上限 = slot − 最小 need ≈ 28）、纵向 sd 218（均匀随机理论值 193）；演示B 同屏 11、间距 93/137/184（波动 91）、纵向 sd 41 / spread 135（可用 166）。名字两两零重叠（含长名字）。名字上限 `132 → 96px`（字号不变）。
- 固定验收：最小间距 ≥44px、间距波动（矮星区 ≥20 / 高星区 ≥40）、**名字两两矩形零重叠**（含长名字）、纵向 sd（高星区 ≥120 / 矮星区 ≥35）、自走 Δ=-18/1.5s、拖动 Δ=-120、拖动不误跳转、40 帧无可见区瞬移、窄屏不溢出、`tsc`/`eslint`/`next build` 全绿。脚本 `/tmp/star-cap-verify.mjs`（20/20）。
- **行为**：自走 18px/1.5s（≈12px/s 向左）；拖动跟手 Δ=-120；**松手惯性**继续同向（464→576→730）；拖动后不误跳转；7s × 60 帧采样确认**可见区内无瞬移**（回绕都发生在屏外，且松手后的高速惯性要先等衰减，否则会把「快速移动」误判成瞬移）；流动中单击星星能进子类别；`reduce` 下自走停止、拖动仍可用（Δ=-120）；40 子类同样走流动；窄屏 390（cap=3）流动、可见 2~5、无溢出。
- **顺带修的长名字问题**（截图暴露）：长分类名会换行成两行并可能被星区裁掉。改为名字 `max-w-[96px] truncate` 单行截断（`LABEL_MAX_W = 96`），并让流动步长兼顾最长名字（`estWidth` 估算 CJK 14px / 其余 7px，`step = max(120, 最长名+24, 0.9w/cap)`），避免长名字互相压住。
- 临时数据已 purge，categories/memories/media 回到 12/137/161；`tsc` / `eslint` / `next build` 全绿。

## 21. 背景流星（已完成）

- **位置**：`StarBackground` 那张 canvas 的同一个 rAF 循环里（不新增画布、不新增 DOM），`-z-10`，天然在水雾层与所有内容之下。只在星空页生效（详情页没有背景 canvas）。
- **节奏**：首次 `2~4s` 出现，之后每次间隔 `6~16s` 随机，**同屏最多 1 条**。
- **方向**：右上 → 左下；倾角 `20°~34°`（水平线以下，非死板 45°）；速度 `950~1500 px/s`（约 1s 划过）；尾迹 `110~200px`。起点沿「右上角外侧斜带」随机（顶边 45%~105% 宽 / 右缘上方 0~40% 高两段），避免每条同点出发。
- **配色（用户定：冷/暖交替，自行观察后再定）**：`cool` = 头 `--sky-star` + 尾 `--sky-beam`（与星星同族）；`warm` = 头 `--warm` + 尾 `--warm-glow`（时间/回忆语义）；按生成顺序**交替**（`meteorSeq % 2`）。两条分支都保留。
- **画法**：`globalCompositeOperation = "lighter"` 下画「头亮尾透明」的线形渐变尾迹 + 头部径向渐变光斑；**不用 `shadowBlur`**（美术包 SPEC 的掉帧约束）。淡入前 12%、淡出后 25%。
- **两个关键坑**：
  - **帧率**：原来常态「每 2 帧绘制一次」（30fps），1200px/s 的流星每帧位移 ~40px 会明显一顿一顿 → 改成**有流星存活时逐帧绘制，平时仍每 2 帧**（`meteors.length === 0 && frame % 2 !== 0` 才跳过），开销只在流星那 ~1s。CDP 实测：一次流星 1.1s 内画了 70 帧（≈60fps），且全程无 >50ms 长任务。
  - **瞬移**：位移用 `dt`（rAF 时间差）驱动并 `MIN(dt, 0.05s)` 封顶，切后台/场景过渡（`document.hidden` / `sceneTransitioning` 期间不绘制）之后回来不会跳一大段。
- **reduced-motion**：静态分支本来就 `return` 在启动 rAF 之前 → 流星代码根本不执行，无需额外判断；实测确认 0 条。
- **验证**（`/tmp/meteor-verify.mjs`，24/24 PASS）：页面内把 canvas 缩到 320×200 后按「掩码外高亮像素」判据检测（先 8 帧暖机建星点掩码，只因**缩图会保留星点 RGB、只丢 alpha**，单看亮度分不开星星与流星；掩码外的 3×3 膨胀之外才算流星）→ 45s 内 3~5 条、可见时长 0.66~0.84s、方向全部朝左下、倾角 23~24°、间隔 12.5/15.0s、冷暖严格交替、无长任务；reduced-motion 20s 内 0 条。实拍 `/tmp/meteor-shot.png`。

## 22. 详情页日期移入标题行（已完成）

- **改法**：`MemoryScene` 主体标题块改为一行 `flex items-baseline justify-between`——`h1`（`min-w-0 break-words`）在左、日期在右（`shrink-0 whitespace-nowrap`，`memory.date` 为空则不渲染）；**颜色与标题一致（纯白）**（先按「暖金 = 时间/回忆」上过 `text-warm/70`，用户看后要求换白，遂改为 `text-white`）；字号 `text-base sm:text-lg`（用户要求放大，原 `text-sm`）。页头右列只剩 `⋯` 菜单（`MoreMenu` 自带 `shrink-0`，外层 `flex-col` 包裹一并删掉，换行位置与星空页一致）。
- **基线与换行**：用 `items-baseline` 让日期与标题**首行**同基线（实测 Δ=0）；顶格 20 汉字标题在 390 窄屏换 2 行、日期仍留在首行右侧，内容区无横向溢出。
- **实测**（CDP）：1440 / 390 / 长标题 / 短标题四种组合下日期都在标题右侧、与标题首行同基线、页头已无日期、内容区 `scrollWidth == clientWidth`；日期计算色最终为 `rgb(255,255,255)`（与标题同色）。`main` 内无溢出（文档级偶发 +4~6px 来自背景图 `blur-xs`，改动前即有）。
- **已知取舍（如实记录）**：1440×900 且这条回忆**带音乐**时，主区内容本来就比视口高（`scrollHeight 1031 / 900`，标题原本就贴在折线下沿），日期落到折线下 16px，需轻微滚动才可见；1080 高视口下正常可见。若要彻底解决需另行动刀（例如给主图加 `max-h` 上限），本次未改。

## 23. 滚筒 / 超量星星流动：性能优化（已完成）

- **症状**（用户）：「记忆滚筒页有点卡顿的感觉」。
- **先量化再动手**（headless CDP，1600×1000 @2x DPR，3.5s 采样窗口，`/tmp/perf-probe.mjs`）：

| 场景 | 主线程 script | 帧 avg / p95 | >33ms 掉帧 |
| --- | --- | --- | --- |
| 平铺档（5 条，无流动） | 122ms | 17.3 / 16.8 | 8 |
| 滚筒（100 条，12 张卡） | **930ms** | 20.1 / 33.4 | **34** |
| 超量星星（20 分类，13 颗） | **985ms** | 16.7 / 16.7 | 0 |
| 滚筒 + `reduced-motion`（流动与背景循环都停） | 2.6ms | 16.7 / 16.7 | 0 |
| 滚筒，去掉卡片发光 / 星轨 blur | 845ms（**无改善**） | — | 26 |
| 滚筒，去掉两端渐隐 mask | 879ms（**无改善**） | — | 22 |
| 滚筒，把背景 canvas 缩到 1×1 | 744ms | 16.7 / 16.8 | 0 |

- **根因**：流动由 `useTrackFlow` 的 `setOffset` 每帧驱动 → 整棵子树（卡片 + 星轨 SVG + framer-motion 光标/粒子）每帧重渲染，约 **4ms/帧** 纯 JS（占 60fps 预算 25%）；背景 canvas 再叠约 100ms（软件光栅下还会掉帧）。**mask / 卡片发光 / 星轨 blur 都不是原因**（去掉零改善），所以没动它们。
- **改法**（记忆滚筒 + 超量星星一起）：
  1. `use-track-flow` 改为 **ref 驱动 + `onFrame(cb)` 订阅**：rAF 只更 `offsetRef` 并 `emit`，**不再 setState**（拖动时每个 pointermove 也 emit，保证跟手不滞后一帧）；`ready` / 随机起点淡入 / `justDragged` 时间窗守卫语义不变。
  2. `FlowTracks`：几何（`step/span/counts/trackCross`）进 `useMemo`；每帧对 `Map<id, el>` 写 **`transform: translate3d(...) rotate(...)`**（JSX 里 left/top 静态，避免每帧触发布局）；**可见集合（含屏外 buffer）与 `activeId` 都「变了才 setState」**（按 12px/s 与 ≥480px 步长，几秒~几十秒一次）。
  3. `CategoryStars` 流动分支同法：`left: 0` + 每帧 `translate3d(main,…)`；顺带让 11 颗星 × 12 个呼吸粒子的 `animate` 对象不再每帧重建。
  4. 防御：`MemoryCardFace` / `TimelineRail` / `VerticalTimelineRail` 加 `memo`，`coverStyle()` 结果缓存，新的 `StarNode`（散布/流动共用）用原始值 props；移动层 `will-change-transform`。
  5. **防挂载瞬间露位**：节点 JSX 的兜底 transform 放到屏外（`translate3d(-99999px,…)`），并在 ref 回调里立刻按 `offsetRef` 写一次真实位置。
- **改后**（同一 harness）：滚筒 **930 → 55ms**、星星 **985 → 52.5ms**、平铺 122 → 55ms；三页 `avg 16.7 / p95 16.7 / 掉帧 0`（55ms 已接近「只剩背景 canvas」的地板）。**背景 canvas 仍是唯一的常驻开销（约占 10%），本次按约定未动。**
- **行为回归**（`/tmp/flow-behavior.mjs`，20/20 PASS）：自走 -12px/s（宽/窄/星星页一致）、拖动跟手 Δ=-200/-160、松手惯性 -201（250ms）后衰减回 -10px/s、拖动后不误跳转、正常点击进详情 / 进子类别、**60 帧内单帧最大位移 0.21px（无屏内瞬移）**、两端渐隐仍在、窄屏纵向向上自走与跟手、`reduced-motion` 不自走但仍可拖、平铺档无流动节点、无 console 报错。实拍 `/tmp/after-cylinder-1440.png`、`/tmp/after-stars-1440.png`、`/tmp/after-cylinder-390.png`。
- **测试方法论教训**：这轮第一个「拖动跟手 Δ=0」的 FAIL 是**测试脚本自己的 bug**（`dragCard` 返回的 `from` 是单张卡的 `{x,y}`，却被当成 id→位置 的 map 用，`Object.keys` 出来的是 `["x","y"]`）——**断言失败先怀疑测量代码**；另外窄屏挑拖动目标要先用 `elementFromPoint` 确认指针真能落到卡片上（小精灵可能正压在上面）。

## 24. 登录：访客态 / 站长解锁（已完成）

### 目标与决策
- **单用户解锁**（不是多用户 SaaS）：全站只有一个身份「站长」，解锁后看到全部回忆；其他访客永远是一片空星空。
- 部署口径：**本机 / 局域网自用** → 不做限流与 Secure cookie（`COOKIE_SECURE=1` 可开）。
- 登录态：**httpOnly cookie + `sessions` 表**（库里只存 token 的 sha256）。
- 口令管理：**首次在界面设置 → 之后界面改**（旧口令 + 新口令）；没有环境变量覆盖；忘记口令用 `npm run reset-password` 清掉重设。
- 访客对话：**纯闲聊、无工具、不落库**，由站长统一提供一把 OpenCode Zen 密钥，访客可在白名单免费模型里切换。
- 现有数据：不动，归站长账号（本来就只有一份）。

### 数据与接口
- 新表 `sessions(id PK, created_at, last_seen_at, expires_at, remember)`（迁移 `drizzle/0001_curvy_the_initiative.sql`）。
  - ⚠️ 本仓库的 `data/app.db` 是 `drizzle-kit push` 出来的，**没有跑过迁移链**；已有库上只需建这一张表（本次已在本机库建好），新环境走 `push` 或迁移链都行。
- `src/lib/auth.ts`：scrypt(16384,8,1) 口令哈希存 `settings` 键 `owner`（`scrypt$salt$hash`，`timingSafeEqual` 校验，无新依赖）；会话 `getSession / isOwner / requireOwner / startSession / login / logout / setInitialPassword / changePassword`；连续错 5 次锁 30 秒（内存态）。
  - cookie `memss_session`：`httpOnly; SameSite=Lax; Path=/`；勾「记住我」→ Max-Age 30 天，否则会话 cookie + 库内 12h；活跃超 1 天才滑动续期。
  - `getSession()` 只读 cookie、不写（RSC 渲染期间不能写 cookie），所以续期只写库。
- `/api/auth/{session,login,logout,password}`；`session` 公开返回 `{ authed, hasPassword }` 供前端决定显示「登录」还是「设置访问口令」。
- **门禁一律在服务端**：`requireOwner()` 加在 `settings`、`agent/models`、`categories*`、`memories*`、`conversations*`、`media/[...path]` 上；未登录 401。`/api/agent` 分叉：站长走原路径（工具 + 落库），访客走免费模型（无工具、不落库、history 由前端每轮带上，≤12 条 / 单条 ≤2000 字）。

### 前端
- 根布局 `layout.tsx` 变成 async：`const authed = await isOwner()` → `<Sprite authed>`；`AuthedProvider` 把该值传给 ActionBar / SettingsPanel / ChatPanel，**SSR 就是正确的一版，不闪**；登录/登出后 `router.refresh()`。
- `/`：未登录渲染 `GuestHome`（空星空 + canvas），已登录 redirect `/star/globe`；`/star/...` 与 `/memory/...` 未登录一律 redirect `/`。
- `Sprite`：访客态**居中**且不读也不写 `sprite-pos`（避免访客的摆放盖掉站长的）。
- `ActionBar`：访客只有「对话 / 设置」。
- 设置面板：账号块（`AccountPanel`，访客常开不可折叠）+ 站长专属「模型服务」「访客对话（免费模型）」/ 访客专属「免费模型」+ 关于。
- `ChatPanel`：访客不落库、不显示历史、开场白不同；提到「登录/账号/我的回忆」等词 → 回复结束后自动切到设置-账号（免费模型不保证支持 tool call，故在客户端兜一层）。

### 验证（CDP 真事件，跑在临时副本 + 独立 DB 的 3100 实例上，未碰真实库）
- `auth-verify.mjs` **29/29**：访客空星空 + 小精灵居中（720,443 ≈ 视口中心）+ 仅 2 个 tab + 6 个数据 API 全 401 + 无密钥时访客对话 503 且界面提示「暂不可用」+ 深链回首页 + 访客设置看不到模型服务；首次设置口令后自动登录 + httpOnly cookie（`document.cookie` 取不到）+ 勾「记住我」带 Max-Age；站长 4 个 tab + `/star/globe` + API 恢复 200 + 设置显示账号/模型服务/访客对话；退出回访客态；错口令 401；改口令后旧口令失效、新口令可用；访客取媒体 401。
- `auth-ui-extra.mjs` 3/3：站长详情页图片正常加载（`/api/media` 加鉴权后 `<img>` 仍带 cookie）；访客说「我要登录」→ 自动切到设置-账号并展开。
- 写接口抽查：访客 `PUT /api/settings`、`POST /api/auth/password`、`POST /api/categories`、`POST /api/memories`、`DELETE /api/memories/x` 全部 401，且原口令未被覆盖。
- 站长侧回归 `flow-behavior`（改跑 3100）**20/20**：自走/拖动跟手/惯性/误触/无瞬移/渐隐/窄屏纵向/reduced-motion/平铺档全过。
- 截图：`/tmp/auth-guest-1440.png`、`/tmp/auth-guest-390.png`、`/tmp/auth-guest-settings-1440.png`、`/tmp/auth-owner-1440.png`、`/tmp/auth-owner-settings-1440.png`。

### 待办 / 注意
- **访客对话尚未接真实模型**：需要站长在「设置 → 访客对话」填 Zen API Key（或设 `ZEN_API_KEY`）；填之前访客发消息会看到「暂不可用」。
- 白名单只收录 OpenAI 兼容 `/chat/completions` 的免费档（`union-alpha` 走 `/messages`、`muse-spark-1.3-contributor-free` 走 `/responses`，需要另外的 SDK，暂不收录）。

## 25. 访客对话改用 OpenRouter 免费档（已完成）

### 背景：Zen 免费档站外不可用（实测）
原计划用 OpenCode Zen 的免费模型，实测发现是**服务端硬门禁**，拿 Zen key 在站外调用一律：

```
403 {"type":"error","error":{"type":"FreeTierError",
  "message":"OpenCode's free tier can only be used from within OpenCode"}}
```

逐个测过 `nemotron-3.5-lightning-free` / `mimo-v2.5-free` / `big-pickle` / `ling-3.0-flash-fin-free`，全是 403；
Zen 的付费档则返回 `401 CreditsError: Insufficient balance`（工作区没余额）；而 OpenCode **Go** 订阅通道（`/zen/go/v1`，小精灵自己用的那条）站外可用。
不伪造 OpenCode 客户端身份绕过门禁，所以访客通道改为 **OpenRouter 的 `:free` 模型**（真第三方可用、$0）。

### 设计：实时探测，不写死清单
- `src/lib/guest-models.ts`：服务端拉 `https://openrouter.ai/api/v1/models`，只保留
  **id 以 `:free` 结尾 + pricing 全 "0" + 能输出文本**（排除 Lyria 这类 0 价但只出音频的）→ 当前 21 个。
  排序 **deepseek 优先 → 上下文长度降序 → id**，默认取 `deepseek/deepseek-v4-flash-0731:free`。
  - 缓存 6 小时 + SWR（过期先给旧列表、后台刷新）+ 单飞；冷启动失败重试一次。
  - 唯一写死的只有 `FALLBACK_DEFAULT_MODEL`（连列表都拉不到时兜底）。
- `GET /api/guest/models`（新，公开只读）：`{ ok, defaultModel, models:[{id,name,ctx}] }`，不含任何密钥信息。
- 前端：`fetchGuestModels()` 模块级缓存；访客本地存的坑位若已下线（轮换）→ 自动回落默认并回写 localStorage。
  **所以 OpenRouter 轮换免费模型时是自动跟上的。**
- 服务端校验访客传的 model：不在当前列表 → 回落默认，并带 `models: [首选, …]` 兜底链
  （⚠️ OpenRouter 限制该数组**最多 3 项**，超出直接 400；首版写成 4 项踩过这个坑）。

### 访客请求（`/api/agent` 访客分支改为裸 fetch + SSE 直通）
- `POST https://openrouter.ai/api/v1/chat/completions`，头 `Authorization: Bearer <key>`、`X-Title: MemSS`。
- 必须带 **`reasoning: { enabled: false }`**：免费档里推理模型很多，不关掉会出现「正文只有一个空格、思考全在 reasoning 里」
  （实测 deepseek-free 不带该参数时正文就是 `" "`）。
- 流式：上游 SSE → 我们的 `{type:"text"|"error"|"done"}`；只在拿到过正文时才不报错，否则提示「这个免费模型这次没说话」。
- 迁移到 AI SDK 之外的原因：需要精确控制 `reasoning` / `models` / 错误文案；无工具、无落库，比 SDK 更省事。
- 错误映射中文：401 密钥无效 / 402 余额为负 / 429 免费档限速 / 400·404·「temporarily rate-limited」→ 换一个模型。

### 密钥与设置
- 存 `settings` key=`guest`，密文复用 `crypto.ts`；env `OPENROUTER_API_KEY` 优先。
- **按前缀筛**：只有 `sk-or-` 开头的才算有效配置，早期版本存的 Zen key 自动视为未配置（否则会拿 Zen key 敲 OpenRouter 报 401）。
- 站长侧「访客对话（免费模型）」：填 key + 三步说明（注册 → 建 key → 打开免费档隐私开关）+ 限速与「内容可能被记录/训练」提示 + `sk-or-` 前缀提示。
- 访客侧「免费模型」：Combobox 展示实时列表（名称 + 上下文），默认项标注。
- 访客对话**无站内限流**（按用户要求），实际天花板是 OpenRouter 免费档：**20 次/分、50 次/天**（累计充值 $10 → 1000 次/天）。

### 验证
- 探测：`GET /key` 200（`is_free_tier: true`，50/天）；deepseek 带 `reasoning:{enabled:false}` 流式**首字 1.5s、总 2.2s**；
  `models` 兜底链实测把被限流的 qwen 自动切到 deepseek（200）。
- `/tmp/guest-chat-verify.mjs` **12/12**（真实 3000 dev server，访客态）：实时列表 21 个且默认 deepseek；访客真发一条拿到**模型回复**（不是欢迎语）；
  未写 `sprite:conversationId`；手改 `openai/gpt-6-astra` → 200 且正常回答（回落生效）；无 console 异常。
- 落库检查：对话前后 `conversations 4 / messages 100` **完全不变**。
- 站长侧回归（临时副本 + 独立 DB 的 3101 实例）：`flow-behavior` **20/20**；设置面板四块齐全（账号 · 已登录 / 模型服务 / 访客对话 / 关于）。
- `tsc` / `eslint` / `next build` 全绿。
- 截图：`/tmp/guest-chat-reply.png`、`/tmp/guest-free-models.png`、`/tmp/guest-owner-settings.png`、`/tmp/guest-owner-key.png`。

### 注意
- 免费档上游不稳（探测时 qwen / gemma 直接 429），靠 `models` 兜底 + 访客可切换缓解；列表随时可能被官方轮换，代码无需改动。
- 免费档可能记录/训练数据（用户已确认接受），设置与「关于」里都有提示。

## 26. 聊天会话暂存内存：切视图 / 关面板不再丢（已完成）

### 问题
小精灵面板切视图（对话 / 搜索 / 上传 / 设置）时 `ChatPanel` 会被卸载，而聊天状态原本都在组件内部：

- **访客**：切到设置再回来，整段对话清空（连欢迎语之外全没了）。
- **站长**：发送后回复还没到就切走，回来「没有回复了」。根因比"不显示"更麻烦：
  `conversationId` 由服务端首个 `meta` 事件回填再写 localStorage，**新会话首条消息若在 `meta` 到达前切走，这个 id 就永久丢了**——
  服务端其实把回复写进了数据库，但客户端把指针丢了，之后连刷新都找不回来。

### 改法：`src/store/chat-session.ts`（zustand，纯内存，站长与访客共用）
```
mode / messages / streaming / toolStatus / error / input / lastUser / controller / conversationId
begin(mode, welcome) / reset / setMessages / patch
```
- `ChatPanel` 的 `messages / streaming / toolStatus / error / input / lastUser / abortController / conversationId` 全部改为读写 store；
  局部只留 `view / conversations / agentLabel / scrollRef / petReqRef`。6 处 `setMessages(...)` 调用点写法不变（包一层稳定引用）。
- 于是：**流式回复继续写进 store**（异步循环即使在卸载后也能追加）；`meta` 回填的 `conversationId` 不再因卸载而丢；
  输入框草稿、`lastUser`（重试）、`controller`（停止）都跨视图存活；面板 ✕ 关掉再开也还在。切回对话时若仍在 streaming，会让角色重新进入思考姿态。
- **不再**在每次挂载时重拉历史（那会把正在生成的回复冲掉）；只在 `mode` 变化（登录/登出）时 `begin()` 复位，
  然后站长按 localStorage 里的 id 载入数据库历史。**mode 复位是隐私底线**：登出后访客看不到站长的聊天记录。
- 访客仍是纯内存：刷新页面即清空（不落库、不进 localStorage）。

### 设置默认收起
- 「登录 / 设置访问口令」与「免费模型」两块改为**默认收起**、可点开；`SettingsSection` 里专为"常开"服务的 `locked` prop 已删除。
- ⚠️ 副作用（用户确认接受）：首次使用（库里没口令）时也要自己点开「设置访问口令」。

### 验证
- 访客（真实 3000，不写库）`/tmp/chat-session-verify.mjs` **9/9**：两块默认收起且可展开；发一条拿到模型回复；
  切设置再切回**记录仍在**；**草稿跨视图保留**；**流式中途切走 12s 再回来回复完整**、无「…」占位；刷新只剩欢迎语。
- 站长（临时副本 + 独立 DB 的 3101）`/tmp/chat-owner-verify.mjs` **12/12**：回复到达前切走→切回可见；
  **新会话 conversationId 不再丢（null → 有效 id）**；**刷新后该会话（含回复）仍能恢复**；面板 ✕ 关掉再开记录与草稿都在；
  登出后对话清空为访客欢迎语（不串记录）；重新登录恢复站长会话。
- 站长侧 `flow-behavior` 20/20（连跑三次，其中一次窄屏纵向拖动跟手偶发 FAIL Δ=-0.2，属已知**测试脚本**抖动：
  窄屏拖动目标偶被小精灵压住；已两次复跑 20/20、且本次改动不涉及星空页）。
- `tsc` / `eslint` / `next build` 全绿。

## 27. 访客只读浏览 + 访客精灵只读工具（已完成）

### 目标
访客从「什么都看不到」改成「**只读能看**」；访客精灵从「纯闲聊」改成「**只读工具**（检索/展示/带路）」；
并给站长一个总开关，随时能把对外可见整体关掉。

### 权限模型：两条门禁 + 一个开关
- `requireOwner()`：所有**写**接口（categories/memories/conversations/settings/media 的 POST/PATCH/PUT/DELETE）不变。
- `requireReadAccess()`（新）：**只读**接口 —— 站长永远放行；访客仅在 `allowBrowse` 打开时放行，否则 401。
  只用在三处：`GET /api/categories`、`GET /api/memories/search`、`GET /api/media/[...path]`。
  页面数据走 RSC 直查库，不经过这些接口。
- `settings.guest.allowBrowse`（新，**默认 true**）：页面与接口都按它硬切，不是藏 UI。
  - `allowBrowse=true`：`/` → 站长与访客都 `redirect("/star/globe")`；`/star/...`、`/memory/...` 直接可读。
  - `allowBrowse=false`：回到旧行为 —— `/` 渲染空星空（`GuestHome` 保留），两个深链 `redirect("/")`，三个只读 GET 401。

### 访客侧界面（只读）
- 星空页 / 回忆详情：`⋯`（编辑/遗忘）菜单与删除弹层按 `useAuthed()` 隐藏；详情页图片、音乐照常可读。
- 小精灵功能栏：访客 = `对话 / 搜索 / 设置`（**新增只读的搜索面板**，无「上传」）；`allowBrowse=false` 时降级为 `对话 / 设置`。
- `Sprite` 挡住访客可达的写视图（`upload` / `edit` 一律落回对话），工具下发 `openUpload`/`openEdit` 在客户端也再拦一道。
- 访客小精灵的位置改成和站长一致：**默认右下角、可拖拽**，但位置存**独立 key**（`sprite-pos:guest`），
  绝不覆盖站长自己的摆放。
- 开场白按开关二选一：开放时「这里的东西你都可以看（只读）…」；关闭时回到「星空还空着…」。
- ⚠️ 实现坑：`AuthedProvider` 原本只包住 `Sprite`，而 `StarfieldPage` / `MemoryScene` 是**页面**里的客户端组件，
  `useAuthed()` 恒为默认值 `false` —— 直接把站长的写入口也一起藏了（被自己的回归测试当场抓住）。
  现改为在 `layout.tsx` 里用 `AuthedProvider` 包住 `children` + `Sprite`，并新增 `BrowseContext` / `useBrowseOpen()`。

### 访客精灵：只读工具子集
- `createAgentTools(ctx, { readOnly: true })` 只返回 5 个：`searchMemories`、`showMemories`、
  `navigateToCategory`、`openMemory`、`openSearch`；上传/编辑/迁移/遗忘**不注入**（模型没有调用的可能）。
- 访客侧 `searchMemories` 一次最多带 30 条（站长不限制）。
- 修掉一个真实体验问题：模型常把**类别名称**当 `categoryId` 传（如「云南」），原来直接查不到 → 答「0 条」。
  现在先按 id、再按名称解析；解析不到就不加类别过滤并在结果里带 `note` 说明。

### `/api/agent` 两种身份统一
- 访客改用 AI SDK 跑工具循环（不再手写裸 fetch），并把免费档的两项控制塞进请求体：
  `createOpenAICompatible({ transformRequestBody })` → `reasoning: { enabled: false }`（推理档不关会只吐思考、正文空白）
  与 `models: [首选, 兜底…]`（≤3 项，被限流/下线时 OpenRouter 自动换档）。
- 访客轮：`stopWhen: isStepCount(4)`、`maxRetries: 0`（不自动重试，免得把当天额度翻倍消耗）、
  90 秒超时、低温度 0.2、**不落库、不建会话、不发 `meta`**；
  错误经 `APICallError` 的 status/responseBody 走 `guestErrorMessage` 中文化。
- 少数档位强制推理（`reasoning:{mandatory:true}`，如 `liquid/lfm-2.5-2.6b:free`）：请求 400 → 摘掉 reasoning 开关**重试一次**，
  并把该档位拉黑 6 小时（`markGuestModelUnusable`）。
- 访客不落库就没有工具历史 → 前端把「已展示过的回忆 id」（`shownIds`）随请求带上，避免跨轮重复展示。
- 站长轮：行为与之前完全一致（工具全集、同意上下文 `consentAsked`、落库与卡片绑定、`x-opencode-session`）。

### 免费档过滤与默认档
- 只保留「免费（pricing 全 0）+ 能输出文本 + `supported_parameters` 含 `tools` + 非强制推理」的档位（20 → 18）。
- 实测（2026-09）：`cohere/north-mini-code:free` 会检索且没跑偏（修掉类别名坑之后 2/2）；
  `nex-agi/nex-n2.5-mini:free` 出过完整卡片流程、也有跑偏答非所问的样本；`dots`/`qwen` 常只凭类别概览直接作答。
  默认档候选表以此排序（`DEFAULT_CANDIDATES`），唯一写死的 `FALLBACK_DEFAULT_MODEL` 同步换成 cohere。
- `deepseek` 已从免费档下架 → 原来的「deepseek 优先」排序规则删除。

### 设置面板
- 原来的「访客对话（免费模型）」区块与新的浏览开关合并为**「访客设置」**：开关点一下即时 PUT 生效；
  密钥仍是「保存」按钮提交。文案讲清「访客一律只读」与「关掉只剩空星空与闲聊」。

### 验证
- 访客只读（真实 3000，`/tmp/guest-readonly-verify.mjs`）：`/` 落 `/star/globe`、能看到类别与回忆、面包屑正常、
  功能栏 = 对话/搜索/设置（无上传）、星空页与详情页**都没有 `⋯` 写入口**、搜索面板可用、
  详情页图片真实加载（`naturalWidth>0`）、封面临时可读（200）、
  **访客写接口全 401**（POST/PATCH/DELETE categories、PATCH/DELETE memories、PUT settings）+
  站长专属 GET（settings/conversations/memories/[id]）仍 401。
- 开关关/开（临时实例 3101，`/tmp/guest-toggle-verify.mjs`）**15/15**：关闭后站长自己不受影响；
  访客 `/` 是空星空、两个深链被弹回首页、三个只读 GET 401（免费模型列表仍公开）、
  功能栏降级为对话/设置、开场白回到「星空还空着」；恢复后访客又能进星空。
- 锁定态访客精灵实测：请求**没有任何 tool / memories 事件**，回答是「需要登录」的引导 —— 关掉开关后连只读工具都不存在。
- 站长回归：`chat-owner-verify` 12/12（回复前切走→切回可见、conversationId 不丢、刷新恢复、关面板重开、登出隔离、重登恢复）、
  `flow-behavior-3101` 20/20、`tsc` / `eslint` / `next build` 全绿。
- 访客对话出卡片：链路已验（直连 API 跑出 `tool:searchMemories → showMemories → memories(3/3)`；
  UI 跑出过 `cards:2`）。免费档模型波动大，**验收当天最后两次受「免费额度用尽（52/50）」影响未能复现**。

### 已知限制 / 风险
- **隐私面扩大**：开关打开时，局域网内任何人都能读全部类别、回忆、图片与音乐；媒体是长缓存
  （`immutable, max-age=31536000`），关闭开关不追溯已加载的页面与浏览器缓存。
- 访客精灵会把**回忆标题/地点等真实内容**发给 OpenRouter 免费档（可能被记录/训练）—— 这是选 5A 的代价，界面上有提示。
- 免费档额度 50 次/天，工具循环一轮要 2~3 次请求（约合 15~25 轮对话/天）；无站内限流，额度被刷完访客会看到「限流」。
- 免费模型能力参差（跑偏、只凭概览作答），已提供「换模型」与「重试」两个出口。

## 28. 渲染降载专项：环境动画改 CSS / canvas 降载 / 星轨与毛玻璃（已完成）

### 起因与诊断
- 用户反馈两点：① 停留在一个页面久了会变卡；② 页面渲染很吃 CPU/GPU。
- 逐项排查（rAF / 定时器 / 事件监听 / zustand 订阅 / Map/Set / ResizeObserver / audio rAF / objectURL）
  **没有发现无界增长的泄漏**，所有副作用都有清理或上限。
- CDP 采样（`/tmp/perf-sample.mjs`、`/tmp/perf-trace.mjs`，1440×900）得到的关键事实：
  - 星图页最多同时有 **240+ 个 framer-motion 无限动画**（20 颗星 × 12 粒子 + 星点脉冲 + 卡片浮动），
    每个都由主线程每帧写内联样式。
  - 48 个粒子就值 **+1.3ms/帧、样式重算 +780ms/25s**（P0 无粒子 1.17ms → P1 有粒子 2.48ms）。
  - `prefers-reduced-motion` 下（PetArt 的 `animation: none` 生效、canvas 只画一帧）主线程开销几乎归零
    （0.076ms/帧、Layout/RecalcStyle 全为 0）→ **这些常驻开销全部来自动画**，不是 React 渲染。
  - 全屏 canvas（DPR 1.5 → 2160×1350）每帧 `clearRect + 144 次 arc` 并逐帧分配 `rgba()` 字符串，
    是 commit/paint 每帧都发生的主要驱动（trace：Commit 243 次/4s）。
  - 结论：变卡的主因是**持续满负载**（热/功耗降频 + 合成器压力），不是泄漏。

### 本轮改动
1. **粒子 / 星点脉冲 / 卡片浮动 / 回忆页播放键：framer-motion → 纯 CSS 关键帧**（`globals.css` 的
   `.ambient-particle / .ambient-pulse / .ambient-float / .ambient-play(-idle)`）。
   参数（位移、时长、相位）由 JSX 用 CSS 变量给，随机种子与旧实现完全一致；240+ 个 JS 动画 → 0。
   浮动/粒子都要**单独一层**承载动画：CSS 动画会整体覆盖 `transform`，不能与定位/旋转同层。
2. **canvas 降载**（`StarBackground.tsx`）：亮度查表（不再逐帧拼 `rgba()`）、DPR 1.5 → **1.25**、
   常态每 3 帧画一次（**20fps**，有流星时仍逐帧）、视差平滑改按 dt 计算（保证降帧后手感不变）。
3. **星轨**（`TimelineRail.tsx`）：光标从动画 `left/top %` 改为 **transform（像素）**（不再每帧布局），
   去掉 polyline 的 `blur + drop-shadow`（换成一条更粗更淡的同路径描边）与光标上的 `blur(1px/6px)`。
4. **去大面毛玻璃**：小精灵面板 `backdrop-blur-xl`、窄屏遮罩与弹窗遮罩的 `backdrop-blur-sm` 全部去掉
   （面板本来就 `bg-panel/95`，观感无差），不再每帧重新采样背后的动态星空。
5. **环境暂停**（`src/lib/ambient-pause.ts` + `html[data-ambient="paused"]`）：**切后台 / 窗口失焦**时
   冻结全部环境动画（`animation-play-state: paused`，恢复时从原处继续）并让 canvas 停止绘制。
   - **不含「面板打开」**：实现时先按「面板打开也冻结」做过，实测面板只是角落浮层、星空与小精灵都还在视野里，
     冻住后整片天和小精灵像张静止图片，观感不可接受 → 回退成只在切后台/失焦时冻结。
   - **不做**「无操作多久自动降载」（用户明确不要）。
6. **补 reduced-motion 缺口**：星点粒子/星点脉冲原本无条件播放（现在 `ambient` 开关统一判断）；
   回忆页播放键原本两份实例（其一 `display:none`）各跑一个无限 JS 动画，现在改成 CSS 类，
   `display:none` 的实例自然不跑。
7. **整屏过渡 blur 收敛**：`sceneIn/memoryIn/memoryOut` 的 14/16/12px → **5/6/6px**（时长不变）。
   模糊与 opacity 淡入同时发生，半径数值在几乎透明的前几帧里分辨不出，而整屏 `filter: blur()` 每帧都要
   重新栅格化整个子树，是每次导航最重的一笔。

### 实测（同一脚本、同一页面、25s 采样；无头 Chrome，绝对帧率不代表真机 GPU）
| 状态 | 每帧主线程 | JS 耗时/25s | 样式重算/25s |
| --- | --- | --- | --- |
| 星图页（无粒子） | 1.167 → **0.816ms** | 0.357 → **0.102s** | 237 → 197ms |
| 星图页（48 粒子） | 2.481 → **1.217ms** | 0.930 → **0.086s** | 1019 → **641ms** |
| 流动页（100 段回忆） | 1.113 → **0.822ms** | 0.306 → **0.128s** | 236 → 160ms |
- trace 对比（同页 4s）：FunctionCall 1026 → **548**，FireAnimationFrame 729 → **488**，Commit 78 → **40ms**。
- 观感核对：截图天空区域平均亮度 9.6 → 9.6（不变），亮像素 10685 → 9087（−15%，来自 DPR 1.5→1.25 的
  亚像素星点变细）；回忆页截图逐像素一致。
- 交互核对：面板开合不再影响动画（`data-ambient` 保持 run）；模拟失焦事件 → `paused`、恢复聚焦 → `run`；
  星轨光标位置与旧 % 实现一致（t=0.5 时落在 720px、距轨顶 21.5px），拖动流动后光标随「最靠近中心」的回忆右移。

### 验证
- `flow-behavior`（改用真实 3000）**20/20**（含平铺档 5 张卡、流动档、窄屏纵向、reduced-motion、无 console 报错）；
  `resize-verify` **14/14**；`tsc` / `eslint` / `next build` 全绿。
- 未验：窗口失焦分支在无头环境无法真实触发（headless 恒为 focused），只验证了「blur 监听 → 读 hasFocus → 写
  `data-ambient`」这条线；真机上切到别的应用时应当冻结。

### 已知限制
- 粒子/浮动的观感与旧实现等价但**不是逐帧像素一致**：CSS 缓动按段插值与 framer 的关键帧缓动略有差异；
  粒子峰值透明度 0.95 → 0.9（小精灵常驻粒子复用了星图粒子的关键帧）。
- DPR 1.25 让亚像素星点比原来细约 17%（天空亮像素 −15%），肉眼几乎不可辨；若觉得星空变淡，把
  `StarBackground.tsx` 的 `MAX_DPR` 调回 1.5 即可（代价是填充像素 +44%）。
- 面板打开时环境动画照常运行（见上：冻结的观感不可接受），这部分开销仍在。
- 小精灵造型的 8 个 SVG 无限动画仍是主线程开销（约 0.9ms/帧、60 次/秒样式重算），
  本轮没有动美术包（它是角色的灵魂，动它属于观感决策）；要降只能减少动画部件或降低动作频率。

## 29. Windows 上机：本地跑通 + Docker 本地验证（2026-09-22）

### 本机环境
- Windows 10 家庭中文版 22H2；仓库 clone 到 `D:\projects\memss`；**Node 24.21.0 免安装版在 `D:\nodejs`**（用户级 PATH，与开发机同版本）。
- `npm ci` 需加 `--ignore-scripts`：better-sqlite3 v13 自带 `prebuilds/win32-x64.node`（无 install 脚本、GitHub release 0 assets），但 npm rebuild 阶段仍会跑 node-gyp（下载 `node.lib` 超时 + 本机无 VS 工具链）→ 直接失败；`--ignore-scripts` 后运行时自动加载 prebuilds（已实测建表/读写正常）。
- `npm run db:migrate`（全新空库）→ `npm run seed`（5 分类 / 13 回忆）→ `npm run dev`：`/api/health` 200、`/star/globe` 200（title MemSS）。

### Docker Desktop（本机实际未装 → 现装）
- `C:\Program Files\Docker` 只有 `cli-plugins` 残留，本体与 `docker.exe` 都没有；`winget install Docker.DockerDesktop`（4.91.0）安装。
- WSL 从 Win10 inbox（内核 5.10.16）`wsl --update --web-download` 升级到 **2.7.14.0 / 内核 6.18.33.2**，`docker-desktop` distro 正常。
- Docker Hub 不可达（`auth.docker.io` 超时）→ `~/.docker/daemon.json` 配 `registry-mirrors`（`docker.1ms.run` / `docker.m.daocloud.io` / `docker.xuanyuan.me`，实测可用）。
- 工具会话里需前置 `C:\Program Files\Docker\Docker\resources\bin` 到 PATH（否则 docker CLI 与 `docker-credential-desktop` 都找不到）。

### 本次代码修复（2 处）
1. **`Dockerfile`**：删除 `COPY --from=builder .../node_modules/bindings` —— better-sqlite3 v13 已不依赖 `bindings`（lockfile 0 处），该行会让构建在 runner 阶段必然失败。
2. **SQLite WAL × Windows bind mount（9p）**：容器首启 `SQLITE_IOERR_SHMOPEN`（WAL 需 mmap，宿主机 Node 留下的 `-shm` 在 9p 打不开；容器自建的 `-shm` 却可用 → 行为不稳定）。修法：
   - `docker-compose.yml` 显式 `SQLITE_JOURNAL_MODE: "DELETE"`（容器确定性用 DELETE）；
   - `src/lib/db/index.ts` + `scripts/{migrate,seed,seed-demo}.mjs` 读该环境变量，pragma 失败再兜底 DELETE；**本地开发默认仍 WAL**。
   - 回归：宿主机以 WAL 写入后强杀（留下 12KB `-wal`）→ 容器启动自动恢复、`journal_mode=delete`、数据零丢失。

### 验收
- `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build app` → `Up (healthy)`；`/api/health` 200、`/star/globe` 200（title MemSS）、`/api/media/seed/*` 200；容器内 `categories=5 / memories=13`；`tsc` / `eslint` / 镜像内 `next build` 全绿。
- `docker-compose.local.yml`（新增，未进仓库）只加 `127.0.0.1:3100:3000` 回环映射，用于本机浏览器验收；base compose 不映射宿主端口（生产走 Tunnel）。
- 注意：容器与本地 `npm run dev` 不要同时开同一个 `data/app.db`。

### 上线（Cloudflare Tunnel 已通，2026-09-22 深夜）
- 3 条停放 A 记录已删；Zero Trust 建 Tunnel（token 方式，tunnel `4f7a51d4-cc65-4bd8-9d79-725ebbad734f`），token 存 `.env`（gitignored）；`docker compose up -d` 起 app + cloudflared，日志 `Registered tunnel connection`（QUIC / location=lax08；region2 UDP 降级 http2，不影响可用）。
- Public Hostname：空 Subdomain + `memss.top` + Service HTTP `app:3000` → CF 自动建代理 CNAME（`4f7a51d4-…cfargotunnel.com`），CF 权威 A = `104.21.39.179` / `172.67.171.41`。
- 公网验收：`/api/health` 200 `{"ok":true}`（2.0s）、`/star/globe` 200（title MemSS，1.4s）、`/api/media/seed/*` 200、`/_next/static/*` 200（immutable）；CF-RAY 落 SEA。
- **待做**：① 界面设置站长口令；② 填「模型服务」/「访客对话」API Key；③ ⚠️ `allowBrowse` 默认 true —— 上传真实回忆前决定是否关闭（当前任何人访问都能只读浏览，现有数据仅种子演示）；④ SSE 是否被 CF 缓冲（登录 + key 后测）；⑤ 手机 4G/5G 验收；⑥ Windows 常开（禁睡眠/休眠、Docker 自启）与备份（§13.6）。

## 30. 类别星星在强制深色下「变透明」（已修，2026-09-23）

- **现象**：公网访问时用户（桌面 Chrome 开了强制深色）看到类别星星是「透明」的。
- **排查**：本地容器与公网 `memss.top` 的 HTML 哈希、静态资源字节、计算样式完全一致（排除服务端/CF）；CDP 读到的星星是 `rgb(255,255,255)`、`opacity 0.85~1`、hydration 正常；用 `--enable-features=WebContentsForceDark` 的 Chrome 复现出「白点被压成暗圆」。
- **根因（Chromium 强制暗化行为）**：只反色 **DOM 元素的 CSS 颜色**（背景/边框/渐变），**内联 SVG / canvas / `<img>` 的内容不受影响** —— 因此流星（canvas）与小精灵（SVG）正常，而 DOM 白点星星被压暗。实测 `<meta name="color-scheme">`、`:root{color-scheme}`、CSS 渐变都**无法**让桌面 flag 退出（该 flag 只能用户自行关闭）。
- **修法（站点侧，已做）**：`CategoryStars` 的星点与呼吸粒子改用**内联 SVG**（白点 + `radialGradient` 发光），强制深色下与普通模式观感一致。顺带修掉一个真 bug：原发光类名 `shadow-[0_0_22px_7px_rgb(var(--accent) / 0.55)]` 含空格 → Tailwind 从未生成（`box-shadow: none`，亮星一直没发光），改走 SVG 渐变后一并解决。
- **补的声明**：`:root { color-scheme: dark }` + `layout.tsx` 的 `viewport.colorScheme`（输出 meta）：Android Chrome「深色主题」的官方退出方式，同时让表单控件/滚动条走深色。
- **验证**：普通 + 强制深色两个 Chrome 的 4x 裁剪图一致；公网 SSR 含 `memss-star-glow`；`tsc` / `eslint` / 镜像内 `next build` 全绿。

## 31. 容器内保存 API Key 失败（已修，2026-09-23）

- **现象**：公网界面保存「模型服务」API Key 失败；容器日志反复 `EACCES: permission denied, mkdir '/app/data'`。
- **根因**：`src/lib/crypto.ts` 的主密钥回退路径写死 `process.cwd()/data/secret.key`；容器 cwd=`/app`（root 所有、nextjs 不可写），而持久卷在 `/data` → 加解密整体失败（存/读都受影响）。
- **修法**：密钥文件改为**与 `DATABASE_URL` 同目录**（本机 `./data/secret.key` 不变，容器 `/data/secret.key` —— 卷内已有该文件，随 `data/` 备份），并支持 `AGENT_SECRET_FILE` 显式指定；`.env.example` 注释同步。
- **验证**：临时插入测试会话 → `PUT /api/settings` 200 且掩码往返正确 → 清理测试 key 与会话（真实 sessions 未动）；用户已存的 OpenCode Go key 可正常解密（说明读路径一并恢复）；`tsc` / `eslint` 全绿。
- **教训**：容器 cwd 是代码目录（不可写），任何相对 cwd 的落盘路径都必须改走挂载卷。

## 32. 手机上传失败：CF 100 秒超时 + 隧道协议（已修，2026-09-23）

- **现象**：手机公网选两张照片上传 → 长时间「保存中」→ 上传失败。
- **排查**：app 侧 `Error: aborted / ECONNRESET`，cloudflared 侧 `Incoming request ended abruptly: context canceled`，`media/uploads` 无文件（请求体未收完）。量化实验（同一 5MB 文件）：直连容器 0.41s（12.6MB/s）vs 公网 QUIC 隧道 **524 / 130s（40KB/s）**；本机直连 CF 上传 866KB/s、下载 361KB/s → 瓶颈在隧道，不在家宽/应用。
- **修法**：`docker-compose.yml` 的 cloudflared 加 `--protocol http2`（本线路 QUIC 到美西边缘异常慢）→ 5MB 公网 **200 / 14.5s（362KB/s）**，复测稳定。
- **边界**：隧道吞吐约 120~360KB/s + CF 约 100s 断流 → **可靠上传上限约 10MB**；12MB 实测 502/107s。
- **待办（建议）**：前端上传前压缩（最长边 2048 / JPEG 0.85）+ 上传进度 + 失败重试，让手机原图也能稳定上传。

### 32.1 上传体验（已实现，2026-09-23）
- **压缩**：新增 `src/lib/compress-image.ts` —— 等比缩放到最长边 2048、JPEG q0.85，校正 EXIF 方向；**不裁剪**；动图/矢量跳过；解不开（如桌面 HEIC）或压缩没收益时原样回退原文件。
- **进度与重试**：新增 `src/lib/upload-client.ts` —— 用 XHR 取上传进度；网络错误/超时与 502/503/504 自动重试一次（4xx 不重试，避免重复提交）。`MemoryForm` 选图即压缩、按钮显示「保存中 N%」。
- **验证**：CDP 注入 4000×3000 图片 → 预览 2048×1536 → 上传成功（落盘 26.9KB / 2048×1536）；用户真实两张原图（5.2MB + 9.3MB）在 http2 修复后上传成功。进度中间值待真机慢速上传确认。
