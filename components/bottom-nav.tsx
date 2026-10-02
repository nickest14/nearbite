"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, navItems } from "@/lib/nav-items";

// 行動版底部導覽。需要 usePathname 判斷當前頁面，所以是 Client Component；
// 桌面版（lg 以上）隱藏，改由 SideNav 呈現。
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-elevated pb-safe lg:hidden"
    >
      <ul className="flex h-nav items-stretch">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full min-h-touch min-w-touch flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-medium text-accent" : "text-text-muted"
                }`}
              >
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
