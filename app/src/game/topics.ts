import type { Topic } from "./types";

export function pickRandomTopic(
  topics: Topic[],
  usedIds: string[],
  random: () => number = Math.random,
): Topic {
  const unused = topics.filter((t) => !usedIds.includes(t.id));
  const pool = unused.length > 0 ? unused : topics;
  return pool[Math.floor(random() * pool.length)];
}
