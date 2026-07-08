import { mirrorKeepUpright } from '../../core/mirror';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { DEFAULT_FONT_FAMILY, FONT_FAMILY_OPTIONS } from './fontFamilies';
import { buildKatexExportCss } from './latex';
import { measureDocHeight } from './latexDocMeasure';
import { docBounds, docContainerStyle, renderDocHtml } from './latexDocParser';
import {
  EditorOpenButton,
  SourceEditorModal,
  type SourceEditorConfig,
} from './SourceEditorModal';

/**
 * LaTeX文章オブジェクト。
 * 地の文(HTMLテキスト・日本語可)に $...$ / $$...$$ / \[...\] / \begin{align} 等の
 * 数式を混在できる。枠の幅で折り返し、入り切らない内容は上端固定で下方向にのみ伸びる。
 * 枠のハンドルドラッグはフォントサイズを変えず枠サイズだけを変える(折り返し位置が更新される)。
 */
export interface LatexDocProps {
  /** LaTeX文章(地の文 + $...$ 等の数式) */
  source: string;
  /** 枠の幅(折り返し幅。ここで固定折り返し) */
  width: number;
  /** 枠の最小高さ。内容が超えると下方向にのみ伸びる */
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  /** 行間(倍率) */
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  /** 背景を白で塗る(背後の図形と干渉して読みづらいときに使う) */
  bg: boolean;
}

/** 折り返し後のコンテンツ高(実測・キャッシュ付き) */
function contentHeight(props: LatexDocProps): number {
  return measureDocHeight({
    source: props.source,
    width: props.width,
    fontSize: props.fontSize,
    fontFamily: props.fontFamily,
    lineHeight: props.lineHeight,
    align: props.align,
  });
}

const MIN_WIDTH = 40;
const MIN_HEIGHT = 24;

/** 大型エディタ(SourceEditorModal)の設定。プレビューはキャンバスと同じ幅・スタイルで折り返す */
const editorConfig: SourceEditorConfig = {
  title: 'LaTeX文章の編集',
  hint: '数式は $...$(行内) / $$...$$ / \\begin{align}...\\end{align}(別行立て) で囲む。地の文・単位はそのまま書ける。改行はそのまま反映される',
  placeholder: '例: 初速度 $v_0$ で小球を投げ上げた。高さは\n$$y = v_0 t - \\frac{1}{2}gt^2$$',
  getDraft: (props) => String(props.source ?? ''),
  applyDraft: (props, draft) => ({ ...props, source: draft }),
  renderPreview: (draft, props) => ({
    html: renderDocHtml(draft),
    style: docContainerStyle(props as unknown as LatexDocProps),
  }),
};

export const latexDocPlugin: PhysicsObjectPlugin<LatexDocProps> = {
  id: 'core.latexDoc',
  version: 1,
  name: 'LaTeX文章',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line x1="6" y1="8.5" x2="18" y2="8.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="15.5" x2="13" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    source: '質量 $m$ の物体に力 $F$ を加えると $F = ma$ で加速する。',
    width: 280,
    height: 80,
    fontSize: 12,
    fontFamily: DEFAULT_FONT_FAMILY,
    color: '#000000',
    lineHeight: 1.6,
    align: 'left',
    bg: false,
  },
  defaultSize: { width: 280, height: 80 },
  propertySchema: [
    { key: 'source', label: '内容', type: 'multiline' },
    { key: 'fontSize', label: 'サイズ', type: 'number', min: 6, step: 2 },
    { key: 'fontFamily', label: 'フォント', type: 'select', options: [...FONT_FAMILY_OPTIONS] },
    { key: 'width', label: '枠の幅', type: 'number', min: MIN_WIDTH, step: 10 },
    { key: 'height', label: '枠の高さ', type: 'number', min: MIN_HEIGHT, step: 10 },
    { key: 'lineHeight', label: '行間', type: 'number', min: 1, max: 3, step: 0.1 },
    {
      key: 'align',
      label: '揃え',
      type: 'select',
      options: [
        { value: 'left', label: '左' },
        { value: 'center', label: '中央' },
        { value: 'right', label: '右' },
      ],
    },
    { key: 'color', label: '色', type: 'color' },
    { key: 'bg', label: '背景', type: 'boolean' },
  ],
  Renderer: ({ props }) => {
    const h = contentHeight(props);
    const b = docBounds(props.width, props.height, h);
    return (
      <g>
        {/* bg=false でも transparent で枠全体を当たり判定にする(空文章でも選択できる) */}
        <rect
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx={2}
          fill={props.bg ? '#ffffff' : 'transparent'}
        />
        <foreignObject x={-props.width / 2} y={-props.height / 2} width={props.width} height={h}>
          <div
            // 単体SVGとして書き出したときにも正しく解釈されるよう名前空間を明示する
            {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
            style={docContainerStyle(props)}
            // 地の文はエスケープ済み・数式はKaTeXが生成した信頼できるHTMLのみを流し込む
            dangerouslySetInnerHTML={{ __html: renderDocHtml(props.source) }}
          />
        </foreignObject>
      </g>
    );
  },
  getBounds: (props) => docBounds(props.width, props.height, contentHeight(props)),
  getSnapPoints: (props) => {
    const b = docBounds(props.width, props.height, contentHeight(props));
    return [
      { x: 0, y: 0 },
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ];
  },
  applyScale: (props, fx, fy) => {
    // フォントサイズは変えず枠だけ変える。縦は実効高(=bounds高)基準でドラッグと1:1にする
    const effHeight = Math.max(props.height, contentHeight(props));
    return {
      ...props,
      width: Math.max(MIN_WIDTH, props.width * fx),
      height: Math.max(MIN_HEIGHT, effHeight * fy),
    };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  // 鏡像は位置だけ反射し、文章は読める向きのまま
  mirror: mirrorKeepUpright,
  // ドラッグで枠サイズを決めてから配置する(クリックのみのときは既定サイズで置く)
  placement: 'drag-rect',
  createFromDrag(start, end) {
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    // ドラッグがごく小さい(クリックのみ)場合は既定サイズを左上基準で置く
    if (w < MIN_WIDTH || h < MIN_HEIGHT) {
      const { width, height } = this.defaultProps;
      return {
        props: { ...this.defaultProps },
        transform: {
          x: start.x + width / 2,
          y: start.y + height / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
      };
    }
    return {
      props: { ...this.defaultProps, width: w, height: h },
      transform: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
    };
  },
  exportStyles: buildKatexExportCss,
  PanelExtra: ({ objectId }) => <EditorOpenButton objectId={objectId} />,
  EditorModal: ({ objectId, onClose }) => (
    <SourceEditorModal objectId={objectId} onClose={onClose} config={editorConfig} />
  ),
  // 配置直後はエディタを開かない。編集はプロパティパネルの編集ボタンから任意で開く
};
