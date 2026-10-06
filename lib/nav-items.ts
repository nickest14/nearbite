import { Bookmark, Compass, Search, User, type LucideIcon } from "lucide-react";

export type NavHref = "/" | "/search" | "/lists" | "/me";

export type NavItem = {
  href: NavHref;
  label: string;
  icon: LucideIcon;
};

// 底部導覽與桌面側欄共用的單一來源，順序即顯示順序。
export const navItems: readonly NavItem[] = [
  { href: "/", label: "探索", icon: Compass },
  { href: "/search", label: "搜尋", icon: Search },
  { href: "/lists", label: "收藏", icon: Bookmark },
  { href: "/me", label: "我", icon: User },
];

// 首頁只在完全相同時算 active；其他項目連同子路徑（例如 /lists/abc）一起高亮。
export function isActivePath(pathname: string, href: NavHref): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// 不顯示主要導覽的頁面：登入頁（未登入時導覽沒有意義）。之後有全螢幕頁面在這裡加。
const navHiddenPaths: ReadonlySet<string> = new Set(["/login"]);

export function isNavHidden(pathname: string): boolean {
  return navHiddenPaths.has(pathname);
}
