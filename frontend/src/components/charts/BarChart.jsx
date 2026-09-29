const COLORS = ["#14594A", "#9A6714", "#A8432A", "#4A6068", "#0E4238", "#7A5410", "#7A3220", "#16282F"];

// A small, dependency-free horizontal bar chart. Matches the project's
// "avoid unnecessary heavy UI libraries" principle — these are simple
// enough that adding a charting library just for this would be overkill.
export default function BarChart({ data, valueLabel, emptyMessage = "No data yet." }) {
  if (!data || data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-550">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="capitalize text-ink">{d.label.replace(/_/g, " ").toLowerCase()}</span>
            <span className="text-slate-550">
              {d.value}
              {valueLabel ? ` ${valueLabel}` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
