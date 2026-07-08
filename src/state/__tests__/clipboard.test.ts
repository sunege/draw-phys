import { describe, expect, it } from 'vitest';
import { decidePasteTarget } from '../clipboard';

const base = {
  hasImage: true,
  imageKey: 'image/png:1000',
  lastImageKey: '',
  hasInternal: true,
  internalActive: true,
  blurredSinceCopy: false,
};

describe('decidePasteTarget', () => {
  it('画像なし・図形ありは図形', () => {
    expect(decidePasteTarget({ ...base, hasImage: false, imageKey: null })).toBe('internal');
  });

  it('画像なし・図形なしは none(既定に任せる)', () => {
    expect(
      decidePasteTarget({ ...base, hasImage: false, imageKey: null, hasInternal: false }),
    ).toBe('none');
  });

  it('アプリ内コピーが無ければ画像を貼る', () => {
    expect(decidePasteTarget({ ...base, internalActive: false, hasInternal: false })).toBe('image');
  });

  it('報告バグ: 画像が残ったまま図形をCtrl+C→図形を優先(既見画像・ブラー無し)', () => {
    // 画像は以前に見た(lastImageKey一致)、コピー後にブラーしていない
    expect(
      decidePasteTarget({ ...base, imageKey: 'image/png:1000', lastImageKey: 'image/png:1000' }),
    ).toBe('internal');
  });

  it('未見の画像でもコピー後ブラー無しなら図形を優先(コーナーケース)', () => {
    expect(
      decidePasteTarget({ ...base, imageKey: 'image/png:2000', lastImageKey: '', blurredSinceCopy: false }),
    ).toBe('internal');
  });

  it('図形コピー後に別アプリで新規画像をコピー(新keyかつブラー有り)なら画像を優先', () => {
    expect(
      decidePasteTarget({ ...base, imageKey: 'image/png:2000', lastImageKey: 'image/png:1000', blurredSinceCopy: true }),
    ).toBe('image');
  });

  it('ブラーしても同一(既見)画像なら図形を優先(無関係なalt-tab対策)', () => {
    expect(
      decidePasteTarget({ ...base, imageKey: 'image/png:1000', lastImageKey: 'image/png:1000', blurredSinceCopy: true }),
    ).toBe('internal');
  });
});
