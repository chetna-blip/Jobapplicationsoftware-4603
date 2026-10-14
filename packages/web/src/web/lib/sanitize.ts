const ALLOWED = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "A", "CODE", "PRE", "HR", "SPAN", "DIV", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
]);

/**
 * Job descriptions are third-party HTML from the boards — strip anything executable before it
 * touches the DOM. Keeps structure (lists, headings, links), drops scripts, styles, frames,
 * event handlers and non-http URLs.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.body.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button").forEach(
    (el) => el.remove(),
  );

  const walk = (node: Element) => {
    [...node.children].forEach(walk);
    if (!ALLOWED.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      const keep =
        (node.tagName === "A" && name === "href" && /^https?:/i.test(attr.value)) ||
        name === "colspan" ||
        name === "rowspan";
      if (!keep) node.removeAttribute(attr.name);
    }
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  };
  [...doc.body.children].forEach(walk);

  return doc.body.innerHTML;
}
