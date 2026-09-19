const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { getNotationPositions, getNotationDivisions, moveNotationPosition } = require('../packages/utils/src/notationSelection.ts');
const { parseNestedMusicInput } = require('../packages/utils/src/musicParsers.ts');
const empty = { subIndex: null, kanIndex: null };
const position = (subIndex, kanIndex = null) => ({ subIndex, kanIndex });

test('multiple normal swars do not activate split navigation', () => {
  assert.deepEqual(getNotationPositions('S R G', false), [empty]);
  const next = moveNotationPosition('S R G,M', 5, empty, {}, 'next');
  assert.equal(next.cursor, 7);
  assert.equal(next.subIndex, null);
});

test('right leaves last split, left returns to last split, then first', () => {
  const text = '/sp S R / - , G';
  const splits = { 0: true };
  let next = moveNotationPosition(text, text.indexOf(','), position(0), splits, 'next');
  assert.equal(next.subIndex, 1);
  next = moveNotationPosition(next.text, next.cursor, position(next.subIndex, next.kanIndex), splits, 'next');
  assert.equal(next.subIndex, null);
  next = moveNotationPosition(next.text, next.cursor, empty, splits, 'prev');
  assert.equal(next.subIndex, 1);
  next = moveNotationPosition(next.text, next.cursor, position(1), splits, 'prev');
  assert.equal(next.subIndex, 0);
});

test('Kān and sibling split paths are traversed in both directions', () => {
  const segment = 'S /kn /md R G / / /sp M P /';
  const paths = [position(0), position(1, 0), position(1, 1), position(2)];
  assert.deepEqual(getNotationPositions(segment, true), paths);
  let selection = paths[0];
  for (const expected of paths.slice(1)) {
    const next = moveNotationPosition(segment, segment.length, selection, { 0: true }, 'next');
    selection = position(next.subIndex, next.kanIndex);
    assert.deepEqual(selection, expected);
  }
  for (const expected of paths.slice(0, -1).reverse()) {
    const next = moveNotationPosition(segment, segment.length, selection, { 0: true }, 'prev');
    selection = position(next.subIndex, next.kanIndex);
    assert.deepEqual(selection, expected);
  }
});

test('entering a beat respects outer split order, not first Kān occurrence', () => {
  const text = 'S /kn R G / M, P';
  const previous = moveNotationPosition(text, text.length, empty, { 0: true }, 'prev');
  assert.deepEqual(position(previous.subIndex, previous.kanIndex), position(2));
});

test('Chhand exposes divisions without splitting ornament contents', () => {
  assert.deepEqual(getNotationDivisions('/2 /md S R / /kn G M / /'), ['/md S R /', '/kn G M /']);
  assert.deepEqual(getNotationPositions('/2 /md S R / /kn G M / /', true), [position(0), position(1, 0), position(1, 1)]);
});

test('left at first position stays selected; right on blank creates next beat', () => {
  assert.equal(moveNotationPosition('- -', 3, position(0), { 0: true }, 'prev').subIndex, 0);
  const next = moveNotationPosition('', 0, empty, {}, 'next');
  assert.equal(next.text, ',');
  assert.equal(next.subIndex, null);
});

test('parser and selection keep explicit /sp groups as one piece', () => {
  const source = '/sp S R / /kn G M / -';
  assert.equal(getNotationDivisions(source).length, 3);
  assert.equal(parseNestedMusicInput(source)[0].data.length, 3);
});
