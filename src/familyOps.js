// Pure helpers that change or read the family data.
export const RELATIONS = [
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "husband", label: "Husband" },
  { value: "wife", label: "Wife" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
];

const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function addRelative(data, personId, relation, name, surname, options = {}) {
  if (!name.trim()) return { error: "Please enter a name." };
  const gender = ["son", "husband", "father", "brother"].includes(relation) ? "m" : "f";
  const np = { id: uid(), name: name.trim(), surname: surname.trim(), gender };

  const unions = data.unions.map((u) => ({
    ...u,
    partners: [...u.partners],
    children: [...(u.children || [])],
    ...(u.twinPairs && { twinPairs: u.twinPairs.map((pair) => [...pair]) }),
  }));
  const own = unions.find((u) => u.partners.includes(personId));
  const parentUnion = unions.find((u) => u.children.includes(personId));
  let touched;

  if (relation === "son" || relation === "daughter") {
    if (own) { own.children.push(np.id); touched = own; }
    else unions.push({ partners: [personId], children: [np.id] });
  } else if (relation === "brother" || relation === "sister") {
    if (!parentUnion) return { error: "Add a parent first, then you can add siblings." };
    parentUnion.children.push(np.id);
    if (options.twin) {
      parentUnion.twinPairs = [...(parentUnion.twinPairs || []), [personId, np.id]];
    }
  } else if (relation === "husband" || relation === "wife") {
    if (options.divorcee) {
      const selected = data.people.find((person) => person.id === personId);
      const partners = [selected, np]
        .sort((a, b) => (a.gender === "m" ? 0 : 1) - (b.gender === "m" ? 0 : 1))
        .map((person) => person.id);
      unions.push({ partners, children: [], divorced: true });
    } else {
      const currentUnion = unions.find((union) =>
        union.partners.includes(personId) && !union.divorced
      );
      if (currentUnion) {
        if (currentUnion.partners.length > 1) return { error: "This person already has a partner." };
        currentUnion.partners.push(np.id);
        currentUnion.partnerOrder = [np.id, personId];
        touched = currentUnion;
      } else {
        unions.push({
          partners: [personId, np.id],
          partnerOrder: [np.id, personId],
          children: [],
        });
      }
    }
  } else {
    if (parentUnion) {
      if (parentUnion.partners.length > 1) return { error: "This person already has both parents." };
      parentUnion.partners.push(np.id);
      touched = parentUnion;
    } else unions.push({ partners: [np.id], children: [personId] });
  }

  // keep the male partner on the left
  if (touched) {
    const g = (id) => (id === np.id ? np : data.people.find((p) => p.id === id)).gender;
    touched.partners.sort((a, b) => (g(a) === "m" ? 0 : 1) - (g(b) === "m" ? 0 : 1));
    if (options.divorcee) touched.divorced = true;
  }
  return { data: { ...data, people: [...data.people, np], unions }, newId: np.id };
}

export function positionPartner(previousData, updatedData, layout, selected, newId) {
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const selectedNode = nodes.get(selected);
  if (!selectedNode) return updatedData;

  const existingPartnerIds = new Set(previousData.unions
    .filter((union) => union.partners.includes(selected))
    .flatMap((union) => union.partners.filter((id) => id !== selected)));
  const existingPartners = [...existingPartnerIds]
    .map((id) => nodes.get(id))
    .filter(Boolean);
  const leftCount = existingPartners.filter((node) => node.x < selectedNode.x).length;
  const rightCount = existingPartners.length - leftCount;
  const side = !leftCount ? "left" : !rightCount ? "right"
    : leftCount <= rightCount ? "left" : "right";

  const partnerGroup = new Set([selected]);
  let changed = true;
  while (changed) {
    changed = false;
    previousData.unions.forEach((union) => {
      if (!union.partners.some((id) => partnerGroup.has(id))) return;
      union.partners.forEach((id) => {
        if (!partnerGroup.has(id)) {
          partnerGroup.add(id);
          changed = true;
        }
      });
    });
  }

  const ordered = [...partnerGroup].sort((a, b) =>
    (nodes.get(a)?.x ?? Infinity) - (nodes.get(b)?.x ?? Infinity)
  );
  const selectedIndex = ordered.indexOf(selected);
  ordered.splice(selectedIndex + (side === "right" ? 1 : 0), 0, newId);
  const orderById = new Map(ordered.map((id, index) => [id, index]));
  const baseOrder = Math.min(...ordered.map((id) =>
    updatedData.people.findIndex((person) => person.id === id)
  ));
  const people = updatedData.people.map((person) =>
    orderById.has(person.id)
      ? { ...person, layoutOrder: baseOrder + orderById.get(person.id) / ordered.length }
      : person
  );
  const unions = updatedData.unions.map((union) => {
    if (!union.partners.some((id) => orderById.has(id))) return union;
    return {
      ...union,
      partnerOrder: [...union.partners].sort((a, b) => orderById.get(a) - orderById.get(b)),
    };
  });
  return { ...updatedData, people, unions };
}

export function getRelatives(data, id) {
  const byId = Object.fromEntries(data.people.map((p) => [p.id, p]));
  const parents = data.unions.filter((u) => (u.children || []).includes(id)).flatMap((u) => u.partners);
  const own = data.unions.find((u) => u.partners.includes(id));
  return {
    parents: parents.map((i) => byId[i]),
    partners: own ? own.partners.filter((i) => i !== id).map((i) => byId[i]) : [],
    children: own ? (own.children || []).map((i) => byId[i]) : [],
  };
}

export function updatePerson(data, id, fields) {
  if (!fields.name.trim()) return { error: "Name can't be empty." };
  const people = data.people.map((p) =>
    p.id === id
      ? { ...p, name: fields.name.trim(), surname: fields.surname.trim(), gender: fields.gender, birthday: fields.birthday, notes: fields.notes }
      : p
  );
  // keep the male partner on the left after a gender change
  const g = (pid) => people.find((p) => p.id === pid).gender;
  const unions = data.unions.map((u) => ({
    ...u,
    partners: [...u.partners].sort((a, b) => (g(a) === "m" ? 0 : 1) - (g(b) === "m" ? 0 : 1)),
  }));
  return { data: { ...data, people, unions } };
}

export function removePerson(data, id) {
  if (data.people.length === 1) return { error: "You can't remove the last person." };

  const unions = data.unions
    .map((u) => ({
      ...u,
      partners: u.partners.filter((p) => p !== id),
      children: (u.children || []).filter((c) => c !== id),
      ...(u.twinPairs && {
        twinPairs: u.twinPairs.filter((pair) => !pair.includes(id)),
      }),
    }))
    .filter((u) => u.partners.length > 0
      ? u.partners.length > 1 || u.children.length > 0
      : u.children.length > 1);
  const people = data.people.filter((p) => p.id !== id);
  const countComponents = (members, relationships) => {
    const roots = new Map(members.map((person) => [person.id, person.id]));
    const find = (personId) => {
      const root = roots.get(personId);
      if (root === undefined || root === personId) return root;
      const representative = find(root);
      roots.set(personId, representative);
      return representative;
    };
    relationships.forEach((union) => {
      const connected = [...union.partners, ...(union.children || [])]
        .filter((personId) => roots.has(personId));
      connected.slice(1).forEach((personId) => roots.set(find(personId), find(connected[0])));
    });
    return new Set([...roots.keys()].map(find)).size;
  };

  const split = countComponents(people, unions) > countComponents(data.people, data.unions);
  return { data: { ...data, people, unions }, split };
}

export function patchPerson(data, id, patch) {
  return { ...data, people: data.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}
