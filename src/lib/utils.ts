import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并类名：clsx 负责条件拼接，tailwind-merge 负责消除 Tailwind 冲突类 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
