import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getLegacyEnglishRedirectPath } from "@/shared/config/legacy-english-redirects";

function middleware(request: NextRequest) {
  const destination = getLegacyEnglishRedirectPath(request.nextUrl.pathname);
  const url = request.nextUrl.clone();
  url.pathname = destination;

  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ["/en", "/en/:path*"],
  runtime: "nodejs",
};

export { middleware };
