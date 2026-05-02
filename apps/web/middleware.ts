import { NextResponse, type NextRequest } from "next/server";

// Auth gate removed for demo deploy — all routes publicly accessible.
// Real auth (Google OAuth) re-added when backend ships.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
