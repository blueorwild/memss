/**
 * 访客可用的 OpenCode Zen 免费模型白名单。
 *
 * 这些模型仍然需要一把 Zen API Key（免费 ≠ 免登录），Key 由站长在「设置 → 访客对话」里配置；
 * 未登录的访客只能在白名单内切换模型，不能填写 Key、也不能换服务商。
 *
 * 只收录 OpenAI 兼容的 `/chat/completions` 端点：
 * `union-alpha`（/messages）与 `muse-spark-1.3-contributor-free`（/responses）需要另外的 SDK，暂不收录。
 */

export type FreeModel = {
  id: string;
  name: string;
  /** 隐私提示（部分免费档会记录使用数据） */
  note?: string;
};

export const FREE_MODEL_BASE_URL = "https://opencode.ai/zen/v1";

/** 访客可选免费模型（第一项为默认） */
export const FREE_MODELS: FreeModel[] = [
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning",
    note: "NVIDIA 试用端点会记录使用数据，请勿输入隐私内容",
  },
  {
    id: "mimo-v2.5-free",
    name: "MiMo-V2.5",
    note: "免费期间数据可能用于改进模型",
  },
  {
    id: "big-pickle",
    name: "Big Pickle",
    note: "隐身模型，免费期间数据可能用于训练",
  },
  { id: "ling-3.0-flash-fin-free", name: "Ling 3.0 Flash Fin" },
  {
    id: "nemotron-3-ultra-free",
    name: "Nemotron 3 Ultra",
    note: "NVIDIA 试用端点会记录使用数据，请勿输入隐私内容",
  },
];

export const DEFAULT_FREE_MODEL = FREE_MODELS[0].id;

export function getFreeModel(id: string | undefined): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}

export function isFreeModel(id: string | undefined): boolean {
  return getFreeModel(id) !== undefined;
}

/** 访客使用的免费模型名（未知 id 退回默认） */
export function freeModelName(id: string | undefined): string {
  return getFreeModel(id)?.name ?? FREE_MODELS[0].name;
}

/** 访客所选免费模型的 localStorage 键（服务端会按白名单再校验一次） */
const CHOICE_KEY = "memss:free-model";

export function readFreeModelChoice(): string {
  if (typeof window === "undefined") return DEFAULT_FREE_MODEL;
  try {
    const saved = localStorage.getItem(CHOICE_KEY) ?? undefined;
    return isFreeModel(saved) ? (saved as string) : DEFAULT_FREE_MODEL;
  } catch {
    return DEFAULT_FREE_MODEL;
  }
}

export function writeFreeModelChoice(id: string): void {
  if (!isFreeModel(id)) return;
  try {
    localStorage.setItem(CHOICE_KEY, id);
  } catch {
    /* 存储失败忽略 */
  }
}
