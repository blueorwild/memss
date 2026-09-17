import { tool } from "ai";
import { z } from "zod";
import {
  attachCovers,
  getCategory,
  getCategoryPath,
  getSubtreeMemoryCounts,
  listCategories,
  listMemories,
} from "./db/queries";
import { deleteCategoryById, deleteMemoryById, updateMemory } from "./db/mutations";
import { isRootCategory } from "./category-path";
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  buildCategoryPaths,
  searchMemories as runMemorySearch,
} from "./memory-search";
import type { Category, Memory } from "./db/schema";

/** 需要前端执行的动作 */
export type ClientAction =
  | { type: "navigate"; path: string }
  | {
      type: "openUpload";
      draft: { categoryId?: string; title?: string; description?: string; date?: string };
    }
  | { type: "openEdit"; memoryId: string }
  | { type: "openSearch"; query?: string; categoryId?: string }
  | { type: "moved"; memoryId: string; path: string }
  | { type: "forgotten"; kind: "memory" | "category"; targetId: string; fallbackPath: string };

/** 类别路径名（去根节点），用于生成记忆的 location 文本 */
function locationOfCategory(categoryId: string): string {
  return getCategoryPath(categoryId)
    .filter((c) => !isRootCategory(c))
    .map((c) => c.name)
    .join(" / ");
}

/** 按名称解析类别：精确优先，否则取第一个包含匹配，并给出多匹配提示 */
function findCategoryByName(name: string): { cat: Category; note?: string } | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const cats = listCategories();
  const exact = cats.find((c) => c.name.toLowerCase() === q);
  if (exact) return { cat: exact };
  const partial = cats.filter((c) => c.name.toLowerCase().includes(q));
  if (partial.length === 0) return null;
  const note =
    partial.length > 1
      ? `存在多个匹配：${partial
          .slice(0, 5)
          .map((c) => c.name)
          .join("、")}，已选择「${partial[0].name}」。`
      : undefined;
  return { cat: partial[0], note };
}

/** 按 id（优先）或标题解析一条回忆 */
function resolveMemory(
  all: Memory[],
  memoryId?: string,
  title?: string,
): { ok: true; mem: Memory; note?: string } | { ok: false; message: string } {
  let targetId = memoryId?.trim() || undefined;
  let note: string | undefined;
  if (!targetId) {
    const q = title?.trim().toLowerCase();
    if (!q) return { ok: false, message: "请提供回忆标题或 id。" };
    const exact = all.find((m) => m.title.toLowerCase() === q);
    const partial = all.filter((m) => m.title.toLowerCase().includes(q));
    const chosen = exact ?? partial[0];
    if (!chosen) return { ok: false, message: `没有找到标题含「${title}」的回忆。` };
    if (!exact && partial.length > 1) {
      note = `存在多条匹配：${partial
        .slice(0, 5)
        .map((m) => m.title)
        .join("、")}，已选择「${chosen.title}」。`;
    }
    targetId = chosen.id;
  }
  const mem = all.find((m) => m.id === targetId);
  if (!mem) return { ok: false, message: "该回忆不存在。" };
  return { ok: true, mem, note };
}

/**
 * 创建小精灵的工具集。
 * ctx.currentCategoryId：用户当前所在类别（用于默认归属与导航上下文）。
 * 危险操作（遗忘 / 迁移）的二次确认：语义判断交给模型，但服务端要求
 * **「先问过」这个上下文**——ctx.consentAsked 为 true 时（上一轮工具真的返回过 needConfirm，
 * 即小精灵确实问过用户），才认 confirm=true。这样首句祈使句（「把它删了吧」）无法一次通过，
 * 模型必须先把话复述出来问一次；用户怎么回答（是的 / 好的 / 可以 / 嗯…）仍由模型判断。
 */
export function createAgentTools(ctx: { currentCategoryId?: string; consentAsked?: boolean }) {
  return {
    searchMemories: tool({
      description:
        "检索用户的回忆。可按关键词（匹配标题/描述/地点）、类别（含其子类别）、日期范围过滤。回答“我有哪些回忆”这类问题前应先调用。返回的每条包含 id、标题、日期、location 与所属类别路径 category，便于按地点/归属做筛选。",
      inputSchema: z.object({
        query: z.string().optional().describe("关键词"),
        categoryId: z.string().optional().describe("限定类别 id（含其子类别）"),
        from: z.string().optional().describe("起始日期 YYYY-MM-DD"),
        to: z.string().optional().describe("结束日期 YYYY-MM-DD"),
        limit: z
          .number()
          .optional()
          .describe(`返回条数上限，默认 ${SEARCH_DEFAULT_LIMIT}、最大 ${SEARCH_MAX_LIMIT}`),
      }),
      execute: ({ query, categoryId, from, to, limit }) => {
        const { total, count, items } = runMemorySearch({ query, categoryId, from, to, limit });
        return {
          total,
          count,
          items: items.map((m) => ({
            id: m.id,
            title: m.title,
            date: m.date,
            location: m.location,
            category: m.category,
          })),
        };
      },
    }),

    showMemories: tool({
      description:
        "把筛选好的回忆以卡片形式展示给用户。用法：先用 searchMemories 获取候选，再按用户条件过滤，然后用本工具显式列出本批要展示的回忆 id（每批最多 3 条），并给出符合条件的结果总数 total。不要用它罗列未经筛选的结果；正文不要逐条复述卡片内容。",
      inputSchema: z.object({
        memoryIds: z.array(z.string()).describe("本批要展示的回忆 id，最多 3 条"),
        total: z
          .number()
          .optional()
          .describe("符合用户条件的回忆总数（用于“共 N 条 / 还有 X 条”提示）"),
      }),
      execute: ({ memoryIds, total }) => {
        const byId = new Map(listMemories().map((m) => [m.id, m]));
        const picked = memoryIds
          .map((id) => byId.get(id))
          .filter((m): m is Memory => Boolean(m))
          .slice(0, 3);
        const paths = buildCategoryPaths();
        // 附带封面与地点，前端卡片与搜索面板共用同一渲染组件
        const items = attachCovers(picked).map((m) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          location: m.location,
          category: paths.get(m.categoryId) ?? "",
          cover: m.cover,
        }));
        return {
          ok: true,
          count: items.length,
          total: Math.max(total ?? items.length, items.length),
          items,
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

    openEditMemory: tool({
      description:
        "打开某条回忆的编辑面板（可改标题、描述、类别、日期、图片与音乐）。用户表示想修改/编辑某条回忆时调用，可按标题或 id。",
      inputSchema: z.object({
        memoryId: z.string().optional().describe("回忆 id（已知时优先）"),
        title: z.string().optional().describe("回忆标题"),
      }),
      execute: ({ memoryId, title }) => {
        const resolved = resolveMemory(listMemories(), memoryId, title);
        if (!resolved.ok) return { ok: false, message: resolved.message };
        const clientAction: ClientAction = { type: "openEdit", memoryId: resolved.mem.id };
        return { ok: true, title: resolved.mem.title, note: resolved.note, clientAction };
      },
    }),

    moveMemory: tool({
      description:
        "把一条回忆迁移到另一个类别（即改归属地点）。可逆操作，但会改变归属：需先向用户复述「哪条回忆 → 迁到哪个类别」并问一次；首次调用必须 confirm=false（先征求同意），得到肯定回复后再以 confirm=true 调用。对方语气再确定也要先问。",
      inputSchema: z.object({
        memoryId: z.string().optional().describe("回忆 id（已知时优先）"),
        title: z.string().optional().describe("回忆标题"),
        categoryId: z.string().optional().describe("目标类别 id（已知时优先）"),
        categoryName: z.string().optional().describe("目标类别名称，如「东京」「云南」"),
        confirm: z
          .boolean()
          .optional()
          .describe("用户是否已表示同意；肯定的回复都算（是的 / 好的 / 可以 / 嗯 / 行 / OK 等）"),
      }),
      execute: async ({ memoryId, title, categoryId, categoryName, confirm }) => {
        const resolved = resolveMemory(listMemories(), memoryId, title);
        if (!resolved.ok) return { ok: false, message: resolved.message };

        // 解析目标类别：优先 id，否则按名称
        let targetId = categoryId?.trim() || undefined;
        let note = resolved.note;
        if (targetId && !getCategory(targetId)) {
          return { ok: false, message: "目标类别不存在。" };
        }
        if (!targetId) {
          if (!categoryName?.trim()) {
            return { ok: false, message: "请提供要迁移到的类别名称或 id。" };
          }
          const found = findCategoryByName(categoryName);
          if (!found) return { ok: false, message: `没有找到名为「${categoryName}」的类别。` };
          targetId = found.cat.id;
          note = [note, found.note].filter(Boolean).join(" ") || undefined;
        }
        const cat = getCategory(targetId!);
        if (!cat) return { ok: false, message: "目标类别不存在。" };
        if (cat.id === resolved.mem.categoryId) {
          return { ok: false, message: `《${resolved.mem.title}》已经归属「${cat.name}」了。` };
        }

        // 未获得用户明确同意时，只返回待确认信息
        if (!confirm || !ctx.consentAsked) {
          return {
            needConfirm: true,
            memory: {
              id: resolved.mem.id,
              title: resolved.mem.title,
              location: resolved.mem.location,
            },
            target: { id: cat.id, name: cat.name },
            note,
            message: `将把《${resolved.mem.title}》从「${resolved.mem.location || "未设置"}」迁移到「${cat.name}」。请先向用户确认，得到同意后再以 confirm=true 调用。`,
          };
        }

        updateMemory(resolved.mem.id, {
          categoryId: cat.id,
          location: locationOfCategory(cat.id),
        });
        const path = `/memory/${resolved.mem.id}`;
        const clientAction: ClientAction = { type: "moved", memoryId: resolved.mem.id, path };
        return { ok: true, title: resolved.mem.title, category: cat.name, note, clientAction };
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

    openSearch: tool({
      description:
        "为用户打开「搜索回忆」面板（可按关键词、类别、日期筛选并一次列出全部结果）。当用户想自己翻找/浏览回忆，或结果较多（超出卡片每批 3 条）时调用。",
      inputSchema: z.object({
        query: z.string().optional().describe("预填关键词"),
        categoryId: z.string().optional().describe("预填类别 id"),
      }),
      execute: ({ query, categoryId }) => {
        const clientAction: ClientAction = {
          type: "openSearch",
          ...(query ? { query } : {}),
          ...(categoryId && getCategory(categoryId) ? { categoryId } : {}),
        };
        return { ok: true, message: "已打开搜索面板，可以直接翻看全部结果。", clientAction };
      },
    }),

    forgetMemory: tool({
      description:
        "遗忘（永久删除）一条回忆。危险操作：必须先向用户复述并问一次；首次调用必须 confirm=false（先征求同意），对方给出肯定回复后再以 confirm=true 调用。对方语气再确定也要先问；肯定回复即算同意，不必要求对方说「确认」。",
      inputSchema: z.object({
        memoryId: z.string().optional().describe("回忆 id（已知时优先）"),
        title: z.string().optional().describe("回忆标题"),
        confirm: z
          .boolean()
          .optional()
          .describe("用户是否已表示同意；肯定的回复都算（是的 / 好的 / 可以 / 嗯 / 行 / OK 等）"),
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
        if (!confirm || !ctx.consentAsked) {
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
        "遗忘（删除）一个类别。危险操作：必须先取得用户同意（肯定回复即算）。若类别（含子类别）下有回忆，须先让用户在「迁移到上一级」与「一并遗忘」之间选择。未获同意时本工具只返回待确认信息、不会删除。根类别不可删除。",
      inputSchema: z.object({
        categoryId: z.string().optional().describe("类别 id（已知时优先）"),
        name: z.string().optional().describe("类别名称"),
        mode: z
          .enum(["purge", "move"])
          .optional()
          .describe("purge=一并遗忘回忆；move=把回忆迁移到上一级"),
        confirm: z
          .boolean()
          .optional()
          .describe("用户是否已表示同意；肯定的回复都算（是的 / 好的 / 可以 / 嗯 / 行 / OK 等）"),
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
        // 这里用 !parentId 而非 isRootCategory()：保留 TS 对收窄，下方 getCategoryPath 需要 string
        if (!cat.parentId) return { ok: false, message: "根类别不可删除。" };

        const memoryCount = getSubtreeMemoryCounts().get(cat.id) ?? 0;
        const options = memoryCount > 0 ? ["move", "purge"] : ["purge"];

        if (!confirm || !ctx.consentAsked) {
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
