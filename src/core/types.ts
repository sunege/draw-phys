/** 2次元座標(ワールド座標またはローカル座標) */
export interface Point {
  x: number;
  y: number;
}

/** 軸平行の矩形 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * オブジェクトの配置変換。
 * プラグインはローカル座標(原点=オブジェクト中心)で描画し、
 * 本体が translate → rotate → scale の順で適用する。
 */
export interface Transform {
  /** ワールド座標でのオブジェクト中心X */
  x: number;
  /** ワールド座標でのオブジェクト中心Y */
  y: number;
  /** 回転角(度) */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export function identityTransform(x = 0, y = 0): Transform {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1 };
}

/**
 * 別オブジェクトへの参照(拘束)。ソルバが対象の現在位置から自分を再構築するのに使う。
 * refはプレーンなデータなので保存・Undo/Redoにそのまま乗る。
 */
export interface ObjectRef {
  /**
   * 依存側プラグインが解釈するスロット名(例 'a' | 'b' | 'p0' | 'p1' | 'anchor')。
   * 本体ソルバが直接処理する予約ロール(プラグイン種別を問わない):
   * - 'parallel'      自オブジェクトの回転を基準線分と平行に保つ(angleOffset 0/180)
   * - 'perpendicular' 自オブジェクトの回転を基準線分と垂直に保つ(angleOffset ±90)
   * - 'coincident'    自オブジェクトの局所アンカーを基準点に一致させ追従させる(一致/接続)
   */
  role: string;
  /** 参照先オブジェクトID */
  targetId: string;
  /** segment: 線分 / circle: 円周 / point: 対象のスナップ点 */
  kind: 'segment' | 'circle' | 'point';
  /** segment: 線分パラメタ[0,1] / circle: 角度(度, 対象ローカル基準) */
  t?: number;
  /** 複数線分を持つ対象での辺インデックス */
  segIndex?: number;
  /** point: 対象のスナップ点インデックス */
  pointIndex?: number;
  /** 依存側の解釈用オプション(例 'radius' | 'diameter') */
  mode?: string;
  /**
   * 平行/垂直拘束で、基準の向きに加える角度オフセット(度)。
   * 拘束時に「最小回転」になるよう平行は 0/180、垂直は ±90 を焼き込む。
   */
  angleOffset?: number;
  /**
   * 一致/接続拘束(role:'coincident')で、基準点に一致させる自オブジェクトの
   * 局所アンカー点(オブジェクト中心=原点)。拘束時にスナップ点を焼き込む。
   */
  localAnchor?: Point;
  /**
   * 一致拘束(role:'coincident')で、どのオブジェクトにも接続していない自由な
   * 基準点(ワールド座標)。targetId が解決できないときに使う。一致点をドラッグして
   * オブジェクトから離した場合に焼き込まれ、保存・Undo/Redoにそのまま乗る。
   */
  worldAnchor?: Point;
}
