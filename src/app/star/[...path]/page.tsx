import { notFound, redirect } from "next/navigation";
import StarfieldPage from "@/components/starfield/StarfieldPage";
import { isOwner } from "@/lib/auth";
import {
  getBreadcrumb,
  getCategory,
  getChildrenWithCounts,
  getSubtreeMemoryCounts,
  listMemoryCards,
} from "@/lib/db/queries";

export default async function StarPage({ params }: PageProps<"/star/[...path]">) {
  // 未登录访客：回忆数据不可见，深链一律回首页空星空
  if (!(await isOwner())) redirect("/");

  const { path } = await params;
  if (path.length === 0) redirect("/star/globe");

  const currentId = path[path.length - 1];
  const current = getCategory(currentId);
  if (!current) notFound();

  // 当前类别子树的回忆总数（含子类别），用于删除确认弹层显示
  const currentCount = getSubtreeMemoryCounts().get(currentId) ?? 0;

  return (
    <StarfieldPage
      path={path}
      current={current}
      currentCount={currentCount}
      categories={getChildrenWithCounts(currentId)}
      memories={listMemoryCards(currentId)}
      breadcrumb={getBreadcrumb(path)}
    />
  );
}
