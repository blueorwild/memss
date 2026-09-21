import { notFound, redirect } from "next/navigation";
import MemoryScene from "@/components/memory-scene/MemoryScene";
import { isOwner } from "@/lib/auth";
import { guestBrowseAllowed } from "@/lib/settings";
import { getCategoryPath, getMemoryWithMedia } from "@/lib/db/queries";

export default async function MemoryPage({ params }: PageProps<"/memory/[id]">) {
  // 站长关闭「允许访客浏览」后：访客的深链一律回首页空星空（默认是开放只读浏览的）
  if (!(await isOwner()) && !guestBrowseAllowed()) redirect("/");

  const { id } = await params;
  const memory = getMemoryWithMedia(id);
  if (!memory) notFound();
  return <MemoryScene memory={memory} breadcrumb={getCategoryPath(memory.categoryId)} />;
}
