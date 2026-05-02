import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { SideNav } from "@/components/SideNav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <SideNav userEmail={user.email ?? ""} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
