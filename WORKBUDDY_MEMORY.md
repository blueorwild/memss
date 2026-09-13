# 协作记忆 WORKBUDDY_MEMORY

记录本项目的协作偏好、约定与重要决策，供后续会话延续。

## 用户偏好

- 沟通语言：中文。
- 接受高信息密度的结构化输出（表格、分点、分层建议）。
- 喜欢在做决策前被提问、给出带描述的选项（倾向用 question 工具收敛方案）。
- 认可「先对齐 → 再执行」的分阶段推进方式；关键节点愿意确认。
- **后续代码改动需添加适当的中文注释**（用户明确要求）。
- 项目为纯爱好探索，不以求职简历为目标，不受求职场景约束。
- 对技术选型要求「什么方便用什么」，但重视架构解耦与后续可升级性。
- 沉浸式场景交互偏好：图片**不自动轮播**，用键盘 `←/→` 手动切换（循环）；背景音乐用 `空格` 键播放/暂停；不加操作提示文案。

## 项目约定

- 项目名：回忆星空（暂名）。
- 计划文档：`PLAN.md`（当前目录）。
- 形态：本地单体全栈应用，`npm run dev` + HMR 实时调试。
- 技术栈：Next.js(App Router) + TypeScript + Tailwind + SQLite/Drizzle(better-sqlite3) + Zustand + Framer Motion + Vercel AI SDK。
- 媒体以本地 `media/` 目录存放，不入库，经 API 流式提供。
- 单用户 + 简单密码保护（middleware + httpOnly 签名 cookie）。

## 重要决策

- 回忆体 = 图片（主）+ 可选文字 + 可选背景音乐，三位一体。
- 分类统一为一棵可生长的 `Category` 树（地球→国家→地区→自定义），**任意节点可挂回忆**，不强制叶子；「可点」按子树递归判定。
- 星空采用**伪 3D 视差**（Canvas 粒子 + DOM），架构预留升级 React Three Fiber。
- 缩略图用 `seed` 做**确定性散落布局**，保证每次进入位置一致。
- 必加**面包屑/层级路径 + 返回上级**，防止多层星空迷路。
- 录入回忆**走悬浮小精灵**（功能按钮 + 对话共享 tool 层），不做独立管理页。
- LLM 做成**可扩展 provider**（兼容 OpenAI 接口，可填 DeepSeek/智谱/opencode 系等），带 `supportsTools` 能力标记与降级为纯对话的策略。
- 里程碑：P0 环境 → P1 数据+详情 → P2 星空导航 → P3 小精灵 → P4 Agent 能力 → P5 打磨。

## 待办 / 下一步

- P0 已完成：nvm + Node v24.21.0、Next.js 16.3.4、Drizzle(0.45.2)+better-sqlite3(13.0.3)+drizzle-kit(0.31.10)、SQLite 建表成功、dev server 验证 HTTP 200。
- 网络注意：nodejs.org / registry.npmjs.org / binaries.prisma.sh 均不可达；统一用 npmmirror（`.npmrc` 已配 registry），nvm 装 Node 用 `NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node`。
- 选型变更：原计划 Prisma，因其最新版依赖 effect@4.0.0-rc.113（镜像缺失）且引擎下载受阻，改用 Drizzle ORM + better-sqlite3。
- P1 已完成：`scripts/seed.mjs`（生成占位素材 SVG/WAV + 插入 5 分类 / 4 回忆 / 13 媒体）、媒体流路由 `/api/media/[...path]`（支持 Range、防路径穿越）、查询层 `src/lib/db/queries.ts`、详情页 `/memory/[id]` + `MemoryScene`（图片轮播 + Web Audio 音乐淡入淡出）、首页临时列表。
- 占位素材：`media/seed/*.svg`、`*.wav`，可替换真实文件；重跑 `npm run seed` 会重建。
- `next.config.ts` 已加 `serverExternalPackages: ["better-sqlite3"]`。
- P2 已完成：路由 `/star/[...path]`（`/` 重定向 `/star/globe`）、`StarfieldPage` 组装、`StarBackground`（Canvas 粒子+视差）、`Breadcrumb`、`CategoryStars`（星区/可点判定/镜头推进）、`MemoryCylinder`（CSS 3D 滚筒：时间→圆周角、seed 抖动、拖拽惯性、静止自转、下沿光轨、背面变暗）、`lib/layout-seed.ts`。
- P2 设计定稿已写入 `PLAN.md` 第 11 节。
- 依赖新增：`framer-motion` 13.2.0、`zustand` 5.0.15。
- P3 已完成：`store/sprite.ts`（zustand）、`components/sprite/{Sprite,ActionBar,ChatPanel,UploadMemoryForm}.tsx`、`api/categories`（GET）、`api/memories`（POST multipart 上传，落盘 `media/uploads/`）；`layout.tsx` 已挂载 `<Sprite />`。对话为本地模拟流式（P4 接真实 LLM）。
- 下一步：P4 Agent 能力（provider 配置化 + tool calling）。

## 经验与坑

- **全屏沉浸页布局**：用 `h-screen` + flex 容器 + 子项 `min-h-0`；避免 `min-h-screen` + `flex-1` + `h-full` 组合导致高度塌陷（曾使滚筒区域完全空白，被 `overflow-hidden` 裁掉）。这是 P2 缩略图「无法显示」的真正根因。
- **3D 滚筒**：根容器 `absolute inset-0` + `perspective`；ring 用 `translateZ(-R) rotateY(θ)`；卡片居中把屏幕空间 `translate(-50%,-50%)` 放在 transform 链最前。
- **视觉验证**：本机 Chrome headless 截图（`--headless=new --screenshot --virtual-time-budget`）可快速定位渲染/布局问题；注意首次访问需预热编译，否则会截到空白页（曾误判为 bug）。
- **星星布局**：只有类别层用黄金角散落（seed 确定性、均匀）；星+回忆共存时星区用 arc 集中上方 30%。可点星星带**白色呼吸粒子**（固定种子 `mulberry32`，约 5 颗/星，保证 SSR 一致）。
- **层级过渡**：用「径向渐变光雾 + blur + mix-blend screen」营造迷雾散开感，避免实心圆轮廓。
- **回忆布局阈值**：`回忆数 ≤ 5` 用平面散落（`gridScatter`，全部朝前可点）；`≥ 6` 用 3D 滚筒。避免少量回忆时卡片转到背面点不到。
- **星空页入场动画用 CSS**（`@keyframes sceneIn` + `motion-safe:animate-[sceneIn...]`），不要用 framer 的 `initial opacity:0`——后者在 JS 动画未执行时会让整页保持不可见（headless 下尤其明显），CSS 动画更稳健。
- **钻入过渡**约 300ms；迷雾动画同步缩短。
- 回忆页：面包屑含回忆标题（末项不可点），返回按钮在面包屑下方（`← 返回`），`Esc` 回所属类别；图片两侧半透明 `‹ ›` 按钮切图循环；进入/退出改用 CSS `memoryIn/memoryOut`（虚化扩散，进入 200ms）。
- 平面回忆（≤5）为时间轴散落（X 按时间、Y/旋转 seed）+ 持续飘荡；滚筒底部星轨由 `TimelineRail` 共用：**上凸拱形、从左下贯穿到右下**，弧线两端用 `linearGradient` 渐隐并加微弱 blur/发光（**无月刻度**）；年份字号 12、系统手写体、`fill` alpha 0.65；流光标为淡金细长四角星、核心提亮至近白并带轻微 blur，弹簧滑动跟随正对观众的回忆。
- 滚筒仅**自动缓转方向反向**（`-= 0.05`），拖拽手感不变。
- 点击星星钻入：**100ms**，星星本身快速消失（opacity→0，0.1s，带轻微放大），光雾核心调淡至约 `0.8` 再从该点扩到全屏。
- **hydration 修复**：`CylinderMemories` 卡片 style、`TimelineRail` DOM 百分比的浮点值全部用 `r3` 取整——Node(SSR) 与 Chrome 的浮点序列化位数不同会触发 hydration mismatch（dev 指示器 `1 Issue`）。根因是一套浮点计算在两端序列化结果不一致。
- 小精灵 `Sprite`：可拖拽（手动 pointer 事件 + `localStorage` 记忆位置），科幻**青蓝/电光蓝**半透明球（呼吸光晕 + 约 20 颗细碎发光粒子，拖拽时翻倍 + 拖尾光带加粗 + 沿路径飞溅星尘粒子）。点/拖区分用 `justDraggedRef`（拖动后不弹面板）；球体加 `outline-none` 去掉 Esc 后的 focus 硬边。粒子参数用固定种子 `mulberry32` 生成以保证 SSR 一致。
- 注意 eslint 规则 `react-hooks/set-state-in-effect`：不要在 effect 内同步 `setState`，用 `setTimeout` 异步设置。
- **SVG 坐标要取整**：`Math.cos` 在 Node 与 Chrome 浮点末位不同，会导致 SVG 属性 hydration mismatch（曾报 1 Issue）→ 坐标统一 `Math.round(n*1000)/1000`。
- 回忆详情页 `‹ ›` 切图按钮放在**图片外侧**（flex 行），不在图片内。
- 星星钻入迷雾调淡（核心 0.5 / 背景 0.3 / 光斑 0.4）并缩短到 200ms；种子「东京」补至 10 条用于演示滚筒与流光标。
- **弃用 shadcn，改最小依赖**：曾尝试 `shadcn init`，但它会重写 `globals.css`（去掉 `prefers-color-scheme: dark`、引入 base-ui 变量），使 `body` 变白 → 记忆页淡入淡出**闪屏**、星空/动画异常，遂整体回退。UI 基础改为 `@radix-ui/react-popover` + `@radix-ui/react-dialog` + `cmdk` + `clsx` + `tailwind-merge`，自写 `components/ui/{popover,dialog,combobox}.tsx`，**纯 Tailwind、绝不碰 `globals.css`**。
- **Dialog 内不要用 Portal 的 Popover**：Radix Dialog 的 focus trap 会拦截渲染到 `<body>` 的下拉，表现为「点不动/输不进去」。改为在 Dialog 内用**内联 cmdk 列表**。
- **AudioContext 与 React StrictMode 冲突**：dev 下 effect `mount→cleanup→mount` 双跑，cleanup 里 `ctx.close()` 后 ref 未置空 → 复用已关闭 ctx 抛 `InvalidStateError`（`Cannot close a closed AudioContext`）；且 `createMediaElementSource` 对同一 `<audio>` 只能调用一次，「关闭后重建」不可行。**音乐淡入淡出改用 `<audio>.volume` + `requestAnimationFrame`**（配 `playSeqRef` 播放序号防竞态）。
- **类别即地点**：上传表单只选一次「类别级联」（`CategoryPicker`：从地球逐级下钻，**任意层可选中、可新建**）；`location` 由类别路径自动生成（去根「地球」）。层级**含地球共 5 级**：地球→国家→省→市→用户自建；任意节点可挂回忆、可新建子级。
- **新建类别「延迟创建」**：弹层只生成草稿类别（id 前缀 `draft-`）加入本地列表，**提交上传时**才把选中类别链上的草稿从根到叶依次 `POST`，同级同名自动复用；未上传则不留痕（解决「新建后没上传留下空类别」）。
- **空类别可点击**：`CategoryStars` 把「可交互」与「视觉」拆开——所有星恒可点；视觉按 `memoryCount>0` 区分（有回忆=亮星+白粒子，空=暗星无粒子，但可点、hover 提亮）。
- **删除类别 = 遗忘**：`DELETE /api/categories/[id]?mode=purge|move`；根「地球」不可删；级联整个子树。`purge` 一并删回忆+媒体文件，`move` 把回忆迁移到父类别。入口在星空页右上角。
- **页面头部统一**：面包屑在左 + 下方 `← 返回`（**根「地球」页隐藏返回**）；右上角危险操作统一叫「遗忘」。
- **地理数据**：`world-countries`（国家中文名，250）+ `china-division`（省市）→ `npm run build:geo` 生成 `public/geo/{countries,china}.json`（共 ~16KB），前端懒加载，供新建类别候选（地球下=国家；中国下=省；中国省下=市）。

## P4 Agent 能力（进行中）
- **选型**：`ai@7` + `@ai-sdk/openai-compatible@3` + `zod@4`，**不用 `@ai-sdk/react`**（前端手写 SSE，零额外依赖）。`streamText` + `tools` + `stopWhen: isStepCount(8)`，多步工具调用由 AI SDK 自动完成；服务端遍历 `result.fullStream`（`text-delta`/`tool-call`/`tool-result`/`tool-error`/`error`）编码为 SSE。
- **SSE 事件协议**（自定义，简单）：`text`(delta) / `tool`(name,status) / `action`(客户端动作) / `memories`(卡片) / `error` / `done`。注意下发动作要包一层 `{type:"action", action:{...}}`，否则 `action.type` 会被内层覆盖。
- **Provider 收敛为 `deepseek | opencode-go`**；`baseURL`/`headers` 属内部适配**不暴露**给用户，用户只选服务 + 填 key + 选模型。OpenCode Go 需 `x-opencode-session`（按对话注入）与自定义 UA；其 `/models` 可匿名拉取。
- **密钥加密入库**：AES-256-GCM（`lib/crypto.ts`）；主密钥优先 `AGENT_SECRET`，本地回退自动生成 `data/secret.key`（600）。`GET /api/settings` 只回传掩码；`apiKey` 留空=不改、null=清除。换主密钥会导致旧密文无法解密。
- **设置面板**：可折叠区块（`SettingsSection`，首块「模型服务」默认收起），模型用 `Combobox` 搜索选择、默认选列表第一项；对话面板顶部显示「使用中：服务 · 模型」，设置内用绿点标「使用中」区分生效 vs 编辑；保存按钮文案「保存并启用」。
- **工具集**（`lib/agent-tools.ts`）：`searchMemories`（数据源）/`navigateToCategory`/`openMemory`/`uploadMemory`/`forgetMemory`/`forgetCategory`。删除类工具**二次确认双保险**：工具 `confirm` 参数 **且** 服务端校验「最后一条用户消息含确认词」才执行，未确认只返回待确认信息。
- **删除逻辑复用**：抽出 `lib/db/mutations.ts`（`deleteMemoryById`/`deleteCategoryById`/`collectSubtree`），API 路由与工具共用；类别含回忆时给 `move`/`purge` 选项。
- **前端动作**：`navigate`（星空页走迷雾过渡）/`openUpload`（切上传视图并预填）/`forgotten`（与按钮一致：当前正在看被删对象则回上一层，否则刷新）。导航请求经 `store.navRequest` 由 `StarfieldPage` 消费播放迷雾。
- **搜索卡片**：`memories` 事件；卡片**绑定到当前 assistant 消息**（不是全局 state，避免跨轮残留/错位），最多 3 条 + 「共 N 条」。曾因"服务端每次 tool-result 就下发、前端覆盖"导致卡片与文字错位 → 改为服务端聚合去重、`done` 前单次下发。prompt 要求：正文 2–3 句概括、**禁止逐条罗列**、一轮最多检索一次。
- **过渡性能**：去掉大尺寸 `filter: blur` 与 `mixBlendMode`（径向渐变本身够柔），光斑 5→3，加 `willChange`/`translateZ`，`scale 12→7`、时长 `0.1→0.18s`；星空 canvas 每 2 帧绘制 + `sceneTransitioning` 期间暂停。
- **用户偏好（重要）**：展示给用户的内容（卡片）应**由后端决定、前端只渲染**；希望**后端持有完整会话**（含工具消息），使模型能感知完整对话、灵活分批/过滤。因此 **Step 6 重定义为**：服务端会话真相源（messages 存完整 AI SDK 消息）+ 前端只渲染 + 卡片由后端决定/分页 + `HistoryPanel`（多会话、多选删除、一键清空）。
- **已知限制**：`searchMemories` 只支持关键词/类别（含子树）/日期，不支持"排除子类别"，故"不在云南的"这类需求需靠模型检索后自行过滤（新架构下由 `showMemories` 由模型显式指定展示项解决）。
- 调试用 CDP 脚本在 `/var/folders/.../T/opencode/`（`cdp_chat/cdp_tools/cdp_forget/cdp_cards` 等）；注意 dev 重编译瞬间可能 `ERR_CONNECTION_REFUSED`，reload 即可。

## Step 6：服务端会话真相源（已完成）
- **架构**：后端持有完整会话，前端只渲染。`/api/agent` 入参 `{ conversationId?, text, categoryId? }`；自动建会话（标题=首条文本截断 20 字）并用 SSE `meta` 事件回传 id/标题；前端只发 `conversationId + text`。
- **消息持久化**：`messages` 表 = `content`（可读文本，供历史 UI）+ `data`（完整 AI SDK 消息 JSON，含 `tool-call`/`tool-result`，回灌模型）+ `cards`（助手消息的卡片，供历史重开重现）。落库用流结束后的 `await result.responseMessages`，与 user 消息一起 `addMessages`。
- **卡片由模型决定**：新增 `showMemories({ memoryIds, total })` 工具——模型检索、过滤后**显式列出**本批要展示的 id（服务端 `slice(0,3)` 兜底），并下发 `memories` 事件；`searchMemories` 降为纯数据源、不再产生卡片。模型因能"看到完整会话（含历史工具结果）"，分批时能避开已展示的 id——实测"继续"能给出**不重复**的下一批。
- **prompt**：检索时一轮最多一次 `searchMemories`；正文 2–3 句概括（数量 + 时间/地点/主题），**禁止逐条罗列**；>3 条时先给 3 条并提示"共 N 条、还有 X 条，说『继续』"；附正/反例。
- **前端**：`ChatPanel` 以后端为准，`localStorage['sprite:conversationId']` 记住当前会话，打开面板自动拉历史；`HistoryPanel` 提供列表/切换/多选删除/清空（Dialog 确认）/新对话；删除当前会话时自动回到空白对话。
- **踩坑：Next 16 dev 用 `127.0.0.1` 访问会阻止开发资源**（`/_next/hmr` 等报 "Blocked cross-origin request"），结果 **React 不 hydrate、所有点击/事件失效**（DOM 是 SSR 静态、元素上没有 `__react*` 属性），极易误判为"组件坏了"。**必须用 `http://localhost:3000` 访问**，或给 `next.config` 加 `allowedDevOrigins: ['127.0.0.1']`。判断 hydration 是否正常：检查元素是否有 `__reactProps$...` 属性。
- **踩坑：`drizzle-kit push` 对 SQLite 加列会报 `no such column: "data"`**（drizzle-kit 的双引号问题）。规避：手动 `DROP/CREATE TABLE`（无有效数据时），再 push 验证无差异。
- **性能观察**："中国里不在云南的"这类多步任务，`deepseek-v4.1-flash` 约 42s（多次 searchMemories/showMemories，接近 `stopWhen` 上限）；后续可优化 prompt 减少检索轮次。
