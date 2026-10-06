// Turns { people, unions } into x/y positions and connector lines.
// Generations run top -> bottom; siblings sit side by side, left -> right.
export const NW = 168;       // node width
export const NH = 48;        // node height
export const CW = NW + 32;   // width of one column (node + gap)
export const RH = 130;       // distance between generations
export const PAD = 40;

export function layoutTree({ people, unions }) {
  const childIds = new Set(unions.flatMap((u) => u.children || []));
  const unionOf = (id) => unions.find((u) => u.partners.includes(id));

  // columns a person (plus spouse and descendants) needs
  const measure = (id) => {
    const u = unionOf(id);
    if (!u) return 1;
    const kids = (u.children || []).reduce((s, c) => s + measure(c), 0);
    return Math.max(u.partners.length > 1 ? 2 : 1, kids);
  };

  const pos = {}; // id -> { gen, cx } (cx = centre x in column units)
  const links = [];
  const px = (cx) => PAD + cx * CW;          // centre x in pixels
  const top = (gen) => PAD + gen * RH;       // node top in pixels

  const place = (id, gen, left) => {
    if (pos[id]) return;
    const u = unionOf(id);
    if (!u) {
      pos[id] = { gen, cx: left + 0.5 };
      return;
    }
    const cols = measure(id);
    const kids = u.children || [];
    const kidCols = kids.reduce((s, c) => s + measure(c), 0);
    let x = left + (cols - kidCols) / 2;
    kids.forEach((c) => {
      place(c, gen + 1, x);
      x += measure(c);
    });
    const mid = kids.length
      ? (pos[kids[0]].cx + pos[kids[kids.length - 1]].cx) / 2
      : left + cols / 2;
    const [a, b] = u.partners;
    const cy = top(gen) + NH / 2;
    if (b) {
      pos[a] = { gen, cx: mid - 0.5 };
      pos[b] = { gen, cx: mid + 0.5 };
      // partner line
      links.push(`M${px(pos[a].cx) + NW / 2},${cy} H${px(pos[b].cx) - NW / 2}`);
    } else {
      pos[a] = { gen, cx: mid }; // single parent
    }
    // couple -> children
    if (kids.length) {
      const busY = top(gen) + NH + (RH - NH) / 2;
      const xs = kids.map((c) => px(pos[c].cx));
      links.push(`M${px(mid)},${b ? cy : top(gen) + NH} V${busY}`);
      links.push(`M${Math.min(px(mid), ...xs)},${busY} H${Math.max(px(mid), ...xs)}`);
      xs.forEach((cx) => links.push(`M${cx},${busY} V${top(gen + 1)}`));
    }
  };

  let left = 0;
  people.forEach((p) => {
    // spouses who married into the tree are placed next to their partner
    const marriedIn = unions.some(
      (u) => u.partners.includes(p.id) && u.partners.some((q) => childIds.has(q))
    );
    if (!childIds.has(p.id) && !marriedIn && !pos[p.id]) {
      place(p.id, 0, left);
      left += measure(p.id);
    }
  });

  const nodes = people
    .filter((p) => pos[p.id])
    .map((p) => ({
      ...p,
      x: px(pos[p.id].cx) - NW / 2,
      y: top(pos[p.id].gen),
    }));

  const maxGen = Math.max(...Object.values(pos).map((p) => p.gen));
  return {
    nodes,
    links,
    width: PAD * 2 + left * CW - (CW - NW),
    height: PAD * 2 + maxGen * RH + NH + 60,
  };
}
