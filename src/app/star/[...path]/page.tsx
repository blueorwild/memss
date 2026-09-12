import { notFound, redirect } from "next/navigation";
import StarfieldPage from "@/components/starfield/StarfieldPage";
import {
  getBreadcrumb,
  getCategory,
  getChildrenWithCounts,
  getSubtreeMemoryCounts,
  listMemoryCards,
} from "@/lib/db/queries";

export default async function StarPage({ params }: PageProps<"/star/[...path]">) {
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
