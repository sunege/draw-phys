import katex from 'katex';
import { areKatexFontsReady, registerKatexMeasureCache } from '../basic/katexFonts';
import 'katex/dist/katex.min.css';

/** 円記号(¥/￥)をバックスラッシュとして扱う(日本語キーボード対策) */
function normalize(latex: string): string {
  return latex.replace(/[¥￥]/g, '\\');
}

/** KaTeXでHTML文字列を生成する(注釈ラベル用) */
export function renderMathHtml(latex: string): string {
  const html = katex.renderToString(normalize(latex), {
    throwOnError: false,
    displayMode: true,
    output: 'html',
  });
  // displayMode の .katex-display は上下に margin:1em(=2em分)を持ち、
  // 文字の高さより縦幅が大きくなる。マージンを消して数式の高さにフィットさせる
  // (実測・描画の両方に効く)。
  return html.replace('class="katex-display"', 'class="katex-display" style="margin:0"');
}

const measureCache = new Map<string, { width: number; height: number }>();
registerKatexMeasureCache(() => measureCache.clear());

/** 数式ラベルの実寸を非表示要素で実測してキャッシュ(DOMが無ければ概算) */
export function measureMath(latex: string, fontSize: number): { width: number; height: number } {
  const key = `${fontSize}|${latex}`;
  const cached = measureCache.get(key);
  if (cached) return cached;

  let size = { width: latex.length * fontSize * 0.5, height: fontSize * 1.4 };
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:-99999px;top:0;visibility:hidden;display:inline-block;white-space:nowrap;';
    el.style.fontSize = `${fontSize}px`;
    el.innerHTML = renderMathHtml(latex);
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    el.remove();
    if (rect.width > 0 && rect.height > 0) size = { width: rect.width, height: rect.height };
  }
  // フォント確定後の安定した実測値だけをキャッシュする(未確定なら毎回測り直す)
  if (areKatexFontsReady()) measureCache.set(key, size);
  return size;
}
