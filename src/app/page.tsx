import { redirect } from "next/navigation";
import GuestHome from "@/components/sprite/GuestHome";
import { isOwner } from "@/lib/auth";
import { guestBrowseAllowed } from "@/lib/settings";

/** 首页：进得去星空就进（站长 / 允许浏览的访客）；否则是一片空星空（只有小精灵） */
export default async function Home() {
  if ((await isOwner()) || guestBrowseAllowed()) redirect("/star/globe");
  return <GuestHome />;
}
