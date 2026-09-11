import { notFound } from "next/navigation";
import MemoryScene from "@/components/memory-scene/MemoryScene";
import { getCategoryPath, getMemoryWithMedia } from "@/lib/db/queries";

export default async function MemoryPage({ params }: PageProps<"/memory/[id]">) {
  const { id } = await params;
  const memory = getMemoryWithMedia(id);
  if (!memory) notFound();
  return <MemoryScene memory={memory} breadcrumb={getCategoryPath(memory.categoryId)} />;
}
