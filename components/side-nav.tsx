"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, navItems } from "@/lib/nav-items";

// 桌面版（lg 以上）側邊導覽，與 BottomNav 共用 navItems；行動版隱藏。
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-surface-elevated px-4 py-6 lg:flex"
    >
      <Link href="/" className="mb-8 px-3 text-xl font-bold tracking-tight text-accent">
        Nearbite
      </Link>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-touch items-center gap-3 rounded-lg px-3 text-sm ${
                  active
                    ? "bg-brand-50 font-medium text-accent dark:bg-brand-900/30"
                    : "text-text-muted hover:bg-border/50 hover:text-text"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
