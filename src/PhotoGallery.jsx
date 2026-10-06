import { useRef, useState } from "react";
import Lightbox from "./Lightbox";
import { approvePhoto, deletePhoto, photoUrl, uploadPhoto, usePhotos } from "./lib/photos";

// Thumbnails + "Add photo". Visitors' uploads wait for approval; the admin's go live at once.
export default function PhotoGallery({ personId, admin, uploader, onChanged }) {
  const { photos, reload } = usePhotos(personId, !admin);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const input = useRef(null);

  const changed = () => { reload(); onChanged?.(); };

  const pick = () => {
    if (!admin && !uploader.trim()) return setError("Please enter your name first.");
    setError(""); setMsg("");
    input.current.click();
  };

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true); setError(""); setMsg("");
    try {
      for (const file of files)
        await uploadPhoto({
          personId, file, approved: admin, uploader: admin ? "Admin" : uploader.trim(),
        });
      if (!admin) setMsg("Thank you! Your photo will appear once the admin approves it.");
      changed();
    } catch {
      setError("Couldn't upload that photo. Please try another image.");
    }
    setBusy(false);
  };

  const approve = async (p) => { await approvePhoto(p.id); changed(); };
  const remove = async (p) => {
    if (!window.confirm("Delete this photo?")) return;
    await deletePhoto(p);
    setOpen(null);
    changed();
  };

  return (
    <section className="photos">
      <h3>Photos</h3>
      {photos.length > 0 ? (
        <div className="thumbs">
          {photos.map((p, i) => (
            <button key={p.id} className={`thumb ${p.approved ? "" : "pending"}`} onClick={() => setOpen(i)}>
              <img src={photoUrl(p.thumb_path)} alt={`Photo ${i + 1}`} loading="lazy" />
              {!p.approved && <span className="pending-tag">Pending</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted tight">No photos yet.</p>
      )}

      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <button type="button" className="add-photo" onClick={pick} disabled={busy}>
        {busy ? "Uploading…" : "+ Add photo"}
      </button>
      {error && <p className="error">{error}</p>}
      {msg && <p className="saved">{msg}</p>}

      {open !== null && (
        <Lightbox
          photos={photos} index={open} onClose={() => setOpen(null)} onIndex={setOpen}
          actions={admin && ((p) => (
            <span className="lb-actions">
              {!p.approved && <button onClick={() => approve(p)}>Approve</button>}
              <button className="danger" onClick={() => remove(p)}>Delete</button>
            </span>
          ))}
        />
      )}
    </section>
  );
}
