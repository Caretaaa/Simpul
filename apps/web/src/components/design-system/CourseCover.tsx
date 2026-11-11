/**
 * Sampul visual kursus — motif topologi jaringan deterministik dari ID kursus.
 * Bukan data jaringan sungguhan; identitas visual agar tiap kursus dikenali.
 * Sadar-tema: seluruh warna memakai token CSS sehingga cocok terang & gelap.
 */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Potong label pada batas kata agar tidak terpenggal di tengah kata. */
function fitLabel(text: string, max: number): string {
  const upper = text.toUpperCase();
  if (upper.length <= max) return upper;
  const cut = upper.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.4 ? cut.slice(0, lastSpace) : cut).trim();
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Node { x: number; y: number; r: number; kind: "core" | "edge" | "leaf" }

export function CourseCover({
  courseId,
  label,
  sublabel,
  className,
}: {
  courseId: string;
  label: string;
  sublabel?: string;
  className?: string;
}) {
  const rand = mulberry(hashString(courseId));
  // Slot simpul pada grid 5×3 dengan jitter deterministik.
  const slots = [0.12, 0.3, 0.5, 0.7, 0.88];
  const nodes: Node[] = slots.map((sx, i) => ({
    x: 400 * sx + (rand() - 0.5) * 36,
    y: 45 + rand() * 90,
    r: i === 2 ? 9 : 5 + rand() * 3,
    kind: i === 2 ? "core" : i % 2 === 0 ? "edge" : "leaf",
  }));
  const links: Array<[number, number]> = nodes.slice(1).map((_, i) => [i, i + 1] as [number, number]);
  if (nodes.length > 3) links.push([0, 3]);

  return (
    <svg
      viewBox="0 0 400 180"
      preserveAspectRatio="xMidYMid slice"
      className={className ?? "cover"}
      role="img"
      aria-label={`Identitas visual kursus ${label}`}
    >
      <defs>
        <pattern id={`grid-${courseId.slice(0, 8)}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" className="cover-grid" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="400" height="180" className="cover-bg" />
      <rect x="0" y="0" width="400" height="180" fill={`url(#grid-${courseId.slice(0, 8)})`} />
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a]!.x} y1={nodes[a]!.y}
          x2={nodes[b]!.x} y2={nodes[b]!.y}
          className="cover-link"
          strokeWidth="1.5"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} className="cover-halo" />
          <circle
            cx={n.x} cy={n.y} r={n.r}
            className={n.kind === "core" ? "cover-core" : n.kind === "edge" ? "cover-edge" : "cover-leaf"}
          />
        </g>
      ))}
      <text x="200" y="28" textAnchor="middle" className="cover-label">{fitLabel(label, 18)}</text>
      {sublabel && (
        <text x="200" y="164" textAnchor="middle" className="cover-sublabel">{fitLabel(sublabel, 30)}</text>
      )}
    </svg>
  );
}
