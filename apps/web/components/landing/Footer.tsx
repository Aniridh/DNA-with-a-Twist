import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#222] bg-[#0a0a0a] py-16 px-6">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <p className="text-sm font-semibold text-foreground">DNA with a Twist</p>
          <p className="text-xs text-muted-foreground">Provenance-first gene simulation</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md bg-teal px-5 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors"
          >
            Try the demo
          </Link>
          <p className="text-[11px] text-muted-foreground/50">MVP demo — backend in development</p>
        </div>
      </div>
    </footer>
  );
}
