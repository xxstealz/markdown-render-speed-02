// parse.js — a fast CommonMark 0.31.2 + GFM renderer, written from scratch.
// parse(markdown) returns exactly the HTML marked 18.1.3 renders with its
// default options (gfm on, breaks off, pedantic off, async off).
// Dependency-free, stateless per call: nothing is cached between calls.

export function parse(markdown) {
  // Reset the document-level unclosed-<a> depth: marked suppresses
  // extended autolinks (www/scheme/email) once an <a ...> opening tag
  // has been seen without a matching </a> (its inLink state is global
  // across blocks, not per paragraph). A depth (not a boolean): a
  // </a> closes only one open <a>, so an earlier unclosed <a> still
  // suppresses autolinks after a closed pair (doc-03).
  unclosedA = false;
  const doc = new Parser(markdown);
  return doc.render();
}

// Depth of unclosed <a ...> tags seen so far in this document (set
// in inlineNodes / scanHtmlForA, decremented by </a>). While > 0,
// extended autolinks are not formed.
let unclosedA = false;

// ---------------------------------------------------------------------------
// HTML5 named entities (name -> character). Only the names this renderer
// recognises; anything else after '&' is left literal.
const ENTITIES = {
  Tab: '\t', NewLine: '\n', colon: ':', semi: ';', sol: '/', bsol: '\\',
  comma: ',', period: '.', lpar: '(', rpar: ')', lsqb: '[', rsqb: ']',
  lcub: '{', rcub: '}', plus: '+', equals: '=', quest: '?', commat: '@',
  dollar: '$', percnt: '%', num: '#', ast: '*', Hat: '^', lowbar: '_',
  grave: '`', vert: '|', tilde: '~', amp: '&', lt: '<', gt: '>', quot: '"',
  apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  sbquo: '‚', bdquo: '„', dagger: '†', Dagger: '‡', bull: '•', laquo: '«',
  raquo: '»', deg: '°', plusmn: '±', frac14: '¼', frac12: '½', frac34: '¾',
  times: '×', divide: '÷', minus: '−', lowast: '∗', permil: '‰',
  prime: '′', Prime: '″', euro: '€', pound: '£', yen: '¥', cent: '¢',
  curren: '¤', brvbar: '¦', sect: '§', uml: '¨', ordf: 'ª', ordm: 'º',
  iexcl: '¡', iquest: '¿', szlig: 'ß', agrave: 'à', aacute: 'á', acirc: 'â',
  atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç', egrave: 'è',
  eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î',
  iuml: 'ï', eth: 'ð', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô',
  otilde: 'õ', ouml: 'ö', oslash: 'ø', ugrave: 'ù', uacute: 'ú', ucirc: 'û',
  uuml: 'ü', yacute: 'ý', thorn: 'þ', yuml: 'ÿ', Agrave: 'À', Aacute: 'Á',
  Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', AElig: 'Æ', Ccedil: 'Ç',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Igrave: 'Ì', Iacute: 'Í',
  Icirc: 'Î', Iuml: 'Ï', ETH: 'Ð', Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó',
  Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø', Ugrave: 'Ù', Uacute: 'Ú',
  Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý', THORN: 'Þ', Yuml: 'Ÿ', oelig: 'œ',
  OElig: 'Œ', scaron: 'š', Scaron: 'Š', fnof: 'ƒ', circ: 'ˆ', tilde: '˜',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '‌', zwj: '‍', lrm: '‎',
  rlm: '‏', shy: '­', sup1: '¹', sup2: '²', sup3: '³', micro: 'µ',
  para: '¶', middot: '·', cedil: '¸', acute: '´', macr: '¯', Dcaron: 'Ď',
  dcaron: 'ď', Lcaron: 'Ľ', lcaron: 'ľ', Ncaron: 'Ň', ncaron: 'ň',
  Rcaron: 'Ř', rcaron: 'ř', Tcaron: 'Ť', tcaron: 'ť', Uring: 'Ů',
  uring: 'ů', Ydia: 'Ÿ', ydia: 'ÿ', alpha: 'α', beta: 'β', gamma: 'γ',
  delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι',
  kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω', Alpha: 'Α', Beta: 'Β', Gamma: 'Γ',
  Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ', Eta: 'Η', Theta: 'Θ', Iota: 'Ι',
  Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν', Xi: 'Ξ', Omicron: 'Ο',
  Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ', Upsilon: 'Υ', Phi: 'Φ',
  Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω', thetasym: 'ϑ', upsih: 'ϒ', piv: 'ϖ',
  infin: '∞', ne: '≠', le: '≤', ge: '≥', part: '∂', sum: '∑', prod: '∏',
  radic: '√', prop: '∝', ang: '∠', and: '∧', or: '∨', cap: '∩', cup: '∪',
  int: '∫', there4: '∴', sim: '∼', cong: '≅', asymp: '≈', sub: '⊂',
  sup: '⊃', nsub: '⊄', sube: '⊆', supe: '⊇', oplus: '⊕', otimes: '⊗',
  perp: '⊥', sdot: '⋅', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋',
  lang: '⟨', rang: '⟩', loz: '◊', spades: '♠', clubs: '♣', hearts: '♥',
  diams: '♦', alefsym: 'ℵ', image: 'ℑ', real: 'ℜ', weierp: '℘',
  empty: '∅', nabla: '∇', isin: '∈', notin: '∉', ni: '∋', equiv: '≡',
  larr: '←', uarr: '↑', rarr: '→', darr: '↓', harr: '↔', crarr: '↵',
  lArr: '⇐', uArr: '⇑', rArr: '⇒', dArr: '⇓', hArr: '⇔',
  forall: '∀', exist: '∃', not: '¬', lsaquo: '‹', rsaquo: '›',
  oline: '‾', frasl: '⁄', HilbertSpace: 'ℋ', DifferentialD: 'ⅆ',
  ClockwiseContourIntegral: '∲', ngE: '\u2267\u0338', lE: '≦̸', gE: '\u2267',
  nequiv: '≢', leq: '≤', geq: '≥', ap: '≈', Cap: '⋒', Cup: '⋓',
  subnE: '⊊', supnE: '⊋', nsube: '⊈', nsupe: '⊉',
  NotEqualTilde: '≂̸',fjlig: 'fj',
};

// ASCII punctuation (for backslash escapes and emphasis rules).
// ASCII char-class table (bitmask): 1 letter, 2 digit, 4 email-local
// extra (. _ + -), 8 whitespace, 16 ASCII punctuation. Single table
// lookups replace the per-character comparison chains in the hot
// inline scanner. Out-of-range codes read as undefined -> 0.
const CC = new Uint8Array(128);
for (let k = 65; k <= 90; k++) CC[k] = 1;
for (let k = 97; k <= 122; k++) CC[k] = 1;
for (let k = 48; k <= 57; k++) CC[k] = 2;
CC[46] |= 4; CC[95] |= 4; CC[43] |= 4; CC[45] |= 4; // . _ + -
CC[32] |= 8; CC[9] |= 8; CC[10] |= 8; CC[13] |= 8; CC[12] |= 8; CC[11] |= 8;
for (const p of '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~') CC[p.charCodeAt(0)] |= 16;
const ASCII_PUNCT = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.split(''));
function isAsciiPunct(ch) { return ch !== undefined && (CC[ch.charCodeAt(0)] & 16) !== 0; }
function isSpace(ch) { return ch !== undefined && (CC[ch.charCodeAt(0)] & 8) !== 0; }
function isDigit(ch) { return ch !== undefined && (CC[ch.charCodeAt(0)] & 2) !== 0; }
function isLetter(ch) { return ch !== undefined && (CC[ch.charCodeAt(0)] & 1) !== 0; }
function isAlnum(ch) { return ch !== undefined && (CC[ch.charCodeAt(0)] & 3) !== 0; }

// Escape text content: & < > (and " is NOT escaped in text).
// Fast path: a native regex test rejects the common no-specials case
// without the per-character JS loop.
const ESC_RE = /[&<>"']/;
function escapeText(s) {
  if (!ESC_RE.test(s)) return s;
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38 || c === 60 || c === 62 || c === 34 || c === 39) {
      out += s.slice(start, i) + (c === 38 ? '&amp;' : c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;');
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Escape attribute values: & < > " ' (marked escapes ' as &#39').
function escapeAttr(s) {
  if (!ESC_RE.test(s)) return s;
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38 || c === 60 || c === 62 || c === 34 || c === 39) {
      out += s.slice(start, i) + (c === 38 ? '&amp;' : c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;');
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Decode one entity starting at s[i] === '&'. Returns [decoded, newIndex]
// or null when there is no valid entity here.
function decodeEntityAt(s, i) {
  if (s[i] !== '&') return null;
  const j = s.indexOf(';', i + 1);
  if (j < 0 || j - i > 32) return null;
  const body = s.slice(i + 1, j);
  if (body.length === 0) return null;
  if (body[0] === '#') {
    let num;
    if (body[1] === 'x' || body[1] === 'X') {
      if (!/^[0-9A-Fa-f]+$/.test(body.slice(2))) return null;
      num = parseInt(body.slice(2), 16);
    } else {
      if (!/^[0-9]+$/.test(body.slice(1))) return null;
      num = parseInt(body.slice(1), 10);
    }
    if (num === 0 || num > 0x10FFFF || (num >= 0xD800 && num <= 0xDFFF)) num = 0xFFFD;
    return [String.fromCodePoint(num), j + 1];
  }
  const ch = ENTITIES[body];
  if (ch !== undefined) return [ch, j + 1];
  return null;
}

// Resolve backslash escapes only (no entities; link destinations, titles
// and info strings keep entity references verbatim).
function resolveEscapes(s) {
  if (!s.includes('\\')) return s;
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length && isAsciiPunct(s[i + 1])) {
      out += s.slice(start, i) + s[i + 1];
      i++;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Decode one NUMERIC entity starting at s[i] === '&'. Returns
// [decoded, newIndex] or null. Decimal: 1-7 digits; hex: 1-6 digits.
// Out of range (0, > 0x10FFFF, surrogate) becomes U+FFFD.
function decodeNumericEntityAt(s, i) {
  if (s[i] !== '&' || s[i + 1] !== '#') return null;
  const n = s.length;
  let j = i + 2;
  let hex = false;
  if (s[j] === 'x' || s[j] === 'X') { hex = true; j++; }
  const maxDigits = hex ? 6 : 7;
  let num = 0;
  let digits = 0;
  while (j < n && digits < maxDigits) {
    const c = s[j];
    let d = -1;
    if (hex) {
      if (c >= '0' && c <= '9') d = c.charCodeAt(0) - 48;
      else if (c >= 'a' && c <= 'f') d = c.charCodeAt(0) - 87;
      else if (c >= 'A' && c <= 'F') d = c.charCodeAt(0) - 55;
    } else if (c >= '0' && c <= '9') d = c.charCodeAt(0) - 48;
    if (d < 0) break;
    num = num * (hex ? 16 : 10) + d;
    digits++;
    j++;
  }
  if (digits === 0) return null;
  if (j < n && ((hex && ((s[j] >= '0' && s[j] <= '9') || (s[j] >= 'a' && s[j] <= 'f') || (s[j] >= 'A' && s[j] <= 'F'))) || (!hex && s[j] >= '0' && s[j] <= '9'))) return null;
  if (j >= n || s[j] !== ';') return null;
  if (num === 0 || num > 0x10FFFF || (num >= 0xD800 && num <= 0xDFFF)) num = 0xFFFD;
  return [String.fromCodePoint(num), j + 1];
}

// Escape attribute values but keep entity references (&name;, &#123;,
// &#x1a;) verbatim; only a bare '&' becomes &amp;.
function escapeAttrKeepEntities(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '&') {
      let j = i + 1;
      if (s[j] === '#') {
        j++;
        let hex = false;
        if (s[j] === 'x' || s[j] === 'X') { hex = true; j++; }
        const ds = j;
        const maxD = hex ? 6 : 7;
        while (j < s.length && j - ds < maxD) {
          const ch = s[j];
          const ok = hex ? ((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) : (ch >= '0' && ch <= '9');
          if (!ok) break;
          j++;
        }
        if (j > ds && j < s.length && s[j] === ';') {
          out += s.slice(start, j + 1);
          i = j;
          start = j + 1;
          continue;
        }
      } else {
        while (j < s.length && (isAlnum(s[j]) || s[j] === '_')) j++;
        if (j > i + 1 && j < s.length && s[j] === ';') {
          out += s.slice(start, j + 1);
          i = j;
          start = j + 1;
          continue;
        }
      }
      out += s.slice(start, i) + '&amp;';
      start = i + 1;
    } else if (c === '<' || c === '>' || c === '"' || c === "'") {
      out += s.slice(start, i) + (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Clean a link destination the way marked does: percent-encode spaces and
// a few characters that cannot appear raw in an href, then escape for HTML
// (keeping entity references verbatim).
function cleanUrl(url) {
  // marked leaves '%' alone entirely (both valid %XX escapes and a
  // bare '%' such as in 98%-blue.svg stay as-is); encodeURI would
  // turn '%' into '%25'. Split on '%' and encode the parts.
  const parts = url.split('%');
  let enc = '';
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) enc += '%';
    try { enc += encodeURI(parts[i]); } catch (e) { enc += parts[i]; }
  }
  return escapeAttrKeepEntities(enc);
}

// Resolve backslash escapes in a fenced-code info-string word. A backslash
// before ASCII punctuation (other than backslash) is dropped; a doubled
// backslash and a trailing backslash behave as marked renders them.
function resolveInfoLang(word) {
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    if (c === '\\' && i + 1 < word.length && isAsciiPunct(word[i + 1]) && word[i + 1] !== '\\') {
      out += word[i + 1];
      i++;
    } else if (c === '\\' && i + 1 === word.length) {
      // trailing backslash is dropped
    } else {
      out += c;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lines and tabs. Each input line is expanded so a tab counts as spaces up
// to the next multiple of 4; `src[i]` maps an expanded column back to the
// raw index, `first[i]` is 1 when expanded column i starts a raw character.
function expandLine(raw) {
  // Fast path: no tab means the expanded line is the raw line and the
  // column map is the identity (src/first stay null; sliceContent and
  // quoteParaContent handle that). Skips two typed-array allocations
  // and a per-character loop for the overwhelmingly common case.
  if (raw.indexOf('\t') === -1) return { raw, exp: raw, src: null, first: null };
  const n = raw.length;
  let exp = '';
  const src = new Int32Array(n * 2 + 4);
  const first = new Uint8Array(n * 2 + 4);
  let col = 0;
  let w = 0;
  for (let i = 0; i < n; i++) {
    const ch = raw[i];
    if (ch === '\t') {
      const sp = 4 - (col & 3);
      for (let k = 0; k < sp; k++) {
        exp += ' ';
        src[w] = i;
        first[w] = k === 0 ? 1 : 0;
        w++;
      }
      col += sp;
    } else {
      exp += ch;
      src[w] = i;
      first[w] = 1;
      w++;
      col++;
    }
  }
  return { raw, exp, src: src.subarray(0, w), first: first.subarray(0, w) };
}

// Raw content for expanded columns [a, b). A range that starts mid-tab
// yields spaces for the rest of that tab; whole tabs come back as tabs.
function sliceContent(line, a, b) {
  const { raw, exp, src, first } = line;
  if (b === undefined) b = exp.length;
  if (a >= b) return '';
  if (!src) return raw.slice(a, b); // no tab: expanded columns are raw columns
  let out = '';
  let run = -1;
  let i = a;
  while (i < b) {
    if (first[i] === 0) {
      if (run !== -1) { out += raw.slice(run, src[i]); run = -1; }
      out += ' ';
      i++;
    } else if (raw[src[i]] === '\t') {
      if (run !== -1) { out += raw.slice(run, src[i]); run = -1; }
      out += '\t';
      i++;
      while (i < b && first[i] === 0) i++;
    } else {
      if (run === -1) run = src[i];
      i++;
    }
  }
  if (run !== -1) out += raw.slice(run, src[b - 1] + 1);
  return out;
}

// Leading whitespace of a paragraph line inside a blockquote, expanded
// the way marked does it: after the `>` marker, the following
// whitespace (spaces/tabs) is tab-expanded starting at the column
// where it begins in the text after outer containers are stripped
// (the marker's length), then one char is dropped (the one matchQuote
// consumed). matchQuote already consumed that one char, so the run
// from `offset` is expanded here using stripped columns
// (absolute col - qPre, where qPre is the offset just before the
// innermost quote). A tab at a stripped column c expands to
// 4 - (c % 4) spaces. sliceContent would return a raw tab when the
// run starts at a tab; expand it instead (doc-17: `> \tfoo` -> 2
// spaces, and inside a `*` item `  > \tfoo` -> 2 spaces, while at
// the top level `  > \tfoo` expands to 4 and becomes a code block).
// Lazy continuation lines never reach this (no quote is consumed
// on them), so their tabs stay literal, as marked does.
function quoteParaContent(line, offset, qPre) {
  const { raw, exp, src, first } = line;
  if (!src) {
    // No tab: leading whitespace is plain spaces.
    let out = '';
    let i = offset;
    while (i < exp.length && exp[i] === ' ') { out += ' '; i++; }
    return out + raw.slice(i);
  }
  let col = offset - qPre;
  let out = '';
  let i = offset;
  // If offset lands inside a tab (the tab started before offset, e.g.
  // the blockquote marker consumed its first expanded space), the
  // absolute-column remainder overcounts: re-expand that tab by
  // stripped columns and keep only the unconsumed remainder
  // (doc-30: `>\tindented` in nested lists gives 2 spaces, not 3;
  // with a shallower list indent it gives 1).
  if (i < exp.length && exp[i] === ' ' && first[i] === 0) {
    let ts = i;
    while (ts > 0 && first[ts] === 0) ts--;
    if (ts >= qPre && raw[src[ts]] === '\t') {
      const width = 4 - ((ts - qPre) % 4);
      const remain = width - (i - ts);
      if (remain > 0) {
        out += ' '.repeat(remain);
        col += remain;
      }
      while (i < exp.length && first[i] === 0) i++;
    }
  }
  while (i < exp.length && exp[i] === ' ') {
    if (first[i] === 1 && raw[src[i]] === '\t') {
      const w = 4 - (col % 4);
      out += ' '.repeat(w);
      col += w;
      i++;
      while (i < exp.length && first[i] === 0) i++;
    } else {
      // A real space, or a mid-tab continuation column: 1 space.
      out += ' ';
      col++;
      i++;
    }
  }
  return out + sliceContent(line, i);
}

function isBlankExp(exp, from) {
  for (let i = from; i < exp.length; i++) if (exp[i] !== ' ') return false;
  return true;
}
function indentAt(exp, from) {
  let n = 0;
  while (from + n < exp.length && exp[from + n] === ' ') n++;
  return n;
}

const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul').split(' '));

function newBlock(t) {
  return { t, children: [], parent: null };
}

class Parser {
  constructor(src) {
    this.refs = new Map();
    if (src.indexOf('\r') !== -1) src = src.replace(/\r\n?/g, '\n');
    this.endsWithNl = src.endsWith('\n');
    let rawLines = src.split('\n');
    if (rawLines.length && rawLines[rawLines.length - 1] === '') rawLines.pop();
    this.lines = rawLines.map(expandLine);
    this.doc = newBlock('doc');
    this.stack = [this.doc];
    // Last HTML block closed at its end condition (types 1-5): its trailing
    // newline depends on whether the next line is blank.
    this.pendingHtml = null;
    for (let ln = 0; ln < this.lines.length; ln++) this.processLine(ln);
    while (this.stack.length > 1) this.closeTop();
    // An HTML block that ends the document without a trailing newline in
    // the source renders without one either (gfm-657).
    if (!this.endsWithNl) {
      let b = this.doc;
      while (b.children && b.children.length) b = b.children[b.children.length - 1];
      if (b.t === 'html') b.noTrailingNl = true;
    }
    this.doc.children = this.doc.children;
  }

  top() { return this.stack[this.stack.length - 1]; }
  // Deepest open container (doc/quote/list/item), skipping a leaf on top.
  container() {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const b = this.stack[i];
      if (b.t === 'doc' || b.t === 'quote' || b.t === 'list' || b.t === 'item') return b;
    }
    return this.doc;
  }
  topLeaf() {
    const b = this.top();
    return (b.t === 'para' || b.t === 'code' || b.t === 'html') ? b : null;
  }
  addChild(parent, block) {
    block.parent = parent;
    // A block added to an item after a blank line makes its list loose.
    if (parent.t === 'item' && parent.blankBeforeNext && parent.children.length > 0) {
      const list = parent.parent;
      if (list && list.t === 'list') list.tight = false;
      parent.blankBeforeNext = false;
      parent.blankBeforeNextTrue = false;
    }
    // A block added to an item consumes the blank line for ancestor
    // items too: the blank did not separate their blocks (cm-319).
    if (parent.t === 'item') {
      let anc = parent.parent;
      while (anc) {
        if (anc.t === 'item') { anc.blankBeforeNext = false; anc.blankBeforeNextTrue = false; }
        anc = anc.parent;
      }
    }
    parent.children.push(block);
    return block;
  }
  closeTop() {
    const b = this.stack.pop();
    this.finalize(b);
    return b;
  }
  // Close blocks down to (but not including) `keep` (a container).
  closeTo(keep) {
    while (this.stack.length > 1 && this.top() !== keep) this.closeTop();
  }

  processLine(ln) {
    const line = this.lines[ln];
    const exp = line.exp;
    const m = this.matchContainers(exp);
    // Resolve a pending HTML block (types 1-5): a blank line right
    // after it strips its trailing newline. A blank line is a truly
    // empty line, or a container blank line (e.g. `>` with nothing
    // after the marker, doc-30: the `<!-- note -->` HTML block in a
    // list item inside a blockquote). A line of only spaces/tabs
    // does NOT strip it (doc-15: `-->` + `\t` line keeps the `\n`).
    if (this.pendingHtml) {
      if (m.offset >= exp.length) this.pendingHtml.noTrailingNl = true;
      this.pendingHtml = null;
    }
    if (m.lazy) {
      // A lazy continuation line that looks like a setext underline is
      // indented to 4 columns so it stays paragraph text instead of
      // becoming a heading (cm-093).
      const ind = indentAt(exp, m.offset);
      const rest = exp.slice(m.offset + ind);
      if (ind <= 3 && (/^=+[ \t]*$/.test(rest) || /^-+[ \t]*$/.test(rest))) {
        const leaf = this.topLeaf();
        if (leaf && leaf.t === 'para') {
          leaf.lines.push(' '.repeat(4 - ind) + sliceContent(line, m.offset));
        }
        return;
      }
      // A lazy line inside a container (quote/list) with indent >= 4
      // loses 4 spaces (cm-238).
      const nested = this.stack.length > 2;
      const strip = (nested && ind >= 4) ? 4 : 0;
      this.addParaLine(line, m.offset + strip, m.qPre);
      return;
    }
    let offset = m.offset;
    const leaf = this.topLeaf();
    if (leaf) {
      if (leaf.t === 'para') {
        // A line is blank here only if its content is empty (when a
        // container marker was matched, e.g. ">  " leaves a 1-space
        // content that continues the paragraph, cm-241) or all
        // whitespace (no container matched).
        const blankHere = offset > 0 ? (exp.length === offset) : isBlankExp(exp, offset);
        if (blankHere) {
          // A tab-only line inside a table paragraph is an empty table
          // row, not a paragraph break (doc-02): the table continues
          // and the tab line becomes a row of empty cells. A
          // spaces-only or empty line still ends the table/paragraph.
          if (line.raw.includes('\t') && leaf.lines.length >= 2 && tryTable(leaf.lines)) {
            this.addParaLine(line, offset);
            return;
          }
          this.closeTop();
          // A container line with empty content (e.g. ">") also
          // separates blocks inside an item (cm-259); only a true
          // blank line separates items (cm-320).
          this.markBlank(isBlankExp(exp, 0));
        } else {
          const r = this.tryInterrupters(line, offset);
          if (r === 'consumed') return;
          this.addParaLine(line, offset, m.qPre);
          return;
        }
      } else if (leaf.t === 'code' && leaf.fenced) {
        if (isClosingFence(exp, offset, leaf)) { this.closeTop(); return; }
        // Content lines lose up to the opening fence's indentation.
        // But only for backtick fences: marked's indent compensation
        // regex (/^(\s+)(?:```)/) matches backticks only, so a tilde
        // fence keeps its content's full indentation (doc-29: a
        // `>   ~~~objective-c` fence keeps the 2 spaces on its content
        // lines, while the backtick twin strips them).
        const ind = indentAt(exp, offset);
        const strip = leaf.fenceChar === '~' ? 0 : Math.min(ind, leaf.fenceIndent || 0);
        let start = offset + strip;
        // Fence-indent stripping that lands inside a tab consumes the
        // whole tab: a top-level fence indented 3 strips a leading tab
        // to nothing, not to its 1-space remainder (doc-17; the same
        // holds for indent 1 and 2, and for spaces+tab). Only when the
        // strip ends exactly at a tab's start is the tab preserved
        // (and at the top level a tab is preserved whole). This is
        // fence stripping only: a container (list item) that consumes
        // part of a tab keeps the remainder (doc-02), so a tab that
        // started before `offset` is left alone.
        if (strip > 0 && start < exp.length && line.first && line.first[start] === 0) {
          let ts = start;
          while (ts > 0 && line.first[ts] === 0) ts--;
          if (ts >= offset && line.raw[line.src[ts]] === '\t') {
            while (start < exp.length && line.first[start] === 0) start++;
          }
        }
        // A tab at a container boundary (offset > 0) with no fence
        // stripping expands to spaces: its width depends on its
        // absolute column (doc-01: tab at col 13 -> 3 spaces), and
        // sliceContent would return the raw tab instead. When fence
        // stripping lands on a tab, or at the top level, the tab is
        // preserved (f2 tab2, case 692). Inside a blockquote the
        // expansion is by stripped columns, not absolute (doc-05/09:
        // `> > \tfoo` -> 2 spaces, not the absolute 4), so use the
        // same leading-whitespace expansion as paragraph content.
        // The tab need not sit exactly at `offset`: extra spaces
        // after the quote marker (`>   \tfoo`) leave the tab after a
        // spaces run, and the whole run expands together (doc-26).
        let content;
        let hasTabInLead = false;
        if (m.qPre >= 0 && offset > 0 && start < exp.length) {
          for (let p = start; p < exp.length && exp[p] === ' '; p++) {
            if (line.first && line.first[p] === 1 && line.raw[line.src[p]] === '\t') { hasTabInLead = true; break; }
          }
          // The content may start INSIDE a tab (the blockquote marker
          // consumed its first expanded space); that tab also needs
          // stripped-column expansion (doc-30).
          if (!hasTabInLead && line.first && line.first[start] === 0) hasTabInLead = true;
        }
        if (hasTabInLead) {
          content = quoteParaContent(line, start, m.qPre);
        } else if (strip === 0 && offset > 0 && offset < exp.length && line.first && line.first[offset] === 1 && line.raw[line.src[offset]] === '\t') {
          content = m.qPre >= 0 ? quoteParaContent(line, start, m.qPre) : exp.slice(start);
        } else {
          content = sliceContent(line, start);
        }
        leaf.lines.push(content);
        return;
      } else if (leaf.t === 'code') {
        if (isBlankExp(exp, offset)) {
          const ind = indentAt(exp, offset);
          leaf.lines.push(ind >= 4 ? sliceContent(line, offset + 4) : '');
          return;
        }
        if (indentAt(exp, offset) >= 4) { leaf.lines.push(sliceContent(line, offset + 4)); return; }
        this.closeTop();
      } else if (leaf.t === 'html') {
        if (leaf.htmlType <= 5) {
          leaf.lines.push(sliceContent(line, offset));
          if (htmlEndsHere(exp, offset, leaf)) {
            this.pendingHtml = leaf;
            this.closeTop();
          }
          return;
        }
        if (isBlankExp(exp, offset)) {
          // An HTML block closed by a blank line renders without a
          // trailing newline (cm-148/149/152).
          leaf.noTrailingNl = true;
          this.closeTop();
          this.markBlank(isBlankExp(exp, 0));
        }
        else { leaf.lines.push(sliceContent(line, offset)); return; }
      }
    } else if (isBlankExp(exp, offset)) {
      this.markBlank(isBlankExp(exp, 0));
      return;
    }
    this.openNewBlocks(line, offset, m.qPre);
  }

  // Walk the container stack; returns { offset, lazy, qPre }.
  // Closes containers that do not continue. A list item that does not
  // continue closes only the item (the list stays for openNewBlocks).
  // qPre is the offset just before the innermost blockquote consumed
  // on this line (-1 when no quote was consumed): paragraph content
  // inside a quote tab-expands its leading whitespace from that
  // column (marked's blockquote rule, doc-17).
  matchContainers(exp) {
    let offset = 0;
    let qPre = -1;
    // stack[0] is doc; containers are stack[1..k], possibly a leaf on top.
    let depth = 1; // index of next container to check
    while (depth < this.stack.length) {
      const b = this.stack[depth];
      if (b.t !== 'quote' && b.t !== 'list' && b.t !== 'item') break; // leaf on top
      if (b.t === 'list') { depth++; continue; }
      if (b.t === 'quote') {
        const q = matchQuote(exp, offset);
        if (q === -1) break;
        qPre = offset;
        offset = q;
        depth++;
        continue;
      }
      // item
      if (isBlankExp(exp, offset)) {
        // An empty item (no blocks yet) is closed by a blank line
        // (cm-280); a later indented line is then a new block, not the
        // item's content.
        if (b.children.length === 0) break;
        depth++; continue;
      }
      const ind = indentAt(exp, offset);
      if (ind >= b.contentIndent) { offset += b.contentIndent; depth++; continue; }
      break; // item does not continue
    }
    if (depth < this.stack.length) {
      const failed = this.stack[depth];
      // A leaf on top is not a container failure: it stays open and
      // processLine decides whether it continues.
      if (failed.t !== 'quote' && failed.t !== 'list' && failed.t !== 'item') {
        return { offset, lazy: false, qPre };
      }
      // Lazy continuation: innermost open leaf is a paragraph and the line
      // is not blank, and the failing container is a quote or an item.
      // But not when the line starts a block that can interrupt a
      // paragraph (list item, quote, ATX, fence, HTML 1-6, thematic break):
      // then it closes the containers instead.
      const leaf = this.topLeaf();
      if (leaf && leaf.t === 'para' && (failed.t === 'quote' || failed.t === 'item') && !isBlankExp(exp, offset)) {
        const li = matchListItem(exp, offset);
        const ht = matchHtmlBlock(exp, offset);
        // A line that starts a list item while inside a list item ends
        // the item (a new list, e.g. a different delimiter, cm-302),
        // it is never a lazy continuation.
        const sameList = failed.t === 'item' && li && failed.parent && listMatches(failed.parent, li);
        const itemStart = failed.t === 'item' && !!li;
        const interrupts = matchATX(exp, offset) || matchFence(exp, offset) ||
          (ht >= 1 && ht <= 6) ||
          isThematicBreak(exp, offset) || matchQuote(exp, offset) !== -1 ||
          (li && li.mayInterrupt) || sameList || itemStart;
        if (!interrupts) return { offset, lazy: true, qPre };
      }
      // A fenced code block DIRECTLY inside a LIST ITEM keeps its
      // content lines even when a line is not indented enough for the
      // item — but only once it already has a non-blank content line
      // (doc-02: `function f(a, b) {` at indent 0 inside a list
      // item's fenced code block must stay code, or the closing fence
      // is misread as an opener that swallows the rest of the
      // document). Before the first non-blank content line, a line
      // that fails the item closes the fence empty (doc-17/36/38: the
      // fence opens and the next line is unindented); a blank line
      // does not count as content. And it does NOT apply when the
      // fence sits inside a blockquote (even one inside the item): a
      // line without `>` ends the quote and its code block (cm-128,
      // cm-237; doc-21). processLine still checks for the closing
      // fence on this line.
      const topLeaf = this.topLeaf();
      if (failed.t === 'item' && topLeaf && topLeaf.t === 'code' && topLeaf.fenced &&
          topLeaf.parent === failed && topLeaf.lines.some(l => l.trim() !== '')) {
        return { offset, lazy: false, qPre };
      }
      // Close from the failing container upward (item closes, list stays).
      // An HTML block closed because its container ends renders without a
      // trailing newline (cm-174/175).
      while (this.stack.length > depth) {
        const top = this.stack[this.stack.length - 1];
        if (top.t === 'html') top.noTrailingNl = true;
        this.closeTop();
      }
    }
    return { offset, lazy: false, qPre };
  }

  // A blank line was seen. `isTrue` means the raw line is all
  // whitespace (a real blank line); a container line with empty content
  // (e.g. ">") also separates blocks inside an item (cm-259) but does
  // not separate two items (cm-320), so it sets only blankBeforeNext.
  markBlank(isTrue) {
    for (let i = this.stack.length - 1; i >= 1; i--) {
      const b = this.stack[i];
      // A blank line inside a blockquote does not affect items or
      // lists outside that quote (cm-320: a '>' blank inside a quote
      // nested in an item does not separate the outer list's items).
      // Items/lists above the quote in the stack (i.e. inside it)
      // are still marked, since the loop reaches them first.
      if (b.t === 'quote') break;
      if (b.t === 'item') {
        b.blankBeforeNext = true;
        if (isTrue) b.blankBeforeNextTrue = true;
        continue;
      }
      if (b.t === 'list') {
        const above = this.stack[i + 1];
        if (above && above.t === 'item' && above.parent === b) continue;
        const last = b.children[b.children.length - 1];
        if (last) {
          last.blankBeforeNext = true;
          if (isTrue) last.blankBeforeNextTrue = true;
        }
        return;
      }
    }
  }

  addParaLine(line, offset, qPre = -1) {
    const leaf = this.topLeaf();
    if (leaf && leaf.t === 'para') {
      leaf.lines.push(qPre >= 0 ? quoteParaContent(line, offset, qPre) : sliceContent(line, offset));
    }
  }

  // Try blocks that can interrupt a paragraph. Returns 'consumed' when the
  // line was handled (paragraph converted or a new block opened).
  tryInterrupters(line, offset) {
    const exp = line.exp;
    const para = this.topLeaf();
    // Setext underline? Not when the paragraph is a GFM table: a
    // line of '=' or '-' inside a table is a table row, not an
    // underline (doc-26: '=========' after 'Foo *bar*' is a row).
    const ind = indentAt(exp, offset);
    if (ind <= 3) {
      const rest = exp.slice(offset + ind);
      if ((/^=+[ \t]*$/.test(rest) || /^-+[ \t]*$/.test(rest)) && !(para.lines.length >= 2 && tryTable(para.lines))) {
        // Strip link reference definitions from the paragraph first:
        // a paragraph that is all ref defs is not a heading (cm-216),
        // and a ref def line is not part of the heading text (cm-215).
        let text = para.lines.join('\n');
        text = this.stripRefDefs(text);
        if (text === '') {
          // Whole paragraph was ref defs: no heading; this line starts
          // a new paragraph (fall through to addParaLine).
          para.lines = [];
          return undefined;
        }
        const level = rest[0] === '=' ? 1 : 2;
        const head = newBlock('head');
        head.level = level;
        head.lines = text.split('\n');
        head.lines[0] = head.lines[0].replace(/^[ \t]+/, '');
        head.lines[head.lines.length - 1] = head.lines[head.lines.length - 1].replace(/[ \t]+$/, '');
        const parent = para.parent;
        const idx = parent.children.indexOf(para);
        parent.children[idx] = head;
        head.parent = parent;
        this.stack.pop();
        this.finalize(head);
        return 'consumed';
      }
    }
    // ATX heading
    const atx = matchATX(exp, offset);
    if (atx) { this.closeTop(); this.addHeading(atx); return 'consumed'; }
    // Fenced code
    const fence = matchFence(exp, offset);
    if (fence) { this.closeTop(); this.openFence(line, offset, fence); return 'consumed'; }
    // HTML block types 1-6
    const ht = matchHtmlBlock(exp, offset);
    if (ht && ht <= 6) { this.closeTop(); this.openHtml(line, offset, ht); return 'consumed'; }
    // Thematic break
    if (isThematicBreak(exp, offset)) { this.closeTop(); this.addHr(); return 'consumed'; }
    // List (only if it may interrupt a paragraph). At the top level an
    // ordered list may interrupt only when it starts with 1, but inside
    // a container (list item / blockquote) the line is properly indented
    // there, not a lazy continuation, so any list item interrupts
    // (doc-01: 505791. inside an item starts a nested <ol>).
    const item = matchListItem(exp, offset);
    if (item && (item.mayInterrupt || (para.parent && para.parent.t !== 'doc'))) { this.closeTop(); this.openListItem(line, offset, item); return 'consumed'; }
    // Blockquote
    const q = matchQuote(exp, offset);
    if (q !== -1) {
      this.closeTop();
      const quote = newBlock('quote');
      this.addChild(this.container(), quote);
      this.stack.push(quote);
      this.openNewBlocks(line, q);
      return 'consumed';
    }
    return null;
  }

  addHeading(atx) {
    const head = newBlock('head');
    head.level = atx.level;
    head.lines = [atx.text];
    this.addChild(this.container(), head);
    this.finalize(head);
  }
  addHr() {
    const hr = newBlock('hr');
    this.addChild(this.container(), hr);
    this.finalize(hr);
  }

  openFence(line, offset, fence) {
    const code = newBlock('code');
    code.fenced = true;
    code.fenceChar = fence.ch;
    code.fenceLen = fence.len;
    code.info = fence.info;
    code.fenceIndent = indentAt(line.exp, offset);
    code.lines = [];
    this.addChild(this.container(), code);
    this.stack.push(code);
  }
  openHtml(line, offset, ht) {
    const html = newBlock('html');
    html.htmlType = ht;
    html.lines = [sliceContent(line, offset)];
    this.addChild(this.container(), html);
    this.stack.push(html);
    if (ht <= 5 && htmlEndsHere(line.exp, offset, html)) {
      this.pendingHtml = html;
      this.closeTop();
    }
  }

  openNewBlocks(line, offset, qPre = -1) {
    const exp = line.exp;
    let container = this.container();
    for (;;) {
      if (isBlankExp(exp, offset)) return;
      const ind = indentAt(exp, offset);
      // If the container is a list and this line does not start a matching
      // item, the list ends here. A thematic break also ends the list even
      // when it looks like a list item (e.g. "* * *").
      if (container.t === 'list') {
        const it = matchListItem(exp, offset);
        if (!it || !listMatches(container, it) || isThematicBreak(exp, offset)) {
          this.closeTop(); // closes the list
          container = this.container();
          continue;
        }
      }
      if (ind >= 4) {
        const code = newBlock('code');
        code.fenced = false;
        code.lines = [sliceContent(line, offset + 4)];
        this.addChild(container, code);
        this.stack.push(code);
        return;
      }
      const fence = matchFence(exp, offset);
      if (fence) { this.openFence(line, offset, fence); return; }
      const atx = matchATX(exp, offset);
      if (atx) { this.addHeading(atx); return; }
      const ht = matchHtmlBlock(exp, offset);
      if (ht) { this.openHtml(line, offset, ht); return; }
      if (isThematicBreak(exp, offset)) { this.addHr(); return; }
      const item = matchListItem(exp, offset);
      if (item) {
        this.openListItem(line, offset, item);
        return;
      }
      const q = matchQuote(exp, offset);
      if (q !== -1) {
        const quote = newBlock('quote');
        this.addChild(container, quote);
        this.stack.push(quote);
        container = quote;
        qPre = offset;
        offset = q;
        continue;
      }
      const para = newBlock('para');
      para.lines = [qPre >= 0 ? quoteParaContent(line, offset, qPre) : sliceContent(line, offset)];
      this.addChild(container, para);
      this.stack.push(para);
      return;
    }
  }

  // Open a list item (creating the list if needed) and descend into it.
  openListItem(line, offset, item) {
    let container = this.container();
    let list = null;
    if (container.t === 'list' && listMatches(container, item)) {
      list = container;
      const prev = list.children[list.children.length - 1];
      // Only a true blank line between items makes the list loose;
      // a container line with empty content does not (cm-320).
      if (prev && prev.blankBeforeNextTrue) list.tight = false;
    } else {
      if (container.t === 'list') { this.closeTop(); container = this.container(); }
      list = newBlock('list');
      list.ordered = item.ordered;
      list.delim = item.delim;
      list.bullet = item.bullet;
      list.start = item.start;
      list.tight = true;
      this.addChild(container, list);
      this.stack.push(list);
    }
    const it = newBlock('item');
    it.contentIndent = item.contentIndent;
    it.blankBeforeNext = false;
    // A blank line before this new item (recorded on the previous
    // item) makes the list loose. Safe for cm-320 because markBlank
    // no longer marks items outside a quote the blank sits in.
    const prev = list.children[list.children.length - 1];
    if (prev && prev.blankBeforeNext) list.tight = false;
    this.addChild(list, it);
    this.stack.push(it);
    const contentOff = offset + item.contentStart;
    // The item's first line may itself start a block (nested list, quote,
    // code...). Re-run the opener inside the item.
    this.openNewBlocks(line, contentOff);
  }

  finalize(b) {
    if (b.t === 'para') this.finalizePara(b);
    else if (b.t === 'code') {
      if (b.fenced) {
        // Fenced: drop exactly one trailing blank line (the renderer
        // adds the final newline); indented: drop all of them.
        if (b.lines.length && b.lines[b.lines.length - 1] === '') b.lines.pop();
      } else {
        while (b.lines.length && b.lines[b.lines.length - 1] === '') b.lines.pop();
      }
    }
  }

  finalizePara(para) {
    let text = para.lines.join('\n');
    text = this.stripRefDefs(text);
    if (text === '') {
      const p = para.parent;
      const idx = p.children.indexOf(para);
      if (idx !== -1) p.children.splice(idx, 1);
      return;
    }
    para.lines = text.split('\n');
    // Table? Second line must be a delimiter row.
    if (para.lines.length >= 2) {
      const tbl = tryTable(para.lines);
      if (tbl) {
        const p = para.parent;
        const idx = p.children.indexOf(para);
        tbl.parent = p;
        p.children[idx] = tbl;
      }
    }
  }

  // Parse leading link reference definitions out of a paragraph's text.
  // Returns the remaining text.
  stripRefDefs(text) {
    let pos = 0;
    const n = text.length;
    for (;;) {
      // skip up to 3 leading spaces on this "line" (defs start a line)
      let i = pos;
      let sp = 0;
      while (i < n && text[i] === ' ' && sp < 3) { i++; sp++; }
      if (text[i] !== '[') break;
      const def = parseRefDef(text, i);
      if (!def) break;
      const label = normalizeLabel(def.label);
      if (label && !this.refs.has(label)) {
        this.refs.set(label, { url: def.url, title: def.title });
      }
      pos = def.end;
      // After a definition, the next line must start immediately (the
      // definition consumed through its title line's end).
      if (pos < n && text[pos] === '\n') pos++;
      else if (pos < n) break;
    }
    return text.slice(pos);
  }
}

// Match a blockquote marker at exp[offset] (after up to 3 spaces).
// Returns the offset after the marker and one optional space, or -1.
function matchQuote(exp, offset) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  if (exp[i] !== '>') return -1;
  i++;
  if (exp[i] === ' ') i++;
  return i;
}

function matchATX(exp, offset) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  let level = 0;
  while (i < exp.length && exp[i] === '#') { level++; i++; }
  if (level === 0 || level > 6) return null;
  if (i >= exp.length) return { level, text: '' };
  if (exp[i] !== ' ' && exp[i] !== '\t') return null;
  // content: skip spaces/tabs, strip trailing spaces and closing #'s
  let j = exp.length;
  while (j > i && (exp[j - 1] === ' ' || exp[j - 1] === '\t')) j--;
  let k = j;
  while (k > i && exp[k - 1] === '#') k--;
  if (k < j && k > i && (exp[k - 1] === ' ' || exp[k - 1] === '\t')) j = k;
  while (j > i && (exp[j - 1] === ' ' || exp[j - 1] === '\t')) j--;
  let s = i;
  while (s < exp.length && (exp[s] === ' ' || exp[s] === '\t')) s++;
  return { level, text: exp.slice(s, j) };
}

function matchFence(exp, offset) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  const ch = exp[i];
  if (ch !== '`' && ch !== '~') return null;
  let len = 0;
  while (exp[i + len] === ch) len++;
  if (len < 3) return null;
  let info = exp.slice(i + len).trim();
  if (ch === '`' && info.includes('`')) return null;
  return { ch, len, info };
}

function isClosingFence(exp, offset, leaf) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  let len = 0;
  while (exp[i + len] === leaf.fenceChar) len++;
  if (len < leaf.fenceLen) return false;
  let j = i + len;
  while (j < exp.length && exp[j] === ' ') j++;
  return j === exp.length;
}

function isThematicBreak(exp, offset) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  const ch = exp[i];
  if (ch !== '*' && ch !== '-' && ch !== '_') return false;
  let n = 0;
  while (i < exp.length) {
    const c = exp[i];
    if (c === ch) { n++; i++; }
    else if (c === ' ' || c === '\t') i++;
    else return false;
  }
  return n >= 3;
}

// Match a list item marker at exp[offset] (up to 3 leading spaces).
// Returns { ordered, bullet, delim, start, contentStart, contentIndent,
// mayInterrupt } or null.
function matchListItem(exp, offset) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  const markerStart = i;
  let ordered = false;
  let bullet = null;
  let delim = null;
  let start = 1;
  let markerLen = 0;
  const c = exp[i];
  if (c === '-' || c === '+' || c === '*') {
    // A bullet must be followed by space/tab/EOL (else it may be a
    // thematic break or emphasis, not a list).
    if (i + 1 < exp.length && exp[i + 1] !== ' ' && exp[i + 1] !== '\t') return null;
    bullet = c;
    markerLen = 1;
    i++;
  } else if (c >= '0' && c <= '9') {
    let j = i;
    while (j < exp.length && exp[j] >= '0' && exp[j] <= '9' && j - i < 9) j++;
    if (j - i > 9 || j === i) return null;
    const d = exp[j];
    if (d !== '.' && d !== ')') return null;
    if (j + 1 < exp.length && exp[j + 1] !== ' ' && exp[j + 1] !== '\t') return null;
    ordered = true;
    delim = d;
    start = parseInt(exp.slice(i, j), 10);
    if (start > 999999999) return null;
    markerLen = (j - i) + 1;
    i = j + 1;
  } else {
    return null;
  }
  // Spaces after the marker.
  let spaces = 0;
  while (i + spaces < exp.length && exp[i + spaces] === ' ') spaces++;
  const afterSpaces = i + spaces;
  const empty = afterSpaces >= exp.length;
  let contentStart;
  let contentIndent;
  // contentStart/contentIndent are relative to `offset` (the position
  // matchListItem was called with), so they include the leading spaces.
  if (empty) {
    contentStart = sp + markerLen + 1;
    contentIndent = sp + markerLen + 1;
  } else if (spaces >= 1 && spaces <= 4) {
    contentStart = sp + markerLen + spaces;
    contentIndent = sp + markerLen + spaces;
  } else {
    contentStart = sp + markerLen + 1;
    contentIndent = sp + markerLen + 1;
  }
  // A list may interrupt a paragraph when the item is not empty and it is
  // a bullet list or an ordered list starting with 1.
  const mayInterrupt = !empty && (!ordered || start === 1);
  return { ordered, bullet, delim, start, contentStart, contentIndent, mayInterrupt };
}

function listMatches(list, item) {
  if (list.ordered !== item.ordered) return false;
  if (item.ordered) return list.delim === item.delim;
  return list.bullet === item.bullet;
}

// HTML block start: returns type 1-7 or 0.
function matchHtmlBlock(exp, offset) {
  let i = offset;
  let sp = 0;
  while (i < exp.length && exp[i] === ' ' && sp < 3) { i++; sp++; }
  if (exp[i] !== '<') return 0;
  const rest = exp.slice(i);
  const low = rest.toLowerCase();
  if (/^<(pre|script|style|textarea)(\s|>|$)/.test(low)) return 1;
  if (low.startsWith('<!--')) return 2;
  if (low.startsWith('<?')) return 3;
  if (/^<![a-z]/.test(low)) return 4;
  if (low.startsWith('<![cdata[')) return 5;
  // Type 6: block tag name followed by space/tab/EOL/> or />
  const m6 = /^<\/?([a-z][a-z0-9-]*)(\s|\/?>|$)/.exec(low);
  if (m6 && BLOCK_TAGS.has(m6[1])) return 6;
  // Type 7: a complete open or close tag followed only by whitespace/EOL.
  // The tag must be fully valid, including attribute names/values
  // (cm-619: <a h*#ref="hi"> is not a tag — '*' is not a valid
  // attribute-name character, so the line is a paragraph).
  if (isCompleteTag(low)) {
    const tag = /^<\/?([a-z][a-z0-9-]*)/.exec(low)[1];
    if (tag !== 'pre' && tag !== 'script' && tag !== 'style' && tag !== 'textarea') return 7;
  }
  return 0;
}

// Validate that s is a complete open/close tag (no leading '<' missing)
// followed only by whitespace to end of line. Attribute names must be
// [A-Za-z_:][A-Za-z0-9_:.-]*; values are quoted or unquoted (no spaces,
// '"', "'", '=', '<', '>', backtick).
function isCompleteTag(s) {
  const n = s.length;
  let i = 0;
  if (s[i] !== '<') return false;
  i++;
  let isClose = false;
  if (s[i] === '/') { isClose = true; i++; }
  if (i >= n || !/[a-z]/.test(s[i])) return false;
  while (i < n && /[a-z0-9-]/.test(s[i])) i++;
  for (;;) {
    let ws = 0;
    while (i < n && (s[i] === ' ' || s[i] === '\t')) { i++; ws++; }
    if (i >= n) return false;
    if (s[i] === '>') { i++; break; }
    if (s[i] === '/' && s[i + 1] === '>') { if (isClose) return false; i += 2; break; }
    // An attribute must be preceded by whitespace (cm-609: <m:abc>
    // has no whitespace after the tag name; cm-622: 'bar'title has
    // none after the quoted value). Close tags take no attributes
    // (cm-624: </a href="foo"> is not a tag).
    if (ws === 0 || isClose) return false;
    // Attribute name.
    if (!/[A-Za-z_:]/.test(s[i])) return false;
    while (i < n && /[A-Za-z0-9_:.-]/.test(s[i])) i++;
    while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
    if (i < n && s[i] === '=') {
      i++;
      while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
      if (i >= n) return false;
      const q = s[i];
      if (q === '"' || q === "'") {
        i++;
        while (i < n && s[i] !== q) i++;
        if (i >= n) return false;
        i++;
      } else {
        let vlen = 0;
        while (i < n && s[i] !== ' ' && s[i] !== '\t' && s[i] !== '>' && s[i] !== '/' && s[i] !== '"' && s[i] !== "'" && s[i] !== '=' && s[i] !== '<' && s[i] !== '`') { i++; vlen++; }
        if (vlen === 0) return false;
      }
    }
  }
  while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++;
  return i >= n;
}

// Does this line end an HTML block of type 1-5?
function htmlEndsHere(exp, offset, leaf) {
  const rest = exp.slice(offset).toLowerCase();
  switch (leaf.htmlType) {
    case 1: return /<\/(pre|script|style|textarea)/.test(rest);
    case 2: return rest.includes('-->');
    case 3: return rest.includes('?>');
    case 4: return rest.includes('>');
    case 5: return rest.includes(']]>');
  }
  return false;
}

// ---------------------------------------------------------------------------
// Link reference definitions and tables (used at paragraph finalisation).
function normalizeLabel(label) {
  // Collapse whitespace, case-fold. Backslash escapes are NOT resolved
  // for matching (cm-545: [foo\!] does not match [foo!]).
  // Case folding (not just lowercasing): ß/ẞ fold to 'ss' (cm-540),
  // plus common Latin ligatures.
  let out = '';
  for (let i = 0; i < label.length; i++) {
    const c = label[i];
    if (isSpace(c)) {
      if (out.length && out[out.length - 1] !== ' ') out += ' ';
    } else {
      out += c;
    }
  }
  if (out.endsWith(' ')) out = out.slice(0, -1);
  out = out.toLowerCase();
  out = out.replace(/ß/g, 'ss').replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬅ/g, 'st').replace(/ﬆ/g, 'st');
  return out;
}

// Parse a link reference definition starting at text[i] === '['.
// Returns { label, url, title, end } or null. `end` is the index of the
// line ending that terminates the definition.
function parseRefDef(text, i) {
  const n = text.length;
  // Label: balanced brackets, escapes allowed, at most 999 chars.
  let j = i + 1;
  let depth = 0;
  let label = '';
  while (j < n) {
    const c = text[j];
    if (c === '\\' && j + 1 < n && isAsciiPunct(text[j + 1])) { label += c + text[j + 1]; j += 2; continue; }
    if (c === '[') return null; // unescaped '[' not allowed in a label (cm-547/548)
    if (c === ']') {
      if (depth === 0) break;
      depth--; label += c; j++; continue;
    }
    if (c === '\n' && text[j + 1] === '\n') return null; // blank line
    label += c;
    j++;
    if (label.length > 999) return null;
  }
  if (j >= n || text[j] !== ']') return null;
  if (label.length === 0) return null;
  if (normalizeLabel(label) === '') return null; // label that folds to empty (cm-552)
  j++; // past ']'
  if (text[j] !== ':') return null;
  j++;
  // Skip spaces/tabs and at most one line ending.
  while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
  if (text[j] === '\n') { j++; while (j < n && (text[j] === ' ' || text[j] === '\t')) j++; }
  // Destination.
  let url = '';
  if (text[j] === '<') {
    j++;
    let k = j;
    let ok = false;
    while (k < n) {
      const c = text[k];
      if (c === '\n') return null;
      if (c === '\\' && k + 1 < n && isAsciiPunct(text[k + 1])) { k += 2; continue; }
      if (c === '>') { ok = true; break; }
      if (c === '<') return null;
      k++;
    }
    if (!ok) return null;
    url = text.slice(j, k);
    j = k + 1;
  } else {
    let k = j;
    let depthP = 0;
    while (k < n) {
      const c = text[k];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') break;
      if (c === '\\' && k + 1 < n && isAsciiPunct(text[k + 1])) { k += 2; continue; }
      if (c === '(') { depthP++; k++; continue; }
      if (c === ')') {
        if (depthP === 0) break;
        depthP--; k++; continue;
      }
      k++;
    }
    if (k === j) return null;
    url = text.slice(j, k);
    j = k;
  }
  url = resolveEscapes(url);
  // Optional title: same line, or the next line.
  let title = null;
  let k = j;
  while (k < n && (text[k] === ' ' || text[k] === '\t')) k++;
  if (k < n && text[k] === '\n') {
    // Look at the next line for a title.
    let k2 = k + 1;
    while (k2 < n && (text[k2] === ' ' || text[k2] === '\t')) k2++;
    const t = parseTitle(text, k2);
    if (t) {
      // Only whitespace may follow the title on its line; trailing
      // garbage discards the title (cm-210) but keeps the definition.
      let k3 = t.end;
      while (k3 < n && (text[k3] === ' ' || text[k3] === '\t')) k3++;
      if (k3 < n && text[k3] !== '\n') k = j;
      else { title = t.title; k = t.end; }
    }
    else k = j; // no title; stay at the destination's end
  } else {
    // A same-line title must be separated from the destination by
    // whitespace (cm-201: <bar>(baz) is not a valid ref def).
    if (k < n && k === j) return null;
    const t = parseTitle(text, k);
    if (t) { title = t.title; k = t.end; }
    else if (k < n && text[k] !== '\n') {
      // Something else follows the destination on this line.
      return null;
    }
  }
  // Only whitespace may follow on the title's line.
  while (k < n && (text[k] === ' ' || text[k] === '\t')) k++;
  if (k < n && text[k] !== '\n') return null;
  return { label, url, title, end: k };
}

// Parse a link title at text[i]: "...", '...', or (...). Returns
// { title, end } (end = index just past the title) or null.
function parseTitle(text, i) {
  const n = text.length;
  const q = text[i];
  if (q !== '"' && q !== "'" && q !== '(') return null;
  const close = q === '(' ? ')' : q;
  let j = i + 1;
  let depth = 0;
  let out = '';
  while (j < n) {
    const c = text[j];
    if (c === '\n') {
      // A title may span lines, but not a blank line.
      if (text[j + 1] === '\n') return null;
      out += c;
      j++;
      continue;
    }
    if (c === '\\' && j + 1 < n && isAsciiPunct(text[j + 1])) { out += c + text[j + 1]; j += 2; continue; }
    if (q === '(' && c === '(') { depth++; out += c; j++; continue; }
    if (c === close) {
      if (q === '(' && depth > 0) { depth--; out += c; j++; continue; }
      return { title: resolveEscapes(out), end: j + 1 };
    }
    out += c;
    j++;
  }
  return null;
}

// Split a table row line into cells (on unescaped pipes).
function splitRow(line) {
  const cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length && line[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|') { cells.push(cur); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur);
  // Drop a leading/trailing empty cell from a leading/trailing pipe.
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map(s => s.trim());
}

function isDelimCell(cell) {
  return /^:?-+:?$/.test(cell);
}

// Try to read a paragraph's lines as a GFM table. Returns a table block
// or null.
function tryTable(lines) {
  // The delimiter row must not be indented 4+ columns (that would be an
  // indented code block, not a table).
  {
    let col = 0;
    for (const ch of lines[1]) {
      if (ch === ' ') col++;
      else if (ch === '\t') col += 4 - (col % 4);
      else break;
    }
    if (col >= 4) return null;
  }
  const delim = splitRow(lines[1]);
  if (delim.length === 0) return null;
  for (const c of delim) if (!isDelimCell(c)) return null;
  const header = splitRow(lines[0]);
  if (header.length !== delim.length) return null;
  const align = delim.map(c => {
    const l = c.startsWith(':');
    const r = c.endsWith(':');
    if (l && r) return 'center';
    if (l) return 'left';
    if (r) return 'right';
    return null;
  });
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    while (cells.length < delim.length) cells.push('');
    rows.push(cells.slice(0, delim.length));
  }
  return { t: 'table', align, header, rows, children: [], parent: null };
}

// ---------------------------------------------------------------------------
// Block rendering. A paragraph that is a direct child of an item in a tight
// list renders as bare inline content (no <p> tags, no trailing newline);
// every other block ends with '\n'.
function renderBlock(b, refs, tightPara) {
  switch (b.t) {
    case 'doc': {
      let out = '';
      for (const c of b.children) out += renderBlock(c, refs, false);
      return out;
    }
    case 'para': {
      const inner = inlineParse(b.lines.join('\n'), refs, true);
      const cb = b.taskChecked === undefined ? '' : (b.taskChecked ? '<input checked="" disabled="" type="checkbox">' : '<input disabled="" type="checkbox">');
      return tightPara ? cb + inner : '<p>' + cb + inner + '</p>\n';
    }
    case 'head': {
      return '<h' + b.level + '>' + inlineParse(b.lines.join('\n'), refs, true) + '</h' + b.level + '>\n';
    }
    case 'hr': return '<hr>\n';
    case 'code': {
      let lang = '';
      if (b.info) {
        const w = b.info.split(/\s+/, 1)[0];
        if (w) lang = ' class="language-' + escapeAttrKeepEntities(resolveInfoLang(w)) + '"';
      }
      const content = b.lines.length ? escapeText(b.lines.join('\n')) + '\n' : '';
      return '<pre><code' + lang + '>' + content + '</code></pre>\n';
    }
    case 'html': {
      const text = b.lines.join('\n');
      scanHtmlForA(text);
      return text + (b.noTrailingNl ? '' : '\n');
    }
    case 'quote': {
      let out = '<blockquote>\n';
      for (const c of b.children) out += renderBlock(c, refs, false);
      return out + '</blockquote>\n';
    }
    case 'list': {
      let out;
      if (b.ordered) {
        out = '<ol' + (b.start !== 1 ? ' start="' + b.start + '"' : '') + '>\n';
      } else out = '<ul>\n';
      for (const item of b.children) {
        out += '<li>';
        let first = true;
        for (const c of item.children) {
          if (first && c.t === 'para') {
            first = false;
            // GFM task list: a leading '[ ] ' / '[x] ' / '[X] ' in the
            // first paragraph becomes a checkbox (gfm-279/280). The
            // marker is stripped here; the para renderer prepends the
            // <input> inside the <p> (loose) or before the content
            // (tight) via c.taskChecked.
            const m = /^\[( |x|X)\] /.exec(c.lines[0] || '');
            if (m) {
              c.taskChecked = m[1] === 'x' || m[1] === 'X';
              c.lines[0] = c.lines[0].slice(3);
            }
          } else {
            first = false;
          }
          out += renderBlock(c, refs, b.tight && c.t === 'para');
        }
        out += '</li>\n';
      }
      return out + (b.ordered ? '</ol>\n' : '</ul>\n');
    }
    case 'table': {
      let out = '<table>\n<thead>\n<tr>\n';
      for (let j = 0; j < b.header.length; j++) {
        const a = b.align[j];
        out += '<th' + (a ? ' align="' + a + '"' : '') + '>' + inlineParse(b.header[j], refs, true) + '</th>\n';
      }
      out += '</tr>\n</thead>\n';
      if (b.rows.length) {
        out += '<tbody>';
        for (const row of b.rows) {
          out += '<tr>\n';
          for (let j = 0; j < row.length; j++) {
            const a = b.align[j];
            out += '<td' + (a ? ' align="' + a + '"' : '') + '>' + inlineParse(row[j], refs, true) + '</td>\n';
          }
          out += '</tr>\n';
        }
        out += '</tbody>';
      }
      return out + '</table>\n';
    }
  }
  return '';
}

Parser.prototype.render = function () {
  return renderBlock(this.doc, this.refs, false);
};

// ---------------------------------------------------------------------------
// Inline parsing helpers.
// ---------------------------------------------------------------------------

// Decode entities only (no backslash escapes; used for code spans).
function decodeEntities(s) {
  if (!s.includes('&')) return s;
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '&') {
      const d = decodeEntityAt(s, i);
      if (d) { out += s.slice(start, i) + d[0]; i = d[1] - 1; start = d[1]; }
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Skip spaces/tabs and at most one line ending (for link destinations and
// titles). Returns the new index, or -1 on a blank line.
function skipLinkWs(s, i) {
  const n = s.length;
  let j = i;
  while (j < n && (s[j] === ' ' || s[j] === '\t')) j++;
  if (j < n && s[j] === '\n') {
    j++;
    while (j < n && (s[j] === ' ' || s[j] === '\t')) j++;
    if (j < n && s[j] === '\n') return -1;
  }
  return j;
}

// Parse a link destination at s[i]. Returns { dest, next } or null.
// The bare form stops at whitespace or an unbalanced ')'; an empty
// destination (immediately followed by ')') is allowed.
function parseLinkDest(s, i) {
  const n = s.length;
  if (i >= n) return { dest: '', next: i };
  if (s[i] === '<') {
    let k = i + 1;
    let ok = false;
    while (k < n) {
      const c = s[k];
      if (c === '\n') return null;
      if (c === '\\' && k + 1 < n && isAsciiPunct(s[k + 1])) { k += 2; continue; }
      if (c === '>') { ok = true; break; }
      if (c === '<') return null;
      k++;
    }
    if (!ok) return null;
    return { dest: resolveEscapes(s.slice(i + 1, k)), next: k + 1 };
  }
  if (s[i] === ')') return { dest: '', next: i };
  let k = i;
  let depth = 0;
  while (k < n) {
    const c = s[k];
    if (c === ' ' || c === '\t' || c === '\n') break;
    if (c === '\\' && k + 1 < n && isAsciiPunct(s[k + 1])) { k += 2; continue; }
    if (c === '(') { depth++; k++; continue; }
    if (c === ')') {
      if (depth === 0) break;
      depth--; k++; continue;
    }
    k++;
  }
  if (k === i) return null;
  return { dest: resolveEscapes(s.slice(i, k)), next: k };
}

// Find the ']' matching the '[' at s[start]. Handles nested brackets,
// code spans and backslash escapes. Returns the index or -1.
function findLinkEnd(s, start) {
  const n = s.length;
  let depth = 0;
  let i = start + 1;
  while (i < n) {
    const c = s[i];
    if (c === '\\' && i + 1 < n && isAsciiPunct(s[i + 1])) { i += 2; continue; }
    if (c === '`') {
      let len = 0;
      while (i + len < n && s[i + len] === '`') len++;
      // Backticks immediately before ']' are literal, unless the
      // first later backtick run has the SAME length (then the run
      // opens a code span that swallows the ']', cm-525). A later
      // run of a different length does not stop the literal reading
      // (doc-33: `` before ']' with only a later single '`').
      if (i + len < n && s[i + len] === ']') {
        let sameLater = false;
        for (let k = i + len + 1; k < n; k++) {
          if (s[k] === '`') {
            let l2 = 0;
            while (k + l2 < n && s[k + l2] === '`') l2++;
            sameLater = (l2 === len);
            break;
          }
        }
        if (!sameLater) { i += len; continue; }
      }
      // A code span in a label is opener run + non-backtick content
      // + closer run (either length): the closer is the FIRST
      // backtick run after the opener. A run with no closer at all
      // (and not immediately before ']', handled above) makes the
      // label invalid, so the link fails (doc-18: the second `` in
      // `[empty test `` a ` b `` output][all-40]` has no closer).
      let j = i + len;
      let found = -1;
      while (j < n) {
        if (s[j] === '`') {
          let l2 = 0;
          while (j + l2 < n && s[j + l2] === '`') l2++;
          found = j + l2;
          break;
        }
        j++;
      }
      if (found !== -1) { i = found; continue; }
      return -1;
    }
    if (c === '[') { depth++; i++; continue; }
    if (c === ']') {
      if (depth === 0) return i;
      depth--; i++; continue;
    }
    if (c === '<') {
      // A ']' inside <...> (angle autolink or HTML tag/attribute) does
      // not close the label (cm-524/526/536/538). Skip to the next '>'
      // on the same line when '<' plausibly opens such a construct.
      const nx = s[i + 1];
      if (nx && /[A-Za-z\/!?]/.test(nx)) {
        let j = i + 1;
        while (j < n && s[j] !== '>' && s[j] !== '\n') j++;
        if (j < n && s[j] === '>') { i = j + 1; continue; }
      }
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

// --- autolinks -------------------------------------------------------------

// Chars that are trimmed from the end of an extended autolink URL.
const URL_TRIM = new Set(['!', '"', "'", '(', '*', ',', '.', ':', ';', '?', '_', '~']);

// A trailing ')' is kept only when it closes a paren group whose content
// holds no parens (e.g. "(x)" keeps it, "(a(b)c)" loses it).
function trailingParenKeep(url) {
  let depth = 1;
  for (let k = url.length - 2; k >= 0; k--) {
    const c = url[k];
    if (c === ')') depth++;
    else if (c === '(') {
      depth--;
      if (depth === 0) {
        for (let m = k + 1; m < url.length - 1; m++) {
          if (url[m] === '(' || url[m] === ')') return false;
        }
        return true;
      }
    }
  }
  return false;
}

// Trim trailing punctuation from a URL, keeping at least one char after
// the prefix (of length prefixLen). An unmatched '(' (one that opens
// and never closes within the URL) ends the URL just before it
// (doc-08: `https://sub.domain.example.io)](https://npmjs.com/heading`
// autolinks only up to `...example.io)]`).
function trimUrl(url, prefixLen) {
  // Truncate at the first '(' that never closes.
  {
    const stack = [];
    for (let k = 0; k < url.length; k++) {
      if (url[k] === '(') stack.push(k);
      else if (url[k] === ')' && stack.length) stack.pop();
    }
    if (stack.length) url = url.slice(0, stack[0]);
  }
  const minLen = prefixLen + 1;
  while (url.length > minLen) {
    const last = url[url.length - 1];
    if (URL_TRIM.has(last)) { url = url.slice(0, -1); continue; }
    if (last === ')') {
      if (trailingParenKeep(url)) break;
      url = url.slice(0, -1);
      continue;
    }
    break;
  }
  return url;
}

// End index (exclusive) of a URL run starting at s[i]: stops at whitespace
// or '<'. An entity-like &name; also ends the URL (gfm-627:
// www...&hl; links only up to the '&').
function scanUrlEnd(s, i) {
  const n = s.length;
  let j = i;
  while (j < n) {
    const c = s[j];
    if (c === '<' || c <= ' ') break;
    if (c === '&') {
      let k = j + 1;
      while (k < n && isAlnum(s[k])) k++;
      if (k > j + 1 && k < n && s[k] === ';') break;
    }
    j++;
  }
  return j;
}

function isEmailLocal(c) {
  return c !== undefined && (CC[c.charCodeAt(0)] & 7) !== 0;
}

// Is `dom` a valid domain for a bare email autolink? Labels of [A-Za-z0-9-],
// at least one '.', last label starts and ends alphanumeric.
function isValidBareDomain(dom) {
  const labels = dom.split('.');
  if (labels.length < 2) return false;
  for (let li = 0; li < labels.length; li++) {
    const lab = labels[li];
    if (!lab) return false;
    if (li === labels.length - 1 && (!isAlnum(lab[0]) || !isAlnum(lab[lab.length - 1]))) return false;
    for (let m = 0; m < lab.length; m++) {
      const c = lab[m];
      // '_' is allowed inside a label (because@mark.example.com_x
      // links the whole address); the last label must still start
      // and end alphanumeric, so a trailing '_' is excluded.
      if (!isAlnum(c) && c !== '-' && c !== '_') return false;
    }
  }
  return true;
}

// Try a bare email autolink at s[i] (optional lowercase mailto:/xmpp:
// prefix). Returns { href, text, next } or null.
// hasOpenUnderscore: an unmatched '_' opener precedes this position,
// so a trailing '__' after the domain is its closer, not part of the
// address (doc-04: __because@mark.example.com__ links in full).
function matchBareEmail(s, i, hasOpenUnderscore) {
  const n = s.length;
  let j = i;
  let prefix = '';
  if (s.startsWith('mailto:', i)) { prefix = 'mailto:'; j = i + 7; }
  else if (s.startsWith('xmpp:', i)) { prefix = 'xmpp:'; j = i + 5; }
  const localStart = j;
  while (j < n && isEmailLocal(s[j])) j++;
  if (j === localStart || j >= n || s[j] !== '@') return null;
  const domStart = j + 1;
  let k = domStart;
  while (k < n && (isAlnum(s[k]) || s[k] === '-' || s[k] === '.' || s[k] === '_')) k++;
  let end = k;
  while (end > domStart) {
    // With an unmatched '_' opener, trailing '_'s are the closing
    // '__' delimiter, not part of the domain: strip them first.
    if (hasOpenUnderscore) {
      while (end > domStart && s[end - 1] === '_') end--;
      if (end <= domStart) break;
    }
    const dom = s.slice(domStart, end);
    if (isValidBareDomain(dom)) {
      const next = s[end];
      const isCloser = hasOpenUnderscore && next === '_' && s[end + 1] === '_';
      // A single '_' after the domain is also the emphasis closer
      // (doc-31/34/37/38: _warning when@atlas.example.com_ links in
      // full). The '_' cannot continue the domain: the scan already
      // consumed every '_' and alnum after it, so a stripped trailing
      // '_' is only ever the closer, never domain text.
      const singleCloser = hasOpenUnderscore && next === '_';
      if (next === undefined || isCloser || singleCloser || !(isAlnum(next) || next === '_' || next === '-')) {
        // With an explicit scheme (xmpp:/mailto:), one path segment
        // after the email belongs to the link (gfm-634/635):
        // '/txt', '/txt@bin', '/txt@bin.com' are included, but a
        // second segment ('/bin' in '/txt/bin') is not.
        if (prefix && s[end] === '/') {
          let p = end + 1;
          while (p < n && s[p] !== '/' && s[p] > ' ' && s[p] !== '<') p++;
          let q = p;
          while (q > end + 1 && URL_TRIM.has(s[q - 1])) q--;
          if (q > end + 1) end = q;
        }
        const email = s.slice(i, end);
        return { href: prefix ? email : 'mailto:' + email, text: email, next: end };
      }
    }
    const dot = dom.lastIndexOf('.');
    if (dot === -1) break;
    end = domStart + dot;
  }
  return null;
}

// Case-insensitive scheme prefix at s[i]: 'http://', 'https://' or
// 'ftp://', or null. Compares characters directly — no slice or
// toLowerCase allocation at every text position.
function schemeAt(s, i) {
  const c = s[i];
  if (c === 'h' || c === 'H') {
    if ((s[i + 1] === 't' || s[i + 1] === 'T') && (s[i + 2] === 't' || s[i + 2] === 'T') && (s[i + 3] === 'p' || s[i + 3] === 'P')) {
      if (s[i + 4] === ':' && s[i + 5] === '/' && s[i + 6] === '/') return 'http://';
      if ((s[i + 4] === 's' || s[i + 4] === 'S') && s[i + 5] === ':' && s[i + 6] === '/' && s[i + 7] === '/') return 'https://';
    }
  } else if (c === 'f' || c === 'F') {
    if ((s[i + 1] === 't' || s[i + 1] === 'T') && (s[i + 2] === 'p' || s[i + 2] === 'P') && s[i + 3] === ':' && s[i + 4] === '/' && s[i + 5] === '/') return 'ftp://';
  }
  return null;
}

// Is `c` an RFC "atext" char (local part of an angle-bracket email)?
function isAtext(c) {
  if (isAlnum(c)) return true;
  return "!#$%&'*+-/=?^_`{|}~.".includes(c);
}

// Is `inner` a valid email for an angle-bracket autolink? Local part is
// atext; every domain label starts and ends alphanumeric; at least one '.'.
function isAngleEmail(inner) {
  const at = inner.indexOf('@');
  if (at <= 0) return false;
  const local = inner.slice(0, at);
  const domain = inner.slice(at + 1);
  for (let i = 0; i < local.length; i++) if (!isAtext(local[i])) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const lab of labels) {
    if (!lab) return false;
    if (!isAlnum(lab[0]) || !isAlnum(lab[lab.length - 1])) return false;
    for (let i = 0; i < lab.length; i++) {
      const c = lab[i];
      if (!isAlnum(c) && c !== '-') return false;
    }
  }
  return true;
}

// Try an angle-bracket autolink at s[i] === '<'. Returns { href, text, next }
// or null.
function matchAngleAutolink(s, i) {
  const n = s.length;
  let k = i + 1;
  while (k < n) {
    const c = s[k];
    if (c === '>' || c === '<' || c <= ' ') break;
    k++;
  }
  if (k >= n || s[k] !== '>') return null;
  const inner = s.slice(i + 1, k);
  if (!inner) return null;
  const m = /^[a-zA-Z][a-zA-Z0-9+.-]{1,31}:/.exec(inner);
  if (m) {
    if (inner.length > m[0].length) return { href: inner, text: inner, next: k + 1 };
    return null;
  }
  if (isAngleEmail(inner)) return { href: 'mailto:' + inner, text: inner, next: k + 1 };
  return null;
}

// Try inline HTML at s[i] === '<'. Returns { html, next } or null.
function matchInlineHtml(s, i) {
  const n = s.length;
  if (s.startsWith('<!--', i)) {
    // <!--> and <!---> are complete (abruptly closed) comments by
    // themselves (cm-626): the comment is just those chars, not
    // everything up to a later '-->'.
    if (s[i + 4] === '>') return { html: '<!-->', next: i + 5 };
    if (s.startsWith('->', i + 4)) return { html: '<!--->', next: i + 6 };
    const end = s.indexOf('-->', i + 4);
    if (end === -1) return null;
    return { html: s.slice(i, end + 3), next: end + 3 };
  }
  if (s.startsWith('<?', i)) {
    const end = s.indexOf('?>', i + 2);
    if (end === -1) return null;
    return { html: s.slice(i, end + 2), next: end + 2 };
  }
  if (s.startsWith('<!', i)) {
    if (s.startsWith('<![CDATA[', i)) {
      const end = s.indexOf(']]>', i + 9);
      if (end === -1) return null;
      return { html: s.slice(i, end + 3), next: end + 3 };
    }
    const c = s[i + 2];
    if (c && isLetter(c)) {
      let j = i + 2;
      while (j < n && s[j] !== '>') j++;
      if (j >= n) return null;
      return { html: s.slice(i, j + 1), next: j + 1 };
    }
    return null;
  }
  if (s.startsWith('</', i)) {
    let j = i + 2;
    if (j >= n || !isLetter(s[j])) return null;
    while (j < n && (isAlnum(s[j]) || s[j] === '-')) j++;
    while (j < n && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n')) j++;
    if (j >= n || s[j] !== '>') return null;
    return { html: s.slice(i, j + 1), next: j + 1 };
  }
  let j = i + 1;
  if (j >= n || !isLetter(s[j])) return null;
  while (j < n && (isAlnum(s[j]) || s[j] === '-')) j++;
  // After the tag name must come whitespace, '>', or '/'. A ':' (or
  // any other char) directly after the name is not a tag (cm-609:
  // <m:abc> is literal text, not HTML).
  if (j < n && s[j] !== ' ' && s[j] !== '\t' && s[j] !== '\n' && s[j] !== '>' && s[j] !== '/') return null;
  for (;;) {
    let k = j;
    const k0 = k;
    while (k < n && (s[k] === ' ' || s[k] === '\t' || s[k] === '\n')) k++;
    if (k >= n) return null;
    if (s[k] === '>') return { html: s.slice(i, k + 1), next: k + 1 };
    if (s[k] === '/' && s[k + 1] === '>') return { html: s.slice(i, k + 2), next: k + 2 };
    // An attribute must be preceded by whitespace (cm-622:
    // <a href='bar'title=title> is not a tag).
    if (k === k0) return null;
    if (!isLetter(s[k]) && s[k] !== '_' && s[k] !== ':') return null;
    while (k < n && (isAlnum(s[k]) || s[k] === '_' || s[k] === ':' || s[k] === '.' || s[k] === '-')) k++;
    const afterName = k;
    while (k < n && (s[k] === ' ' || s[k] === '\t' || s[k] === '\n')) k++;
    if (k < n && s[k] === '=') {
      k++;
      while (k < n && (s[k] === ' ' || s[k] === '\t' || s[k] === '\n')) k++;
      if (k >= n) return null;
      const q = s[k];
      if (q === '"' || q === "'") {
        k++;
        while (k < n && s[k] !== q) k++;
        if (k >= n) return null;
        k++;
      } else {
        const vstart = k;
        while (k < n) {
          const c = s[k];
          if (c === ' ' || c === '\t' || c === '\n' || c === '"' || c === "'" || c === '=' || c === '<' || c === '>' || c === '`') break;
          k++;
        }
        if (k === vstart) return null;
      }
      j = k;
    } else {
      // Valueless attribute: rewind to just after the name so the
      // next iteration still sees the whitespace that separates it
      // from the following attribute (cm-616: _boolean zoop=...).
      j = afterName;
    }
  }
}

// --- emphasis delimiters ---------------------------------------------------

function isUnicodeWs(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === ' ';
}

function isPunct(c) {
  if (c === undefined || c === null || c === '') return false;
  const code = c.charCodeAt(0);
  if (code < 128) return isAsciiPunct(c);
  // CommonMark punctuation = Unicode P (punctuation) or S (symbol).
  return /[\p{P}\p{S}]/u.test(c);
}

// Left/right flanking of a delimiter run starting at s[i] with length run.
function flanking(s, i, run) {
  const n = s.length;
  const before = i > 0 ? s[i - 1] : null;
  const after = i + run < n ? s[i + run] : null;
  const beforeWs = before === null || isUnicodeWs(before);
  const afterWs = after === null || isUnicodeWs(after);
  const beforePunct = before !== null && isPunct(before);
  const afterPunct = after !== null && isPunct(after);
  return {
    left: !afterWs && (!afterPunct || beforeWs || beforePunct),
    right: !beforeWs && (!beforePunct || afterWs || afterPunct),
  };
}

function canOpenDelim(s, i, run, ch) {
  const f = flanking(s, i, run);
  if (ch === '_') return f.left && (!f.right || (i > 0 && isPunct(s[i - 1])));
  return f.left;
}

function canCloseDelim(s, i, run, ch) {
  const f = flanking(s, i, run);
  if (ch === '_') return f.right && (!f.left || (i + run < s.length && isPunct(s[i + run])));
  return f.right;
}

function runLen(s, i, ch) {
  let len = 0;
  while (i + len < s.length && s[i + len] === ch) len++;
  return len;
}

// Match a code span starting at s[i] === '`'. Returns { text, next } or null.
function matchCodeSpan(s, i) {
  const n = s.length;
  let len = 0;
  while (i + len < n && s[i + len] === '`') len++;
  let j = i + len;
  while (j < n) {
    if (s[j] === '`') {
      let l2 = 0;
      while (j + l2 < n && s[j + l2] === '`') l2++;
      if (l2 === len) {
        let content = s.slice(i + len, j).replace(/\n/g, ' ');
        if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' && /[^ ]/.test(content)) {
          content = content.slice(1, -1);
        }
        return { text: content, next: j + l2 };
      }
      j += l2;
    } else j++;
  }
  return null;
}

// Try a link or image starting at s[i] ('[' or '!['). Returns
// { node, next } or null. Link text is parsed with extended autolinks off.
// Attempt an inline link/image starting at s[j] === '('. Returns the
// { node, next } result or null if the inline form is invalid.
function tryInlineLink(s, j, text, refs, isImage) {
  const n = s.length;
  let k = skipLinkWs(s, j + 1);
  if (k === -1) return null;
  const dest = parseLinkDest(s, k);
  if (!dest) return null;
  let title = null;
  let m = skipLinkWs(s, dest.next);
  if (m === -1) return null;
  if (m < n && (s[m] === '"' || s[m] === "'" || s[m] === '(')) {
    const t = parseTitle(s, m);
    if (!t) return null;
    title = t.title;
    m = skipLinkWs(s, t.end);
    if (m === -1) return null;
  }
  if (m >= n || s[m] !== ')') return null;
  if (isImage) {
    const alt = plainTextNodes(inlineNodes(text, refs, false));
    return { node: { t: 'image', src: dest.dest, title, alt }, next: m + 1 };
  }
  const children = inlineNodes(text, refs, false);
  if (containsLink(children)) return null;
  return { node: { t: 'link', href: dest.dest, title, children }, next: m + 1 };
}

function tryLink(s, i, refs, extended) {
  const n = s.length;
  let isImage = false;
  let start = i;
  if (s[i] === '!') { isImage = true; start = i + 1; }
  if (start >= n || s[start] !== '[') return null;
  const end = findLinkEnd(s, start);
  if (end === -1) return null;
  const text = s.slice(start + 1, end);
  let j = end + 1;
  if (j < n && s[j] === '(') {
    const inline = tryInlineLink(s, j, text, refs, isImage);
    if (inline) return inline;
    // Inline link invalid: fall through to the (shortcut) reference
    // link instead of failing outright (cm-568: [foo](not a link)
    // with [foo]: /url1 is a reference link to /url1).
  }
  let label;
  if (j < n && s[j] === '[') {
    const end2 = findLinkEnd(s, j);
    if (end2 === -1) return null;
    label = s.slice(j + 1, end2);
    j = end2 + 1;
    if (label === '') label = text;
  } else {
    label = text;
  }
  if (label === '') return null;
  const ref = refs.get(normalizeLabel(label));
  if (!ref) return null;
  if (isImage) {
    const alt = plainTextNodes(inlineNodes(text, refs, false));
    return { node: { t: 'image', src: ref.url, title: ref.title, alt }, next: j };
  }
  const children = inlineNodes(text, refs, false);
  if (containsLink(children)) return null;
  return { node: { t: 'link', href: ref.url, title: ref.title, children }, next: j };
}

// True if any node in the list (recursively) is a link. A link's text
// must not contain a link (cm-518/519): the outer link then fails and
// its brackets stay literal while the inner link still forms.
// A link whose text contains a (non-autolink) link is rejected
// (cm-518/519). Angle autolinks are exempt: they stay on inside link
// text and form nested links.
function containsLink(nodes) {
  for (const nd of nodes) {
    if (nd.t === 'link' && !nd.autolink) return true;
    if (nd.children && containsLink(nd.children)) return true;
  }
  return false;
}

// True if any node in the list (recursively) is a code span whose
// content contains a backtick. Only a multi-backtick span can hold
// an inner backtick, so this identifies a `` `` a ` b `` `` span.
function hasInnerBacktickCode(nodes) {
  for (const nd of nodes) {
    if (nd.t === 'code' && typeof nd.s === 'string' && nd.s.includes('`')) return true;
    if (nd.children && hasInnerBacktickCode(nd.children)) return true;
  }
  return false;
}

// True if the source span [oPos, cPos] lies inside a `[...]` bracket
// whose closing `]` is immediately followed by `(` (a link attempt).
// Uses a plain scan for the nearest `[` before the opener and the
// nearest `]` after the closer (not findLinkEnd, which itself fails
// on the inner-backtick label that triggers this suppression).
// The scans stop at a `]`/`(`/newline (backwards) or `[`/newline
// (forwards) so a `[`/`]` from an unrelated earlier/later link is
// never combined into a phantom bracket (doc-34).
function insideLinkAttemptBracket(s, oPos, cPos) {
  let open = -1;
  for (let k = oPos - 1; k >= 0; k--) {
    const c = s[k];
    if (c === '[' && (k === 0 || s[k - 1] !== '\\')) { open = k; break; }
    if (c === ']' || c === '(' || c === '\n') break;
  }
  if (open === -1) return false;
  for (let k = cPos + 1; k < s.length; k++) {
    const c = s[k];
    if (c === ']' && s[k - 1] !== '\\') return s[k + 1] === '(';
    if (c === '[' || c === '\n') return false;
  }
  return false;
}

// True if the label text contains a mismatched backtick code span.
// An opener run pairs with the NEXT run of the same length;
// different-length runs between are code span content (e.g. the
// inner ` in `` `` a ` b `` ``). Mismatched when no same-length
// closer exists: either a different-length run follows (a failed
// close, e.g. `` ``and` ``) or it is a lone single backtick.
// A lone multi-backtick run does not count. Escaped backticks
// (\`) are literal text, not delimiters.
function labelTextHasMismatch(label) {
  const runs = [];
  let i = 0;
  while (i < label.length) {
    if (label[i] === '\\' && i + 1 < label.length && label[i + 1] === '`') { i += 2; continue; }
    if (label[i] !== '`') { i++; continue; }
    let j = i;
    while (j < label.length && label[j] === '`') j++;
    runs.push(j - i);
    i = j;
  }
  let k = 0;
  while (k < runs.length) {
    const len = runs[k];
    let m = k + 1;
    while (m < runs.length && runs[m] !== len) m++;
    if (m < runs.length) { k = m + 1; continue; }
    if (m > k + 1) return true;
    return len === 1;
  }
  return false;
}

// True if some `[...]` label in s[0..pos] contains a mismatched
// backtick code span.
function hasMismatchedLabelCodespanBefore(s, pos) {
  for (let k = 0; k < pos; k++) {
    if (s[k] !== '[' || (k > 0 && s[k - 1] === '\\')) continue;
    // Find the label's closing ] (next unescaped ]).
    let e = -1;
    for (let m = k + 1; m < pos; m++) {
      if (s[m] === ']' && s[m - 1] !== '\\') { e = m; break; }
      if (s[m] === '\n') break;
    }
    if (e === -1) continue;
    if (labelTextHasMismatch(s.slice(k + 1, e))) return true;
  }
  return false;
}

// Process emphasis delimiters in a node list (CommonMark algorithm:
// closers from the start, closest preceding opener, odd-match rule).
// Closers must be visited in order so an inner pair forms before an
// outer pair that shares its opener (cm-369/373).
function processEmphasis(nodes, delims, s) {
  // Source ranges of emphasis already formed. A delimiter inside such
  // a range cannot match a closer outside it (cm-470: a '*' inside a
  // strong must not pair with a '*' after it). Each range also records
  // whether it is a strong and the closer's original run length, for
  // the marked blocking rule below.
  const ranges = [];
  let cur = 0;
  while (cur < delims.length) {
    const closer = delims[cur];
    if (!closer || closer.len === 0 || !closer.canClose) { cur++; continue; }
    const ch = closer.ch;
    let opener = null;
    let openerIdx = -1;
    let useDelims = 0;
    for (let oi = cur - 1; oi >= 0; oi--) {
      const cand = delims[oi];
      if (cand && cand.len > 0 && cand.ch === ch) {
        // Skip a candidate trapped inside a formed emphasis while this
        // closer sits outside it.
        let trapped = false;
        for (const r of ranges) {
          if (r.oPos < cand.pos && cand.pos < r.cPos && !(r.oPos < closer.pos && closer.pos < r.cPos)) { trapped = true; break; }
        }
        if (trapped) continue;
        // Marked blocking rule (doc-01/07/11/29): a '*' opener must
        // not pair across a formed emphasis whose opener was preceded
        // by a space and whose closer is followed by a letter.
        // Three shapes: (a) a single '*' across a formed strong
        // (`*browser in so **change**in*` stays literal outside the
        // strong; it pairs when the strong's opener is preceded by a
        // letter, cm-411, or its closer is followed by a space);
        // (b) a single '*' closer taking one delim from a '**'
        // opener across a formed em (`**public as *so*other* option
        // html**` -> the `*` after "other" stays literal and the
        // outer '**' forms a strong); (c) the same taking across a
        // formed strong (doc-11: `**removes example *input
        // **parse**parse* release**`). A single '*' across a formed
        // em still pairs (`*a *b*c*`), and an '_' outer pair still
        // forms across the same shape (doc-05/31/33), so the rule
        // is '*' only and shape-specific. A '**' pair across a
        // formed em is NOT blocked here (`**a *b*c**` is a separate
        // marked quirk, left alone).
        if (ch === '*') {
          let blocked = false;
          for (const r of ranges) {
            if (cand.pos < r.oPos && r.cPos < closer.pos) {
              const before = r.oPos > 0 ? s[r.oPos - 1] : null;
              const after = r.cPos + r.cLen < s.length ? s[r.cPos + r.cLen] : null;
              const beforeWs = before === null || isUnicodeWs(before);
              const afterLetter = after !== null && /[\p{L}\p{N}]/u.test(after);
              if (!beforeWs || !afterLetter) continue;
              if (r.strong && cand.len === 1 && closer.len === 1) { blocked = true; break; }
              if (!r.strong && cand.len === 2 && closer.len === 1) { blocked = true; break; }
              if (r.strong && cand.len === 2 && closer.len === 1) { blocked = true; break; }
              if (r.strong && cand.len === 1 && closer.len === 2) { blocked = true; break; }
            }
          }
          if (blocked) continue;
        }
        const oddMatch = Math.min(cand.len, closer.len) === 1 && (cand.canClose || closer.canOpen) && ((cand.len + closer.len) % 3 === 0);
        if (cand.canOpen && !oddMatch) {
          opener = cand;
          openerIdx = oi;
          useDelims = (cand.len >= 2 && closer.len >= 2) ? 2 : 1;
          break;
        }
      }
    }
    if (!opener) { cur++; continue; }
    const nodeOi = nodes.indexOf(opener);
    const nodeCi = nodes.indexOf(closer);
    if (nodeOi === -1 || nodeCi === -1 || nodeOi >= nodeCi) { cur++; continue; }
    const closerOrigLen = closer.len;
    const children = nodes.slice(nodeOi + 1, nodeCi);
    // Marked suppression (doc-09/16/20/23/28): an em/strong whose
    // span contains a multi-backtick code span with an inner backtick
    // does NOT form when it sits inside a `[...]` immediately
    // followed by `(` (a link attempt). Marked's link-label pattern
    // cannot match such a label, and the failed attempt also blocks
    // the emphasis. A simple code span (`a`) or no parens lets it
    // form, so both conditions are required.
    if (hasInnerBacktickCode(children) && insideLinkAttemptBracket(s, opener.pos, closer.pos)) { cur++; continue; }
    // Marked suppression (doc-09/16/28/35): an em/strong is NOT
    // formed when an earlier `[...]` label in the same paragraph
    // contains a mismatched backtick code span AND there is any
    // backtick after the em. A matched code span in the label, or
    // no backtick after, lets it form. Emphasis only (* / _), not
    // strikethrough (~~).
    if ((ch === '*' || ch === '_') && hasMismatchedLabelCodespanBefore(s, opener.pos) && s.indexOf('`', closer.pos + 1) !== -1) { cur++; continue; }
    // Marked `***`-closer leftover (doc-11/30): when a strong closed
    // by a `***` run (leftover `*`) contains a formed emphasis whose
    // opener was preceded by whitespace and whose closer is followed
    // by a letter (`**return that *old*two***`, `**by command
    // *tool*one***`), the leftover `*` stays INSIDE the strong
    // (marked consumes the LAST 2 as the closer). Without such an
    // inner emphasis (`**foo***`, `**a *b* c***` where the inner
    // closer is followed by a space) the leftover stays outside.
    // This is the same beforeWs/afterLetter shape as the blocking
    // rule above, and marked's `f` counter (rule of 3) behind it.
    let leftoverInside = false;
    if (ch === '*' && useDelims === 2 && closer.len > useDelims) {
      for (const r of ranges) {
        if (opener.pos < r.oPos && r.cPos < closer.pos) {
          const before = r.oPos > 0 ? s[r.oPos - 1] : null;
          const after = r.cPos + r.cLen < s.length ? s[r.cPos + r.cLen] : null;
          const beforeWs = before === null || isUnicodeWs(before);
          const afterLetter = after !== null && /[\p{L}\p{N}]/u.test(after);
          if (beforeWs && afterLetter) { leftoverInside = true; break; }
        }
      }
    }
    if (leftoverInside) {
      children.push({ t: 'text', s: '*'.repeat(closer.len - useDelims) });
      closer.len = useDelims;
    }
    ranges.push({ oPos: opener.pos, cPos: closer.pos, strong: useDelims === 2, cLen: closerOrigLen });
    const tag = ch === '~' ? 'del' : (useDelims === 2 ? 'strong' : 'em');
    const emNode = { t: tag, children };
    opener.len -= useDelims;
    closer.len -= useDelims;
    const replacement = [];
    if (opener.len > 0) replacement.push(opener);
    replacement.push(emNode);
    if (closer.len > 0) replacement.push(closer);
    nodes.splice(nodeOi, nodeCi - nodeOi + 1, ...replacement);
    const openerRemoved = opener.len === 0;
    const closerRemoved = closer.len === 0;
    if (openerRemoved) delims.splice(openerIdx, 1);
    if (closerRemoved) {
      const closerIdxNow = cur - (openerRemoved ? 1 : 0);
      delims.splice(closerIdxNow, 1);
      cur = closerIdxNow;
    } else {
      // Closer remains: revisit it at its (possibly shifted) index so
      // it can match another opener (cm-409).
      cur = cur - (openerRemoved ? 1 : 0);
    }
  }
}

// Render a node list to HTML.
function renderInlineNodes(nodes) {
  let out = '';
  for (const node of nodes) {
    switch (node.t) {
      case 'text': out += escapeText(node.s); break;
      case 'raw': out += node.s; break;
      case 'code': out += '<code>' + escapeText(node.s) + '</code>'; break;
      case 'link': {
        out += '<a href="' + cleanUrl(node.href) + '"';
        if (node.title !== null && node.title !== undefined) out += ' title="' + escapeAttrKeepEntities(node.title) + '"';
        out += '>' + renderInlineNodes(node.children) + '</a>';
        break;
      }
      case 'image': {
        out += '<img src="' + cleanUrl(node.src) + '" alt="' + escapeAttrKeepEntities(node.alt) + '"';
        if (node.title !== null && node.title !== undefined) out += ' title="' + escapeAttrKeepEntities(node.title) + '"';
        out += '>';
        break;
      }
      case 'html': out += node.s; break;
      case 'br': out += '<br>'; break;
      case 'delim': out += escapeText(node.ch.repeat(node.len)); break;
      case 'em': out += '<em>' + renderInlineNodes(node.children) + '</em>'; break;
      case 'strong': out += '<strong>' + renderInlineNodes(node.children) + '</strong>'; break;
      case 'del': out += '<del>' + renderInlineNodes(node.children) + '</del>'; break;
    }
  }
  return out;
}

// Plain-text rendering of a node list (image alt text).
function plainTextNodes(nodes) {
  let out = '';
  for (const node of nodes) {
    switch (node.t) {
      case 'text': out += node.s; break;
      case 'raw': out += node.s; break;
      case 'code': out += node.s; break;
      case 'link': out += plainTextNodes(node.children); break;
      case 'image': out += node.alt; break;
      case 'em':
      case 'strong':
      case 'del': out += plainTextNodes(node.children); break;
      default: break;
    }
  }
  return out;
}

// Parse inline content into a node list. `extended` enables www/scheme/
// email autolinks (off inside link text).
// Update the document-level unclosed-<a> flag for an inline HTML tag.
// A qualifying <a ...> opening tag (with attributes or '/', not a bare
// <a>) that is followed by more non-whitespace content in the same
// block opens a link that marked never closes (its inLink state is
// global across blocks); a </a> closes it. While open, extended
// autolinks are not formed (verified: <a href="x"><img> and <a /><b>
// suppress all later www/scheme/email autolinks in the document; a
// bare <a>, a lone <a />, and a lone <a href="x"> do not).
function updateUnclosedA(tag, s, next, isInline) {
  if (tag[1] === '/') {
    const name = tag.slice(2).trimStart();
    if (name[0] === 'a' || name[0] === 'A') {
      const after = name[1];
      if (after === '>' || after === ' ' || after === '\t' || after === '\n' || after === undefined) {
        unclosedA = false;
      }
    }
    return;
  }
  if (tag[1] !== 'a' && tag[1] !== 'A') return;
  const c2 = tag[2];
  if (c2 !== ' ' && c2 !== '\t' && c2 !== '\n' && c2 !== '>' && c2 !== '/') return;
  let j = 2;
  while (j < tag.length && (tag[j] === ' ' || tag[j] === '\t' || tag[j] === '\n')) j++;
  if (j >= tag.length || tag[j] === '>') return;
  // <a/> (slash tight against the name, no space) is a self-closing
  // tag that does not open a link; <a /> (space before the slash)
  // is treated as an opening tag (verified: <a/><b> links later
  // autolinks, <a /><b> suppresses them).
  if (tag[j] === '/' && tag[j + 1] === '>' && j === 2) return;
  // A tag that spans lines (contains a newline) opens a link that
  // marked never closes, even when it is alone in its paragraph
  // (verified: <a href="foo\nbar"> alone suppresses later autolinks,
  // while a single-line <a href="foo"> alone does not).
  if (tag.includes('\n')) { unclosedA = true; return; }
  // An inline <a> (inside a paragraph, e.g. `foo <a href="\*">` at
  // the end of its paragraph) always opens a link in marked's
  // inLink state, even with no content after it in this paragraph
  // (doc-03). Only an <a> alone as an HTML block needs content
  // after it in the block to count.
  if (isInline) { unclosedA = true; return; }
  for (let k = next; k < s.length; k++) {
    const ch = s[k];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') { unclosedA = true; return; }
  }
}

// Scan raw HTML-block text for <a ...> / </a> tags and update the
// document-level unclosed-<a> flag (marked's inLink state also reacts
// to <a> tags inside HTML blocks, e.g. a <div> block containing an
// unclosed <a href="..."><img ...> suppresses later autolinks).
function scanHtmlForA(text) {
  // Block-local depth: a closed <a>...</a> pair inside this HTML block
  // must not touch the document-level flag (doc-03: a
  // <p><a href="..."><img ...></a></p> block must not clear an
  // unclosed <a> from an earlier paragraph, which still suppresses
  // later autolinks). Only a net-unclosed <a> in this block sets the
  // flag, and only a </a> with no matching <a> in this block clears
  // it. The "counts as open" rules mirror updateUnclosedA (not
  // <a/>, multiline tag, or content after the tag in this block).
  let localDepth = 0;
  let strayClose = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] === '<') {
      const tag = matchInlineHtml(text, i);
      if (tag) {
        const t = tag.html;
        if (t[1] === '/') {
          const name = t.slice(2).trimStart();
          if (name[0] === 'a' || name[0] === 'A') {
            const after = name[1];
            if (after === '>' || after === ' ' || after === '\t' || after === '\n' || after === undefined) {
              if (localDepth > 0) localDepth--;
              else strayClose = true;
            }
          }
        } else if (t[1] === 'a' || t[1] === 'A') {
          const c2 = t[2];
          if (c2 === ' ' || c2 === '\t' || c2 === '\n' || c2 === '>' || c2 === '/') {
            let j = 2;
            while (j < t.length && (t[j] === ' ' || t[j] === '\t' || t[j] === '\n')) j++;
            if (j < t.length && t[j] !== '>') {
              if (!(t[j] === '/' && t[j + 1] === '>' && j === 2)) {
                if (t.includes('\n')) {
                  localDepth++;
                } else {
                  let hasContent = false;
                  for (let k = tag.next; k < text.length; k++) {
                    const ch = text[k];
                    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') { hasContent = true; break; }
                  }
                  if (hasContent) localDepth++;
                }
              }
            }
          }
        }
        i = tag.next;
        continue;
      }
    }
    i++;
  }
  if (localDepth > 0) unclosedA = true;
  else if (strayClose) unclosedA = false;
}

function inlineNodes(s, refs, extended) {
  const nodes = [];
  const delims = [];
  let i = 0;
  const n = s.length;
  let textBuf = '';
  // Count of '_' delimiters with canOpen pushed so far: whether an
  // unmatched '_' opener precedes the current position (used by the
  // bare-email trailing-'__' rule). Maintained incrementally instead
  // of rescanning `delims` at every character.
  let openUnderscore = 0;
  // hasOpenUnderscore at the last bare-email attempt inside the
  // current maximal run of email-local chars (null: no attempt yet
  // in this run). An email can only start at a run start, or right
  // after a '_' (where a pushed '_' delimiter may have flipped
  // hasOpenUnderscore since the run's first attempt); attempting at
  // every other position re-scans the same word for '@' and is
  // quadratic in word length.
  // forceAttempt: the previous loop step consumed text ending in a
  // local char, so the run the next position belongs to was never
  // attempted at its first position — the next position must attempt
  // (its previous char is local, so the plain gate would wrongly
  // skip it). Two causes: a backslash escape of a local char
  // (e.g. `\_`; the backslash itself breaks the run, so an escaped
  // local char always starts a run), and an extended autolink match
  // (www/scheme/email), which ends in an alphanumeric while the raw
  // run can continue past it (e.g. `xmpp:a@b.org...c@d.e`).
  let emailRunHasOpen = null;
  let forceAttempt = false;
  const flush = () => { if (textBuf) { nodes.push({ t: 'text', s: textBuf }); textBuf = ''; } };
  const push = (node) => { flush(); nodes.push(node); };

  while (i < n) {
    const c = s[i];
    const wasForced = forceAttempt;
    forceAttempt = false;
    // Fast path: ASCII alphanumerics and '.', '+', '-' can never be a
    // special inline construct (escape, code, link, html, break,
    // entity, emphasis, strikethrough).
    const cc = c.charCodeAt(0);
    if ((CC[cc] & 3) !== 0) {
      // Alphanumeric run: scan it whole in a tight loop and append it
      // as one slice instead of one cons-string per character. During
      // the scan, record the first mid-run autolink candidates (a
      // scheme at an h/f, a mailto:/xmpp: prefix at an m/x); they are
      // the only matches that can start inside a run, since every
      // other mid-run position is gated out (previous char is local,
      // and no '_' delimiter can occur inside a run).
      let j = i + 1;
      let midSchemePos = -1, midSchemeLen = 0, midMailPos = -1;
      while (j < n) {
        const d = s.charCodeAt(j);
        if ((CC[d] & 3) === 0) break;
        if (extended && !unclosedA) {
          if (midSchemePos === -1 && (d === 104 || d === 72 || d === 102 || d === 70)) {
            const sc = schemeAt(s, j);
            if (sc) {
              const f = s[j + sc.length];
              if (f && (isAlnum(f) || f === '_' || f === '-')) { midSchemePos = j; midSchemeLen = sc.length; }
            }
          }
          if (midMailPos === -1 && (d === 109 || d === 120)) {
            if ((d === 109 && s[j + 1] === 'a' && s.startsWith('mailto:', j)) ||
                (d === 120 && s[j + 1] === 'm' && s.startsWith('xmpp:', j))) midMailPos = j;
          }
        }
        j++;
      }
      if (extended && !unclosedA) {
        const hasOpenUnderscore = openUnderscore > 0;
        let al = null;
        if (c === 'w' && s[i + 1] === 'w' && s[i + 2] === 'w' && s[i + 3] === '.') {
          const prev = i === 0 ? '' : s[i - 1];
          if (i === 0 || isSpace(prev) || prev === '*' || prev === '_' || prev === '~' || prev === '(') {
            const first = s[i + 4];
            if (first && (isAlnum(first) || first === '-')) {
              const end = scanUrlEnd(s, i);
              const url = trimUrl(s.slice(i, end), 4);
              al = { href: 'http://' + url, text: url, next: i + url.length };
            }
          }
        } else if (c === 'h' || c === 'H' || c === 'f' || c === 'F') {
          const scheme = schemeAt(s, i);
          if (scheme) {
            const first = s[i + scheme.length];
            if (first && (isAlnum(first) || first === '_' || first === '-')) {
              const end = scanUrlEnd(s, i);
              const url = trimUrl(s.slice(i, end), scheme.length);
              al = { href: url, text: url, next: i + url.length };
            }
          }
        }
        if (!al) {
          const prevLocal = i > 0 && isEmailLocal(s[i - 1]);
          if (!prevLocal || wasForced || (s[i - 1] === '_' && emailRunHasOpen !== hasOpenUnderscore) ||
              (c === 'm' && s[i + 1] === 'a' && s.startsWith('mailto:', i)) ||
              (c === 'x' && s[i + 1] === 'm' && s.startsWith('xmpp:', i))) {
            al = matchBareEmail(s, i, hasOpenUnderscore);
            emailRunHasOpen = hasOpenUnderscore;
          }
        }
        if (al) {
          push({ t: 'link', href: al.href, title: null, children: [{ t: 'text', s: al.text }] });
          forceAttempt = true;
          i = al.next;
          continue;
        }
        // Mid-run candidates, earliest first.
        if (midMailPos !== -1 && (midSchemePos === -1 || midMailPos < midSchemePos)) {
          const mal = matchBareEmail(s, midMailPos, hasOpenUnderscore);
          emailRunHasOpen = hasOpenUnderscore;
          if (mal) {
            textBuf += s.slice(i, midMailPos);
            push({ t: 'link', href: mal.href, title: null, children: [{ t: 'text', s: mal.text }] });
            forceAttempt = true;
            i = mal.next;
            continue;
          }
          // Failed: fall back to the per-character loop from the
          // candidate position (it re-attempts, fails, and moves on).
          textBuf += s.slice(i, midMailPos);
          i = midMailPos;
          continue;
        }
        if (midSchemePos !== -1) {
          const end = scanUrlEnd(s, midSchemePos);
          const url = trimUrl(s.slice(midSchemePos, end), midSchemeLen);
          textBuf += s.slice(i, midSchemePos);
          push({ t: 'link', href: url, title: null, children: [{ t: 'text', s: url }] });
          forceAttempt = true;
          i = midSchemePos + url.length;
          continue;
        }
      }
      textBuf += s.slice(i, j);
      i = j;
      continue;
    }
    if (c === '.' || c === '+' || c === '-') {
      if (extended && !unclosedA) {
        const hasOpenUnderscore = openUnderscore > 0;
        const prevLocal = i > 0 && isEmailLocal(s[i - 1]);
        if (!prevLocal || wasForced || (s[i - 1] === '_' && emailRunHasOpen !== hasOpenUnderscore)) {
          const al = matchBareEmail(s, i, hasOpenUnderscore);
          emailRunHasOpen = hasOpenUnderscore;
          if (al) {
            push({ t: 'link', href: al.href, title: null, children: [{ t: 'text', s: al.text }] });
            forceAttempt = true;
            i = al.next;
            continue;
          }
        }
      }
      textBuf += c;
      i++;
      continue;
    }
    if (c === '\\' && i + 1 < n && isAsciiPunct(s[i + 1])) {
      // An escaped local char starts a run that is never attempted at
      // its own position; the next position must attempt instead.
      forceAttempt = isEmailLocal(s[i + 1]);
      textBuf += s[i + 1];
      i += 2;
      continue;
    }
    if (c === '`') {
      const cs = matchCodeSpan(s, i);
      if (cs) { push({ t: 'code', s: cs.text }); i = cs.next; continue; }
      // No matching closer: the whole backtick run is literal text
      // (cm-347: do not retry inside the run).
      let len = 0;
      while (i + len < n && s[i + len] === '`') len++;
      textBuf += s.slice(i, i + len);
      i += len;
      continue;
    }
    if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const link = tryLink(s, i, refs, extended);
      if (link) { push(link.node); i = link.next; continue; }
      textBuf += c; i++; continue;
    }
    if (c === '<') {
      const al = matchAngleAutolink(s, i);
      if (al) {
        // Angle autolinks stay on inside link text and form nested
        // links (probe: [<http://foo>](http://bar)); mark them so
        // containsLink ignores them.
        push({ t: 'link', href: al.href, title: null, autolink: true, children: [{ t: 'text', s: al.text }] });
        i = al.next;
        continue;
      }
      const html = matchInlineHtml(s, i);
      if (html) { updateUnclosedA(html.html, s, html.next, true); push({ t: 'html', s: html.html }); i = html.next; continue; }
      textBuf += c; i++; continue;
    }
    if (c === '\\' && i + 1 < n && s[i + 1] === '\n') {
      push({ t: 'br' });
      i += 2;
      // Leading whitespace on the next line is stripped after a hard
      // break (cm-636/637).
      while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
      continue;
    }
    if (c === '\n') {
      // Trailing whitespace at the end of the line: 2+ trailing spaces
      // make a hard break (and are consumed); a single trailing space
      // is content and is kept (cm-556/587). Trailing tabs are stripped.
      let k = textBuf.length - 1;
      while (k >= 0 && textBuf[k] === '\t') k--;
      let sp = k;
      while (sp >= 0 && textBuf[sp] === ' ') sp--;
      const spaces = k - sp;
      if (spaces >= 2) {
        textBuf = textBuf.slice(0, sp + 1);
        push({ t: 'br' });
        i++;
        // Leading whitespace on the next line is stripped after a hard
        // break (cm-636/637).
        while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
      } else {
        textBuf = textBuf.slice(0, k + 1) + '\n';
        i++;
      }
      continue;
    }
    if (c === '&') {
      // Numeric entity: decoded to its character. Named-entity-like
      // &[A-Za-z0-9_]+; : kept verbatim as a raw node. Anything else is a
      // literal '&' (escaped to &amp; at render time).
      const num = decodeNumericEntityAt(s, i);
      if (num) { textBuf += num[0]; i = num[1]; continue; }
      let j = i + 1;
      while (j < n && (isAlnum(s[j]) || s[j] === '_')) j++;
      if (j > i + 1 && j < n && s[j] === ';') {
        flush();
        nodes.push({ t: 'raw', s: s.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      textBuf += c; i++; continue;
    }
    if (c === '*' || c === '_') {
      const run = runLen(s, i, c);
      const canOpen = canOpenDelim(s, i, run, c);
      const canClose = canCloseDelim(s, i, run, c);
      if (canOpen || canClose) {
        flush();
        const d = { t: 'delim', ch: c, len: run, pos: i, canOpen, canClose };
        nodes.push(d);
        delims.push(d);
        if (c === '_' && canOpen) openUnderscore++;
        i += run;
        continue;
      }
      textBuf += s.slice(i, i + run);
      i += run;
      continue;
    }
    if (c === '~') {
      const run = runLen(s, i, '~');
      // Strikethrough uses runs of 1-2 tildes (gfm-491: single ~ works);
      // a run of 3+ never forms <del> (gfm-493: ~~~not~~~ is literal).
      const canOpen = canOpenDelim(s, i, run, '~');
      const canClose = canCloseDelim(s, i, run, '~');
      if (run <= 2 && (canOpen || canClose)) {
        flush();
        const d = { t: 'delim', ch: '~', len: run, pos: i, canOpen, canClose };
        nodes.push(d);
        delims.push(d);
        i += run;
        continue;
      }
      textBuf += s.slice(i, i + run);
      i += run;
      continue;
    }
    if (extended && !unclosedA) {
      // Extended autolinks, attempted only where one can start:
      // www. (c === 'w'), scheme (h/H/f/F), or a bare email. A bare
      // email can only start at a local run's start, right after a
      // '_' (a pushed '_' delimiter may have flipped
      // hasOpenUnderscore since the run's first attempt), or at a
      // mailto:/xmpp: prefix starting mid-word. Every other position
      // re-scans the same word for '@' with the same outcome.
      let al = null;
      if (c === 'w' && s[i + 1] === 'w' && s[i + 2] === 'w' && s[i + 3] === '.') {
        const prev = i === 0 ? '' : s[i - 1];
        if (i === 0 || isSpace(prev) || prev === '*' || prev === '_' || prev === '~' || prev === '(') {
          const first = s[i + 4];
          if (first && (isAlnum(first) || first === '-')) {
            const end = scanUrlEnd(s, i);
            const url = trimUrl(s.slice(i, end), 4);
            al = { href: 'http://' + url, text: url, next: i + url.length };
          }
        }
      } else if (c === 'h' || c === 'H' || c === 'f' || c === 'F') {
        const scheme = schemeAt(s, i);
        if (scheme) {
          const first = s[i + scheme.length];
          if (first && (isAlnum(first) || first === '_' || first === '-')) {
            const end = scanUrlEnd(s, i);
            const url = trimUrl(s.slice(i, end), scheme.length);
            al = { href: url, text: url, next: i + url.length };
          }
        }
      }
      if (!al) {
        const hasOpenUnderscore = openUnderscore > 0;
        const prevLocal = i > 0 && isEmailLocal(s[i - 1]);
        if (!prevLocal || (s[i - 1] === '_' && emailRunHasOpen !== hasOpenUnderscore) ||
            (c === 'm' && s[i + 1] === 'a' && s.startsWith('mailto:', i)) ||
            (c === 'x' && s[i + 1] === 'm' && s.startsWith('xmpp:', i))) {
          al = matchBareEmail(s, i, hasOpenUnderscore);
          emailRunHasOpen = hasOpenUnderscore;
        }
      }
      if (al) {
        push({ t: 'link', href: al.href, title: null, children: [{ t: 'text', s: al.text }] });
        forceAttempt = true;
        i = al.next;
        continue;
      }
    }
    textBuf += c;
    i++;
  }
  flush();
  processEmphasis(nodes, delims, s);
  return nodes;
}

// Parse inline content to HTML.
function inlineParse(s, refs, extended) {
  return renderInlineNodes(inlineNodes(s, refs, extended));
}
