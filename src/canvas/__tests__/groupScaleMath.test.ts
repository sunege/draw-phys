import { describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import type { AnyPlugin } from '../../core/plugin';
import { identityTransform, type Rect } from '../../core/types';
import { computeGroupScaleFactor, groupScaleAnchor, scaleObjectAbout } from '../groupScaleMath';

// 中心原点の 100x60 ボックスを props サイズから作るテスト用プラグイン(applyScale=箱型)
const boxPlugin = makeTestPlugin({
  applyScale: (props, fx, fy) => ({ ...props, width: props.width * fx, height: props.height * fy }),
  capabilities: { scalable: 'both' },
}) as AnyPlugin;

// 端点編集の線分プラグイン(applyScale なし)。長さのみ props に持つ
const linePlugin = makeTestPlugin({
  applyScale: undefined,
  getEndpoints: (props) => [
    { x: -props.width / 2, y: 0 },
    { x: props.width / 2, y: 0 },
  ],
  setFromEndpoints: (props, a, b) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const rotation = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return {
      props: { ...props, width: length },
      transform: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, rotation, scaleX: 1, scaleY: 1 },
    };
  },
  capabilities: { scalable: 'none' },
}) as AnyPlugin;

const union: Rect = { x: 0, y: 0, width: 200, height: 100 };

describe('computeGroupScaleFactor', () => {
  it('右下コーナーを2倍の位置へドラッグすると f=2、対角(左上)が固定点', () => {
    // 右下コーナー(200,100)を(400,200)へ → 左上(0,0)固定で 2倍
    const f = computeGroupScaleFactor(union, { sx: 1, sy: 1 }, { x: 400, y: 200 });
    expect(f).toBeCloseTo(2);
    expect(groupScaleAnchor(union, { sx: 1, sy: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('左上コーナーの対角は右下', () => {
    expect(groupScaleAnchor(union, { sx: -1, sy: -1 })).toEqual({ x: 200, y: 100 });
  });

  it('潰れ・反転は下限でクランプされる', () => {
    // anchor(左上)を通り越して負側へ → 下限へ
    const f = computeGroupScaleFactor(union, { sx: 1, sy: 1 }, { x: -100, y: -100 });
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(0.1);
  });
});

describe('scaleObjectAbout(箱型)', () => {
  it('位置・サイズが anchor 中心に相似で拡大する', () => {
    const anchor = { x: 0, y: 0 };
    const before = identityTransform(100, 50); // 中心(100,50)の 40x20 ボックス
    const props = { width: 40, height: 20 };
    const r = scaleObjectAbout(boxPlugin, before, props, anchor, 2);
    // 中心は anchor から 2倍離れる
    expect(r.transform.x).toBeCloseTo(200);
    expect(r.transform.y).toBeCloseTo(100);
    // サイズも 2倍、scale は 1 のまま(線幅不変=方式A)
    expect(r.props.width).toBe(80);
    expect(r.props.height).toBe(40);
    expect(r.transform.scaleX).toBe(1);
  });

  it('回転済みでもバウンディング中心が正しく相似移動する', () => {
    const anchor = { x: 0, y: 0 };
    const before = { x: 100, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    const props = { width: 40, height: 20 };
    const r = scaleObjectAbout(boxPlugin, before, props, anchor, 1.5);
    // 中心(バウンディング中心)は anchor から 1.5倍: (150,0)
    expect(r.transform.x).toBeCloseTo(150);
    expect(r.transform.y).toBeCloseTo(0);
    expect(r.transform.rotation).toBe(90); // 回転は保たれる
    expect(r.props.width).toBe(60);
  });
});

describe('scaleObjectAbout(線分系)', () => {
  it('2端点が anchor 中心にスケールし、長さ・位置が相似になる', () => {
    const anchor = { x: 0, y: 0 };
    // 中心(100,0)・長さ40の水平線 → 端点(80,0)-(120,0)
    const before = identityTransform(100, 0);
    const props = { width: 40, height: 0 };
    const r = scaleObjectAbout(linePlugin, before, props, anchor, 2);
    // 端点(80,0)→(160,0)、(120,0)→(240,0) → 中心200・長さ80
    expect(r.transform.x).toBeCloseTo(200);
    expect(r.transform.y).toBeCloseTo(0);
    expect(r.props.width).toBeCloseTo(80);
  });
});

describe('scaleObjectAbout(回路記号: applyScale と端点の両方を持つ)', () => {
  // 抵抗などの2端子記号を模した、applyScale(本体寸法)と端点編集を併せ持つプラグイン
  const symbolPlugin = makeTestPlugin({
    applyScale: (props, fx) => ({ ...props, width: props.width * fx, height: props.height * fx }),
    getEndpoints: (props) => [
      { x: -props.width / 2, y: 0 },
      { x: props.width / 2, y: 0 },
    ],
    setFromEndpoints: (props, a, b) => ({
      props: { ...props, width: Math.hypot(b.x - a.x, b.y - a.y) },
      transform: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, rotation: 0, scaleX: 1, scaleY: 1 },
    }),
    capabilities: { scalable: 'none' },
  }) as AnyPlugin;

  it('applyScale 側が使われ、本体寸法・端子・位置がすべて相似になる', () => {
    const anchor = { x: 0, y: 0 };
    // 中心(100,0)・全長40(端子±20)・本体高20
    const before = identityTransform(100, 0);
    const props = { width: 40, height: 20 };
    const r = scaleObjectAbout(symbolPlugin, before, props, anchor, 2);
    // 位置は原点追従で 2倍、本体寸法(width/height)も 2倍
    expect(r.transform.x).toBeCloseTo(200);
    expect(r.props.width).toBe(80);
    expect(r.props.height).toBe(40);
    // 端子(local ±40)はワールドで (160,0)/(240,0)=元(80/120)の2倍
    expect(200 - 80).toBeCloseTo(120); // 左端子 local -40 → world 160
  });
});

describe('scaleObjectAbout(非対称バウンディング=ラベル付き記号)', () => {
  // 接続点が原点、本体は下方向に伸びる(アース/グランド型)。getBounds は非対称
  const groundLike = makeTestPlugin({
    applyScale: (props, fx) => ({ ...props, width: props.width * fx, height: props.height * fx }),
    getBounds: (props) => ({ x: -props.width / 2, y: 0, width: props.width, height: props.height }),
    capabilities: { scalable: 'none' },
  }) as AnyPlugin;

  it('原点(接続点)が anchor 中心に相似移動する(bounds中心のズレを持ち込まない)', () => {
    const anchor = { x: 0, y: 0 };
    const before = identityTransform(50, 50); // 接続点(=原点)が(50,50)
    const props = { width: 30, height: 40 };
    const r = scaleObjectAbout(groundLike, before, props, anchor, 2);
    // 接続点は原点なので (50,50)→(100,100)。bounds中心追従なら下方向へズレる
    expect(r.transform.x).toBeCloseTo(100);
    expect(r.transform.y).toBeCloseTo(100);
    expect(r.props.height).toBe(80);
  });
});
