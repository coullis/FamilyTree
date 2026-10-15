// Generation numbers increase toward ancestors and decrease toward descendants.
export const NW = 168;
export const NH = 48;
export const GAP = 40;
export const CW = NW + GAP;
export const RH = 130;
export const PAD = 40;

export function closestOpenX(nodes, anchorX, maxX) {
  const candidates = [];
  for (let x = PAD; x + NW + PAD <= maxX; x += CW) {
    if (nodes.every((node) =>
      x + NW + GAP <= node.x || x >= node.x + NW + GAP
    )) candidates.push(x);
  }
  return candidates.length
    ? candidates.reduce((closest, x) =>
      Math.abs(x - anchorX) < Math.abs(closest - anchorX) ? x : closest
    )
    : anchorX;
}

function separateHorizontalRoutes(routes) {
  const offsets = new Map();
  const remaining = new Set(routes);
  while (remaining.size) {
    const component = [];
    const queue = [remaining.values().next().value];
    remaining.delete(queue[0]);
    while (queue.length) {
      const route = queue.pop();
      component.push(route);
      for (const candidate of remaining) {
        if (Math.abs(route.y - candidate.y) < 10
          && route.left < candidate.right && route.right > candidate.left) {
          remaining.delete(candidate);
          queue.push(candidate);
        }
      }
    }
    if (component.length < 2) continue;
    component.sort((a, b) => a.y - b.y || a.left - b.left || a.index - b.index);
    const middle = (component.length - 1) / 2;
    component.forEach((route, index) => {
      const distance = Math.ceil(Math.abs(index - middle));
      const direction = Math.sign(index - middle);
      offsets.set(route.id, direction * distance * 10);
    });
  }
  return offsets;
}

export function layoutTree({ people, unions }) {
  const personIndex = new Map(people.map((person, index) => [person.id, index]));
  const parent = new Map(people.map((person) => [person.id, person.id]));

  const find = (id) => {
    const root = parent.get(id);
    if (root === undefined || root === id) return root;
    const representative = find(root);
    parent.set(id, representative);
    return representative;
  };
  const join = (ids) => {
    const members = ids.filter((id) => parent.has(id));
    if (members.length < 2) return;
    const representative = find(members[0]);
    members.slice(1).forEach((id) => parent.set(find(id), representative));
  };

  unions.forEach((union) => join(union.partners));

  const groups = new Map();
  people.forEach((person) => {
    const representative = find(person.id);
    if (!groups.has(representative)) groups.set(representative, []);
    groups.get(representative).push(person.id);
  });

  const units = [...groups.values()].map((members) => ({
    members: (() => {
      const ordered = members.slice().sort((a, b) => {
        const firstOrder = people[personIndex.get(a)].layoutOrder;
        const secondOrder = people[personIndex.get(b)].layoutOrder;
        return (Number.isFinite(firstOrder) ? firstOrder : personIndex.get(a))
          - (Number.isFinite(secondOrder) ? secondOrder : personIndex.get(b));
      });
      unions.forEach((union) => {
        const partnerOrder = (union.partnerOrder || []).filter((id) => ordered.includes(id));
        if (partnerOrder.length < 2) return;
        const slots = ordered
          .map((id, index) => partnerOrder.includes(id) ? index : -1)
          .filter((index) => index >= 0);
        partnerOrder.forEach((id, index) => { ordered[slots[index]] = id; });
      });
      return ordered;
    })(),
    order: Math.min(...members.map((id) => {
      const savedOrder = people[personIndex.get(id)].layoutOrder;
      return Number.isFinite(savedOrder) ? savedOrder : personIndex.get(id);
    })),
    width: members.length * NW + (members.length - 1) * GAP,
    parents: new Set(),
    children: new Set(),
    siblings: new Set(),
    generation: undefined,
    center: 0,
    layoutX: members.reduce((x, id) => {
      const savedX = people[personIndex.get(id)].layoutX;
      return Number.isFinite(savedX) ? Math.min(x, savedX) : x;
    }, Infinity),
  }));
  const unitFor = new Map();
  units.forEach((unit) => unit.members.forEach((id) => unitFor.set(id, unit)));

  unions.forEach((union) => {
    const parentUnits = [...new Set(union.partners.map((id) => unitFor.get(id)).filter(Boolean))];
    const childUnits = [...new Set((union.children || []).map((id) => unitFor.get(id)).filter(Boolean))];
    childUnits.forEach((unit) => {
      childUnits.forEach((sibling) => {
        if (unit !== sibling) unit.siblings.add(sibling);
      });
    });
    parentUnits.forEach((parentUnit) => {
      childUnits.forEach((childUnit) => {
        if (parentUnit === childUnit) return;
        parentUnit.children.add(childUnit);
        childUnit.parents.add(parentUnit);
      });
    });
  });

  const assignGenerations = (start, generation) => {
    start.generation = generation;
    const queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const unit = queue[index];
      unit.parents.forEach((relative) => {
        if (relative.generation === undefined) {
          relative.generation = unit.generation + 1;
          queue.push(relative);
        }
      });
      unit.siblings.forEach((relative) => {
        if (relative.generation === undefined) {
          relative.generation = unit.generation;
          queue.push(relative);
        }
      });
      unit.children.forEach((relative) => {
        if (relative.generation === undefined) {
          relative.generation = unit.generation - 1;
          queue.push(relative);
        }
      });
    }
  };

  const giannis = people.find((person) =>
    person.name.trim().toLocaleLowerCase() === "giannis"
    && person.surname.trim().toLocaleLowerCase() === "giagkou"
  );
  if (giannis) assignGenerations(unitFor.get(giannis.id), 0);
  units.slice().sort((a, b) => a.order - b.order).forEach((unit) => {
    if (unit.generation === undefined) assignGenerations(unit, 0);
  });

  const generations = [...new Set(units.map((unit) => unit.generation))].sort((a, b) => a - b);
  const byGeneration = new Map(generations.map((generation) => [
    generation,
    units.filter((unit) => unit.generation === generation)
      .sort((a, b) => a.order - b.order || a.members[0].localeCompare(b.members[0])),
  ]));

  const targetsFor = (generation) => {
    const targets = new Map();
    units.forEach((unit) => {
      const children = [...unit.children]
        .filter((child) => child.generation === generation)
        .sort((a, b) => a.order - b.order);
      if (!children.length) return;

      const span = children.reduce((width, child) => width + child.width, 0)
        + (children.length - 1) * GAP;
      let left = unit.center - span / 2;
      children.forEach((child) => {
        const center = left + child.width / 2;
        const centers = targets.get(child) || [];
        centers.push(center);
        targets.set(child, centers);
        left += child.width + GAP;
      });
    });
    return targets;
  };

  const minGeneration = generations.length ? Math.min(...generations) : 0;
  const maxGeneration = generations.length ? Math.max(...generations) : 0;
  for (let generation = maxGeneration; generation >= minGeneration; generation--) {
    const targets = targetsFor(generation);
    const layer = byGeneration.get(generation).map((unit) => {
      const centers = targets.get(unit) || [];
      const desired = centers.length
        ? centers.reduce((sum, center) => sum + center, 0) / centers.length
        : PAD + unit.width / 2;
      return { unit, desired: Number.isFinite(unit.layoutX) ? unit.layoutX : desired - unit.width / 2 };
    }).sort((a, b) => a.desired - b.desired || a.unit.order - b.unit.order);
    let right = PAD - GAP;
    layer.forEach(({ unit, desired }) => {
      const left = Math.max(PAD, desired, right + GAP);
      unit.center = left + unit.width / 2;
      right = left + unit.width;
    });
  }

  const positions = new Map();
  units.forEach((unit) => {
    const left = unit.center - unit.width / 2;
    unit.members.forEach((id, index) => {
      positions.set(id, {
        x: left + index * (NW + GAP),
        y: PAD + (maxGeneration - unit.generation) * RH,
      });
    });
  });

  const nodes = people
    .filter((person) => positions.has(person.id))
    .map((person) => ({ ...person, ...positions.get(person.id) }));
  const links = [];

  const unionLayouts = unions.map((union, index) => {
    const partners = union.partners.map((id) => positions.get(id)).filter(Boolean);
    const children = (union.children || []).map((id) => positions.get(id)).filter(Boolean);
    if (!partners.length) return { union, partners, children, routes: [] };

    const partnerCenters = partners.map((position) => position.x + NW / 2);
    const parentY = partners.reduce((sum, position) => sum + position.y, 0) / partners.length;
    const parentCenter = partnerCenters.reduce((sum, center) => sum + center, 0) / partnerCenters.length;
    const childById = new Map((union.children || [])
      .map((id) => [id, positions.get(id)])
      .filter(([, position]) => position));
    const twinFor = new Map();
    (union.twinPairs || []).forEach(([first, second]) => {
      twinFor.set(first, second);
      twinFor.set(second, first);
    });
    const childBusAnchors = [];
    const anchoredTwins = new Set();
    (union.children || []).forEach((childId) => {
      const child = childById.get(childId);
      if (!child) return;
      const twinId = twinFor.get(childId);
      const twin = childById.get(twinId);
      if (!twin) {
        childBusAnchors.push(child.x + NW / 2);
        return;
      }
      const key = [childId, twinId].sort().join(":");
      if (anchoredTwins.has(key)) return;
      anchoredTwins.add(key);
      childBusAnchors.push((child.x + twin.x + NW) / 2);
    });

    const coupleY = parentY + NH / 2;
    const busY = parentY + NH + (RH - NH) / 2;
    const routes = [];
    if (partners.length > 1) {
      routes.push({
        id: `${index}:couple`,
        index,
        y: coupleY,
        left: partnerCenters[0] + NW / 2,
        right: partnerCenters[partnerCenters.length - 1] - NW / 2,
      });
    }
    if (children.length && childBusAnchors.length) {
      routes.push({
        id: `${index}:bus`,
        index,
        y: busY,
        left: Math.min(parentCenter, ...childBusAnchors),
        right: Math.max(parentCenter, ...childBusAnchors),
      });
    }
    return {
      union, partners, children, partnerCenters, parentY, parentCenter,
      coupleY, busY, childById, twinFor, childBusAnchors, routes,
    };
  });
  const routeOffsets = separateHorizontalRoutes(unionLayouts.flatMap((layout) => layout.routes));

  unionLayouts.forEach((layout, index) => {
    if (!layout.partners.length) return;
    const {
      union, partners, children, partnerCenters, parentY, parentCenter,
      childById, twinFor, childBusAnchors,
    } = layout;

    const coupleY = layout.coupleY + (routeOffsets.get(`${index}:couple`) || 0);
    if (partners.length > 1) {
      const left = partnerCenters[0] + NW / 2;
      const right = partnerCenters[partners.length - 1] - NW / 2;
      if (union.divorced) {
        const midpoint = (left + right) / 2;
        links.push(
          `M${left},${coupleY} H${midpoint - 7} M${midpoint + 7},${coupleY} H${right}`
          + ` M${midpoint - 5},${coupleY - 5} L${midpoint + 1},${coupleY + 5}`
          + ` M${midpoint + 1},${coupleY - 5} L${midpoint + 7},${coupleY + 5}`
        );
      } else {
        links.push(`M${left},${coupleY} H${right}`);
      }
    }
    if (!children.length) return;

    const busY = layout.busY + (routeOffsets.get(`${index}:bus`) || 0);
    links.push(`M${parentCenter},${partners.length > 1 ? coupleY : parentY + NH} V${busY}`);
    links.push(`M${Math.min(parentCenter, ...childBusAnchors)},${busY} H${Math.max(parentCenter, ...childBusAnchors)}`);
    const drawnTwins = new Set();
    (union.children || []).forEach((childId) => {
      const child = childById.get(childId);
      if (!child) return;
      const twinId = twinFor.get(childId);
      const twin = childById.get(twinId);
      if (!twin) {
        links.push(`M${child.x + NW / 2},${busY} V${child.y}`);
        return;
      }
      const key = [child.x, twin.x].sort((a, b) => a - b).join(":");
      if (drawnTwins.has(key)) return;
      drawnTwins.add(key);
      const junction = (child.x + twin.x + NW) / 2;
      links.push(`M${junction},${busY} L${child.x + NW / 2},${child.y}`);
      links.push(`M${junction},${busY} L${twin.x + NW / 2},${twin.y}`);
    });
  });

  const maxRight = nodes.reduce((right, node) => Math.max(right, node.x + NW), PAD);
  return {
    nodes,
    links,
    width: maxRight + PAD,
    height: PAD * 2 + (maxGeneration - minGeneration) * RH + NH + 60,
  };
}
