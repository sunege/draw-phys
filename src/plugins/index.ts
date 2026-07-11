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
import { energyLevelsPlugin } from './atom/energyLevels';
import { blockPlugin } from './mechanics/block';
import { cartPlugin } from './mechanics/cart';
import { filletPlugin } from './mechanics/fillet';
import { floorPlugin } from './mechanics/floor';
import { forceVectorPlugin } from './mechanics/forceVector';
import { inclinePlugin } from './mechanics/incline';
import { pulleyPlugin } from './mechanics/pulley';
import { springPlugin } from './mechanics/spring';
import { stringPlugin } from './mechanics/string';
import { vectorPlugin } from './mechanics/vector';
import { concaveMirrorPlugin, convexMirrorPlugin } from './optics/curvedMirror';
import { concaveLensPlugin, convexLensPlugin } from './optics/lens';
import { lightSourcePlugin } from './optics/lightSource';
import { mirrorPlugin } from './optics/mirror';
import { prismPlugin } from './optics/prism';
import { rayPlugin } from './optics/ray';
import { cylinderPlugin } from './thermo/cylinder';
import { flamePlugin } from './thermo/flame';
import { gasMoleculesPlugin } from './thermo/gasMolecules';
import { thermometerPlugin } from './thermo/thermometer';
import { planeWavePlugin } from './waves/planeWave';
import { sineWavePlugin } from './waves/sineWave';
import { tuningForkPlugin } from './waves/tuningFork';
import { wavefrontPlugin } from './waves/wavefront';

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
  pluginRegistry.register(inclinePlugin);
  pluginRegistry.register(filletPlugin);
  pluginRegistry.register(pulleyPlugin);
  pluginRegistry.register(cartPlugin);
  pluginRegistry.register(stringPlugin);
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
  // 熱力学
  pluginRegistry.register(cylinderPlugin);
  pluginRegistry.register(gasMoleculesPlugin);
  pluginRegistry.register(flamePlugin);
  pluginRegistry.register(thermometerPlugin);
  // 波動
  pluginRegistry.register(sineWavePlugin);
  pluginRegistry.register(wavefrontPlugin);
  pluginRegistry.register(planeWavePlugin);
  pluginRegistry.register(tuningForkPlugin);
  // 光学
  pluginRegistry.register(convexLensPlugin);
  pluginRegistry.register(concaveLensPlugin);
  pluginRegistry.register(mirrorPlugin);
  pluginRegistry.register(concaveMirrorPlugin);
  pluginRegistry.register(convexMirrorPlugin);
  pluginRegistry.register(rayPlugin);
  pluginRegistry.register(lightSourcePlugin);
  pluginRegistry.register(prismPlugin);
  // 原子
  pluginRegistry.register(energyLevelsPlugin);
}
