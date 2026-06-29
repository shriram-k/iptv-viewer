'use strict';
/**
 * U4 — Sanitization (origin R14). Make snapshot values safe-by-construction so
 * no downstream consumer can render a poisoned upstream entry.
 *
 * Design note: text fields are NOT HTML-entity-escaped at storage — the render
 * layer (React) escapes on output, and double-escaping would corrupt display.
 * The real injection surfaces are (a) breaking out of a JSON-LD <script> block
 * and (b) dangerous URL schemes; both are handled firmly here. Control chars are
 * stripped defensively.
 */
const { isHttpUrl } = require('./schema');

// Built via new RegExp from escaped ASCII strings to keep this source file free
// of literal control / line-separator bytes.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');
const JSONLD_UNSAFE = new RegExp('[<>&\\u2028\\u2029]', 'g');

/** Strip ASCII control characters (incl. NUL and DEL) and trim. */
function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').trim();
}

/** Return the URL only if it is http(s); otherwise null (rejects javascript:/data:). */
function sanitizeUrl(value) {
  return isHttpUrl(value) ? value : null;
}

/**
 * Serialize an object for safe embedding in a <script type="application/ld+json">
 * block: escape characters that could close the script element, start a comment,
 * or break the line (U+2028/U+2029). Used by the render/snapshot layer.
 */
function toJsonLd(obj) {
  return JSON.stringify(obj).replace(JSONLD_UNSAFE, (ch) =>
    '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
  );
}

module.exports = { sanitizeText, sanitizeUrl, toJsonLd };
