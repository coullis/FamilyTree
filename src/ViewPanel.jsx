import { useState } from "react";
import PhotoGallery from "./PhotoGallery";

// Read-only panel for visitors: details, photos, and a form to send a comment to the admin.
export default function ViewPanel({ person, onClose, onComment }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return setError("Please enter a comment.");
    setBusy(true);
    const err = await onComment("Anonymous", text.trim());
    setBusy(false);
    if (err) return setError(err);
    setText(""); setError(""); setSent(true);
  };

  return (
    <aside className="panel">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <h2>{person.name} {person.surname}</h2>
      <span className={`tag ${person.gender === "m" ? "male" : "female"}`}>
        {person.gender === "m" ? "Male" : "Female"}
      </span>
      {person.birthday && (
        <span className="born">
          Born {new Date(person.birthday + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
        </span>
      )}
      {person.deceased && <span className="born">† Deceased</span>}
      {person.notes && <p className="notes">{person.notes}</p>}

      <PhotoGallery personId={person.id} admin={false} />

      <form onSubmit={submit}>
        <h3>Leave a comment</h3>
        <p className="muted tight">Spotted a mistake or someone missing? Tell the family admin.</p>
        <label>Comment
          <textarea value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} />
        </label>
        {error && <p className="error">{error}</p>}
        {sent && <p className="saved">Thank you! Your comment was sent.</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send comment"}</button>
      </form>
    </aside>
  );
}
