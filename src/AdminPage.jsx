import { useState } from "react";
import FamilyTree from "./FamilyTree";
import SidePanel from "./SidePanel";
import SearchBar from "./SearchBar";
import { addRelative, patchPerson, removePerson, updatePerson } from "./familyOps";
import { CW, PAD, RH, closestOpenX, layoutTree } from "./layout";
import { deletePersonPhotos } from "./lib/photos";

export default function AdminPage({
  data, setData, comments, onDeleteComment, onDeleteCommentsFor, onMainPage, onLogout,
  dirty, saving, onSave, pending, onPhotosChanged, unsavedIds,
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
    const addsParent = relation === "father" || relation === "mother";
    const addsChild = relation === "son" || relation === "daughter";
    const hasParents = data.unions.some((union) => union.children.includes(selected));
    let updatedData = res.data;
    if (res.newId && (addsChild || (addsParent && !hasParents))) {
      const layout = layoutTree(data);
      const selectedNode = layout.nodes.find((node) => node.id === selected);
      if (selectedNode) {
        const createsTopRow = addsParent && selectedNode.y === PAD;
        const targetY = selectedNode.y + (addsParent && !createsTopRow ? -RH : RH);
        const occupied = createsTopRow ? [] : layout.nodes.filter((node) => node.y === targetY);
        const maxX = Math.max(layout.width + CW * 4, selectedNode.x + CW * 4);
        const layoutX = closestOpenX(occupied, selectedNode.x, maxX);
        updatedData = {
          ...res.data,
          people: res.data.people.map((person) =>
          person.id === res.newId ? { ...person, layoutX } : person
          ),
        };
      }
    }
    setData(updatedData);
    return null;
  };

  const update = (fields) => {
    const res = updatePerson(data, selected, fields);
    if (res.error) return { error: res.error };
    setData(res.data);
    return { data: res.data };
  };

  const patch = (fields) => setData(patchPerson(data, selected, fields));

  const reorder = (personId, x) => {
    setData((current) => {
      const union = current.unions.find((item) => item.partners.includes(personId));
      const group = (union?.partners || [personId])
        .slice()
        .sort((a, b) => current.people.findIndex((person) => person.id === a)
          - current.people.findIndex((person) => person.id === b));
      const firstIndex = Math.min(...group.map((id) => current.people.findIndex((person) => person.id === id)));
      const offsets = new Map(group.map((id) => [id, current.people.findIndex((person) => person.id === id) - firstIndex]));
      return {
        ...current,
        people: current.people.map((p) =>
          offsets.has(p.id) ? { ...p, layoutX: Math.max(40, x + offsets.get(p.id) * 208) } : p
        ),
      };
    });
  };

  const remove = () => {
    const previousLayout = layoutTree(data);
    const res = removePerson(data, selected);
    if (res.error) return window.alert(res.error);
    if (res.split) {
      return window.alert(
        `Cannot remove ${person.name} ${person.surname} because doing so would split the family tree into separate groups.`
      );
    }
    const previousX = new Map(previousLayout.nodes.map((node) => [node.id, node.x]));
    const removedPartnerPositions = data.unions
      .filter((union) => union.partners.includes(selected))
      .flatMap((union) => union.partners.filter((partnerId) => partnerId !== selected));
    const orphanedChildren = data.unions
      .filter((union) => union.partners.includes(selected))
      .flatMap((union) => union.children || [])
      .filter((childId) => !res.data.unions.some((union) =>
        (union.children || []).includes(childId) && union.partners.length > 0
      ));
    const preserveX = new Map();
    removedPartnerPositions.forEach((partnerId) => {
      const x = previousX.get(partnerId);
      if (Number.isFinite(x)) preserveX.set(partnerId, x);
    });
    orphanedChildren.forEach((childId) => {
      const ownUnion = res.data.unions.find((union) => union.partners.includes(childId));
      (ownUnion?.partners || [childId]).forEach((partnerId) => {
        const x = previousX.get(partnerId);
        if (Number.isFinite(x)) preserveX.set(partnerId, x);
      });
    });
    const updatedData = preserveX.size
      ? {
        ...res.data,
        people: res.data.people.map((member) =>
          preserveX.has(member.id) ? { ...member, layoutX: preserveX.get(member.id) } : member
        ),
      }
      : res.data;
    setData(updatedData);
    onDeleteCommentsFor(selected);
    deletePersonPhotos(selected).then(onPhotosChanged);
    setSelected(null);
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

  return (
    <div className="app">
      <header>
        <div>
          <h1>{data.title} <span className="badge-admin">Admin</span></h1>
          <p>Drag people along their row to adjust spacing. Click a person to edit details, add relatives, read comments or remove them.</p>
        </div>
        <div className="actions">
          <button onClick={download}>Download JSON</button>
          <button onClick={onMainPage}>Main Page</button>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <div className="main">
        <FamilyTree data={data} selectedId={selected} onSelect={setSelected} focus={focus} badges={badges}
          canReorder onReorder={reorder} unsavedIds={unsavedIds} />
        {person && (
          <SidePanel key={person.id} person={person} comments={personComments}
            onClose={() => setSelected(null)} onAdd={add} onUpdate={update}
            onPatch={patch} onRemove={remove} onDeleteComment={onDeleteComment} onPhotosChanged={onPhotosChanged}
            dirty={dirty} saving={saving} onSave={onSave} />
        )}
      </div>
      <SearchBar people={data.people} onPick={pick} />
    </div>
  );
}
