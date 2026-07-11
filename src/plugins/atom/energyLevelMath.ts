export type LevelSpacing = 'equal' | 'hydrogen';

/**
 * エネルギー準位のローカルy位置(下=n=1、上へ)。戻り値のindexはn-1。
 * - equal: 等間隔(n=1が下端 y=+H/2、n=countが上端 y=-H/2)
 * - hydrogen: E_n ∝ -1/n²。E=0(電離)を上端(y=-H/2)に取り y = H/2 - H·(1 - 1/n²)
 */
export function energyLevelYs(count: number, height: number, spacing: LevelSpacing): number[] {
  const bottom = height / 2;
  if (spacing === 'equal') {
    if (count <= 1) return [bottom];
    return Array.from({ length: count }, (_, i) => bottom - (height * i) / (count - 1));
  }
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return bottom - height * (1 - 1 / (n * n));
  });
}
