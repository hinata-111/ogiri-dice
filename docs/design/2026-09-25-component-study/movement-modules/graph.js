



/** ノード配列からMapを構築し、整合性(重複id・双方向エッジ)を検証する */
export function buildNodeMap(nodes           )          {
  const map          = new Map();
  for (const node of nodes) {
    if (map.has(node.id)) throw new Error(`duplicate node id: ${node.id}`);
    map.set(node.id, node);
  }
  for (const node of nodes) {
    for (const nb of node.neighbors) {
      const other = map.get(nb);
      if (!other) throw new Error(`unknown neighbor: ${node.id} -> ${nb}`);
      if (!other.neighbors.includes(node.id)) {
        throw new Error(`one-way edge: ${node.id} -> ${nb}`);
      }
    }
  }
  return map;
}

/** 現在地からの移動先候補。来た道は除外(他に無い場合のみ可) */
export function moveOptions(nodeMap         , at        , cameFrom               )           {
  const node = nodeMap.get(at);
  if (!node) throw new Error(`unknown node: ${at}`);
  const options = node.neighbors.filter((id) => id !== cameFrom);
  return options.length > 0 ? options : node.neighbors.slice();
}

/** targetへのBFS最短経路の次の一歩(第一歩はmoveOptionsの制約に従う) */
export function nextStepToward(
  nodeMap         ,
  from        ,
  cameFrom               ,
  target        ,
)         {
  const starts = moveOptions(nodeMap, from, cameFrom);
  if (starts.includes(target)) return target;
  let best = starts[0];
  let bestDist = Infinity;
  for (const start of starts) {
    const dist = bfsDistance(nodeMap, start, target, from);
    if (dist < bestDist) {
      bestDist = dist;
      best = start;
    }
  }
  return best;
}

function bfsDistance(nodeMap         , from        , target        , exclude        )         {
  if (from === target) return 0;
  const visited = new Set([from, exclude]);
  let frontier = [from];
  let dist = 0;
  while (frontier.length > 0) {
    dist += 1;
    const next           = [];
    for (const id of frontier) {
      for (const nb of nodeMap.get(id)?.neighbors ?? []) {
        if (nb === target) return dist;
        if (!visited.has(nb)) {
          visited.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** 目的地候補(劇場・テレビ局) */
export function destinationCandidates(nodes           )            {
  return nodes.filter((n) => n.kind === "theater" || n.kind === "tv");
}
