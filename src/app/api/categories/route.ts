import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getCategoryPath, listCategories } from "@/lib/db/queries";

/** 最大层级（含地球）：地球-国家-省-市-自建 */
const MAX_DEPTH = 5;

/** 返回全部类别，供上传表单的类别级联使用 */
export async function GET() {
  return Response.json(listCategories());
}

/** 新建子类别：校验父级深度（≤5 级）与同级重名 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { parentId?: unknown; name?: unknown }
    | null;
  const parentId = typeof body?.parentId === "string" ? body.parentId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!parentId || !name) {
    return Response.json({ error: "父级与名称为必填项" }, { status: 400 });
  }

  const parentPath = getCategoryPath(parentId);
  if (parentPath.length === 0) {
    return Response.json({ error: "父级类别不存在" }, { status: 404 });
  }
  // 父级深度已达上限则不能再建子级（新建后深度 = 父深度 + 1）
  if (parentPath.length >= MAX_DEPTH) {
    return Response.json({ error: `类别最多 ${MAX_DEPTH} 级，无法继续新建` }, { status: 400 });
  }

  const siblings = db
    .select()
    .from(categories)
    .where(eq(categories.parentId, parentId))
    .all();
  if (siblings.some((c) => c.name === name)) {
    return Response.json({ error: "同级已存在同名类别" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const sortOrder = siblings.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  db.insert(categories).values({ id, parentId, name, kind: "custom", sortOrder }).run();

  return Response.json({ id });
}
