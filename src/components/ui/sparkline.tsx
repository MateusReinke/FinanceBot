// A trend line small enough to sit inside a stat card — not a chart with
// axes to read, just a shape that answers "going up or down lately" at a
// glance. Pure SVG rather than Recharts: at this size a whole chart runtime
// buys nothing over a hand-built polyline, the same reasoning ProgressRing
// already follows.
export function Sparkline({
  data,
  width = 72,
  height = 28,
  color = "var(--primary)",
  fill = true,
  strokeWidth = 1.75,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
}) {
  if (data.length < 2 || data.every((v) => v === data[0])) return null;

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  // Padding on the stroke's own width so the peak/trough don't clip against
  // the viewBox edge.
  const pad = strokeWidth;
  const innerHeight = height - pad * 2;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + innerHeight - ((v - min) / range) * innerHeight;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      {fill ? <path d={areaPath} fill={color} opacity={0.14} /> : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth} fill={color} />
    </svg>
  );
}
