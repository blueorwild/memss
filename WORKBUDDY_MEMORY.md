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
- **下一步**：E 打磨，范围已裁剪为 **E1 ✅ → 搜索(原 E5+E6) ✅ → E4 ✅ → E9 ✅**（E2/E3/E7/E8 **不做**；命名与视觉附件留待单独阶段，见 `PLAN.md §15`）；B/C/D 部署与上线由用户在另一台机器完成。

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
- **下一步（E 打磨）**：范围已裁剪为 **E1 ✅ → 搜索(原 E5+E6) ✅ → E4 ✅ → E9 ✅**（E2 每图 caption、E3 多音乐、E7 批量导入、E8 精灵形象/语音均**不做**；命名与 favicon/OG 留待单独阶段），详见 `PLAN.md §15`。**B/C/D（部署改造、Windows+Cloudflare、维护）由用户在另一台机器执行。**

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


## E4 详情页图片放大 / Lightbox（已完成）
- 新 `src/components/memory-scene/ImageViewer.tsx`：`object-contain` 看**完整原图**（不做焦点裁剪）；滚轮（**以光标为锚点**：换算 `k = next/scale` 后调整 translate）/ 双指捏合 / 双击（1↔2.5 倍）缩放，放大后拖动平移（按容器尺寸夹紧），未放大时横向滑动或 ←/→ 切图，Esc / 点图片外留白 / ✕ 关闭。
- 详情主图**单击**打开：与既有左右滑动复用同一组 pointerdown/up，**位移 < 8px 判为点按**（不要另加 onClick，否则滑动后也会触发）。组件以 `key={图片 id}` 挂载 → 切图即重置缩放与位移，**避免在 effect 里 setState 触发 lint**。
- **与页面快捷键的冲突靠约定解决**：Lightbox 容器加 `role="dialog"`，`shouldIgnorePageShortcut` 会让详情页的 ←/→ 切图、空格播放、Esc 返回全部失效，改由查看器自己处理（实测 Esc 关闭后 URL 不变，不会误返回上级）。
- **踩坑（重要）：触摸点击会在 `pointerup` 之后再补发一次「合成 click」**，落点若在该时刻新出现的元素上，会立刻触发它的 onClick——表现为「点开查看器又瞬间关闭 = 点了没反应」。解决：组件记录打开时刻，`< 400ms` 的空白点击一律忽略。（排查手段：给容器挂监听收集 pointerdown/pointerup/click 事件序列，会看到只有 pointerup、合成 click 落到了新挂载的遮罩上。）
- 顺便修的细节：控件在**亮色图片**上会看不清 → 计数/提示用 `bg-black/40 backdrop-blur` 小胶囊、按钮改 `bg-black/40`；上传/编辑表单的 `<input type="date">` 补 `[color-scheme:dark]`，日历图标才与搜索框一致显示为白色（默认在暗色下几乎不可见）。

## E9 主题色 token 化 + 调色（已完成，E 打磨全部收尾）
- **约定：颜色一律在 `src/app/globals.css` 的 `:root` 里以「空格分隔的 RGB 分量」定义**（`--accent: 124 196 255`），不要写 hex。这样 CSS / React 内联样式 / SVG 都能用 `rgb(var(--accent) / 0.35)` 叠透明度；若存 hex 就只能在 CSS 里用，透明度得再写一套 rgba 字面量。`@theme inline` 里用 `--color-x: rgb(var(--x))` 映射成 Tailwind 类（`bg-accent`、`bg-accent-deep/80`、`text-warm`、`border-accent`…）。
- **双强调色语义（已固化）**：冷蓝（`--accent` / `--accent-deep`）= 交互与导航（按钮、选中、小精灵）；暖金（`--warm` / `--warm-glow`）= 时间与回忆（日期点、时间轴）。新 UI 选色先按这个语义，别再引入第三种主色（原先 CTA 是 Tailwind `indigo-500`，与精灵的 `#7cc4ff` 不同族，已统一）。
- **CSS 是唯一来源，JS 只是读取**：canvas 拿不到 CSS 类 → `src/lib/theme.ts` 的 `readTheme()`（`getComputedStyle` 读同一批变量）+ `rgba(token, a)`，`FALLBACK` 仅作读取失败的兜底。**内联样式里不要走它**，直接写 `rgb(var(--x) / a)` 更简单（`Sprite` 的球体/拖尾就是这样）。
- **SVG 的 `stopColor` 属性**用 JSX `style={{ stopColor: "rgb(var(--sky-beam) / 0.72)" }}`（presentation 属性对 CSS Color 4 语法支持不稳，放 style 里稳）。
- **暗色唯一形态**：删掉了 `prefers-color-scheme` 分支，`--background` 直接指向 `--sky-void`。星空隐喻下不做浅色模式。
- 星云原来是两团 alpha `0.18/0.14` 的径向渐变，叠在近黑底上**实测几乎不可见**（这也是「明明写了星云却看不到」的原因）。加强时把渐变终点写成「同色 0 透明度」而不是 `transparent`，否则中间会发灰。

## 交付前微调（第二轮，已完成）
- **二次确认：不再用关键词表**。原先 `route.ts` 里的正则（`/(确认|确定|同意|…)/`）有两个毛病：不认「是的 / 可以 / 嗯」→ 感觉死板；含「删除」二字又会让「首句祈使句」直接算同意 → 隐患。**现方案**：语义判断交给模型（`confirm`），服务端只加一层**上下文要求** `consentAsked`——**上一轮工具真的返回过 `needConfirm`（即小精灵问过一次）才认 `confirm=true`**，且**一次性**（执行即消费；本轮没问就清掉）。这样首句「把它删了吧」无论语气多确定都过不去，模型必须先复述再问一次。
- **重要教训**：去掉硬闸门后，**纯靠 prompt 时模型会把「…吧」当成同意当场删除**（实测第 1 轮就删了）。所以「必须先问过」这层上下文校验不能省——它不依赖任何关键词，和「让模型理解语义」并不冲突。改动这类安全逻辑后**一定要真跑一轮 Agent 验证**（构造一次性回忆 → 提出删除 → 看到的确实是不删+先问 → 再回「是的」→ 才删；再测「先别删」不被误删）。
- `ChatPanel` 顶部细条（`使用中：模型` 那行）右侧现在是 `＋ 新对话 | 历史`；`newConversation()` 无损（旧会话留在历史，下次发消息才落新会话）。
- **降载口径统一宽窄屏**：`StarBackground` 的 `MAX_DPR=1.5`、`STAR_CAP=220`；`Sprite` 常驻粒子 10、拖尾星尘 1。窄屏无变化，宽屏 canvas 像素 -44%（Retina 星点略软，可接受）。
- 星云最终值：冷蓝 `0.22`（左上）+ 暖紫 `0.17`（右下）**两团**，第三团冷青已删（`--sky-nebula-3` token 一并移除）。0.18/0.14 看不见、0.35/0.28 太显眼，0.22/0.17 是实测的折中。
- **「⋯」更多菜单用内联实现，不用 Portal 浮层**（`src/components/ui/more-menu.tsx`）：弹层类组件的层叠问题（z-index 低于弹层 + Radix Dialog 给 body 设 pointer-events:none + 焦点陷阱）已经踩过，菜单这类小浮层就地绝对定位最稳。打开时 Esc **在 `document` 捕获阶段** `stopPropagation()`，这样只关菜单、不会触发页面级的 Esc（返回上级 / 返回星空）。
- 返回按钮统一用 `src/components/ui/back-button.tsx`（弯曲左箭头 SVG，无文字）；「新建对话」只在对话页顶部细条，历史面板不再重复入口。

## 小精灵造型替换（方案 A，2026-09-16）

- **决策**：小精灵从「56px 发光蓝球」换成外部资源包的白色线稿角色，采用**只取美术、宿主保留全部交互**的方案——资源和包里的拖拽内核 / 定位层 / `margin`·`zIndex` props / `all: unset` 全部不采用（宿主已有更完整的：位置持久化、`--safe-bottom` 避让、点击开面板、拖尾粒子）。直接采用包的整套会**功能倒退**（刷新复位、窄屏压底栏、点击无反应）。
- **美术以「资源包」形式迭代**：用户会在别处做新造型与新动作（眨眼、天线摆动等），交付形态形如 `src/components/xiaoriyue-drag/`（`PetArt.tsx` + `PetArt.module.css`）。接口契约写在同目录 **`SPEC.md`**，改包前先看它。契约核心：包**纯展示**（不定位/不 portal/不监听事件/不读 window）；尺寸由宿主决定；必须声明 `FRAME` 与 `CHAR`（角色主体包围盒，宿主靠它算命中区与避让）；分组用稳定 id（`pet-character`/`pet-body`/`pet-eye-left`…）且不得改名；颜色只允许 `currentColor` 与 `var(--pet-glow)`；倾斜由宿主写 `--pet-angle`、包内施加到 `#pet-character`。
- **悬停在角色上的两个换算**：`PET_H = 80`（角色视觉高度，桌面移动一致）→ 外框 `115.8×102.6`、主体 `105.8×80`；`PET_W/PET_BOX_H/BODY/CORE/HIT` 全部由 `FRAME/CHAR` 推导，改包只需改 `PetArt.tsx` 的两个常量。已核实 ±6° 倾斜不裁切。
- **「角色不出现在面板区域」的实现语义**（用户定的）：拖**角色**时面板是静态障碍（角色顶住边界）；拖**面板**时面板**挤开角色**（角色被推走，只改内存位置、**不写 localStorage**，否则下次打开角色会莫名偏移）。`pushOut` 必须**按位移从小到大挑第一个「夹取到视口内仍不重叠」的方向**——只用最小位移的话，角色被视口夹住后会与面板重叠（实测踩到）。留 1px `OUT_GAP`，否则贴边会出现 0.0001px 的「伪重叠」，验证脚本会误报。
- 层级固定为 **角色 `z-62` > 桌面面板 `z-60`**，且角色低于遮罩 `z-65` 与窄屏抽屉 `z-70`：角色在桌面浮动面板之上（用户要求），移动端打开抽屉时被遮罩盖住，所以**避让逻辑只在桌面浮动面板下跑**。
- **踩坑**：SVG 里用 `var()` 写颜色**必须走 `style`**（`style={{ stopColor: "var(--pet-glow)" }}`、`style={{ fill: ... }}`），写进 presentation attribute 解析不可靠；CSS Modules 会改写 `#id`，包内选 id 要用局部类名或 `:global(#…)`；验证倾斜时不能在同一 tick 读 `getComputedStyle().transform`——因为有 `transition: transform 200ms`，读到的是过渡起点（会误判成「没生效」）。
- 额外确认：主体 105.8×80 的命中区比原来 56×56 的球大得多（约 +170% 面积），但外框 115.8×102.6 的空白区与影子**不再拦截点击**（用 `elementFromPoint` 断言过）。

## 小精灵全动作接入（美术包 v6，2026-09-17）

- **分工**：用户/美术在 `src/components/xiaoriyue-drag/` 里迭代 `PetArt.tsx` + `PetArt.module.css` + `README.md`（动作表、接入示例、事件对照都在 README），**宿主负责全部事件、计时、随机/循环调度与降载**。所以「接一批新动作」= 宿主写调度，不是改美术包。宿主调度集中在新增的 `src/store/pet-actor.ts`（zustand），`Sprite.tsx` 只转发 DOM 事件 + 订阅 `action/actionKey`，`ChatPanel.tsx` 只上报请求生命周期（`notifyRequestStart/FirstText/End` 带 `requestId`）。
- **用户确认的口径**（有争议时以这些为准）：①「面板消失」就是关闭语义——`✕`/遮罩/`MemoryForm onDone`/搜索窄屏跳转全都走 `bye`→`sleep`，不区分来源；②点击睡着的角色先 `wake` 再 `happy`；③`grumpy` 只在**拖面板把角色挤开**时播，主动拖角色顶面板不算；④`think` 的「有效内容」= **首个非空 `text` 增量**（工具/卡片事件不算）；⑤`prefers-reduced-motion` 下宿主**完全不驱动动作**（CSS 已把造型全静态化，传什么 `action` 都长一样）；⑥悬停问好面板打开时也允许，仅鼠标、250ms 确认、每次进入一次、8s 冷却。
- **README 的自相矛盾**（已和用户定案）：doze 的条件写成「面板关闭…空闲 45s」，但关闭面板本身就已 `bye`→`sleep`，那条路径会死。定案：关闭 → `bye`→`sleep`，**睡满 20s 自然醒**；`doze` 只用于「面板从未打开/已收起且真正闲置 30s」；**面板打开期间不睡**。两个间隔由美术 README 的 45/30 调成 **30/20**（用户要求，实测 19.1s / 30.0s 命中）。
- **窄屏遮罩下要看得见小精灵**（用户要求，替代了原先「窄屏被遮罩盖住」的定案）：抽屉打开时角色层级 `z-62 → z-68`（遮罩 65 之上、抽屉 70 之下）并**自动让位**到抽屉上方的可视带（抽屉 `min(78dvh,560px)`，上带 125~284px），关闭回原位；期间**仍可点可拖**（用户选「保持可交互」），但拖动被夹在带内且不写 localStorage，被主动挪过就不回原位。`DRAWER_H_RATIO`/`DRAWER_H_MAX` 必须与抽屉的 Tailwind class 同步（已在代码里注释标明）。注意 Tailwind 任意值类名必须是字面量，`z-[68]`/`z-[62]` 不能拼字符串。
- **踩坑（真 bug，测试抓到的）**：`notifyRequestEnd` 里无条件回 `idle` 会把刚播上的 `idea` 立刻顶掉——**流式回答很短时，首字与流结束几乎同刻**，顿悟就闪没了。改成只把 `think-curious`/`think-spin` 收回 `idle`，一次性动作交给各自的 `next` 收尾。同类问题：悬停唤醒的回调里不能判 `get().action === "idle"`——那一刻 action 还是 `wake`，要判 `=== "wake"`（动作代次 `generation` 令牌已经保证不会误伤被替换的动作）。
- **两个 React/ESLint 细节**：① `onPointerUp` 里 `removeEventListener(..., onPointerUp)` 自引用会被 `react-hooks/immutability` 拦下——把拖动监听改成由 `dragging` 驱动的 effect 统一挂/卸（`pointermove`/`pointerup`/`pointercancel`/`lostpointercapture`），顺带满足 README 的「三种结束事件都要收尾」；② 面板关闭用 `useSpriteStore.subscribe((s, prev) => prev.open && !s.open && …)`，既统一了所有关闭来源，又避开「effect 里同步 setState」那条 lint。
- **验证方法论（值得复用）**：判断「SVG 动作是否被外框裁切」不能只看 `getBoundingClientRect()` 的溢出——旋转元素的矩形是「包围盒再取包围盒」，会放大 1~3px，实测 idle@+6° 报 1.59px、bye@+6° 报 2.66px，**其实没有裁切**。可靠做法：① 注入样式隐藏 `canvas` 与 `position:fixed` 粒子（否则星空/粒子动画让抓图不可比）；② `animation-play-state: paused` + 负 `animation-delay` 锁相位；③ 同一相位的 `svg{overflow:hidden}` vs `visible` 各抓一张图**比 base64 是否完全相同**；④ 先连抓两张 hidden 做噪声自检（不等就说明方法无效）。这样 154 个相位里只揪出 2 个真实外溢（≤2px，在顶部极淡光晕边缘，判定不可见）。请求链路可以用 `window.fetch` 打桩返回假 SSE（含 4s 延迟、首字、500、长挂四种）来跑全链路，不必配真模型。

- **表情要"换脸"而不是"加符号"**（2026-09-17 用户反馈）：`think-curious` 原来只是笑脸 + 问号，用户要求真改面部（抿嘴 / 闭眼 / 皱眉）。定案 **A 方案**：眯眼（压扁的 ∩ 弧）+ 一高一低眉（左压右挑）+ 抿嘴（两段浅折线），问号与歪头扫视保留；与基础脸**交叉淡入 220ms**，思考期关掉 7s 眨眼。`PetArt` 升级 v6.1，新增 `squintEye` / `pet-brows-think` / `mouthThink`。**两条硬约束**：新面部零件必须默认 `opacity: 0`，**并且**必须同时出现在 `prefers-reduced-motion` 的 `opacity: 0 !important` 白名单里——漏了会在降载模式下与基础脸叠画（已用 CDP 读数断言 squint/brows/mouth=0、normalEye/Mouth=1）。另外：包是美术交付物，**改包必须同步写进 `SPEC.md` / `README.md`**，否则下次美术交付会把改动覆盖回笑脸。
- **面部零件改动的工作流**（美术相关都在包内，宿主零改动）：① 每个动作的"脸"由 `.动作名 :is(...)` 的 opacity/动画开关组合，零件全部画在 `pet-face` 里、默认隐藏；② 想预览某个动作的脸 → 从 `document.styleSheets` 里扫出 CSS Modules 哈希类名，直接 `classList.add(哈希的 think-curious)` 就能定格，不必走真实请求；③ 截图用 `deviceScaleFactor: 3` + `Page.captureScreenshot` 带 `clip`（截图前把 `animation-play-state: paused` + 负 `animation-delay` 定格相位：循环动作用 `-1800ms`，一次性动作用其 1/3 时长，否则 `both` 会停在结束态导致表情不可见）；④ 出「五态对比图」（idle / think-curious / think-spin / sleep / grumpy）才能确认新表情既到位、又不和睡觉(闭眼)/生气(压眉)撞脸。

## 品牌与根节点改名（2026-09-17）

- 用户三个要求：标签页图标换成小精灵 idle、站名「回忆星空」→ **memss**（memory star sky）、根路径上的「地球」→ **memss**。
- **图标**：`src/app/icon.svg`（头部特写 + 天线光点 + `#05060a` 圆角底），**必须删 `src/app/favicon.ico`**，否则浏览器仍用 .ico。**踩坑**：SVG 的 XML 注释里不能出现 `--`（我写了 `--sky-star` 导致整个文件解析失败、图标变破图），写 token 名时别带 CSS 变量前缀。取舍：16px 下整只（含手/尾/影子）会糊，用户选了「只头部」；描边要按尺寸重新加粗（5→20、3.5→12、7→28），否则 0.3px 看不见。
- **根节点「地球」的真相**：它不是图形，是类别树唯一根（`id="globe"`，`kind="globe"`），根路径 `/` → `/star/globe` 里的 `globe` 就是它；面包屑/归属选择器/编辑弹窗显示的都是它的 `name`。`PATCH /api/categories/[id]` **禁止**改根，所以改名只能直接改数据+改种子。
- **改名必须同时改代码**：有 3 处按名字字面量 `"地球"` 判断「去掉根节点」（`mutations.ts` 的 `resyncSubtreeLocation`、`agent-tools.ts` 的 `locationOfCategory`、`memory-search.ts` 的 `buildCategoryPaths`）。不改的话下次任何类别改名都会把根名写进 `location`（「memss / 日本 / 东京」）。已统一为 `isRootCategory(c) = c.parentId === null`（`lib/category-path.ts`）。**教训：判断"是不是根/特殊节点"永远用结构（parentId/id），不要用可改的显示名。**
- ⚠️ **`resyncSubtreeLocation` 是破坏性的**：改名/移动会把它子树内所有回忆的 `location` 从「自由文本」（种子里的 `日本 · 东京 · 浅草`）重写成「类别路径」（`日本 / 东京`），**丢细节且不可逆**。我为了验证陷阱改了 `jp` 的名字，触发了这个，事后按 `scripts/seed.mjs` 的原始值逐条还原了 11 条。**以后验证这类逻辑优先用只读断言或临时类别，别动真实数据。**

## 星图布局一致性 + 星星随机/上限 + MemSS（2026-09-17）

- **用户五条要求**：① 只有记忆的页与"有子类别+记忆"的页，记忆区高度占比要一致（前者换成后者）；② 有子类别时宽屏滚筒换单排，缩略图与"只有记忆"时一样大；③ `memss` → `MemSS`；④ 有子类别+记忆时星星"一排均分"要改成随机；⑤ 单页星星数量要随屏宽设上限，超出时"类似记忆的滚筒做法"。
- **★ 关键根因（尺寸不一致）**：`MemoryCylinder` 是**按自己 section 的高度**选卡片档位（`<420 tiny`/`<520 compact`），而"有子类别"时那个 section 只有 7/10 高 → **800 高的屏上掉到 150×100，而只有记忆时是 200×133**。**修法：只有记忆的页面一个字不动**（用户明确"仅有记忆的不用动"），把档位基准从"本区块高度"换成**整页可用高度**（`StarfieldPage` 量 header 以下的 `flex-1` 区 → `basisH` 传给 `MemoryCylinder`）；单排本来就放得下常规档，空间小才需要单排。实测 900/800/700 与窄屏 390×844 下两页卡片尺寸完全一致、星轨位置一致、只有记忆页仍占满。教训：① **任何"按容器高/宽选自适应档位"的组件，只要容器占比会随页面结构变化，视觉就会飘；基准要换成稳定的输入（这里是整页可用高度）**；② 我第一版理解反了需求，擅自给"只有记忆"页加了个 3/10 空带去凑占比——**用户要的是"别动好的那页，把差的那页修好"；遇到"A 与 B 不一致"先问清以谁为准，不要默认改 A。**
- **"星轨"的两种含义**：`TimelineRail`（底部时间弧线，注释里就叫"星轨光标"）在两种页面里本来就一致（都贴屏底）；用户说的"星轨高度占比"其实指**记忆轨道区（卡片那片区域）**。**遇到美术/产品用语先量数据再动手，别按字面猜。**
- **单排（有子类别时）**：`MemoryCylinder` 新增 `rows: 1|2`（窄屏恒 2 列）；`trackCrossPositions(..., tracks)` 支持单轨居中。**阈值口径（用户明确）**：有子类别时 >3 张就走滚筒（`threshold = capacity × tracks`，单排=3、双排=6），所以单排只铺 1 轨、`stagger` 与 1~2 张的居中逻辑都要跟着分支。
- **星星**：删掉 `arc`（等分一排）分支一律 `scatter`（黄金角 + 类别 id 定种子，刷新稳定）；随机位置按**实测容器尺寸**夹在可视区内（`ITEM_HALF_H/W`），否则矮星星带里名字被裁。**上限** `starCapacity(w) = clamp(floor(w×0.9/120), 3, 12)`（0 宽时返回上限，避免 SSR/首帧误判成流动而闪一下）；超限转**单行流动轨道**（自走 + 拖动 + 惯性 + 循环回绕 + 两端 mask 渐隐 + 按 id 定种子的横向错落/纵向起伏/旋转）。实测 1440 下 cap=10（12 个子类→流动）、390 下 cap=3。
- **抽了 `src/lib/use-track-flow.ts`**：把记忆 `FlowTracks` 里的 offset/rAF 自走/速度惯性/指针拖动/ready 淡入抽成公共 hook，记忆卡片与超量星星共用；记忆侧行为不变（回归：双轨 2 簇、自走、拖动、点击进详情全过）。
- **两个 lint 坑（都踩了）**：① `useTrackFlow()` 返回的对象含 ref，**在 render 里访问它的属性会被 `react-hooks/refs` 拦**——必须解构出来用；② 同一个 DOM 节点挂测量 ref + hook 的 ref 时，别在 render 里写 `flow.containerRef.current = el`（`react-hooks/immutability`）——改成外层测尺寸、内层挂拖动 ref 的嵌套结构。
- **验证方法（可复用）**：临时分类造场景——`POST /api/categories` 建 `zzl-tmp`（id 是 uuid，不是名字！）+ 12 个子类 + `POST /api/memories` 4 条**无图**记忆（无图也能测：卡片面 div 恒有 `ring-1`，用 `offsetWidth/offsetHeight` 量尺寸，**不受旋转/缩放影响**），跑完 `DELETE /api/categories/<id>?mode=purge` 清理，前后对比 categories/memories/media 行数确认为 0 残留。断言用「卡片 Y 中心聚簇数」判单排/双排（容差 60px，避开浮动扰动）；测拖动跟手要**按名字跟踪同一颗星并朝不糊的方向拖**（否则会回绕导致断言假失败）；点击测试要**挑视口内最靠近中心的卡片**（滚筒里 DOM 顺序第一张常在屏外）。

## 星轨高度一致 + 星星流动深验（2026-09-17 晚）

- **星轨高度（用户选 A）**：`TimelineRail` 的 compact 判据原本是「本区块高度 < 420」，有子类别时区块只有 7/10 → 可用高度 420~600 的窗口里两页不一致（64 vs 140）。改成**两页都用「有子类别时那块的高度」判定**：`railCompact = roomH × 0.7 < 420`（`MEMORY_FLEX_RATIO` 常量与 `flex-[7]` 同步），由 `StarfieldPage` 算好传给 `MemoryCylinder`。实测 8 档高度两页星轨完全一致、卡片尺寸一致、卡片不压星轨。**用户口径：不一致时以"有子类别页"（较小的那个）为准。**
- **星星同屏上限（用户最终口径，2026-09-17 深夜更新）**：无记忆页 **20**、有记忆页 **10**，**随屏宽等比**：`starCapacity(w, maxCap) = clamp(round(maxCap × w / STAR_CAP_REF_WIDTH(1440)), 3, maxCap)`（`STAR_CAP_MAX = 20` / `STAR_CAP_MAX_WITH_MEMORIES = 10`，`StarfieldPage` 传 `withMemories`）；原 `STAR_MIN_DENSITY_GAP = 52` 已删。配套 `slot = w / cap`（**不是** `0.9w/cap`——那个会让同屏多出 1/0.9 倍，实测 23 颗而非 20）。
- **长分类名会毁掉星星布局**（截图才看出来）：名字换行成两行 + 贴边被星区裁掉（`ITEM_HALF_H` 只按单行算）。修法：名字 `max-w-[132px] truncate` 单行截断；流动步长兼顾最长名字（`estWidth` 粗估 CJK 14px/其余 7px，`step = max(120, 最长名+24, 0.9w/cap)`）。**教训：用会撑长的真实数据（超长名字）造场景，别只用 `c1/c2` 这种短名。**
- **测试方法论**：① 流动列表里**不能按名字跟踪单颗星**（它会滚出渲染窗口，量到 `null`）——要么每次重挑屏中央那颗，要么改成"首末位置对比"；② 拖动/惯性的验收要在**松手后等 ~1.4s 再采样回绕**，否则把惯性高速移动（最高 ~1200px/s，60ms 可移动 70px+）误判成瞬移；③ 量卡片尺寸用 `offsetWidth/offsetHeight`（不受旋转/缩放影响）；④ 每次断言前显式 `Page.navigate` 到目标页，否则会拿上一页的数据断言（我就栽在"以为在 flow 页其实在 many 页"上）。
- **临时数据流程（已固化）**：`POST /api/categories` 建父分类（**返回的是 uuid，不是名字**）+ 子分类 → `POST /api/memories`（multipart，可无图）造记忆 → 跑验证 → `DELETE /api/categories/<id>?mode=purge` → 对比 categories/memories/media 行数回基线（12/137/161）确认无残留。


## 演示数据（用户要求保留，2026-09-17 晚）

- 用户明确：「造的多分类数据不用删除，方便我看效果」。**根节点 MemSS 下留了 3 个演示分类**（都是 `globe` 的直属子分类，从首页星图点进去即可）：
  - `演示·8分类+回忆`（8 子分类 + 2 条无图记忆）→ 任何宽度都是**随机散布**
  - `演示·20分类+回忆`（20 子分类 + 2 条无图记忆）→ 任何宽度都是**流动**（有记忆时上限 16 < 20）
  - `演示·40分类无回忆`（40 子分类、无记忆）→ 1440/3200 宽**流动**，5600 宽变**散布**（无记忆上限 40）
- 清除方式：每个演示分类都是根节点的子分类，页面上有「编辑 / 遗忘」菜单，直接遗忘即可（不需要脚本）。**教训：用户说"要留着看效果"时不要清理；下次造验证数据前先问一句要不要留。**

## 修 bug：窄屏拖动星星后切宽屏，星星点不开（2026-09-17）

- **现象**：窄屏（390）拖过星星流动之后，切到宽屏（1440），星星全部点不开（再点也不行）。
- **复现到的关键对照**：同一页**宽屏直开**点击正常；**窄屏→拖动→切宽屏**后点击必失效。
- **根因**：`use-track-flow` 的 `movedRef`（"刚拖过，别把抬手当点击"）**只在 `onPointerDown` 里清零**。窄屏 8 个子分类 > 上限 3 → 流动形态（有拖动层）→ 拖动把标记置 true；切宽屏后上限 10 ≥ 8 → **切换成随机散布，拖动层整个被卸载** → 标记永远清不掉 → `justDragged()` 恒为 true → 每次点击都被守卫吞掉。
- **修法**：① 守卫只在流动形态生效（散布形态没有拖动，历史标记不该拦点击）：`if (flowing && justDragged()) return;`；② `justDragged()` 从"粘性标记"改成**时间窗**（`endDrag` 里 `lastDragEndRef = performance.now()`，只拦结束后 `DRAG_CLICK_GUARD_MS=400ms` 内的那次 click）。
- **教训（通用）**：**"只在 pointerdown 里清"的粘性状态，一旦承载它的 DOM 被卸载就会永久卡住**；凡是这种"事件尾巴"守卫，用**时间窗**而不是布尔标记；另外守卫要加在**真正可能触发它的形态**（这里是流动）上，别在"不可能拖动"的形态里也套。

## 星星流动：横向间隔随机化（2026-09-17 晚）

- **用户观察**：流动时"水平间距看着像等分，只有垂直在随机"——对。根因是布局为**等距点阵 + `along` ±9% 抖动**（`raw = i*step + step*0.09*rnd + offset`），垂直则是整个星区高度的强随机。
- **最终形态（两轮迭代后定稿）**：① 先做"环形随机间隔"（仍是等距骨架 + 随机间隔）；② 用户嫌密度低，我做了"分排"（排内留名字宽度、跨排贴紧）——**被否掉："一排排太丑，我的本质目的是星星在它所在的区域整体随机分布，流动的时候也是"**。③ 定稿：**纵向完全随机**（不做排，避免任何"排感"），**横向随机间隔**，下限按"纵向靠得近与否"逐对判定（近的必须放得下名字、远的只要点不挤），总长 = `n × slot`。
- **教训**：用户说"随机分布"时，要的是**2D 云**，不是"用规则排布去模拟随机"——**任何能被眼睛看出来的规则（分排、等距、对齐）都不行**；密度/不叠字要用"逐对条件"在**同一套随机布局里**解决，而不是引入新的结构。密度旋钮单独一个常量（`STAR_MIN_DENSITY_GAP=52`），别混在别的常量里。
- **踩坑**：改 `LABEL_MAX_W` 常量时忘了同步 JSX 的 `max-w-[132px]` 类名 → 逻辑按 96 算、实际渲染 133 → 长名字叠字（测试里"名字矩形零重叠"这条抓到的）。**改常量必须 grep 同名字面量。**
- **改法（用户选 A：不改平均间距/密度）**：换成**环形随机间隔** —— `need_i = max(56, (w_i + w_{i+1})/2 + 8)`（逐对下限，`w` = 名字估算宽度）+ 随机分摊多余量，`Σgap = n × slot` 保持总长不变，所以平均间距与同屏星数不变；`bases` 用累积和（不再是 `i*step`），环上最后一个到第一个的间隔也受 `need` 约束，回绕仍无缝。
- **一个必须知道的量化结论**：在"平均间距不变"的约束下，**波动幅度上限 = slot − 最小 need**。1440 下演示C（短名字）slot=129.6、need≈85 → 最大波动 ~66px；想更野只能①抬高平均间距（同屏变少）或②压缩名字留白（`LABEL_PAD`）——所以"密度不变 + 波动很大"在数学上不可兼得，下次要先说清这个取舍。
- **测试方法论**：① 截图裁剪必须用**星区真实视口矩形**（我一开始裁到 `y=0`，等于只截了星区上半段，看图会误判）；② 量"拖动跟手/自走"要**按名字跟踪同一颗星**（可见集合会变，平均位移会被稀释/反向：实测平均 +56 而真实是 -18）；③ 判"名字不重叠"用**两两名字矩形相交**（含纵向），只看横向会误报（纵向本来就随机）。

## 星星"一条线"根因 & 密度改 20/10（2026-09-17 深夜）

- **用户反馈**："8 分类的分布就比较随机，20 分类的流动**明显看出一条线**"，同时指定"当前屏幕大小，无记忆同屏星数控制 20，有记忆控制 10（随屏自适应）"。
- **根因（量化复盘，别只改布局算法）**：把星区真实矩形截图 + 量 DOM 后发现，`一条线` 是三个因素叠加——① **同屏太多**（有记忆页 17~20 颗）；② **横向间距几乎等距**（85~98px，因为 slot 只有 81 而最小 need 44，可分摊的余量太少）；③ **星星固定在一条横向走廊里匀速滑动**（有记忆页星区只有 3/10 高 = 1440×251，宽高比 5.7:1 本身就是一条带）。**先量化再动手**，否则会一直在布局算法里打转。
- **修法**：降密度到 20/10（`slot = w / cap`）+ 拉大间距差异 + 纵向按"横向挤不挤"分模式（见上一条）。实测间距分布从"85/85/94/95/98"变成演示B `93/137/184`、演示C `52/71/89`。
- **最大的坑（差点又做成"排"）**：给纵向加"相邻必须错开 68px"的硬约束后，**矮星区（242px 高、11 颗星）会被逼成上下两排**——实测同一水平带最多 5~7 颗、只剩 3 个带，比纯随机更像"一条线"。**结论：纵向错开只在"横向间距本身放不下名字"时才需要**（判据 `max((w_i+w_{i+1})/2+8) > slot`）；横向够宽时必须纯随机。**约束越强 ≠ 越随机，要按约束是否必要分模式。**
- **"线感"的量化指标**（写进验证脚本）：把可见星按 y 分簇（<24px 同簇），看**最大簇的大小**和**纵向标准差**（均匀随机理论 sd = 可用高度/√12）——比"肉眼看"可靠，也能防止把随机误判成排、把排误判成随机。
- **`slot` 的口径**：`starCapacity` 收的是**容器全宽**，所以 `slot` 必须 `w / cap`。沿用旧的 `0.9w / cap` 会让屏幕上多出 1/0.9 倍（要 20 颗实测 23 颗）。**改了容量的输入口径，要连带检查由它推导出的每个量。**
- **踩坑（TDZ）**：`const crosses = items.map((c, i) => ... crosses[i-1] ...)` 自引用 → `ReferenceError: Cannot access 'crosses' before initialization` → 整个页面白屏（CDP 量到 `MEASURE = null`）。**"新数组要引用自己已算出的前缀"时只能用普通 for 循环 + push。** 页面白屏时先看是不是运行时报错（tsc/eslint 都抓不到这种）。
- **验证**：`/tmp/star-cap-verify.mjs` 20/20（同屏数 1440→20/10、2000→封顶 20/10、390→5/3；间距 min ≥44；波动矮星区 ≥20/高星区 ≥40；纵向 sd；名字零重叠；自走 Δ=-18/1.5s；拖动 Δ=-120 且不误跳转；40 帧无可见区瞬移；窄屏不溢出）。截图 `/tmp/cap-B-1440.png`、`/tmp/cap-C-1440.png`、`/tmp/cap-C-390.png`。

## 背景流星 + 详情页日期移入标题行（2026-09-18）

- **用户需求**：① 背景加流星，"大体方向从右上至左下，偶尔刷一条，速度较快"；② 记忆详情页的日期放到标题行右侧。
- **确认清单（用户选择）**：流星节奏 = 偶发（首次 2~4s、之后每 6~16s、同屏最多 1 条）；配色 = **冷/暖两套交替出现，用户自己在浏览器看效果再定**（所以两套代码都留着，别急着删）；reduced-motion = 完全不出现流星；日期 = **标题行右对齐、页头不再显示日期**；日期顺便按"暖金 = 时间"语义上色（用户答"可以"）。
- **流星实现**：同一张背景 canvas、同一个 rAF 循环（不新增画布/DOM，`-z-10` 天然在内容之下）；`"lighter"` 叠加画"头亮尾透明"渐变尾迹 + 头部径向光斑（**不用 `shadowBlur`**）；起点沿右上角外侧斜带随机；`ttl` 由"头部出屏"反算；位移用 `dt` 驱动且封顶 0.05s。
- **两个必须记住的坑**：① 原来常态**每 2 帧才重绘**，1200px/s 的流星每帧位移 ~40px 会一顿一顿 → 改成**有流星存活时逐帧、平时仍每 2 帧**（实测一次流星 1.1s 画了 70 帧）；② `document.hidden` / 场景过渡期会 `return` 不绘制，若位移不按 `dt` 算、或不给 `dt` 封顶，回来时流星会瞬移。
- **验证方法论（这次最有价值的一条）**：**缩图会把星点 RGB 保留、只把 alpha 平均掉**，所以"缩略图 + 亮度阈值"完全分不开星星与流星（基线 45~90 个亮点）。正确做法：先 8 帧"暖机"统计每个格子亮了几次，**亮 ≥7/8 帧的格子 = 星点掩码**（流星只是路过，同一格不会亮满），之后只统计**掩码外（3×3 膨胀）**的高亮像素 → 基线≈0，流星 25~38 px。倾角用**首尾质心位移**算（协方差会被圆形头部光斑带偏，同一事件能差出 30°）；"同一基线"的判定用**空 `inline-block`（width/height 0）的 top 当基线探针**，多行标题要插到**行首**才是首行基线；颜色判 r>b 不能读 `getComputedStyle`（Tailwind v4 返回 `oklab(...)`），要 `fillStyle` + 1×1 canvas 转回 sRGB。
- **日期改动**：主体标题行 `flex items-baseline justify-between`（h1 `min-w-0 break-words` + 日期 `shrink-0 whitespace-nowrap`、`text-warm/70`），页头右列只剩 `⋯`。
- **如实记录的取舍**：1440×900 且该回忆带音乐时，主区内容本来就高于视口（`scrollHeight 1031`，标题原就贴折线下沿），日期落在折线下 16px，要轻微滚动；1080 高正常。用户若要彻底解决需再动主图高度上限——**没擅自改，先报告**。
- **验证**：`/tmp/meteor-verify.mjs` 24/24 PASS（45s 内 3~5 条、可见 0.66~0.84s、方向全朝左下、倾角 23~24°、间隔 12.5/15.0s、冷暖严格交替、无 >50ms 长任务、reduced-motion 0 条；日期四种组合位置/基线/无溢出/暖金色）。实拍 `/tmp/meteor-shot.png`、`/tmp/detail-date-1440.png`、`/tmp/detail-date-390.png`、`/tmp/detail-date-390-long.png`；临时回忆已 DELETE。
