import katex from 'katex';
import 'katex/dist/katex.min.css';

/** 円記号(¥/￥)をバックスラッシュとして扱う(日本語キーボード対策) */
function normalize(latex: string): string {
  return latex.replace(/[¥￥]/g, '\\');
}

/** KaTeXでHTML文字列を生成する(注釈ラベル用) */
export function renderMathHtml(latex: string): string {
  return katex.renderToString(normalize(latex), {
    throwOnError: false,
    displayMode: true,
    output: 'html',
  });
}

const measureCache = new Map<string, { width: number; height: number }>();

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
  measureCache.set(key, size);
  return size;
}
