import { SideNav } from "@/components/SideNav";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <SideNav />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
