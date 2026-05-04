import { SideNav } from "@/components/SideNav";
import { MobileHeader, MobileBottomNav } from "@/components/MobileNav";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <SideNav />
      <div className="flex flex-1 min-w-0 flex-col">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-14 md:pb-0">
          <div className="mx-auto max-w-4xl px-4 sm:px-8 py-6 md:py-10">
            {children}
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
