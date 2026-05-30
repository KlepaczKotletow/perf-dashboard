// Safe JSON-LD <script> renderer.
//
// Escapes &, <, > into their JSON \uXXXX equivalents. Two things fall out of
// that: (1) the payload cannot terminate the <script> element early, so there
// is no XSS surface even for attacker-influenced field values, and (2) the
// serialized string contains none of the characters React escapes in text
// children, so the children form renders byte-identical, valid JSON-LD with no
// need for raw HTML injection.
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return <script type="application/ld+json">{json}</script>;
}
