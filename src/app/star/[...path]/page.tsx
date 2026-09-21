import { notFound, redirect } from "next/navigation";
import StarfieldPage from "@/components/starfield/StarfieldPage";
import { isOwner } from "@/lib/auth";
import { guestBrowseAllowed } from "@/lib/settings";
import {
  getBreadcrumb,
  getCategory,
  getChildrenWithCounts,
  getSubtreeMemoryCounts,
  listMemoryCards,
} from "@/lib/db/queries";

export default async function StarPage({ params }: PageProps<"/star/[...path]">) {
  // 站长关闭「允许访客浏览」后：访客的深链一律回首页空星空（默认是开放只读浏览的）
  if (!(await isOwner()) && !guestBrowseAllowed()) redirect("/");

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
