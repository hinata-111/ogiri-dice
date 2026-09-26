import { destinationCandidates } from "./graph.js";


/** 除外id(現目的地や現在地)以外からランダムに目的地を選ぶ */
export function pickDestination(
  nodes           , excludeIds          , random               = Math.random,
)         {
  const pool = destinationCandidates(nodes).filter((n) => !excludeIds.includes(n.id));
  const list = pool.length > 0 ? pool : destinationCandidates(nodes);
  return list[Math.floor(random() * list.length)].id;
}
