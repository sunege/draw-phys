import { useEffect, useRef } from 'react';

/**
 * 遅延コミット式の数値入力。
 *
 * 通常の `<input type="number">` は入力途中を一文字ずつ反映すると、負値の頭の "-"
 * を打った瞬間に `value` が空("")=0 とみなされて 0 に戻ってしまう。ここでは
 * 入力中は非制御(uncontrolled)にしてブラウザに文字列を保持させ、フォーカスが外れる
 * (blur)か Enter を押した段階でのみ検査してコミットする。数値化できない・空の場合は
 * 直前の値へ戻す。範囲外(min/max)は範囲内へ丸める。Escape で編集を取り消す。
 *
 * ただしスピナー(上下ボタン)や上下キーによるステップ変更は即時コミットする。これらは
 * `input` イベントの `inputType` が空になり、直接タイプ(insertText 等)と区別できる。
 *
 * 外部から `value` が変わったとき(ドラッグや拘束解決)は、編集中でなければDOMへ反映する。
 */
export function NumberInput({
  value,
  mixed = false,
  disabled = false,
  disabledTitle,
  placeholder,
  min,
  max,
  step,
  className,
  onCommit,
}: {
  value: number | undefined;
  /** 複数選択の一括編集で値が食い違う場合 true(空表示にする) */
  mixed?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  onCommit: (value: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const displayValue = !mixed && typeof value === 'number' ? String(value) : '';

  // 編集中でないときだけ外部値の変化をDOMへ反映する(非制御運用)
  useEffect(() => {
    if (!focused.current && ref.current) ref.current.value = displayValue;
  }, [displayValue]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const raw = el.value.trim();
    const n = Number(raw);
    // 空・数値化不能は直前の値へ戻す
    if (raw === '' || Number.isNaN(n)) {
      el.value = displayValue;
      return;
    }
    // 範囲外は範囲内へ丸める
    let next = n;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (next !== value) onCommit(next);
    el.value = String(next);
  };

  return (
    <input
      ref={ref}
      type="number"
      defaultValue={displayValue}
      placeholder={placeholder ?? (mixed ? '(複数の値)' : undefined)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      className={className}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        // スピナー(上下ボタン)や上下キーは inputType が空 → 即時反映。
        // 直接タイプ(insertText / deleteContentBackward 等)は blur/Enter まで遅延。
        if (!(e.nativeEvent as InputEvent).inputType) commit();
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.currentTarget.value = displayValue;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
