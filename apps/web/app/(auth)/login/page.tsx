"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Phase = "idle" | "loading" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setPhase("loading");
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setPhase("error");
      return;
    }

    setPhase("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">DNA with a Twist</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Provenance Lab — verifiable gene-editing research
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              We&apos;ll send a magic link to your email. No password needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phase === "sent" ? (
              <div className="space-y-3 text-center py-4">
                <div className="text-4xl">✉️</div>
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <strong>{email}</strong>. Click it to sign in.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhase("idle");
                    setEmail("");
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@lab.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={phase === "loading"}
                    required
                    autoFocus
                  />
                </div>

                {phase === "error" && error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={phase === "loading" || !email.trim()}
                >
                  {phase === "loading" ? "Sending…" : "Send magic link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Every research object and run is cryptographically hashed and immutable.
        </p>
      </div>
    </main>
  );
}
