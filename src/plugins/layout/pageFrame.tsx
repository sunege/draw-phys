import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { mmToUnits } from '../../core/units';
import { PageFramePanel } from './PageFramePanel';
import type { PageFrameProps } from './pageFrameMath';
import { guidePoints, guideSegments, type GuideConfig } from './pageGuides';

/**
 * 用紙のサイズ・余白は props に実寸(mm)で持ち、描画・当たり判定・書き出しの
 * 内部単位へは mmToUnits で換算する(1単位=1/96インチ)。これでグリッド・線幅・
 * 既存オブジェクトと同じ尺度になり、用紙が実寸で正しい大きさになる。
 */

/** 枠線の太さ(内部単位)。用紙外周の細い罫 */
const BORDER_W = 1;
/** 選択用の当たり判定の帯幅(内部単位)。枠付近をつかみやすくするための透明ストローク */
const HIT_W = 6;
/** 余白ガイド(破線)の色 */
const MARGIN_COLOR = '#c0c6cf';
/** レイアウト補助線(等分線・対角線)の色 */
const GUIDE_COLOR = '#8ab4e8';

/** 用紙枠の既定props。defaultProps と旧データの migrate 補完で共有する */
const DEFAULT_PAGE_PROPS: PageFrameProps = {
  pageNumber: 1,
  width: 210,
  height: 297,
  marginMm: 15,
  showMargin: true,
  showBorder: true,
  filled: false,
  fill: '#ffffff',
  stroke: '#9aa0a8',
  showGuides: false,
  guideCols: 2,
  guideRows: 2,
  guideDiagonals: true,
};

/** props からローカル座標(内部単位)の補助線設定を作る */
function guideConfig(props: PageFrameProps): GuideConfig {
  return {
    width: mmToUnits(props.width),
    height: mmToUnits(props.height),
    cols: props.guideCols,
    rows: props.guideRows,
    diagonals: props.guideDiagonals,
  };
}

export const pageFramePlugin: PhysicsObjectPlugin<PageFrameProps> = {
  id: 'layout.pageFrame',
  version: 2,
  name: '用紙',
  category: 'レイアウト',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="5" y="3" width="14" height="18" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="6" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
    </svg>
  ),
  defaultProps: DEFAULT_PAGE_PROPS,
  // v1(補助線プロパティ以前)の用紙枠は不足フィールドを既定で補完する
  migrate: (_fromVersion, props) => ({
    ...DEFAULT_PAGE_PROPS,
    ...(props as Partial<PageFrameProps>),
  }),
  // 配置時、既存の用紙枠の末尾+1をページ番号に自動採番する(後から足した用紙は次のページ)
  initProps: (props, siblings) => ({
    ...props,
    pageNumber: siblings.reduce((max, s) => Math.max(max, s.pageNumber ?? 0), 0) + 1,
  }),
  defaultSize: { width: 210, height: 297 },
  propertySchema: [
    { key: 'width', label: '幅(mm)', type: 'number', min: 10, step: 1 },
    { key: 'height', label: '高さ(mm)', type: 'number', min: 10, step: 1 },
    { key: 'marginMm', label: '余白(mm)', type: 'number', min: 0, step: 1 },
    { key: 'showMargin', label: '余白ガイド', type: 'boolean' },
    { key: 'showGuides', label: '補助線(等分・対角)', type: 'boolean' },
    { key: 'guideCols', label: '縦の等分数', type: 'number', min: 1, step: 1 },
    { key: 'guideRows', label: '横の等分数', type: 'number', min: 1, step: 1 },
    { key: 'guideDiagonals', label: '対角線', type: 'boolean' },
    { key: 'showBorder', label: '枠線を表示', type: 'boolean' },
    { key: 'filled', label: '用紙を塗る', type: 'boolean' },
    { key: 'fill', label: '用紙色', type: 'color' },
    { key: 'stroke', label: '枠線色', type: 'color' },
  ],
  PanelExtra: PageFramePanel,
  Renderer: ({ props, interactive }) => {
    const w = mmToUnits(props.width);
    const h = mmToUnits(props.height);
    const m = mmToUnits(props.marginMm);
    const hw = w / 2;
    const hh = h / 2;
    const innerW = w - 2 * m;
    const innerH = h - 2 * m;
    const showMarginGuide = !!interactive && props.showMargin && innerW > 0 && innerH > 0;
    // 補助線はキャンバス上のみ(書き出し/印刷では interactive 無=描かない)
    const guides = interactive && props.showGuides ? guideSegments(guideConfig(props)) : [];
    return (
      <g>
        {/* 用紙本体。中身のクリックは素通しさせ、背面の内容の上で作業できるようにする */}
        <rect
          x={-hw}
          y={-hh}
          width={w}
          height={h}
          fill={props.filled ? props.fill : 'none'}
          stroke={props.showBorder ? props.stroke : 'none'}
          strokeWidth={BORDER_W}
          pointerEvents="none"
        />
        {/* 選択用の当たり判定。枠付近の帯だけを掴めるようにする(書き出しでは描かない) */}
        {interactive && (
          <rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="none"
            stroke="transparent"
            strokeWidth={HIT_W}
            pointerEvents="stroke"
          />
        )}
        {/* 余白ガイド(キャンバス上のみ。書き出しには出ない) */}
        {showMarginGuide && (
          <rect
            x={-hw + m}
            y={-hh + m}
            width={innerW}
            height={innerH}
            fill="none"
            stroke={MARGIN_COLOR}
            strokeWidth={0.4}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}
        {/* レイアウト補助線(等分線・対角線)。キャンバス上のみ・クリックは素通し */}
        {guides.map((seg, i) => (
          <line
            key={i}
            x1={seg[0].x}
            y1={seg[0].y}
            x2={seg[1].x}
            y2={seg[1].y}
            stroke={GUIDE_COLOR}
            strokeWidth={0.4}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ))}
      </g>
    );
  },
  getBounds: (props) => {
    const w = mmToUnits(props.width);
    const h = mmToUnits(props.height);
    return { x: -w / 2, y: -h / 2, width: w, height: h };
  },
  getSnapPoints: (props) => {
    const hw = mmToUnits(props.width) / 2;
    const hh = mmToUnits(props.height) / 2;
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
      { x: 0, y: -hh },
      { x: hw, y: 0 },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
    ];
    const m = mmToUnits(props.marginMm);
    if (m > 0 && hw - m > 0 && hh - m > 0) {
      const iw = hw - m;
      const ih = hh - m;
      points.push(
        { x: -iw, y: -ih },
        { x: iw, y: -ih },
        { x: iw, y: ih },
        { x: -iw, y: ih },
      );
    }
    // 補助線がONなら等分格子・辺の等分点もスナップ対象にする(末尾に追加)
    if (props.showGuides) points.push(...guidePoints(guideConfig(props)));
    return points;
  },
  getSegments: (props) => {
    const hw = mmToUnits(props.width) / 2;
    const hh = mmToUnits(props.height) / 2;
    const edges = (x: number, y: number): [Point, Point][] => [
      [{ x: -x, y: -y }, { x, y: -y }],
      [{ x, y: -y }, { x, y }],
      [{ x, y }, { x: -x, y }],
      [{ x: -x, y }, { x: -x, y: -y }],
    ];
    const segments = edges(hw, hh);
    const m = mmToUnits(props.marginMm);
    if (m > 0 && hw - m > 0 && hh - m > 0) {
      segments.push(...edges(hw - m, hh - m));
    }
    // 補助線がONなら等分線・対角線もスナップ相手にする(末尾に追加)
    if (props.showGuides) segments.push(...guideSegments(guideConfig(props)));
    return segments;
  },
  // 幅・高さ(mm)を焼き込む。余白は物理量なのでサイズ変更では変えない
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
  }),
  // 用紙は印刷範囲を軸平行に保つため回転不可。サイズは自由変更可
  capabilities: { rotatable: false, scalable: 'both', printFrame: true },
  placement: 'click',
};
