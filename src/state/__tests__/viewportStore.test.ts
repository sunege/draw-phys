import { beforeEach, describe, expect, it } from 'vitest';
import { useViewportStore } from '../viewportStore';

describe('viewportStore スナップ間隔', () => {
  beforeEach(() => {
    useViewportStore.setState({ gridSize: 10, snapEnabled: true, snapDivision: 1 });
  });

  it('snapStepは gridSize / snapDivision', () => {
    const s = useViewportStore.getState();
    expect(s.snapStep()).toBe(10);
    s.setSnapDivision(2);
    expect(useViewportStore.getState().snapStep()).toBe(5);
    s.setSnapDivision(4);
    expect(useViewportStore.getState().snapStep()).toBe(2.5);
  });

  it('toggleSnapはON/OFFを反転する', () => {
    const { toggleSnap } = useViewportStore.getState();
    toggleSnap();
    expect(useViewportStore.getState().snapEnabled).toBe(false);
    toggleSnap();
    expect(useViewportStore.getState().snapEnabled).toBe(true);
  });

  it('OFF→ONに戻しても直前のスナップ間隔(分割数)を保持する', () => {
    const s = useViewportStore.getState();
    s.setSnapDivision(4);
    s.toggleSnap(); // OFF
    s.toggleSnap(); // ON
    const after = useViewportStore.getState();
    expect(after.snapEnabled).toBe(true);
    expect(after.snapDivision).toBe(4);
    expect(after.snapStep()).toBe(2.5);
  });
});
