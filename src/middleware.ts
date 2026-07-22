import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getLegacyEnglishRedirectPath,
  getLegacyMontenegrinRedirectPath,
} from "@/shared/config/legacy-english-redirects";

function middleware(request: NextRequest) {
  const destination =
    request.nextUrl.pathname === "/me" || request.nextUrl.pathname.startsWith("/me/")
      ? getLegacyMontenegrinRedirectPath(request.nextUrl.pathname)
      : getLegacyEnglishRedirectPath(request.nextUrl.pathname);
  const url = request.nextUrl.clone();
  url.pathname = destination;

  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ["/en", "/en/:path*", "/me", "/me/:path*"],
  runtime: "nodejs",
};

export { middleware };
