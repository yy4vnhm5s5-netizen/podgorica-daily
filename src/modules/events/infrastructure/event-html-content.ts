const contentClassPattern =
  /\b(?:article-content|ba-blog-post-body|ba-item-text-content|content-body|entry-content|event-content|event-description|post-content|single-post-content|elementor-widget-theme-post-content)\b/i;

function extractEventContentHtml(html: string) {
  const document = removeNonContentBlocks(html);
  const scopedContent = findPreferredContent(document);

  return removeBoilerplateBlocks(scopedContent ?? extractBody(document) ?? document);
}

function extractEventContentText(html: string) {
  return toEventPlainText(extractEventContentHtml(html));
}

function extractEventHeading(html: string) {
  const content = extractEventContentHtml(html);

  return extractHeading(content) ?? extractHeading(removeNonContentBlocks(html));
}

function toEventPlainText(html: string) {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|li|div|h[1-6]|section|article)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n[ \t]*\n[\s\n]*/g, "\u0000")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\u0000/g, "\n\n")
    .trim();
}

function findPreferredContent(html: string) {
  const openingTags = /<(article|main|section|div)\b([^>]*)>/gi;
  let selected: { content: string; score: number } | undefined;

  for (const match of html.matchAll(openingTags)) {
    const tag = match[1].toLowerCase();
    const score = contentScore(tag, match[2]);
    if (score === 0) continue;

    const content = extractElementContent(html, match.index ?? 0, tag);
    if (content && (!selected || score > selected.score)) selected = { content, score };
  }

  return selected?.content;
}

function contentScore(tag: string, attributes: string) {
  if (contentClassPattern.test(attributes)) return 3;
  if (tag === "article") return 2;
  return tag === "main" ? 1 : 0;
}

function extractBody(html: string) {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match?.[1];
}

function extractHeading(html: string) {
  const match = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
  const value = match ? toEventPlainText(match[1]) : "";
  return value || undefined;
}

function removeNonContentBlocks(html: string) {
  return html
    .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
    .replace(
      /<(?:script|style|noscript|svg|template)\b[\s\S]*?<\/(?:script|style|noscript|svg|template)>/gi,
      " ",
    );
}

function removeBoilerplateBlocks(html: string) {
  return html
    .replace(
      /<(?:header|nav|footer|aside|form)\b[\s\S]*?<\/(?:header|nav|footer|aside|form)>/gi,
      " ",
    )
    .replace(
      /<(?:div|section)\b(?=[^>]*\b(?:breadcrumb|comment|cookie|footer|header|menu|navigation|share|social|sidebar)\b)[^>]*>[\s\S]*?<\/(?:div|section)>/gi,
      " ",
    );
}

function extractElementContent(html: string, startIndex: number, tagName: string) {
  const tag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const token = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  token.lastIndex = startIndex;

  let depth = 0;
  let openingEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html))) {
    if (!match[0].startsWith("</")) {
      depth += 1;
      if (depth === 1) openingEnd = token.lastIndex;
      continue;
    }

    depth -= 1;
    if (depth === 0 && openingEnd >= 0) return html.slice(openingEnd, match.index);
  }

  return undefined;
}

export { extractEventContentHtml, extractEventContentText, extractEventHeading, toEventPlainText };
