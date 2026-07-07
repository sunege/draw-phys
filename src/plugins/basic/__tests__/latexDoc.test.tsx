import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { latexDocPlugin, type LatexDocProps } from '../latexDoc';

const baseProps: LatexDocProps = {
  ...latexDocPlugin.defaultProps,
  source: 'テスト文章 $x^2$',
  width: 200,
  height: 100,
};

describe('latexDocPlugin.applyScale', () => {
  it('fontSizeを変えずwidth/heightだけ変える', () => {
    const next = latexDocPlugin.applyScale!(baseProps, 2, 1.5);
    expect(next.fontSize).toBe(baseProps.fontSize);
    expect(next.width).toBe(400);
    expect(next.source).toBe(baseProps.source);
  });

  it('縮小しても最小サイズでクランプされる', () => {
    const next = latexDocPlugin.applyScale!(baseProps, 0.01, 0.01);
    expect(next.width).toBe(40);
    expect(next.height).toBe(24);
  });

  it('縦の拡縮は実効高(コンテンツがはみ出た高さ)基準になる', () => {
    // node環境では概算実測: 十分長い文章で contentHeight > height にする
    const long = { ...baseProps, source: 'あ'.repeat(500), height: 30 };
    const effHeight = latexDocPlugin.getBounds(long).height;
    expect(effHeight).toBeGreaterThan(30);
    const next = latexDocPlugin.applyScale!(long, 1, 2);
    expect(next.height).toBeCloseTo(effHeight * 2);
  });
});

describe('latexDocPlugin.getBounds', () => {
  it('枠上端は常に-height/2で固定される', () => {
    expect(latexDocPlugin.getBounds(baseProps).y).toBe(-50);
    const long = { ...baseProps, source: 'あ'.repeat(500) };
    expect(latexDocPlugin.getBounds(long).y).toBe(-50);
  });

  it('コンテンツが枠に収まるときは枠サイズを返す', () => {
    const b = latexDocPlugin.getBounds({ ...baseProps, source: '短い' });
    expect(b).toEqual({ x: -100, y: -50, width: 200, height: 100 });
  });

  it('コンテンツが枠を超えると下方向にのみ伸びる', () => {
    const long = { ...baseProps, source: 'あ'.repeat(500) };
    const b = latexDocPlugin.getBounds(long);
    expect(b.height).toBeGreaterThan(100);
    expect(b.y + b.height).toBeGreaterThan(50); // 下端が伸びる
  });
});

describe('latexDocPlugin.Renderer', () => {
  it('foreignObjectの幅=枠幅、上端=-height/2で描画する', () => {
    const html = renderToStaticMarkup(<latexDocPlugin.Renderer props={baseProps} />);
    expect(html).toContain('<foreignObject x="-100" y="-50" width="200"');
    expect(html).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('bg=falseでも枠全体の透明rectで当たり判定を確保する', () => {
    const html = renderToStaticMarkup(<latexDocPlugin.Renderer props={baseProps} />);
    expect(html).toContain('fill="transparent"');
  });

  it('bg=trueで白背景になる', () => {
    const html = renderToStaticMarkup(
      <latexDocPlugin.Renderer props={{ ...baseProps, bg: true }} />,
    );
    expect(html).toContain('fill="#ffffff"');
  });

  it('数式がKaTeXのHTMLとして埋め込まれる', () => {
    const html = renderToStaticMarkup(<latexDocPlugin.Renderer props={baseProps} />);
    expect(html).toContain('class="katex"');
  });
});
