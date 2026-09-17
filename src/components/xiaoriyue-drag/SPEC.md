# 小精灵美术资源接入规格（SPEC v1）

本文件是**美术包**与**宿主（本项目）**之间的接口契约。目标：美术包按此规格交付后，
宿主只需替换文件、不改接入层代码，即可换上新造型 / 新动作。

> 一句话：**美术包只负责「画什么、怎么动」，宿主负责「在哪、怎么拖、什么时候弹面板」。**

---

## 0. 职责边界

| | 负责 |
| --- | --- |
| 美术包 | 造型、SVG 分组、CSS 动效、倾斜姿态的施加点（读 `--pet-angle`） |
| 宿主 | 定位、拖拽、位置持久化、层级、点击开面板、面板避让、常驻粒子/拖尾/星尘、reduced-motion 降载 |

美术包**不得**触碰定位与交互（见 §2 的禁止清单）。

---

## 1. 交付目录与文件

```
src/components/xiaoriyue-drag/
├── PetArt.tsx          必需：内联 SVG，唯一入口（default export）
├── PetArt.module.css   必需：姿态层与动效样式（只有 id / 局部类名选择器）
└── SPEC.md             本文件（随包交付，便于对照）
```

**禁止**：`examples/`、`public/` 图片、`README` 之外的多余文档、任何外部依赖（npm 包）、
字体文件、CDN / 远程请求、多于一层的子目录。

---

## 2. 组件契约

```tsx
// 完整动作联合、时长与 ACTIONS 元数据以 PetArt.tsx 导出为准。
export type PetAction = "idle" | "happy" | "doze" | "sleep" | "wake"
  | "greet" | "bye" | "grumpy" | "drag-shy" | "think-curious" | "think-spin" | "idea";
export default function PetArt({ className, action = "idle", actionKey = 0 }: {
  className?: string;
  action?: PetAction;
  actionKey?: number;
}) { /* ... */ }
```

- 根元素必须是单个 `<svg>`，且：

```tsx
<svg
  className={className}
  viewBox="15 95 440 390"                 // 固定，改动属 breaking
  preserveAspectRatio="xMidYMid meet"     // 固定
  fill="none"
  aria-hidden="true"
  focusable="false"
  xmlns="http://www.w3.org/2000/svg"
>
```

- **尺寸由宿主容器决定**：SVG 自身用 `width/height: 100%`（或用 `className` 交给宿主），
  不要接受 `size` / `margin` / `zIndex` 等布局 props。
- **禁止**：`position: fixed|absolute|sticky`、`z-index`、`createPortal`、事件监听
  （`onClick`/`onPointerDown` 等）、读取 `window` / `document` / `localStorage`、
  `'use client'` 之外的副作用、`setTimeout`/`setInterval` 驱动的动画。
- 组件必须是**纯展示**的：同样的 props 渲染同样的 DOM。

### v6 可选动作扩展

旧用法不变，默认 `idle`。宿主传入动作名称，递增 `actionKey` 可重播。
`ACTION_DURATION_MS` 导出全部一次性动作时长；`ACTIONS` 导出每种动作的 kind、durationMs 和 next。
循环动作的 durationMs / next 为 null；一次性动作 next 为 sleep 或 resume（重新计算宿主业务状态）。宿主负责计时、状态切换、取消及卸载清理；美术包没有事件或计时副作用。
doze / bye 结束进入 sleep；bye 不移动、不隐藏角色。think-spin 只让屏幕内部螺旋与符号旋转。
新命名导出为增量接口，既有 default export、FRAME、CHAR 均不变。可选接入示例见 `README.md`。
仅内部动作层因动作或播放编号变化重新挂载；定位和倾斜层保留。动作切入为确定起始姿态，并非任意相位混合。

### v6.1 面部微调

`think-curious` 由「笑脸 + 问号」改为「眯眼（`squintEye`）+ 一高一低眉（`pet-brows-think`）+
抿嘴（`mouthThink`）」，与 `normalEye`/`normalMouth` 交叉淡入 220ms；问号与歪头扫视保留。
只新增分组 / 类名与动画（非 breaking，接口与几何零变化），宿主无需改动。
新增的备用面部零件**默认 `opacity: 0`**，并且必须同时出现在
`prefers-reduced-motion: reduce` 的 `opacity: 0 !important` 白名单里，否则降载模式下会与基础脸叠画。

---

## 3. 尺寸与余量

`PetArt.tsx` 顶部必须用注释 + 导出的常量声明两个矩形（单位与 `viewBox` 相同）：

```ts
/** 外框：与 SVG 的 viewBox 完全一致 */
export const FRAME = { x: 15, y: 95, w: 440, h: 390 };
/** 角色主体包围盒：不含底部影子、不含动作余量。宿主用它算命中区与面板避让 */
export const CHAR = { x: 35, y: 111, w: 402, h: 304 };
```

规则：

1. `FRAME` 必须与 `viewBox` 一致；`FRAME.w / FRAME.h` 即外框纵横比，**必须稳定**。
2. `CHAR` 是「用户直觉上的角色本体」——命中区、碰撞、拖尾原点都按它算。
   请**紧贴**主体（不要为了省事把外框等于 `CHAR`）。
3. 宿主按 `CHAR.h` 换算尺寸：给定角色高度 `PET_H`，则
   外框宽 `= PET_H * FRAME.w / CHAR.h`，外框高 `= PET_H * FRAME.h / CHAR.h`，
   主体宽 `= PET_H * CHAR.w / CHAR.h`。
4. `viewBox` 内四边必须留足**倾斜 ±6° 不被裁切**的余量（当前左 20 / 右 18 / 下 19 单位，够用）。
5. 根 `<svg>` **不设** `overflow: visible`（即默认裁剪）：**超出 `viewBox` 的内容会被裁掉**，
   所以造型与动作极值都必须留在 `viewBox` 内。

---

## 4. 颜色

| 用途 | 写法 | 宿主覆盖方式 |
| --- | --- | --- |
| 线稿（描边、主体笔画） | `stroke="currentColor"` | 容器上加 `text-star` → `rgb(var(--sky-star))` |
| 光点 / 高亮 / 暖色点缀 | `var(--pet-glow)` | `globals.css` 的 `--pet-glow` → `rgb(var(--warm-glow))` |

- **不得写死**其它色值（`#fff` / `#fff49a` 等一律改为上面两种）。
- 不使用 `filter: drop-shadow()` / `box-shadow` 做外发光（性能与风格统一都由宿主控制）；
  需要发光时用 SVG 内的 `radialGradient` + 半透明圆（当前做法）。
- 带 `var()` 的颜色**必须走 `style`**，不要写在 presentation attribute 里：
  `<stop offset="1" style={{ stopColor: "var(--pet-glow)", stopOpacity: 0 }} />`
  （presentation attribute 中的 `var()` 解析不可靠。）

---

## 5. 姿态层与倾斜

- 姿态层是包裹「会跟着倾斜的全部内容」的 `<g id="pet-character">`。
- 倾斜由宿主写入 CSS 变量 `--pet-angle`（单位 `deg`，范围 ±6），包内负责施加：

```css
.character {
  transform-origin: 235px 265px;               /* 旋转轴心，由美术定 */
  transform: rotate(var(--pet-angle, 0deg));
  transition: transform 200ms ease-out;        /* 松手 / 停止后回正 */
}
@media (prefers-reduced-motion: reduce) {
  .character { transform: none; transition: none; }
}
```

（`.character` 是 `PetArt.module.css` 的局部类名，JSX 里用 `styles.character` 引用；
也可改用 `:global(#pet-character)`。见 §7 的选择器约定。）

- 轴心 `transform-origin` 用 SVG 用户单位写 `px` 值即可。
- **影子**（若有）必须放在 `#pet-character` **之外**，不参与倾斜。
- 包内**不得自己写** `--pet-angle`（那是宿主的输入）。

---

## 6. 分组清单（动效挂载点）

用固定 `id` 分组；**一旦发布不得改名/删除**（改名属 breaking）。

| id | 内容 |
| --- | --- |
| `pet-character` | 姿态层（倾斜作用于此，内部全部跟随旋转） |
| `pet-antenna` | 天线 |
| `pet-antenna-glow` | 天线顶端光点（含渐变圆），`stroke="none"` |
| `pet-body` | 外壳轮廓 |
| `pet-body-inner` | 内层描边 |
| `pet-face` | 面部容器（含下列三组） |
| `pet-eye-left` | 左眼 |
| `pet-eye-right` | 右眼 |
| `pet-mouth` | 嘴 |
| `pet-brows` | 压眉（grumpy 用） |
| `pet-brows-think` | 思考眉（think-curious 用，一高一低） |
| `pet-blush` | 害羞斜线（drag-shy 用） |
| `pet-question` | 问号（think-curious 用） |
| `pet-thoughts` | 思考点（think-spin 用） |
| `pet-idea-rays` | 头顶短光线（idea 用） |
| `pet-hand-left` | 左手 |
| `pet-hand-right` | 右手 |
| `pet-tail` | 尾巴 |
| `pet-shadow` | 底部影子（在 `pet-character` 之外） |

- 新增动作可以**新增**分组（如 `pet-brow-left`），不算 breaking。
- 分组不得改变外框尺寸与纵横比（动作只能用 `transform` / `opacity` 表达）。

---

## 7. 动效约定

- 只用 CSS 动画（`@keyframes` + `animation`），写在 `PetArt.module.css` 中。
- **选择器约定**：包内动效一律用「CSS Modules 局部类名（JSX 里 `styles.xxx` 引用）」，
  或 `:global(#pet-xxx)`。**不要写裸 `#id`** —— 会被 CSS Modules 改写，导致匹配不到。
- **只动 `transform` / `opacity`**；不得动 `width`/`height`/`left`/`top`/`margin`/`d`，
  不得让根外框尺寸变化（宿主靠它算命中区与避让）。
- 所有动画必须在 `prefers-reduced-motion: reduce` 下关闭。
- 长时间运行的动画避免大面积 `filter` / `box-shadow`（移动端掉帧）。
- 不使用 JS 计时驱动动画。

---

## 8. 变更规则

**非 breaking**（直接替换即可）：新增分组、新增动画、微调笔画造型、
调整渐变浓淡、在不改 `CHAR` 比例的前提下微调 `CHAR` 数值（但请在交付说明中写出新值）。

**breaking**（必须提前说明，宿主需要同步改代码）：
改 `viewBox` / 外框纵横比、`CHAR` 与 `FRAME` 的相对比例变化、
分组 `id` 改名或删除、CSS 变量名变化（`--pet-angle` / `--pet-glow`）、
export 形式变化、引入布局/交互/外部依赖。

每次交付请在 `PetArt.tsx` 文件头写：

```tsx
/**
 * 小精灵美术 · 版本 v1（2026-09-16）
 * 变更：首次交付（造型来自 xiaoriyue-drag 资源包的 SVG）
 */
```

---

## 9. 宿主侧验收清单

美术包替换后，宿主按下列清单验收（本项目用 CDP 真实坐标点击 + 截图）：

1. 外框尺寸与纵横比正确（不裁切、四边倾斜余量够，±6° 旋转不溢出）。
2. 线稿颜色 = `--sky-star`，光点颜色 = `--warm-glow`；无写死色值残留。
3. 命中区只覆盖角色主体（点影子/空白不触发拖拽）。
4. 拖拽：抓取点不跳位；拖到四角与缩小窗口后仍可找回；移动端不压详情页底栏。
5. 倾斜：拖动时有 ±6° 跟随，停止/松手后回正；`reduce` 下完全不动。
6. 面板避让：角色与面板永不重叠（拖角色时面板为障碍；拖面板时挤出角色）。
7. 层级：角色在桌面面板之上、移动遮罩/抽屉之下。
8. 无 hydration 报错、无控制台错误；`tsc` / `lint` / `build` 全绿。
