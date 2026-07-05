import katex from 'katex';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Rect } from '../../core/types';
import { areKatexFontsReady, registerKatexMeasureCache } from './katexFonts';
import 'katex/dist/katex.min.css';

interface LatexProps {
  formula: string;
  fontSize: number;
  color: string;
  /** 背景を白で塗る(背後の図形と干渉して読みづらいときに使う) */
  bg: boolean;
}

/**
 * 書き出しSVGへ埋め込む自己完結CSS。
 * KaTeXのCSSを取り込み、woff2フォント参照をdata URIへ置き換える。
 */
let exportCssPromise: Promise<string> | null = null;

export function buildKatexExportCss(): Promise<string> {
  exportCssPromise ??= (async () => {
    const cssModule = await import('katex/dist/katex.min.css?raw');
    let css = cssModule.default;
    const fonts = import.meta.glob<string>('/node_modules/katex/dist/fonts/*.woff2', {
      query: '?inline',
      import: 'default',
    });
    for (const [path, load] of Object.entries(fonts)) {
      const fileName = path.split('/').pop()!;
      if (!css.includes(fileName)) continue;
      const dataUri = await load();
      css = css.replaceAll(`fonts/${fileName}`, dataUri);
    }
    // 残った外部フォント参照(woff/ttf)は除去する。
    // 外部参照が残っているとSVG→canvas変換時にcanvasが汚染されPNG化できない
    css = css.replace(/,\s*url\((?!["']?data:)[^)]*\)\s*format\([^)]*\)/g, '');
    return css;
  })();
  return exportCssPromise;
}

/**
 * 日本語キーボードではバックスラッシュキーが円記号を出すことがあるため、
 * 円記号(半角¥ U+00A5 / 全角￥ U+FFE5)をバックスラッシュとして扱う。
 */
export function normalizeFormula(formula: string): string {
  return formula.replace(/[¥￥]/g, '\\');
}

function renderHtml(formula: string): string {
  const html = katex.renderToString(normalizeFormula(formula), {
    throwOnError: false,
    displayMode: true,
    output: 'html',
  });
  // displayMode の .katex-display は上下に margin:1em(=2em分)を持ち、
  // 文字の高さより縦幅が大きくなる。マージンを消して数式の高さにフィットさせる
  // (実測・描画の両方に効くので、縦は文字高+左右と同じパディングになる)。
  return html.replace('class="katex-display"', 'class="katex-display" style="margin:0"');
}

/**
 * 数式のサイズはKaTeXのレイアウトに依存するため、
 * 非表示要素で実測してキャッシュする。DOMが無い環境では概算にフォールバック。
 */
const measureCache = new Map<string, { width: number; height: number }>();
registerKatexMeasureCache(() => measureCache.clear());

function measureFormula(formula: string, fontSize: number): { width: number; height: number } {
  const key = `${fontSize}|${formula}`;
  const cached = measureCache.get(key);
  if (cached) return cached;

  let size = { width: formula.length * fontSize * 0.5, height: fontSize * 1.4 };
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:-99999px;top:0;visibility:hidden;display:inline-block;white-space:nowrap;';
    el.style.fontSize = `${fontSize}px`;
    el.innerHTML = renderHtml(formula);
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    el.remove();
    if (rect.width > 0 && rect.height > 0) {
      size = { width: rect.width, height: rect.height };
    }
  }
  // フォント確定後の安定した実測値だけをキャッシュする(未確定なら毎回測り直す)
  if (areKatexFontsReady()) measureCache.set(key, size);
  return size;
}

export const latexPlugin: PhysicsObjectPlugin<LatexProps> = {
  id: 'core.latex',
  version: 1,
  name: 'LaTeX数式',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M4 5 H12 L12.5 8 H11 C10.7 6.7 10 6.5 8.8 6.5 L7 14 C6.8 15 7 15.4 8.4 15.5 L8.2 17 H3 L3.2 15.5 C4.6 15.4 4.9 15 5.1 14 L6.9 6.5 C5.7 6.5 5 6.7 4.3 8 H3.5 Z"
        fill="currentColor"
      />
      <path d="M13 11 L17 11 L21 19 H17.5 L15.8 15 L13.5 19 H11 L14.8 13 Z" fill="currentColor" opacity="0.7" />
    </svg>
  ),
  defaultProps: {
    formula: 'F = ma',
    fontSize: 24,
    color: '#333333',
    bg: false,
  },
  defaultSize: { width: 100, height: 34 },
  propertySchema: [
    { key: 'formula', label: '数式', type: 'multiline' },
    { key: 'fontSize', label: 'サイズ', type: 'number', min: 6, step: 2 },
    { key: 'color', label: '色', type: 'color' },
    { key: 'bg', label: '背景', type: 'boolean' },
  ],
  Renderer: ({ props }) => {
    const { width, height } = measureFormula(props.formula, props.fontSize);
    const pad = props.fontSize * 0.2;
    return (
      <g>
        {props.bg && (
          <rect
            x={-width / 2 - pad}
            y={-height / 2 - pad}
            width={width + pad * 2}
            height={height + pad * 2}
            rx={2}
            fill="#ffffff"
          />
        )}
        <foreignObject x={-width / 2} y={-height / 2} width={width} height={height}>
          <div
            // 単体SVGとして書き出したときにも正しく解釈されるよう名前空間を明示する
            {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
            style={{
              fontSize: props.fontSize,
              color: props.color,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
            // KaTeXが生成した信頼できるHTMLのみを流し込む
            dangerouslySetInnerHTML={{ __html: renderHtml(props.formula) }}
          />
        </foreignObject>
      </g>
    );
  },
  getBounds: (props): Rect => {
    const { width, height } = measureFormula(props.formula, props.fontSize);
    const pad = props.bg ? props.fontSize * 0.2 : 0;
    return {
      x: -width / 2 - pad,
      y: -height / 2 - pad,
      width: width + pad * 2,
      height: height + pad * 2,
    };
  },
  getSnapPoints: () => [{ x: 0, y: 0 }],
  applyScale: (props, fx) => ({ ...props, fontSize: props.fontSize * fx }),
  capabilities: { rotatable: true, scalable: 'uniform' },
  placement: 'click',
  exportStyles: buildKatexExportCss,
};
