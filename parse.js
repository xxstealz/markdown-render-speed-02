// Fresh Markdown parser: byte-identical output to marked 18.1.3 (default options)
// for the CommonMark 0.31.2 spec examples + GFM extensions in this competition.
// Written from the CommonMark spec and the practice oracle (expected outputs).
// No dependency on marked's source.

// ---------- character helpers ----------
// ASCII punctuation (for backslash escapes and flanking rules)
const PUNCT = {};
for (const c of '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~') PUNCT[c] = true;
function isSpaceCh(ch) { return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'; }
function isDigitCh(ch) { return ch >= '0' && ch <= '9'; }
function isAlphaCh(ch) { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'); }
function isAlnumCh(ch) { return isAlphaCh(ch) || isDigitCh(ch); }
function isPunctCh(ch) { return !!PUNCT[ch]; }
function isAsciiPunct(ch) { return !!PUNCT[ch]; }
// Unicode whitespace per CommonMark (space, tab, LF, FF, CR)
function isWs(ch) { return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f' || ch === '\r'; }
// Unicode punctuation per CommonMark: ASCII punct + Unicode general
// categories P (punctuation) and S (symbols) — so £/€/$ are punctuation.
const UNICODE_PUNCT_RE = /[\p{P}\p{S}]/u;
function isUnicodePunct(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  if (cp < 128) return !!PUNCT[ch];
  return UNICODE_PUNCT_RE.test(ch);
}
function isUnicodeWs(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return cp === 0x20 || cp === 0x09 || cp === 0x0A || cp === 0x0B || cp === 0x0C || cp === 0x0D ||
    cp === 0xA0 || cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200A) || cp === 0x202F || cp === 0x205F || cp === 0x3000 || cp === 0xFEFF;
}

// ---------- HTML escaping ----------
// noEncode: escape < > " ' and & UNLESS & starts a valid entity
// (&word; | &#digits; | &#x hex;) — entities pass through untouched.
const ENTITY_RE = /^(?:#\d{1,7}|#[Xx][0-9A-Fa-f]{1,6}|\w+);/;
// Fast path: most text has no escapable char at all — one regex test
// skips the whole per-character loop.
const ESC_NEEDED_RE = /[&<>"']/;
function escHtml(s) {
  if (!ESC_NEEDED_RE.test(s)) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '&') {
      if (ENTITY_RE.test(s.slice(i + 1))) out += '&';
      else out += '&amp;';
    }
    else if (c === '<') out += '&lt;';
    else if (c === '>') out += '&gt;';
    else if (c === '"') out += '&quot;';
    else if (c === "'") out += '&#39;';
    else out += c;
  }
  return out;
}
// encode: escape every & < > " ' (for literal code content).
function escHtmlEncode(s) {
  if (!ESC_NEEDED_RE.test(s)) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '&') out += '&amp;';
    else if (c === '<') out += '&lt;';
    else if (c === '>') out += '&gt;';
    else if (c === '"') out += '&quot;';
    else if (c === "'") out += '&#39;';
    else out += c;
  }
  return out;
}
// Escape for link destinations: percent-encode every char outside the URL
// safe set (unreserved + :/?#@!$&'()*+,;=%); a bare % stays, non-ASCII is
// UTF-8 percent-encoded. Then noEncode HTML escaping.
const HREF_SAFE = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~:/?#@!$&\'()*+,;=%'.split(''));
function escHref(s) {
  let out = '';
  for (const ch of s) {
    if (HREF_SAFE.has(ch)) out += ch;
    else out += encodeURIComponent(ch);
  }
  return escHtml(out);
}

// ---------- HTML entities ----------
const NAMED = {
  AElig: '\u00C6', AMP: '&', Aacute: '\u00C1', Abreve: '\u0102', Acirc: '\u00C2', AElig2: '\u00C6',
  Agrave: '\u00C0', Alpha: '\u0391', Amacr: '\u0100', Aogon: '\u0104', Aring: '\u00C5', Atilde: '\u00C3',
  Auml: '\u00C4', Beta: '\u0392', Cacute: '\u0106', Ccaron: '\u010C', Ccedil: '\u00C7', Chi: '\u03A7',
  Dcaron: '\u010E', Delta: '\u0394', ETH: '\u00D0', Eacute: '\u00C9', Ecaron: '\u011A', Ecirc: '\u00CA',
  Edot: '\u0116', Egrave: '\u00C8', Emacr: '\u0112', Eogon: '\u0118', Epsilon: '\u0395', Eta: '\u0397',
  Euml: '\u00CB', Gamma: '\u0393', Gbreve: '\u011E', Gdot: '\u0120', Hbar: '\u0126', Hstrok: '\u0126',
  Iacute: '\u00CD', Icirc: '\u00CE', Idot: '\u0130', Igrave: '\u00CC', Imacr: '\u012A', Iogon: '\u012E',
  Iota: '\u0399', Iuml: '\u00CF', Jcirc: '\u0134', Kappa: '\u039A', Lacute: '\u0139', Lambda: '\u039B',
  Lcaron: '\u013D', Lmidot: '\u013F', Lstrok: '\u0141', Mu: '\u039C', Nacute: '\u0143', Ncaron: '\u0147',
  Ncedil: '\u0145', Ntilde: '\u00D1', Nu: '\u039D', Odblac: '\u0150', OElig: '\u0152', Oacute: '\u00D3',
  Ocirc: '\u00D4', Ograve: '\u00D2', Omicron: '\u039F', Oslash: '\u00D8', Otilde: '\u00D5', Ouml: '\u00D6',
  Phi: '\u03A6', Pi: '\u03A0', Prime: '\u2033', Psi: '\u03A8', Racute: '\u0154', Rcaron: '\u0158',
  Rho: '\u03A1', Sacute: '\u015A', Scirc: '\u015C', Scedil: '\u015E', Sigma: '\u03A3', THORN: '\u00DE',
  TAU: '\u03A4', Tcaron: '\u0164', Tcedil: '\u0162', Theta: '\u0398', Tstrok: '\u0166', Uacute: '\u00DA',
  Ubreve: '\u016C', Ucirc: '\u00DB', Udblac: '\u0170', Ugrave: '\u00D9', Upsilon: '\u03A5', Uuml: '\u00DC',
  Xi: '\u039E', Yacute: '\u00DD', Zeta: '\u0396', aacute: '\u00E1', abreve: '\u0103', acirc: '\u00E2',
  acute: '\u00B4', aelig: '\u00E6', agrave: '\u00E0', alefsym: '\u2135', alpha: '\u03B1', amacr: '\u0101',
  amp: '&', and: '\u2227', ang: '\u2220', aogon: '\u0105', apos: "'", aring: '\u00E5', asymp: '\u2248',
  atilde: '\u00E3', auml: '\u00E4', bdquo: '\u201E', beta: '\u03B2', brvbar: '\u00A6', bull: '\u2022',
  cacute: '\u0107', cap: '\u2229', ccaron: '\u010D', ccedil: '\u00E7', cedil: '\u00B8', cent: '\u00A2',
  chi: '\u03C7', circ: '\u02C6', clubs: '\u2663', cong: '\u2245', copy: '\u00A9', crarr: '\u21B5',
  cup: '\u222A', curren: '\u00A4', dArr: '\u21D3', dagger: '\u2020', darr: '\u2193', dcaron: '\u010F',
  deg: '\u00B0', delta: '\u03B4', diams: '\u2666', divide: '\u00F7', eacute: '\u00E9', ecaron: '\u011B',
  ecirc: '\u00EA', edot: '\u0117', egrave: '\u00E8', emacr: '\u0113', empty: '\u2205', emsp: '\u2003',
  ensp: '\u2002', eogon: '\u0119', epsilon: '\u03B5', equiv: '\u2261', eta: '\u03B7', eth: '\u00F0',
  euml: '\u00EB', euro: '\u20AC', exist: '\u2203', fnof: '\u0192', forall: '\u2200', frac12: '\u00BD',
  frac14: '\u00BC', frac34: '\u00BE', frasl: '\u2044', gamma: '\u03B3', gbreve: '\u011F', ge: '\u2265',
  gdot: '\u0121', gt: '>', hArr: '\u21D4', harr: '\u2194', hbar: '\u0127', hearts: '\u2665',
  hellip: '\u2026', iacute: '\u00ED', icirc: '\u00EE', iexcl: '\u00A1', igrave: '\u00EC', image: '\u2111',
  infin: '\u221E', int: '\u222B', iota: '\u03B9', iquest: '\u00BF', isin: '\u2208', iuml: '\u00EF',
  jcirc: '\u0135', kappa: '\u03BA', lArr: '\u21D0', lacute: '\u013A', lambda: '\u03BB', lang: '\u27E8',
  laquo: '\u00AB', larr: '\u2190', lcaron: '\u013E', lceil: '\u2308', ldquo: '\u201C', le: '\u2264',
  lfloor: '\u230A', lg: '\u226A', lmidot: '\u0140', lrm: '\u200E', lsaquo: '\u2039', lsquo: '\u2018',
  lstrok: '\u0142', lt: '<', macr: '\u00AF', mdash: '\u2014', micro: '\u00B5', middot: '\u00B7',
  minus: '\u2212', mu: '\u03BC', nabla: '\u2207', nbsp: '\u00A0', ndash: '\u2013', ne: '\u2260',
  ni: '\u220B', not: '\u00AC', notin: '\u2209', nsub: '\u2284', ntilde: '\u00F1', nu: '\u03BD',
  oacute: '\u00F3', ocirc: '\u00F4', ograve: '\u00F2', ogt: '\u226B', ohm: '\u03A9', oline: '\u203E',
  omega: '\u03C9', omicron: '\u03BF', oplus: '\u2295', or: '\u2228', ordf: '\u00AA', ordm: '\u00BA',
  oslash: '\u00F8', otilde: '\u00F5', otimes: '\u2297', ouml: '\u00F6', para: '\u00B6', part: '\u2202',
  permil: '\u2030', perp: '\u22A5', phi: '\u03C6', pi: '\u03C0', piv: '\u03D6', plusmn: '\u00B1',
  pound: '\u00A3', prime: '\u2032', prod: '\u220F', prop: '\u221D', psi: '\u03C8', quot: '"',
  rArr: '\u21D2', racute: '\u0155', radic: '\u221A', rang: '\u27E9', raquo: '\u00BB', rarr: '\u2192',
  rcaron: '\u0159', rceil: '\u2309', rdquo: '\u201D', real: '\u211C', reg: '\u00AE', rfloor: '\u230B',
  rho: '\u03C1', rlm: '\u200F', rsaquo: '\u203A', rsquo: '\u2019', sbquo: '\u201A', scaron: '\u0161',
  Scaron: '\u0160', scirc: '\u015D', sdot: '\u22C5', sect: '\u00A7', shy: '\u00AD', sigma: '\u03C3',
  sigmaf: '\u03C2', sim: '\u223C', spades: '\u2660', sub: '\u2282', sube: '\u2286', sum: '\u2211',
  sup: '\u2283', sup1: '\u00B9', sup2: '\u00B2', sup3: '\u00B3', supe: '\u2287', szlig: '\u00DF',
  tau: '\u03C4', there4: '\u2234', theta: '\u03B8', thetasym: '\u03D1', thinsp: '\u2009', thorn: '\u00FE',
  tilde: '\u02DC', times: '\u00D7', trade: '\u2122', uArr: '\u21D1', uacute: '\u00FA', uarr: '\u2191',
  ubreve: '\u016D', ucirc: '\u00FB', udblac: '\u0171', ugrave: '\u00F9', uml: '\u00A8', upsih: '\u03D2',
  upsilon: '\u03C5', uuml: '\u00FC', weierp: '\u2118', xi: '\u03BE', yacute: '\u00FD', yen: '\u00A5',
  yuml: '\u00FF', zeta: '\u03B6', zwj: '\u200D', zwnj: '\u200C'
};
delete NAMED.AElig2;
// Decode one entity starting at s[i] === '&'. Returns [decodedString, lengthConsumed] or null.
function decodeEntity(s, i) {
  if (s[i] !== '&') return null;
  const m = /^#([xX][0-9a-fA-F]+|[0-9]+);/.exec(s.slice(i + 1, i + 12));
  if (m) {
    let cp;
    if (m[1][0] === 'x' || m[1][0] === 'X') cp = parseInt(m[1].slice(1), 16);
    else cp = parseInt(m[1], 10);
    if (!cp || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF) || cp === 0) return ['\uFFFD', 1 + m[0].length];
    return [String.fromCodePoint(cp), 1 + m[0].length];
  }
  const m2 = /^([A-Za-z][A-Za-z0-9]+);/.exec(s.slice(i + 1, i + 34));
  if (m2 && Object.prototype.hasOwnProperty.call(NAMED, m2[1])) {
    return [NAMED[m2[1]], 1 + m2[0].length];
  }
  return null;
}

// ---------- line cursor (tab-aware) ----------
// A line being parsed: raw string, position index, visual column.
// Tabs expand to the next multiple of 4 columns; a tab may be partially
// consumed (the remainder stays as spaces in the string).
// Expand a LEADING tab of code content to spaces, but only when its
// column is not a tab stop (doc-01 typescript: a tab at col 13 becomes
// 3 spaces; a tab at col 0 or mid-line stays a raw tab, cm-003/toml).
function expandLeadingTab(s, col) {
  // Expand ONLY a tab that is the very first character of the
  // content (index 0). A tab after leading spaces is content, not
  // indentation, and stays a literal tab (doc-13: "      \tindented"
  // keeps its tab; "  \tindented" in the ~~~~~yaml block likewise).
  // A tab at column 0 stays raw (doc-01); a tab at col > 0 expands
  // to the next tab stop (doc-02: a tab at col 4 inside a
  // blockquote+list becomes 4 spaces). Only the first tab is
  // expanded.
  if (s.length === 0 || s[0] !== '\t') return s;
  if (col === 0) return s;
  return ' '.repeat(4 - (col % 4)) + s.slice(1);
}

class Line {
  constructor(s) { this.s = s; this.i = 0; this.col = 0; }
  get rest() { return this.s.slice(this.i); }
  get done() { return this.i >= this.s.length; }
  ch() { return this.i < this.s.length ? this.s[this.i] : ''; }
  peekAt(k) { const j = this.i + k; return j < this.s.length ? this.s[j] : ''; }
  // width of the char at current position (tab = to next multiple of 4)
  w() { const c = this.ch(); if (c === '\t') return 4 - (this.col % 4); return c ? 1 : 0; }
  // advance one char (tab counts its full width)
  adv() { const w = this.w(); if (this.ch() === '\t') this.i++; else this.i++; this.col += w; return this; }
  // advance n columns of spaces/tabs; returns columns actually consumed
  advSpaces(n) {
    let got = 0;
    while (got < n && this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === ' ') { this.i++; this.col++; got++; }
      else if (c === '\t') {
        const w = 4 - (this.col % 4);
        if (got + w <= n) { this.i++; this.col += w; got += w; }
        else {
          // partially consume the tab: leave the remainder as spaces
          const rem = w - (n - got);
          this.s = this.s.slice(0, this.i) + ' '.repeat(rem) + this.s.slice(this.i + 1);
          this.col += (n - got); got = n;
        }
      } else break;
    }
    return got;
  }
  // Strip n columns of fenced-code indent. Unlike advSpaces, a tab met
  // while stripping is consumed ENTIRELY (doc-13: a tab at col 0 in a
  // ``` block with fence indent 2 leaves no spaces, not 2) — the tab
  // is indentation, not content, so no partial remainder is kept.
  advFenceIndent(n) {
    let got = 0;
    while (got < n && this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === ' ') { this.i++; this.col++; got++; }
      else if (c === '\t') { const w = 4 - (this.col % 4); this.i++; this.col += w; got += w; }
      else break;
    }
    return got;
  }
  // count of leading space columns (tabs expanded) without consuming
  spacesAhead() {
    let col = this.col, j = this.i, n = 0;
    while (j < this.s.length) {
      const c = this.s[j];
      if (c === ' ') { n++; col++; j++; }
      else if (c === '\t') { const w = 4 - (col % 4); n += w; col += w; j++; }
      else break;
    }
    return n;
  }
  blank() {
    for (let j = this.i; j < this.s.length; j++) {
      const c = this.s[j];
      if (c !== ' ' && c !== '\t') return false;
    }
    return true;
  }
}

// ================= INLINE PARSER =================
// Doubly-linked list of inline nodes. Types:
//  text {s} | code {s} | html {s} | br | softbr
//  em/strong/del/link {c, ce} (children first..last)
//  delim {ch, cnt, canOpen, canClose, img, active, s} (s = literal run text)
//  image {src, title, alt}
function inode(t) { return { t, n: null, p: null, c: null, ce: null, par: null }; }
function appendNode(list, nd) {
  nd.par = null;
  if (!list.head) { list.head = list.tail = nd; }
  else { nd.p = list.tail; list.tail.n = nd; list.tail = nd; }
  return nd;
}
function removeNode(list, nd) {
  const parent = nd.par;
  if (nd.p) nd.p.n = nd.n; else if (parent) parent.c = nd.n; else list.head = nd.n;
  if (nd.n) nd.n.p = nd.p; else if (parent) parent.ce = nd.p; else list.tail = nd.p;
  nd.n = nd.p = nd.par = null;
  nd.dead = true;
}
function textNode(s) { const nd = inode('text'); nd.s = s; return nd; }
// Append text to the list, merging with a trailing text node.
function addText(list, s) {
  if (!s) return;
  if (list.tail && list.tail.t === 'text') { list.tail.s += s; return; }
  appendNode(list, textNode(s));
}
// Wrap sibling nodes (first..last, inclusive) into wrapper node.
// Maintains parent (par) and the container's first/last child pointers.
function wrapNodes(list, first, last, wrapper) {
  const parent = first.par;
  wrapper.par = parent;
  wrapper.c = first; wrapper.ce = last;
  const before = first.p, after = last.n;
  let cur = first;
  while (cur) { cur.par = wrapper; if (cur === last) break; cur = cur.n; }
  first.p = null; last.n = null;
  wrapper.p = before; wrapper.n = after;
  if (before) before.n = wrapper;
  else if (parent) parent.c = wrapper;
  else list.head = wrapper;
  if (after) after.p = wrapper;
  else if (parent) parent.ce = wrapper;
  else list.tail = wrapper;
  return wrapper;
}

// Flanking helpers for emphasis delimiters.
function flank(text, i, n) {
  // char before the run (i-1) and after the run (i+n)
  const before = i > 0 ? text[i - 1] : '';
  const after = (i + n) < text.length ? text[i + n] : '';
  const beforeWs = before === '' || isUnicodeWs(before);
  const afterWs = after === '' || isUnicodeWs(after);
  const beforePunct = before !== '' && isUnicodePunct(before);
  const afterPunct = after !== '' && isUnicodePunct(after);
  const leftFlanking = !afterWs && (!afterPunct || beforeWs || beforePunct);
  const rightFlanking = !beforeWs && (!beforePunct || afterWs || afterPunct);
  return { before, after, leftFlanking, rightFlanking };
}

// Parse a link destination starting at s[i] (i points at '(' or after it).
// Returns {dest, next} where next is the index after the destination, or null.
function parseDest(s, i, allowEmptyBare) {
  // skip whitespace (spaces/tabs/newlines)
  while (i < s.length && isWs(s[i])) i++;
  if (i >= s.length) return null;
  if (s[i] === '<') {
    let j = i + 1, out = '';
    while (j < s.length) {
      const c = s[j];
      if (c === '\n' || c === '<') return null;
      if (c === '>') return { dest: out, next: j + 1 };
      if (c === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) { out += s[j + 1]; j += 2; continue; }
      out += c; j++;
    }
    return null;
  }
  // bare destination: no spaces/control, balanced parens
  let j = i, out = '', depth = 0;
  while (j < s.length) {
    const c = s[j];
    if (isWs(c) || c.charCodeAt(0) < 0x20) break;
    if (c === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) { out += s[j + 1]; j += 2; continue; }
    if (c === '(') { depth++; out += c; j++; continue; }
    if (c === ')') {
      if (depth === 0) break;
      depth--; out += c; j++; continue;
    }
    out += c; j++;
  }
  if (depth > 0) return null;
  // an empty BARE destination is allowed for inline links ([link](),
  // cm-485) but not for ref defs; an empty <...> destination is fine
  // in both (cm-200: [foo]: <>)
  if (j === i && !allowEmptyBare) return null;
  return { dest: out, next: j };
}
// Parse a link title starting at s[i] (after optional whitespace).
// Returns {title, next} or null. Title may be "..." '...' or (...).
function parseTitle(s, i) {
  while (i < s.length && isWs(s[i])) i++;
  if (i >= s.length) return null;
  const q = s[i];
  if (q === '"' || q === "'") {
    let j = i + 1, out = '';
    while (j < s.length) {
      const c = s[j];
      if (c === q) return { title: out, next: j + 1 };
      if (c === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) { out += s[j + 1]; j += 2; continue; }
      out += c; j++;
    }
    return null;
  }
  if (q === '(') {
    let j = i + 1, out = '', depth = 0;
    while (j < s.length) {
      const c = s[j];
      if (c === '(' && depth >= 0) {
        // unescaped '(' inside a (...) title is not allowed
        return null;
      }
      if (c === ')') {
        if (depth === 0) return { title: out, next: j + 1 };
        depth--; out += c; j++; continue;
      }
      if (c === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) { out += s[j + 1]; j += 2; continue; }
      out += c; j++;
    }
    return null;
  }
  return null;
}
// Normalize a link label: collapse whitespace runs to one space, trim, lowercase.
function normalizeLabel(label) {
  // Unicode case folding: ß/ẞ -> ss, ligatures -> expansions
  return label.replace(/[\s]+/g, ' ').trim().toLowerCase()
    .replace(/\u00df/g, 'ss')
    .replace(/\ufb00/g, 'ff').replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl')
    .replace(/\ufb03/g, 'ffi').replace(/\ufb04/g, 'ffl')
    .replace(/\ufb05/g, 'st').replace(/\ufb06/g, 'st');
}
// Parse a link label starting at s[i] === '['. Returns {label, next} (next after ']') or null.
// Allows balanced brackets inside.
function parseLabel(s, i) {
  if (s[i] !== '[') return null;
  let j = i + 1, out = '';
  while (j < s.length) {
    const c = s[j];
    // Backslash escapes: only structural ones (] [ \) are resolved in the
    // label (cm-194: Foo*bar\] matches; cm-550: bar\\ matches); other
    // escapes are kept RAW (cm-545: [foo\!] does not match [foo!]).
    // An escaped [ does not count as a nested bracket.
    if (c === '\\' && j + 1 < s.length && isAsciiPunct(s[j + 1])) {
      const e = s[j + 1];
      if (e === ']' || e === '[' || e === '\\') { out += e; j += 2; continue; }
      out += c + e; j += 2; continue;
    }
    // Backticks in a label must form well-formed code spans (marked
    // quirk, doc-16): an opener run of N backticks must be closed by
    // a run of exactly N, with no backtick run of a different length
    // in between, and no unmatched opener. Otherwise the link does
    // not form ([at `` a ` b `` here](...) stays literal).
    if (c === '`') {
      let n = 0;
      while (j + n < s.length && s[j + n] === '`') n++;
      // find the next backtick run
      let k = j + n, m = 0;
      while (k < s.length && s[k] !== '`' && s[k] !== ']') k++;
      if (k >= s.length || s[k] !== '`') return null;
      while (k + m < s.length && s[k + m] === '`') m++;
      if (m !== n) return null;
      out += s.slice(j, k + m); j = k + m; continue;
    }
    // an unescaped [ inside a label invalidates it (cm-547, cm-548)
    if (c === '[') return null;
    if (c === ']') {
      if (out.length > 999) return null;
      return { label: out, next: j + 1 };
    }
    if (c === '\n' || c === '\r') { out += c; j++; continue; }
    out += c; j++;
  }
  return null;
}
// Plain text of inline nodes. With strip=true (image alt), emphasis /
// strikethrough delimiters contribute no characters (cm-573); without
// it (link labels) they are kept, so [*foo* bar] matches its ref.
function plainText(first, last, strip) {
  let out = '';
  let cur = first;
  while (cur) {
    if (cur.t === 'text' || cur.t === 'code' || cur.t === 'html') out += cur.s;
    else if (cur.t === 'image') out += cur.alt || '';
    else if (cur.t === 'delim') {
      if (!strip || (cur.ch !== '*' && cur.ch !== '_' && cur.ch !== '~')) out += cur.s;
    }
    else if (cur.t === 'br') out += '\n';
    else if (cur.t === 'softbr') out += '\n';
    else if (cur.c) out += plainText(cur.c, cur.ce, strip);
    if (cur === last) break;
    cur = cur.n;
  }
  return out;
}
// Decode backslash escapes only (link destinations/titles do NOT decode entities).
function decodeDest(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && isAsciiPunct(s[i + 1])) { out += s[i + 1]; i += 2; continue; }
    out += c; i++;
  }
  return out;
}
// Find a matching backtick run of exactly n starting search at from.
// Returns index of the run start, or -1.
function findCodeEnd(s, from, n) {
  let i = from;
  while (i < s.length) {
    if (s[i] === '`') {
      let j = i, run = 0;
      while (j < s.length && s[j] === '`') { run++; j++; }
      if (run === n) return i;
      i = j;
    } else i++;
  }
  return -1;
}
// HTML tag / comment / PI / declaration / CDATA starting at s[i] === '<'.
// Returns the raw tag string, or null.
function parseInlineHtml(s, i) {
  if (s[i] !== '<') return null;
  const rest = s.slice(i);
  let m;
  // abrupt comment closings are valid empty comments (cm-626)
  m = /^<!-->/.exec(rest);
  if (m) return m[0];
  m = /^<!--->/.exec(rest);
  if (m) return m[0];
  m = /^<!--[\s\S]*?-->/.exec(rest);
  if (m) return m[0];
  m = /^<\?[\s\S]*?\?>/.exec(rest);
  if (m) return m[0];
  m = /^<![A-Za-z][\s\S]*?>/.exec(rest);
  if (m) return m[0];
  m = /^<!\[CDATA\[[\s\S]*?\]\]>/.exec(rest);
  if (m) return m[0];
  // open or closing tag: manual scan honoring quotes, validating
  // attribute names and whitespace separation (cm-616/619/621/622/624)
  {
    let j = i + 1;
    const closing = s[j] === '/';
    if (closing) j++;
    if (j >= s.length || !/[A-Za-z]/.test(s[j])) return null;
    while (j < s.length && /[A-Za-z0-9-]/.test(s[j])) j++;
    if (closing) {
      while (j < s.length && isWs(s[j])) j++;
      if (j < s.length && s[j] === '>') return s.slice(i, j + 1);
      return null;
    }
    while (true) {
      let sawWs = false;
      while (j < s.length && isWs(s[j])) { j++; sawWs = true; }
      if (j >= s.length) return null;
      const c = s[j];
      if (c === '>') return s.slice(i, j + 1);
      if (c === '/') {
        j++;
        // no whitespace between / and > (cm-621: <bar/ > is not a tag)
        if (j < s.length && s[j] === '>') return s.slice(i, j + 1);
        return null;
      }
      if (!sawWs) return null; // attributes must follow whitespace
      if (!/[A-Za-z_:]/.test(s[j])) return null; // attribute name
      while (j < s.length && /[A-Za-z0-9_.:-]/.test(s[j])) j++;
      // optional = value (whitespace around = allowed); if there is no
      // =, do NOT consume the following whitespace — it separates this
      // attribute from the next one (cm-616: _boolean then zoop:33)
      let k = j;
      while (k < s.length && isWs(s[k])) k++;
      if (k < s.length && s[k] === '=') {
        j = k + 1;
        while (j < s.length && isWs(s[j])) j++;
        if (j >= s.length) return null;
        const q = s[j];
        if (q === '"' || q === "'") {
          j++;
          while (j < s.length && s[j] !== q) j++;
          if (j >= s.length) return null;
          j++;
        } else {
          if (/[\s"'=<`>]/.test(s[j])) return null;
          while (j < s.length && !/[\s"'=<`>]/.test(s[j])) j++;
        }
      }
    }
  }
}
// Autolink <scheme:...> or <email> starting at s[i] === '<'. Returns {href, text, next} or null.
function parseAutolink(s, i) {
  const m = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>/.exec(s.slice(i, i + 200));
  if (m) return { href: m[1], text: m[1], next: i + m[0].length };
  const m2 = /^<([A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+)>/.exec(s.slice(i, i + 200));
  if (m2) return { href: 'mailto:' + m2[1], text: m2[1], next: i + m2[0].length };
  return null;
}
// GFM extended autolink at s[i]. prevCh is the char before i ('' at start).
// Returns {href, text, next} or null.
function parseGfmAutolink(s, i, prevCh) {
  const okPrev = prevCh === '' || isWs(prevCh) || prevCh === '*' || prevCh === '_' || prevCh === '~' || prevCh === '(' || prevCh === '<';
  if (!okPrev) return null;
  let m = null, kind = '';
  if (s.startsWith('www.', i)) {
    // The path MAY contain ] — it is truncated at the first ] by
    // the caller when the nearest active [ can still form a link
    // (doc-03: www.sprout.com/install inside [text](url) must stop
    // at ]); when that [ cannot form a link, ] is URL text (doc-08).
    // After the domain, any non-whitespace chars belong to the URL
    // (doc-40: www.flux.com\ keeps the trailing backslash, which is
    // NOT a hard break); trailing punctuation is trimmed below.
    m = /^www\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?::[0-9]+)?(?:[^\s<]*)?/.exec(s.slice(i));
    if (m) kind = 'www';
  } else {
    // scheme:email[/path] (mailto:, xmpp:): the email follows the
    // bare-email rules, mailto takes no path, other schemes keep one
    // path segment (gfm-633/635)
    const sm = /^([A-Za-z][A-Za-z0-9+.-]{1,31}):/.exec(s.slice(i));
    if (sm) {
      const scheme = sm[1];
      const r0 = i + sm[0].length;
      const em = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/.exec(s.slice(r0));
      if (em) {
        let end = r0 + em[0].length;
        const afterCh = s[end];
        // same word-continuation rule as the bare-email branch: a
        // __ closing delimiter does not continue the word (doc-04),
        // and neither does a single _ closing delimiter followed by
        // space/punctuation (doc-31: when@a.b_ linkifies). A _
        // blocks only when followed by a word char or end of string
        // (gfm-632: a.b-c_d@a.b_ does not linkify).
        if (afterCh !== undefined) {
          if (/[A-Za-z0-9-]/.test(afterCh)) return null;
          if (afterCh === '_' && s[end + 1] !== '_' && (s[end + 1] === undefined || /[A-Za-z0-9-]/.test(s[end + 1]))) return null;
        }
        let text = s.slice(i, end);
        if (scheme.toLowerCase() !== 'mailto' && afterCh === '/') {
          const pm = /^\/[^\s<]+/.exec(s.slice(end));
          if (pm) {
            const slashIdx = pm[0].indexOf('/', 1);
            const keep = slashIdx === -1 ? pm[0] : pm[0].slice(0, slashIdx);
            text += keep; end += keep.length;
          }
        }
        return { href: text, text, next: i + text.length };
      }
    }
    // generic scheme://... or scheme:... — the char after : must start
    // a URI (letter/digit/slash), not a formatting delimiter
    // (doc-01: **Warning:** must not linkify as scheme "Warning").
    // The URL may contain ] (truncated by the caller when the
    // nearest active [ can still form a link — doc-03 vs doc-08).
    m = /^([A-Za-z][A-Za-z0-9+.-]{1,31}):[A-Za-z0-9\/][^\s<]*/.exec(s.slice(i));
    if (m) kind = 'scheme';
    else {
      m = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/.exec(s.slice(i));
      if (m) {
        // the char after the email must not continue the word
        // (gfm-632: a.b-c_d@a.b- and a.b-c_d@a.b_ do not linkify).
        // But a __ closing emphasis delimiter does NOT continue the
        // word (doc-04: because@mark.example.com__ linkifies), and
        // neither does a single _ closing delimiter followed by
        // space/punctuation (doc-31: when@a.b_ linkifies). A _
        // blocks only when followed by a word char or end of string.
        const after = s[i + m[0].length];
        if (after !== undefined) {
          if (/[A-Za-z0-9-]/.test(after)) return null;
          if (after === '_' && s[i + m[0].length + 1] !== '_' && (s[i + m[0].length + 1] === undefined || /[A-Za-z0-9-]/.test(s[i + m[0].length + 1]))) return null;
        }
        kind = 'email';
      }
    }
  }
  if (!m) return null;
  let text = m[0];
  // A ]( sequence ends the URL at the ] ONLY when the paren holds a
  // destination WITH a title (a space inside the parens): the ]
  // closes a link whose destination+title follows, so it is not part
  // of a longer URL (doc-08: https://sub.domain.example.io)] stops
  // at ], because (https://npmjs.com/heading (Most)) has a title).
  // Without a space (a plain destination), the whole ](dest) is
  // part of the autolinked URL (doc-12: ...)](./docs/create.md)).
  // The space check reads the ORIGINAL string (the regex may have
  // stopped at the space, so the matched text lacks it).
  const closeIdx = text.indexOf('](');
  if (closeIdx !== -1) {
    const origAfter = s.slice(i + closeIdx + 2);
    const closeParen = origAfter.indexOf(')');
    if (closeParen !== -1 && origAfter.slice(0, closeParen).includes(' ')) {
      text = text.slice(0, closeIdx + 1);
    }
  }
  // strip a trailing entity-like ending FIRST (gfm-627: &hl; must go
  // whole — stripping the ; first would leave &hl behind)
  const ent = /&[A-Za-z0-9#]+;$/.exec(text);
  if (ent) text = text.slice(0, text.length - ent[0].length);
  // strip trailing punctuation; handle balanced parens
  while (text.length > 0) {
    const last = text[text.length - 1];
    if ('?!.,:;*_~\'"'.includes(last)) { text = text.slice(0, -1); continue; }
    if (last === ')') {
      // include only if there is an unmatched '(' earlier in the url.
      // A ) with no preceding unmatched ( is itself unmatched and
      // does not cancel a later ( (doc-12: the ) after a.com must
      // not cancel the ( of ](./docs/d.md), whose final ) balances).
      let depth = 0;
      for (let k = 0; k < text.length - 1; k++) {
        if (text[k] === '(') depth++;
        else if (text[k] === ')' && depth > 0) depth--;
      }
      if (depth > 0) break;
      text = text.slice(0, -1); continue;
    }
    if (last === '&') { text = text.slice(0, -1); continue; }
    break;
  }
  if (!text) return null;
  // href is always recomputed from the trimmed text (gfm-629: the
  // trailing ) that belongs to the surrounding text must not leak in)
  let href;
  if (kind === 'www') href = 'http://' + text;
  else if (kind === 'email') href = 'mailto:' + text;
  else href = text;
  return { href, text, next: i + text.length };
}

// Backticks in a link label (marked quirk, doc-16/doc-18/doc-20):
// the link does not form when the label holds a well-formed code
// span (opener N, closer N) whose content has a backtick run of a
// different length AND the span is not the last thing in the label.
// A span with a mismatched inner run at the very end of the label is
// fine (doc-03), and runs that never form a well-formed span are
// literal (doc-06). (A lone unmatched backtick is left alone: it
// also occurs inside emphasis where the link does form, doc-06.)
// True if the label holds a backtick run that opens a code span which
// never closes (no later run of the same length in the label, with
// label content after it) — an orphaned backtick, e.g. ``s` in
// [i ``s`]. Such a link suppresses emphasis between itself and the
// next code span in the paragraph (doc-16/28/35).
function labelHasOrphanedBacktick(label) {
  const runs = [];
  let j = 0;
  while (j < label.length) {
    if (label[j] !== '`') { j++; continue; }
    // An escaped backtick (\`) is a literal character, not a code
    // span delimiter: skip it (odd count of preceding backslashes).
    let bs = 0;
    for (let k = j - 1; k >= 0 && label[k] === '\\'; k--) bs++;
    if (bs % 2 === 1) { j++; continue; }
    let n = 0;
    while (j + n < label.length && label[j + n] === '`') n++;
    runs.push([j, n]);
    j += n;
  }
  // Pair runs greedily like labelBackticksOk: a run that pairs with a
  // later run of the same length forms a code span, and the runs
  // strictly between them are content inside it, not openers.
  let r = 0;
  while (r < runs.length) {
    const n = runs[r][1];
    let c = r + 1;
    while (c < runs.length && runs[c][1] !== n) c++;
    if (c >= runs.length) {
      if (runs[r][0] + runs[r][1] < label.length) return true;
      r++;
    } else {
      r = c + 1;
    }
  }
  return false;
}
function labelBackticksOk(label) {
  const runs = [];
  let j = 0;
  while (j < label.length) {
    if (label[j] !== '`') { j++; continue; }
    let n = 0;
    while (j + n < label.length && label[j + n] === '`') n++;
    runs.push([j, n]);
    j += n;
  }
  let r = 0;
  while (r < runs.length) {
    const n = runs[r][1];
    let c = r + 1;
    while (c < runs.length && runs[c][1] !== n) c++;
    if (c >= runs.length) return true; // no well-formed span: literal
    const spanEnd = runs[c][0] + runs[c][1];
    for (let k = r + 1; k < c; k++) {
      if (runs[k][1] !== n && spanEnd < label.length) return false;
    }
    r = c + 1;
  }
  return true;
}

// Try to form a link/image at ']' (position i in source s).
// opener is the delimiter node for '[' / '!['.
// Returns {href, title, isImage, next} or null.
function tryLink(s, i, opener, refs) {
  // i points at ']'. The text after it starts at i+1.
  // Reject the link if the label holds a well-formed code span with
  // a mismatched inner backtick run and text after it (doc-16/18/20).
  // The caller also suppresses emphasis inside such a label.
  if (opener.pos !== undefined) {
    const start = opener.pos + (opener.img ? 2 : 1);
    if (!labelBackticksOk(s.slice(start, i))) return { badLabel: true };
  }
  // The '(' or '[' must follow IMMEDIATELY (no whitespace, cm-511).
  const j = i + 1;
  if (j < s.length && s[j] === '(') {
    const d = parseDest(s, j + 1, true);
    if (d) {
      let p = d.next, title = '';
      const t = parseTitle(s, p);
      if (t) { title = t.title; p = t.next; }
      while (p < s.length && isWs(s[p])) p++;
      if (p < s.length && s[p] === ')') {
        return { href: decodeDest(d.dest), title: decodeDest(title), isImage: opener.img, next: p + 1 };
      }
    }
    // '(' present but no valid inline link: fall back to the shortcut
    // reference (cm-568: [foo](not a link) links via [foo]: /url1,
    // with "(not a link)" left as literal text).
    return { shortcut: true, isImage: opener.img, next: j };
  }
  // reference link: '[' label ']'
  if (j < s.length && s[j] === '[') {
    const lab = parseLabel(s, j);
    if (lab) {
      const key = lab.label === '' ? null : normalizeLabel(lab.label);
      if (key !== null) {
        const ref = refs.get(key);
        if (ref) return { href: ref.dest, title: ref.title, isImage: opener.img, next: lab.next };
        // label parsed but no such ref: the whole ][...] is literal
        // (cm-545: its [ must not become a shortcut opener)
        return { failedLabel: true, next: lab.next };
      }
      // empty label [] -> collapsed reference: label = link text
      if (lab.label === '') {
        return { collapsed: true, isImage: opener.img, next: lab.next };
      }
      return null;
    }
    return null;
  }
  // shortcut reference: label = link text
  return { shortcut: true, isImage: opener.img, next: j };
}

// Main inline parse: text -> HTML string.
// Document-level "inside an unclosed <a href>" state (marked quirk,
// doc-03): once an <a href="..."> opening tag is followed by text
// content and never closed by </a>, GFM autolinks (bare URLs and
// emails) are suppressed in that paragraph AND all following
// paragraphs, until a </a> appears. Explicit markdown links are NOT
// suppressed. Reset at the start of each parse() call.
let docInLink = false;
// Can the [ opener at text[pos] form a link? Used to decide whether
// a bare URL/email inside it is suppressed (doc-39): if the [ cannot
// form a link (undefined [label] ref, or a shortcut whose text is not
// a defined ref), the URL must still autolink. Conservative: any
// uncertainty returns true (suppress, the old behaviour).
function bracketCanLink(text, pos, refs) {
  // find the ] closing this [ (first ] not escaped, no nesting)
  let close = -1;
  for (let k = pos + 1; k < text.length; k++) {
    if (text[k] === '\\') { k++; continue; }
    if (text[k] === ']') { close = k; break; }
    if (text[k] === '\n') break;
  }
  if (close === -1) return true;
  const after = text[close + 1];
  if (after === '(') return true; // inline link
  if (after === '[') {
    // full/collapsed reference: label between [ and its ]
    let e = text.indexOf(']', close + 2);
    if (e === -1) return true;
    const lab = text.slice(close + 2, e);
    if (lab === '') {
      // collapsed: label is the link text itself
      const t = normalizeLabel(text.slice(pos + 1, close));
      return t === '' || refs.has(t);
    }
    return refs.has(normalizeLabel(lab));
  }
  // shortcut reference: label is the link text
  const t = normalizeLabel(text.slice(pos + 1, close));
  return t === '' || refs.has(t);
}
function parseInline(text, refs) {
  const list = { head: null, tail: null };
  const delims = []; // delimiter nodes in order
  // Index in delims of the first delimiter added after a link whose
  // label holds an orphaned backtick (-1 = none). Every code span
  // formed after such a link deactivates the * / _ delimiters added
  // in between (doc-09/16/28/35 suppression zone); the flag stays
  // set for the whole paragraph, so only emphasis after the last
  // code span still forms.
  let orphanLinkDelims = -1;
  const skipBracket = new Set(); // text indices where [ is literal, not an opener
  const skipClose = new Set(); // text indices where ] is literal, not a closer
  const n = text.length;
  let i = 0;
  const flushText = (s) => { if (s) addText(list, s); };
  // Plain-word batching: a maximal run of chars that cannot be a
  // delimiter, a code span, a link, an entity, a break or an autolink
  // is flushed as one text node instead of char by char. The run stops
  // at whitespace, at any markdown-significant char, and at ':'/'@'
  // (a word followed by those may be a scheme/email autolink, which
  // the normal path must still see); a run starting with 'www.' is
  // never batched for the same reason. gfm-632's word-continuation
  // rule is untouched: '_' stops a run, so an email's '_' is still a
  // delimiter the autolink logic can inspect.
  const WORD_RE = /[^\s\\`*_~\[\]<&:@]+/y;
  while (i < n) {
    const c = text[i];
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
      // An autolink (email/scheme/www.) may start here: scan the whole
      // word first — a '_' inside an email local part (gfm-632:
      // a.b-c_d@a.b) must not split the word before the autolink check.
      // Only batch when the word cannot be an autolink at all.
      let mayLink = text[i] === 'w' && text[i + 1] === 'w' && text[i + 2] === 'w' && text[i + 3] === '.';
      if (!mayLink) {
        for (let k = i; k < n; k++) {
          const kc = text[k];
          if (kc === ':' || kc === '@') { mayLink = true; break; }
          if (kc === ' ' || kc === '\t' || kc === '\n' || kc === '<') break;
        }
      }
      if (!mayLink) {
        WORD_RE.lastIndex = i;
        const wm = WORD_RE.exec(text);
        if (wm && wm[0].length > 1) {
          flushText(wm[0]);
          i += wm[0].length;
          continue;
        }
      }
    }
    // backslash
    if (c === '\\') {
      if (i + 1 < n && isAsciiPunct(text[i + 1])) {
        // \& must escape to &amp; (not be read as an entity start):
        // emit the pre-escaped form, which escHtml preserves as-is.
        if (text[i + 1] === '&') flushText('&amp;');
        else flushText(text[i + 1]);
        i += 2; continue;
      }
      if (i + 1 < n && text[i + 1] === '\n') {
        const br = inode('br'); appendNode(list, br); i += 2;
        // backslash hard break: next line's leading whitespace is
        // stripped too (cm-637)
        while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;
        continue;
      }
      flushText('\\'); i++; continue;
    }
    // backtick code span
    if (c === '`') {
      let j = i, run = 0;
      while (j < n && text[j] === '`') { run++; j++; }
      let end = findCodeEnd(text, j, run);
      if (end >= 0) {
        // A code span must not swallow a ]( that closes an active
        // [ link ACROSS A NEWLINE: links are tokenized before code
        // spans, so the link wins (doc-09: ``url` inside [docs
        // each ...](...) must stay literal so the link forms, not
        // merge with the next `` run in a later line). A LOCAL code
        // span (no newline in its content) still wins over the
        // link (cm-342: `link](/foo` forms a code span, no link;
        // cm-525 likewise), so this check only applies when the
        // content spans a newline.
        // Exception (doc-28): a lone backtick that follows another
        // backtick run inside the SAME label (``small` — the `` run
        // never closed) must not swallow the ]( either: it is an
        // orphaned backtick, not a real code span opener.
        const content0 = text.slice(j, end);
        const closeIdx = content0.indexOf('](');
        if (closeIdx !== -1) {
          let opener = null;
          for (let d = delims.length - 1; d >= 0; d--) {
            if (delims[d].ch === '[' && delims[d].active) { opener = delims[d]; break; }
          }
          if (opener) {
            const bracketPos = j + closeIdx;
            const res = tryLink(text, bracketPos, opener, refs);
            // Apply the link-wins rule when the content spans a
            // newline (doc-09), OR when this backtick is orphaned:
            // another backtick run sits between the [ opener and
            // this backtick (doc-28's `` before `small`).
            const orphaned = text.slice(opener.pos + 1, i).includes('`');
            if (res && !res.failedLabel && (content0.includes('\n') || orphaned)) end = -1;
          }
        }
      }
      if (end >= 0) {
        // A code span after a link with an orphaned backtick in its
        // label suppresses the * / _ delimiters added between the
        // link and this code span (doc-09/16/28/35). The flag is NOT
        // cleared: a later code span suppresses delimiters added
        // after this one too, so only emphasis after the LAST code
        // span in the paragraph still forms.
        if (orphanLinkDelims >= 0) {
          for (let d = orphanLinkDelims; d < delims.length; d++) {
            const dd = delims[d];
            // Only top-level delimiters are suppressed; ones already
            // wrapped inside a link/emphasis keep forming there
            // (doc-35: *fast* inside a link still becomes <em>).
            if ((dd.ch === '*' || dd.ch === '_') && !dd.dead && !dd.par) { dd.dead = true; dd.canOpen = false; dd.canClose = false; }
          }
        }
        let content = text.slice(j, end);
        // normalize: newlines -> spaces; strip one leading+trailing space if both
        content = content.replace(/\n/g, ' ');
        if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' && content.trim() !== '') {
          content = content.slice(1, -1);
        }
        const nd = inode('code'); nd.s = content; appendNode(list, nd);
        i = end + run; continue;
      }
      flushText(text.slice(i, j)); i = j; continue;
    }
    // emphasis / strikethrough runs
    if (c === '*' || c === '_') {
      let j = i, run = 0;
      while (j < n && text[j] === c) { run++; j++; }
      const f = flank(text, i, run);
      let canOpen, canClose;
      if (c === '*') { canOpen = f.leftFlanking; canClose = f.rightFlanking; }
      else {
        canOpen = f.leftFlanking && (!f.rightFlanking || f.before !== '' && isUnicodePunct(f.before));
        canClose = f.rightFlanking && (!f.leftFlanking || f.after !== '' && isUnicodePunct(f.after));
      }
      const nd = inode('delim');
      nd.ch = c; nd.cnt = run; nd.canOpen = canOpen; nd.canClose = canClose;
      nd.active = true; nd.img = false; nd.s = text.slice(i, j);
      appendNode(list, nd); delims.push(nd);
      i = j; continue;
    }
    if (c === '~') {
      let j = i, run = 0;
      while (j < n && text[j] === '~') { run++; j++; }
      // a single ~ can also open/close a <del> (gfm-491); runs of 3+
      // never form one (gfm-493) — enforced in processEmphasis
      const f = flank(text, i, run);
      const nd = inode('delim');
      nd.ch = '~'; nd.cnt = run; nd.canOpen = f.leftFlanking; nd.canClose = f.rightFlanking;
      nd.active = true; nd.img = false; nd.s = text.slice(i, j);
      appendNode(list, nd); delims.push(nd);
      i = j; continue;
    }
    // image / link opener (unless this [ was the label of a failed
    // full reference — then it is literal text, cm-545)
    if (c === '[' || (c === '!' && i + 1 < n && text[i + 1] === '[')) {
      if (c === '[' && skipBracket.has(i)) { flushText('['); i++; continue; }
      const img = c === '!';
      const nd = inode('delim');
      nd.ch = '['; nd.cnt = 1; nd.canOpen = false; nd.canClose = false;
      nd.active = true; nd.img = img; nd.s = img ? '![' : '[';
      nd.pos = i;
      appendNode(list, nd); delims.push(nd);
      i += img ? 2 : 1; continue;
    }
    // link closer
    if (c === ']') {
      if (skipClose.has(i)) { flushText(']'); i++; continue; }
      // find nearest active '[' delimiter
      let opener = null, oi = -1;
      for (let d = delims.length - 1; d >= 0; d--) {
        if (delims[d].ch === '[' && delims[d].active) { opener = delims[d]; oi = d; break; }
      }
      if (opener) {
        const res = tryLink(text, i, opener, refs);
        if (res && res.badLabel) {
          // Label has a well-formed code span with a mismatched inner
          // backtick run (doc-16/18/20): the link does not form, and
          // emphasis inside the label is suppressed too — deactivate
          // the * / _ delimiters between the opener and this ']'.
          for (let d = oi + 1; d < delims.length; d++) {
            const dd = delims[d];
            if ((dd.ch === '*' || dd.ch === '_') && !dd.dead) { dd.dead = true; dd.canOpen = false; dd.canClose = false; }
          }
          opener.active = false;
          flushText(']'); i++; continue;
        }
        if (res && res.failedLabel) {
          // ][...] with no such ref: the ] is literal. The label's [
          // must not become a shortcut opener (cm-545) — unless it is
          // followed by another [ that it could pair with (cm-569).
          // The label's ] is literal too (doc-12: in [a [b][c]](url)
          // the ] closing [c] must not close the outer [a).
          opener.active = false;
          const labelOpen = i + 1;
          if (text[res.next] !== '[') {
            skipBracket.add(labelOpen);
            skipClose.add(res.next - 1);
          }
          flushText(']'); i++; continue;
        }
        if (res) {
          let href = res.href, title = res.title || '', next = res.next;
          if (res.collapsed || res.shortcut) {
            const label = normalizeLabel(linkTextPlain(opener, list));
            const ref = refs.get(label);
            if (!ref) {
              // not a link: literal ']', and this '[' can no longer open
              // (cm-512/513: a failed ] pops its opener)
              opener.active = false;
              flushText(']'); i++; continue;
            }
            href = ref.dest; title = ref.title;
          }
          // build link/image node wrapping nodes after opener
          const first = opener.n;
          const last = list.tail;
          const isImage = !!res.isImage;
          // A link cannot contain another link (cm-520): if the nodes
          // between the opener and here include an EXPLICIT link, this
          // opener cannot form a link — deactivate it, literal ']'.
          // Autolinks (<url> / bare URL / email) MAY sit inside link
          // text (doc-03: marked nests them), so link.auto nodes do
          // not block. (Images may contain link-like text in alt.)
          if (!isImage && first) {
            let hasLink = false;
            let nd = first;
            while (nd) {
              if (nd.t === 'link' && !nd.auto) { hasLink = true; break; }
              if (nd === last) break;
              nd = nd.n;
            }
            if (hasLink) {
              opener.active = false;
              flushText(']'); i++; continue;
            }
          }
          if (isImage) {
            const alt = first ? plainText(first, last, true) : '';
            const img = inode('image'); img.src = href; img.title = title; img.alt = alt;
            // remove opener and everything after it up to tail
            removeRange(list, opener, last);
            appendNode(list, img);
            // drop delimiters created inside the image text (nodes discarded)
            for (let d = delims.length - 1; d > oi; d--) delims.splice(d, 1);
          } else {
            const link = inode('link'); link.href = href; link.title = title;
            // wrap nodes after opener into the link
            if (first) {
              wrapNodes(list, first, last, link);
            } else {
              appendNode(list, link);
            }
            removeNode(list, opener);
          }
          // remove the opener delimiter from the stack
          delims.splice(oi, 1);
          // A link whose label holds an orphaned backtick starts a
          // suppression zone: emphasis added after it is deactivated
          // when the next code span forms (doc-16/28/35).
          if (opener.pos !== undefined) {
            const labStart = opener.pos + (isImage ? 2 : 1);
            if (labelHasOrphanedBacktick(text.slice(labStart, i))) orphanLinkDelims = delims.length;
          }
          i = next; continue;
        }
        // tryLink failed: this '[' can no longer open (cm-512/513)
        opener.active = false;
      }
      flushText(']'); i++; continue;
    }
    // autolink / inline html
    if (c === '<') {
      const a = parseAutolink(text, i);
      if (a) {
        const link = inode('link'); link.href = a.href; link.title = ''; link.auto = true;
        const t = textNode(a.text); appendNode(list, t);
        // wrap the text node into the link
        wrapNodes(list, t, t, link);
        i = a.next; continue;
      }
      const h = parseInlineHtml(text, i);
      if (h) {
        // Track unclosed <a> for the docInLink autolink suppression.
        if (/^<\/a[\s>]/i.test(h)) {
          docInLink = false;
        } else if (/^<a[\s>]/i.test(h)) {
          // Opening <a>: suppresses following autolinks if the
          // paragraph has non-whitespace content besides the tag
          // itself — text BEFORE it (doc-03: "foo <a href=...>" at
          // the end of a paragraph suppresses) or AFTER it (a bare
          // single-line tag alone does not) — OR if the href VALUE
          // itself spans a newline (doc-03: <a href="foo\nbar">
          // alone still suppresses; but <a\nhref="foo"> does not).
          // A </a> later in the paragraph clears it. A bare opening
          // <a> with NO attributes at all does NOT suppress (it is
          // not a link); every other <a ...> form suppresses when
          // the paragraph has other content — including a
          // self-closing <a /> with NO href (doc-06: <a  /><b2 ...>)
          // and a self-closing <a href="..." />.
          const bareA = /^<a\s*>$/i.test(h);
          if (!bareA) {
            const hm = /href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(h);
            const hrefHasNl = hm ? hm[1].includes('\n') : false;
            const before = text.slice(0, i).replace(/^[ \t\r\n]+/, '').replace(/[ \t\r\n]+$/, '');
            const rest = text.slice(i + h.length).replace(/^[ \t\r\n]+/, '');
            const hasBefore = before.length > 0;
            const hasAfter = rest.length > 0 && !/^<\/a[\s>]/i.test(rest);
            if (hrefHasNl || hasBefore || hasAfter) docInLink = true;
          }
        }
        const nd = inode('html'); nd.s = h; appendNode(list, nd);
        i += h.length; continue;
      }
      flushText('<'); i++; continue;
    }
    // entity: numeric entities ARE decoded; named entities pass through
    // untouched (escHtml noEncode preserves them); bare & is escaped.
    if (c === '&') {
      const m = /^#(\d{1,7}|[Xx][0-9A-Fa-f]{1,6});/.exec(text.slice(i + 1));
      if (m) {
        let cp;
        if (m[1][0] === 'x' || m[1][0] === 'X') cp = parseInt(m[1].slice(1), 16);
        else cp = parseInt(m[1], 10);
        if (cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) flushText('\uFFFD');
        else flushText(String.fromCodePoint(cp));
        i += 1 + m[0].length; continue;
      }
      flushText('&'); i++; continue;
    }
    // GFM extended autolink (any letter can start one — an email
    // local part may be capitalized, doc-03: Public@prism.example.com).
    // Suppressed while inside an unclosed <a href> (docInLink), and
    // inside link text (an active [ opener): a bare www./URL/email
    // inside [text](url) stays plain text (doc-03). Angle-bracket
    // autolinks <url> MAY nest inside link text, so they are not
    // suppressed here.
    // Gate: an autolink can only START at a word boundary (prev char
    // is start/ws/*/_/~/\(/<). Mid-word letters skip the delimiter
    // scan and the regexes entirely.
    const prevCh = i > 0 ? text[i - 1] : '';
    const okPrev = prevCh === '' || isWs(prevCh) || prevCh === '*' || prevCh === '_' || prevCh === '~' || prevCh === '(' || prevCh === '<';
    let inLinkText = false;
    if (isAlphaCh(c) && okPrev && !docInLink) {
      for (let d = delims.length - 1; d >= 0; d--) {
        if (delims[d].ch === '[' && delims[d].active) {
          // Suppress only if this [ can still form a link: a link
          // cannot contain another link, so if the text after this
          // [ already holds a (non-auto) link node, no link can
          // form here and a bare URL must still autolink (doc-08).
          // Also, if this [ provably CANNOT form a link (a
          // [label] reference that is not defined, or a shortcut
          // whose text is not a defined ref — doc-39), the bare
          // URL inside it must still autolink.
          let hasLink = false;
          for (let nd = delims[d].n; nd; nd = nd.n) {
            if (nd.t === 'link' && !nd.auto) { hasLink = true; break; }
          }
          if (!hasLink && bracketCanLink(text, delims[d].pos, refs)) { inLinkText = true; }
          break;
        }
      }
    }
    if (isAlphaCh(c) && okPrev && !docInLink && !inLinkText) {
      // Cheap gate: a GFM autolink needs a scheme ':' or an email '@'
      // in this word, or a 'www.' start. Scanning the word avoids
      // parseGfmAutolink's slice of the whole rest of the paragraph
      // plus its regexes on every plain word (gfm-632's word-continuation
      // rule is enforced inside parseGfmAutolink itself).
      let mayLink = text.startsWith('www.', i);
      if (!mayLink) {
        for (let k = i; k < n; k++) {
          const kc = text[k];
          if (kc === ':' || kc === '@') { mayLink = true; break; }
          if (kc === ' ' || kc === '\t' || kc === '\n' || kc === '<') break;
        }
      }
      if (!mayLink) { flushText(c); i++; continue; }
      const g = parseGfmAutolink(text, i, prevCh);
      if (g) {
        const link = inode('link'); link.href = g.href; link.title = ''; link.auto = true;
        const t = textNode(g.text); appendNode(list, t);
        wrapNodes(list, t, t, link);
        i = g.next; continue;
      }
    }
    // newline: hard/soft break
    if (c === '\n') {
      // >=2 trailing spaces -> hard break (spaces removed);
      // 0 or 1 trailing space -> soft break (the space is preserved)
      let spaces = 0;
      const tail = list.tail;
      if (tail && tail.t === 'text') {
        let k = tail.s.length;
        while (k > 0 && tail.s[k - 1] === ' ') { k--; spaces++; }
        if (spaces >= 2) {
          if (k === 0) removeNode(list, tail);
          else tail.s = tail.s.slice(0, k);
        }
      }
      if (spaces >= 2) {
        appendNode(list, inode('br'));
        i++;
        // after a hard break the next line's leading whitespace is
        // stripped (cm-636/637); after a soft break it is kept
        while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;
      } else {
        appendNode(list, inode('softbr'));
        i++;
      }
      continue;
    }
    // plain char
    flushText(c); i++;
  }
  // ---- emphasis processing ----
  processEmphasis(list, delims);
  return renderInline(list);
}
// Plain text of the nodes after opener up to list tail (link text).
function linkTextPlain(opener, list) {
  const first = opener.n;
  if (!first) return '';
  return plainText(first, list.tail);
}
// Remove opener node and all nodes after it up to and including last.
function removeRange(list, opener, last) {
  let cur = opener;
  const after = last ? last.n : null;
  const before = opener.p;
  while (cur) {
    const nx = cur.n;
    cur.n = cur.p = cur.par = null;
    cur.dead = true;
    if (cur === last) break;
    cur = nx;
  }
  if (before) before.n = after; else list.head = after;
  if (after) after.p = before; else list.tail = before;
}

// ---- emphasis / strikethrough processing (CommonMark delimiter algorithm) ----
// True if this node (or any em/strong/del in its subtree) was closed
// by a delimiter node OTHER than `cur` that could itself open
// emphasis. Used by processEmphasis to decide where a closer's
// leftover delimiters go: marked puts up to `use` of them INSIDE the
// new emphasis when the wrapped content already holds such an
// emphasis (doc-30: `**a *b*c***` keeps the leftover `*` inside,
// while `**a b***` leaves it outside, and cm-417's `*********`
// split across three strongs keeps its leftovers outside because
// those strongs were all closed by the SAME run).
function nodeHasForeignOpenableCloser(nd, cur) {
  if (!nd) return false;
  if ((nd.t === 'em' || nd.t === 'strong' || nd.t === 'del') && nd.closerCanOpen && nd.closerNode !== cur) return true;
  let c = nd.c;
  while (c) {
    if (nodeHasForeignOpenableCloser(c, cur)) return true;
    if (c === nd.ce) break;
    c = c.n;
  }
  return false;
}
function processEmphasis(list, delims) {
  const em = delims.filter(d => (d.ch === '*' || d.ch === '_' || d.ch === '~') && !d.dead);
  const bottom = { '*': 0, '_': 0, '~': 0 };
  // After a match that blocks below, openers below the matched opener
  // with FEWER delimiters than the match used are skipped — but an
  // opener with just as many delimiters is still reachable (doc-11:
  // after **d** forms, the * at pos 6 (cnt 1) is blocked but the **
  // at pos 2 (cnt 2) must still pair with the trailing **).
  const blockOi = { '*': -1, '_': -1, '~': -1 };
  const blockUse = { '*': 0, '_': 0, '~': 0 };
  // The closer node that set the block: its REMAINDER (after a partial
  // use, e.g. *** -> ** + *) may still pair with the outer opener
  // (doc-19) — the block only bars a DIFFERENT, later closer.
  const blockCloser = { '*': null, '_': null, '~': null };
  let ci = 0;
  while (ci < em.length) {
    const closer = em[ci];
    if (closer.dead || !closer.canClose) { ci++; continue; }
    const ch = closer.ch;
    let oi = -1;
    // The search runs down to the bottom as it stood when this closer
    // started; a rule-of-3 block updates bottom for FUTURE closers only
    // (cm-412: blocking the ** must not hide the leading * from this *).
    const startBottom = bottom[ch];
    for (let k = ci - 1; k >= startBottom; k--) {
      const op = em[k];
      if (op.dead || op.ch !== ch || !op.canOpen) continue;
      if (op.par !== closer.par) continue; // cannot span a container boundary
      // Blocked-below filter: an opener below the matched opener of
      // an earlier blocking match, with fewer delimiters than that
      // match used, cannot pair (doc-03); one with as many can.
      // But the REMAINDER of the same closer that set the block is
      // exempt (doc-19: *** splits into ** + *, and the * must still
      // reach the outer opener).
      if (closer !== blockCloser[ch] && k < blockOi[ch] && op.cnt < blockUse[ch]) continue;
      // Rule of 3: when either delimiter can both open and close, the match
      // is forbidden if the length sum is a multiple of 3 UNLESS both
      // lengths are themselves multiples of 3.
      const eitherBoth = (op.canOpen && op.canClose) || (closer.canOpen && closer.canClose);
      if (eitherBoth && (op.cnt + closer.cnt) % 3 === 0 && (op.cnt % 3 !== 0 || closer.cnt % 3 !== 0)) {
        bottom[ch] = k;
        continue;
      }
      // Strong preference (doc-01/11/26): a `*` closer must not steal
      // a `**` opener from a later `**` closer that would form a
      // strong with it. If this pairing would be a mere em (use 1)
      // off an opener with exactly 2 delimiters, and a later closer
      // of the same char with 2+ delimiters could take that opener
      // for a strong, skip this opener so the strong can form. (An
      // opener with 3+ delimiters can serve both — cm-430's `***`
      // gives 1 to the em and 2 to the strong — so it is not stolen.)
      if (ch !== '~' && op.cnt === 2 && closer.cnt < 2) {
        let steal = false;
        for (let m = ci + 1; m < em.length; m++) {
          const lc = em[m];
          if (lc.dead || lc.ch !== ch || !lc.canClose || lc.cnt < 2) continue;
          if (lc.par !== op.par) continue;
          const lb = (op.canOpen && op.canClose) || (lc.canOpen && lc.canClose);
          if (lb && (op.cnt + lc.cnt) % 3 === 0 && (op.cnt % 3 !== 0 || lc.cnt % 3 !== 0)) continue;
          steal = true; break;
        }
        if (steal) continue;
      }
      oi = k; break;
    }
    // Do NOT advance bottom[ch] to ci here: an opener blocked for this
    // closer by the rule of 3 may still pair with a later closer of a
    // different length (cm-411: the leading * must stay available for the
    // trailing * after the ** closer was blocked).
    if (oi < 0) { ci++; continue; }
    const opener = em[oi];
    // After a match, openers at/below the one just used are blocked
    // from later closers of the same char ONLY when ALL of: the opener
    // can only open (not close), the closer can both open and close,
    // and the nearest same-char opener below the one just used has
    // FEWER delimiters than this match used (doc-03: "*a **b**c*"
    // uses 2 but the leading * has 1, so the trailing * cannot reach
    // it; but "**a **b**c**" uses 2 and the leading ** has 2, "*a
    // *b*c*" uses 1 and the leading * has 1, and cm-411's inner **
    // opener can both open and close — in all of those the outer
    // emphasis still forms).
    let blockBelow = false;
    let use0 = 0;
    if (!opener.canClose && closer.canOpen && closer.canClose) {
      use0 = (opener.cnt >= 2 && closer.cnt >= 2) ? 2 : 1;
      let outerCnt = Infinity;
      for (let k = oi - 1; k >= 0; k--) {
        const od = em[k];
        if (od.dead || od.ch !== ch || !od.canOpen) continue;
        outerCnt = od.cnt; break;
      }
      blockBelow = outerCnt < use0;
    }
    let use;
    if (ch === '~') {
      // <del> needs matching runs of 1 or 2 tildes; 3+ never forms
      // one (gfm-491 single ~ works, gfm-493 ~~~ does not)
      if (opener.cnt !== closer.cnt || opener.cnt > 2) { bottom[ch] = ci; ci++; continue; }
      use = opener.cnt;
    } else {
      use = (opener.cnt >= 2 && closer.cnt >= 2) ? 2 : 1;
    }
    const type = (ch === '~') ? 'del' : (use === 2 ? 'strong' : 'em');
    const first = opener.n;
    const last = closer.p;
    if (!first || !last || first === closer) { bottom[ch] = ci; ci++; continue; }
    // Does the wrapped range already hold an emphasis closed by a
    // DIFFERENT delimiter run that could open? If so, up to `use`
    // of this closer's leftover delimiters stay INSIDE (doc-30).
    let trigger = false;
    if (ch !== '~') {
      let cur = first;
      while (cur) {
        if (nodeHasForeignOpenableCloser(cur, closer)) { trigger = true; break; }
        if (cur === last) break;
        cur = cur.n;
      }
    }
    const wrap = inode(type);
    wrap.closerNode = closer;
    wrap.closerCanOpen = closer.canOpen;
    wrapNodes(list, first, last, wrap);
    const leftover = closer.cnt - use;
    let insideCount = 0;
    // Only a `*` strong takes leftovers inside (probed: an `*` em
    // leaves them outside, and a `_` strong leaves them outside).
    if (trigger && leftover > 0 && ch === '*' && use === 2) {
      insideCount = Math.min(leftover, use);
      if (insideCount > 0) {
        const insideNd = textNode(ch.repeat(insideCount));
        insideNd.par = wrap;
        insideNd.p = wrap.ce;
        wrap.ce.n = insideNd;
        wrap.ce = insideNd;
      }
    }
    opener.s = opener.s.slice(0, opener.s.length - use);
    opener.cnt -= use;
    closer.s = ch.repeat(Math.max(0, leftover - insideCount));
    closer.cnt = leftover - insideCount;
    if (opener.cnt <= 0) { removeNode(list, opener); opener.dead = true; }
    if (closer.cnt <= 0) { removeNode(list, closer); closer.dead = true; }
    if (blockBelow) { blockOi[ch] = oi; blockUse[ch] = use0; blockCloser[ch] = closer; }
    if (closer.dead) ci++;
  }
}
// Render an inline node list to HTML.
function renderInline(list) {
  let out = '';
  let cur = list.head;
  while (cur) {
    out += renderNode(cur);
    cur = cur.n;
  }
  return out;
}
function renderInlineNodes(first, last) {
  let out = '';
  let cur = first;
  while (cur) {
    out += renderNode(cur);
    if (cur === last) break;
    cur = cur.n;
  }
  return out;
}
function renderNode(nd) {
  switch (nd.t) {
    case 'text': return escHtml(nd.s);
    case 'delim': return escHtml(nd.s);
    case 'code': return '<code>' + escHtmlEncode(nd.s) + '</code>';
    case 'html': return nd.s;
    case 'br': return '<br>';
    case 'softbr': return '\n';
    case 'em': return '<em>' + renderInlineNodes(nd.c, nd.ce) + '</em>';
    case 'strong': return '<strong>' + renderInlineNodes(nd.c, nd.ce) + '</strong>';
    case 'del': return '<del>' + renderInlineNodes(nd.c, nd.ce) + '</del>';
    case 'link': {
      let s = '<a href="' + escHref(nd.href) + '"';
      if (nd.title) s += ' title="' + escHtml(nd.title) + '"';
      s += '>' + renderInlineNodes(nd.c, nd.ce) + '</a>';
      return s;
    }
    case 'image': {
      let s = '<img src="' + escHref(nd.src) + '" alt="' + escHtml(nd.alt) + '"';
      if (nd.title) s += ' title="' + escHtml(nd.title) + '"';
      s += '>';
      return s;
    }
    default: return '';
  }
}

// ================= LINK REFERENCE DEFINITIONS =================
// Try to parse one link reference definition starting at text[pos]
// (pos must be at a line start). Returns end index (start of next line)
// or null if not a valid definition. Adds to refs (first wins).
function tryRefDef(text, pos, refs) {
  let i = pos;
  // up to 3 spaces indent
  let sp = 0;
  while (i < text.length && text[i] === ' ' && sp < 4) { sp++; i++; }
  if (sp >= 4) return null;
  if (text[i] !== '[') return null;
  const lab = parseLabel(text, i);
  if (!lab) return null;
  // an empty or all-whitespace label is not a valid ref def (cm-551, cm-552)
  if (normalizeLabel(lab.label) === '') return null;
  let j = lab.next;
  if (text[j] !== ':') return null;
  j++;
  // destination (whitespace incl. newlines allowed before it)
  const d = parseDest(text, j);
  if (!d) return null;
  const dest = decodeDest(d.dest);
  // end of the destination's line (fallback: destination-only ref def)
  let lineEnd = d.next;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;
  // optional title: must be separated from the destination by whitespace
  let p = d.next, title = '', titleEnd = -1;
  let skipped = 0;
  while (p < text.length && isWs(text[p])) { p++; skipped++; }
  if (skipped > 0 && p < text.length && (text[p] === '"' || text[p] === "'" || text[p] === '(')) {
    const t = parseTitle(text, p);
    if (t) {
      let q = t.next;
      while (q < text.length && (text[q] === ' ' || text[q] === '\t')) q++;
      if (q >= text.length || text[q] === '\n') {
        title = decodeDest(t.title);
        titleEnd = q;
      }
    }
  }
  let end;
  if (titleEnd >= 0) {
    end = titleEnd;
  } else {
    // destination-only: only whitespace may follow on the destination's line
    let q = d.next;
    while (q < lineEnd && (text[q] === ' ' || text[q] === '\t')) q++;
    if (q !== lineEnd) return null;
    end = lineEnd;
  }
  const key = normalizeLabel(lab.label);
  if (key && !refs.has(key)) refs.set(key, { dest, title });
  // end index: start of next line (skip the newline)
  if (end < text.length && text[end] === '\n') end++;
  return end;
}
// Strip leading link reference definitions from a paragraph's text.
// Returns the remaining text.
function stripRefDefs(text, refs) {
  let pos = 0;
  while (pos < text.length) {
    const end = tryRefDef(text, pos, refs);
    if (end === null) break;
    pos = end;
  }
  return text.slice(pos);
}

// ================= GFM TABLES =================
// Split a table row line into cells (respecting \| escapes and code spans).
function splitTableRow(line) {
  // strip one leading/trailing pipe (with optional spaces)
  let s = line;
  // leading pipe
  let i = 0;
  while (i < s.length && s[i] === ' ') i++;
  if (s[i] === '|') { s = s.slice(i + 1); }
  // trailing pipe
  let j = s.length;
  while (j > 0 && s[j - 1] === ' ') j--;
  if (j > 0 && s[j - 1] === '|') { s = s.slice(0, j - 1); }
  const cells = [];
  let cur = '', k = 0;
  while (k < s.length) {
    const c = s[k];
    // An escaped backslash \\ is a literal backslash: it does NOT
    // escape the following | (doc-26: `a \\| b` splits at the |).
    // A single \| is an escaped pipe (literal |, no split).
    // Pipes inside code spans DO split in marked (doc-26: `a | b`
    // splits into `a and b`), so backticks get no protection here.
    if (c === '\\' && k + 1 < s.length && s[k + 1] === '\\') { cur += '\\'; k += 2; continue; }
    if (c === '\\' && k + 1 < s.length && s[k + 1] === '|') { cur += '|'; k += 2; continue; }
    if (c === '|') { cells.push(cur); cur = ''; k++; continue; }
    cur += c; k++;
  }
  cells.push(cur);
  return cells.map(x => x.trim());
}
// Parse a delimiter row line; returns array of alignments ('left'|'center'|'right'|null) or null.
function parseDelimRow(line) {
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;
  const aligns = [];
  for (const cell of cells) {
    const m = /^:?-+:?$/.exec(cell);
    if (!m) return null;
    if (cell.startsWith(':') && cell.endsWith(':')) aligns.push('center');
    else if (cell.endsWith(':')) aligns.push('right');
    else if (cell.startsWith(':')) aligns.push('left');
    else aligns.push(null);
  }
  return aligns;
}

// ================= BLOCK PARSER =================
const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem meta nav noframes ol optgroup option p param section source summary table tbody td tfoot th thead title tr track ul').split(' '));
const HTML_END = { 1: '-->', 2: '?>', 3: '>', 4: ']]>' };

function bnode(t) { return { t, children: [] }; }

function parseBlocks(src, refs) {
  let lines = src.split('\n');
  if (lines.length && lines[lines.length - 1] === '' && src.endsWith('\n')) lines.pop();
  const root = bnode('doc');
  const stack = [root]; // open containers: doc, blockquote, list, item
  let leaf = null;      // open leaf block or null
  let lastBlank = false;
  let lastClosed = null; // most recently finalized leaf block

  function deepest() { return stack[stack.length - 1]; }
  // Effective column for tab expansion in fenced-code content:
  // when the fenced code sits directly inside a BLOCKQUOTE, the
  // blockquote markers beyond the first do not advance the tab
  // column (doc-05: a tab at absolute col 4 inside "> > " expands
  // to 2 spaces, not 4; doc-08: the same col 4 inside a list item
  // that holds a blockquote also expands to 2). When the code sits
  // directly inside a LIST ITEM, the item's indent does count
  // (doc-02: col 4 inside a blockquote+list expands to 4).
  // Effective column for tab expansion in a paragraph line: when
  // the innermost container is a blockquote and the column is a
  // tab stop, the blockquote marker does not advance the column
  // (doc-17: a tab at col 4 in a blockquote becomes 2 spaces).
  function tabCol(col) {
    if (col > 0 && col % 4 === 0) {
      const inner = stack[stack.length - 1];
      if (inner && inner.t === 'blockquote') return col - 2;
    }
    return col;
  }
  // Effective column for tab expansion in fenced-code content.
  // A tab widens from its absolute column, except that a blockquote
  // inside a list item does not advance it past the item's content
  // column: subtract the absolute content column (baseCol +
  // contentIndent) of the item that holds the outermost blockquote,
  // and 2 more columns per extra blockquote level. With no
  // blockquote ancestor the absolute column stands (doc-05: a tab
  // at col 6 inside nested items, no blockquote, widens to 2).
  function tabColCode(col) {
    let bq = 0, firstBq = -1;
    for (let k = 1; k < stack.length; k++) {
      if (stack[k].t === 'blockquote') { bq++; if (firstBq < 0) firstBq = k; }
    }
    if (bq === 0) return col;
    let sub = 0;
    for (let k = firstBq - 1; k >= 1; k--) {
      if (stack[k].t === 'item') {
        const it = stack[k];
        sub = (it.baseCol || 0) + (it.contentIndent || 0);
        break;
      }
    }
    col -= sub;
    if (bq > 1) col -= 2 * (bq - 1);
    return Math.max(0, col);
  }
  function addChild(parent, nd) { parent.children.push(nd); return nd; }
  function currentItem() {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].t === 'item') return stack[i];
    return null;
  }
  function currentList() {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].t === 'list') return stack[i];
    return null;
  }
  // Does this paragraph's lines form a GFM table (header + delimiter
  // row with matching cell counts)? Used both when finalizing a
  // paragraph and when a whitespace-only line arrives mid-paragraph.
  function paraIsTable(ls) {
    if (ls.length < 2) return false;
    let di = 0, dc = 0;
    while (di < ls[1].length && (ls[1][di] === ' ' || ls[1][di] === '\t')) {
      dc += ls[1][di] === '\t' ? 4 - (dc % 4) : 1; di++;
    }
    const aligns = dc <= 3 ? parseDelimRow(ls[1]) : null;
    if (!aligns) return false;
    const header = splitTableRow(ls[0]);
    return header.length === aligns.length;
  }
  // finalize a leaf block (paragraph: strip ref defs, check table/setext already done)
  function finalizeLeaf(nd) {
    if (!nd) return;
    if (nd.t === 'paragraph') {
      const text = nd.lines.join('\n');
      const rest = stripRefDefs(text, refs);
      if (rest.trim() === '') {
        // only ref defs: drop the paragraph
        const parent = nd.parent;
        const idx = parent.children.indexOf(nd);
        if (idx >= 0) parent.children.splice(idx, 1);
        return;
      }
      nd.text = rest;
      // GFM task list: first paragraph of a list item starting with
      // [ ] / [x] / [X] followed by a space (or end of text)
      if (nd.parent && nd.parent.t === 'item' && nd.parent.children[0] === nd) {
        const tm = /^\[([ xX])\]( |$)/.exec(rest);
        if (tm) {
          nd.task = (tm[1] === 'x' || tm[1] === 'X') ? 'checked' : 'unchecked';
          nd.text = rest.slice(tm[0].length);
        }
      }
      // GFM table check (delimiter row must have at most 3 spaces of indent)
      const ls = nd.text.split('\n');
      if (ls.length >= 2) {
        let di = 0, dc = 0;
        while (di < ls[1].length && (ls[1][di] === ' ' || ls[1][di] === '\t')) {
          dc += ls[1][di] === '\t' ? 4 - (dc % 4) : 1; di++;
        }
        const aligns = dc <= 3 ? parseDelimRow(ls[1]) : null;
        if (aligns) {
          const header = splitTableRow(ls[0]);
          if (header.length === aligns.length) {
            const rows = [];
            for (let r = 2; r < ls.length; r++) {
              // A truly empty line ends the table, as does a spaces-only
              // line (doc-03); a tab-containing line is an empty row
              // (doc-02).
              if (ls[r] === '' || (ls[r].trim() === '' && !ls[r].includes('\t'))) break;
              const cells = splitTableRow(ls[r]);
              while (cells.length < aligns.length) cells.push('');
              rows.push(cells.slice(0, aligns.length));
            }
            const tbl = { t: 'table', aligns, header, rows, parent: nd.parent };
            const parent = nd.parent;
            parent.children[parent.children.indexOf(nd)] = tbl;
            return;
          }
        }
      }
      return;
    }
    if (nd.t === 'code') {
      // strip trailing blank lines from indented code; fenced keeps content
      if (!nd.fenced) {
        while (nd.literal.length && nd.literal[nd.literal.length - 1] === '') nd.literal.pop();
      }
      nd.text = nd.literal.join('\n');
      // the content ends with a newline; a trailing blank line already
      // supplies it via the join, so only append when it is missing
      if (nd.text && !nd.text.endsWith('\n')) nd.text += '\n';
      return;
    }
    if (nd.t === 'html') {
      // HTML blocks: lines joined by \n. Types 1-4 and 6 (comment, PI,
      // declaration, CDATA, pre/script/style) end with a newline; types 5
      // and 7 do not (unless the last block in the document, handled in parse).
      nd.text = nd.literal.join('\n');
      if ((nd.htype >= 1 && nd.htype <= 4) || nd.htype === 6) {
        if (nd.text) nd.text += '\n';
      }
      return;
    }
  }
  function closeLeaf() {
    if (leaf) { lastClosed = leaf; finalizeLeaf(leaf); leaf = null; }
  }
  // close containers down to depth (stack length), finalizing leaves
  function closeTo(depth) {
    if (leaf && stack.length > depth) closeLeaf();
    while (stack.length > depth) stack.pop();
  }
  // A new block starting inside an item after a blank line makes the list loose.
  function checkLoose() {
    const it = currentItem();
    if (!it) return;
    const li = currentList();
    if (it.blank) {
      if (li) li.tight = false;
      it.blank = false;
    } else if (lastBlank && lastBlankTop !== 'blockquote' && it.children.length > 0 &&
        lastBlankItem && blankBelongsTo(lastBlankItem, it)) {
      // cm-325: a blank line after a nested list, followed by a block in the
      // outer item, loosens the outer list too (the blank was not inside a
      // blockquote, and the item already has content). The blank must belong
      // to this item's own subtree: a blank left over from a closed sibling
      // subtree (doc-01) must not loosen an unrelated later list.
      if (li) li.tight = false;
    }
    // A blank only ever decides the very next block opening: once a block
    // has opened after it, the blank is spent and must not linger to loosen
    // some unrelated list far later (doc-01, doc-22). The blank-between-
    // items case is carried by the items' own blank flags, not this one.
    lastBlank = false;
    lastBlankItem = null;
  }
  // True when the blank's owner item is `it` itself or sits inside it
  // (walk the owner up through its parents until `it` is reached).
  function blankBelongsTo(owner, it) {
    let n = owner;
    while (n) {
      if (n === it) return true;
      n = n.parent;
    }
    return false;
  }
  function openLeaf(nd) {
    checkLoose();
    nd.parent = deepest();
    addChild(deepest(), nd);
    leaf = nd;
    return nd;
  }
  function openContainer(nd) {
    if (nd.t !== 'item') checkLoose();
    // Reset the stale-blank flag only when a new LIST opens: a blank
    // before it has already loosened the parent list (via checkLoose),
    // and must not loosen this list itself (doc-02). A blank between
    // ITEMS must survive until the new item's nested content opens
    // (cm-326), so items do not reset it.
    if (nd.t === 'list') noteContentStart();
    nd.parent = deepest();
    addChild(deepest(), nd);
    stack.push(nd);
    return nd;
  }
  // Mark list looseness helpers
  let lastBlankTop = '';
  let lastBlankItem = null;
  function markBlank() {
    // A blank line inside a blockquote does not loosen the outer list
    // (cm-320), so the item is not marked then. Otherwise mark the
    // deepest item containing the blank line (including an empty item,
    // cm-315). Ancestor items are handled by checkLoose via lastBlank,
    // which remembers which item owned the blank so a stale blank from
    // a closed sibling subtree cannot loosen a later list (doc-01).
    const top = stack[stack.length - 1];
    lastBlankTop = top ? top.t : '';
    if (top && top.t === 'blockquote') { lastBlank = true; lastBlankItem = currentItem(); return; }
    const it = currentItem();
    if (it) it.blank = true;
    lastBlank = true;
    lastBlankItem = it;
  }
  function noteContentStart() {
    const it = currentItem();
    const li = currentList();
    if (it && li) {
      if (it.blank && it.children.length > 0) { li.tight = false; it.blank = false; }
    }
    lastBlank = false;
  }

  // ---- container matching ----
  // Returns {depth, line} : depth = number of stack entries matched (stack[0]=doc always),
  // line = cursor positioned after matched prefixes.
  function matchContainers(raw) {
    const line = new Line(raw);
    let depth = 1; // doc matches
    let newSameListItem = false; // line starts a new item of an open list
    for (let d = 1; d < stack.length; d++) {
      const nd = stack[d];
      if (nd.t === 'list') {
        // A list also matches if this line starts a new item of the same type
        // (bullet char / ordered delimiter) — the new item continues the list.
        // A thematic break does NOT continue a list.
        const tmp = new Line(line.rest);
        const ind = tmp.spacesAhead();
        if (ind <= 3) {
          tmp.advSpaces(ind);
          if (!thematicBreak(tmp)) {
            const ls = listStart(tmp);
            if (ls) {
              const sameType = ls.ordered === nd.ordered &&
                (ls.ordered ? ls.punct === nd.punct : ls.marker === nd.markerCh);
              if (sameType) { depth = d + 1; newSameListItem = true; continue; }
            }
          }
        }
        continue; // otherwise, list matches iff its item matches (checked next)
      }
      if (nd.t === 'blockquote') {
        // skip up to 3 spaces, then '>'
        let saveI = line.i, saveCol = line.col, saveS = line.s;
        let sp = 0;
        while (sp < 3 && line.ch() === ' ') { line.adv(); sp++; }
        if (line.ch() === '>') {
          line.adv();
          // one optional whitespace column after '>' (a tab counts as 1 column)
          if (line.ch() === ' ' || line.ch() === '\t') line.advSpaces(1);
          depth = d + 1; continue;
        }
        line.i = saveI; line.col = saveCol; line.s = saveS;
        break;
      }
      if (nd.t === 'item') {
        if (line.blank()) { depth = d + 1; continue; }
        const saveI = line.i, saveCol = line.col, saveS = line.s;
        // contentIndent is relative (columns from the marker to the content),
        // so it applies regardless of how wide the outer prefixes are
        const need = nd.contentIndent;
        const got = line.advSpaces(need);
        if (got >= need) { depth = d + 1; continue; }
        line.i = saveI; line.col = saveCol; line.s = saveS;
        break;
      }
      break;
    }
    return { depth, line, newSameListItem };
  }

  // ---- block starters (operate on cursor after container matching) ----
  function atxHeading(line) {
    const s = line.rest;
    const m = /^(#{1,6})(?:[ \t]+|$)/.exec(s);
    if (!m) return null;
    let rest = s.slice(m[0].length);
    // strip closing sequence: trailing #'s preceded by a space, or the whole
    // content being #'s (preceded by the space after the opening run)
    if (/^#+[ \t]*$/.test(rest)) rest = '';
    else rest = rest.replace(/[ \t]+#+[ \t]*$/, '').replace(/[ \t]+$/, '');
    return { level: m[1].length, text: rest };
  }
  function fenceStart(line) {
    const s = line.rest;
    const m = /^(`{3,}|~{3,})/.exec(s);
    if (!m) return null;
    const fence = m[1], ch = fence[0];
    let info = s.slice(fence.length);
    if (ch === '`' && info.includes('`')) return null;
    info = info.trim();
    // info: first word, with backslash escapes resolved
    let word = info.split(/[ \t]+/)[0] || '';
    word = word.replace(/\\([!-/:-@\[-`{-~])/g, '$1');
    return { fence, ch, info: word };
  }
  function htmlStart(line) {
    const s = line.rest;
    let m;
    if (s.startsWith('<!--')) return 1;
    if (s.startsWith('<?')) return 2;
    if (/^<![A-Za-z]/.test(s)) return 3;
    if (s.startsWith('<![CDATA[')) return 4;
    // Block tags (types 5/6) may span lines, so only the tag name +
    // following char is checked here (cm-153/172/173). Non-block tags
    // (type 7) must be a FULLY valid tag, alone on the line
    // (cm-619/622/624: invalid attributes must not start an HTML block).
    m = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)(\s|\/?>|$)/.exec(s);
    if (m) {
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      // type 6 starts only with an OPENING <pre|<script|<style|<textarea;
      // a closing </pre> etc. does not start an HTML block (cm-148)
      if (!closing && (tag === 'pre' || tag === 'script' || tag === 'style' || tag === 'textarea')) return 6;
      if (BLOCK_TAGS.has(tag)) return 5;
      const tagStr = parseInlineHtml(s, 0);
      if (tagStr) {
        return /^[ \t]*$/.test(s.slice(tagStr.length)) ? 7 : 0;
      }
      return 0;
    }
    return 0;
  }
  function thematicBreak(line) {
    const s = line.rest;
    return /^([ \t]*)([-_*])(?:[ \t]*\2){2,}[ \t]*$/.test(s);
  }
  function setextUnderline(line) {
    const tmp = new Line(line.rest);
    const ind = tmp.spacesAhead();
    if (ind > 3) return 0;
    tmp.advSpaces(ind);
    const s = tmp.rest;
    const m = /^(=+|-+)[ \t]*$/.exec(s);
    if (!m) return 0;
    return m[1][0] === '=' ? 1 : 2;
  }
  function listStart(line) {
    const s = line.rest;
    let m = /^([*+-])([ \t]+|$)/.exec(s);
    if (m) return { ordered: false, marker: m[1], width: 1, after: m[2] };
    m = /^(\d{1,9})([.)])([ \t]+|$)/.exec(s);
    if (m) return { ordered: true, marker: m[1], punct: m[2], start: parseInt(m[1], 10), width: m[1].length + 1, after: m[3] };
    return null;
  }

  // ---- main loop ----
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const { depth, line, newSameListItem } = matchContainers(raw);
    const matchedAll = depth === stack.length;
    const isBlank = line.blank();

    // lazy continuation: paragraph open, containers unmatched, line not blank,
    // and the line does NOT start a block that interrupts a paragraph.
    // A new item of the same open list always closes the current item,
    // even when the new item is empty (cm-283).
    let inItem = false;
    if (leaf && leaf.t === 'paragraph') {
      let p = leaf.parent;
      while (p) { if (p.t === 'item') { inItem = true; break; } p = p.parent; }
    }
    if (!matchedAll && !isBlank && leaf && leaf.t === 'paragraph' && !newSameListItem && !startsInterrupt(line, inItem)) {
      // lazy continuation: leading whitespace is PRESERVED, except
      // (a) 4+ columns of indent (indented-code level) are stripped,
      // and (b) up to 3 spaces before a list marker are stripped so
      // the line does not look like a list item. A lazy line that
      // looks like a Setext underline is indented so it stays text.
      // The indent width is measured from the line's effective
      // column (a tab widens to the next tab stop from there), and
      // a kept leading tab is expanded to spaces at that column —
      // a tab after unmatched container prefixes is not at column 0.
      let rest = line.rest;
      const leadMatch = /^[ \t]*/.exec(rest);
      const lead = leadMatch ? leadMatch[0] : '';
      let col = tabCol(line.col);
      let expandedLead = '';
      for (let k = 0; k < lead.length; k++) {
        if (lead[k] === '\t') { const w = 4 - (col % 4); expandedLead += ' '.repeat(w); col += w; }
        else { expandedLead += ' '; col++; }
      }
      const leadCols = col - tabCol(line.col);
      const afterLead = rest.slice(lead.length);
      const isListMarker = /^(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/.test(afterLead);
      if (leadCols >= 4 || isListMarker) rest = afterLead;
      else rest = expandedLead + afterLead;
      if (/^(=+|-+)[ \t]*$/.test(rest.replace(/^[ \t]+/, ''))) leaf.lines.push('    ' + rest.replace(/^[ \t]+/, '').trim());
      else leaf.lines.push(rest);
      lastBlank = false;
      continue;
    }
    // A fenced code block captures NON-BLANK lines even when they don't
    // match an enclosing LIST container (doc-02: "function f(a, b) {"
    // at col 0 inside a list item stays code content) — but only once
    // the block already has content. A FIRST content line that does
    // not match the containers closes the block instead (doc-13: the
    // ````sh block stays empty when print(...) at col 0 follows the
    // fence; the line becomes a paragraph). Such a line cannot be a
    // closing fence (a fence must sit inside the containers). But a
    // line that fails a BLOCKQUOTE container closes it (cm-237: "foo"
    // without > ends the quote and its code block). A blank line
    // still closes the containers (cm-128).
    if (leaf && leaf.t === 'code' && leaf.fenced && !matchedAll && !isBlank && leaf.literal.length > 0) {
      let unmatchedIsQuote = false;
      for (let d = depth; d < stack.length; d++) {
        if (stack[d].t === 'blockquote') { unmatchedIsQuote = true; break; }
      }
      if (!unmatchedIsQuote) {
        const tmp = new Line(line.rest); tmp.col = line.col;
        tmp.advFenceIndent(leaf.fenceIndent || 0);
        // A tab whose adjusted column equals the fence indent sits
        // exactly at the fence's indent level: after the strip it is
        // at content column 0, so it stays a literal tab (doc-13/38).
        // Otherwise it widens from its own column (doc-02: col 4 -> 4).
        const tc0 = tabColCode(tmp.col);
        leaf.literal.push(expandLeadingTab(tmp.rest, tc0 - (leaf.fenceIndent || 0) === 0 ? 0 : tc0));
        lastBlank = false;
        continue;
      }
    }
    // close unmatched containers
    if (!matchedAll) closeTo(depth);

    if (isBlank) {
      // A truly EMPTY line immediately after an HTML block strips its
      // trailing newline — but a whitespace-only line (tab or spaces,
      // doc-15) does NOT strip it; the newline is kept.
      if (raw === '' && !leaf && lastClosed && lastClosed.t === 'html' && lastClosed.text && lastClosed.text.endsWith('\n')) {
        lastClosed.text = lastClosed.text.slice(0, -1);
      }
      // An empty list item is closed by a blank line (cm-280): a following
      // indented line is then a new top-level block, not item content.
      // Mark it blank first so a following item still loosens the list
      // (cm-315: an empty item separated by a blank line makes it loose).
      const top = stack[stack.length - 1];
      if (top && top.t === 'item' && top.children.length === 0) {
        top.blank = true;
        closeTo(stack.length - 1);
      }
      // A whitespace-only line inside a container (e.g. ">  ") is paragraph
      // content, not a blank line, when a paragraph is open — but only if
      // the raw line actually carried a container marker (cm-241: ">  ").
      // A line that is whitespace-only in the raw source (a bare tab or
      // spaces, doc-02) IS a blank line that ends the paragraph/list.
      if (leaf && leaf.t === 'paragraph' && stack.length > 1 && line.rest.length > 0 && /[^ \t]/.test(raw)) {
        leaf.lines.push(line.rest);
        lastBlank = false;
        continue;
      }
      // blank line handling
      if (leaf && leaf.t === 'code' && leaf.fenced) {
        // fenced code: keep the line's content (after container prefixes),
        // minus the fence indent, with a leading tab expanded from its
        // own column (doc-01: a tab at col 13 becomes 3 spaces). A tab
        // exactly at the fence indent level stays literal (doc-13/38).
        const tmp = new Line(line.rest); tmp.col = line.col;
        tmp.advFenceIndent(leaf.fenceIndent || 0);
        const tc1 = tabColCode(tmp.col);
        leaf.literal.push(expandLeadingTab(tmp.rest, tc1 - (leaf.fenceIndent || 0) === 0 ? 0 : tc1)); lastBlank = true; continue;
      }
      if (leaf && leaf.t === 'code' && !leaf.fenced) {
        // indented code: strip up to 4 spaces of indent, keep the rest
        // RAW. A tab left after the strip is content, not indentation,
        // so it stays a literal tab (doc-13: "        \tindented"
        // renders "    \tindented", not 8 spaces; doc-06 likewise).
        const tmp = new Line(line.rest); tmp.col = line.col;
        tmp.advSpaces(4);
        leaf.literal.push(tmp.rest); lastBlank = true; continue;
      }
      if (leaf && leaf.t === 'html' && (leaf.htype === 5 || leaf.htype === 7)) { closeLeaf(); markBlank(); continue; }
      if (leaf && leaf.t === 'html') { leaf.literal.push(''); lastBlank = true; continue; }
      if (leaf && leaf.t === 'paragraph') {
        // A tab-only line inside a table paragraph is an empty row, not
        // the end of the table (doc-02: the "\t" line between two table
        // rows). A spaces-only line DOES end the table (doc-03: a "   "
        // line after the last row), as does a truly empty line.
        if (line.rest.includes('\t') && paraIsTable(leaf.lines)) {
          leaf.lines.push(line.rest);
          lastBlank = false;
          continue;
        }
        closeLeaf(); markBlank(); continue;
      }
      markBlank();
      continue;
    }

    // non-blank line: process (loop for containers opened mid-line)
    let cur = line;
    let guard = 0;
    while (guard++ < 20) {
      // continue an open leaf
      if (leaf) {
        if (leaf.t === 'code' && leaf.fenced) {
          // closing fence?
          const s = cur.rest;
          const cm = /^([ \t]{0,3})(`{3,}|~{3,})[ \t]*$/.exec(s);
          if (cm && cm[2][0] === leaf.fenceCh && cm[2].length >= leaf.fenceLen) { closeLeaf(); break; }
          // content lines lose up to the fence's indent; a leading
          // tab then widens from its own column, not the stripped one
          // — unless it sits exactly at the fence indent level, in
          // which case it stays a literal tab (doc-13/38).
          const tmp = new Line(cur.rest); tmp.col = cur.col;
          tmp.advFenceIndent(leaf.fenceIndent || 0);
          const tc2 = tabColCode(tmp.col);
          leaf.literal.push(expandLeadingTab(tmp.rest, tc2 - (leaf.fenceIndent || 0) === 0 ? 0 : tc2));
          break;
        }
        if (leaf.t === 'code' && !leaf.fenced) {
          const ind = cur.spacesAhead();
          if (ind >= 4) { cur.advSpaces(4); leaf.literal.push(cur.rest); break; }
          // not indented: close code, reprocess line
          closeLeaf();
          continue;
        }
        if (leaf.t === 'html') {
          const s = cur.rest;
          leaf.literal.push(s);
          const end = HTML_END[leaf.htype];
          if (end && s.includes(end)) { closeLeaf(); break; }
          if (leaf.htype === 6 && /<\/(pre|script|style|textarea)\s*>/i.test(s)) { closeLeaf(); break; }
          break;
        }
        if (leaf.t === 'paragraph') {
          const lvl = setextUnderline(cur);
          // A table's rows swallow Setext-looking lines: if the paragraph
          // is a table (doc-26), a =/− line is a table row, not a heading
          // underline. Fall through to the continuation below.
          if (lvl && paraIsTable(leaf.lines)) {
            leaf.lines.push(cur.rest);
            break; // line consumed as a table row
          }
          if (lvl) {
            // convert paragraph to setext heading (if it has non-refdef content)
            const text = leaf.lines.join('\n');
            const rest = stripRefDefs(text, refs);
            if (rest.trim() !== '') {
              const h = { t: 'heading', level: lvl, text: rest.trim(), parent: leaf.parent };
              const parent = leaf.parent;
              parent.children[parent.children.indexOf(leaf)] = h;
              leaf = null;
              break;
            }
            // only ref defs: drop paragraph, reprocess line as new block
            closeLeaf();
            continue;
          }
          // blocks that interrupt a paragraph (inItem: inside a list
          // item any non-empty list marker interrupts, doc-02: a
          // nested "49." list interrupts the item's paragraph)
          if (startsInterrupt(cur, inItem)) {
            closeLeaf();
            continue;
          }
          // A leading tab on a paragraph continuation line expands to
          // spaces by column (doc-17: a tab at col 4 in a blockquote
          // becomes 2 spaces via tabCol); a tab at col 0 stays raw.
          leaf.lines.push(expandLeadingTab(cur.rest, tabCol(cur.col)));
          break;
        }
        break; // other leaf types are closed immediately (heading/hr/table)
      }
      // no open leaf: try to start a block
      const started = startBlock(cur);
      if (!started) break;
      if (started === 'container') continue; // a container was opened; reprocess remainder
      break; // a leaf was opened (its content is the line); done with this line
    }
  }
  // EOF: close everything
  closeTo(1);
  closeLeaf();
  return root;

  // Does this line start a block that interrupts a paragraph?
  // Uses a temp cursor: up to 3 spaces of indent are allowed, more is indented code.
  function startsInterrupt(line, inItem) {
    const tmp = new Line(line.rest);
    const ind = tmp.spacesAhead();
    if (ind > 3) return false;
    tmp.advSpaces(ind);
    if (atxHeading(tmp)) return true;
    if (fenceStart(tmp)) return true;
    const h = htmlStart(tmp);
    if (h >= 1 && h <= 6) return true;
    if (thematicBreak(tmp)) return true;
    if (tmp.ch() === '>') return true;
    const ls = listStart(tmp);
    if (ls) {
      // an empty list item cannot interrupt a paragraph (cm-285)
      if (tmp.rest.slice(ls.width).trim() === '') return false;
      // inside a list item, any non-empty list marker interrupts (it closes
      // the current item: cm-283 same-list, cm-302 different delimiter);
      // at top level only bullets / ordered-start-1 do
      if (inItem) return true;
      if (!ls.ordered) return true;
      if (ls.start === 1) return true;
    }
    return false;
  }

  // Try to start a block at the cursor. Returns 'container' (opened a container,
  // caller should reprocess the remainder), 'leaf' (opened a leaf; line consumed),
  // or null (should not happen: falls back to paragraph).
  function startBlock(line) {
    // a blank remainder (e.g. after opening a blockquote) starts no block
    if (line.blank()) return null;
    const ind = line.spacesAhead();
    // blockquote
    if (ind <= 3 && line.peekAt(ind) === '>') {
      line.advSpaces(ind);
      line.adv(); // '>'
      if (line.ch() === ' ' || line.ch() === '\t') line.advSpaces(1);
      openContainer(bnode('blockquote'));
      return 'container';
    }
    // ATX heading
    if (ind <= 3) {
      const saveI = line.i, saveCol = line.col;
      line.advSpaces(ind);
      const atx = atxHeading(line);
      if (atx) {
        const h = { t: 'heading', level: atx.level, text: atx.text };
        openLeaf(h); leaf = null; // headings close immediately
        return 'leaf';
      }
      line.i = saveI; line.col = saveCol;
    }
    // fenced code block (``` or ~~~)
    if (ind <= 3) {
      const savedI = line.i, savedCol = line.col;
      line.advSpaces(ind);
      const fence = fenceStart(line);
      if (fence) {
        // Tilde fences never shed leading indent from their content
        // lines in marked (a marked quirk: backtick fences strip up
        // to the fence's own indent, tilde fences strip nothing), so
        // a tilde fence records a zero strip width.
        const strip = fence.ch === '~' ? 0 : ind;
        const code = {
          t: 'code', fenced: true,
          fenceCh: fence.ch, fenceLen: fence.fence.length,
          info: fence.info, literal: [], fenceIndent: strip,
        };
        openLeaf(code);
        return 'leaf';
      }
      line.i = savedI; line.col = savedCol;
    }
    // HTML block
    if (ind <= 3) {
      const saveI = line.i, saveCol = line.col;
      const rawRest = line.rest; // first line keeps its leading spaces
      line.advSpaces(ind);
      const h = htmlStart(line);
      if (h) {
        const html = { t: 'html', htype: h, literal: [rawRest] };
        openLeaf(html);
        const end = HTML_END[h];
        if (end && line.rest.includes(end)) { closeLeaf(); }
        if (h === 6 && /<\/(pre|script|style|textarea)\s*>/i.test(line.rest)) { closeLeaf(); }
        return 'leaf';
      }
      line.i = saveI; line.col = saveCol;
    }
    // thematic break
    if (ind <= 3) {
      const saveI = line.i, saveCol = line.col;
      line.advSpaces(ind);
      if (thematicBreak(line)) {
        openLeaf({ t: 'hr' }); leaf = null;
        return 'leaf';
      }
      line.i = saveI; line.col = saveCol;
    }
    // list
    if (ind <= 3) {
      const saveI = line.i, saveCol = line.col, saveS = line.s;
      const baseCol = line.col; // column where this container's content starts
      line.advSpaces(ind);
      const ls = listStart(line);
      if (ls) {
        // a list cannot interrupt a paragraph unless handled by caller;
        // here leaf is null so it is fine.
        return startList(line, ls, ind, baseCol);
      }
      line.i = saveI; line.col = saveCol; line.s = saveS;
    }
    // indented code
    if (ind >= 4) {
      line.advSpaces(4);
      const code = { t: 'code', fenced: false, info: '', literal: [line.rest] };
      openLeaf(code);
      return 'leaf';
    }
    // paragraph
    const p = { t: 'paragraph', lines: [line.rest] };
    openLeaf(p);
    return 'leaf';
  }

  function startList(line, ls, indent, baseCol) {
    const markerCol = line.col; // column where the marker starts (after indent)
    // contentIndent is relative to baseCol (where the enclosing container's
    // content starts), so it applies on later lines whose outer prefixes
    // differ in width (e.g. >> vs '   > > ')
    // consume marker characters (digits + punct, or the bullet char)
    if (ls.ordered) {
      for (let k = 0; k < ls.marker.length + 1; k++) line.adv();
    } else {
      line.adv(); // marker char
    }
    // spaces after marker
    const afterStart = line.col;
    let sp = 0;
    // count spaces/tabs (up to 5)
    let tmpCol = line.col, tmpI = line.i, spaces = 0;
    while (tmpI < line.s.length && (line.s[tmpI] === ' ' || line.s[tmpI] === '\t')) {
      const w = line.s[tmpI] === '\t' ? 4 - (tmpCol % 4) : 1;
      spaces += w; tmpCol += w; tmpI++;
      if (spaces >= 5) break;
    }
    let contentIndent;
    const isEmpty = line.blank();
    if (isEmpty) {
      contentIndent = markerCol + ls.width + 1 - baseCol;
    } else if (spaces >= 5) {
      contentIndent = afterStart + 1 - baseCol;
      line.advSpaces(1);
    } else if (spaces === 0) {
      // no space after marker: not a list (should not happen; listStart required space/EOL)
      return null;
    } else {
      contentIndent = afterStart + spaces - baseCol;
      line.advSpaces(spaces);
    }
    // find or create the list container
    let list = null;
    const parent = deepest();
    if (parent.t === 'list' && parent.ordered === ls.ordered &&
        (!ls.ordered || parent.start === ls.start || true)) {
      // same list continues if marker type matches (bullet char may differ? spec: same type)
      // For bullets, the marker char must match to continue the same list.
      if (!ls.ordered && parent.markerCh && parent.markerCh !== ls.marker) list = null;
      else if (ls.ordered && parent.punct && parent.punct !== ls.punct) list = null;
      else list = parent;
    }
    if (!list) {
      list = bnode('list');
      list.ordered = ls.ordered;
      list.start = ls.ordered ? ls.start : 0;
      list.tight = true;
      list.markerCh = ls.ordered ? null : ls.marker;
      list.punct = ls.ordered ? ls.punct : null;
      openContainer(list);
    }
    // looseness: blank line before this item? The previous item itself
    // may carry the blank, or the blank may sit in its deepest nested
    // item (cm-326: a blank after the nested list, before the next outer
    // item, loosens the outer list even though the outer item itself was
    // never marked). Only a still-pending blank counts: a blank already
    // spent by an intervening block was cleared by checkLoose. A blank
    // inside a blockquote never loosens the list (cm-320).
    const prevItem = list.children.length ? list.children[list.children.length - 1] : null;
    if (prevItem && prevItem.blank) { list.tight = false; }
    else if (prevItem && lastBlank && lastBlankTop !== 'blockquote' && lastBlankItem && blankBelongsTo(lastBlankItem, prevItem)) { list.tight = false; }
    const item = bnode('item');
    item.contentIndent = contentIndent;
    item.baseCol = baseCol;
    item.blank = false;
    item.markerCol = markerCol;
    openContainer(item);
    // the item's content is the rest of the line (may be empty)
    if (!isEmpty) {
      // reprocess the remainder as block content inside the item
      return 'container';
    }
    return 'leaf'; // empty item: line consumed
  }
}

// ================= BLOCK RENDERER =================
function renderInlineText(text, refs) {
  return parseInline(text, refs);
}
function renderChildren(children, tight, refs) {
  let out = '';
  for (const c of children) out += renderBlock(c, tight, refs);
  return out;
}
// Render one block. A paragraph inside a tight list renders as bare inline content.
function renderBlock(nd, tight, refs) {
  switch (nd.t) {
    case 'doc': return renderChildren(nd.children, false, refs);
    case 'paragraph': {
      let inner = renderInlineText(nd.text, refs);
      if (nd.task) {
        inner = (nd.task === 'checked'
          ? '<input checked="" disabled="" type="checkbox"> '
          : '<input disabled="" type="checkbox"> ') + inner;
      }
      if (tight) return inner;
      return '<p>' + inner + '</p>\n';
    }
    case 'heading':
      return '<h' + nd.level + '>' + renderInlineText(nd.text, refs) + '</h' + nd.level + '>\n';
    case 'code': {
      let out = '<pre><code';
      if (nd.info) out += ' class="language-' + escHtml(nd.info) + '"';
      out += '>' + escHtmlEncode(nd.text) + '</code></pre>\n';
      return out;
    }
    case 'html': return nd.text;
    case 'hr': return '<hr>\n';
    case 'blockquote':
      return '<blockquote>\n' + renderChildren(nd.children, false, refs) + '</blockquote>\n';
    case 'list': {
      const tag = nd.ordered ? 'ol' : 'ul';
      let open = '<' + tag;
      if (nd.ordered && nd.start !== 1) open += ' start="' + nd.start + '"';
      open += '>\n';
      let out = open;
      for (const it of nd.children) out += renderBlock(it, nd.tight, refs);
      out += '</' + tag + '>\n';
      return out;
    }
    case 'item': {
      let content;
      if (tight) {
        // tight: paragraphs render bare; blocks joined with \n
        const parts = [];
        for (const c of nd.children) parts.push(renderBlock(c, true, refs));
        content = parts.join('');
      } else {
        // loose: paragraphs wrapped in <p>
        content = renderChildren(nd.children, false, refs);
      }
      return '<li>' + content + '</li>\n';
    }
    case 'table': {
      let out = '<table>\n<thead>\n<tr>\n';
      for (let i = 0; i < nd.header.length; i++) {
        const a = nd.aligns[i];
        out += '<th' + (a ? ' align="' + a + '"' : '') + '>' + renderInlineText(nd.header[i], refs) + '</th>\n';
      }
      out += '</tr>\n</thead>\n';
      if (nd.rows.length) {
        out += '<tbody>';
        for (const row of nd.rows) {
          out += '<tr>\n';
          for (let i = 0; i < row.length; i++) {
            const a = nd.aligns[i];
            out += '<td' + (a ? ' align="' + a + '"' : '') + '>' + renderInlineText(row[i], refs) + '</td>\n';
          }
          out += '</tr>\n';
        }
        out += '</tbody>';
      }
      out += '</table>\n';
      return out;
    }
  }
  return '';
}

// The last block in document order (deepest last descendant).
function lastBlock(nd) {
  while (nd.children && nd.children.length) {
    nd = nd.children[nd.children.length - 1];
  }
  return nd;
}

export function parse(markdown) {
  docInLink = false;
  // CommonMark line-ending normalization: CRLF and lone CR become LF
  // before parsing (doc-38 is a CRLF document: 496 CRLF endings).
  if (markdown.includes('\r')) markdown = markdown.replace(/\r\n?/g, '\n');
  const refs = new Map();
  const root = parseBlocks(markdown, refs);
  // A type 5/7 HTML block that is the last block in the document keeps a
  // trailing newline when the source ends with one.
  if (markdown.endsWith('\n')) {
    const lb = lastBlock(root);
    if (lb && lb.t === 'html' && lb.text && (lb.htype === 5 || lb.htype === 7)) lb.text += '\n';
  }
  return renderBlock(root, true, refs);
}
