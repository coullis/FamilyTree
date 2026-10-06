import { useState } from "react";
import FamilyTree from "./FamilyTree";
import SidePanel from "./SidePanel";
import SearchBar from "./SearchBar";
import { addRelative, patchPerson, removePerson, updatePerson } from "./familyOps";
import { deletePersonPhotos } from "./lib/photos";
import family from "./data/family.json";

export default function AdminPage({
  data, setData, comments, onDeleteComment, onDeleteCommentsFor, onMainPage, onLogout,
  dirty, saving, onSave, pending, onPhotosChanged,
}) {
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);

  const person = data.people.find((p) => p.id === selected);
  const personComments = comments.filter((c) => c.personId === selected);
  // items waiting for review: comments + unapproved photos
  const badges = {};
  comments.forEach((c) => { badges[c.personId] = (badges[c.personId] || 0) + 1; });
  pending.forEach((p) => { badges[p.person_id] = (badges[p.person_id] || 0) + 1; });

  const pick = (id) => {
    setSelected(id);
    setFocus({ id }); // new object each time, so picking the same person again re-centres
  };

  const add = (relation, name, surname) => {
    const res = addRelative(data, selected, relation, name, surname);
    if (res.error) return res.error;
    setData(res.data);
    return null;
  };

  const update = (fields) => {
    const res = updatePerson(data, selected, fields);
    if (res.error) return res.error;
    setData(res.data);
    return null;
  };

  const patch = (fields) => setData(patchPerson(data, selected, fields));

  const remove = () => {
    if (!window.confirm(`Remove ${person.name} ${person.surname} from the tree?`)) return;
    const res = removePerson(data, selected);
    if (res.error) return window.alert(res.error);
    setData(res.data);
    onDeleteCommentsFor(selected);
    deletePersonPhotos(selected).then(onPhotosChanged);
    setSelected(null);
  };

  const save = async () => {
    const err = await onSave();
    if (err) window.alert(err);
  };

  const logout = () => {
    if (!dirty || window.confirm("You have unsaved changes. Log out and discard them?")) onLogout();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "family.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (window.confirm("Reset the tree to the original family.json? You'll still need to press Save to publish it.")) {
      setData(family);
      setSelected(null);
    }
  };

  return (
    <div className="app">
      <header>
        <div>
          <h1>{data.title} <span className="badge-admin">Admin</span></h1>
          <p>Click a person to edit details, add relatives, read comments or remove them.</p>
        </div>
        <div className="actions">
          <button className={dirty ? "save dirty" : "save"} onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
          <button onClick={download}>Download JSON</button>
          <button onClick={reset}>Reset</button>
          <button onClick={onMainPage}>Main Page</button>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <div className="main">
        <FamilyTree data={data} selectedId={selected} onSelect={setSelected} focus={focus} badges={badges} />
        {person && (
          <SidePanel key={person.id} person={person} comments={personComments}
            onClose={() => setSelected(null)} onAdd={add} onUpdate={update}
            onPatch={patch} onRemove={remove} onDeleteComment={onDeleteComment} onPhotosChanged={onPhotosChanged} />
        )}
      </div>
      <SearchBar people={data.people} onPick={pick} />
    </div>
  );
}
