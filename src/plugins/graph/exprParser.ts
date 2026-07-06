/**
 * 初等関数のみの小型数式パーサ(依存なし)。
 * "2*sin(x)" のような x の式をコンパイルして (x)=>number を返す。
 *
 * 文法(再帰下降):
 *   expr  := term (('+'|'-') term)*
 *   term  := unary (('*'|'/') unary | <暗黙の乗算> unary)*   // "2x", "2sin(x)", "x(x+1)"
 *   unary := ('-'|'+') unary | power
 *   power := atom ('^' unary)?                               // 右結合。暗黙乗算は^より弱い(2^3x=(2^3)*x)
 *   atom  := number | 'x' | 定数 | 関数 '(' expr ')' | '(' expr ')'
 *
 * 三角関数はラジアン。log/ln は自然対数、常用対数は log10。
 * ゼロ除算などは Infinity/NaN のまま返し、描画側(sampleFunction)が分割する。
 */

type Fn = (x: number) => number;

export type CompiledExpr =
  | { ok: true; fn: Fn }
  | { ok: false; error: string; pos: number };

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/** 長い名前から先に照合する既知の名前(関数・定数・変数x) */
const KNOWN_NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'x'].sort(
  (a, b) => b.length - a.length,
);

/** 全角英数・記号を半角へ正規化する(日本語IME対策) */
export function normalizeExpression(src: string): string {
  return src
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/＋/g, '+')
    .replace(/[－−]/g, '-')
    .replace(/[＊×]/g, '*')
    .replace(/[／÷]/g, '/')
    .replace(/＾/g, '^')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/．/g, '.')
    .replace(/　/g, ' ');
}

class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

type Token =
  | { kind: 'num'; value: number; pos: number }
  | { kind: 'ident'; name: string; pos: number }
  | { kind: 'op'; op: string; pos: number };

const NUM_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

function tokenize(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if ('+-*/^()'.includes(c)) {
      toks.push({ kind: 'op', op: c, pos: i });
      i++;
      continue;
    }
    const numMatch = NUM_RE.exec(src.slice(i));
    if (numMatch) {
      toks.push({ kind: 'num', value: Number(numMatch[0]), pos: i });
      i += numMatch[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      // 既知の名前を長い順に前方一致で切り出す("xsin"→x,sin / "2pi"→pi)
      const rest = src.slice(i);
      const name = KNOWN_NAMES.find((n) => rest.startsWith(n));
      if (!name) {
        const run = /^[a-zA-Z][a-zA-Z0-9]*/.exec(rest)![0];
        throw new ParseError(`「${run}」は使えない名前です`, i);
      }
      toks.push({ kind: 'ident', name, pos: i });
      i += name.length;
      continue;
    }
    throw new ParseError(`「${c}」は式に使えない文字です`, i);
  }
  return toks;
}

interface ParserState {
  toks: Token[];
  i: number;
  srcLen: number;
}

function peekOp(s: ParserState, op: string): boolean {
  const t = s.toks[s.i];
  return !!t && t.kind === 'op' && t.op === op;
}

/** 次のトークンが値(atom)の先頭になり得るか(暗黙乗算の判定) */
function startsAtom(s: ParserState): boolean {
  const t = s.toks[s.i];
  if (!t) return false;
  return t.kind === 'num' || t.kind === 'ident' || (t.kind === 'op' && t.op === '(');
}

function parseExpr(s: ParserState): Fn {
  let left = parseTerm(s);
  while (peekOp(s, '+') || peekOp(s, '-')) {
    const op = (s.toks[s.i] as { op: string }).op;
    s.i++;
    const right = parseTerm(s);
    const l = left;
    left = op === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
  }
  return left;
}

function parseTerm(s: ParserState): Fn {
  let left = parseUnary(s);
  for (;;) {
    if (peekOp(s, '*') || peekOp(s, '/')) {
      const op = (s.toks[s.i] as { op: string }).op;
      s.i++;
      const right = parseUnary(s);
      const l = left;
      left = op === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
    } else if (startsAtom(s)) {
      // 暗黙の乗算
      const right = parseUnary(s);
      const l = left;
      left = (x) => l(x) * right(x);
    } else {
      break;
    }
  }
  return left;
}

function parseUnary(s: ParserState): Fn {
  if (peekOp(s, '-')) {
    s.i++;
    const f = parseUnary(s);
    return (x) => -f(x);
  }
  if (peekOp(s, '+')) {
    s.i++;
    return parseUnary(s);
  }
  return parsePower(s);
}

function parsePower(s: ParserState): Fn {
  const base = parseAtom(s);
  if (peekOp(s, '^')) {
    s.i++;
    const exp = parseUnary(s);
    return (x) => Math.pow(base(x), exp(x));
  }
  return base;
}

function currentPos(s: ParserState): number {
  const t = s.toks[s.i];
  return t ? t.pos : s.srcLen;
}

function parseAtom(s: ParserState): Fn {
  const t = s.toks[s.i];
  if (!t) throw new ParseError('式が途中で終わっています', s.srcLen);
  if (t.kind === 'num') {
    s.i++;
    const v = t.value;
    return () => v;
  }
  if (t.kind === 'ident') {
    s.i++;
    if (t.name === 'x') return (x) => x;
    if (t.name in CONSTS) {
      const v = CONSTS[t.name];
      return () => v;
    }
    const f = FUNCS[t.name];
    if (!peekOp(s, '(')) {
      throw new ParseError(`関数 ${t.name} には ( が必要です`, t.pos);
    }
    s.i++;
    const arg = parseExpr(s);
    if (!peekOp(s, ')')) throw new ParseError(') が足りません', currentPos(s));
    s.i++;
    return (x) => f(arg(x));
  }
  if (t.op === '(') {
    s.i++;
    const inner = parseExpr(s);
    if (!peekOp(s, ')')) throw new ParseError(') が足りません', currentPos(s));
    s.i++;
    return inner;
  }
  throw new ParseError('ここに値が必要です', t.pos);
}

/** 式をコンパイルする。失敗時は日本語のエラーメッセージと位置を返す */
export function compileExpression(source: string): CompiledExpr {
  const src = normalizeExpression(source);
  try {
    const toks = tokenize(src);
    if (toks.length === 0) throw new ParseError('式が空です', 0);
    const s: ParserState = { toks, i: 0, srcLen: src.length };
    const fn = parseExpr(s);
    if (s.i < toks.length) {
      throw new ParseError('式の途中に解釈できない部分があります', currentPos(s));
    }
    return { ok: true, fn };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, pos: e.pos };
    throw e;
  }
}

// Renderer から毎描画呼ばれるためコンパイル結果をキャッシュする(フック不要=書き出し安全)
const cache = new Map<string, CompiledExpr>();

export function compileCached(source: string): CompiledExpr {
  const hit = cache.get(source);
  if (hit) return hit;
  if (cache.size > 200) cache.clear();
  const result = compileExpression(source);
  cache.set(source, result);
  return result;
}
