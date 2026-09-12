import { areKatexFontsReady, registerKatexMeasureCache } from '../basic/katexFonts';
import { renderDocHtml } from '../basic/latexDocParser';
import { cellFontStyle, type CellFontOpts, type CellSize } from './tableMath';

/**
 * 表のセル内容(地の文 + $...$ 数式)の自然サイズ実測。
 * 数式の寸法はKaTeXのレイアウト・フォントに依存するため、隠し要素で実測してキャッシュする。
 * DOMが無い環境(node環境のテスト等)では文字数からの概算にフォールバックする。
 */

export interface CellMeasureOpts extends CellFontOpts {
  text: string;
}

const measureCache = new Map<string, CellSize>();
// フォント確定・追加ロード時に測り直す(latexDocMeasure と同じ機構)
registerKatexMeasureCache(() => measureCache.clear());

/** DOMなし環境向けの概算(全角≒1em・半角≒0.55em。latexDocParser の見積もりと同じ係数) */
function estimateCellSize(opts: CellMeasureOpts): CellSize {
  let em = 0;
  for (const c of opts.text) em += c.codePointAt(0)! > 0xff ? 1 : 0.55;
  return { width: em * opts.fontSize, height: opts.fontSize * 1.2 };
}

/** セル内容を折り返しなしで描いたときの自然サイズ(px)。パディングは含まない */
export function measureCell(opts: CellMeasureOpts): CellSize {
  // text は | を含み得るので必ず末尾に置く
  const key = `${opts.fontSize}|${opts.fontFamily}|${opts.bold}|${opts.text}`;
  const cached = measureCache.get(key);
  if (cached) return cached;

  let size = estimateCellSize(opts);
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:-99999px;top:0;visibility:hidden;display:inline-block;white-space:nowrap;';
    Object.assign(el.style, cellFontStyle(opts));
    el.innerHTML = renderDocHtml(opts.text);
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    el.remove();
    if (rect.width > 0 || rect.height > 0) {
      size = { width: rect.width, height: rect.height };
    }
  }
  // フォント確定後の安定した実測値だけをキャッシュする(未確定なら毎回測り直す)
  if (areKatexFontsReady()) measureCache.set(key, size);
  return size;
}

/** 表の全セルの自然サイズ(row-major) */
export function measureCells(
  cells: string[],
  rows: number,
  cols: number,
  font: CellFontOpts,
  headerRow: boolean,
): CellSize[] {
  return Array.from({ length: rows * cols }, (_, i) =>
    measureCell({
      ...font,
      bold: headerRow && Math.floor(i / cols) === 0,
      text: cells[i] ?? '',
    }),
  );
}
