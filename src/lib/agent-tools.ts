import { tool } from "ai";
import { z } from "zod";
import {
  getCategory,
  getCategoryPath,
  getSubtreeMemoryCounts,
  listCategories,
  listMemories,
} from "./db/queries";
import { deleteCategoryById, deleteMemoryById } from "./db/mutations";
import type { Memory } from "./db/schema";

/** 需要前端执行的动作 */
export type ClientAction =
  | { type: "navigate"; path: string }
  | {
      type: "openUpload";
      draft: { categoryId?: string; title?: string; description?: string; date?: string };
    }
  | { type: "forgotten"; kind: "memory" | "category"; targetId: string; fallbackPath: string };

/** 收集某类别子树内的全部回忆；不传类别则返回全部 */
function collectMemories(categoryId?: string): Memory[] {
  const all = listMemories();
  if (!categoryId) return all;

  const cats = listCategories();
  const childrenMap = new Map<string, string[]>();
  for (const c of cats) {
    if (!c.parentId) continue;
    const arr = childrenMap.get(c.parentId) ?? [];
    arr.push(c.id);
    childrenMap.set(c.parentId, arr);
  }

  const ids = new Set<string>();
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const ch of childrenMap.get(id) ?? []) stack.push(ch);
  }
  return all.filter((m) => ids.has(m.categoryId));
}

/**
 * 创建小精灵的工具集。
 * ctx.currentCategoryId：用户当前所在类别（用于默认归属与导航上下文）。
 * ctx.userConfirmed：本条用户消息是否表达了明确同意（用于删除类操作的二次确认校验）。
 */
export function createAgentTools(ctx: { currentCategoryId?: string; userConfirmed?: boolean }) {
  return {
    searchMemories: tool({
      description:
        "检索用户的回忆。可按关键词（匹配标题/描述/地点）、类别（含其子类别）、日期范围过滤。回答“我有哪些回忆”这类问题前应先调用。",
      inputSchema: z.object({
        query: z.string().optional().describe("关键词"),
        categoryId: z.string().optional().describe("限定类别 id（含其子类别）"),
        from: z.string().optional().describe("起始日期 YYYY-MM-DD"),
        to: z.string().optional().describe("结束日期 YYYY-MM-DD"),
        limit: z.number().optional().describe("返回条数上限，默认 5"),
      }),
      execute: ({ query, categoryId, from, to, limit }) => {
        const pool = collectMemories(categoryId);
        const q = query?.trim().toLowerCase();
        const filtered = pool.filter((m) => {
          if (from && (!m.date || m.date < from)) return false;
          if (to && (!m.date || m.date > to)) return false;
          if (!q) return true;
          return [m.title, m.description, m.location].some((v) => v?.toLowerCase().includes(q));
        });
        const capped = filtered.slice(0, Math.min(Math.max(limit ?? 5, 1), 20));
        return {
          total: filtered.length,
          count: capped.length,
          items: capped.map((m) => ({ id: m.id, title: m.title, date: m.date })),
        };
      },
    }),

    navigateToCategory: tool({
      description:
        "让星空界面跳转到某个类别。用户说“带我去某地 / 看看某类”时调用，可按名称或 id。",
      inputSchema: z.object({
        name: z.string().optional().describe("类别名称，如「日本」「云南」"),
        categoryId: z.string().optional().describe("类别 id（已知时优先）"),
      }),
      execute: ({ name, categoryId }) => {
        let targetId = categoryId?.trim() || undefined;
        let note: string | undefined;

        if (!targetId) {
          const q = name?.trim().toLowerCase();
          if (!q) return { ok: false, message: "请提供要前往的类别名称或 id。" };
          const cats = listCategories();
          const exact = cats.find((c) => c.name.toLowerCase() === q);
          const partial = cats.filter((c) => c.name.toLowerCase().includes(q));
          const chosen = exact ?? partial[0];
          if (!chosen) return { ok: false, message: `没有找到名为「${name}」的类别。` };
          if (!exact && partial.length > 1) {
            note = `存在多个匹配：${partial
              .slice(0, 5)
              .map((c) => c.name)
              .join("、")}，已选择「${chosen.name}」。`;
          }
          targetId = chosen.id;
        }

        const cat = getCategory(targetId);
        if (!cat) return { ok: false, message: "该类别不存在。" };

        const ids = getCategoryPath(cat.id).map((c) => c.id);
        const path = `/star/${ids.join("/")}`;
        const clientAction: ClientAction = { type: "navigate", path };
        return { ok: true, name: cat.name, path, note, clientAction };
      },
    }),

    openMemory: tool({
      description:
        "打开某条回忆的详情页。用户想查看/打开某条具体回忆时调用，可按标题或 id。",
      inputSchema: z.object({
        memoryId: z.string().optional().describe("回忆 id（已知时优先）"),
        title: z.string().optional().describe("回忆标题"),
      }),
      execute: ({ memoryId, title }) => {
        const all = listMemories();
        let targetId = memoryId?.trim() || undefined;
        let note: string | undefined;

        if (!targetId) {
          const q = title?.trim().toLowerCase();
          if (!q) return { ok: false, message: "请提供要打开的回忆标题或 id。" };
          const exact = all.find((m) => m.title.toLowerCase() === q);
          const partial = all.filter((m) => m.title.toLowerCase().includes(q));
          const chosen = exact ?? partial[0];
          if (!chosen) return { ok: false, message: `没有找到标题含「${title}」的回忆。` };
          if (!exact && partial.length > 1) {
            note = `存在多条匹配：${partial
              .slice(0, 5)
              .map((m) => m.title)
              .join("、")}，已打开「${chosen.title}」。`;
          }
          targetId = chosen.id;
        }

        const mem = all.find((m) => m.id === targetId);
        if (!mem) return { ok: false, message: "该回忆不存在。" };
        const path = `/memory/${mem.id}`;
        const clientAction: ClientAction = { type: "navigate", path };
        return { ok: true, title: mem.title, path, note, clientAction };
      },
    }),

    uploadMemory: tool({
      description:
        "为用户打开「上传回忆」面板并预填信息。用户表示想新增/上传一条回忆时调用；图片文件需用户自己选择。",
      inputSchema: z.object({
        title: z.string().optional().describe("回忆标题"),
        description: z.string().optional().describe("回忆描述"),
        date: z.string().optional().describe("发生日期 YYYY-MM-DD"),
        categoryId: z.string().optional().describe("归属类别 id，默认当前所在类别"),
      }),
      execute: ({ title, description, date, categoryId }) => {
        const finalCategoryId =
          categoryId && getCategory(categoryId) ? categoryId : ctx.currentCategoryId;
        const draft = {
          ...(finalCategoryId ? { categoryId: finalCategoryId } : {}),
          ...(title ? { title } : {}),
          ...(description ? { description } : {}),
          ...(date ? { date } : {}),
        };
        const clientAction: ClientAction = { type: "openUpload", draft };
        return {
          ok: true,
          message: "已为你打开上传面板并预填好，选择图片后保存即可。",
          clientAction,
        };
      },
    }),

    forgetMemory: tool({
      description:
        "遗忘（永久删除）一条回忆。危险操作：必须先向用户复述并取得明确同意；未获同意时本工具只返回待确认信息、不会删除。用户同意后再以 confirm=true 调用。",
      inputSchema: z.object({
        memoryId: z.string().optional().describe("回忆 id（已知时优先）"),
        title: z.string().optional().describe("回忆标题"),
        confirm: z.boolean().optional().describe("是否已获得用户明确同意"),
      }),
      execute: async ({ memoryId, title, confirm }) => {
        const all = listMemories();
        let targetId = memoryId?.trim() || undefined;
        let note: string | undefined;

        if (!targetId) {
          const q = title?.trim().toLowerCase();
          if (!q) return { ok: false, message: "请提供要遗忘的回忆标题或 id。" };
          const exact = all.find((m) => m.title.toLowerCase() === q);
          const partial = all.filter((m) => m.title.toLowerCase().includes(q));
          const chosen = exact ?? partial[0];
          if (!chosen) return { ok: false, message: `没有找到标题含「${title}」的回忆。` };
          if (!exact && partial.length > 1) {
            note = `存在多条匹配：${partial
              .slice(0, 5)
              .map((m) => m.title)
              .join("、")}，请让用户确认具体是哪一条。`;
          }
          targetId = chosen.id;
        }

        const mem = all.find((m) => m.id === targetId);
        if (!mem) return { ok: false, message: "该回忆不存在。" };

        // 未获得用户明确同意时，只返回待确认信息
        if (!confirm || !ctx.userConfirmed) {
          return {
            needConfirm: true,
            memory: { id: mem.id, title: mem.title, date: mem.date },
            note,
            message: `将永久遗忘《${mem.title}》，无法找回。请先向用户确认，得到同意后再以 confirm=true 调用。`,
          };
        }

        const fallbackPath = `/star/${getCategoryPath(mem.categoryId)
          .map((c) => c.id)
          .join("/")}`;
        const deleted = await deleteMemoryById(mem.id);
        if (!deleted) return { ok: false, message: "删除失败：回忆不存在。" };

        const clientAction: ClientAction = {
          type: "forgotten",
          kind: "memory",
          targetId: mem.id,
          fallbackPath,
        };
        return { ok: true, title: mem.title, clientAction };
      },
    }),

    forgetCategory: tool({
      description:
        "遗忘（删除）一个类别。危险操作：必须先取得用户明确同意。若类别（含子类别）下有回忆，须先让用户在「迁移到上一级」与「一并遗忘」之间选择。未获同意时本工具只返回待确认信息、不会删除。根类别不可删除。",
      inputSchema: z.object({
        categoryId: z.string().optional().describe("类别 id（已知时优先）"),
        name: z.string().optional().describe("类别名称"),
        mode: z
          .enum(["purge", "move"])
          .optional()
          .describe("purge=一并遗忘回忆；move=把回忆迁移到上一级"),
        confirm: z.boolean().optional().describe("是否已获得用户明确同意"),
      }),
      execute: async ({ categoryId, name, mode, confirm }) => {
        let targetId = categoryId?.trim() || undefined;
        if (!targetId) {
          const q = name?.trim().toLowerCase();
          if (!q) return { ok: false, message: "请提供要遗忘的类别名称或 id。" };
          const cats = listCategories();
          const exact = cats.find((c) => c.name.toLowerCase() === q);
          const partial = cats.filter((c) => c.name.toLowerCase().includes(q));
          const chosen = exact ?? partial[0];
          if (!chosen) return { ok: false, message: `没有找到名为「${name}」的类别。` };
          targetId = chosen.id;
        }

        const cat = getCategory(targetId);
        if (!cat) return { ok: false, message: "该类别不存在。" };
        if (!cat.parentId) return { ok: false, message: "根类别「地球」不可删除。" };

        const memoryCount = getSubtreeMemoryCounts().get(cat.id) ?? 0;
        const options = memoryCount > 0 ? ["move", "purge"] : ["purge"];

        if (!confirm || !ctx.userConfirmed) {
          return {
            needConfirm: true,
            category: { id: cat.id, name: cat.name },
            memoryCount,
            options,
            message:
              memoryCount > 0
                ? `「${cat.name}」及其子类别下有 ${memoryCount} 条回忆。请让用户选择：迁移到上一级（保留回忆），还是一并遗忘（删除回忆）；确认后再以 confirm=true 并带上对应 mode 调用。`
                : `将删除类别「${cat.name}」（其下没有回忆）。请先向用户确认，再以 confirm=true 调用。`,
          };
        }

        if (memoryCount > 0 && !mode) {
          return {
            ok: false,
            needConfirm: true,
            memoryCount,
            options,
            message: "该类别含回忆，请先让用户选择 move（迁移）或 purge（一并遗忘）。",
          };
        }

        const finalMode = memoryCount > 0 ? (mode as "purge" | "move") : "purge";
        const res = await deleteCategoryById(cat.id, finalMode);
        if (!res.ok) return { ok: false, message: res.error };

        const fallbackPath = `/star/${getCategoryPath(cat.parentId)
          .map((c) => c.id)
          .join("/")}`;
        const clientAction: ClientAction = {
          type: "forgotten",
          kind: "category",
          targetId: cat.id,
          fallbackPath,
        };
        return {
          ok: true,
          name: cat.name,
          mode: finalMode,
          affectedMemories: res.affectedMemories,
          clientAction,
        };
      },
    }),
  };
}
