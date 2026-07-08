/**
 * 単位規約。
 *
 * 内部単位(SVGユーザー単位)は CSS ピクセル(96dpi)と同じ尺度で扱う:
 *   1 単位 = 1 CSS px = 1/96 インチ = 0.26458… mm = 0.75 pt
 *
 * 既存プラグインの既定値(線幅・フォント・グリッド)や書き出しの px→pt(×0.75=72/96)は
 * すべてこの尺度で作られている。実寸(mm)を扱うのは用紙枠と印刷書き出しだけで、
 * それらはここの変換関数を通して内部単位へ換算する。
 */
export const UNITS_PER_INCH = 96;
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

/** ミリメートル → 内部単位 */
export const mmToUnits = (mm: number): number => (mm * UNITS_PER_INCH) / MM_PER_INCH;
/** 内部単位 → ミリメートル */
export const unitsToMm = (units: number): number => (units * MM_PER_INCH) / UNITS_PER_INCH;
/** 内部単位 → ポイント(pt)。書き出しの px→pt に一致(×0.75) */
export const unitsToPt = (units: number): number => (units * PT_PER_INCH) / UNITS_PER_INCH;
/** 目標DPIでラスタライズするときの、内部単位あたりのピクセル倍率 */
export const dpiToScale = (dpi: number): number => dpi / UNITS_PER_INCH;
