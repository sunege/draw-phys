import { describe, expect, it } from 'vitest';
import {
  dashArray,
  lineFromDrag,
  segmentEndpoints,
  segmentFromEndpoints,
  wavyFilterId,
  wavyFilterRegion,
} from '../lineUtils';

describe('lineFromDrag', () => {
  it('水平ドラッグで中心・長さ・回転0を返す', () => {
    const { length, transform } = lineFromDrag({ x: 100, y: 50 }, { x: 200, y: 50 }, 100);
    expect(length).toBe(100);
    expect(transform.x).toBe(150);
    expect(transform.y).toBe(50);
    expect(transform.rotation).toBe(0);
  });

  it('斜めドラッグで角度が付く', () => {
    const { length, transform } = lineFromDrag({ x: 0, y: 0 }, { x: 100, y: 100 }, 100);
    expect(length).toBeCloseTo(Math.hypot(100, 100));
    expect(transform.rotation).toBeCloseTo(45);
    expect(transform.x).toBe(50);
    expect(transform.y).toBe(50);
  });

  it('クリックのみ(移動なし)は既定の長さで水平に置く', () => {
    const { length, transform } = lineFromDrag({ x: 10, y: 20 }, { x: 10, y: 20 }, 80);
    expect(length).toBe(80);
    expect(transform.rotation).toBe(0);
    // 始点が左端になるよう中心は右へ半分ずれる
    expect(transform.x).toBe(50);
    expect(transform.y).toBe(20);
  });
});

describe('segmentFromEndpoints', () => {
  it('2端点から長さ・中心・回転を復元する', () => {
    const { length, transform } = segmentFromEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(length).toBe(100);
    expect(transform.x).toBe(50);
    expect(transform.y).toBe(0);
    expect(transform.rotation).toBe(0);
    expect(transform.scaleX).toBe(1);
  });

  it('縦向きの端点で回転90度・中心が中点になる', () => {
    const { length, transform } = segmentFromEndpoints({ x: 20, y: 0 }, { x: 20, y: 100 });
    expect(length).toBe(100);
    expect(transform.rotation).toBeCloseTo(90);
    expect(transform.x).toBe(20);
    expect(transform.y).toBe(50);
  });

  it('端点が一致してもゼロ除算せず最小長でクランプ', () => {
    const { length } = segmentFromEndpoints({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(length).toBe(1);
  });
});

describe('segmentEndpoints', () => {
  it('長さから中心対称なローカル端点を返す', () => {
    expect(segmentEndpoints(100)).toEqual([
      { x: -50, y: 0 },
      { x: 50, y: 0 },
    ]);
  });
});

describe('dashArray', () => {
  it('破線・点線は線幅比例のダッシュを返す', () => {
    expect(dashArray('dashed', 2)).toBe('8 6');
    expect(dashArray('dotted', 2)).toBe('2 4');
  });

  it('二重線・手書き線・実線はundefined(dasharrayでは描かない)', () => {
    expect(dashArray('solid', 2)).toBeUndefined();
    expect(dashArray('double', 2)).toBeUndefined();
    expect(dashArray('wavy', 2)).toBeUndefined();
  });
});

describe('wavyFilterRegion', () => {
  it('外接矩形を振幅分だけ広げる', () => {
    const r = wavyFilterRegion({ x: -50, y: -50, width: 100, height: 100 });
    // WAVY_PAD=13 → 各辺13広げる
    expect(r).toEqual({ x: -63, y: -63, width: 126, height: 126 });
  });

  it('高さ0の水平線でも非退化な領域になる(退化するとフィルタが描画されない)', () => {
    const r = wavyFilterRegion({ x: -40, y: 0, width: 80, height: 0 });
    expect(r.height).toBeGreaterThan(0);
    expect(r.width).toBeGreaterThan(0);
  });
});

describe('wavyFilterId', () => {
  it('同一領域なら同じid(defs共有)', () => {
    const region = { x: -63, y: -63, width: 126, height: 126 };
    expect(wavyFilterId(region)).toBe(wavyFilterId(region));
  });

  it('負値はmでエンコードして有効なidにする', () => {
    expect(wavyFilterId({ x: -63, y: -63, width: 126, height: 126 })).toBe('wavy-m63_m63_126_126');
  });
});
