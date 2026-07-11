import { describe, expect, it } from 'vitest';
import type { SegmentPick } from '../../../core/plugin';
import {
  filletFromPicks,
  filletFromResolved,
  filletGeometry,
  filletPath,
} from '../filletMath';

const approx = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
/** 角度は360の周期で比較(±180の符号ゆれを吸収) */
const approxAngle = (a: number, b: number, eps = 1e-6) => {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  expect(Math.abs(d)).toBeLessThan(eps);
};

describe('filletGeometry', () => {
  it('直角(腕=左/上, r=40)で接点・中心・掃引を正しく求める', () => {
    const geo = filletGeometry(180, -90, 40)!;
    expect(geo).not.toBeNull();
    // 頂点原点。接点は各腕方向に距離 t=r(45°)。
    approx(geo.tangentA.x, -40);
    approx(geo.tangentA.y, 0);
    approx(geo.tangentB.x, 0);
    approx(geo.tangentB.y, -40);
    // 中心は二等分方向(-1,-1)/√2 に r√2 = (-40,-40)
    approx(geo.center.x, -40);
    approx(geo.center.y, -40);
    // 各接点は中心から半径r
    approx(Math.hypot(geo.center.x - geo.tangentA.x, geo.center.y - geo.tangentA.y), 40);
    approx(Math.hypot(geo.center.x - geo.tangentB.x, geo.center.y - geo.tangentB.y), 40);
    approx(Math.abs(geo.sweepDeg), 90); // 掃引=180-なす角(90)
  });

  it('接線は各腕に垂直(接点で腕方向と中心→接点が直交)', () => {
    const geo = filletGeometry(0, 120, 30)!;
    const uA = { x: Math.cos(0), y: Math.sin(0) };
    const rA = { x: geo.tangentA.x - geo.center.x, y: geo.tangentA.y - geo.center.y };
    approx(uA.x * rA.x + uA.y * rA.y, 0, 1e-6); // 半径⊥接線
  });

  it('一直線(なす角180)・平行(0)・非正半径は角がなく null', () => {
    expect(filletGeometry(0, 180, 40)).toBeNull();
    expect(filletGeometry(30, 30, 40)).toBeNull();
    expect(filletGeometry(0, 90, 0)).toBeNull();
  });
});

describe('filletPath', () => {
  it('接点間を半径rの円弧で結ぶパス文字列を返す', () => {
    const geo = filletGeometry(180, -90, 40)!;
    const d = filletPath(geo);
    // "M x0 y0 A rx ry rot large sweep x1 y1" の9数値を許容誤差で確認
    const nums = d.match(/-?\d+\.?\d*(?:e-?\d+)?/gi)!.map(Number);
    expect(nums).toHaveLength(9);
    approx(nums[0], -40); // 接点A x
    approx(nums[1], 0); // 接点A y
    approx(nums[2], 40); // 半径rx
    approx(nums[3], 40); // 半径ry
    approx(nums[7], 0); // 接点B x
    approx(nums[8], -40); // 接点B y
  });
  it('null幾何なら空文字', () => {
    expect(filletPath(null)).toBe('');
  });
});

/** 水平線と鉛直線が (200,0) で交わるコーナーの2ピックを作る */
function cornerPicks(): SegmentPick[] {
  return [
    // 水平線: 左側(50,0)をクリック=左を残す
    { targetId: 'floor', segIndex: 0, worldPoint: { x: 50, y: 0 }, a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
    // 鉛直線: 上側(200,-50)をクリック=上を残す
    { targetId: 'wall', segIndex: 0, worldPoint: { x: 200, y: -50 }, a: { x: 200, y: 0 }, b: { x: 200, y: -200 } },
  ];
}

describe('filletFromPicks', () => {
  it('頂点=交点・腕角度・refs・母線trimを求める', () => {
    const s = filletFromPicks(cornerPicks(), 40)!;
    expect(s).not.toBeNull();
    approx(s.vertex.x, 200);
    approx(s.vertex.y, 0);
    approxAngle(s.armA, 180); // 残す側=左向き
    approxAngle(s.armB, -90); // 残す側=上向き
    expect(s.refs.map((r) => r.role)).toEqual(['a', 'b']);
    expect(s.refs[0]).toMatchObject({ targetId: 'floor', kind: 'segment', mode: 'neg' });
    expect(s.refs[1]).toMatchObject({ targetId: 'wall', kind: 'segment', mode: 'pos' });
  });

  it('母線を接点(頂点から距離r)まで詰める。残す端点は保持し向きは維持', () => {
    const picks = cornerPicks();
    const s = filletFromPicks(picks, 40)!;
    expect(s.hostTrims).toHaveLength(2);
    // 各trimの端点集合が{残す端点, 接点}であること(順序不問)
    const hasPoints = (t: { a: { x: number; y: number }; b: { x: number; y: number } }, p: number[], q: number[]) => {
      const near = (u: { x: number; y: number }, v: number[]) => Math.hypot(u.x - v[0], u.y - v[1]) < 1e-6;
      return (near(t.a, p) && near(t.b, q)) || (near(t.a, q) && near(t.b, p));
    };
    const floor = s.hostTrims.find((t) => t.targetId === 'floor')!;
    expect(hasPoints(floor, [0, 0], [160, 0])).toBe(true); // 残す端点(0,0)・接点(160,0)
    const wall = s.hostTrims.find((t) => t.targetId === 'wall')!;
    expect(hasPoints(wall, [200, -200], [200, -40])).toBe(true); // 残す端点・接点(頂点から40)
    // 元の線分向き(pick.a→pick.b)を維持: (b-a)·dir >= 0(mode符号が壊れない)
    for (const [tr, pk] of [[floor, picks[0]], [wall, picks[1]]] as const) {
      const dir = { x: pk.b.x - pk.a.x, y: pk.b.y - pk.a.y };
      expect((tr.b.x - tr.a.x) * dir.x + (tr.b.y - tr.a.y) * dir.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('半径が線分長より大きく接点が届かない側はtrimしない', () => {
    // 鉛直線を短く(端点が接点に届かない)
    const picks = cornerPicks();
    picks[1].b = { x: 200, y: -20 }; // 長さ20 < r=40
    const s = filletFromPicks(picks, 40)!;
    expect(s.hostTrims.some((t) => t.targetId === 'wall')).toBe(false);
    expect(s.hostTrims.some((t) => t.targetId === 'floor')).toBe(true);
  });

  it('平行な2線分(交点なし)は null', () => {
    const picks: SegmentPick[] = [
      { targetId: 'a', segIndex: 0, worldPoint: { x: 50, y: 0 }, a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
      { targetId: 'b', segIndex: 0, worldPoint: { x: 50, y: 50 }, a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
    ];
    expect(filletFromPicks(picks, 40)).toBeNull();
  });
});

describe('filletFromResolved', () => {
  it('2腕の点+接線から頂点と腕角度を復元する', () => {
    const r = filletFromResolved({ x: 50, y: 0 }, { x: -1, y: 0 }, { x: 200, y: -50 }, { x: 0, y: -1 })!;
    approx(r.vertex.x, 200);
    approx(r.vertex.y, 0);
    approxAngle(r.armA, 180);
    approxAngle(r.armB, -90);
  });
});
