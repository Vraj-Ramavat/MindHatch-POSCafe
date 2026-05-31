import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/terminal", "/kitchen", "/reports", "/backend"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!protectedPath) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get("mindhatch-auth")?.value === "1";

  if (!isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = request.cookies.get("mindhatch-role")?.value ?? "";

  if (pathname.startsWith("/kitchen") && !["ADMIN", "MANAGER", "KITCHEN"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.nextUrl));
  }

  if (pathname.startsWith("/reports") && !["ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.nextUrl));
  }

  if (pathname.startsWith("/backend") && !["ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/terminal/:path*", "/kitchen/:path*", "/reports/:path*", "/backend/:path*"],
};