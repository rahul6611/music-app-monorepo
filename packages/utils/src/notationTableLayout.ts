export interface CellWidthRequirement { column: number; span: number; width: number }

/** Native equivalent of CSS table-layout:auto / nowrap column sizing. */
export function resolveNotationColumnWidths(
  beatCount: number, availableWidth: number, requirements: CellWidthRequirement[],
): number[] {
  const widths = Array.from({ length: beatCount }, () => 55);
  for (const cell of [...requirements].sort((a, b) => a.span - b.span)) {
    const span = Math.min(cell.span, beatCount - cell.column);
    if (cell.column < 0 || span < 1 || !Number.isFinite(cell.width)) continue;
    const current = widths.slice(cell.column, cell.column + span).reduce((sum, w) => sum + w, 0);
    const extra = Math.max(0, cell.width - current) / span;
    for (let i = cell.column; i < cell.column + span; i++) widths[i] += extra;
  }
  const total = widths.reduce((sum, w) => sum + w, 0);
  const extra = Math.max(0, availableWidth - total) / Math.max(1, beatCount);
  return widths.map(width => width + extra);
}
