import topicData from '../../app/src/data/topics.json';

const knownTopics = new Set(topicData.topics.map(topic => topic.prompt));

export function isKnownTopic(topic: string): boolean {
  return knownTopics.has(topic);
}
