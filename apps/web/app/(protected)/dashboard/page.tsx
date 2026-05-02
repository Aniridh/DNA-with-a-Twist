import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name = user?.email?.split("@")[0] ?? "researcher";

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {greeting()}, <span className="text-teal">{name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link
          href="/research-objects/new"
          className="inline-flex h-10 items-center rounded-lg bg-teal px-5 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors"
        >
          + New Research Object
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Research Objects", value: "0" },
          { label: "Total Runs", value: "0" },
          { label: "Verifications", value: "0" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#222] bg-surface p-5">
            <p className="text-xs text-muted-foreground mb-2">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent ROs */}
        <div className="rounded-xl border border-[#222] bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
            <h2 className="text-sm font-semibold text-foreground">Recent Research Objects</h2>
            <Link href="/research-objects/new" className="text-xs text-teal hover:text-teal-dim transition-colors">
              + New
            </Link>
          </div>
          <EmptyState
            title="No research objects yet"
            body="Upload a sequence to create your first verifiable Research Object."
            cta={{ label: "Create Research Object", href: "/research-objects/new" }}
          />
        </div>

        {/* Recent Runs */}
        <div className="rounded-xl border border-[#222] bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
            <h2 className="text-sm font-semibold text-foreground">Recent Runs</h2>
          </div>
          <EmptyState
            title="No runs yet"
            body="Create a Research Object first, then start a simulation run."
            cta={null}
          />
        </div>
      </div>

      {/* Dev link */}
      {process.env.NODE_ENV === "development" && (
        <div className="pt-4">
          <Link
            href="/dev/primitives"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            Dev: UI Primitives →
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { label: string; href: string } | null;
}) {
  return (
    <div className="px-5 py-10 text-center space-y-3">
      <div className="mx-auto w-10 h-10 rounded-full border border-[#222] flex items-center justify-center text-muted-foreground/30">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex h-8 items-center rounded-lg border border-teal/30 bg-teal/5 px-4 text-xs font-medium text-teal hover:bg-teal/10 transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
