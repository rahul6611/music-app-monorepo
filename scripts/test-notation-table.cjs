// Run: node --test scripts/test-notation-table.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename,
);
const { getBeatColor, getBeatGroupStarts, getBeatMarker } = require('../packages/utils/src/taalStructure.ts');
const { resolveNotationColumnWidths } = require('../packages/utils/src/notationTableLayout.ts');
const { buildNotationTableSections } = require('../packages/utils/src/notationTableData.ts');
const { getBilingualBol, getFingerPresets, getStrokePresets } = require('../packages/utils/src/notationConstants.ts');

test('Stroke and Finger buttons follow the Web Beta instrument presets', () => {
  assert.deepEqual(getStrokePresets(['Sitar']).map(item => item.label), ['Da', 'Ra', 'Diri']);
  assert.deepEqual(getStrokePresets([]).map(item => item.label), ['Da', 'DaRa', 'Daa', 'Dir', 'Khali', 'Ra', 'Raa']);
  assert.deepEqual(getFingerPresets(['Sitar']), ['F1', 'F2', 'F3']);
  assert.deepEqual(getFingerPresets(['Sarod']), ['F1', 'F2']);
  assert.deepEqual(getFingerPresets(['Santoor']), ['L', 'R']);
  assert.deepEqual(getFingerPresets(['Flute']), ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']);
});

test('all percussion dictionaries resolve from English and Hindi', () => {
  for (const [en, hi] of [['Ghe', 'घे'], ['Dha', 'ध'], ['Thom', 'थोम'], ['Kii-ṭi-ta-ka', 'कीटितक']]) {
    assert.deepEqual(getBilingualBol(en), { en, hi });
    assert.deepEqual(getBilingualBol(hi), { en, hi });
  }
  assert.deepEqual(getBilingualBol('S'), { en: 'S', hi: 'ऽ' });
  assert.deepEqual(getBilingualBol('ऽ'), { en: 'S', hi: 'ऽ' });
  assert.deepEqual(getBilingualBol('Kii-Ṭa'), { en: 'Kii-Ṭa', hi: 'की-ट' });
});

test('Beta spelling aliases and decorated composition names resolve markers', () => {
  for (const name of ['Jhaptal', 'Jhaptaal — 10 beats (2+3+2+3)', 'Jhaptaal (2+3+2+3)']) {
    assert.equal(getBeatMarker(3, name), 'X');
    assert.equal(getBeatMarker(6, name), 'O');
    assert.deepEqual(getBeatGroupStarts(name, 10), [1, 3, 6, 8]);
  }
  assert.equal(getBeatMarker(5, 'Teental — 16 beats'), 'X');
  assert.equal(getBeatMarker(3, 'Ektal — 12 beats'), 'O');
});
test('explicit 2+2+3 divisions alternate headers and repeat each cycle', () => {
  const name = 'Custom — 7 beats (2+2+3)';
  const colors = Array.from({length: 7}, (_, i) => getBeatColor(i + 1, name, 7));
  assert.deepEqual(colors, ['#9FA8DA', '#9FA8DA', '#80CBC4', '#80CBC4', '#9FA8DA', '#9FA8DA', '#9FA8DA']);
  assert.equal(getBeatColor(10, name, 7), colors[2]);
});
test('invalid division totals do not override known taal defaults', () => {
  assert.deepEqual(getBeatGroupStarts('Jhaptal (2+2+3)', 10), [1, 3, 6, 8]);
});
test('long single-beat content expands its column instead of overflowing', () => {
  const widths = resolveNotationColumnWidths(10, 290, [{ column: 1, span: 1, width: 290 }]);
  assert.equal(widths[1], 290);
  assert.equal(widths[0], 55);
  assert.ok(widths.reduce((sum, w) => sum + w, 0) > 290);
});
test('spans share width constraints without changing beat count', () => {
  const widths = resolveNotationColumnWidths(7, 290, [
    { column: 1, span: 2, width: 400 }, { column: 2, span: 1, width: 180 },
  ]);
  assert.equal(widths.length, 7);
  assert.ok(widths[1] + widths[2] >= 400);
  assert.ok(widths[2] >= 180);
});
test('desktop widths fill space while retaining intrinsic minima', () => {
  const widths = resolveNotationColumnWidths(10, 1800, [{column: 0, span: 1, width: 300}]);
  assert.equal(widths.reduce((sum, w) => sum + w, 0), 1800);
  assert.ok(widths[0] >= 300);
});
test('shrinking content allows columns to shrink on a fresh measurement pass', () => {
  assert.equal(resolveNotationColumnWidths(10, 290, [{column: 0, span: 1, width: 25}])[0], 55);
});
test('separate phrases, absolute beats, all fields and nested effects survive conversion', () => {
  const sections = buildNotationTableSections([
    { phraseId:'a', sectionLabel:'Sthayi', entries:[{beat:1,swar:'S'}]},
    { phraseId:'b', sectionLabel:'Sthayi', entries:[{beat:1,swar:'/mu /md S R / /', tabla:'Dha', stroke:'D', finger:'1', lyric:'words', pakhawaj:'Ta', mridangam:'Thom', layakari:'2'}]},
    { phraseId:'b', sectionLabel:'Sthayi', entries:[{beat:2,absoluteBeat:12,swar:'G'}]},
  ]);
  assert.equal(sections.length, 2);
  assert.equal(sections[1].rows.length, 8);
  assert.deepEqual(sections[1].rows.map(row => row.key), [
    'bol', 'pakhawajBol', 'mridangamBol', 'swar', 'stroke', 'finger', 'lyrics', 'layakari',
  ]);
  const swar = sections[1].rows.find(row => row.key === 'swar');
  assert.deepEqual(swar.cells.map(c=>c.beatIndex), [1,12]);
  assert.equal(swar.cells[0].data[0].type, '/mu');
  assert.equal(swar.cells[0].data[0].content[0].type, '/md');
});
