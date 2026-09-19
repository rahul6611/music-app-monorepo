const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { COMPOSITION_TYPES, COMPOSITION_TAALS, COMPOSITION_LAYAS, initialCompositionForm, compositionPayload } =
  require('../apps/mobile/components/library/compositionForm.ts');

test('screenshot options match Web Beta standard lists without custom Taals', () => {
  assert.deepEqual(COMPOSITION_TYPES, ['Bada Khayal', 'Bhajan', 'Chhota Khayal', 'Dhrupad', 'Gat', 'Kirtan', 'Sadra', 'Tarana', 'Thumri']);
  assert.deepEqual(COMPOSITION_LAYAS, ['Vilambit', 'Madhya', 'Drut']);
  assert.equal(COMPOSITION_TAALS.length, 9);
  for (const taal of COMPOSITION_TAALS) {
    const [, beats, divisions] = taal.match(/— (\d+) beats \(([\d+]+)\)/);
    assert.equal(divisions.split('+').reduce((total, n) => total + Number(n), 0), Number(beats));
  }
});
test('new form is empty and rhythm based', () => {
  assert.deepEqual(initialCompositionForm(), { category: 'gat_bandish', name: '', type: '', taal: '', laya: '' });
});
test('Aalap saves using Web type and removes hidden rhythmic fields', () => {
  const form = { ...initialCompositionForm(), category: 'aalap', name: ' Test ', taal: COMPOSITION_TAALS[0], laya: 'Drut' };
  assert.deepEqual(compositionPayload(form), { name: 'Test', type: 'Aalap', taal: '', laya: '' });
  assert.equal(initialCompositionForm(compositionPayload(form)).category, 'aalap');
});
test('rhythm save and edit preserve all chosen options', () => {
  const data = { name: 'Test', type: 'Gat', taal: COMPOSITION_TAALS[3], laya: 'Madhya' };
  assert.deepEqual(compositionPayload(initialCompositionForm(data)), data);
  assert.equal(initialCompositionForm({ taal: 'Jhaptal — 10 beats' }).taal, COMPOSITION_TAALS[3]);
});
test('legacy custom Taal is not erased by opening edit or added to the dropdown', () => {
  assert.equal(initialCompositionForm({ taal: 'Legacy Taal' }).taal, 'Legacy Taal');
  assert.ok(!COMPOSITION_TAALS.includes('Legacy Taal'));
});
