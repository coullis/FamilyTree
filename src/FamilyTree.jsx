import { useEffect, useMemo, useRef, useState } from "react";
import { layoutTree, NW, NH, GAP, CW, PAD } from "./layout";

export default function FamilyTree({
  data, selectedId, onSelect, focus, badges, canReorder = false, unsavedIds, onReorder,
}) {
  const scroller = useRef(null);
  const canvas = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(null);
  const { nodes, links, width, height } = useMemo(() => layoutTree(data), [data]);
  const canvasWidth = canReorder ? width + CW * 4 : width;
  const slots = useMemo(() => {
    if (!canReorder) return [];
    const rows = [...new Set(nodes.map((node) => node.y))];
    return rows.flatMap((y) => {
      const rowNodes = nodes.filter((node) => node.y === y);
      const rowSlots = [];
      for (let x = PAD; x + NW + PAD <= canvasWidth; x += CW) {
        const available = rowNodes.every((node) =>
          x + NW + GAP <= node.x || x >= node.x + NW + GAP
        );
        if (available) rowSlots.push({ x, y });
      }
      return rowSlots;
    });
  }, [canReorder, canvasWidth, nodes]);

  // mouse wheel scrolls sideways; dragging pans
  useEffect(() => {
    const el = scroller.current;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    let down = false, startX = 0, startLeft = 0;
    const onDown = (e) => {
      if (canReorder && e.target.closest(".person")) return;
      down = true; startX = e.clientX; startLeft = el.scrollLeft;
    };
    const onMove = (e) => {
      if (!down) return;
      el.scrollLeft = startLeft - (e.clientX - startX);
    };
    const onUp = () => (down = false);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [canReorder]);

  useEffect(() => {
    const onMove = (event) => {
      const active = drag.current;
      const surface = canvas.current;
      if (!active || !surface) return;
      active.x = Math.max(0, event.clientX - surface.getBoundingClientRect().left - active.offsetX);
      if (Math.abs(active.x - active.startX) > 4) active.moved = true;
      if (active.moved) setDragging({ id: active.id, x: active.x });
    };
    const onUp = () => {
      const active = drag.current;
      drag.current = null;
      setDragging(null);
      if (!active?.moved || !onReorder) return;

      const dragged = nodes.find((node) => node.id === active.id);
      if (!dragged) return;
      const partners = data.unions.find((union) => union.partners.includes(active.id))?.partners || [active.id];
      const groupNodes = nodes.filter((node) => partners.includes(node.id));
      const groupLeft = Math.min(...groupNodes.map((node) => node.x));
      const groupWidth = Math.max(...groupNodes.map((node) => node.x + NW)) - groupLeft;
      const desired = active.x - (dragged.x - groupLeft);
      const rowNodes = nodes.filter((node) => node.y === dragged.y && !partners.includes(node.id));
      const freeSlots = [];
      for (let x = PAD; x + groupWidth + PAD <= canvasWidth; x += CW) {
        if (rowNodes.every((node) =>
          x + groupWidth + GAP <= node.x || x >= node.x + NW + GAP
        )) freeSlots.push(x);
      }
      const target = freeSlots.length
        ? freeSlots.reduce((best, x) => Math.abs(x - desired) < Math.abs(best - desired) ? x : best)
        : desired;
      onReorder(active.id, target);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [canvasWidth, data.unions, nodes, onReorder]);

  const startDrag = (event, node) => {
    if (!canReorder || event.button !== 0 || !canvas.current) return;
    event.stopPropagation();
    const canvasLeft = canvas.current.getBoundingClientRect().left;
    drag.current = {
      id: node.id,
      startX: node.x,
      offsetX: event.clientX - canvasLeft - node.x,
      x: node.x,
      moved: false,
    };
  };

  // scroll to a person when picked from the search bar
  useEffect(() => {
    const n = nodes.find((x) => x.id === focus?.id);
    const el = scroller.current;
    if (!n) return;
    el.scrollTo({
      left: n.x + NW / 2 - el.clientWidth / 2,
      top: n.y + NH / 2 - el.clientHeight / 2,
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div className={`scroller ${canReorder ? "admin-tree" : ""}`} ref={scroller}>
      <div className="canvas" ref={canvas} style={{ width: canvasWidth, height }}>
        {slots.map((slot) => (
          <div
            key={`${slot.x}-${slot.y}`}
            className="layout-slot"
            style={{ left: slot.x, top: slot.y, width: NW, height: NH }}
            aria-hidden="true"
          />
        ))}
        <svg width={canvasWidth} height={height} className="lines">
          {links.map((d, i) => <path key={i} d={d} />)}
        </svg>
        {nodes.map((n) => (
          <button
            key={n.id}
            className={`person ${n.gender === "m" ? "male" : "female"} ${selectedId === n.id ? "selected" : ""} ${unsavedIds?.has(n.id) ? "unsaved" : ""} ${dragging?.id === n.id ? "dragging" : ""}`}
            style={{ left: dragging?.id === n.id ? dragging.x : n.x, top: n.y, width: NW, height: NH }}
            onPointerDown={(event) => startDrag(event, n)}
            onClick={() => onSelect(n.id)}
          >
            <span className="first">{n.name}</span>
            <span className="last">{n.surname}</span>
            {badges?.[n.id] > 0 && (
              <span className="badge" title="Comments and photos to review">{badges[n.id]}</span>
            )}
            {n.deceased && <span className="cross" aria-label="deceased">†</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
