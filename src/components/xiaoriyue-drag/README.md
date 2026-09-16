# Happy 动作接入（v5）

替换 `PetArt.tsx` 和 `PetArt.module.css`。未传动作参数时仍为原有待机，无需修改定位、拖曳、命中区或面板逻辑。

- `action`: `"idle" | "happy"`，默认 `idle`。
- `actionKey`: 数字，默认 0；递增可重新播放同一动作，仅重建内部美术运动层，不重建宿主或倾斜层。
- `ACTION_DURATION_MS.happy`: 1800。播放快速振翅、上提、笑眼和增强光晕。
- 动作结束不会自行修改 props；宿主负责切回 `idle`。若不切回，保持动作末尾姿态。
- 当前采用确定起止姿态，不承诺任意待机相位无缝混合；触发或重播时可能有轻微姿态复位。结束姿态与待机起始姿态对齐。

## 宿主示例

将以下状态与处理函数合并到现有客户端宿主中，不要替换原来的拖曳容器。测试按钮也可改成现有业务逻辑中的 `playHappy()` 调用。

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import PetArt, { ACTION_DURATION_MS, type PetAction } from './PetArt';

export default function PetHost() {
  const [action, setAction] = useState<PetAction>('idle');
  const [actionKey, setActionKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  function playHappy() {
    if (timer.current !== null) clearTimeout(timer.current);
    setAction('happy');
    setActionKey(key => key + 1);
    timer.current = setTimeout(() => {
      setAction('idle');
      timer.current = null;
    }, ACTION_DURATION_MS.happy);
  }

  return (
    <>
      <button onClick={playHappy}>播放开心</button>
      {/* 放在现有宿主容器内，保留原有 className、颜色和尺寸配置。 */}
      <PetArt action={action} actionKey={actionKey} />
    </>
  );
}
```

宿主定时器只切换动作状态，不驱动逐帧动画。重复触发会取消旧计时并从头播放；卸载会清理计时。系统减少动态效果模式下所有动作关闭，保留静态造型。

