import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Pipeline } from "@/components/landing/Pipeline";
import { DemoTeaser } from "@/components/landing/DemoTeaser";
import { WhyWeWin } from "@/components/landing/WhyWeWin";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="bg-[#0a0a0a] min-h-screen">
      <LandingNav />
      <Hero />
      <Problem />
      <Pipeline />
      <DemoTeaser />
      <WhyWeWin />
      <Footer />
    </div>
  );
}
