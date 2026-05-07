"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
        <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
      </svg>
    ),
    match: (p: string) => p === "/dashboard",
  },
  {
    href: "/research-objects/new",
    label: "Research Objects",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
    match: (p: string) => p.startsWith("/research-objects"),
  },
  {
    href: "/runs/new",
    label: "Runs",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
    ),
    match: (p: string) => p.startsWith("/runs"),
  },
] as const;

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-56 shrink-0 flex-col border-r border-[#222] bg-surface sticky top-0">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-[#222]">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-sm font-semibold text-foreground group-hover:text-teal transition-colors">
            CasAI
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-teal/10 text-teal font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
              )}
            >
              <span className={active ? "text-teal" : "text-muted-foreground"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* + New button */}
      <div className="px-3 pb-3">
        <Link
          href="/research-objects/new"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal/10 border border-teal/20 px-3 py-2 text-sm font-medium text-teal hover:bg-teal/15 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New Research Object
        </Link>
      </div>

      {/* Demo badge */}
      <div className="border-t border-[#222] px-4 py-3">
        <p className="text-[11px] text-muted-foreground/40 text-center">Demo mode — mock data</p>
      </div>
    </aside>
  );
}
