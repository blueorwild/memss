import { redirect } from "next/navigation";
import GuestHome from "@/components/sprite/GuestHome";
import { isOwner } from "@/lib/auth";

/** 首页：未登录是一片空星空（只有小精灵）；已登录进入星空根节点 */
export default async function Home() {
  if (!(await isOwner())) return <GuestHome />;
  redirect("/star/globe");
}
