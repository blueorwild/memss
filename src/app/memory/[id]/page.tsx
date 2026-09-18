import { notFound, redirect } from "next/navigation";
import MemoryScene from "@/components/memory-scene/MemoryScene";
import { isOwner } from "@/lib/auth";
import { getCategoryPath, getMemoryWithMedia } from "@/lib/db/queries";

export default async function MemoryPage({ params }: PageProps<"/memory/[id]">) {
  // 未登录访客：回忆数据不可见，深链一律回首页空星空
  if (!(await isOwner())) redirect("/");

  const { id } = await params;
  const memory = getMemoryWithMedia(id);
  if (!memory) notFound();
  return <MemoryScene memory={memory} breadcrumb={getCategoryPath(memory.categoryId)} />;
}
