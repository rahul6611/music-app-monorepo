// Standard Hindustani options from Web Beta RaagDetailEnhanced and
// notationSystemConfig. Custom/user-created Taals are intentionally excluded.
export const COMPOSITION_TYPES = [
  'Bada Khayal', 'Bhajan', 'Chhota Khayal', 'Dhrupad', 'Gat', 'Kirtan',
  'Sadra', 'Tarana', 'Thumri',
];
export const COMPOSITION_TAALS = [
  'Dadra — 6 beats (3+3)', 'Rupak — 7 beats (3+2+2)', 'Keherwa — 8 beats (4+4)',
  'Jhaptaal — 10 beats (2+3+2+3)', 'Ektal — 12 beats (2+2+2+2+2+2)',
  'Dhamar — 14 beats (5+2+3+4)', 'Jhoomra — 14 beats (3+4+3+4)',
  'Teentaal — 16 beats (4+4+4+4)', 'Tilwada — 16 beats (4+4+4+4)',
];
export const COMPOSITION_LAYAS = ['Vilambit', 'Madhya', 'Drut'];
export type CompositionCategory = 'aalap' | 'gat_bandish';
export interface CompositionFormData {
  category: CompositionCategory;
  name: string;
  type: string;
  taal: string;
  laya: string;
}
export function initialCompositionForm(initial?: Partial<CompositionFormData>): CompositionFormData {
  // Keep existing values editable without offering custom Taals as new options.
  const taal = initial?.taal || '';
  const normalizedName = taal.split(/\s*[—–]\s*/)[0].trim().toLowerCase()
    .replace('jhaptal', 'jhaptaal').replace('teental', 'teentaal');
  return {
    category: initial?.type === 'Aalap' ? 'aalap' : 'gat_bandish',
    name: initial?.name || '', type: initial?.type || '',
    taal: taal.includes('(') ? taal : COMPOSITION_TAALS.find(value => value.split(' — ')[0].toLowerCase() === normalizedName) || taal,
    laya: initial?.laya || '',
  };
}
export function compositionPayload(form: CompositionFormData) {
  // Web encodes the category in `type`. Empty strings clear rhythmic fields
  // when an existing composition is changed to Aalap.
  return {
    name: form.name.trim(), type: form.category === 'aalap' ? 'Aalap' : form.type,
    taal: form.category === 'aalap' ? '' : form.taal,
    laya: form.category === 'aalap' ? '' : form.laya,
  };
}
