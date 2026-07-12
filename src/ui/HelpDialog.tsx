import { useEffect } from 'react';
import { OPERATION_TOOLS } from '../canvas/tools';
import { SHIFT_TOOL_SHORTCUTS, TOOL_SHORTCUTS } from '../canvas/toolShortcuts';
import { pluginRegistry } from '../core/registry';
import styles from './HelpDialog.module.css';

/** ツールid→表示名(プラグイン図形と操作ツールの両方を引く) */
function toolName(id: string): string {
  return pluginRegistry.get(id)?.name ?? OPERATION_TOOLS.find((t) => t.id === id)?.name ?? id;
}

/** 全般ショートカット(CanvasStageのキーボードハンドラと対応) */
const GENERAL_SHORTCUTS: [string, string][] = [
  ['Ctrl+Z', '元に戻す'],
  ['Ctrl+Shift+Z / Ctrl+Y', 'やり直す'],
  ['Ctrl+C', '選択図形をコピー'],
  ['Ctrl+V', '貼り付け（図形・OSクリップボードの画像）'],
  ['Ctrl+D', '選択図形を複製'],
  ['Ctrl+A', 'すべて選択（非表示・ロック中は除く）'],
  ['Delete / Backspace', '削除（拘束マーカー選択中はその拘束のみ解除）'],
  ['Ctrl+G / Ctrl+Shift+G', 'グループ化 / グループ解除'],
  ['Ctrl+] / Ctrl+[', 'ひとつ前面へ / ひとつ背面へ（Shiftを足すと最前面/最背面）'],
  ['F / B', '最前面へ / 最背面へ'],
  ['矢印キー', '選択図形をスナップ間隔で移動（Shift+矢印は1pxずつ微調整）'],
  ['Space（単押し）', 'スナップのON/OFF切り替え'],
  ['Space＋ドラッグ', 'キャンバスのパン（中ボタン・右ボタンのドラッグでも可）'],
  ['マウスホイール', 'ズーム（カーソル位置を中心に拡大縮小）'],
  ['Esc', '選択ツールへ戻る・選択解除・進行中の操作を中断'],
  ['?', 'このガイドを開く/閉じる'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  // Escで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>ユーザーガイド</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            閉じる (Esc)
          </button>
        </div>
        <div className={styles.body}>
          <h3>画面のなりたち</h3>
          <p>
            左の<b>ツールボックス</b>から図形を選び、キャンバスをクリック（線などはドラッグ）して配置します。
            配置すると自動で「選択」ツールに戻ります。続けて置くときはもう一度ツールを選ぶか、ショートカットキーを使ってください。
            右の<b>プロパティパネル</b>で選択中の図形の数値・色などを編集し、下の<b>ワークスペース</b>でファイルを管理します。
          </p>

          <h3>保存のしくみ（重要）</h3>
          <p>
            保存ボタンはありません。編集内容は<b>約1秒後に自動保存</b>されます。
            保存先はこのブラウザの内部ストレージ（IndexedDB）で、PC上のファイルとしては作られません。
          </p>
          <p className={styles.caution}>
            ⚠ データは「このPCのこのブラウザ」の中にだけあります。別のPC・別のブラウザでは開けず、
            ブラウザの「閲覧データ（サイトデータ）の削除」で図もすべて消えます。
            大事な図は下記のバックアップを定期的に取ってください。
          </p>
          <h4>バックアップと持ち出し（ワークスペースパネル）</h4>
          <ul>
            <li>
              <b>ZIP出力</b> — 全ファイルをフォルダ構成ごとZIPでダウンロード（丸ごとバックアップ）。
            </li>
            <li>各ファイル行の <b>⬇</b> — その図1つをJSONでダウンロード。</li>
            <li>
              <b>読込</b> — .json（1図）/ .zip（一括）を復元。ZIPはZIP名のフォルダの中に復元されるので既存の図とは混ざりません。
            </li>
          </ul>
          <p>
            ファイル管理もワークスペースパネルで行います。「+ファイル」「+フォルダ」で作成、行のボタンで名前変更・コピー・削除、
            行のドラッグでフォルダへ移動できます。
          </p>

          <h3>画像として使う（コピー・書き出し・印刷）</h3>
          <ul>
            <li>
              <b>📋 コピー</b> — 選択中の図形（なければ全体）をPNGでクリップボードへ。
              WordやPowerPointにそのまま貼り付けられます。ふだんはこれが一番手軽です。
            </li>
            <li>
              <b>書き出し…</b> — 対象（全体 / 選択 / 表示範囲 / 用紙）と形式（PNG / JPEG / SVG / PDF）を選んでダウンロード。
              PNG・SVGは背景の透過も選べます。
            </li>
            <li>
              <b>🖨 印刷</b> — 用紙枠を実寸で印刷します（用紙枠が必要です。下記「用紙枠とページ」参照）。
            </li>
          </ul>
          <ul>
            <li>
              クリップボードへのコピーは形式にかかわらず常に<b>PNG</b>で渡します
              （WordなどがSVG中の数式を正しく表示できないため）。
            </li>
            <li>
              対象を「用紙」にすると<b>実寸（mm）出力</b>になり、倍率の代わりに解像度（dpi）を指定します。
              PDFなら全ページをまとめた複数ページに、PNG/JPEG/SVGは1枚だけ書き出されます。
            </li>
            <li>補助線（コンストラクション）・非表示にした図形・用紙のガイド線は、書き出し・印刷には含まれません。</li>
          </ul>

          <h3>基本操作</h3>
          <ul>
            <li>
              <b>選択</b> — クリック。<kbd>Shift</kbd>+クリックで追加。空白からドラッグで範囲選択
              （用紙枠は「枠全体を囲んだとき」だけ選ばれるので、用紙の上でも安心して範囲選択できます）。
            </li>
            <li>
              <b>移動</b> — ドラッグ、または矢印キー（スナップ間隔で移動。<kbd>Shift</kbd>+矢印で1pxずつ）。
            </li>
            <li>
              <b>拡大縮小</b> — 選択枠のハンドルをドラッグ。<kbd>Shift</kbd>で縦横比を維持。
              文字サイズは拡縮に追従しますが、<b>線の太さは変わりません</b>。
            </li>
            <li>
              <b>回転</b> — 上に伸びた回転ハンドルをドラッグ。スナップON時は15°刻み。
              回転中心のマーカーをドラッグして移しておくと、任意の点を軸に回せます。
            </li>
            <li>
              <b>線・矢印など</b> — 端点を直接ドラッグして伸縮。端点は他の図形の点や交点に吸着します。
            </li>
            <li>
              <b>ダブルクリック</b> — テキストはその場で編集、LaTeX数式・LaTeX文章・グラフなどは専用エディタが開きます。
            </li>
            <li>
              <b>表示</b> — ホイールでズーム、<kbd>Space</kbd>を押しながらドラッグ（または中・右ボタンドラッグ）でパン。
              右上の「%」表示をクリックすると表示位置がリセットされます。
            </li>
            <li>
              <b>スナップ</b> — <kbd>Space</kbd>単押しでON/OFF。間隔（グリッド / 1/2 / 1/4）は右上で変更。
            </li>
            <li>
              <b>画像</b> — 画像ファイルをキャンバスへドロップ、またはスクリーンショット等を
              <kbd>Ctrl+V</kbd>で貼り付けると図に取り込めます。
            </li>
            <li>
              <b>ロック・非表示</b> — プロパティパネルから設定。解除は、何も選択していないときに
              パネルに出る「ロック中・非表示」の一覧から行います（ロック中の図形はクリックできないため）。
            </li>
            <li>
              <b>補助線化</b> — 線・円を「補助線（コンストラクション）」にすると色付き点線になり、
              スナップや拘束の相手には使えたまま、書き出しには写りません。作図の下書きに便利です。
            </li>
            <li>
              <b>ラベル</b> — ベクトル・物体などのラベルはドラッグで位置調整でき、LaTeX記法が使えます。
              図形を回転してもラベルは常に正立します。
            </li>
          </ul>

          <h3>編集ツール（ツールボックスの「編集」）</h3>
          <p>いずれも上部中央に操作ガイドが出ます。<kbd>Esc</kbd>でいつでも中断できます。</p>
          <ul>
            <li>
              <b>トリム</b>（<kbd>X</kbd>） — 線・円弧・円の不要な部分をクリックすると、
              他の図形との交点から交点までが切り取られます。
            </li>
            <li>
              <b>分割</b>（<kbd>Z</kbd>） — 交点で2つの図形に切り分けます（トリムと違い両方残ります）。
            </li>
            <li>
              <b>なめらか接続</b> — 2つの線分を順にクリックすると、角を丸める円弧（フィレット）が入ります。
              元の線を動かすと円弧も追従します。
            </li>
            <li>
              <b>ミラー</b> — ①鏡像にしたい図形 → ②対称軸にする線 の順にクリックすると、鏡像の
              <b>コピー</b>ができます（作った後は連動しません。連動させたいときは拘束の「対称」を）。
            </li>
            <li>
              <b>グラフ範囲</b> — グラフ内をドラッグした範囲へ表示範囲をズームします。
              グラフの原点ハンドルをドラッグするとパンです。
            </li>
          </ul>

          <h3>拘束ツール（ツールボックスの「拘束」）</h3>
          <p>
            拘束とは「この線はあの円に接する」のような<b>図形どうしの関係を覚えさせる</b>機能です。
            拘束を作っておくと、基準側の図形を動かしたとき、もう一方が自動で追従します。
            どのツールも上部中央のガイドが次にクリックするものを教えてくれます。
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ツール</th>
                <th>クリックする順番</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>平行 / 垂直</td>
                <td>① 向きを合わせたい図形 → ② 基準にする線分・辺</td>
              </tr>
              <tr>
                <td>一致</td>
                <td>
                  ① 動かす図形の接続点（端点など） → ② 基準の点。
                  同じ線の両端に2つ付けると位置も長さも完全に固定されます
                </td>
              </tr>
              <tr>
                <td>中点</td>
                <td>① 動かす図形（または端点） → ② 基準のエッジ（その中点に一致）</td>
              </tr>
              <tr>
                <td>接線</td>
                <td>
                  ① 線・矢印・ベクトル → ② 円・円弧・楕円。
                  いきなり円をクリックすると接線が新規作成されます
                </td>
              </tr>
              <tr>
                <td>対称</td>
                <td>① 動かす図形 → ② 基準の図形（同じ種類のみ） → ③ 対称軸にする線</td>
              </tr>
            </tbody>
          </table>
          <p className={styles.tip}>
            💡 図形を<b>選択してから</b>拘束ツールに切り替えると、①のクリックを省略できます。
          </p>
          <h4>拘束の確認と解除</h4>
          <ul>
            <li>
              拘束は図形上のマーカーで表示されます：平行 = <b>»</b>、垂直 = <b>L字</b>、一致 = <b>◎</b>。
            </li>
            <li>
              マーカーをクリックすると解除ボタンが出ます（<kbd>Delete</kbd>でも可）。
              図形本体は消さずに<b>その拘束だけ</b>を外せます。
            </li>
            <li>◎（一致点）はドラッグすると、相手の図形の輪郭に沿ってスライドできます。接点も同様です。</li>
          </ul>
          <h4>拘束にまつわる「動かない」「できない」</h4>
          <ul>
            <li>
              矛盾する拘束（過剰拘束）は作成時に却下され、メッセージが出ます。
              後から解けなくなった拘束は<b>赤いマーカー</b>で表示されます。
            </li>
            <li>回転が拘束されている図形（平行・垂直、一致×2など）は回転ハンドルが出ません。</li>
            <li>両端とも一致で固定された線は端点ドラッグができず、プロパティの長さ入力も無効になります。</li>
            <li>思いどおりに動かせないときは、マーカーをクリックして拘束を外すのが早道です。</li>
          </ul>

          <h3>用紙枠とページ</h3>
          <ul>
            <li>
              「レイアウト」カテゴリの<b>用紙枠</b>を置くと、A4などの実寸（mm）の枠ができます。
              印刷やPDF・実寸書き出しはこの枠が基準です。
            </li>
            <li>
              ページ番号は置いた順に自動で付き、枠の左上のバッジをクリックすると枠を選択できます。
              メニューバー右の「ページ」選択でそのページへジャンプします。
            </li>
            <li>
              プロパティで余白ガイド・等分線・対角線を表示できます。スナップは効きますが、印刷・書き出しには写りません
              （枠線そのものは「枠線」プロパティがONだと出力にも描かれます）。
            </li>
          </ul>

          <h3>ショートカットキー一覧</h3>
          <p>Macでは <kbd>Ctrl</kbd> の代わりに <kbd>⌘</kbd> も使えます。</p>
          <h4>全般</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>キー</th>
                <th>動作</th>
              </tr>
            </thead>
            <tbody>
              {GENERAL_SHORTCUTS.map(([key, desc]) => (
                <tr key={key}>
                  <td>
                    <kbd>{key}</kbd>
                  </td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>ツールの切り替え</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>キー</th>
                <th>ツール</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(TOOL_SHORTCUTS).map(([id, key]) => (
                <tr key={id}>
                  <td>
                    <kbd>{key.toUpperCase()}</kbd>
                  </td>
                  <td>{toolName(id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>拘束ツール</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>キー</th>
                <th>ツール</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SHIFT_TOOL_SHORTCUTS).map(([id, key]) => (
                <tr key={id}>
                  <td>
                    <kbd>Shift+{key.toUpperCase()}</kbd>
                  </td>
                  <td>{toolName(id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
