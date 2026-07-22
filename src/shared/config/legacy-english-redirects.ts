function getLegacyEnglishRedirectPath(pathname: string) {
  const path = withoutTrailingSlash(pathname);

  if (path === "/en") return "/";
  if (path === "/en/contact" || path === "/en/kontakt") return "/kontakt";
  if (path === "/en/electricity" || path === "/en/struja") return "/struja";
  if (path === "/en/flights" || path === "/en/letovi") return "/letovi";
  if (path === "/en/going-out" || path === "/en/izlasci") return "/izlasci";
  if (path === "/en/privacy-policy" || path === "/en/politika-privatnosti") {
    return "/politika-privatnosti";
  }
  if (path === "/en/terms" || path === "/en/uslovi-koriscenja") {
    return "/uslovi-koriscenja";
  }
  if (path === "/en/events" || path === "/en/dogadjaji") return "/dogadjaji";
  if (path.startsWith("/en/events/")) return path.replace("/en/events", "/dogadjaji");
  if (path.startsWith("/en/dogadjaji/")) {
    return path.replace("/en/dogadjaji", "/dogadjaji");
  }

  // Cineplexx is presented on the primary dashboard; there is no standalone cinema route.
  if (path === "/en/cinema" || path === "/en/bioskop") return "/#bioskop";

  return "/";
}

function getLegacyMontenegrinRedirectPath(pathname: string) {
  const path = withoutTrailingSlash(pathname);

  if (path === "/me") return "/";
  if (path === "/me/events" || path === "/me/dogadjaji") return "/dogadjaji";
  if (path.startsWith("/me/events/")) return path.replace("/me/events", "/dogadjaji");
  if (path.startsWith("/me/dogadjaji/")) return path.replace("/me/dogadjaji", "/dogadjaji");
  if (path === "/me/kontakt") return "/kontakt";
  if (path === "/me/izlasci") return "/izlasci";
  if (path === "/me/letovi") return "/letovi";
  if (path === "/me/struja") return "/struja";
  if (path === "/me/politika-privatnosti") return "/politika-privatnosti";
  if (path === "/me/uslovi-koriscenja") return "/uslovi-koriscenja";
  if (path === "/me/bioskop") return "/#bioskop";

  return "/";
}

function withoutTrailingSlash(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;
}

export { getLegacyEnglishRedirectPath, getLegacyMontenegrinRedirectPath };
