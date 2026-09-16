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
- P3 已完成：`store/sprite.ts`（zustand）、`components/sprite/{Sprite,ActionBar,ChatPanel,MemoryForm}.tsx`（`MemoryForm` 由 `UploadMemoryForm` 重构而来，支持新建/编辑）、`api/categories`（GET）、`api/memories`（POST multipart 上传，落盘 `media/uploads/`）；`layout.tsx` 已挂载 `<Sprite />`。对话为本地模拟流式（P4 接真实 LLM）。
- P4 已完成：见下方「P4 Agent 能力（已完成）」。
- Phase 1（Agent 准确性与体验）✅、Phase 2（移动端适配）Step 1–6 ✅，见文末两节。
- 细节打磨（回忆编辑/裁剪/标题限字/历史批量删除确认/面板拖动/快捷键守卫）✅，见文末「细节打磨」节。
- **下一步**：E 打磨，范围已裁剪为 **E1 ✅ → 搜索(原 E5+E6) ✅ → E4 → E9**（E2/E3/E7/E8 **不做**；命名与视觉附件留待单独阶段，见 `PLAN.md §15`）；B/C/D 部署与上线由用户在另一台机器完成。

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

## P4 Agent 能力（已完成）
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
- **踩坑：Next 16 dev 用 `127.0.0.1` 访问会阻止开发资源**（`/_next/hmr` 等报 "Blocked cross-origin request"），结果 **React 不 hydrate、所有点击/事件失效**（DOM 是 SSR 静态、元素上没有 `__react*` 属性），极易误判为"组件坏了"。**当前解法**：`dev` 脚本固定 `next dev -H 127.0.0.1`，浏览器一律用 `http://localhost:3000`（同时避免了内网暴露）。替代方案是给 `next.config` 加 `allowedDevOrigins: ['127.0.0.1']`，但**它不是安全边界**。判断 hydration 是否正常：检查元素是否有 `__reactProps$...` 属性。
- **踩坑：`drizzle-kit push` 对 SQLite 加列会报 `no such column: "data"`**（drizzle-kit 的双引号问题）。规避：无有效数据时手动 `DROP/CREATE TABLE`；**有数据时手动 `ALTER TABLE ... ADD COLUMN`（+ `UPDATE` 回填）**，再 push——报 `No changes detected` 即同步成功（`memories.created_at` 即此法）。
- **性能观察**：Phase 1 优化前，"中国里不在云南的"这类多步任务约 42s（多次 searchMemories/showMemories，接近 `stopWhen` 上限）；补 `location` + 收紧 prompt 后降至约 13.5s。

## 1.0 上线路线图（已定，见 PLAN.md §13）
- **部署方案**：家里另一台 **Windows x86 + Docker(WSL2)** 常开机器 + **Cloudflare Tunnel**（自购域名托管 CF，不用 Vercel——需 SQLite 持久化 + 本地媒体 + 长流式请求）。
- **访问保护**：**应用内密码**（middleware + 登录页 + 签名 cookie），不用 Cloudflare Access。
- **数据**：部署机与开发机都**重新 seed**，不迁移 `data/`（因此 API Key 需在新机重填）。
- **手机端 1.0 范围**：导航/看回忆/上传/对话/历史。
- **Phase**：1) Agent 优化（✅ 补 `location`、减检索轮次、空文本兜底、停止按钮、SSE 重试、回复去重）→ 2) 移动端适配（Step 1–5 ✅：底部抽屉、触控、双轨布局、详情页固定底栏 + 滑动切图；Step 6 待做：降载/回归/全流程）→ 3) 部署改造（`MEDIA_ROOT` 可配、密码保护、`output: standalone`、`/api/health`、Dockerfile+compose）→ 4) Windows 上机 + Cloudflare（域名/隧道/SSL/自启/手机验收）→ 5) 维护备份。
- **工作方式调整**：用户将**手动把项目上传到 GitHub 私有仓库**，然后**转移到另一台 Windows 电脑上继续开发**；**Phase 1 由用户在新机上进行**（我在本机先完成文档 + 迁移修复）。
- **迁移修复（已做）**：① `data/.gitkeep` + `src/lib/db/index.ts` 在连接前 `mkdirSync` 兜底（原来 `/data` 整体被忽略，新机 clone 后无目录会打不开 DB）；② `.gitattributes`（`* text=auto eol=lf` + 二进制媒体标记）；③ `.env.example`（`.gitignore` 加 `!.env.example`）；④ `.gitignore` 改 `/data/*` + `!/data/.gitkeep`。
- **迁移注意**：新机装 Git + Node 24；`npm ci`（`better-sqlite3` 若报编译错需装 VS Build Tools）；`.env` 需手动建；**dev 脚本固定 `-H 127.0.0.1`，浏览器用 `http://localhost:3000`**（Next 16 用 `127.0.0.1` 会拦开发资源导致 React 不 hydrate）；`data/` 与 `media/uploads/` 不入库。
- **GitHub 上传提醒**：只上报 `git` 能跟踪的内容；**不要用网页拖拽上传**（不受 `.gitignore` 保护，会带上 `data/`、`.env`、`node_modules`）；仓库设 **Private**；项目无大文件，无需 LFS。

## Phase 1：Agent 准确性与体验优化（已完成）
- **回复重复修复**（`3f8361e`）：根因是 AI SDK 多步流程中，工具调用**前**模型会先输出一句预告文本，与最终答案重复。解法：按 `start-step`/`finish-step` 做**步骤级文本缓冲**，**仅下发「未调用工具」的最终步骤文本**；落库 `content` 对含工具调用的消息置空；`/api/conversations/[id]` 过滤「无 content 也无 cards」的 assistant。
- **「这里/这片星空」绑定当前类别**（`3ae0bd5`）：把当前 `categoryId` 注入 prompt，模型据此检索当前子树。实测「中国」页 5 条、7.5s。
- **`searchMemories` 补 `location`（+ 类别名）**、`limit` 默认 20 / 上限 50；prompt 收紧为「一轮最多检索一次、先尽量查全再过滤」；助手空文本兜底；流式期间「停止」（`AbortController`）+ 发送中锁定历史切换；SSE 断开/超时提示与重试。
- **图片懒加载**：回忆缩略图/详情图 `loading="lazy"` + `decoding="async"`。
- **dev server 绑定 `127.0.0.1`**（`fdba254`）：`dev` 脚本改 `next dev -H 127.0.0.1`。动机：原监听 `*:3000` 且 macOS 防火墙关闭 → 同网段可读数据 / 调用 `/api/agent` 白嫖 AI 额度 / 删数据。**`allowedDevOrigins` 不是安全边界。**
- 效果：同类多步检索 42s → **13.5s**。

## Phase 2：移动端适配（Step 1–5 已完成，Step 6 待做）
- **统一「双轨」布局（已与用户确认，见 PLAN.md §13.3）**：宽屏（≥640px）= 上下**两行横向**轨道；窄屏 = 左右**两列纵向**轨道；手机横屏（矮容器）自动横向 + 紧凑/迷你卡片。每轨容量 `min(几何容量, 3)` → 阈值 6：`n ≤ 6` **平铺**（格内随机偏移 + 轻微旋转 + 缓缓浮动 + 第 2 轨错开半卡），`n > 6` **流动**（大半径滚筒 `R=max(长边×2.5,1200)`、仅渲染可见 + 屏外缓冲、两端 CSS mask 渐隐、随机起点、由旧至新、拖拽 + 惯性）。1 段居中、2 段间距 `1.5×卡宽`。
- **卡片尺寸**：常规 200×140，紧凑 150×105，迷你（横屏）120×84；`FLOW_SPEED=12px/s`、`CARD_CAPTION=26`、`RADIUS_FACTOR=2.5`。`layout-seed.ts` 现导出 `TRACK_GAP=24`/`RAIL_MAIN=140`/`RAIL_MAIN_COMPACT=64`/`RAIL_CROSS=56`/`PER_TRACK_MAX=3`/`trackCapacity`/`trackCrossPositions`/`tileJitter`/`flowTilt`（已删 `gridScatter`/`timelineScatter`）。
- **Step 1 地基**（`898bca4`）：`layout.tsx` 导出 `viewport`（`viewport-fit: cover`、`themeColor #05060a`、`interactiveWidget: "resizes-content"`）；`globals.css` 加 `--safe-*` 变量、`touch-action: manipulation`、`overscroll-behavior-y: none`、`-webkit-tap-highlight-color: transparent`、`body min-height: 100dvh`；全站 `h-screen`/`min-h-screen` → `h-dvh`/`min-h-dvh`。
- **Step 2 底部抽屉**（`fc3d586`）：新增 `use-media-query.ts`（`MOBILE_QUERY="(max-width: 639px)"`、`useMediaQuery`/`useIsMobile`，用 `useSyncExternalStore`）；`Sprite` 窄屏改底部抽屉（`h-[min(78dvh,560px)] w-full rounded-t-2xl pb-[var(--safe-bottom)]`、遮罩 z-[65] 点击关闭、面板 z-[70]）、锁 body 滚动、悬浮球避让安全区。
- **Step 3 面板窄屏化**（`36e7aba`，10 文件）：输入框 `text-base sm:text-sm`（**防 iOS 聚焦放大**）、主按钮 ≥44px、次要控件 ≥36px、`enterKeyHint="send"`、`DialogContent` 加 `max-h-[85dvh] overflow-y-auto`、`ActionBar` 窄屏三等分。
- **Step 4 星空页**（`9e20e17` + `d72d583`）：新增 `use-element-size.ts`（`useElementSize`）与 `VerticalTimelineRail`；星距随容器收敛；窄屏纵向滚筒（`rotateX`、上下拖拽、背面剔除、自动上滚 1.5°/s）；纵向星轨在左、**上旧下新**、光标对齐弧线、竖短横长十字星芒；横竖滚筒均剔除背面卡片（带淡出）；手机横屏紧凑布局。
- **双轨统一重塑**（`67c9ffb` + `40fbedf` + `d031bb2`）：`MemoryCylinder.tsx` 重写为「`MemoryCylinder` 判定 + `TileBoard` + `FlowTracks`」；`memories.created_at` 加列（无日期时排序用；`listMemoryCards` 排序改 `date ?? dayOf(createdAt)`）；`api/memories` 写 `createdAt: Date.now()`；星轨占位避让、每轨 ≤3 张稀疏化、平铺偏移限制在格内并双轨交错、横屏迷你卡片 + 星轨压缩；图片预热（缓冲 `max(step, 屏长×0.25)` + `loading="eager"` + 加载淡入 + `img.complete` 命中处理）；新增 `scripts/seed-demo.mjs`（`npm run seed:demo` / `seed:demo:clean`）。
- **Step 5 详情页**（`76ba34a`）：`PlayButton`（▶/❚❚ + 呼吸光晕，`failed` 红框提示）、**移除自动播放**；左右滑动切图（`|dx|>40 且 |dx|>|dy|×1.5`）；header/main 窄屏 padding + 安全区；标题响应式；背景图 `blur-sm → blur-xs` + `draggable={false}`；**窄屏 fixed 底栏 `grid grid-cols-3`**（‹ / ▶ / › 同水平线）；`Sprite` 窄屏默认球位置上移 64px 避开底栏（effect deps 加 `isMobile`）。
- **Step 6（待做）**：移动端降载（`StarBackground` 当前 `dpr = min(devicePixelRatio, 2)`、星数 `min(420, 面积/9000)`、每 2 帧绘制 → 窄屏 `dpr ≤ 1.5` 并按机型下调星数；小精灵粒子/星尘减半；尊重 `prefers-reduced-motion`）+ 桌面 1440×900 回归 + 375px 全流程验证（导航→详情→对话→上传→历史）。
- **用户偏好（移动端）**：详情页**不要自动播放**（宽窄屏都手动）；窄屏用**固定底栏**放 ‹/▶/› 且三个按钮同水平线；支持**左右滑动切图**。
- **踩坑**：
  - **安全区 / 视口高度**：`--safe-*` 变量 + `100dvh`（不要 `100vh`，移动端地址栏会裁切）；`h-screen` 一律换 `h-dvh`。
  - **`prefers-reduced-motion` 未覆盖**：降载时要一并处理（Step 6）。
  - **`useSyncExternalStore` 做媒体查询**：避免 effect 内 `setState` 触发 `react-hooks/set-state-in-effect`；`useElementSize` 用 `setTimeout` 延迟初始化规避同一规则。
  - **交叉方向必须避让星轨占位**（`RAIL_MAIN`/`RAIL_CROSS`），否则卡片与星轨重叠。
  - **每轨 ≤3 张**并用「格内空隙 × 0.9」限制偏移；曾因副本偏移恰好一圈导致 3 倍冗余重叠、流动随机相位打乱均匀分布导致重叠（均已修）。
  - **`seed:demo` 只动 demo 分支与 `media/seed/dm_*.svg`**，真实数据不受影响；覆盖 1/2/5/6/7/100 段用于验证平铺/流动阈值。
  - 验证入口：`http://localhost:3000/star/globe` → 「测试数据」。

## 细节打磨：回忆编辑等（已完成）
- **编辑入口只走小精灵面板**（沿用「操作统一走小精灵」约定）：详情页 header「编辑」按钮、Agent 工具 `openEditMemory` 都只切到 `store.view="edit"` + `editMemoryId`。表单组件 `MemoryForm`（`mode: create|edit`）取代 `UploadMemoryForm`；编辑态先 `GET /api/memories/[id]` 回填。
- **API**：新增 `GET`/`PATCH /api/memories/[id]`。`PATCH`（multipart）字段：`title/categoryId/date/description/location`、`keepImageIds`（有序 JSON）、`coverRef`（现有 mediaId 或 `new:<index>`）、`removeAudio`、`images[]`、`audio`。图片顺序 = 保留旧图（按 `keepImageIds`）在前、新增在后；音乐有新媒体即替换、`removeAudio=1` 即删除。公共上传逻辑抽到 `src/lib/media-upload.ts`（`saveUpload`/`validFiles`/`mediaTypeOf`/`extOf`）。
- **`coverMediaId` 新增字段**（`memories`，可空；手动 `ALTER TABLE` + 回填无需，`drizzle-kit push` 报 No changes 即同步）。封面解析：显式封面（若仍在）→ 否则首张；**删除当前封面自动退回首张**；无图则 `null`。`coverRef` 用 `new:<i>` 指代本次新上传图片、用 mediaId 指代现有图片。
- **标题长度按显示宽度**（`src/lib/title-limit.ts`）：汉字/全角/emoji=2、英数/半角=1，上限 **40 半角（20 汉字 / 40 字母）**；表单实时计数 `n/20 字` + 超限禁提交，POST/PATCH 服务端二次校验。
- **迁移类别**：编辑表单改类别即可；Agent 新增 `moveMemory` 工具，**双保险二次确认**（`confirm` 参数 + 服务端校验最后一条用户消息含确认词），迁移后重算 `location`、下发 `moved` 动作刷新页面。
- **历史对话多选删除**补二次确认弹层（此前只有「清空全部」有）；`HistoryPanel` 用 `confirmBatch` 状态复用 Dialog 模式。
- **宽屏小精灵面板可拖动**：标题栏 `onPointerDown` 拖动（标题栏上的按钮不触发），手动拖过后与球解耦；**位置仅存内存、不持久化**，刷新复位；窄屏抽屉不变。
- **踩坑（重要）：framer-motion 会把 `style` 里的 `x`/`y` 当成 transform，而不是 CSS 的 left/top。** 面板定位必须用 `left`/`top`（曾把 `derivedPanelPos` 写成返回 `{x,y}`，结果面板 `transform: translateX(...)`、`top` 失效贴到 0，拖动表现诡异）。已用 `type Box = { left; top }` 区分。
- **踩坑：编辑类测试不要拿真实 seed 数据做破坏性验证。** `keepImageIds` 会过滤掉不属于该回忆的 media id（安全设计），我曾误用另一条回忆的 media id 做 PATCH，导致 `kept=[]` → 把该回忆媒体全删且 location 被清空。恢复办法：`scripts/seed.mjs` 是 `DELETE` 全库重建，**不能直接重跑**；需按 seed 定义单独恢复（临时脚本重生成 `media/seed/*.svg|wav` + 重建 media 行）。**此后一律新建一次性测试回忆做 PATCH/编辑验证**。
- **描述多行显示**：详情页描述 `<p>` 必须用 `whitespace-pre-wrap`（**不要用 `pre-line`**，它会折叠前导空格，ASCII 画会错位）；`memory.description` 存的是含 `\n` 的原文。
- **标题/描述不能 trim**：POST/PATCH 曾对整串 `.trim()`，把描述开头的缩进吃掉了。现改为原样保存，必填校验才 `trim()` 判空。注意：**用 `curl -F` 测带首尾空白的字段会误判**（curl 自己会去掉值两端空白），要用 `--form-string` 才准确。
- **图片裁剪（焦点 + 缩放，object-position + transform）**：`media.focal_x/focal_y`（%）+ `crop_scale`（100–600，默认 100）。共享 `src/lib/crop.ts` 的 `coverStyle(crop, baseline)` 同时用在**瓷砖 / 卡片 / 详情主图 / 详情背景(叠 1.05) / 裁剪弹窗**，保证所见即所得。表单瓷砖：**单击=设封面**（延迟 230ms）、**双击=弹裁剪框**（`CropDialog`：固定 3:2 框，拖动平移按溢出比 1:1 跟手，滚轮/双指捏合/滑杆缩放，重置）。提交 `newFocal`（与 `images` 同序 `[{x,y,scale}]`）/`imageMeta`（有序 `[{id,x,y,scale}]`）；服务端 clamp x/y 0–100、scale 100–600。改图不改原文件。
- **卡片比例统一 3:2**（`CARD_NORMAL {200,133}` / `COMPACT {150,100}` / `TINY {120,80}`），与详情页一致。表单里新选文件的预览用 `URL.createObjectURL`，在 effect 里同步到 ref、卸载时 `revokeObjectURL`（不能在 render 里写 ref，会被 `react-hooks/refs` 拦）。
- **`CropDialog` 不能把「打开时用外部值重置」写成 effect**（会触发 `react-hooks/set-state-in-effect`）。做法：父组件 `{cropOpen && <CropDialog .../>}` 按需挂载，子组件用 `useState(() => clampCrop(value))` 初始化，关闭即卸载。
- **3D 滚筒里 `getBoundingClientRect()` 因透视/旋转失真**，验证卡片布局比例要看 `getComputedStyle`/offset 尺寸，别看 rect。
- **踩坑：全局快捷键不能无差别处理**。`MemoryScene`（←/→ 切图、空格播放、Esc 返回）与 `StarfieldPage`（Esc 上级）都用 window `keydown` + `preventDefault()`，导致在 `/memory/[id]` 用小精灵面板输入时 ←/→ 无法移动光标、**空格被拿去播放/暂停音乐（打不出空格）**、Esc 误返回。已抽象 `src/lib/dom.ts` 的 `shouldIgnorePageShortcut(e)`：目标在 `input/textarea/select/[contenteditable]` 内、存在 `[role="dialog"]`、或 `useSpriteStore.getState().open` 时忽略快捷键。

## Phase 2 Step 6：移动端降载（已完成）
- **`StarBackground`**：在 effect 内用 `matchMedia` 判断（绘制循环不能用 hook）——窄屏 `dpr ≤ 1.5`（桌面 ≤2，**canvas 像素数是手机端最大开销**）、星数上限窄屏 220、`prefers-reduced-motion` 时**只画一帧**（不启 rAF、不监听 mousemove 视差）、`document.hidden` 时跳过重绘。
- **`Sprite`**：`useMediaQuery("(prefers-reduced-motion: reduce)")` → 关呼吸光晕/球体的无限动画、不生成常驻粒子与拖拽拖尾/星尘；窄屏常驻粒子 20→10、星尘 1 颗。
- **`MemoryCylinder`**：平铺卡片的浮动动画（`animate x/y repeat:Infinity`）按 reduce-motion 关闭（`FlowTracks` 自动上滚本就已关）。
- **`MemoryScene`**：reduce-motion 下进退场**直接切换**——`motion-reduce:animate-none` + `handleBack` 里直接 `router.push`（**不能只依赖 `animationend`，动画被禁用时不会触发，会卡住不返回**）。
- **验证口径**：`prefers-reduced-motion` 用 CDP `Emulation.setEmulatedMedia` 切换；判定星空是否在动用「对 canvas `getImageData` 求校验和，间隔采样两次是否相等」。窄屏 dpr 看 `canvas.width / clientWidth`。全局快捷键/动画名看 `getComputedStyle().animationName`。
- **结果**：窄屏 dpr 1.5、桌面 2；reduce 静态 / normal 闪烁；`5/7/100 段` 卡片均 3:2；100 段仅渲染 10–12 张；1440/375 无横向溢出；控制台无报错；窄屏裁剪弹窗 353×391 适配 375。
- **下一步（E 打磨）**：范围已裁剪为 **E1 ✅ → 搜索(原 E5+E6) ✅ → E4 → E9**（E2 每图 caption、E3 多音乐、E7 批量导入、E8 精灵形象/语音均**不做**；命名与 favicon/OG 留待单独阶段），详见 `PLAN.md §15`。**B/C/D（部署改造、Windows+Cloudflare、维护）由用户在另一台机器执行。**

## 搜索（原 E5+E6，已完成）
- **一套内核两个入口**：`src/lib/memory-search.ts`（`collectMemories` / `buildCategoryPaths` / `searchMemories`）。**Agent 的 `searchMemories` 工具与 `GET /api/memories/search` 调同一个函数**——否则「对话能搜到、面板搜不到」这类漂移迟早出现。默认 30 条、上限 100。
- `queries.ts` 抽出 **`attachCovers(mems)`**（`listMemoryCards` 复用）：显式 `coverMediaId` → 失效回退首图 → 无图 null。新增「带封面列表」的场景一律复用它，别重写。
- **共享卡片** `src/components/memory/MemoryListItem.tsx`：`variant="compact"`（对话，无封面时**不渲染缩略图占位**，兼容历史消息）与 `"full"`（搜索面板）共用；`showMemories` 工具补 `cover`/`location`/`category`，`agent/route.ts` 的 `CardItem` 同步扩展（消息 `cards` 是 JSON，旧数据缺字段要能降级）。
- `ActionBar` 标签用**短词**（上传/搜索/对话/设置）：窄屏 4 个按钮时「上传回忆」会换行，把 ActionBar 撑成两行。
- **验证教训（补充）**：真实坐标点击时注意 **Next.js 开发指示器（`NEXTJS-PORTAL`）会盖住右下角的悬浮球**，`elementFromPoint` 命中的是它而非球。做法：采样球体上的多个候选点（中心 / 左上 / 上 / 左…），用 `elementFromPoint().closest('button[aria-label="小精灵"]')` 找到真正可点的那个再点击。生产环境无此问题。

## E1 分类树重命名 / 移动（已完成）
- `PATCH /api/categories/[id]`（body `{name?, parentId?}`）五道校验：根「地球」不可改 / 目标父级存在且非自身 / **防环**（目标父级 ∈ 自身子树 → 400）/ **深度**（`depth(新父) + 子树高度 ≤ 5`）/ 目标**同级重名** → 409。移到新父级时 `sortOrder` 追加到同级末尾。
- `updateCategory` + **`resyncSubtreeLocation`**：`location` 由类别路径派生（去掉根「地球」），改名/移动后**必须重算子树内全部回忆的 location**，否则详情页与面包屑不一致。实测父级改名也生效（`E1R / E1S` → 父改名 → `E1R-改名 / E1S`）。
- UI `CategoryEditDialog`（复用 `dialog.tsx` + `combobox.tsx`）：父级候选**排除自身子树**（防环在 UI 侧也挡一道）。
- **踩坑：URL 用类别 id 组成**（`/star/[...path]` 的 path 是 id 数组），所以**移动父级后当前 URL 失效**（面包屑与 `← 返回` 会错）。解决：对话框保存后由客户端用已拉取的类别表拼出新完整路径并 `router.push`；仅改名则 `router.refresh()`（改名不改 URL）。
- **踩坑（重要约定）：不要在 Radix Dialog 内使用 Portal 型 `Popover`/`Combobox`**。实测三重问题：① `PopoverContent` 的 `z-[80]` 低于 `DialogContent` 的 `z-[91]`，浮层被弹层盖住点不到（`elementFromPoint` 在候选项上返回的是弹层）；② Radix Dialog modal 会给 `body` 设 `pointer-events: none`（wrapper 继承 `none`）；③ 焦点陷阱与 cmdk 输入框冲突（`new-category-dialog.tsx` 的注释早就写了这点）。**改用弹层内的「内联可折叠 cmdk 列表」**（见 `CategoryEditDialog`：按钮切换 `pickerOpen`，展开时在弹层内渲染 `Command` + `Command.Input` + `Command.List`，`max-h-52 overflow-y-auto overscroll-contain`）。列表较长时在标签上标注「（共 N 项）」，避免「看起来只有 4 项、其实还能滚」的错觉。
- **验证教训：JS `.click()` 会绕过层叠顺序**——正是它让 E1 首轮 UI 测试「通过」却漏掉了下拉被遮挡的 bug。UI 验证必须用 CDP **真实坐标点击**（`Input.dispatchMouseEvent` 的 mousePressed/Released，移动端用 `Input.dispatchTouchEvent`），列表项不可见时先用 `mouseWheel` / touchMove 滚动到可视区再点；用 `document.elementFromPoint()` 断言某点是否真的命中目标元素（被遮挡时返回的是遮挡者）。

