/**
 * Simple Taal Structure helper for Indian Classical Music.
 * X = Sam (1st beat), O = Khali (empty/silent), numbers (2, 3...) = Clap markers.
 */

export type TaalMarker = 'X' | 'O' | string;

export function getBeatMarker(beat: number, taalName: string = 'Teental'): TaalMarker | null {
  // Simple Teental defaults: 16 beats (4+4+4+4)
  // X (1), 2 (5), O (9), 3 (13)
  if (taalName.toLowerCase().includes('teen')) {
    if (beat === 1) return 'X';
    if (beat === 5) return '2';
    if (beat === 9) return 'O';
    if (beat === 13) return '3';
  }
  
  // Default fallback for any 16-beat cycle
  if (beat === 1) return 'X';
  if (beat === 9) return 'O';
  
  return null;
}

export function getBeatColor(beat: number, taalName: string = 'Teental'): string {
  // Common alternating colors for segments
  const cycleLength = 16;
  const normalized = ((beat - 1) % cycleLength) + 1;
  
  // For 16 beats: 4-4-4-4
  if (normalized >= 1 && normalized <= 4) return '#9FA8DA'; // Lavender
  if (normalized >= 5 && normalized <= 8) return '#80CBC4'; // Teal
  if (normalized >= 9 && normalized <= 12) return '#9FA8DA';
  if (normalized >= 13 && normalized <= 16) return '#80CBC4';
  
  return '#f5f5f5';
}
