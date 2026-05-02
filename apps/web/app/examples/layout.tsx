import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ExamplesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 max-w-6xl flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
              DNA with a Twist
            </Link>
            <span className="text-muted-foreground text-xs font-mono">Provenance Lab</span>
            <span className="text-muted-foreground/40 text-xs">›</span>
            <Link href="/examples" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Examples
            </Link>
          </div>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Try the demo
          </Link>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {children}
      </main>
    </div>
  );
}
