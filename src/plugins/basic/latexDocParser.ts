import type { CSSProperties } from 'react';
import katex from 'katex';
import type { Rect } from '../../core/types';
import { resolveFontFamily } from './fontFamilies';
import { normalizeFormula } from './latex';

/**
 * LaTeX文章(地の文 + $...$ 数式)のパーサとHTML化。
 * 純粋モジュール(DOM非依存)として latexDoc.tsx / 実測 / エディタプレビューが共有する。
 */

/** 文章を構成するセグメント */
export type DocSegment =
  | { kind: 'text'; text: string }
  | { kind: 'math'; tex: string; display: boolean };

/** ソース中 pos から `\begin{env}` が始まるならその環境名を返す */
function matchBegin(source: string, pos: number): { env: string; afterBegin: number } | null {
  const m = /^\\begin\{([^}]+)\}/.exec(source.slice(pos));
  if (!m) return null;
  return { env: m[1], afterBegin: pos + m[0].length };
}

/**
 * `\begin{env}` に対応する `\end{env}` を探し、その直後のインデックスを返す。
 * 同名環境のネストはカウンタで対応付ける。見つからなければ -1。
 */
function findMatchingEnd(source: string, env: string, from: number): number {
  const beginTok = `\\begin{${env}}`;
  const endTok = `\\end{${env}}`;
  let depth = 1;
  let i = from;
  while (i < source.length) {
    const b = source.indexOf(beginTok, i);
    const e = source.indexOf(endTok, i);
    if (e === -1) return -1;
    if (b !== -1 && b < e) {
      depth++;
      i = b + beginTok.length;
    } else {
      depth--;
      if (depth === 0) return e + endTok.length;
      i = e + endTok.length;
    }
  }
  return -1;
}

/**
 * `$...$` / `$$...$$` の閉じデリミタ位置を返す。
 * 数式内の `\$` 等のエスケープは1文字飛ばして終端扱いしない。見つからなければ -1。
 */
function findMathClose(source: string, from: number, display: boolean): number {
  let i = from;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '$' && (!display || source[i + 1] === '$')) return i;
    i++;
  }
  return -1;
}

/**
 * LaTeX文章を text / math セグメントへ分割する。
 * - `\$` はリテラルの $ (数式デリミタにしない)
 * - `$$...$$` / `\[...\]` は display math、`$...$` / `\(...\)` は inline math
 * - 未閉鎖の `$`/`$$` はテキスト扱い(入力途中にエラーが点滅しないため)。
 *   未閉鎖の `\[`・`\(`・`\begin` は意図的な数式構文なので末尾まで math 扱い
 * - `\begin{env}` は環境名を問わず対応する `\end{env}` まで丸ごと math(display)。
 *   KaTeX非対応環境は throwOnError:false により赤字エラー表示になる
 */
export function parseLatexDoc(source: string): DocSegment[] {
  const segments: DocSegment[] = [];
  let text = '';
  const pushText = () => {
    if (text) {
      segments.push({ kind: 'text', text });
      text = '';
    }
  };
  const pushMath = (tex: string, display: boolean) => {
    pushText();
    segments.push({ kind: 'math', tex, display });
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      const next = source[i + 1];
      if (next === '$') {
        text += '$';
        i += 2;
        continue;
      }
      if (next === '[' || next === '(') {
        const display = next === '[';
        const closeTok = display ? '\\]' : '\\)';
        const end = source.indexOf(closeTok, i + 2);
        pushMath(end === -1 ? source.slice(i + 2) : source.slice(i + 2, end), display);
        i = end === -1 ? source.length : end + 2;
        continue;
      }
      const begin = matchBegin(source, i);
      if (begin) {
        const end = findMatchingEnd(source, begin.env, begin.afterBegin);
        // \begin{env}...\end{env} を丸ごとKaTeXへ渡す(align等のディスプレイ環境対応)
        pushMath(end === -1 ? source.slice(i) : source.slice(i, end), true);
        i = end === -1 ? source.length : end;
        continue;
      }
      // その他のバックスラッシュは地の文のリテラル
      text += ch;
      i++;
      continue;
    }
    if (ch === '$') {
      const display = source[i + 1] === '$';
      const openLen = display ? 2 : 1;
      const close = findMathClose(source, i + openLen, display);
      if (close === -1) {
        text += source.slice(i, i + openLen);
        i += openLen;
        continue;
      }
      pushMath(source.slice(i + openLen, close), display);
      i = close + openLen;
      continue;
    }
    text += ch;
    i++;
  }
  pushText();
  return segments;
}

/** テキスト部のHTMLエスケープ */
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSegmentHtml(seg: DocSegment): string {
  if (seg.kind === 'text') return escapeHtml(seg.text).replaceAll('\n', '<br/>');
  let html: string;
  try {
    html = katex.renderToString(seg.tex, {
      throwOnError: false,
      displayMode: seg.display,
      output: 'html',
    });
  } catch {
    // throwOnError:false でも ParseError 以外は投げられるため、赤字ソース表示へフォールバック
    return `<span style="color:#cc0000">${escapeHtml(seg.tex)}</span>`;
  }
  // display数式の既定margin(上下1em)は文章内では広すぎるため詰める
  return seg.display
    ? html.replace('class="katex-display"', 'class="katex-display" style="margin:0.4em 0"')
    : html;
}

/** 直近の変換結果のLRUキャッシュ(Renderer・実測・プレビューの同フレーム二重変換を防ぐ) */
const htmlCache = new Map<string, string>();
const HTML_CACHE_MAX = 20;

/**
 * ソース全体をHTML化する。
 * ¥→\ 正規化 → 分割 → text はエスケープ+改行を<br/>、math はKaTeX変換して結合。
 * 出力はフォントロード状態に依存しないため、キャッシュのクリアは不要。
 */
export function renderDocHtml(source: string): string {
  const cached = htmlCache.get(source);
  if (cached !== undefined) {
    // 使ったエントリを末尾へ移して挿入順をLRU順として使う
    htmlCache.delete(source);
    htmlCache.set(source, cached);
    return cached;
  }
  const html = parseLatexDoc(normalizeFormula(source)).map(renderSegmentHtml).join('');
  htmlCache.set(source, html);
  if (htmlCache.size > HTML_CACHE_MAX) htmlCache.delete(htmlCache.keys().next().value!);
  return html;
}

/**
 * DOMなし環境(node環境のテスト等)向けの概算高さ。
 * text.tsx と同じ全角≒1em・半角≒0.55em で折り返し行数を見積もる。
 */
export function estimateDocHeight(
  source: string,
  width: number,
  fontSize: number,
  lineHeight: number,
): number {
  let rows = 0;
  for (const line of source.split('\n')) {
    let em = 0;
    for (const c of line) em += c.codePointAt(0)! > 0xff ? 1 : 0.55;
    rows += Math.max(1, Math.ceil((em * fontSize) / Math.max(width, 1)));
  }
  return Math.max(rows, 1) * fontSize * lineHeight;
}

/**
 * 枠(width,height)と実測コンテンツ高から、ローカル座標のboundsを返す。
 * 原点=枠の中心。枠上端(y=-height/2)は固定で、内容が入り切らないときは下方向にのみ伸びる。
 */
export function docBounds(width: number, height: number, contentHeight: number): Rect {
  return { x: -width / 2, y: -height / 2, width, height: Math.max(height, contentHeight) };
}

export interface DocStyleOpts {
  width: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

/**
 * 文章コンテナのスタイル。描画(Renderer)・実測(latexDocMeasure)・
 * エディタプレビューがこの1関数を共有することで折り返し位置の一致を保証する。
 * (実測で element.style へ Object.assign するため、値はすべて単位付き文字列)
 */
export function docContainerStyle(opts: DocStyleOpts): CSSProperties {
  return {
    width: `${opts.width}px`,
    fontSize: `${opts.fontSize}px`,
    lineHeight: String(opts.lineHeight),
    color: opts.color,
    textAlign: opts.align,
    fontFamily: resolveFontFamily(opts.fontFamily),
    whiteSpace: 'normal',
    overflowWrap: 'break-word',
    // align等の数式番号はKaTeXがCSSカウンタでページ全体に振るため、
    // 文章オブジェクト単位でリセットして(1)から始める(プレビューとキャンバスも一致する)
    counterReset: 'katexEqnNo mmlEqnNo',
  };
}
