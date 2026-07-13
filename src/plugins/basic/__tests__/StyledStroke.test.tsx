import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StyledStroke } from '../StyledStroke';

const bounds = { x: -50, y: -50, width: 100, height: 100 };

function render(lineStyle: Parameters<typeof StyledStroke>[0]['lineStyle']) {
  return renderToStaticMarkup(
    <svg>
      <StyledStroke lineStyle={lineStyle} bounds={bounds}>
        <circle r={50} fill="#eee" stroke="#000000" strokeWidth={2} />
      </StyledStroke>
    </svg>,
  );
}

describe('StyledStroke', () => {
  it('実線はdasharrayなしの1要素', () => {
    const html = render('solid');
    expect(html.match(/<circle/g)).toHaveLength(1);
    expect(html).not.toContain('stroke-dasharray');
    expect(html).not.toContain('<filter');
  });

  it('破線はstrokeDasharrayを付ける', () => {
    const html = render('dashed');
    expect(html).toContain('stroke-dasharray="8 6"');
  });

  it('二重線は同じ図形を2枚重ね、中央を白で抜く', () => {
    const html = render('double');
    expect(html.match(/<circle/g)).toHaveLength(2);
    // 白抜きの内側と、太い線色の外側
    expect(html).toContain('stroke="#ffffff"');
    expect(html).toContain('stroke-width="6"'); // max(2*3,3)=6
  });

  it('手書き線はfeDisplacementMapフィルタを定義して適用する', () => {
    const html = render('wavy');
    expect(html).toContain('<filter');
    expect(html).toContain('feDisplacementMap');
    expect(html).toContain('feTurbulence');
    // 図形にfilterが参照されている
    expect(html).toMatch(/filter="url\(#wavy-[^"]+\)"/);
  });

  it('boundsが無ければ手書き線は実線扱い(フィルタを出さない)', () => {
    const html = renderToStaticMarkup(
      <svg>
        <StyledStroke lineStyle="wavy">
          <circle r={50} stroke="#000000" strokeWidth={2} />
        </StyledStroke>
      </svg>,
    );
    expect(html).not.toContain('<filter');
    expect(html).toContain('<circle');
  });
});
