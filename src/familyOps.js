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

export function addRelative(data, personId, relation, name, surname) {
  if (!name.trim()) return { error: "Please enter a name." };
  const gender = ["son", "husband", "father", "brother"].includes(relation) ? "m" : "f";
  const np = { id: uid(), name: name.trim(), surname: surname.trim(), gender };

  const unions = data.unions.map((u) => ({
    partners: [...u.partners],
    children: [...(u.children || [])],
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
  } else if (relation === "husband" || relation === "wife") {
    if (own) {
      if (own.partners.length > 1) return { error: "This person already has a partner." };
      own.partners.push(np.id);
      touched = own;
    } else unions.push({ partners: [personId, np.id], children: [] });
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
  }
  return { data: { ...data, people: [...data.people, np], unions }, newId: np.id };
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
      partners: u.partners.filter((p) => p !== id),
      children: (u.children || []).filter((c) => c !== id),
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
