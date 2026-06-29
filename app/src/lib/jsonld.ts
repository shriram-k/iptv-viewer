// JSON-LD-safe serialization — mirrors the pipeline's pipeline/src/sanitize.js
// toJsonLd: escape characters that could break out of a <script> block or the
// line (U+2028/U+2029). Built via new RegExp from escaped ASCII to keep this
// source free of literal control/separator bytes.
const UNSAFE = new RegExp('[<>&\\u2028\\u2029]', 'g')

export function toJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(UNSAFE, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
}
