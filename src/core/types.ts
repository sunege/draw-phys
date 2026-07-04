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
  /** 依存側プラグインが解釈するスロット名(例 'a' | 'b' | 'p0' | 'p1' | 'anchor') */
  role: string;
  /** 参照先オブジェクトID */
  targetId: string;
  kind: 'segment' | 'circle';
  /** segment: 線分パラメタ[0,1] / circle: 角度(度, 対象ローカル基準) */
  t?: number;
  /** 複数線分を持つ対象での辺インデックス */
  segIndex?: number;
  /** 依存側の解釈用オプション(例 'radius' | 'diameter') */
  mode?: string;
}
