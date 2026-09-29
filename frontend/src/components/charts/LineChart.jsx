// A small, dependency-free line chart for a simple time series
// (date -> count). Renders as raw SVG; no charting library needed for
// something this simple.
export default function LineChart({ data, emptyMessage = "No data yet." }) {
  if (!data || data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-550">{emptyMessage}</p>;
  }

  const width = 600;
  const height = 160;
  const padding = 24;
  const max = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (d.count / max) * (height - padding * 2);
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Conversations over time">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#16282F" strokeOpacity="0.1" />
      <path d={areaD} fill="#14594A" fillOpacity="0.08" />
      <path d={pathD} fill="none" stroke="#14594A" strokeWidth="2" />
      {points.map((p) => (
        <circle key={p.date} cx={p.x} cy={p.y} r="2.5" fill="#14594A" />
      ))}
      {points
        .filter((_, i) => i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0)
        .map((p) => (
          <text key={`label-${p.date}`} x={p.x} y={height - 4} fontSize="9" fill="#4A6068" textAnchor="middle">
            {p.date.slice(5)}
          </text>
        ))}
    </svg>
  );
}
