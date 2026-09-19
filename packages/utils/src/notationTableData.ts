import {
  parseLyricsMusicInput,
  parseNestedMusicInput,
  parsePercussionBolInput,
  parseStrokeMusicInput,
  type ParsedPhraseCell,
} from './musicParsers';

export interface NotationTableRow {
  key: string;
  cells: ParsedPhraseCell[];
}

export interface NotationTableSectionData {
  label: string;
  rows: NotationTableRow[];
  phraseRanges?: Array<{ id: string; startBeat: number; endBeat: number; color?: string; isDraft?: boolean }>;
}

const parseContent = (
  text: string,
  parser: (value: string) => ParsedPhraseCell[],
): Array<string | import('./musicParsers').PhraseRow> => {
  if (!text) return [];
  try {
    return parser(text)?.[0]?.data || [];
  } catch {
    return [];
  }
};

export function convertNotationDataToTableRows(notationRows: any[], sectionLabel: string): NotationTableRow[] {
  const normalizedLabel = (sectionLabel || 'Sthayi').trim();
  const relevantRows = (notationRows || []).filter(
    row => String(row?.sectionLabel || 'Sthayi').trim() === normalizedLabel,
  );
  const layerGroups: Record<string, ParsedPhraseCell[][]> = {
    bol: [[]], pakhawajBol: [[]], mridangamBol: [[]], swar: [[]],
    stroke: [[]], finger: [[]], lyrics: [[]], layakari: [[]],
  };

  const addCell = (layers: ParsedPhraseCell[][], cell: ParsedPhraseCell) => {
    if (!Number.isFinite(cell.beatIndex) || cell.beatIndex < 1) return;
    const serialized = JSON.stringify(cell.data);
    if (layers.some(layer => layer.some(existing => existing.beatIndex === cell.beatIndex && JSON.stringify(existing.data) === serialized))) return;
    let target = layers.find(layer => !layer.some(existing => existing.beatIndex === cell.beatIndex));
    if (!target) { target = []; layers.push(target); }
    target.push(cell);
  };

  // A phrase can be stored across several cycle rows. Merge those entries just
  // as the web NotationTableNew conversion does, without losing any fields.
  const uniqueRows = new Map<string, any>();
  relevantRows.forEach((row, index) => {
    const phraseId = row.phraseId || `row_${row.index ?? index}`;
    const existing = uniqueRows.get(phraseId);
    if (!existing) { uniqueRows.set(phraseId, row); return; }
    const entries = new Map<number, any>();
    (existing.entries || []).forEach((entry: any) => entries.set(entry.absoluteBeat ?? entry.beat, entry));
    (row.entries || []).forEach((entry: any) => {
      const beat = entry.absoluteBeat ?? entry.beat;
      if (beat == null) return;
      entries.set(beat, { ...(entries.get(beat) || {}), ...entry });
    });
    uniqueRows.set(phraseId, { ...existing, entries: Array.from(entries.values()) });
  });

  Array.from(uniqueRows.values())
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .forEach(row => {
      const entries = Array.isArray(row?.entries) ? row.entries : [];
      const hasAnySwar = entries.some((entry: any) => String(entry?.swar ?? '').trim());
      entries.forEach((entry: any) => {
        const rawBeat = entry.absoluteBeat ?? entry.beat;
        const beatIndex = typeof rawBeat === 'number' ? rawBeat : parseInt(String(rawBeat), 10);
        if (!Number.isFinite(beatIndex) || beatIndex < 1) return;
        const add = (key: keyof typeof layerGroups, value: unknown, parser: (text: string) => ParsedPhraseCell[]) => {
          const text = String(value ?? '').trim();
          if (!text) return;
          const data = parseContent(text, parser);
          if (data.length) addCell(layerGroups[key], { beatIndex, phraseIndex: 0, data });
        };

        add('swar', entry.swar, parseNestedMusicInput);
        if (!String(entry?.swar ?? '').trim() && hasAnySwar) {
          const hasOther = ['stroke', 'lyric', 'lyrics', 'tabla', 'pakhawaj', 'mridangam', 'layakari', 'finger']
            .some(key => String(entry?.[key] ?? '').trim());
          if (hasOther) addCell(layerGroups.swar, { beatIndex, phraseIndex: 0, data: [] });
        }
        add('stroke', entry.stroke, parseStrokeMusicInput);
        add('bol', entry.tabla, parsePercussionBolInput);
        add('pakhawajBol', entry.pakhawaj, parsePercussionBolInput);
        add('mridangamBol', entry.mridangam, parsePercussionBolInput);
        add('lyrics', entry.lyric ?? entry.lyrics, parseLyricsMusicInput);
        add('layakari', entry.layakari, parsePercussionBolInput);
        add('finger', entry.finger, parsePercussionBolInput);
      });
    });

  const result: NotationTableRow[] = [];
  Object.entries(layerGroups).forEach(([prefix, layers]) => layers.forEach((cells, index) => {
    if (cells.length) result.push({ key: index ? `${prefix}-${index}` : prefix, cells });
  }));
  return result;
}

export function buildNotationTableSections(
  notationRows: any[],
  fallbackSwarText?: string,
): NotationTableSectionData[] {
  if (!notationRows?.length) {
    if (!fallbackSwarText) return [];
    return [{ label: 'Sthayi', rows: [{ key: 'swar', cells: parseNestedMusicInput(fallbackSwarText) }] }];
  }

  const phrases: Array<{ phraseId: string; label: string; rows: any[] }> = [];
  notationRows.forEach((row, index) => {
    const phraseId = row.phraseId || 'default';
    const previous = phrases[phrases.length - 1];
    if (previous?.phraseId === phraseId) previous.rows.push({ ...row, index: row.index ?? index });
    else phrases.push({ phraseId, label: row.sectionLabel || 'Sthayi', rows: [{ ...row, index: row.index ?? index }] });
  });

  return phrases.map(phrase => {
    const ranges = phrase.rows
      .flatMap(row => Array.isArray(row.phraseRanges) ? row.phraseRanges : [])
      .filter(range => range && typeof range.id === 'string');
    let rows = convertNotationDataToTableRows(phrase.rows, phrase.label);
    if (!rows.length) {
      const legacySwarText = phrase.rows
        .map(row => row.notationContent || row.swarText || row.swar || row.notes || row.content || row.notation || '')
        .filter(Boolean)
        .join(',');
      if (legacySwarText) rows = [{ key: 'swar', cells: parseNestedMusicInput(legacySwarText) }];
    }
    return {
      label: phrase.label,
      rows,
      phraseRanges: Array.from(new Map(ranges.map(range => [range.id, range])).values()),
    };
  }).filter(section => section.rows.length > 0);
}
