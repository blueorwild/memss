/**
 * 小精灵美术 · 版本 v6.1（2026-09-17）
 * 变更：think-curious 面部改为「眯眼 + 一高一低眉 + 抿嘴」（新增 squintEye /
 *       pet-brows-think / mouthThink，仍保留问号与歪头扫视）；FRAME / CHAR、
 *       既有分组 ID 与宿主变量保持不变。
 * 上一版 v6：完整睡眠、交互与对话动作库；导出动作元数据，接入见 README.md。
 * FRAME / CHAR、既有分组 ID 与宿主变量保持不变。
 *
 * 接入约定见同目录 SPEC.md：
 * - 本组件是纯展示的内联 SVG，不做定位 / 拖拽 / 事件 / 尺寸 props（都由宿主负责）。
 * - 线稿走 currentColor（宿主给 --sky-star），光点走 var(--pet-glow)。
 * - 倾斜角度由宿主写入 --pet-angle，包内在 PetArt.module.css 施加到 #pet-character。
 */

import styles from "./PetArt.module.css";

/** 外框：与下方 SVG 的 viewBox 完全一致 */
export const FRAME = { x: 15, y: 95, w: 440, h: 390 };
/** 角色主体包围盒：不含底部影子、不含动作余量。宿主用它算命中区与面板避让 */
export const CHAR = { x: 35, y: 111, w: 402, h: 304 };

/** 天线顶端光点的渐变 id（全局只挂载一个实例，固定 id 即可） */
const GLOW_ID = "pet-antenna-glow-fade";

export const ACTION_DURATION_MS = {
  happy: 1800,
  doze: 2400,
  wake: 2000,
  greet: 1800,
  bye: 2600,
  grumpy: 1500,
  idea: 1500,
} as const;
export type PetOneShotAction = keyof typeof ACTION_DURATION_MS;
export type PetLoopAction =
  "idle" | "sleep" | "drag-shy" | "think-curious" | "think-spin";
export type PetAction = PetOneShotAction | PetLoopAction;
type ActionSpec =
  | { kind: "loop"; durationMs: null; next: null }
  | { kind: "once"; durationMs: number; next: "idle" | "sleep" | "resume" };
/** next 是宿主调度建议；resume 表示重新计算当前业务状态。 */
export const ACTIONS: Record<PetAction, ActionSpec> = {
  idle: { kind: "loop", durationMs: null, next: null },
  happy: { kind: "once", durationMs: ACTION_DURATION_MS.happy, next: "resume" },
  doze: { kind: "once", durationMs: ACTION_DURATION_MS.doze, next: "sleep" },
  sleep: { kind: "loop", durationMs: null, next: null },
  wake: { kind: "once", durationMs: ACTION_DURATION_MS.wake, next: "resume" },
  greet: { kind: "once", durationMs: ACTION_DURATION_MS.greet, next: "resume" },
  bye: { kind: "once", durationMs: ACTION_DURATION_MS.bye, next: "sleep" },
  grumpy: {
    kind: "once",
    durationMs: ACTION_DURATION_MS.grumpy,
    next: "resume",
  },
  "drag-shy": { kind: "loop", durationMs: null, next: null },
  "think-curious": { kind: "loop", durationMs: null, next: null },
  "think-spin": { kind: "loop", durationMs: null, next: null },
  idea: { kind: "once", durationMs: ACTION_DURATION_MS.idea, next: "resume" },
};

export default function PetArt({
  className,
  action = "idle",
  actionKey = 0,
}: {
  className?: string;
  action?: PetAction;
  actionKey?: number;
}) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* 光点外发光：同色渐隐（用 style 才能可靠解析 var()） */}
        <radialGradient id={GLOW_ID}>
          <stop style={{ stopColor: "var(--pet-glow)" }} stopOpacity=".95" />
          <stop
            offset=".38"
            style={{ stopColor: "var(--pet-glow)" }}
            stopOpacity=".85"
          />
          <stop
            offset=".7"
            style={{ stopColor: "var(--pet-glow)" }}
            stopOpacity=".45"
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--pet-glow)" }}
            stopOpacity="0"
          />
        </radialGradient>
      </defs>

      {/* 线稿统一描边（颜色 = currentColor = --sky-star） */}
      <g
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 姿态层：倾斜（--pet-angle）作用于此，内部全部跟随旋转 */}
        <g id="pet-character" className={styles.character}>
          <g
            key={`${action}-${actionKey}`}
            className={`${styles.hover} ${styles[action]}`}
          >
            <g className={styles.antenna}>
              <g id="pet-antenna">
                <path d="M272 167 C270 130 303 111 326 120 Q342 126 337 142" />
              </g>
              <g id="pet-antenna-glow" stroke="none">
                <circle
                  className={styles.glow}
                  cx="337"
                  cy="142"
                  r="32"
                  style={{ fill: `url(#${GLOW_ID})` }}
                />
                <circle
                  className={styles.core}
                  cx="337"
                  cy="142"
                  r="10"
                  style={{ fill: "var(--pet-glow)" }}
                />
              </g>
            </g>

            <g id="pet-body">
              <path d="M143 176 C188 163 285 154 321 168 C349 179 361 210 365 253 C370 295 359 330 331 340 C285 358 184 363 144 348 C115 337 107 306 107 264 C106 222 114 187 143 176 Z" />
            </g>
            <g id="pet-body-inner">
              <path
                d="M150 195 C190 184 280 176 314 188 C334 196 343 220 346 254 C349 286 342 312 320 320 C280 335 189 340 153 329 C132 322 126 298 126 265 C125 232 131 201 150 195 Z"
                strokeWidth="3.5"
              />
            </g>

            <g id="pet-face" className={styles.face}>
              <g id="pet-eye-left" className={styles.eyeLeft}>
                <path
                  className={styles.normalEye}
                  d="M179 263 L179 245 Q179 236 187 236 Q195 236 195 245 L195 260"
                  strokeWidth="7"
                />
                <path
                  className={styles.smileEye}
                  d="M175 252 Q187 232 199 249"
                  strokeWidth="7"
                />
                <path
                  className={styles.closedEye}
                  d="M174 250 Q187 258 200 247"
                  strokeWidth="6"
                />
                <path
                  className={styles.squintEye}
                  d="M177 251 Q187 246 197 252"
                  strokeWidth="6"
                />
                <g className={styles.spiralLeft}>
                  <path
                    className={styles.spiralEye}
                    d="M188 249 C183 245 189 239 194 244 C203 256 181 266 174 252 C165 233 192 225 204 239"
                    strokeWidth="4"
                  />
                </g>
              </g>
              <g id="pet-eye-right" className={styles.eyeRight}>
                <path
                  className={styles.normalEye}
                  d="M272 254 L272 236 Q272 227 280 227 Q288 227 288 236 L288 251"
                  strokeWidth="7"
                />
                <path
                  className={styles.smileEye}
                  d="M268 243 Q280 223 292 240"
                  strokeWidth="7"
                />
                <path
                  className={styles.closedEye}
                  d="M267 241 Q280 249 293 238"
                  strokeWidth="6"
                />
                <path
                  className={styles.squintEye}
                  d="M270 243 Q280 238 290 244"
                  strokeWidth="6"
                />
                <g className={styles.spiralRight}>
                  <path
                    className={styles.spiralEye}
                    d="M281 240 C276 236 282 230 287 235 C296 247 274 257 267 243 C258 224 285 216 297 230"
                    strokeWidth="4"
                  />
                </g>
              </g>
              <g id="pet-mouth" className={styles.mouth}>
                <path
                  className={styles.normalMouth}
                  d="M222 284 Q235 296 248 281"
                />
                <path
                  className={styles.pout}
                  d="M222 287 L230 282 L238 288 L248 282"
                />
                <path
                  className={styles.mouthThink}
                  d="M223 286 L235 288 L247 285"
                />
                <ellipse
                  className={styles.roundMouth}
                  cx="235"
                  cy="286"
                  rx="7"
                  ry="9"
                />
              </g>
              <g className={styles.brows} id="pet-brows">
                <path d="M173 220 L198 230 M266 223 L290 210" />
              </g>
              <g
                className={styles.browsThink}
                id="pet-brows-think"
                strokeWidth="4"
              >
                <path d="M175 226 L198 231 M266 218 L290 210" />
              </g>
              <g className={styles.blush} id="pet-blush" strokeWidth="4">
                <path d="M154 272 L150 281 M165 270 L161 279 M298 259 L294 268 M309 257 L305 266" />
              </g>
              <g className={styles.question} id="pet-question" strokeWidth="4">
                <path d="M306 211 C301 200 319 193 323 203 C326 211 313 213 316 221 M317 229 L317 230" />
              </g>
              <g
                className={styles.thoughts}
                id="pet-thoughts"
                stroke="none"
                fill="currentColor"
              >
                <circle cx="221" cy="207" r="3" />
                <circle cx="235" cy="204" r="4" />
                <circle cx="249" cy="201" r="3" />
              </g>
              <g
                className={styles.ideaRays}
                id="pet-idea-rays"
                strokeWidth="4"
                style={{ stroke: "var(--pet-glow)" }}
              >
                <path d="M206 204 L202 193 M226 199 L227 186 M247 200 L254 188" />
              </g>
            </g>

            <g id="pet-hand-left" className={styles.handLeft}>
              <path d="M80 289 C69 270 54 272 55 290 C39 285 35 297 45 309 C61 328 87 316 80 289 Z" />
            </g>
            <g id="pet-hand-right" className={styles.handRight}>
              <path d="M393 268 C399 249 415 249 416 268 C431 264 437 277 426 289 C411 306 386 293 393 268 Z" />
            </g>

            <g id="pet-tail" className={styles.tail}>
              <path d="M251 356 C253 378 227 382 225 397 C222 411 239 415 247 405" />
            </g>
          </g>
        </g>

        {/* 保留接口挂载点，不绘制影子。 */}
        <g id="pet-shadow" />
      </g>
    </svg>
  );
}
