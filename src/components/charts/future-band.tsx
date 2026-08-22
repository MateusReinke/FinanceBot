"use client";

// The tint behind the forecast half of a 13-month chart.
//
// Drawn as a plain layer under the plot rather than with Recharts' own
// ReferenceArea or a Bar `background`: on a band (category) axis this version
// of Recharts resolves both to nothing — the ReferenceArea emits an empty
// <g>, and the background render prop is never called. Neither fails loudly,
// which is how they survived a first pass.
//
// The geometry is not guesswork. A Recharts category axis with no padding
// divides the plot into equal bands, so band i starts at i/N of the plot
// width; the plot itself is the container minus the y-axis gutter on the left
// and the chart margin on the right. Those three numbers are passed in from
// the same constants the chart hands Recharts, so the two cannot drift.
//
// Purely decorative: the forecast is already carried by the light step of the
// ramp, by the legend and by the tooltip. If this never paints, nothing is
// lost but a cue.
export function FutureBand({
  firstFutureIndex,
  count,
  axisWidth,
  marginRight,
  bottomInset,
  label = "previsto",
}: {
  // Index of the first month that is entirely in the future, or -1 for none.
  firstFutureIndex: number;
  count: number;
  axisWidth: number;
  marginRight: number;
  // How much of the container's bottom the legend takes, so the tint stops
  // at the axis labels instead of running under the key.
  bottomInset: number;
  label?: string;
}) {
  if (firstFutureIndex < 0 || firstFutureIndex >= count) return null;

  const plot = `(100% - ${axisWidth + marginRight}px)`;
  const start = firstFutureIndex / count;
  const span = (count - firstFutureIndex) / count;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-r-md"
      style={{
        left: `calc(${axisWidth}px + ${start} * ${plot})`,
        width: `calc(${span} * ${plot})`,
        top: 0,
        bottom: bottomInset,
        backgroundColor: "var(--chart-future)",
      }}
    >
      <span className="absolute right-1.5 top-1 text-[11px] text-[var(--chart-axis)]">{label}</span>
    </div>
  );
}
