import { pluginRegistry } from '../core/registry';
import { angleMarkPlugin } from './annotation/angleMark';
import { lengthMarkPlugin } from './annotation/lengthMark';
import { arcPlugin } from './basic/arc';
import { arrowPlugin } from './basic/arrow';
import { blockArrowPlugin } from './basic/blockArrow';
import { circlePlugin } from './basic/circle';
import { ellipsePlugin } from './basic/ellipse';
import { ellipseArcPlugin } from './basic/ellipseArc';
import { latexPlugin } from './basic/latex';
import { latexDocPlugin } from './basic/latexDoc';
import { linePlugin } from './basic/line';
import { pointPlugin } from './basic/point';
import { rectPlugin } from './basic/rect';
import { textPlugin } from './basic/text';
import { graphPlugin } from './graph/graph';
import { imagePlugin } from './layout/image';
import { pageFramePlugin } from './layout/pageFrame';
import { tablePlugin } from './layout/table';
import { acSourcePlugin } from './electromagnetism/acSource';
import { barMagnetPlugin } from './electromagnetism/barMagnet';
import { capacitorPlugin } from './electromagnetism/capacitor';
import { currentDirectionPlugin } from './electromagnetism/currentDirection';
import { dcSourcePlugin } from './electromagnetism/dcSource';
import { diodePlugin } from './electromagnetism/diode';
import { earthPlugin } from './electromagnetism/earth';
import { groundPlugin } from './electromagnetism/ground';
import { inductorPlugin } from './electromagnetism/inductor';
import { lampPlugin } from './electromagnetism/lamp';
import { pointChargePlugin } from './electromagnetism/pointCharge';
import {
  ammeterPlugin,
  galvanometerPlugin,
  voltmeterPlugin,
} from './electromagnetism/meter';
import { resistorPlugin } from './electromagnetism/resistor';
import { switchPlugin } from './electromagnetism/switchSym';
import { variableResistorPlugin } from './electromagnetism/variableResistor';
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
  pluginRegistry.register(ellipsePlugin);
  pluginRegistry.register(ellipseArcPlugin);
  pluginRegistry.register(arrowPlugin);
  pluginRegistry.register(blockArrowPlugin);
  pluginRegistry.register(textPlugin);
  pluginRegistry.register(latexPlugin);
  pluginRegistry.register(latexDocPlugin);
  pluginRegistry.register(blockPlugin);
  pluginRegistry.register(springPlugin);
  pluginRegistry.register(vectorPlugin);
  pluginRegistry.register(forceVectorPlugin);
  pluginRegistry.register(floorPlugin);
  pluginRegistry.register(angleMarkPlugin);
  pluginRegistry.register(lengthMarkPlugin);
  pluginRegistry.register(graphPlugin);
  pluginRegistry.register(pageFramePlugin);
  pluginRegistry.register(imagePlugin);
  pluginRegistry.register(tablePlugin);
  // 電磁気(回路記号)
  pluginRegistry.register(dcSourcePlugin);
  pluginRegistry.register(acSourcePlugin);
  pluginRegistry.register(resistorPlugin);
  pluginRegistry.register(variableResistorPlugin);
  pluginRegistry.register(capacitorPlugin);
  pluginRegistry.register(inductorPlugin);
  pluginRegistry.register(diodePlugin);
  pluginRegistry.register(switchPlugin);
  pluginRegistry.register(lampPlugin);
  pluginRegistry.register(ammeterPlugin);
  pluginRegistry.register(voltmeterPlugin);
  pluginRegistry.register(galvanometerPlugin);
  pluginRegistry.register(earthPlugin);
  pluginRegistry.register(groundPlugin);
  // 電磁気(場・静電気・磁気)
  pluginRegistry.register(currentDirectionPlugin);
  pluginRegistry.register(pointChargePlugin);
  pluginRegistry.register(barMagnetPlugin);
}
