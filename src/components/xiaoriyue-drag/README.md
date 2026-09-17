# 小日月全动作接入（v6）

## 替换与边界

同步替换 `PetArt.tsx`、`PetArt.module.css`，保留 `SPEC.md` 和本说明。默认不传动作参数仍是已确认的待机；happy 保持 1800ms、5 次扑扇。无需修改尺寸、拖曳、定位、颜色或面板代码。

美术包只输出 SVG 和 CSS 动画。宿主负责所有事件、定时、随机/循环调度、请求生命周期和 reduced-motion 降载。没有新增依赖、远程请求或定位副作用。单实例使用，固定 SVG 渐变 ID 不适合同时挂载多个实例。

```tsx
import PetArt, { ACTIONS, ACTION_DURATION_MS, type PetAction } from './PetArt';

<PetArt className={styles.art} action={action} actionKey={actionKey} />
```

- `action`：下表中的名字，默认 `idle`。
- `actionKey`：默认 0；同一动作需要重新开始时递增。不要用它给外部拖曳容器设置 React key。
- `ACTIONS[action]`：`kind` 为 `once` 或 `loop`；循环的 `durationMs` / `next` 为 null。
- 一次性动作的 `next` 是 `sleep` 或 `resume`。`resume` 不是可播放动作，而是让宿主重新计算当前业务状态。
- `ACTION_DURATION_MS` 保留原有 happy 导出，并补充全部一次性动作时长。
- 美术包不会自行修改 action，也不会自动触发下一动作；不切换时，一次性主要姿态保持末帧，未被接替的装饰层可继续循环。
- 切换/重播会重建内部动作层，存在轻微相位复位；未实现任意动作无缝混合。定位和宿主倾斜层不重建。

## 动作表

| action | 类型 | 时长 | 表现 / 默认后续 |
| --- | --- | --- | --- |
| `idle` | 循环 | — | 原有悬浮、扑扇、眨眼和光晕 |
| `happy` | 一次 | 1800ms | 5 轮快速扑扇、笑眼 / resume |
| `doze` | 一次 | 2400ms | 渐闭眼、收翅、下沉、暗灯 / sleep |
| `sleep` | 循环 | — | 闭眼、微弱悬浮与慢扑扇、低亮呼吸 |
| `wake` | 一次 | 2000ms | 亮灯、睁眼、展翅抬起 / resume |
| `greet` | 一次 | 1800ms | 侧翅问好、单眼笑 / resume |
| `bye` | 一次 | 2600ms | 侧翅挥别，闭眼收翅入睡 / sleep |
| `grumpy` | 一次 | 1500ms | 压眉、折线嘴、叉翅轻晃 / resume |
| `drag-shy` | 循环 | — | 害羞斜线、眯眼、双翅交替挣动 |
| `think-curious` | 循环 | — | 眯眼、一高一低眉、抿嘴、歪头扫视、问号 |
| `think-spin` | 循环 | — | 螺旋眼与屏幕内思考点转动，主体不翻转 |
| `idea` | 一次 | 1500ms | 睁亮双眼、展翅、灯珠增亮变大、短光线 / resume |

## 最小调度接入

以下逻辑放入现有 `'use client'` 宿主组件。不是完整业务状态机：`resumeAction.current` 由宿主在请求开始、结束、拖动结束等事件中更新。不要在美术组件中实现这些计时器。

```tsx
const [action, setAction] = useState<PetAction>('idle');
const [actionKey, setActionKey] = useState(0);
const resumeAction = useRef<PetAction>('idle');
const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const generation = useRef(0);

function play(next: PetAction, after?: () => void) {
  const token = ++generation.current;
  if (finishTimer.current !== null) clearTimeout(finishTimer.current);
  finishTimer.current = null;
  setAction(next);
  setActionKey(key => key + 1);
  const spec = ACTIONS[next];
  if (spec.kind === 'once') {
    finishTimer.current = setTimeout(() => {
      if (token !== generation.current) return;
      finishTimer.current = null;
      if (after) {
        after(); // 回调负责选择下一动作，不要留空。
      } else {
        const target = spec.next === 'resume' ? resumeAction.current : spec.next;
        setAction(target);
        setActionKey(key => key + 1);
      }
    }, spec.durationMs);
  }
}

useEffect(() => () => {
  ++generation.current;
  if (finishTimer.current !== null) clearTimeout(finishTimer.current);
}, []);
```

还需从 React 导入 `useState`、`useRef`、`useEffect`。宿主只能将 `resumeAction.current` 设置为当前应恢复的持续状态（idle/sleep/think-curious/think-spin），不要存入一次性动作，否则示例的自动恢复不会继续为其设置结束计时。

示例调用：

```tsx
play('happy');                         // 完成后恢复业务状态
play('bye');                           // 完成后进入睡眠，位置不变
play('wake', () => play('greet'));      // 苏醒后问好
play('drag-shy');                      // 持续到宿主发下一条指令
play(resumeAction.current);            // 例如拖动结束时恢复
```

示例只处理动作结束计时。宿主还需分别管理下述空闲、悬停、长思考计时器，并在取消、卸载时清理。

## 事件对照与冲突处理

### 空闲与睡眠

面板关闭、无请求、未拖动、无其他动作时，空闲约 45 秒：`play('doze')`，结束进入 sleep。自然睡眠约 30 秒后，先设置 `resumeAction.current = 'idle'`，再 `play('wake')`，随后 idle，重新开始空闲计时。尤其关闭面板曾将恢复目标设为 sleep 时，不能遗漏这次更新，否则苏醒结束又会进入睡眠。

关闭面板触发的睡眠可以保持到下一次交互，也可采用相同自然苏醒策略，由产品选择。睡眠计时从真正进入 sleep 开始，不从 bye/doze 开始。鼠标/键盘的整页静止不等同于角色空闲；不要监听每次页面鼠标移动就重置。

### 悬停问好

在现有角色命中容器监听 `pointerenter/leave`，仅鼠标启用；进入后延迟约 250ms 确认，离开立即取消。每次进入最多一次，建议 8 秒冷却。拖动、请求思考、面板关闭动画期间不问好。

如果睡着，先将恢复目标更新为当前唤醒后的业务状态（空闲时为 idle），再 wake；wake 完成时重新检查光标仍在、没有点击/请求/拖动，再 greet，否则恢复业务状态。不要无条件使用上面的链式示例。如果随后发生点击，点击的 happy 会替换 greet，不要同时排队。

### 对话框开关

- 打开：立即打开面板，取消空闲/睡眠/悬停计时，恢复目标设为 idle，`play('happy')`。
- 关闭：取消当前请求或使其角色反馈失效，清理思考计时，恢复目标设为 sleep，`play('bye')`。动画结束保持原位置进入 sleep，不移动、不淡出、不隐藏。
- 不要把拖动结束产生的 click 当成打开/关闭。沿用宿主已有的拖曳阈值与点击抑制。

### 挤开与拖动

- 面板真正造成一次避让移动时播放 grumpy；按一次碰撞事件节流，不要在每一帧坐标变化时触发。主动拖动和自己浮动不是“被挤开”。
- pointerdown 先准备拖动；超过宿主既有拖曳阈值才进入 drag-shy，避免普通点击出现挣扎。
- pointerup、pointercancel、lostpointercapture 均应结束 drag-shy。重新计算恢复目标：请求仍在就恢复思考，否则 idle；不要停留在挣扎状态。
- 宿主继续传 --pet-angle；drag-shy 自身不叠加大幅整体旋转。

### 对话请求

1. 每次请求使用独立 requestId；记录 pending 和开始时间，恢复目标设为 think-curious，播放该动作。
2. 等待约 4 秒仍未收到有效回答时，恢复目标改为 think-spin；若正在拖动只更新恢复目标，不中断拖动。
3. 第一次有效回答内容到达时，标记该 requestId 已触发顿悟、取消长思考计时，恢复目标设为 idle，然后 idea。不要在每个流式 chunk 都触发。
4. 若有效内容到达时正在拖动，只更新恢复目标，丢弃这次顿悟，避免突然打断拖动。松手后回 idle。
5. 请求失败/取消时清理 pending 与计时，恢复目标改为 idle，不播放 idea；若正在拖动则松手再恢复。
6. 关闭面板后、被新请求替换后或卸载后，旧 requestId 的响应不得更改角色。仅取消动作计时器不足以阻止旧网络回调。

### 优先级建议

主动拖动最高；关闭操作取消当前业务表演（若仍在拖动，结束拖动后执行）；有效回复/思考高于问好和挤开；睡眠只在空闲时进入。挤开、问好等低优先级反馈过时即丢弃，不排队。离开后台后重新核对业务状态，不补播过时动作。

系统减少动态效果时 CSS 显示统一静态造型，宿主也应停止自动 idle/sleep 生活计时，只保留必要业务状态。不要依赖 animationend：减少动态效果下 CSS 不会发该事件。

## 验收与已知边界

用真实 64px 尺寸检查全部动作、5 次 happy 扑扇、重复触发、播放中拖动、四角及 ±6° 倾斜、reduce 模式。检查 doze/bye→sleep、sleep→wake→idle，关闭后旧回复不唤醒，拖动结束不丢失思考状态。

FRAME / CHAR 未变，动画可能在静态 CHAR 外少量移动但必须保持在 FRAME 内；宿主仍使用原来的静态命中/避让矩形。如果要求动态像素级避让，需要另议契约。本包不承诺宿主未测试环境的运行结果，TSX/CSS 编译不代替 Next.js 类型检查、构建或真实浏览器视觉验收。
