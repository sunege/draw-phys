import { useSyncExternalStore } from 'react';
import katex from 'katex';

/**
 * KaTeX の webフォント(woff2)は初回使用時に非同期ロードされる。
 * 数式の実寸はフォントに依存するため、ロード完了前に実測するとフォールバック
 * フォントの寸法になり、それをキャッシュすると以後ずっと誤ったサイズになる
 * (リロード直後に数式サイズがずれる原因)。
 *
 * このモジュールはフォントのロード状態を一元管理し、
 * - ロード完了前は実測値をキャッシュさせない(`areKatexFontsReady`)
 * - 完了時に実測キャッシュを破棄してキャンバスを再描画させる(`useKatexFontsTick`)
 * ことで、保存時と再表示時で数式サイズが一致するようにする。
 */

const noFontApi = typeof document === 'undefined' || typeof document.fonts === 'undefined';

let ready = noFontApi;
let started = false;
let tick = 0;
const renderListeners = new Set<() => void>();
const cacheClearers = new Set<() => void>();

/** フォント状態が変わったとき: 実測キャッシュを捨ててから再描画を通知する */
function invalidate(): void {
  tick++;
  for (const clear of cacheClearers) clear();
  for (const notify of renderListeners) notify();
}

/** 数式の実測値がフォント確定後の安定値かどうか(キャッシュ可否の判定に使う) */
export function areKatexFontsReady(): boolean {
  return ready;
}

/** 実測キャッシュを登録する。フォント確定/追加ロード時に自動でクリアされる */
export function registerKatexMeasureCache(clear: () => void): void {
  cacheClearers.add(clear);
}

/**
 * KaTeX フォントのロードを起動する(初回のみ)。
 * 代表的な数式を隠し要素に描画してフォント取得を促し、`document.fonts.ready`
 * の解決を待って準備完了とする。装飾系など後から読まれるフォントにも
 * `loadingdone` で追従し、その都度キャッシュを作り直す。
 */
export function ensureKatexFontsLoaded(): void {
  if (started || noFontApi) return;
  started = true;
  const fontSet = document.fonts;

  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
  probe.innerHTML = katex.renderToString(
    '\\frac{\\alpha}{\\beta}+\\int_0^\\infty\\sum\\sqrt{x}\\,\\mathbb{R}',
    { throwOnError: false, displayMode: true, output: 'html' },
  );
  document.body.appendChild(probe);

  void fontSet.ready.then(() => {
    probe.remove();
    ready = true;
    invalidate();
  });
  // 後から読み込まれるフォントにも追従してサイズを測り直す
  fontSet.addEventListener('loadingdone', () => {
    if (ready) invalidate();
  });
}

function subscribe(onStoreChange: () => void): () => void {
  ensureKatexFontsLoaded();
  renderListeners.add(onStoreChange);
  return () => {
    renderListeners.delete(onStoreChange);
  };
}

/**
 * KaTeX フォントのロード状態が変わるたびに再描画を促すフック。
 * 数式を描画するレイヤーで呼ぶと、フォント確定後に正しい実寸で描き直される。
 */
export function useKatexFontsTick(): number {
  return useSyncExternalStore(
    subscribe,
    () => tick,
    () => tick,
  );
}
