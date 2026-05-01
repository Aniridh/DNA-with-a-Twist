import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.getUser(); // ensures session is refreshed

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your research objects and runs</p>
        </div>
        <Link href="/research-objects/new" className={cn(buttonVariants())}>
          New Research Object
        </Link>
      </div>

      <Separator />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Research Objects</h2>
          <Badge variant="secondary">0</Badge>
        </div>
        <EmptyState
          headline="No research objects yet"
          body="Upload a FASTA backbone and optional PDB / FASTQ files to create your first verifiable Research Object."
          cta={{ label: "Create your first Research Object", href: "/research-objects/new" }}
        />
      </section>

      <Separator />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Runs</h2>
          <Badge variant="secondary">0</Badge>
        </div>
        <EmptyState
          headline="No runs yet"
          body="Once you have a Research Object, start a simulation run and watch provenance events stream in real time."
          cta={null}
        />
      </section>

      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4">
          <Link
            href="/dev/primitives"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Dev: UI Primitives
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  headline,
  body,
  cta,
}: {
  headline: string;
  body: string;
  cta: { label: string; href: string } | null;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">{headline}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {cta && (
        <CardContent>
          <Link href={cta.href} className={cn(buttonVariants({ variant: "outline" }))}>
            {cta.label}
          </Link>
        </CardContent>
      )}
    </Card>
  );
}
