export interface ChartPointCoord {
  x: number;
  y: number;
}

export interface RingSliceInput {
  key: string;
  label: string;
  value: number;
  detail?: string;
  color: string;
}

export interface ComputedRingSlice extends RingSliceInput {
  percentage: number;
  startAngle: number;
  sweepAngle: number;
  arcPath: string;
  isFullCircle: boolean;
}

export interface RoundedWedgeSlice extends RingSliceInput {
  percentage: number;
  startAngle: number;
  sweepAngle: number;
  midAngle: number;
  offsetX: number;
  offsetY: number;
  wedgePath: string;
  isFullCircle: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/**
 * Computes segmented donut arcs with clean angular separation so rounded
 * `strokeLinecap="round"` ends never collide or overlap.
 */
export function computeSegmentedRingArcs(
  items: RingSliceInput[],
  options: { cx?: number; cy?: number; r?: number; gapDeg?: number; startOffsetDeg?: number } = {}
): { total: number; slices: ComputedRingSlice[] } {
  const cx = options.cx ?? 90;
  const cy = options.cy ?? 90;
  const r = options.r ?? 68;
  const baseGapDeg = options.gapDeg ?? 18;
  const startOffsetDeg = options.startOffsetDeg ?? -115;

  const active = items.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = active.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0 || active.length === 0) {
    return { total: 0, slices: [] };
  }

  if (active.length === 1) {
    const only = active[0];
    const [sx, sy] = polarToCartesian(cx, cy, r, startOffsetDeg);
    const [ex, ey] = polarToCartesian(cx, cy, r, startOffsetDeg + 359.5);
    return {
      total,
      slices: [
        {
          ...only,
          percentage: 100,
          startAngle: startOffsetDeg,
          sweepAngle: 359.5,
          arcPath: `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
          isFullCircle: true,
        },
      ],
    };
  }

  const gapDeg = active.length >= 6 ? Math.min(baseGapDeg, 12) : baseGapDeg;
  const totalGap = active.length * gapDeg;
  const drawableDeg = Math.max(60, 360 - totalGap);

  let cursor = startOffsetDeg;
  const slices: ComputedRingSlice[] = active.map((item) => {
    const share = item.value / total;
    const sweepAngle = Math.max(2, share * drawableDeg);
    const startAngle = cursor + gapDeg / 2;
    const endAngle = startAngle + sweepAngle;
    const [sx, sy] = polarToCartesian(cx, cy, r, startAngle);
    const [ex, ey] = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = sweepAngle > 180 ? 1 : 0;
    cursor += sweepAngle + gapDeg;

    return {
      ...item,
      percentage: Math.round(share * 100),
      startAngle,
      sweepAngle,
      arcPath: `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
      isFullCircle: false,
    };
  });

  return { total, slices };
}

/**
 * Computes organic separated pie wedges suitable for rendering with `strokeLinejoin="round"`.
 */
export function computeRoundedPieWedges(
  items: RingSliceInput[],
  options: { cx?: number; cy?: number; r?: number; radialOffset?: number; startOffsetDeg?: number } = {}
): { total: number; wedges: RoundedWedgeSlice[] } {
  const cx = options.cx ?? 90;
  const cy = options.cy ?? 90;
  const r = options.r ?? 60;
  const radialOffset = options.radialOffset ?? 3.5;
  const startOffsetDeg = options.startOffsetDeg ?? -110;

  const active = items.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = active.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0 || active.length === 0) {
    return { total: 0, wedges: [] };
  }

  if (active.length === 1) {
    const only = active[0];
    return {
      total,
      wedges: [
        {
          ...only,
          percentage: 100,
          startAngle: 0,
          sweepAngle: 360,
          midAngle: 0,
          offsetX: 0,
          offsetY: 0,
          wedgePath: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${(cx - 0.01).toFixed(2)} ${cy - r} Z`,
          isFullCircle: true,
        },
      ],
    };
  }

  let cursor = startOffsetDeg;
  const wedges: RoundedWedgeSlice[] = active.map((item) => {
    const share = item.value / total;
    const sweepAngle = Math.max(8, share * 360);
    const startAngle = cursor;
    const endAngle = startAngle + sweepAngle;
    const midAngle = startAngle + sweepAngle / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const offsetX = Math.cos(midRad) * radialOffset;
    const offsetY = Math.sin(midRad) * radialOffset;

    const [sx, sy] = polarToCartesian(cx, cy, r, startAngle);
    const [ex, ey] = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = sweepAngle > 180 ? 1 : 0;
    cursor = endAngle;

    return {
      ...item,
      percentage: Math.round(share * 100),
      startAngle,
      sweepAngle,
      midAngle,
      offsetX: Number(offsetX.toFixed(2)),
      offsetY: Number(offsetY.toFixed(2)),
      wedgePath: `M ${cx} ${cy} L ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`,
      isFullCircle: false,
    };
  });

  return { total, wedges };
}

/**
 * Generates a smooth SVG cubic Bezier curve through points using Catmull-Rom
 * tangents clamped cleanly to `[minY, maxY]` so curves stay within the plot area.
 */
export function buildSmoothSplinePath(
  coords: ChartPointCoord[],
  minY: number,
  maxY: number
): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) {
    return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  }

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clamp(p1.y + (p2.y - p0.y) / 6, minY, maxY);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clamp(p2.y - (p3.y - p1.y) / 6, minY, maxY);

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
