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
