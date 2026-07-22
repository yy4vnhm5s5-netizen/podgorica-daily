function getLegacyEnglishRedirectPath(pathname: string) {
  if (pathname === "/en" || pathname === "/en/") return "/";
  if (pathname === "/en/contact" || pathname === "/en/kontakt") return "/kontakt";
  if (pathname === "/en/electricity" || pathname === "/en/struja") return "/struja";
  if (pathname === "/en/flights" || pathname === "/en/letovi") return "/me/letovi";
  if (pathname === "/en/going-out" || pathname === "/en/izlasci") return "/izlasci";
  if (pathname === "/en/privacy-policy" || pathname === "/en/politika-privatnosti") {
    return "/politika-privatnosti";
  }
  if (pathname === "/en/terms" || pathname === "/en/uslovi-koriscenja") {
    return "/uslovi-koriscenja";
  }
  if (pathname === "/en/events") return "/events";
  if (pathname.startsWith("/en/events/")) return pathname.replace("/en", "");

  // Cineplexx is presented on the primary dashboard; there is no standalone cinema route.
  if (pathname === "/en/cinema" || pathname === "/en/bioskop") return "/me";

  return "/";
}

export { getLegacyEnglishRedirectPath };
