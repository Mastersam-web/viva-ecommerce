/** Assainissement minimal du HTML éditable (contenu CMS / blog) : retire scripts, iframes, gestionnaires on*, URLs javascript:. */
function sanitizeHtml(html) {
  return String(html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href|formaction)\s*=\s*("|')?\s*(javascript|vbscript|data\s*:\s*text\/html)[^"'>\s]*/gi, ' $1=$2#');
}
module.exports = { sanitizeHtml };
