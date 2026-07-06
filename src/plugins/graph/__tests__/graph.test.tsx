import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { identityTransform } from '../../../core/types';
import { graphPlugin } from '../graph';
import {
  createFunctionPlot,
  createScatterPlot,
  defaultGraphProps,
  type GraphProps,
} from '../graphTypes';

/** 既定propsのコピー(必要なら差分を上書き) */
function makeProps(patch: Partial<GraphProps> = {}): GraphProps {
  return { ...structuredClone(defaultGraphProps), ...patch };
}

/** 書き出しと同じ経路(renderToStaticMarkup・interactive無し)で描画する */
function render(props: GraphProps): string {
  return renderToStaticMarkup(
    createElement(graphPlugin.Renderer, { props, transform: identityTransform() }),
  );
}

describe('graphPlugin.Renderer', () => {
  it('既定propsで座標系(軸矢印・原点O・クリップ定義)を描く', () => {
    const markup = render(makeProps());
    expect(markup).toContain('<polygon'); // 軸矢印
    expect(markup).toContain('O</text>'); // 原点ラベル
    expect(markup).toContain('clipPath');
    expect(markup).not.toContain('<polyline'); // plots空=曲線なし
    // 書き出しには当たり判定用の透明rectを出さない
    expect(markup).not.toContain('fill="transparent"');
  });

  it('関数プロットを折れ線で描く(無効な式は描かない)', () => {
    const fn = { ...createFunctionPlot(0), expression: 'sin(x)' };
    expect(render(makeProps({ plots: [fn] }))).toContain('<polyline');
    const bad = { ...createFunctionPlot(0), expression: 'foo(' };
    expect(render(makeProps({ plots: [bad] }))).not.toContain('<polyline');
  });

  it('散布図はマーカー・近似直線・係数表示を描く', () => {
    const scatter = {
      ...createScatterPlot(0),
      points: [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ],
      fit: 'proportional' as const,
      showFitEq: true,
    };
    const markup = render(makeProps({ plots: [scatter] }));
    expect(markup).toContain('<circle'); // マーカー
    expect(markup).toContain('<polyline'); // 近似直線
    expect(markup).toContain('y = 2.00x'); // 係数表示
  });
});

describe('graphPlugin のフック', () => {
  it('zoomToRectはローカル矩形を新しい表示範囲へ変換する', () => {
    // 箱の左上4分の1(左上隅→中心)を指定 → x:[-5,0], y:[0,5]
    const next = graphPlugin.zoomToRect!(makeProps(), { x: -160, y: -120 }, { x: 0, y: 0 })!;
    expect(next.xMin).toBeCloseTo(-5);
    expect(next.xMax).toBeCloseTo(0);
    expect(next.yMin).toBeCloseTo(0);
    expect(next.yMax).toBeCloseTo(5);
    // 実質クリックはnull
    expect(graphPlugin.zoomToRect!(makeProps(), { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('movePart(origin)は表示範囲をパンする(スパン不変)', () => {
    // 原点を右へ32px(=1目盛り) → 範囲は左へ1シフト
    const next = graphPlugin.movePart!(
      makeProps(),
      identityTransform(),
      'origin',
      { x: 0, y: 0 },
      { x: 32, y: 0 },
    );
    expect(next.xMin).toBeCloseTo(-6);
    expect(next.xMax).toBeCloseTo(4);
    expect(next.yMin).toBeCloseTo(-5);
    expect(next.yMax).toBeCloseTo(5);
  });

  it('getPartsは原点ハンドルを返し、範囲外なら箱内へクランプする', () => {
    expect(graphPlugin.getParts!(makeProps())[0]).toMatchObject({
      id: 'origin',
      local: { x: 0, y: 0 },
    });
    const shifted = graphPlugin.getParts!(
      makeProps({ xMin: 1, xMax: 11, yMin: 2, yMax: 12 }),
    )[0];
    expect(shifted.local.x).toBeCloseTo(-160); // 左端
    expect(shifted.local.y).toBeCloseTo(120); // 下端
  });

  it('applyScaleは箱サイズへ焼き込み、表示範囲は変えない', () => {
    const next = graphPlugin.applyScale!(makeProps(), 2, 0.5);
    expect(next.width).toBe(640);
    expect(next.height).toBe(120);
    expect(next.xMin).toBe(-5);
  });

  it('getBoundsは箱とラベル・矢印を含む', () => {
    const b = graphPlugin.getBounds(makeProps());
    expect(b.width).toBeGreaterThanOrEqual(320);
    expect(b.height).toBeGreaterThanOrEqual(240);
  });
});
