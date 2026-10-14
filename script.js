/*
 * PocketSci — a pocket scientific calculator for the browser.
 * Engine: AOS (Algebraic Operating System) with 4 pending operations,
 * 15 open parentheses, 10-digit display and a 2-digit exponent.
 */
'use strict';

(function () {
  /* ================================================================
   * Number core
   * ================================================================ */
  class CalcError extends Error {}
  const fail = () => { throw new CalcError('Error'); };

  const MAXV = 9.9999999995e99;
  const FB = '\u231F'; // fraction bar      (3⌟4)
  const UB = '\u231E'; // unit separator    (2⌞1⌟4)

  function clean(v) {
    if (!Number.isFinite(v)) fail();
    if (v === 0) return 0;
    const r = Number(v.toPrecision(13));
    if (Math.abs(r) >= MAXV) fail();
    if (Math.abs(r) < 1e-99) return 0;
    return r;
  }

  const num = (v) => ({ v: clean(v), f: null, view: null });

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }
  const nd = (n) => String(Math.abs(n)).length;

  // Builds a simplified fraction value. Falls back to a decimal when the
  // fraction cannot be shown (denominator > 999 or more than 10 digits).
  function makeFrac(n, d, view) {
    if (d === 0) fail();
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    n /= g; d /= g;
    if (d === 1) return num(n);
    const w = Math.floor(Math.abs(n) / d);
    const r = Math.abs(n) % d;
    if (d > 999 || (w ? nd(w) : 0) + nd(r) + nd(d) > 10) return num(n / d);
    return { v: clean(n / d), f: { n, d }, view: view || 'mixed' };
  }

  const ratOf = (a) => a.f ? a.f
    : (Number.isInteger(a.v) && Math.abs(a.v) <= 1e12 ? { n: a.v, d: 1 } : null);

  function binary(a, op, b) {
    // Fraction arithmetic stays exact when one side is a fraction
    // and the other is a fraction or an integer.
    if ((a.f || b.f) && (op === '+' || op === '-' || op === '*' || op === '/')) {
      const p = ratOf(a), q = ratOf(b);
      if (p && q) {
        let n, d;
        if (op === '+') { n = p.n * q.d + q.n * p.d; d = p.d * q.d; }
        else if (op === '-') { n = p.n * q.d - q.n * p.d; d = p.d * q.d; }
        else if (op === '*') { n = p.n * q.n; d = p.d * q.d; }
        else { if (q.n === 0) fail(); n = p.n * q.d; d = p.d * q.n; }
        if (Number.isSafeInteger(n) && Number.isSafeInteger(d)) return makeFrac(n, d, 'mixed');
      }
    }
    const x = a.v, y = b.v;
    switch (op) {
      case '+': return num(x + y);
      case '-': return num(x - y);
      case '*': return num(x * y);
      case '/': if (y === 0) fail(); return num(x / y);
      case 'pow': return num(power(x, y));
      case 'root': return num(root(x, y));
      case 'nCr': return num(arrangements(x, y, true));
      case 'nPr': return num(arrangements(x, y, false));
    }
    return fail();
  }

  function power(y, x) {
    if (y === 0 && x <= 0) fail();
    if (y < 0 && !Number.isInteger(x)) fail();
    return Math.pow(y, x);
  }

  // x-th root of y
  function root(y, x) {
    if (x === 0) fail();
    if (y < 0) {
      if (!(Number.isInteger(x) && Math.abs(x) % 2 === 1)) fail();
      return -Math.pow(-y, 1 / x);
    }
    if (y === 0 && x < 0) fail();
    return Math.pow(y, 1 / x);
  }

  function arrangements(n, r, combine) {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) fail();
    if (r > n) return 0;
    let res = 1;
    if (combine) {
      r = Math.min(r, n - r);
      for (let i = 1; i <= r; i++) {
        res = res * (n - r + i) / i;
        if (res >= MAXV) fail();
      }
    } else {
      for (let i = 0; i < r; i++) {
        res *= (n - i);
        if (res >= MAXV) fail();
      }
    }
    return res < 9e15 ? Math.round(res) : res;
  }

  function factorial(v) {
    if (!Number.isInteger(v) || v < 0 || v > 69) fail();
    let r = 1;
    for (let i = 2; i <= v; i++) r *= i;
    return r;
  }

  /* ================================================================
   * Angles
   * ================================================================ */
  const ANG = { DEG: Math.PI / 180, RAD: 1, GRAD: Math.PI / 200 };
  const NEXT_ANGLE = { DEG: 'RAD', RAD: 'GRAD', GRAD: 'DEG' };
  const DRG_CONV = { DEG: Math.PI / 180, RAD: 200 / Math.PI, GRAD: 0.9 };

  function trig(fn, v) {
    let a = v;
    if (S.angle !== 'RAD') {
      const full = S.angle === 'DEG' ? 360 : 400;
      const q = full / 4;
      const red = ((v % full) + full) % full;
      if (red % q === 0) {
        const k = red / q;
        if (fn === 'sin') return [0, 1, 0, -1][k];
        if (fn === 'cos') return [1, 0, -1, 0][k];
        if (k % 2) fail();
        return 0;
      }
      a = red * ANG[S.angle];
    }
    // The input carries ~13 significant digits, so anything below that
    // resolution near a zero crossing is a true zero (sin π = 0, tan 90° = Error).
    const eps = Math.max(1e-15, Math.abs(a) * 1e-12);
    if (fn === 'tan' && Math.abs(Math.cos(a)) < eps) fail();
    const r = Math[fn](a);
    return Math.abs(r) < eps ? 0 : r;
  }

  // D.MMSSs  ->  decimal degrees
  function dmsToDd(v) {
    const a = Math.abs(Number(v.toPrecision(10)));
    if (a >= 1e7) fail();
    const [ip, fp = ''] = a.toFixed(10).split('.');
    const mm = Number(fp.slice(0, 2));
    const ss = Number(fp.slice(2, 4) + '.' + fp.slice(4));
    const r = Number(ip) + mm / 60 + ss / 3600;
    return v < 0 ? -r : r;
  }

  // decimal degrees  ->  D°MM'SS"s   (display only)
  function ddToDms(v) {
    const a = Math.abs(v);
    if (a >= 1e7) fail();
    let d = Math.floor(a);
    const mf = (a - d) * 60;
    let m = Math.floor(mf);
    const fd = Math.max(0, 6 - String(d).length);
    let s = roundTo((mf - m) * 60, fd);
    if (s >= 60) { s -= 60; m += 1; }
    if (m >= 60) { m -= 60; d += 1; }
    let [si, sf = ''] = s.toFixed(fd).split('.');
    sf = sf.replace(/0+$/, '');
    if (fd > 0 && sf === '') sf = '0';
    return (v < 0 ? '-' : '') + d + '°' + String(m).padStart(2, '0') + "'" + si.padStart(2, '0') + '"' + sf;
  }

  // Decimal -> fraction with a denominator up to 999 (for F◂▸D)
  function toFraction(v) {
    if (Number.isInteger(v) || Math.abs(v) >= 1e6) return null;
    const sign = Math.sign(v), a = Math.abs(v);
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, b = a;
    for (let i = 0; i < 24; i++) {
      const ai = Math.floor(b);
      const h2 = ai * h1 + h0, k2 = ai * k1 + k0;
      if (k2 > 999) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(a - h1 / k1) <= a * 1e-10) return { n: sign * h1, d: k1 };
      const rest = b - ai;
      if (rest === 0) break;
      b = 1 / rest;
    }
    return null;
  }

  /* ================================================================
   * Display formatting
   * ================================================================ */
  function roundTo(a, d) {
    if (a === 0) return 0;
    const [m, e] = a.toExponential(14).split('e');
    return Number(Math.round(Number(m + 'e' + (Number(e) + d))) + 'e' + (-d));
  }
  const digitCount = (s) => (s.match(/\d/g) || []).length;
  const withDot = (s) => (s.includes('.') ? s : s + '.');
  const trimZeros = (s) => (s.includes('.') ? s.replace(/0+$/, '') : s);
  const fmtExp = (e) => (e < 0 ? '-' : '') + String(Math.abs(e)).padStart(2, '0');
  const splitExp = (a) => a.toExponential(14).split('e').map(Number);

  function fmtFloat(a) {
    if (a >= 9999999999.5) return null;
    const intDigits = a >= 1 ? String(Math.floor(a)).length : 1;
    if (S.fix === null) {
      const dec = 10 - intDigits;
      const rv = roundTo(a, dec);
      if (rv === 0) return null;
      // very small numbers that lose digits switch to scientific notation
      if (a < 1e-3 && Math.abs(rv - a) > a * 1e-11) return null;
      const s = withDot(trimZeros(rv.toFixed(dec)));
      return digitCount(s) > 10 ? null : { m: s, e: null };
    }
    const dec = Math.max(0, Math.min(S.fix, 10 - intDigits));
    const s = withDot(roundTo(a, dec).toFixed(dec));
    return digitCount(s) > 10 ? null : { m: s, e: null };
  }

  function fmtSci(a) {
    let [m, e] = splitExp(a);
    const dec = S.fix === null ? 9 : Math.min(S.fix, 9);
    let r = roundTo(m, dec);
    if (r >= 10) { r /= 10; e += 1; }
    const s = r.toFixed(dec);
    return { m: withDot(S.fix === null ? trimZeros(s) : s), e: fmtExp(e) };
  }

  function fmtEng(a) {
    const [m, e] = splitExp(a);
    let e3 = Math.floor(e / 3) * 3;
    const mm = m * Math.pow(10, e - e3);
    const intD = String(Math.floor(mm)).length;
    let dec = S.fix === null ? 10 - intD : Math.min(S.fix, 10 - intD);
    let r = roundTo(mm, dec);
    if (r >= 1000) {
      r = 1; e3 += 3;
      dec = S.fix === null ? 9 : Math.min(S.fix, 9);
    }
    const s = r.toFixed(dec);
    return { m: withDot(S.fix === null ? trimZeros(s) : s), e: fmtExp(e3) };
  }

  function fmtDec(v) {
    if (v === 0) {
      if (S.notation === 'FLO' && S.fix !== null) return { m: withDot((0).toFixed(S.fix)), e: null };
      return { m: '0.', e: null };
    }
    const a = Math.abs(v);
    let r;
    if (S.notation === 'SCI') r = fmtSci(a);
    else if (S.notation === 'ENG') r = fmtEng(a);
    else r = fmtFloat(a) || fmtSci(a);
    return v < 0 ? { m: '-' + r.m, e: r.e } : r;
  }

  function fmtVal(x) {
    if (x.f && x.view !== 'dec') {
      const { n, d } = x.f;
      const an = Math.abs(n);
      const w = Math.floor(an / d), r = an % d;
      let s;
      if (x.view === 'imp' && nd(an) + nd(d) <= 10) s = an + FB + d;
      else s = w ? w + UB + r + FB + d : r + FB + d;
      return { m: (n < 0 ? '-' : '') + s, e: null };
    }
    return fmtDec(x.v);
  }

  // Plain text version of a value (history)
  function plain(x) {
    const { m, e } = fmtVal(x);
    let s = m.endsWith('.') ? m.slice(0, -1) : m;
    if (e) s += 'E' + Number(e);
    return s;
  }

  /* ================================================================
   * State
   * ================================================================ */
  let S;

  function newState() {
    return {
      x: num(0),            // displayed value
      t: num(0),            // x⇌y register (coordinates)
      entry: null,          // number being typed
      stack: [],            // pending operations and parentheses
      second: false,
      hyp: false,
      angle: 'DEG',
      notation: 'FLO',
      fix: null,
      mem: [null, num(0), num(0), num(0)],
      stat: { n: 0, sx: 0, sx2: 0 },
      K: null,              // constant { op, operand }
      error: false,
      await: null,          // STO / RCL / SUM / EXC / FIX waiting for a digit
      frq: null,            // data value waiting for its frequency
      view: null,           // temporary display (DMS, n=, x/r indicator)
      lastOp: false,
      lastCE: false,
      ex: { frames: [''], cur: '', dirty: false }, // expression text for history
      history: [],
    };
  }
  S = newState();

  function reset() {
    const h = S.history;
    S = newState();
    S.history = h;
  }

  function fullClear() {
    S.entry = null;
    S.x = num(0);
    S.stack = [];
    S.K = null;
    S.error = false;
    S.await = null;
    S.frq = null;
    S.ex = { frames: [''], cur: '', dirty: false };
  }

  function setError() {
    S.error = true;
    S.entry = null;
    S.stack = [];
    S.K = null;
    S.await = null;
    S.frq = null;
    S.ex = { frames: [''], cur: '', dirty: false };
  }

  /* ================================================================
   * Expression text (for the history panel)
   * ================================================================ */
  const simpleRe = new RegExp('^-?[0-9.]+(E-?[0-9]+)?$|^-?[0-9]+([' + UB + FB + '][0-9]+)+$|^π$');
  const posNumRe = /^[0-9.]+(E-?[0-9]+)?$|^π$/;

  function isWrapped(t) {
    if (!t.startsWith('(') || !t.endsWith(')')) return false;
    let depth = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') { depth--; if (depth === 0 && i < t.length - 1) return false; }
    }
    return true;
  }
  const wrap = (t) => (simpleRe.test(t) || isWrapped(t) ? t : '(' + t + ')');
  const wrapP = (t) => (posNumRe.test(t) || isWrapped(t) ? t : '(' + t + ')');
  const call = (name, t) => name + (isWrapped(t) ? t : '(' + t + ')');

  const FT = {
    sin: (t) => call('sin', t), cos: (t) => call('cos', t), tan: (t) => call('tan', t),
    asin: (t) => call('sin⁻¹', t), acos: (t) => call('cos⁻¹', t), atan: (t) => call('tan⁻¹', t),
    sinh: (t) => call('sinh', t), cosh: (t) => call('cosh', t), tanh: (t) => call('tanh', t),
    asinh: (t) => call('sinh⁻¹', t), acosh: (t) => call('cosh⁻¹', t), atanh: (t) => call('tanh⁻¹', t),
    log: (t) => call('log', t), ln: (t) => call('ln', t),
    tenx: (t) => '10^' + wrap(t), ex: (t) => 'e^' + wrap(t),
    sq: (t) => wrapP(t) + '²', cube: (t) => wrapP(t) + '³',
    sqrt: (t) => '√' + wrap(t), cbrt: (t) => '∛' + wrap(t),
    inv: (t) => '1/' + wrap(t), fact: (t) => wrapP(t) + '!', pct: (t) => wrapP(t) + '%',
    dms2dd: (t) => wrap(t) + '▸DD',
  };

  const curT = () => S.ex.cur || plain(S.x);

  function addHistory(expr, x, res) {
    S.history.unshift({ expr, x, res });
    if (S.history.length > 200) S.history.pop();
    if (hooks.onHistory) hooks.onHistory();
  }

  /* ================================================================
   * Number entry
   * ================================================================ */
  function newEntry() {
    S.entry = { parts: [''], neg: false, exp: null, expNeg: false };
    return S.entry;
  }

  function inputDigit(d) {
    const en = S.entry || newEntry();
    if (en.exp !== null) { en.exp = (en.exp + d).slice(-2); return; }
    const i = en.parts.length - 1;
    const p = en.parts[i];
    if (en.parts.length === 1) { if (digitCount(p) >= 10) return; }
    else if (en.parts.length === 2) { if (p.length >= 3) return; }
    else if (p.length >= 3 || digitCount(en.parts.join('')) >= 8) return;
    en.parts[i] = p === '' || p === '0' ? d : p + d;
  }

  function inputDot() {
    const en = S.entry || newEntry();
    if (en.exp !== null || en.parts.length > 1) return;
    const p = en.parts[0];
    if (p.includes('.') || digitCount(p) >= 10) return;
    en.parts[0] = (p === '' ? '0' : p) + '.';
  }

  function inputEE() {
    let en = S.entry;
    if (!en) { en = newEntry(); en.parts[0] = '1'; }
    if (en.exp !== null || en.parts.length > 1) return;
    en.exp = '';
  }

  function backspace() {
    const en = S.entry;
    if (!en) return;
    if (en.exp !== null) {
      if (en.exp.length) en.exp = en.exp.slice(0, -1);
      else { en.exp = null; en.expNeg = false; }
      return;
    }
    const i = en.parts.length - 1;
    if (en.parts[i].length) en.parts[i] = en.parts[i].slice(0, -1);
    else if (i > 0) en.parts.pop();
  }

  // a b/c key while typing: b⌟c (b ≤ 6 digits, c ≤ 3) or a⌞b⌟c (3 digits each, 8 total)
  function fracKey() {
    const en = S.entry;
    if (!en || en.exp !== null) return;
    const p = en.parts;
    if (p.length === 1) {
      if (p[0] === '' || p[0].includes('.') || p[0].length > 6) return;
      p.push('');
    } else if (p.length === 2) {
      if (p[1] === '' || p[0].length > 3 || p[1].length > 3) return;
      p.push('');
    }
  }

  function entryShow(en) {
    const p = en.parts;
    let m;
    if (p.length === 1) m = p[0] || '0';
    else if (p.length === 2) m = p[0] + FB + p[1];
    else m = p[0] + UB + p[1] + FB + p[2];
    if (en.neg) m = '-' + m;
    const e = en.exp === null ? null : (en.expNeg ? '-' : '') + en.exp.padStart(2, '0');
    return { m, e };
  }

  function entryPlain(en) {
    let s = entryShow(en).m;
    if (s.endsWith('.')) s = s.slice(0, -1);
    if (en.exp !== null) s += 'E' + (en.expNeg ? '-' : '') + Number(en.exp || 0);
    return s;
  }

  function entryVal(en) {
    const p = en.parts;
    if (p.length === 1) {
      let s = p[0] || '0';
      if (en.exp !== null) s += 'e' + (en.expNeg ? '-' : '') + (en.exp || '0');
      const v = Number(s);
      return num(en.neg ? -v : v);
    }
    if (p.some((s) => s === '')) fail();
    const w = p.length === 3 ? Number(p[0]) : 0;
    const n = Number(p[p.length - 2]);
    const d = Number(p[p.length - 1]);
    if (d === 0) fail();
    const total = w * d + n;
    return makeFrac(en.neg ? -total : total, d, p.length === 2 ? 'imp' : 'mixed');
  }

  function finalizeEntry() {
    if (!S.entry) return;
    const en = S.entry;
    S.entry = null;
    S.ex.cur = entryPlain(en);
    S.x = entryVal(en);
  }

  function setValue(x, label) {
    S.entry = null;
    S.x = x;
    S.ex.cur = label === undefined ? plain(x) : label;
  }

  function negate() {
    const en = S.entry;
    if (en) {
      if (en.exp !== null) en.expNeg = !en.expNeg;
      else en.neg = !en.neg;
      return;
    }
    const t = curT();
    const x = S.x;
    S.x = x.f ? { v: -x.v, f: { n: -x.f.n, d: x.f.d }, view: x.view } : num(-x.v);
    S.ex.cur = t.startsWith('-') && simpleRe.test(t) ? t.slice(1) : '-' + wrap(t);
    S.ex.dirty = true;
  }

  /* ================================================================
   * AOS: operators, parentheses, equals
   * ================================================================ */
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, pow: 3, root: 3, nCr: 4, nPr: 4 };
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', pow: '^', root: 'ˣ√', nCr: 'nCr', nPr: 'nPr' };
  const OPS = { add: '+', sub: '-', mul: '*', div: '/', pow: 'pow', xroot: 'root', ncr: 'nCr', npr: 'nPr' };

  const pendingCount = () => S.stack.filter((i) => i.op).length;
  const parenCount = () => S.stack.filter((i) => i.paren).length;
  const opLimit = () => (S.stat.n > 0 ? 2 : 4);

  function reduce(minPrec) {
    while (S.stack.length) {
      const top = S.stack[S.stack.length - 1];
      if (top.paren || PREC[top.op] < minPrec) break;
      S.stack.pop();
      S.x = binary(top.left, top.op, S.x);
    }
  }

  function binaryOp(op, wasOp) {
    S.K = null; // any new operation clears the constant
    const frames = S.ex.frames;
    const top = S.stack[S.stack.length - 1];
    if (wasOp && top && top.op) {
      // two operators in a row: the last one wins
      S.stack.pop();
      S.x = top.left;
      frames[frames.length - 1] = top.prevText;
      S.ex.cur = top.curText;
    } else {
      finalizeEntry();
    }
    const prevText = frames[frames.length - 1];
    const curText = curT();
    reduce(PREC[op]);
    S.stack.push({ op, left: S.x, prevText, curText });
    if (pendingCount() > opLimit()) fail();
    frames[frames.length - 1] = prevText + curText + ' ' + SYM[op] + ' ';
    S.ex.cur = '';
    S.ex.dirty = true;
    S.lastOp = true;
  }

  function openParen() {
    finalizeEntry();
    if (parenCount() >= 15) fail();
    S.stack.push({ paren: true });
    S.ex.frames.push('');
    S.ex.cur = '';
    S.ex.dirty = true;
  }

  function closeParen() {
    if (!S.stack.some((i) => i.paren)) return;
    finalizeEntry();
    const inner = S.ex.frames.pop() + curT();
    reduce(0);
    S.stack.pop();
    S.ex.cur = '(' + inner + ')';
  }

  function equals() {
    finalizeEntry();
    let text;
    if (S.stack.length) {
      let t = curT();
      const fr = S.ex.frames;
      for (let i = fr.length - 1; i >= 1; i--) t = '(' + fr[i] + t + ')';
      text = fr[0] + t;
      while (S.stack.length) {
        const top = S.stack.pop();
        if (!top.paren) S.x = binary(top.left, top.op, S.x);
      }
    } else if (S.K) {
      text = wrap(curT()) + ' ' + SYM[S.K.op] + ' ' + plain(S.K.operand);
      S.x = binary(S.x, S.K.op, S.K.operand);
      S.ex.dirty = true;
    } else {
      text = curT();
    }
    if (S.x.f && S.x.view === 'imp') S.x = Object.assign({}, S.x, { view: 'mixed' });
    const res = plain(S.x);
    if (S.ex.dirty && text !== res) addHistory(text, S.x, res);
    S.ex = { frames: [''], cur: '', dirty: false };
  }

  function setConstant() {
    const top = S.stack[S.stack.length - 1];
    if (!top || !top.op) return;
    finalizeEntry();
    S.K = { op: top.op, operand: S.x };
  }

  function clearKey(wasCE) {
    if (wasCE) fullClear();
    else {
      S.entry = null;
      S.x = num(0);
      S.K = null;
      S.await = null;
      S.ex.cur = '';
    }
    S.lastCE = true;
  }

  /* ================================================================
   * One-variable functions
   * ================================================================ */
  const UNARY = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'tenx', 'ex',
    'sq', 'cube', 'sqrt', 'cbrt', 'inv', 'fact', 'pct', 'drgconv', 'dms2dd']);

  function unary(fn, hyp) {
    finalizeEntry();
    const t = curT();
    const v = S.x.v;
    let r;
    let tf = fn;
    switch (fn) {
      case 'sin': case 'cos': case 'tan':
        if (hyp) { r = Math[fn + 'h'](v); tf = fn + 'h'; }
        else r = trig(fn, v);
        break;
      case 'asin': case 'acos': case 'atan':
        if (hyp) {
          if (fn === 'acos' && v < 1) fail();
          if (fn === 'atan' && Math.abs(v) >= 1) fail();
          r = Math[fn + 'h'](v);
          tf = fn + 'h';
        } else {
          if (fn !== 'atan' && Math.abs(v) > 1) fail();
          r = Math[fn](v) / ANG[S.angle];
        }
        break;
      case 'log': if (v <= 0) fail(); r = Math.log10(v); break;
      case 'ln': if (v <= 0) fail(); r = Math.log(v); break;
      case 'tenx': r = Math.pow(10, v); break;
      case 'ex': r = Math.exp(v); break;
      case 'sq': r = v * v; break;
      case 'cube': r = v * v * v; break;
      case 'sqrt': if (v < 0) fail(); r = Math.sqrt(v); break;
      case 'cbrt': r = Math.cbrt(v); break;
      case 'inv': if (v === 0) fail(); r = 1 / v; break;
      case 'fact': r = factorial(v); break;
      case 'pct': {
        const top = S.stack[S.stack.length - 1];
        r = top && (top.op === '+' || top.op === '-') ? (top.left.v * v) / 100 : v / 100;
        break;
      }
      case 'drgconv':
        r = v * DRG_CONV[S.angle];
        S.angle = NEXT_ANGLE[S.angle];
        tf = null;
        break;
      case 'dms2dd': r = dmsToDd(v); break;
    }
    S.x = num(r);
    S.ex.cur = tf ? FT[tf](t) : wrap(t) + '▸' + S.angle;
    S.ex.dirty = true;
  }

  /* ================================================================
   * Memory, statistics, coordinates, fractions
   * ================================================================ */
  function memOp(kind, i) {
    const m = S.mem;
    if (kind === 'STO') m[i] = S.x;
    else if (kind === 'RCL') setValue(m[i]);
    else if (kind === 'SUM') m[i] = binary(m[i], '+', S.x);
    else { const tmp = m[i]; m[i] = S.x; setValue(tmp); }
  }

  function statAdd(sign) {
    finalizeEntry();
    let val = S.x.v;
    let f = 1;
    if (S.frq !== null) {
      f = S.x.v;
      val = S.frq;
      S.frq = null;
      if (!Number.isInteger(f) || f < 1 || f > 99) fail();
    }
    if (Math.abs(val) >= 1e64) fail();
    const st = S.stat;
    if (sign > 0 && st.n + f > 9999) fail();
    if (sign < 0 && st.n - f < 1) fail();
    st.n += sign * f;
    st.sx += sign * f * val;
    st.sx2 += sign * f * val * val;
    S.x = num(st.n);
    S.ex.cur = '';
    S.view = { type: 'n' };
  }

  function statRead(fn) {
    const { n, sx, sx2 } = S.stat;
    let r;
    if (fn === 'n') r = n;
    else if (fn === 'sumx') r = sx;
    else if (fn === 'sumx2') r = sx2;
    else {
      if (n === 0 || (fn === 'sx1' && n < 2)) fail();
      if (fn === 'mean') r = sx / n;
      else {
        const ss = Math.max(0, sx2 - (sx * sx) / n);
        r = Math.sqrt(ss / (fn === 'sxn' ? n : n - 1));
      }
    }
    setValue(num(r));
  }

  function rectPolar(toPolar) {
    finalizeEntry();
    if (toPolar) {
      const X = S.t.v, Y = S.x.v;
      if (Math.abs(X) >= 1e64 || Math.abs(Y) >= 1e64) fail();
      const r = Math.hypot(X, Y);
      const th = Math.atan2(Y, X) / ANG[S.angle];
      setValue(num(r));
      S.t = num(th);
      S.view = { type: 'coord', ind: 'r' };
    } else {
      const R = S.t.v, th = S.x.v;
      const X = R * trig('cos', th), Y = R * trig('sin', th);
      setValue(num(X));
      S.t = num(Y);
      S.view = { type: 'coord', ind: 'x' };
    }
  }

  function fracView() {
    finalizeEntry();
    const x = S.x;
    if (!x.f) return;
    const view = x.view === 'mixed' && Math.abs(x.f.n) > x.f.d ? 'imp' : 'mixed';
    S.x = Object.assign({}, x, { view });
    S.ex.cur = '';
  }

  function fracDec() {
    finalizeEntry();
    const x = S.x;
    if (x.f) S.x = Object.assign({}, x, { view: x.view === 'dec' ? 'mixed' : 'dec' });
    else {
      const fr = toFraction(x.v);
      if (fr) S.x = makeFrac(fr.n, fr.d, 'mixed');
    }
    S.ex.cur = '';
  }

  /* ================================================================
   * Key dispatch
   * ================================================================ */
  const SECOND = {
    drg: 'drgconv', log: 'tenx', ln: 'ex', hyp: 'K', sin: 'asin', cos: 'acos', tan: 'atan',
    pow: 'xroot', pi: 'swap', inv: 'frq', sq: 'mean', sqrt: 'sx1', div: 'sxn', sigp: 'sigm',
    ee: 'n', lp: 'sumx', rp: 'sumx2', mul: 'p2r', sto: 'exc', d7: 'csr', d8: 'ncr', d9: 'npr',
    sub: 'r2p', rcl: 'sum', d4: 'flo', d5: 'sci', d6: 'eng', add: 'dms2dd', frac: 'dc',
    d1: 'cube', d2: 'pct', d3: 'fact', eq: 'dd2dms', back: 'fd', d0: 'cbrt', dot: 'fix',
  };

  function exec(fn, hyp, ctx) {
    if (/^d\d$/.test(fn)) return inputDigit(fn[1]);
    if (OPS[fn]) return binaryOp(OPS[fn], ctx.wasOp);
    if (UNARY.has(fn)) return unary(fn, hyp);
    switch (fn) {
      case 'dot': return inputDot();
      case 'ee': return inputEE();
      case 'neg': return negate();
      case 'back': return backspace();
      case 'frac': return fracKey();
      case 'lp': return openParen();
      case 'rp': return closeParen();
      case 'eq': return equals();
      case 'cec': return clearKey(ctx.wasCE);
      case 'drg': S.angle = NEXT_ANGLE[S.angle]; return;
      case 'K': return setConstant();
      case 'pi': return setValue(num(Math.PI), 'π');
      case 'swap': {
        finalizeEntry();
        const tmp = S.t;
        S.t = S.x;
        return setValue(tmp);
      }
      case 'r2p': return rectPolar(true);
      case 'p2r': return rectPolar(false);
      case 'sto': case 'rcl': case 'sum': case 'exc':
        finalizeEntry();
        S.await = fn.toUpperCase();
        return;
      case 'fix': finalizeEntry(); S.await = 'FIX'; return;
      case 'flo': finalizeEntry(); S.notation = 'FLO'; return;
      case 'sci': finalizeEntry(); S.notation = 'SCI'; return;
      case 'eng': finalizeEntry(); S.notation = 'ENG'; return;
      case 'sigp': return statAdd(1);
      case 'sigm': return statAdd(-1);
      case 'frq': finalizeEntry(); S.frq = S.x.v; return;
      case 'csr':
        if (S.stat.n === 0) fail();
        S.stat = { n: 0, sx: 0, sx2: 0 };
        return;
      case 'mean': case 'sxn': case 'sx1': case 'n': case 'sumx': case 'sumx2':
        return statRead(fn);
      case 'dc': return fracView();
      case 'fd': return fracDec();
      case 'dd2dms':
        finalizeEntry();
        S.view = { type: 'text', m: ddToDms(S.x.v) };
        return;
    }
  }

  function press(id) {
    if (S.error) {
      if (id === 'onac') reset();
      else if (id === 'cec') fullClear();
      return;
    }
    S.view = null;
    if (id === '2nd') { S.second = !S.second; return; }
    if (id === 'onac') { reset(); return; }
    const second = S.second;
    S.second = false;
    if (id === 'hyp' && !second) { S.hyp = !S.hyp; return; }
    const hyp = S.hyp;
    S.hyp = false;
    const ctx = { wasOp: S.lastOp, wasCE: S.lastCE };
    S.lastOp = false;
    S.lastCE = false;
    try {
      if (S.await) {
        const a = S.await;
        S.await = null;
        if (!second) {
          if (a === 'FIX') {
            if (/^d\d$/.test(id)) { S.fix = Number(id[1]); return; }
            if (id === 'dot') { S.fix = null; return; }
          } else if (id === 'd1' || id === 'd2' || id === 'd3') {
            memOp(a, Number(id[1]));
            return;
          }
        }
      }
      exec((second && SECOND[id]) || id, hyp, ctx);
    } catch (err) {
      if (!(err instanceof CalcError)) throw err;
      setError();
    }
  }

  /* ================================================================
   * Screen model
   * ================================================================ */
  function screenModel() {
    if (S.error) return { prefix: '', m: 'Error', e: null };
    if (S.entry) return Object.assign({ prefix: '' }, entryShow(S.entry));
    if (S.view && S.view.type === 'text') return { prefix: '', m: S.view.m, e: null };
    const r = fmtVal(S.x);
    return { prefix: S.view && S.view.type === 'n' ? 'n=' : '', m: r.m, e: r.e };
  }

  function indicators() {
    const coord = S.view && S.view.type === 'coord' ? S.view.ind : null;
    return {
      '2nd': S.second, HYP: S.hyp,
      M1: S.mem[1].v !== 0, M2: S.mem[2].v !== 0, M3: S.mem[3].v !== 0,
      STAT: S.stat.n > 0, K: !!S.K, '( )': parenCount() > 0,
      DEG: S.angle === 'DEG', RAD: S.angle === 'RAD', GRAD: S.angle === 'GRAD',
      FIX: S.fix !== null, SCI: S.notation === 'SCI', ENG: S.notation === 'ENG',
      x: coord === 'x', r: coord === 'r',
    };
  }

  function screenText() {
    const s = screenModel();
    return (s.prefix ? s.prefix + ' ' : '') + s.m.replace(UB, '_').replace(FB, '/') + (s.e ? ' ' + s.e : '');
  }

  const hooks = { onHistory: null };

  /* ================================================================
   * User interface
   * ================================================================ */
  const KEYS = [
    { id: '2nd', l: '2nd', k: 'shift', r: 1, c: 1, n: 'Second function' },
    { id: 'drg', l: 'DRG', s: 'DRG▸', k: 'fn', r: 1, c: 2, n: 'Angle unit', sn: 'Convert angle' },
    { id: 'log', l: 'LOG', s: '10<sup>x</sup>', k: 'fn', r: 1, c: 3, n: 'Log', sn: '10 to the x' },
    { id: 'ln', l: 'LN', s: 'e<sup>x</sup>', k: 'fn', r: 1, c: 4, n: 'Natural log', sn: 'e to the x' },
    { id: 'cec', l: 'CE/C', k: 'clear', r: 1, c: 5, n: 'Clear entry, press twice to clear' },
    { id: 'hyp', l: 'HYP', s: 'K', k: 'fn', r: 2, c: 1, n: 'Hyperbolic', sn: 'Constant' },
    { id: 'sin', l: 'SIN', s: 'SIN<sup>−1</sup>', k: 'fn', r: 2, c: 2, n: 'Sine', sn: 'Inverse sine' },
    { id: 'cos', l: 'COS', s: 'COS<sup>−1</sup>', k: 'fn', r: 2, c: 3, n: 'Cosine', sn: 'Inverse cosine' },
    { id: 'tan', l: 'TAN', s: 'TAN<sup>−1</sup>', k: 'fn', r: 2, c: 4, n: 'Tangent', sn: 'Inverse tangent' },
    { id: 'pow', l: 'y<sup>x</sup>', s: '<sup>x</sup>√y', k: 'fn', r: 2, c: 5, n: 'y to the x', sn: 'x-th root of y' },
    { id: 'pi', l: 'π', s: 'x⇌y', k: 'fn', r: 3, c: 1, n: 'Pi', sn: 'Swap x and y' },
    { id: 'inv', l: '1/x', s: 'FRQ', k: 'fn', r: 3, c: 2, n: 'Reciprocal', sn: 'Frequency' },
    { id: 'sq', l: 'x<sup>2</sup>', s: '<span class="ol">x</span>', k: 'fn', r: 3, c: 3, n: 'Square', sn: 'Mean' },
    { id: 'sqrt', l: '√x', s: 'σ<sub>xn−1</sub>', k: 'fn', r: 3, c: 4, n: 'Square root', sn: 'Sample standard deviation' },
    { id: 'sigp', l: 'Σ+', s: 'Σ−', k: 'fn', r: 4, c: 1, n: 'Add data point', sn: 'Remove data point' },
    { id: 'ee', l: 'EE', s: 'n', k: 'fn', r: 4, c: 2, n: 'Exponent', sn: 'Number of data points' },
    { id: 'lp', l: '(', s: 'Σx', k: 'fn', r: 4, c: 3, n: 'Open parenthesis', sn: 'Sum of x' },
    { id: 'rp', l: ')', s: 'Σx<sup>2</sup>', k: 'fn', r: 4, c: 4, n: 'Close parenthesis', sn: 'Sum of x squared' },
    { id: 'sto', l: 'STO', s: 'EXC', k: 'fn', r: 5, c: 1, n: 'Store', sn: 'Exchange with memory' },
    { id: 'd7', l: '7', s: 'CSR', k: 'num', r: 5, c: 2, n: '7', sn: 'Clear statistics' },
    { id: 'd8', l: '8', s: 'nCr', k: 'num', r: 5, c: 3, n: '8', sn: 'Combinations' },
    { id: 'd9', l: '9', s: 'nPr', k: 'num', r: 5, c: 4, n: '9', sn: 'Permutations' },
    { id: 'rcl', l: 'RCL', s: 'SUM', k: 'fn', r: 6, c: 1, n: 'Recall', sn: 'Add to memory' },
    { id: 'd4', l: '4', s: 'FLO', k: 'num', r: 6, c: 2, n: '4', sn: 'Floating notation' },
    { id: 'd5', l: '5', s: 'SCI', k: 'num', r: 6, c: 3, n: '5', sn: 'Scientific notation' },
    { id: 'd6', l: '6', s: 'ENG', k: 'num', r: 6, c: 4, n: '6', sn: 'Engineering notation' },
    { id: 'frac', l: 'a<sup>b</sup>/<sub>c</sub>', s: 'd/c', k: 'fn', r: 7, c: 1, n: 'Fraction', sn: 'Mixed or improper' },
    { id: 'd1', l: '1', s: 'x<sup>3</sup>', k: 'num', r: 7, c: 2, n: '1', sn: 'Cube' },
    { id: 'd2', l: '2', s: '%', k: 'num', r: 7, c: 3, n: '2', sn: 'Percent' },
    { id: 'd3', l: '3', s: 'x!', k: 'num', r: 7, c: 4, n: '3', sn: 'Factorial' },
    { id: 'back', l: '←', s: 'F◂▸D', k: 'fn', r: 8, c: 1, n: 'Backspace', sn: 'Fraction or decimal' },
    { id: 'd0', l: '0', s: '∛x', k: 'num', r: 8, c: 2, n: '0', sn: 'Cube root' },
    { id: 'dot', l: '.', s: 'FIX', k: 'num', r: 8, c: 3, n: 'Decimal point', sn: 'Fixed decimals' },
    { id: 'neg', l: '+/−', k: 'num', r: 8, c: 4, n: 'Change sign' },
    { id: 'div', l: '÷', s: 'σ<sub>xn</sub>', k: 'op', op: 0, n: 'Divide', sn: 'Population standard deviation' },
    { id: 'mul', l: '×', s: 'P▸R', k: 'op', op: 1, n: 'Multiply', sn: 'Polar to rectangular' },
    { id: 'sub', l: '−', s: 'R▸P', k: 'op', op: 2, n: 'Subtract', sn: 'Rectangular to polar' },
    { id: 'add', l: '+', s: 'DMS▸DD', k: 'op', op: 3, n: 'Add', sn: 'DMS to decimal degrees' },
    { id: 'eq', l: '=', s: 'DD▸DMS', k: 'op', op: 4, n: 'Equals', sn: 'Show as DMS' },
  ];

  const KEYMAP = {
    0: 'd0', 1: 'd1', 2: 'd2', 3: 'd3', 4: 'd4', 5: 'd5', 6: 'd6', 7: 'd7', 8: 'd8', 9: 'd9',
    '.': 'dot', ',': 'dot', '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow',
    '(': 'lp', ')': 'rp', Enter: 'eq', '=': 'eq', Backspace: 'back', Escape: 'cec', Delete: 'onac',
    s: 'sin', c: 'cos', t: 'tan', l: 'log', n: 'ln', h: 'hyp', d: 'drg', p: 'pi',
    r: 'sqrt', q: 'sq', i: 'inv', e: 'ee', f: 'frac',
    '%': ['2nd', 'd2'], '!': ['2nd', 'd3'],
  };

  const IND_TOP = ['2nd', 'HYP', 'M1', 'M2', 'M3', 'STAT', 'K', '( )'];
  const IND_BOT = ['DEG', 'RAD', 'GRAD', 'FIX', 'SCI', 'ENG', 'x', 'r'];

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rich = (s) => esc(s)
    .split(UB).join('<span class="ub"><span class="sr"> and </span></span>')
    .split(FB).join('<span class="fb"><span class="sr">/</span></span>');

  /* ---------- Appearance & feedback settings (saved on the device) ---------- */
  const SETTINGS_KEY = 'pocketsci.settings';
  const THEMES = {
    retro: { meta: '#2e3a33', accent: '#86cdb9' },
    dark: { meta: '#1b1c20', accent: '#f0a04b' },
    amoled: { meta: '#000000', accent: '#b69cff' },
    minimal: { meta: '#f6f7f8', accent: '#5fb3f9' },
  };
  const ACCENTS = [
    ['Mint', '#86cdb9'], ['Amber', '#f0a04b'], ['Coral', '#ff7a6b'], ['Rose', '#f472b6'],
    ['Lavender', '#b69cff'], ['Sky', '#5fb3f9'], ['Lime', '#a3d977'], ['Brass', '#d6b44f'],
  ];

  // Dark or light text, whichever reads better on the accent
  function inkFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#111111' : '#ffffff';
  }

  function initUI() {
    const $ = (id) => document.getElementById(id);
    const root = document.documentElement;
    const calc = $('calc');
    const pad = $('pad');
    const readout = $('readout');
    const line = $('line');
    const numEl = $('num');
    const expEl = $('exp');
    const prefixEl = $('prefix');
    const histBtn = $('histBtn');
    const histList = $('histList');
    const histEmpty = $('histEmpty');
    const histHint = $('histHint');
    const histClear = $('histClear');
    const histClose = $('histClose');
    const setBtn = $('setBtn');
    const setClose = $('setClose');
    const accentsEl = $('accents');
    const hapticToggle = $('hapticToggle');
    const sheets = { history: $('history'), settings: $('settings') };
    const keyEls = {};

    /* ----- Settings ----- */
    const settings = { theme: 'retro', accent: null, haptics: true };
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (THEMES[saved.theme]) settings.theme = saved.theme;
      if (typeof saved.accent === 'string' && /^#[0-9a-f]{6}$/i.test(saved.accent)) settings.accent = saved.accent.toLowerCase();
      if (typeof saved.haptics === 'boolean') settings.haptics = saved.haptics;
    } catch (e) { /* private mode or blocked storage: use defaults */ }

    function saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          theme: settings.theme,
          accent: settings.accent,
          accentInk: settings.accent ? inkFor(settings.accent) : null,
          haptics: settings.haptics,
        }));
      } catch (e) { /* not saved, still applied for this session */ }
    }

    // Accent swatches: theme default, presets, custom colour
    const swatches = [];
    const addSwatch = (id, name, color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.dataset.acc = id;
      b.innerHTML = '<span class="dot"></span><span>' + name + '</span>';
      if (color) b.style.setProperty('--c', color);
      accentsEl.appendChild(b);
      swatches.push(b);
      return b;
    };
    const defaultSwatch = addSwatch('default', 'Default');
    for (const [name, hex] of ACCENTS) addSwatch(hex, name, hex);
    const custom = document.createElement('label');
    custom.className = 'swatch';
    custom.dataset.acc = 'custom';
    custom.innerHTML = '<span class="dot"></span><span>Custom</span>' +
      '<input type="color" aria-label="Custom accent color" value="#86cdb9">';
    accentsEl.appendChild(custom);
    swatches.push(custom);
    const customInput = custom.querySelector('input');
    const rainbow = 'conic-gradient(#ff6b6b, #f0c04b, #a3d977, #5fb3f9, #b69cff, #f472b6, #ff6b6b)';

    function applySettings() {
      root.dataset.theme = settings.theme;
      if (settings.accent) {
        root.style.setProperty('--user-accent', settings.accent);
        root.style.setProperty('--user-accent-ink', inkFor(settings.accent));
      } else {
        root.style.removeProperty('--user-accent');
        root.style.removeProperty('--user-accent-ink');
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', THEMES[settings.theme].meta);

      document.querySelectorAll('.theme-opt').forEach((b) => {
        b.setAttribute('aria-checked', String(b.dataset.themeOpt === settings.theme));
      });
      defaultSwatch.style.setProperty('--c', THEMES[settings.theme].accent);
      const isPreset = settings.accent && ACCENTS.some((a) => a[1] === settings.accent);
      const selected = !settings.accent ? 'default' : isPreset ? settings.accent : 'custom';
      for (const sw of swatches) {
        const on = sw.dataset.acc === selected;
        sw.classList.toggle('is-sel', on);
        if (sw.tagName === 'BUTTON') sw.setAttribute('aria-checked', String(on));
      }
      custom.style.setProperty('--c', selected === 'custom' ? settings.accent : rainbow);
      if (selected === 'custom') customInput.value = settings.accent;
      hapticToggle.checked = settings.haptics;
    }

    document.querySelectorAll('.theme-opt').forEach((b) => {
      b.addEventListener('click', () => {
        settings.theme = b.dataset.themeOpt;
        applySettings();
        saveSettings();
      });
    });
    accentsEl.addEventListener('click', (e) => {
      const b = e.target.closest('button.swatch');
      if (!b) return;
      settings.accent = b.dataset.acc === 'default' ? null : b.dataset.acc;
      applySettings();
      saveSettings();
    });
    customInput.addEventListener('input', () => {
      settings.accent = customInput.value.toLowerCase();
      applySettings();
    });
    customInput.addEventListener('change', () => {
      settings.accent = customInput.value.toLowerCase();
      applySettings();
      saveSettings();
    });
    hapticToggle.addEventListener('change', () => {
      settings.haptics = hapticToggle.checked;
      saveSettings();
    });

    /* ----- Haptics -----
     * Android and others: Vibration API.
     * iPhone (iOS 18+): Safari has no Vibration API, but toggling a native
     * switch control plays the system haptic, so a hidden one is clicked. */
    let hapticLabel = null;
    function haptic() {
      if (!settings.haptics) return;
      if (typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(8); } catch (e) { /* ignored */ }
        return;
      }
      if (!hapticLabel) {
        hapticLabel = document.createElement('label');
        hapticLabel.setAttribute('aria-hidden', 'true');
        hapticLabel.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.tabIndex = -1;
        hapticLabel.appendChild(input);
        document.body.appendChild(hapticLabel);
      }
      hapticLabel.click();
    }

    /* ----- Keypad ----- */
    for (const k of KEYS) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (k.k === 'op' ? ' cell-op' : '');
      if (k.k === 'op') {
        cell.style.gridColumn = '5';
        cell.style.gridRow = (11 + k.op * 6) + ' / span 6';
      } else {
        cell.style.gridColumn = String(k.c);
        cell.style.gridRow = ((k.r - 1) * 5 + 1) + ' / span 5';
      }
      const sec = document.createElement('span');
      sec.className = 'sec';
      sec.setAttribute('aria-hidden', 'true');
      sec.innerHTML = k.s || '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key k-' + k.k + (k.id === 'eq' ? ' k-eq' : '');
      btn.dataset.id = k.id;
      btn.innerHTML = '<span class="lbl">' + k.l + '</span>';
      btn.setAttribute('aria-label', k.n + (k.sn ? '. Second: ' + k.sn : ''));
      btn.title = k.n + (k.sn ? ' / 2nd: ' + k.sn : '');
      cell.append(sec, btn);
      pad.appendChild(cell);
      keyEls[k.id] = btn;
    }
    keyEls.onac = calc.querySelector('[data-id="onac"]');

    /* ----- Display indicators ----- */
    const indEls = [];
    const buildInd = (row, names) => {
      for (const name of names) {
        const span = document.createElement('span');
        span.textContent = name;
        span.className = 'i-' + name.replace(/[^a-z0-9]/gi, '');
        row.appendChild(span);
        indEls.push([name, span]);
      }
    };
    buildInd($('indTop'), IND_TOP);
    buildInd($('indBot'), IND_BOT);
    const promptEl = document.createElement('span');
    promptEl.className = 'prompt';
    $('indBot').appendChild(promptEl);

    function fit() {
      readout.style.fontSize = '';
      let size = parseFloat(getComputedStyle(readout).fontSize);
      while (line.offsetWidth > readout.clientWidth && size > 16) {
        size -= 2;
        readout.style.fontSize = size + 'px';
      }
    }

    function render() {
      const sm = screenModel();
      prefixEl.textContent = sm.prefix;
      numEl.innerHTML = rich(sm.m);
      expEl.textContent = sm.e || '';
      const ind = indicators();
      for (const [name, el] of indEls) el.classList.toggle('on', !!ind[name]);
      promptEl.textContent = S.await || (S.frq !== null ? 'FRQ' : '');
      calc.classList.toggle('is-shift', S.second);
      keyEls['2nd'].classList.toggle('is-on', S.second);
      keyEls.hyp.classList.toggle('is-on', S.hyp);
      fit();
    }

    function renderHistory() {
      histList.innerHTML = '';
      S.history.forEach((h, i) => {
        const li = document.createElement('li');
        li.className = 'hist-item';
        li.innerHTML = '<button type="button" data-i="' + i + '">' +
          '<span class="hist-expr">' + rich(h.expr) + '</span>' +
          '<span class="hist-res">= ' + rich(h.res) + '</span></button>';
        histList.appendChild(li);
      });
      histEmpty.hidden = S.history.length > 0;
      histHint.hidden = S.history.length === 0;
      histClear.disabled = S.history.length === 0;
    }
    hooks.onHistory = renderHistory;

    /* ----- Sheets (history / settings) ----- */
    let openSheet = null;
    function setSheet(name) {
      openSheet = name;
      for (const [n, el] of Object.entries(sheets)) {
        const open = n === name;
        el.classList.toggle('open', open);
        el.inert = !open;
        el.setAttribute('aria-hidden', String(!open));
      }
      pad.inert = !!name;
      histBtn.setAttribute('aria-expanded', String(name === 'history'));
      setBtn.setAttribute('aria-expanded', String(name === 'settings'));
      if (name === 'history') { renderHistory(); histClose.focus({ preventScroll: true }); }
      if (name === 'settings') setClose.focus({ preventScroll: true });
    }

    function hit(id) {
      if (openSheet) setSheet(null);
      press(id);
      render();
    }

    function flash(id) {
      const b = keyEls[id];
      if (!b) return;
      b.classList.add('pressed');
      setTimeout(() => b.classList.remove('pressed'), 110);
    }

    /* ----- Touch / mouse: act on pointerdown for a snappy feel ----- */
    let pendingHaptic = false;
    calc.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button.key');
      if (!b || e.button > 0) return;
      e.preventDefault();
      b.classList.add('pressed');
      if (e.pointerType !== 'mouse') pendingHaptic = true;
      hit(b.dataset.id);
    });
    // The haptic plays on release, where the browser counts the touch as a
    // user gesture (required on iPhone).
    window.addEventListener('pointerup', () => {
      calc.querySelectorAll('.key.pressed').forEach((b) => b.classList.remove('pressed'));
      if (pendingHaptic) { pendingHaptic = false; haptic(); }
    });
    window.addEventListener('pointercancel', () => {
      calc.querySelectorAll('.key.pressed').forEach((b) => b.classList.remove('pressed'));
      pendingHaptic = false;
    });
    // Keyboard activation of a focused key (Enter / Space)
    calc.addEventListener('click', (e) => {
      const b = e.target.closest('button.key');
      if (b && e.detail === 0) hit(b.dataset.id);
    });

    /* ----- Physical keyboard ----- */
    let shiftAlone = false;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') { shiftAlone = true; return; }
      shiftAlone = false;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && openSheet) {
        const back = openSheet === 'history' ? histBtn : setBtn;
        setSheet(null);
        back.focus();
        e.preventDefault();
        return;
      }
      if (openSheet === 'settings') return; // typing goes to the settings panel
      const active = document.activeElement;
      if ((e.key === 'Enter' || e.key === ' ') && active && active.tagName === 'BUTTON') return;
      const m = KEYMAP[e.key];
      if (!m) return;
      e.preventDefault();
      for (const id of [].concat(m)) { flash(id); hit(id); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' && shiftAlone && openSheet !== 'settings') { flash('2nd'); hit('2nd'); }
      shiftAlone = false;
    });

    /* ----- Panels ----- */
    histBtn.addEventListener('click', () => setSheet(openSheet === 'history' ? null : 'history'));
    setBtn.addEventListener('click', () => setSheet(openSheet === 'settings' ? null : 'settings'));
    histClose.addEventListener('click', () => { setSheet(null); histBtn.focus(); });
    setClose.addEventListener('click', () => { setSheet(null); setBtn.focus(); });
    histClear.addEventListener('click', () => { S.history.length = 0; renderHistory(); });
    histList.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const h = S.history[Number(b.dataset.i)];
      if (!h) return;
      if (S.error) fullClear();
      S.view = null;
      setValue(h.x);
      setSheet(null);
      render();
    });

    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    applySettings();
    setSheet(null);
    renderHistory();
    render();
  }

  /* ================================================================
   * Boot / exports
   * ================================================================ */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { press, screenText, indicators, state: () => S, reset: () => { S = newState(); } };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
    else initUI();
  }
})();
