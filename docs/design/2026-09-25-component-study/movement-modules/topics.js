

export function pickRandomTopic(
  topics         ,
  usedIds          ,
  random               = Math.random,
)        {
  const unused = topics.filter((t) => !usedIds.includes(t.id));
  const pool = unused.length > 0 ? unused : topics;
  return pool[Math.floor(random() * pool.length)];
}
