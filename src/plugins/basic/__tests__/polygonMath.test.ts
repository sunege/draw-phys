import { describe, expect, it } from 'vitest';
import type { Point, Transform } from '../../../core/types';
import {
  canAppendVertex,
  canClosePolygon,
  isSimplePolygon,
  mirrorPolygon,
  movePolygonEdge,
  movePolygonVertex,
  polygonBounds,
  polygonEdges,
  polygonFromWorldPoints,
  polygonSnapPoints,
  scalePolygon,
  segmentsIntersect,
  worldDeltaToLocal,
} from '../polygonMath';

/** 単位正方形(反時計回りでない画面座標系での時計回り) */
const square: Point[] = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

const identity: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

describe('polygonEdges / polygonBounds / polygonSnapPoints', () => {
  it('辺は頂点i→i+1で、末尾は先頭へ閉じる', () => {
    const edges = polygonEdges(square);
    expect(edges).toHaveLength(4);
    expect(edges[3]).toEqual([{ x: -10, y: 10 }, { x: -10, y: -10 }]);
  });

  it('外接矩形は全頂点を含む', () => {
    expect(polygonBounds(square)).toEqual({ x: -10, y: -10, width: 20, height: 20 });
  });

  it('スナップ点は先頭が頂点、続いて辺の中点(一致拘束のpointIndexが安定する)', () => {
    const pts = polygonSnapPoints(square);
    expect(pts.slice(0, 4)).toEqual(square);
    expect(pts[4]).toEqual({ x: 0, y: -10 }); // 辺0の中点
    expect(pts).toHaveLength(8);
  });
});

describe('segmentsIntersect', () => {
  it('交差する線分を検出する', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
  });

  it('離れた線分は交差しない', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false);
  });

  it('端点で接するだけでも交差とみなす(頂点が辺に乗るのを禁止する)', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }),
    ).toBe(true);
  });
});

describe('isSimplePolygon', () => {
  it('正方形は単純', () => {
    expect(isSimplePolygon(square)).toBe(true);
  });

  it('頂点2つ以下は不可', () => {
    expect(isSimplePolygon(square.slice(0, 2))).toBe(false);
  });

  it('たすき掛け(蝶ネクタイ)は自己交差', () => {
    const bowtie = [
      { x: -10, y: -10 },
      { x: 10, y: 10 },
      { x: 10, y: -10 },
      { x: -10, y: 10 },
    ];
    expect(isSimplePolygon(bowtie)).toBe(false);
  });

  it('頂点が重なる(長さ0の辺)のは不可', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(false);
  });

  it('180°折り返して重なる辺は不可', () => {
    expect(
      isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 10 },
      ]),
    ).toBe(false);
  });
});

describe('作成中の判定', () => {
  it('既存の辺と交差する頂点は足せない', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ];
    // 最初の辺(0,0)-(20,0)を跨ぐ位置
    expect(canAppendVertex(path, { x: 10, y: -10 })).toBe(false);
    expect(canAppendVertex(path, { x: 0, y: 20 })).toBe(true);
  });

  it('直前の頂点と同じ位置には足せない', () => {
    expect(canAppendVertex([{ x: 0, y: 0 }], { x: 0, y: 0 })).toBe(false);
  });

  it('3頂点未満では閉じられない', () => {
    expect(canClosePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(false);
    expect(canClosePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(true);
  });
});

describe('頂点・辺ドラッグ', () => {
  it('頂点ドラッグは掴んだ頂点だけを動かす(他の頂点=拘束の局所アンカーは不動)', () => {
    const next = movePolygonVertex(square, 1, { x: 5, y: -5 });
    expect(next).not.toBeNull();
    expect(next![1]).toEqual({ x: 15, y: -15 });
    expect(next![0]).toEqual(square[0]);
    expect(next![2]).toEqual(square[2]);
  });

  it('辺ドラッグは辺の両端を平行移動する(向き・長さは不変)', () => {
    const next = movePolygonEdge(square, 0, { x: 0, y: -6 })!;
    expect(next[0]).toEqual({ x: -10, y: -16 });
    expect(next[1]).toEqual({ x: 10, y: -16 });
    expect(next[2]).toEqual(square[2]);
  });

  it('自己交差する移動は null(呼び出し側は元の形を保つ)', () => {
    // 頂点0(左上)を右辺の外へ引っ張ると、左辺が右辺を跨いで交差する
    expect(movePolygonVertex(square, 0, { x: 30, y: 10 })).toBeNull();
  });

  it('ワールド移動量は回転を外してローカルへ', () => {
    const d = worldDeltaToLocal({ x: 0, y: 10 }, { ...identity, rotation: 90 });
    expect(d.x).toBeCloseTo(10);
    expect(d.y).toBeCloseTo(0);
  });
});

describe('scalePolygon / polygonFromWorldPoints', () => {
  it('拡大縮小は頂点座標へ焼き込む(線幅は変わらない)', () => {
    expect(scalePolygon(square, 2, 0.5)[2]).toEqual({ x: 20, y: 5 });
  });

  it('生成時は頂点の重心をローカル原点に置く', () => {
    const { points, transform } = polygonFromWorldPoints([
      { x: 100, y: 100 },
      { x: 120, y: 100 },
      { x: 120, y: 120 },
      { x: 100, y: 120 },
    ]);
    expect(transform.x).toBeCloseTo(110);
    expect(transform.y).toBeCloseTo(110);
    expect(transform.rotation).toBe(0);
    expect(points[0]).toEqual({ x: -10, y: -10 });
  });
});

describe('mirrorPolygon', () => {
  it('縦軸に関する鏡像で頂点のワールド位置が反射される(手性も反転)', () => {
    const t: Transform = { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const tri: Point[] = [
      { x: 0, y: -10 },
      { x: 20, y: 10 },
      { x: -10, y: 10 },
    ];
    // x=0 の縦軸
    const m = mirrorPolygon(tri, t, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(m.transform.x).toBeCloseTo(-50);
    // ワールド頂点が反射されている(x符号反転・yそのまま)
    const world = m.points.map((p) => ({
      x: m.transform.x + p.x * Math.cos((m.transform.rotation * Math.PI) / 180) - p.y * Math.sin((m.transform.rotation * Math.PI) / 180),
      y: m.transform.y + p.x * Math.sin((m.transform.rotation * Math.PI) / 180) + p.y * Math.cos((m.transform.rotation * Math.PI) / 180),
    }));
    expect(world[0].x).toBeCloseTo(-50);
    expect(world[0].y).toBeCloseTo(-10);
    expect(world[1].x).toBeCloseTo(-70);
    expect(world[1].y).toBeCloseTo(10);
  });
});
