import { useState } from "react";
import FamilyTree, { ZoomControls } from "./FamilyTree";
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
  const [zoom, setZoom] = useState(1);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const person = data.people.find((p) => p.id === selected);
  const personComments = comments.filter((c) => c.personId === selected);
  const notificationCounts = new Map();
  comments.forEach((comment) => {
    const counts = notificationCounts.get(comment.personId) || { comments: 0, photos: 0 };
    counts.comments += 1;
    notificationCounts.set(comment.personId, counts);
  });
  pending.forEach((photo) => {
    const counts = notificationCounts.get(photo.person_id) || { comments: 0, photos: 0 };
    counts.photos += 1;
    notificationCounts.set(photo.person_id, counts);
  });
  const notifications = data.people
    .map((member) => ({
      ...member,
      ...(notificationCounts.get(member.id) || { comments: 0, photos: 0 }),
    }))
    .filter((member) => member.comments + member.photos > 0);
  const notificationTotal = notifications.reduce(
    (total, member) => total + member.comments + member.photos,
    0,
  );
  const badges = Object.fromEntries(notifications.map((member) => [
    member.id,
    member.comments + member.photos,
  ]));

  const pick = (id) => {
    setSelected(id);
    setFocus({ id }); // new object each time, so picking the same person again re-centres
  };

  const add = (relation, name, surname, relationshipOptions) => {
    const res = addRelative(data, selected, relation, name, surname, relationshipOptions);
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

  const swapPartners = (firstId, secondId) => {
    const unionIndex = data.unions.findIndex((item) =>
      item.partners.includes(firstId) && item.partners.includes(secondId)
    );
    if (unionIndex < 0) return;
    const layout = layoutTree(data);
    const positions = new Map(layout.nodes.map((node) => [node.id, node.x]));
    const partnerOrder = data.unions[unionIndex].partners
      .slice()
      .sort((a, b) => positions.get(a) - positions.get(b));
    const firstIndex = partnerOrder.indexOf(firstId);
    const secondIndex = partnerOrder.indexOf(secondId);
    [partnerOrder[firstIndex], partnerOrder[secondIndex]] =
      [partnerOrder[secondIndex], partnerOrder[firstIndex]];
    setData((current) => ({
      ...current,
      unions: current.unions.map((union, index) =>
        index === unionIndex ? { ...union, partnerOrder } : union
      ),
    }));
  };

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

  const pushTree = () => {
    const layout = layoutTree(data);
    const selectedNode = layout.nodes.find((node) => node.id === selected);
    if (!selectedNode) return;

    const selectedColumn = Math.round((selectedNode.x - PAD) / CW);
    const nodeX = new Map(layout.nodes.map((node) => [node.id, node.x]));
    const parent = new Map(data.people.map((member) => [member.id, member.id]));
    const find = (id) => {
      const root = parent.get(id);
      if (root === undefined || root === id) return root;
      const representative = find(root);
      parent.set(id, representative);
      return representative;
    };
    data.unions.forEach((union) => {
      const partners = union.partners.filter((id) => parent.has(id));
      partners.slice(1).forEach((id) => parent.set(find(id), find(partners[0])));
    });

    const groupLeft = new Map();
    layout.nodes.forEach((node) => {
      const root = find(node.id);
      groupLeft.set(root, Math.min(groupLeft.get(root) ?? Infinity, node.x));
    });
    const shiftedGroups = new Set(
      [...groupLeft]
        .filter(([, x]) => Math.round((x - PAD) / CW) > selectedColumn)
        .map(([root]) => root)
    );

    setData((current) => ({
      ...current,
      people: current.people.map((member) => {
        const x = nodeX.get(member.id);
        if (!Number.isFinite(x)) return member;
        return {
          ...member,
          layoutX: x + (shiftedGroups.has(find(member.id)) ? CW : 0),
        };
      }),
    }));
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
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
          <button onClick={download}>Download JSON</button>
          <button onClick={onMainPage}>Main Page</button>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <div className="main">
        <FamilyTree data={data} selectedId={selected} onSelect={setSelected} focus={focus} badges={badges}
          canReorder onReorder={reorder} onSwapPartners={swapPartners}
          unsavedIds={unsavedIds} zoom={zoom} onZoomChange={setZoom} />
        {person && (
          <SidePanel key={person.id} person={person} comments={personComments}
            onClose={() => setSelected(null)} onAdd={add} onUpdate={update}
            onPatch={patch} onRemove={remove} onDeleteComment={onDeleteComment} onPhotosChanged={onPhotosChanged}
            dirty={dirty} saving={saving} onSave={onSave} onPushTree={pushTree} />
        )}
      </div>
      {notificationsOpen && (
        <aside id="notification-list" className="notification-list" aria-label="People with notifications">
            <div className="notification-list-header">
              <h2>Notifications</h2>
              <button type="button" className="notification-close" onClick={() => setNotificationsOpen(false)}
                aria-label="Close notifications">×</button>
            </div>
            {notifications.length ? (
              <ul>
                {notifications.map((member) => (
                  <li key={member.id}>
                    <button type="button" className="notification-person" onClick={() => {
                      pick(member.id);
                      setNotificationsOpen(false);
                    }}>
                      <span className={`dot ${member.gender === "m" ? "male" : "female"}`} />
                      <span className="notification-person-details">
                        <strong>{member.name} {member.surname}</strong>
                        <small>
                          {[
                            member.comments ? `${member.comments} comment${member.comments === 1 ? "" : "s"}` : "",
                            member.photos ? `${member.photos} photo${member.photos === 1 ? "" : "s"}` : "",
                          ].filter(Boolean).join(" · ")}
                        </small>
                      </span>
                      <span className="notification-count">{member.comments + member.photos}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notification-empty">No notifications to review.</p>
            )}
        </aside>
      )}
      <button type="button" className="notifications-toggle" aria-expanded={notificationsOpen}
        aria-controls="notification-list" aria-label={`Notifications: ${notificationTotal}`}
        title="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span className="notifications-total">{notificationTotal}</span>
      </button>
      <SearchBar people={data.people} onPick={pick} />
    </div>
  );
}
