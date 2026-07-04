import type { ComponentType } from 'react';
import type { ObjectRef, Point, Rect, Transform } from './types';

/** プロパティパネル自動生成用のフィールド定義 */
interface PropertyFieldBase {
  /** props内のキー */
  key: string;
  /** パネルに表示するラベル(日本語) */
  label: string;
}

export type PropertyField =
  | (PropertyFieldBase & { type: 'number'; min?: number; max?: number; step?: number })
  | (PropertyFieldBase & { type: 'text' })
  | (PropertyFieldBase & { type: 'multiline' })
  | (PropertyFieldBase & { type: 'color' })
  | (PropertyFieldBase & { type: 'boolean' })
  | (PropertyFieldBase & { type: 'select'; options: { value: string; label: string }[] });

/** 配置操作の種別。'pick-segments' は既存の線分オブジェクトを2つクリックして生成する */
export type PlacementMode = 'click' | 'drag-rect' | 'drag-line' | 'pick-segments';

/** 円・円弧の幾何情報(ローカル座標)。拘束・測定の相手として使う */
export interface CircleGeometry {
  center: Point;
  radius: number;
  /** 円弧の場合の角度範囲(度)。円なら省略 */
  startAngle?: number;
  endAngle?: number;
}

/** 拘束ソルバが依存側プラグインへ渡す、解決済みアンカー(すべてワールド座標) */
export interface ResolvedRef {
  /** プラグイン定義のスロット名 */
  role: string;
  /** アンカー点 */
  point: Point;
  /** 接線/線分方向の単位ベクトル(円周・線分上のとき) */
  tangent?: Point;
  /** 円拘束のときのワールド半径 */
  radius?: number;
}

/** pick-segments 配置で1回のクリックが選んだ線分と、その線分上のクリック位置 */
export interface SegmentPick {
  targetId: string;
  segIndex: number;
  /** クリックしたワールド座標(腕の向き決定に使う) */
  worldPoint: Point;
  /** 線分の2端点(ワールド座標) */
  a: Point;
  b: Point;
}

export interface PluginCapabilities {
  rotatable?: boolean;
  /** 'x' はローカルX軸方向(線の長さ方向)のみ拡大縮小可 */
  scalable?: 'both' | 'uniform' | 'x' | 'none';
}

/** 端点編集(2端点をドラッグして形状を決める)を行う結果 */
export interface EndpointEditResult<P> {
  props: P;
  transform: Transform;
}

/**
 * 物理オブジェクトプラグインの共通インターフェース。
 *
 * プラグインはローカル座標系(原点=オブジェクト中心)で描画する。
 * 移動・回転・拡大縮小はアプリ本体が transform で一元的に処理するため、
 * プラグイン側で意識する必要はない。
 */
export interface PhysicsObjectPlugin<P = Record<string, unknown>> {
  /** 一意なID(例: "core.spring") */
  id: string;
  /** propsスキーマのバージョン。migrate() での移行判定に使う */
  version: number;
  /** ツールボックスに表示する名前 */
  name: string;
  /** ツールボックスの分類(例: "基本図形", "力学") */
  category: string;
  /** ツールボックス用アイコン(24x24想定のSVG) */
  Icon: ComponentType;
  defaultProps: P;
  defaultSize: { width: number; height: number };
  /** プロパティパネルを自動生成するためのスキーマ */
  propertySchema: PropertyField[];
  /** ローカル座標系でのSVG描画 */
  Renderer: ComponentType<{ props: P }>;
  /** ローカル座標でのバウンディングボックス */
  getBounds(props: P): Rect;
  /** ローカル座標でのスナップ位置(端点・中心など) */
  getSnapPoints?(props: P): Point[];
  /**
   * ローカル座標での線分(端点スナップの吸着相手に使う)。
   * 線・床・矩形の辺などを返すと、他オブジェクトの端点がこの線分上へ吸着できる。
   */
  getSegments?(props: P): [Point, Point][];
  /**
   * ローカル座標での円/円弧の幾何情報。円・円弧が返すと、
   * 接線拘束や長さマークの半径/直径測定の相手になれる。
   */
  getCircle?(props: P): CircleGeometry | null;
  /**
   * 拘束ソルバが、参照先(refs)の現在位置から解決したアンカーを渡す。
   * 依存側プラグイン(角度マーク・長さマーク・接線接続された線)が、
   * これらから自分の transform / props を再構築する。
   * 解決できたアンカーが不足する場合は現状維持({ props, transform })を返すこと。
   */
  applyRefs?(props: P, resolved: ResolvedRef[], transform: Transform): EndpointEditResult<P>;
  /**
   * 拡大縮小を transform ではなく props へ反映する箱型オブジェクト用。
   * これを定義したプラグインは transform の scale を常に 1 に保ち、
   * サイズ(幅・半径・フォントサイズ等)を props として持つため、
   * 線幅は拡大縮小の影響を受けない(要件: 線幅は変えず文字サイズは変える)。
   */
  applyScale?(props: P, factorX: number, factorY: number): P;
  /**
   * 端点編集を持つ線分系オブジェクト用。ローカル座標の2端点を返す。
   * これを定義すると単一選択時に端点ハンドルが表示される。
   */
  getEndpoints?(props: P): [Point, Point];
  /**
   * 2端点(ワールド座標)から props と transform を再構築する。
   * getEndpoints を定義する場合は必須。
   */
  setFromEndpoints?(props: P, a: Point, b: Point): EndpointEditResult<P>;
  /** 旧バージョンのpropsを現行スキーマへ移行する */
  migrate?(fromVersion: number, props: unknown): P;
  capabilities?: PluginCapabilities;
  /** 配置操作の種別(省略時は click) */
  placement?: PlacementMode;
  /**
   * ドラッグ配置(drag-line / drag-rect)時に、始点と終点から
   * 初期プロパティとtransformを決める。placementがドラッグ系の場合は必須。
   */
  createFromDrag?(start: Point, end: Point): { props: P; transform: Transform };
  /**
   * pick-segments 配置時に、2つの線分ピックから props / transform / refs を決める。
   * placement が 'pick-segments' の場合は必須。
   */
  createFromPicks?(picks: SegmentPick[]): { props: P; transform: Transform; refs: ObjectRef[] };
  /**
   * SVG書き出し時に埋め込むCSS(フォント等はdata URIで自己完結させること)。
   * このプラグインのオブジェクトが書き出し対象に含まれる場合のみ呼ばれる。
   */
  exportStyles?(): Promise<string>;
}

/** レジストリ等で種類を問わずプラグインを扱うための型 */
// oxlint-disable-next-line no-explicit-any
export type AnyPlugin = PhysicsObjectPlugin<any>;
