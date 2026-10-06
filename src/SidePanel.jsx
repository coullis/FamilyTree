import { useState } from "react";
import { RELATIONS } from "./familyOps";
import PhotoGallery from "./PhotoGallery";

export default function SidePanel({ person, onClose, onAdd, onUpdate, onPatch, onRemove, comments, onDeleteComment, onPhotosChanged }) {
  const [tab, setTab] = useState("details"); // "details" | "add"
  // add-relationship form
  const [relation, setRelation] = useState("son");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  // edit-details form
  const [edit, setEdit] = useState({
    name: person.name, surname: person.surname, birthday: person.birthday || "",
    gender: person.gender, notes: person.notes || "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const switchTab = (t) => { setTab(t); setError(""); setSaved(false); };

  const submitAdd = (e) => {
    e.preventDefault();
    const err = onAdd(relation, name, surname);
    if (err) return setError(err);
    setName(""); setSurname(""); setError("");
    switchTab("details");
  };

  const submitEdit = (e) => {
    e.preventDefault();
    const err = onUpdate(edit);
    setError(err || "");
    setSaved(!err);
  };

  const change = (field) => (e) => {
    setEdit({ ...edit, [field]: e.target.value });
    setSaved(false);
  };

  return (
    <aside className="panel">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <button
        className="cross-toggle"
        aria-pressed={!!person.deceased}
        title={person.deceased ? "Marked as deceased" : "Mark as deceased"}
        aria-label="Deceased"
        onClick={() => onPatch({ deceased: !person.deceased })}
      >†</button>
      <h2>{person.name} {person.surname}</h2>
      <span className={`tag ${person.gender === "m" ? "male" : "female"}`}>
        {person.gender === "m" ? "Male" : "Female"}
      </span>
      {person.birthday && (
        <span className="born">
          Born {new Date(person.birthday + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
        </span>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "details"} onClick={() => switchTab("details")}>Details</button>
        <button role="tab" aria-selected={tab === "add"} onClick={() => switchTab("add")}>Add relationship</button>
        <button role="tab" aria-selected={tab === "comments"} onClick={() => switchTab("comments")}>
          Comments{comments.length ? ` (${comments.length})` : ""}
        </button>
      </div>

      {tab === "details" && (
        <>
          <form className="edit" onSubmit={submitEdit}>
            <label>Name
              <input value={edit.name} onChange={change("name")} />
            </label>
            <label>Surname
              <input value={edit.surname} onChange={change("surname")} />
            </label>
            <label>Birthday
              <input type="date" value={edit.birthday} onChange={change("birthday")} />
            </label>
            <label>Gender
              <select value={edit.gender} onChange={change("gender")}>
                <option value="m">Male</option>
                <option value="f">Female</option>
              </select>
            </label>
            <label>Notes
              <textarea value={edit.notes} onChange={change("notes")}
                placeholder="Write something about this person…" />
            </label>
            {error && <p className="error">{error}</p>}
            {saved && <p className="saved">Saved</p>}
            <button className="primary" type="submit">Save changes</button>
          </form>
          <PhotoGallery personId={person.id} admin uploader="Admin" onChanged={onPhotosChanged} />
        </>
      )}

      {tab === "add" && (
        <form onSubmit={submitAdd}>
          <h3>Add a relative of {person.name}</h3>
          <label>This person is {person.name}'s…
            <select value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>Surname
            <input value={surname} onChange={(e) => setSurname(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Add to tree</button>
        </form>
      )}

      {tab === "comments" && (
        <div className="comments">
          <h3>Comments about {person.name}</h3>
          {comments.length === 0 && <p className="muted tight">No comments yet.</p>}
          {comments.map((c) => (
            <article key={c.id} className="comment">
              <div className="meta">
                <strong>{c.author}</strong>
                <time>{new Date(c.date).toLocaleDateString()}</time>
              </div>
              <p>{c.text}</p>
              <button onClick={() => onDeleteComment(c.id)}>Delete</button>
            </article>
          ))}
        </div>
      )}

      <button className="remove" onClick={onRemove}>Remove {person.name} from the tree</button>
    </aside>
  );
}
