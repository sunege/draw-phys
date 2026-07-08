import { worldBounds } from '../core/geometry';
import { orderedPageFrames } from '../core/pageFrames';
import { pluginRegistry } from '../core/registry';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';

/**
 * 用紙枠の左上に 1..N のページ番号バッジを描く編集補助オーバーレイ。
 * capabilities.printFrame を持つ枠に対して汎用的に描く(用紙プラグインに依存しない)。
 * バッジは data-object-id を持つのでクリックでその用紙枠を選択できる(選択の掴みにくさ対策)。
 * キャンバス上のみ。書き出し/印刷は各RendererからSVGを組むためここは出ない。
 */
export function PageBadges() {
  const objects = useDocumentStore((s) => s.objects);
  const zoom = useViewportStore((s) => s.zoom);
  const frames = orderedPageFrames(objects);
  if (frames.length === 0) return null;

  const s = 1 / zoom; // 画面上で一定サイズにする係数

  return (
    <g>
      {frames.map((frame, i) => {
        const plugin = pluginRegistry.get(frame.pluginId);
        if (!plugin) return null;
        const rect = worldBounds(plugin.getBounds(frame.props), frame.transform);
        const cx = rect.x + 15 * s;
        const cy = rect.y + 13 * s;
        return (
          <g
            key={frame.id}
            transform={`translate(${cx} ${cy})`}
            data-object-id={frame.id}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={-13 * s}
              y={-10 * s}
              width={26 * s}
              height={20 * s}
              rx={5 * s}
              fill="#3b82f6"
              opacity={0.9}
            />
            <text
              x={0}
              y={0.5 * s}
              fontSize={13 * s}
              fill="#ffffff"
              textAnchor="middle"
              dominantBaseline="central"
              fontWeight="bold"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}
