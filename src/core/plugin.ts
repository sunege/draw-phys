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

/** 配置中にクリックしたオブジェクトのエッジ(線分)または円周の情報 */
export type EdgePick =
  | { kind: 'segment'; targetId: string; segIndex: number }
  | { kind: 'circle'; targetId: string; /** クリック点のローカル角度(度) */ t: number };

/**
 * トリム(部分削除)後に「残す1区間」。本体(trim.ts)が交点計算で算出しプラグインへ渡す。
 * - segment: クリック曲線のパラメタ範囲 [from,to]⊂[0,1]
 * - arc: ローカル角度(度)。from→to(増加方向)を残す。円は補角、円弧は掃引内の残片。
 */
export type TrimKeep =
  | { kind: 'segment'; from: number; to: number }
  | { kind: 'arc'; fromDeg: number; toDeg: number };

/** トリム後に残る1部品(1シーンオブジェクトになる)。pluginId を変えられる(円→円弧) */
export interface TrimPiece {
  pluginId: string;
  props: Record<string, unknown>;
  transform: Transform;
}

export interface PluginCapabilities {
  rotatable?: boolean;
  /** 'x' はローカルX軸方向(線の長さ方向)のみ拡大縮小可 */
  scalable?: 'both' | 'uniform' | 'x' | 'none';
  /**
   * 作図の補助線(コンストラクション)に切り替えられるか。
   * true のオブジェクトは「コンストラクション」トグルが有効になり、
   * ON のとき色付き点線で描かれ書き出しから除外される(線・円が対象)。
   */
  construction?: boolean;
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
  /**
   * プロパティパネル下部に差し込むプラグイン独自UI(任意)。
   * スキーマでは表現できない配列・ボタン等を持つプラグイン(グラフ等)が使う。
   * コンポーネント側で documentStore の updateProps 等を直接呼んで props を更新する。
   */
  PanelExtra?: ComponentType<{ objectId: string; props: P }>;
  /**
   * オブジェクトのダブルクリック/プロパティパネルの編集ボタンで画面中央に開く
   * 大型エディタモーダル(任意)。本体は「これを持つか」だけを見て開閉し、
   * 中身には関知しない。モーダル側が documentStore の
   * setObjectTransient / commitObject で編集を反映する。
   */
  EditorModal?: ComponentType<{ objectId: string; onClose(): void }>;
  /** クリック配置の直後に EditorModal を自動で開く(文章系オブジェクト向け) */
  openEditorOnCreate?: boolean;
  /**
   * ローカル座標系でのSVG描画。
   * ラベル付きオブジェクトは transform(回転の打ち消し用)や objectId
   * (ラベルドラッグの当たり判定用)、interactive(操作可否)を受け取る。
   * 書き出し・プレビューでは interactive=false で呼ばれる。
   */
  Renderer: ComponentType<{
    props: P;
    transform?: Transform;
    objectId?: string;
    interactive?: boolean;
  }>;
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
   * 拘束されたオブジェクトの本体ドラッグを、平行オフセット等のprops変更として解釈する。
   * 長さマークが「測定線分と平行なオフセット」をドラッグで変えるのに使う。
   * これを持つ ref 付きオブジェクトは、本体ドラッグが移動ではなくこの更新になる。
   */
  dragOffset?(props: P, transform: Transform, world: Point): P;
  /**
   * 円拘束された線の「接点」のローカル位置。接続点ハンドルの表示位置に使う。
   * 既定では中点(0,0)だが、片側長さ変更で接点が中点からずれる。
   */
  getAnchorPoint?(props: P): Point;
  /**
   * 円拘束された線で端点をドラッグしたときの props 更新。
   * 接点と反対側の端点を固定したまま、ドラッグした端点までの長さ(片側)だけを変える。
   */
  dragEndpointConstrained?(props: P, transform: Transform, end: 0 | 1, world: Point): P;
  /**
   * ラベルを持つオブジェクト用。ラベルをワールド上でドラッグしたときに、
   * ラベルのオフセット(labelDx/labelDy)を更新した props を返す。
   * これを定義すると、選択中オブジェクトのラベルをドラッグで動かせる。
   */
  moveLabel?(props: P, transform: Transform, fromWorld: Point, toWorld: Point): P;
  /**
   * 単一選択中に表示する追加ドラッグハンドル(ローカル座標)。
   * グラフの原点ハンドルなど、端点編集に当てはまらない操作点に使う。
   * movePart とセットで定義する。
   */
  getParts?(props: P): { id: string; local: Point; title?: string }[];
  /**
   * パーツハンドルのドラッグ(moveLabelと同型)。ドラッグ開始時の props と
   * 開始点 fromWorld・現在点 toWorld から毎回新しい props を計算して返す。
   */
  movePart?(props: P, transform: Transform, partId: string, fromWorld: Point, toWorld: Point): P;
  /**
   * 矩形ズーム操作ツール(グラフ範囲)の受け口。ドラッグ矩形の対角2点
   * (ローカル座標)から新しい props を返す。無効な矩形(小さすぎる等)は null。
   * これを実装したプラグインだけがツールの対象になる。
   */
  zoomToRect?(props: P, a: Point, b: Point): P | null;
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
   * drag-line 配置中に背景でなくオブジェクトをクリックしたとき、そのエッジ/円へ
   * バインドする参照を返す(transform/lengthは applyRefs が算出)。
   * null を返すと通常のドラッグ配置にフォールバックする。長さマーク用。
   */
  createFromEdge?(pick: EdgePick): ObjectRef[] | null;
  /**
   * トリム(CAD的な部分削除)。本体が算出した「残す区間 keeps」から、
   * トリム後に残る部品(TrimPiece)を組み立てて返す。
   * - keeps.length === 0 … 全消し(呼び出し側が対象を削除)
   * - 1件 … 端の区間を削った/角度を詰めた(自身を更新)
   * - 2件 … 分割(自身+新規1個)
   * getSegments を持つ線分系は kind:'segment'、getCircle を持つ円・円弧は kind:'arc' で呼ばれる。
   * これを実装したプラグインだけがトリム対象になる。
   */
  trim?(props: P, transform: Transform, keeps: TrimKeep[]): TrimPiece[] | null;
  /**
   * SVG書き出し時に埋め込むCSS(フォント等はdata URIで自己完結させること)。
   * このプラグインのオブジェクトが書き出し対象に含まれる場合のみ呼ばれる。
   */
  exportStyles?(): Promise<string>;
}

/** レジストリ等で種類を問わずプラグインを扱うための型 */
// oxlint-disable-next-line no-explicit-any
export type AnyPlugin = PhysicsObjectPlugin<any>;
