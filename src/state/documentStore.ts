import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { create } from 'zustand';
import { solveConstraints, solveConstraintsInPlace } from '../core/constraints';
import { sortedObjects, type SceneObject, type SceneObjects } from '../core/document';
import { unionRects, worldBounds } from '../core/geometry';
import type { TrimPiece } from '../core/plugin';
import { pluginRegistry } from '../core/registry';
import type { ObjectRef, Rect, Transform } from '../core/types';

enablePatches();

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type ReorderMode = 'front' | 'back' | 'forward' | 'backward';

/** グループに属するオブジェクトはグループ全体へ選択を広げる */
export function expandWithGroups(objects: SceneObjects, ids: string[]): string[] {
  const groupIds = new Set<string>();
  for (const id of ids) {
    const groupId = objects[id]?.groupId;
    if (groupId) groupIds.add(groupId);
  }
  if (groupIds.size === 0) return ids;
  const result = new Set(ids);
  for (const obj of Object.values(objects)) {
    if (obj.groupId && groupIds.has(obj.groupId)) result.add(obj.id);
  }
  return [...result];
}

function objectWorldRect(obj: SceneObject): Rect | null {
  const plugin = pluginRegistry.get(obj.pluginId);
  if (!plugin) return null;
  return worldBounds(plugin.getBounds(obj.props), obj.transform);
}

/** Undo/Redo履歴の1エントリ(immerパッチ/逆パッチの組) */
interface HistoryEntry {
  redo: Patch[];
  undo: Patch[];
}

const HISTORY_LIMIT = 100;

interface DocumentState {
  objects: SceneObjects;
  selection: string[];
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  /** 次に配置するオブジェクトへ割り当てるzIndex */
  nextZIndex: number;

  addObject(obj: SceneObject): void;
  /** 複数オブジェクトを1履歴エントリで追加し、選択する(貼り付け用) */
  addObjects(objs: SceneObject[]): void;
  removeObjects(ids: string[]): void;
  /**
   * トリム結果を適用する(履歴1エントリ)。pieces から対象を作り直す:
   * 0件=対象削除+参照掃除 / 1件=対象更新 / 2件=分割(対象更新+新規追加)。
   * 対象自身のrefは破棄する(手動編集をソルバが巻き戻さないよう自由な幾何にする)。
   */
  applyTrim(targetId: string, pieces: TrimPiece[]): void;
  /** プラグイン固有プロパティの更新(履歴に残る) */
  updateProps(id: string, patch: Record<string, unknown>): void;
  /** 複数オブジェクトのpropsを一括更新する(1履歴エントリ)。ページ順の振り直し等に使う */
  updatePropsMany(patches: Record<string, Record<string, unknown>>): void;
  /** オブジェクトの参照(拘束)を差し替える。空配列で拘束解除(履歴に残る) */
  setObjectRefs(id: string, refs: ObjectRef[]): void;
  /** 参照を一時更新して再解決する(接続点スライドのドラッグ中。履歴に残さない) */
  setObjectRefsTransient(id: string, refs: ObjectRef[]): void;
  /**
   * ドラッグ中の一時的なtransform更新。履歴に残さない。
   * 操作確定時に commitTransforms() で1エントリとして記録する。
   */
  setTransformsTransient(transforms: Record<string, Transform>): void;
  /** ドラッグ開始時のtransformを渡し、現在値との差分を履歴へ1エントリで記録する */
  commitTransforms(before: Record<string, Transform>): void;
  /**
   * 単一オブジェクトの transform / props / refs を一時更新する(履歴に残さない)。
   * 拡大縮小のprops反映・端点編集など、props と transform(と拘束)が同時に変わる操作用。
   */
  setObjectTransient(
    id: string,
    patch: { transform?: Transform; props?: Record<string, unknown>; refs?: ObjectRef[] },
  ): void;
  /** 開始時の transform / props / refs を渡し、現在値との差分を履歴へ1エントリで記録する */
  commitObject(
    id: string,
    before: { transform: Transform; props: Record<string, unknown>; refs?: ObjectRef[] },
  ): void;

  setSelection(ids: string[]): void;
  toggleSelection(id: string): void;
  clearSelection(): void;

  /** 選択中の2個以上のオブジェクトを1グループにする */
  groupSelection(): void;
  ungroupSelection(): void;
  /** 選択オブジェクトを整列する(2個以上で有効) */
  alignSelection(mode: AlignMode): void;
  /** 重なり順の変更 */
  reorderSelection(mode: ReorderMode): void;
  /** ロック/表示/コンストラクション状態の変更(履歴に残る) */
  setObjectFlags(
    ids: string[],
    flags: { locked?: boolean; visible?: boolean; construction?: boolean },
  ): void;

  undo(): void;
  redo(): void;

  /** ファイル読込時などの全置換。履歴・選択はリセットする */
  loadObjects(objects: SceneObjects): void;
}

function maxZIndex(objects: SceneObjects): number {
  let max = 0;
  for (const obj of Object.values(objects)) max = Math.max(max, obj.zIndex);
  return max;
}

export const useDocumentStore = create<DocumentState>((set, get) => {
  /** objectsをimmer経由で変更し、拘束を解決してからパッチを履歴へ積む */
  const mutate = (recipe: (draft: SceneObjects) => void) => {
    const [next, redo, undo] = produceWithPatches(get().objects, (draft) => {
      recipe(draft);
      solveConstraintsInPlace(draft, pluginRegistry);
    });
    if (redo.length === 0) return;
    set({
      objects: next,
      undoStack: [...get().undoStack, { redo, undo }].slice(-HISTORY_LIMIT),
      redoStack: [],
    });
  };

  return {
    objects: {},
    selection: [],
    undoStack: [],
    redoStack: [],
    nextZIndex: 1,

    addObject(obj) {
      // 生成フック: 同種の既存オブジェクトを見て初期propsを補正(用紙枠のページ自動採番など)
      const plugin = pluginRegistry.get(obj.pluginId);
      const toAdd = plugin?.initProps
        ? {
            ...obj,
            props: plugin.initProps(
              obj.props,
              Object.values(get().objects)
                .filter((o) => o.pluginId === obj.pluginId)
                .map((o) => o.props),
            ),
          }
        : obj;
      mutate((draft) => {
        draft[toAdd.id] = toAdd;
      });
      set({ nextZIndex: Math.max(get().nextZIndex, toAdd.zIndex) + 1, selection: [toAdd.id] });
    },

    addObjects(objs) {
      if (objs.length === 0) return;
      mutate((draft) => {
        for (const obj of objs) draft[obj.id] = obj;
      });
      const maxZ = Math.max(...objs.map((o) => o.zIndex));
      set({
        nextZIndex: Math.max(get().nextZIndex, maxZ) + 1,
        selection: objs.map((o) => o.id),
      });
    },

    removeObjects(ids) {
      if (ids.length === 0) return;
      const removed = new Set(ids);
      mutate((draft) => {
        for (const id of ids) delete draft[id];
        // デタッチ: 削除対象を指すrefを残存オブジェクトから除去(依存側は自由オブジェクトになる)
        for (const obj of Object.values(draft)) {
          if (!obj.refs) continue;
          const kept = obj.refs.filter((r) => !removed.has(r.targetId));
          if (kept.length !== obj.refs.length) {
            if (kept.length) obj.refs = kept;
            else delete obj.refs;
          }
        }
      });
      set({ selection: get().selection.filter((id) => !removed.has(id)) });
    },

    applyTrim(targetId, pieces) {
      const { objects, selection } = get();
      const target = objects[targetId];
      if (!target) return;
      const newIds: string[] = [];
      let z = get().nextZIndex;
      mutate((draft) => {
        if (pieces.length === 0) {
          // 全消し: 対象を削除し、対象を指すrefを他オブジェクトから掃除(拘束ごと削除)
          delete draft[targetId];
          for (const obj of Object.values(draft)) {
            if (!obj.refs) continue;
            const kept = obj.refs.filter((r) => r.targetId !== targetId);
            if (kept.length !== obj.refs.length) {
              if (kept.length) obj.refs = kept;
              else delete obj.refs;
            }
          }
          return;
        }
        // 先頭部品で対象を更新(pluginId変更=円→円弧に対応)。対象自身のrefは破棄
        const first = pieces[0];
        const fp = pluginRegistry.get(first.pluginId);
        const t = draft[targetId];
        t.pluginId = first.pluginId;
        t.version = fp?.version ?? t.version;
        t.props = first.props;
        t.transform = first.transform;
        delete t.refs;
        // 分割で増えた部品は envelope を引き継いだ新規オブジェクト(新ID・refs無し)
        for (let i = 1; i < pieces.length; i++) {
          const pc = pieces[i];
          const plg = pluginRegistry.get(pc.pluginId);
          const id = crypto.randomUUID();
          newIds.push(id);
          draft[id] = {
            id,
            pluginId: pc.pluginId,
            version: plg?.version ?? 1,
            transform: pc.transform,
            zIndex: z++,
            locked: target.locked,
            visible: target.visible,
            props: pc.props,
            ...(target.groupId ? { groupId: target.groupId } : {}),
            ...(target.construction ? { construction: target.construction } : {}),
          };
        }
      });
      set({
        nextZIndex: Math.max(get().nextZIndex, z),
        selection:
          pieces.length === 0
            ? selection.filter((id) => id !== targetId)
            : [targetId, ...newIds],
      });
    },

    updateProps(id, patch) {
      mutate((draft) => {
        const obj = draft[id];
        if (!obj) return;
        Object.assign(obj.props, patch);
      });
    },

    updatePropsMany(patches) {
      mutate((draft) => {
        for (const [id, patch] of Object.entries(patches)) {
          const obj = draft[id];
          if (obj) Object.assign(obj.props, patch);
        }
      });
    },

    setObjectRefs(id, refs) {
      mutate((draft) => {
        const obj = draft[id];
        if (!obj) return;
        if (refs.length) obj.refs = refs;
        else delete obj.refs;
      });
    },

    setObjectRefsTransient(id, refs) {
      const objects = { ...get().objects };
      const obj = objects[id];
      if (!obj) return;
      objects[id] = { ...obj, refs };
      set({ objects: solveConstraints(objects, pluginRegistry) });
    },

    setTransformsTransient(transforms) {
      const objects = { ...get().objects };
      for (const [id, transform] of Object.entries(transforms)) {
        const obj = objects[id];
        if (!obj) continue;
        objects[id] = { ...obj, transform };
      }
      set({ objects: solveConstraints(objects, pluginRegistry) });
    },

    commitTransforms(before) {
      const { objects } = get();
      const redo: Patch[] = [];
      const undo: Patch[] = [];
      for (const [id, prev] of Object.entries(before)) {
        const current = objects[id];
        if (!current) continue;
        const cur = current.transform;
        if (
          cur.x === prev.x &&
          cur.y === prev.y &&
          cur.rotation === prev.rotation &&
          cur.scaleX === prev.scaleX &&
          cur.scaleY === prev.scaleY
        ) {
          continue;
        }
        redo.push({ op: 'replace', path: [id, 'transform'], value: cur });
        undo.push({ op: 'replace', path: [id, 'transform'], value: prev });
      }
      if (redo.length === 0) return;
      set({
        undoStack: [...get().undoStack, { redo, undo }].slice(-HISTORY_LIMIT),
        redoStack: [],
      });
    },

    setObjectTransient(id, patch) {
      const objects = { ...get().objects };
      const obj = objects[id];
      if (!obj) return;
      objects[id] = {
        ...obj,
        ...(patch.transform ? { transform: patch.transform } : {}),
        ...(patch.props ? { props: patch.props } : {}),
        ...(patch.refs ? { refs: patch.refs } : {}),
      };
      set({ objects: solveConstraints(objects, pluginRegistry) });
    },

    commitObject(id, before) {
      const cur = get().objects[id];
      if (!cur) return;
      const redo: Patch[] = [];
      const undo: Patch[] = [];
      const t = cur.transform;
      const pt = before.transform;
      if (
        t.x !== pt.x ||
        t.y !== pt.y ||
        t.rotation !== pt.rotation ||
        t.scaleX !== pt.scaleX ||
        t.scaleY !== pt.scaleY
      ) {
        redo.push({ op: 'replace', path: [id, 'transform'], value: t });
        undo.push({ op: 'replace', path: [id, 'transform'], value: pt });
      }
      if (JSON.stringify(cur.props) !== JSON.stringify(before.props)) {
        redo.push({ op: 'replace', path: [id, 'props'], value: cur.props });
        undo.push({ op: 'replace', path: [id, 'props'], value: before.props });
      }
      // refs(拘束)も渡されていれば差分を記録する(端点ドラッグでのlocalAnchor更新など)
      if (before.refs !== undefined && JSON.stringify(cur.refs ?? null) !== JSON.stringify(before.refs)) {
        redo.push({ op: 'replace', path: [id, 'refs'], value: cur.refs });
        undo.push({ op: 'replace', path: [id, 'refs'], value: before.refs });
      }
      if (redo.length === 0) return;
      set({
        undoStack: [...get().undoStack, { redo, undo }].slice(-HISTORY_LIMIT),
        redoStack: [],
      });
    },

    setSelection(ids) {
      set({ selection: ids });
    },

    toggleSelection(id) {
      const { selection } = get();
      set({
        selection: selection.includes(id)
          ? selection.filter((s) => s !== id)
          : [...selection, id],
      });
    },

    clearSelection() {
      set({ selection: [] });
    },

    groupSelection() {
      const { selection } = get();
      if (selection.length < 2) return;
      const groupId = crypto.randomUUID();
      mutate((draft) => {
        for (const id of selection) {
          const obj = draft[id];
          if (obj) obj.groupId = groupId;
        }
      });
    },

    ungroupSelection() {
      const { selection } = get();
      mutate((draft) => {
        for (const id of selection) {
          const obj = draft[id];
          if (obj) delete obj.groupId;
        }
      });
    },

    alignSelection(mode) {
      const { selection, objects } = get();
      if (selection.length < 2) return;
      const rects = new Map<string, Rect>();
      for (const id of selection) {
        const obj = objects[id];
        if (!obj || obj.locked) continue;
        const rect = objectWorldRect(obj);
        if (rect) rects.set(id, rect);
      }
      const union = unionRects([...rects.values()]);
      if (!union) return;
      mutate((draft) => {
        for (const [id, rect] of rects) {
          const obj = draft[id];
          if (!obj) continue;
          switch (mode) {
            case 'left':
              obj.transform.x += union.x - rect.x;
              break;
            case 'centerX':
              obj.transform.x += union.x + union.width / 2 - (rect.x + rect.width / 2);
              break;
            case 'right':
              obj.transform.x += union.x + union.width - (rect.x + rect.width);
              break;
            case 'top':
              obj.transform.y += union.y - rect.y;
              break;
            case 'centerY':
              obj.transform.y += union.y + union.height / 2 - (rect.y + rect.height / 2);
              break;
            case 'bottom':
              obj.transform.y += union.y + union.height - (rect.y + rect.height);
              break;
          }
        }
      });
    },

    reorderSelection(mode) {
      const { selection, objects } = get();
      if (selection.length === 0) return;
      const selected = new Set(selection);
      const order = sortedObjects(objects).map((o) => o.id);
      let next: string[];
      if (mode === 'front') {
        next = [...order.filter((id) => !selected.has(id)), ...order.filter((id) => selected.has(id))];
      } else if (mode === 'back') {
        next = [...order.filter((id) => selected.has(id)), ...order.filter((id) => !selected.has(id))];
      } else {
        next = [...order];
        const step = mode === 'forward' ? 1 : -1;
        const indices = next
          .map((id, i) => (selected.has(id) ? i : -1))
          .filter((i) => i >= 0);
        // 前面へは上から、背面へは下から順に1段ずつ入れ替える
        if (step === 1) indices.reverse();
        for (const i of indices) {
          const j = i + step;
          if (j < 0 || j >= next.length || selected.has(next[j])) continue;
          [next[i], next[j]] = [next[j], next[i]];
        }
      }
      mutate((draft) => {
        next.forEach((id, i) => {
          const obj = draft[id];
          if (obj) obj.zIndex = i + 1;
        });
      });
      set({ nextZIndex: next.length + 1 });
    },

    setObjectFlags(ids, flags) {
      if (ids.length === 0) return;
      mutate((draft) => {
        for (const id of ids) {
          const obj = draft[id];
          if (!obj) continue;
          if (flags.locked !== undefined) obj.locked = flags.locked;
          if (flags.visible !== undefined) obj.visible = flags.visible;
          if (flags.construction !== undefined) obj.construction = flags.construction;
        }
      });
    },

    undo() {
      const { undoStack, redoStack, objects, selection } = get();
      const entry = undoStack[undoStack.length - 1];
      if (!entry) return;
      // 依存オブジェクトは対象から純粋に導出されるため、パッチ適用後に再解決する
      const next = solveConstraints(applyPatches(objects, entry.undo), pluginRegistry);
      set({
        objects: next,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, entry],
        selection: selection.filter((id) => id in next),
        nextZIndex: maxZIndex(next) + 1,
      });
    },

    redo() {
      const { undoStack, redoStack, objects, selection } = get();
      const entry = redoStack[redoStack.length - 1];
      if (!entry) return;
      const next = solveConstraints(applyPatches(objects, entry.redo), pluginRegistry);
      set({
        objects: next,
        undoStack: [...undoStack, entry],
        redoStack: redoStack.slice(0, -1),
        selection: selection.filter((id) => id in next),
        nextZIndex: maxZIndex(next) + 1,
      });
    },

    loadObjects(objects) {
      // 欠損ターゲットへのrefを除去してから拘束を解決する
      // (自由基準点を持つ一致拘束は対象が無くても保持する)
      for (const obj of Object.values(objects)) {
        if (!obj.refs) continue;
        const kept = obj.refs.filter(
          (r) => objects[r.targetId] || (r.role === 'coincident' && r.worldAnchor),
        );
        if (kept.length) obj.refs = kept;
        else delete obj.refs;
      }
      set({
        objects: solveConstraints(objects, pluginRegistry),
        selection: [],
        undoStack: [],
        redoStack: [],
        nextZIndex: maxZIndex(objects) + 1,
      });
    },
  };
});
