import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { identityTransform } from '../../../core/types';
import { angleMarkPlugin } from '../../annotation/angleMark';
import { lengthMarkPlugin } from '../../annotation/lengthMark';
import { blockPlugin } from '../../mechanics/block';
import { vectorPlugin } from '../../mechanics/vector';
import { moveLabelOffset } from '../objectLabel';

function render(plugin: { Renderer: React.ComponentType<any> }, props: unknown, rotation = 0): string {
  return renderToStaticMarkup(
    createElement(plugin.Renderer, {
      props,
      transform: { ...identityTransform(), rotation },
      interactive: true,
      objectId: 'obj-1',
    }),
  );
}

describe('moveLabelOffset', () => {
  it('回転0ではワールド移動量をそのままoffsetに加える', () => {
    const props = { labelDx: 5, labelDy: 5, labelBg: false };
    const next = moveLabelOffset(props, { ...identityTransform(), rotation: 0 }, { x: 0, y: 0 }, { x: 10, y: -4 });
    expect(next.labelDx).toBeCloseTo(15);
    expect(next.labelDy).toBeCloseTo(1);
  });

  it('回転90ではワールド移動量を逆回転して局所offsetに変換する', () => {
    const props = { labelDx: 0, labelDy: 0, labelBg: false };
    // ワールドで +x に10動かす → 局所(-90°回転)では +y ではなく -y 方向
    const next = moveLabelOffset(props, { ...identityTransform(), rotation: 90 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(next.labelDx).toBeCloseTo(0);
    expect(next.labelDy).toBeCloseTo(-10);
  });
});

describe('ラベルの共通機能(要件: LaTeX / 常時正立 / 背景 / ドラッグ当たり判定)', () => {
  it('block: 回転してもラベルは逆回転で正立する', () => {
    const markup = render(blockPlugin, { ...blockPlugin.defaultProps }, 40);
    expect(markup).toContain('rotate(-40)');
  });

  it('block: LaTeXモードでKaTeXを描画する', () => {
    const markup = render(blockPlugin, { ...blockPlugin.defaultProps, labelMode: 'latex', labelLatex: 'F=ma' });
    expect(markup).toContain('katex');
    expect(markup).toContain('<foreignObject');
  });

  it('block: 背景ONで白い矩形を敷く', () => {
    const on = render(blockPlugin, { ...blockPlugin.defaultProps, labelBg: true });
    expect(on).toContain('fill="#ffffff"');
    const off = render(blockPlugin, { ...blockPlugin.defaultProps, labelBg: false });
    expect(off).not.toContain('fill="#ffffff"');
  });

  it('block: interactiveのときドラッグ用の data-object-label を付ける', () => {
    const markup = render(blockPlugin, { ...blockPlugin.defaultProps });
    expect(markup).toContain('data-object-label="obj-1"');
  });

  it('block: 書き出し(interactive未指定)ではdata属性を付けない', () => {
    const markup = renderToStaticMarkup(
      createElement(blockPlugin.Renderer, {
        props: blockPlugin.defaultProps,
        transform: identityTransform(),
      }),
    );
    expect(markup).not.toContain('data-object-label');
  });

  it('block: labelDx/labelDy がラベルの平行移動に反映される', () => {
    const markup = render(blockPlugin, { ...blockPlugin.defaultProps, labelDx: 12, labelDy: -7 });
    expect(markup).toContain('translate(12 -7)');
  });

  it('vector: ラベルが正立しLaTeX/背景に対応する', () => {
    const markup = render(
      vectorPlugin,
      { ...vectorPlugin.defaultProps, labelMode: 'latex', labelLatex: '\\vec{v}', labelBg: true },
      30,
    );
    expect(markup).toContain('rotate(-30)');
    expect(markup).toContain('katex');
    expect(markup).toContain('fill="#ffffff"');
  });

  it('lengthMark: 傾いた寸法線でもラベルは正立する', () => {
    const markup = render(lengthMarkPlugin, { ...lengthMarkPlugin.defaultProps, labelBg: true }, 25);
    expect(markup).toContain('rotate(-25)');
    expect(markup).toContain('fill="#ffffff"');
  });

  it('angleMark: LaTeXラベルを描画する', () => {
    const markup = render(angleMarkPlugin, { ...angleMarkPlugin.defaultProps, labelMode: 'latex' });
    expect(markup).toContain('katex');
  });

  it('全ラベルプラグインが moveLabel を実装している', () => {
    for (const plugin of [blockPlugin, vectorPlugin, lengthMarkPlugin, angleMarkPlugin]) {
      expect(typeof plugin.moveLabel).toBe('function');
    }
  });
});
