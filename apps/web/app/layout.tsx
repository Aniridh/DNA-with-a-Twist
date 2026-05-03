import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/QueryProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cas-ai.app"),
  title: "DNA with a Twist — Provenance Lab",
  description: "Verifiable gene-editing research objects and simulation runs.",
  openGraph: {
    title: "DNA with a Twist — Provenance Lab",
    description: "Hash, version, and replay every CRISPR experiment. Verifiable by default.",
    url: "https://cas-ai.app",
    siteName: "DNA with a Twist",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DNA with a Twist",
    description: "Hash, version, and replay every CRISPR experiment. Verifiable by default.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-background text-foreground font-sans">
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
