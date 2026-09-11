import { listCategories } from "@/lib/db/queries";

/** 返回全部类别，供上传表单的下拉选择使用 */
export async function GET() {
  return Response.json(listCategories());
}
