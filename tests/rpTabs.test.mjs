import test from 'node:test';
import assert from 'node:assert/strict';
import { BG_IMAGES, tabBodyStyle } from '../src/lib/rpTabs.ts';

test('every tab has its own background photo and the body style layers a gradient over it', () => {
  const tabs = ['servers', 'glossary', 'characters', 'mods', 'store', 'community'];
  assert.deepEqual(Object.keys(BG_IMAGES).sort(), [...tabs].sort());
  assert.equal(new Set(Object.values(BG_IMAGES)).size, tabs.length);
  for (const t of tabs) {
    const st = tabBodyStyle(t);
    assert.ok(st.backgroundImage.includes(`url('${BG_IMAGES[t]}')`));
    assert.ok(st.backgroundImage.startsWith('linear-gradient(to bottom'));
    assert.equal(st.backgroundPosition, 'center 20%'); assert.equal(st.backgroundAttachment, 'fixed');
  }
});
