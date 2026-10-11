import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutTree, NW, NH, GAP, CW, PAD } from "./layout";

export default function FamilyTree({
  data, selectedId, onSelect, focus, badges, canReorder = false, unsavedIds, onReorder,
  zoom, onZoomChange,
}) {
  const scroller = useRef(null);
  const canvas = useRef(null);
  const drag = useRef(null);
  const pan = useRef(null);
  const zoomRef = useRef(1);
  const zoomAnchor = useRef(null);
  const zoomToRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const { nodes, links, width, height } = useMemo(() => layoutTree(data), [data]);
  const canvasWidth = canReorder ? width + CW * 4 : width;
  const zoomTo = useCallback((nextZoom, clientX, clientY) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.max(0.4, Math.min(2.5, nextZoom));
    if (next === zoomRef.current) return;

    const bounds = el.getBoundingClientRect();
    zoomAnchor.current = {
      x: (clientX - bounds.left + el.scrollLeft) / zoomRef.current,
      y: (clientY - bounds.top + el.scrollTop) / zoomRef.current,
      offsetX: clientX - bounds.left,
      offsetY: clientY - bounds.top,
    };
    zoomRef.current = next;
    onZoomChange(next);
  }, [onZoomChange]);
  useLayoutEffect(() => {
    zoomToRef.current = zoomTo;
  }, [zoomTo]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const previousZoom = zoomRef.current;
    const anchor = zoomAnchor.current;
    if (anchor) {
      el.scrollLeft = anchor.x * zoom - anchor.offsetX;
      el.scrollTop = anchor.y * zoom - anchor.offsetY;
      zoomAnchor.current = null;
    } else if (previousZoom !== zoom) {
      const bounds = el.getBoundingClientRect();
      const offsetX = bounds.width / 2;
      const offsetY = bounds.height / 2;
      el.scrollLeft = (el.scrollLeft + offsetX) * zoom / previousZoom - offsetX;
      el.scrollTop = (el.scrollTop + offsetY) * zoom / previousZoom - offsetY;
    }
    zoomRef.current = zoom;
  }, [zoom]);

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

  // Wheel zooms toward the pointer; dragging the canvas pans in both directions.
  useEffect(() => {
    const el = scroller.current;
    const onWheel = (e) => {
      if (!e.deltaY) return;
      e.preventDefault();
      zoomToRef.current(
        zoomRef.current * Math.exp(-e.deltaY * 0.001),
        e.clientX,
        e.clientY,
      );
    };
    const onDown = (e) => {
      if (e.button !== 0) return;
      if (pan.current) {
        pan.current.active = false;
        pan.current.moved = false;
      }
      if (canReorder && e.target.closest(".person")) return;
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
        moved: false,
        active: true,
      };
    };
    const onMove = (e) => {
      const active = pan.current;
      if (!active?.active) return;
      if (Math.abs(e.clientX - active.x) + Math.abs(e.clientY - active.y) > 3) {
        active.moved = true;
      }
      if (!active.moved) return;
      e.preventDefault();
      el.scrollLeft = active.left - (e.clientX - active.x);
      el.scrollTop = active.top - (e.clientY - active.y);
    };
    const onUp = () => {
      if (pan.current) pan.current.active = false;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [canReorder]);

  useEffect(() => {
    const onMove = (event) => {
      const active = drag.current;
      const surface = canvas.current;
      if (!active || !surface) return;
      active.x = Math.max(0, (event.clientX - surface.getBoundingClientRect().left) / zoomRef.current - active.offsetX);
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
      offsetX: (event.clientX - canvasLeft) / zoomRef.current - node.x,
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
      left: (n.x + NW / 2) * zoomRef.current - el.clientWidth / 2,
      top: (n.y + NH / 2) * zoomRef.current - el.clientHeight / 2,
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div className={`scroller ${canReorder ? "admin-tree" : ""}`} ref={scroller}>
      <div className="canvas" style={{ width: canvasWidth * zoom, height: height * zoom }}>
        <div
          className="tree-surface"
          ref={canvas}
          style={{ width: canvasWidth, height, transform: `scale(${zoom})` }}
        >
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
              onClick={(event) => {
                if (pan.current?.moved) {
                  event.preventDefault();
                  event.stopPropagation();
                  pan.current.moved = false;
                  return;
                }
                onSelect(n.id);
              }}
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
    </div>
  );
}

export function ZoomControls({ zoom, onZoomChange }) {
  return (
    <div className="zoom-controls" aria-label="Tree zoom controls">
      <button type="button" aria-label="Zoom out" onClick={() => onZoomChange(Math.max(0.4, zoom - 0.2))} disabled={zoom <= 0.4}>−</button>
      <span aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" onClick={() => onZoomChange(Math.min(2.5, zoom + 0.2))} disabled={zoom >= 2.5}>+</button>
      <button type="button" aria-label="Reset zoom" onClick={() => onZoomChange(1)} disabled={zoom === 1}>Reset</button>
    </div>
  );
}
