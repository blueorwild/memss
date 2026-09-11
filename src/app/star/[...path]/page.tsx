import { notFound, redirect } from "next/navigation";
import StarfieldPage from "@/components/starfield/StarfieldPage";
import {
  getBreadcrumb,
  getCategory,
  getChildrenWithCounts,
  listMemoryCards,
} from "@/lib/db/queries";

export default async function StarPage({ params }: PageProps<"/star/[...path]">) {
  const { path } = await params;
  if (path.length === 0) redirect("/star/globe");

  const currentId = path[path.length - 1];
  const current = getCategory(currentId);
  if (!current) notFound();

  return (
    <StarfieldPage
      path={path}
      current={current}
      categories={getChildrenWithCounts(currentId)}
      memories={listMemoryCards(currentId)}
      breadcrumb={getBreadcrumb(path)}
    />
  );
}
