const DEFAULT_COLORS = { ai: "#14594A", human: "#9A6714", POSITIVE: "#14594A", NEUTRAL: "#4A6068", NEGATIVE: "#A8432A" };

// A single proportional bar split into segments — for a two-or-few-way
// breakdown (AI vs human, sentiment distribution) where a full bar chart
// would be overkill.
export default function SegmentedBar({ segments, emptyMessage = "No data yet." }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-slate-550">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink/8">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color || DEFAULT_COLORS[s.label] || "#4A6068" }}
            />
          ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color || DEFAULT_COLORS[s.label] || "#4A6068" }}
            />
            <span className="capitalize text-ink">{s.label.toLowerCase()}</span>
            <span className="text-slate-550">
              {s.value} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
