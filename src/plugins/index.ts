import { pluginRegistry } from '../core/registry';
import { angleMarkPlugin } from './annotation/angleMark';
import { lengthMarkPlugin } from './annotation/lengthMark';
import { arcPlugin } from './basic/arc';
import { arrowPlugin } from './basic/arrow';
import { circlePlugin } from './basic/circle';
import { latexPlugin } from './basic/latex';
import { linePlugin } from './basic/line';
import { pointPlugin } from './basic/point';
import { rectPlugin } from './basic/rect';
import { textPlugin } from './basic/text';
import { blockPlugin } from './mechanics/block';
import { floorPlugin } from './mechanics/floor';
import { forceVectorPlugin } from './mechanics/forceVector';
import { springPlugin } from './mechanics/spring';
import { vectorPlugin } from './mechanics/vector';

/**
 * 標準プラグインの登録。
 * 新しいプラグインはここに1行追加するだけでツールボックスへ表示される。
 */
export function registerStandardPlugins(): void {
  pluginRegistry.register(linePlugin);
  pluginRegistry.register(pointPlugin);
  pluginRegistry.register(circlePlugin);
  pluginRegistry.register(rectPlugin);
  pluginRegistry.register(arcPlugin);
  pluginRegistry.register(arrowPlugin);
  pluginRegistry.register(textPlugin);
  pluginRegistry.register(latexPlugin);
  pluginRegistry.register(blockPlugin);
  pluginRegistry.register(springPlugin);
  pluginRegistry.register(vectorPlugin);
  pluginRegistry.register(forceVectorPlugin);
  pluginRegistry.register(floorPlugin);
  pluginRegistry.register(angleMarkPlugin);
  pluginRegistry.register(lengthMarkPlugin);
}
