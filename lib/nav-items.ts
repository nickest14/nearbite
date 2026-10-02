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
