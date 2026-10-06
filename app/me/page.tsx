import type { Metadata } from "next";

import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";

import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: "我",
};

export default async function MePage() {
  const user = await requireUser({ returnTo: "/me" });

  return (
    <>
      <PageHeader title="我" description="你的評論、清單與設定。" />

      <section className="flex items-center gap-4 rounded-card border border-border bg-surface-elevated p-4">
        <Avatar name={user.name} image={user.image} size={56} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name ?? "未命名"}</p>
          <p className="truncate text-sm text-text-muted">{user.email}</p>
        </div>
      </section>

      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="min-h-touch w-full rounded-lg border border-border px-4 text-sm font-medium text-text hover:bg-border/50"
        >
          登出
        </button>
      </form>
    </>
  );
}
