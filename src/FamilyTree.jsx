import { useEffect, useMemo, useRef } from "react";
import { layoutTree, NW, NH } from "./layout";

export default function FamilyTree({ data, selectedId, onSelect, focus, badges }) {
  const scroller = useRef(null);
  const { nodes, links, width, height } = useMemo(() => layoutTree(data), [data]);

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
    const onDown = (e) => { down = true; startX = e.clientX; startLeft = el.scrollLeft; };
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
  }, []);

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
    <div className="scroller" ref={scroller}>
      <div className="canvas" style={{ width, height }}>
        <svg width={width} height={height} className="lines">
          {links.map((d, i) => <path key={i} d={d} />)}
        </svg>
        {nodes.map((n) => (
          <button
            key={n.id}
            className={`person ${n.gender === "m" ? "male" : "female"} ${selectedId === n.id ? "selected" : ""}`}
            style={{ left: n.x, top: n.y, width: NW, height: NH }}
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
