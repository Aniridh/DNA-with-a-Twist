"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p: string) => p === "/dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
        <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
      </svg>
    ),
  },
  {
    href: "/research-objects/new",
    label: "Objects",
    match: (p: string) => p.startsWith("/research-objects"),
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/runs/new",
    label: "Runs",
    match: (p: string) => p.startsWith("/runs"),
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
    ),
  },
] as const;

export function MobileHeader() {
  return (
    <header className="md:hidden flex h-12 shrink-0 items-center justify-between border-b border-[#222] bg-surface px-4">
      <Link href="/" className="text-sm font-semibold text-foreground">
        CasAI
      </Link>
      <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">Demo</span>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-14 border-t border-[#222] bg-surface">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors min-h-[44px]",
              active ? "text-teal" : "text-muted-foreground"
            )}
          >
            <span className={active ? "text-teal" : "text-muted-foreground/60"}>{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
