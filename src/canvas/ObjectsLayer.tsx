import { sortedObjects } from '../core/document';
import { transformToString } from '../core/geometry';
import { pluginRegistry } from '../core/registry';
import { useKatexFontsTick } from '../plugins/basic/katexFonts';
import { useDocumentStore } from '../state/documentStore';

/** 全オブジェクトをzIndex順に、各プラグインのRendererで描画する */
export function ObjectsLayer() {
  const objects = useDocumentStore((s) => s.objects);
  // KaTeXフォントのロード完了後に数式を正しい実寸で描き直す
  useKatexFontsTick();

  return (
    <g>
      {sortedObjects(objects).map((obj) => {
        if (!obj.visible) return null;
        const plugin = pluginRegistry.get(obj.pluginId);
        if (!plugin) return null;
        return (
          <g key={obj.id} data-object-id={obj.id} transform={transformToString(obj.transform)}>
            <plugin.Renderer
              props={obj.props}
              transform={obj.transform}
              objectId={obj.id}
              interactive
            />
          </g>
        );
      })}
    </g>
  );
}
