import type { AnyPlugin } from '../core/plugin';

/** 補助線(コンストラクション)の色付き点線カラー */
export const CONSTRUCTION_COLOR = '#12a5c8';

/**
 * コンストラクション(作図補助線)の描画。プラグインの getSegments / getCircle が返す
 * ローカル幾何を色付き点線で描く。スナップ・拘束はプラグイン側で通常どおり働くため、
 * ここでは見た目(点線化・色)だけを差し替える。書き出しには含めない(ObjectsLayer 専用)。
 */
export function ConstructionView({
  plugin,
  props,
}: {
  plugin: AnyPlugin;
  props: Record<string, unknown>;
}) {
  // 線幅は元オブジェクトに追従。0(枠なし円など)でも補助線は見えるよう下限を設ける
  const strokeWidth = Math.max(typeof props.strokeWidth === 'number' ? props.strokeWidth : 1.5, 0.75);
  const dash = `${strokeWidth * 3 + 3} ${strokeWidth * 2 + 2}`;
  const hit = Math.max(strokeWidth, 12);
  const circle = plugin.getCircle?.(props);
  const ellipse = plugin.getEllipse?.(props);
  const segments = plugin.getSegments?.(props);

  return (
    <g>
      {circle && (
        <>
          <circle
            cx={circle.center.x}
            cy={circle.center.y}
            r={circle.radius}
            fill="none"
            stroke={CONSTRUCTION_COLOR}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          {/* 当たり判定用の透明な太い輪郭 */}
          <circle
            cx={circle.center.x}
            cy={circle.center.y}
            r={circle.radius}
            fill="none"
            stroke="transparent"
            strokeWidth={hit}
          />
        </>
      )}
      {ellipse && (
        <>
          <ellipse
            cx={ellipse.center.x}
            cy={ellipse.center.y}
            rx={ellipse.radiusX}
            ry={ellipse.radiusY}
            fill="none"
            stroke={CONSTRUCTION_COLOR}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          {/* 当たり判定用の透明な太い輪郭 */}
          <ellipse
            cx={ellipse.center.x}
            cy={ellipse.center.y}
            rx={ellipse.radiusX}
            ry={ellipse.radiusY}
            fill="none"
            stroke="transparent"
            strokeWidth={hit}
          />
        </>
      )}
      {segments?.map(([a, b], i) => (
        <g key={i}>
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={CONSTRUCTION_COLOR}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={hit} />
        </g>
      ))}
    </g>
  );
}
