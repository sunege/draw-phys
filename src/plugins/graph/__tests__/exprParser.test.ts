import { describe, expect, it } from 'vitest';
import { compileCached, compileExpression, normalizeExpression } from '../exprParser';

/** コンパイル成功を前提に評価する */
function ev(src: string, x = 0): number {
  const r = compileExpression(src);
  if (!r.ok) throw new Error(`コンパイル失敗: ${src} → ${r.error}`);
  return r.fn(x);
}

/** コンパイル失敗を前提にエラーを取り出す */
function err(src: string): { error: string; pos: number } {
  const r = compileExpression(src);
  if (r.ok) throw new Error(`失敗するはずの式が成功した: ${src}`);
  return r;
}

describe('四則演算と優先順位', () => {
  it('加減乗除と括弧', () => {
    expect(ev('1+2*3')).toBe(7);
    expect(ev('(1+2)*3')).toBe(9);
    expect(ev('2-3-4')).toBe(-5); // 左結合
    expect(ev('12/4/3')).toBe(1);
  });

  it('単項マイナス・プラス', () => {
    expect(ev('-x', 2)).toBe(-2);
    expect(ev('+x', 2)).toBe(2);
    expect(ev('2*-3')).toBe(-6);
    expect(ev('-x^2', 3)).toBe(-9); // -(x^2)
  });

  it('べき乗は右結合で暗黙乗算より強い', () => {
    expect(ev('2^3^2')).toBe(512); // 2^(3^2)
    expect(ev('2^-2')).toBe(0.25);
    expect(ev('2^3x', 2)).toBe(16); // (2^3)*x
    expect(ev('2x^2', 3)).toBe(18); // 2*(x^2)
  });
});

describe('暗黙の乗算', () => {
  it('係数・関数・括弧の連接', () => {
    expect(ev('2x', 5)).toBe(10);
    expect(ev('2sin(x)', Math.PI / 2)).toBeCloseTo(2);
    expect(ev('x(x+1)', 2)).toBe(6);
    expect(ev('(x+1)(x-1)', 3)).toBe(8);
    expect(ev('2pi')).toBeCloseTo(2 * Math.PI);
    expect(ev('.5x', 4)).toBe(2);
  });

  it('既知の名前は長い順に切り出す(xsin→x*sin)', () => {
    expect(ev('xsin(x)', Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(ev('pix', 2)).toBeCloseTo(2 * Math.PI);
  });
});

describe('関数と定数', () => {
  it('初等関数一式(ラジアン)', () => {
    expect(ev('sin(0)')).toBe(0);
    expect(ev('cos(0)')).toBe(1);
    expect(ev('tan(0)')).toBe(0);
    expect(ev('asin(1)')).toBeCloseTo(Math.PI / 2);
    expect(ev('acos(1)')).toBe(0);
    expect(ev('atan(1)')).toBeCloseTo(Math.PI / 4);
    expect(ev('sqrt(9)')).toBe(3);
    expect(ev('abs(0-2)')).toBe(2);
    expect(ev('exp(0)')).toBe(1);
    expect(ev('log(e)')).toBeCloseTo(1); // 自然対数
    expect(ev('ln(e)')).toBeCloseTo(1);
    expect(ev('log10(100)')).toBeCloseTo(2);
  });

  it('定数と指数表記', () => {
    expect(ev('pi')).toBeCloseTo(Math.PI);
    expect(ev('e')).toBeCloseTo(Math.E);
    expect(ev('1e-3')).toBe(0.001);
    expect(ev('2e')).toBeCloseTo(2 * Math.E); // 指数の数字が無ければ定数eとの積
  });

  it('ゼロ除算などはInfinity/NaNのまま返す', () => {
    expect(ev('1/x', 0)).toBe(Infinity);
    expect(Number.isNaN(ev('sqrt(x)', -1))).toBe(true);
  });
});

describe('全角の正規化', () => {
  it('全角英数・記号・×÷を半角へ', () => {
    expect(normalizeExpression('２×（ｘ＋１）')).toBe('2*(x+1)');
    expect(ev('２＊（ｘ＋１）', 2)).toBe(6);
    expect(ev('６÷２')).toBe(3);
    expect(ev('－ｘ', 3)).toBe(-3);
  });
});

describe('エラー', () => {
  it('空・未知の名前・使えない文字', () => {
    expect(err('').error).toBe('式が空です');
    const unknown = err('foo(x)');
    expect(unknown.error).toContain('foo');
    expect(unknown.pos).toBe(0);
    expect(err('x=1').error).toContain('使えない文字');
  });

  it('括弧の不整合・引数抜け', () => {
    expect(err('(x+1').error).toBe(') が足りません');
    expect(err('sin x').error).toContain('( が必要');
    expect(err('2**3').error).toBe('ここに値が必要です');
    expect(err('x+').error).toBe('式が途中で終わっています');
  });

  it('末尾の余り', () => {
    const r = err('x)');
    expect(r.error).toBe('式の途中に解釈できない部分があります');
    expect(r.pos).toBe(1);
  });
});

describe('compileCached', () => {
  it('同じ式は同じ結果オブジェクトを返す', () => {
    const a = compileCached('sin(x)+1');
    const b = compileCached('sin(x)+1');
    expect(a).toBe(b);
    if (a.ok) expect(a.fn(0)).toBe(1);
  });
});
