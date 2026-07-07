import { areKatexFontsReady, registerKatexMeasureCache } from './katexFonts';
import {
  type DocStyleOpts,
  docContainerStyle,
  estimateDocHeight,
  renderDocHtml,
} from './latexDocParser';

/**
 * 幅固定・折り返しありのLaTeX文章の高さ実測。
 * ブラウザのレイアウトに依存するため、隠し要素で実測してキャッシュする。
 * DOMが無い環境(node環境のテスト等)では概算にフォールバックする。
 */

/** color はレイアウトに影響しないため実測条件から除外する */
export interface DocMeasureOpts extends Omit<DocStyleOpts, 'color'> {
  source: string;
}

const measureCache = new Map<string, number>();
// フォント確定・追加ロード時に実測をやり直す(latex.tsx の measureFormula と同じ機構)
registerKatexMeasureCache(() => measureCache.clear());

/** 幅 width で折り返したときのコンテンツ高(px, 切り上げ整数)を返す */
export function measureDocHeight(opts: DocMeasureOpts): number {
  // source は | を含み得るので必ず末尾に置く
  const key = `${opts.width}|${opts.fontSize}|${opts.lineHeight}|${opts.align}|${opts.source}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;

  let height = estimateDocHeight(opts.source, opts.width, opts.fontSize, opts.lineHeight);
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
    Object.assign(el.style, docContainerStyle({ ...opts, color: '#000000' }));
    el.innerHTML = renderDocHtml(opts.source);
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    el.remove();
    // 下端のディセンダがクリップされないよう切り上げる。空文章は1行分を確保
    if (rect.height > 0) height = Math.ceil(rect.height);
    else height = Math.ceil(opts.fontSize * opts.lineHeight);
  }
  // フォント確定後の安定した実測値だけをキャッシュする(未確定なら毎回測り直す)
  if (areKatexFontsReady()) measureCache.set(key, height);
  return height;
}
