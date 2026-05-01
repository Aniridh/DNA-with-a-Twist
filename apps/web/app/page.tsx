import { redirect } from "next/navigation";

// Middleware handles auth; this just redirects `/` to `/dashboard`
export default function RootPage() {
  redirect("/dashboard");
}
