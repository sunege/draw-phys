import { describe, expect, it } from 'vitest';
import {
  docBounds,
  escapeHtml,
  estimateDocHeight,
  parseLatexDoc,
  renderDocHtml,
} from '../latexDocParser';

describe('parseLatexDoc', () => {
  it('地の文のみは1つのtextセグメントになる', () => {
    expect(parseLatexDoc('質量mの物体')).toEqual([{ kind: 'text', text: '質量mの物体' }]);
  });

  it('$...$ をinline mathとして分割する', () => {
    expect(parseLatexDoc('初速度 $v_0$ で投げる')).toEqual([
      { kind: 'text', text: '初速度 ' },
      { kind: 'math', tex: 'v_0', display: false },
      { kind: 'text', text: ' で投げる' },
    ]);
  });

  it('$$...$$ をdisplay mathとして分割する', () => {
    expect(parseLatexDoc('式$$F = ma$$終わり')).toEqual([
      { kind: 'text', text: '式' },
      { kind: 'math', tex: 'F = ma', display: true },
      { kind: 'text', text: '終わり' },
    ]);
  });

  it('\\[...\\] をdisplay math、\\(...\\) をinline mathとして分割する', () => {
    expect(parseLatexDoc('a\\[x^2\\]b\\(y\\)c')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'math', tex: 'x^2', display: true },
      { kind: 'text', text: 'b' },
      { kind: 'math', tex: 'y', display: false },
      { kind: 'text', text: 'c' },
    ]);
  });

  it('\\begin{align}...\\end{align} を丸ごと1つのdisplay mathにする', () => {
    const src = '前\\begin{align}a &= b \\\\ c &= d\\end{align}後';
    expect(parseLatexDoc(src)).toEqual([
      { kind: 'text', text: '前' },
      { kind: 'math', tex: '\\begin{align}a &= b \\\\ c &= d\\end{align}', display: true },
      { kind: 'text', text: '後' },
    ]);
  });

  it('同名環境のネストを正しく対応付ける', () => {
    const inner = '\\begin{aligned}x\\begin{aligned}y\\end{aligned}z\\end{aligned}';
    const src = `$${inner}$`;
    expect(parseLatexDoc(src)).toEqual([{ kind: 'math', tex: inner, display: false }]);
  });

  it('環境名を問わず\\begin{...}をmath扱いする(cases等)', () => {
    expect(parseLatexDoc('\\begin{cases}a\\\\b\\end{cases}')).toEqual([
      { kind: 'math', tex: '\\begin{cases}a\\\\b\\end{cases}', display: true },
    ]);
  });

  it('\\$ はリテラルの$になる', () => {
    expect(parseLatexDoc('価格は\\$100です')).toEqual([{ kind: 'text', text: '価格は$100です' }]);
  });

  it('数式内の\\$は終端にならない', () => {
    expect(parseLatexDoc('$a\\$b$')).toEqual([{ kind: 'math', tex: 'a\\$b', display: false }]);
  });

  it('未閉鎖の$はテキスト扱い', () => {
    expect(parseLatexDoc('abc $x')).toEqual([{ kind: 'text', text: 'abc $x' }]);
  });

  it('単独の$$はテキスト扱い', () => {
    expect(parseLatexDoc('a$$')).toEqual([{ kind: 'text', text: 'a$$' }]);
  });

  it('未閉鎖の\\[は末尾までmath扱い', () => {
    expect(parseLatexDoc('a\\[x^2')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'math', tex: 'x^2', display: true },
    ]);
  });

  it('未閉鎖の\\begin{align}は末尾までmath扱い', () => {
    expect(parseLatexDoc('a\\begin{align}x=1')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'math', tex: '\\begin{align}x=1', display: true },
    ]);
  });

  it('地の文の\\alphaなどはリテラルテキスト', () => {
    expect(parseLatexDoc('\\alpha 崩壊')).toEqual([{ kind: 'text', text: '\\alpha 崩壊' }]);
  });
});

describe('escapeHtml', () => {
  it('HTML特殊文字を実体参照化する', () => {
    expect(escapeHtml(`<script>&"'`)).toBe('&lt;script&gt;&amp;&quot;&#39;');
  });
});

describe('renderDocHtml', () => {
  it('数式部にKaTeXのHTMLを含む', () => {
    expect(renderDocHtml('式 $x^2$ です')).toContain('class="katex"');
  });

  it('テキスト部の改行を<br/>にする', () => {
    expect(renderDocHtml('1行目\n2行目')).toContain('1行目<br/>2行目');
  });

  it('テキスト部のHTMLはエスケープされる', () => {
    const html = renderDocHtml('<b>bold</b>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('円記号(¥)をバックスラッシュとして扱う', () => {
    expect(renderDocHtml('$¥frac{1}{2}$')).toContain('class="katex"');
  });

  it('KaTeX非対応コマンドは赤字(#cc0000)のソース表示になる', () => {
    const html = renderDocHtml('$\\notacommand$');
    expect(html).toContain('color:#cc0000');
    expect(html).toContain('\\notacommand');
  });

  it('display数式の上下マージンを詰める', () => {
    expect(renderDocHtml('$$x$$')).toContain('style="margin:0.4em 0"');
  });
});

describe('docBounds', () => {
  it('上端は常に-height/2で固定される', () => {
    expect(docBounds(200, 100, 50).y).toBe(-50);
    expect(docBounds(200, 100, 300).y).toBe(-50);
  });

  it('高さはmax(枠, コンテンツ)で下方向にのみ伸びる', () => {
    expect(docBounds(200, 100, 50)).toEqual({ x: -100, y: -50, width: 200, height: 100 });
    expect(docBounds(200, 100, 300)).toEqual({ x: -100, y: -50, width: 200, height: 300 });
  });
});

describe('estimateDocHeight', () => {
  it('幅を半分にすると高さが増える', () => {
    const text = 'あいうえおかきくけこさしすせそたちつてと';
    expect(estimateDocHeight(text, 100, 16, 1.5)).toBeGreaterThan(
      estimateDocHeight(text, 200, 16, 1.5),
    );
  });

  it('空文字でも1行分の高さを返す', () => {
    expect(estimateDocHeight('', 200, 16, 1.5)).toBe(16 * 1.5);
  });
});
