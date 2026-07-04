import type { PhysicsObjectPlugin } from '../plugin';

export interface TestProps {
  width: number;
  height: number;
}

/** テスト用の最小プラグイン */
export function makeTestPlugin(
  overrides: Partial<PhysicsObjectPlugin<TestProps>> = {},
): PhysicsObjectPlugin<TestProps> {
  return {
    id: 'test.box',
    version: 2,
    name: 'テストボックス',
    category: 'テスト',
    Icon: () => null,
    defaultProps: { width: 100, height: 50 },
    defaultSize: { width: 100, height: 50 },
    propertySchema: [
      { key: 'width', label: '幅', type: 'number' },
      { key: 'height', label: '高さ', type: 'number' },
    ],
    Renderer: () => null,
    getBounds: (props) => ({
      x: -props.width / 2,
      y: -props.height / 2,
      width: props.width,
      height: props.height,
    }),
    ...overrides,
  };
}
