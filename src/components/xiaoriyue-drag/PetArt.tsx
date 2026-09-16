/**
 * 小精灵美术 · 版本 v5（2026-09-16）
 * 变更：新增可选 action / actionKey 与 happy 动作，接入见 README.md。
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

export type PetAction = "idle" | "happy";
/** 与 CSS 的 happy 动作时长同步；宿主负责结束后切回 idle。 */
export const ACTION_DURATION_MS = { happy: 1800 } as const;

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
            className={`${styles.hover} ${action === "happy" ? styles.happy : ""}`}
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

            <g id="pet-face">
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
              </g>
              <g id="pet-mouth" className={styles.mouth}>
                <path d="M222 284 Q235 296 248 281" />
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
