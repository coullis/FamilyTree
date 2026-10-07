import { useEffect } from "react";
import { photoUrl } from "./lib/photos";

// Full-size photo in the centre of the screen. Esc closes, arrows move between photos.
export default function Lightbox({ photos, index, onClose, onIndex, actions }) {
  const p = photos[index];
  const n = photos.length;

  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, n, onClose, onIndex]);

  if (!p) return null;
  const stop = (e) => e.stopPropagation();

  return (
    <div className="overlay lightbox" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Close photo">×</button>
      <img src={photoUrl(p.path)} alt={`Photo by ${p.uploader}`} onClick={stop} />
      <div className="caption" onClick={stop}>
        <span>
          {p.uploader} · {new Date(p.created_at).toLocaleDateString()}
          {!p.approved && " · Pending approval"}
        </span>
        {typeof actions === "function" && actions(p)}
      </div>
      {n > 1 && (
        <>
          <button className="lb-nav prev" aria-label="Previous photo"
            onClick={(e) => { stop(e); onIndex((index - 1 + n) % n); }}>‹</button>
          <button className="lb-nav next" aria-label="Next photo"
            onClick={(e) => { stop(e); onIndex((index + 1) % n); }}>›</button>
        </>
      )}
    </div>
  );
}
