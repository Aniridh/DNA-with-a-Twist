"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "glass" : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-6xl px-6 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-[15px] font-semibold tracking-tight text-foreground group-hover:text-teal transition-colors duration-200">
            CasAI
          </span>
          <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
            Provenance Lab
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <a href="#pipeline" className="hidden md:block text-sm text-muted-foreground hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#compare" className="hidden md:block text-sm text-muted-foreground hover:text-foreground transition-colors">
            Why us
          </a>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-teal px-4 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors duration-150"
          >
            Try the demo
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
