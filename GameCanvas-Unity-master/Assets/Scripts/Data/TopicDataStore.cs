using System;
using UnityEngine;

namespace OgiriDice.Data
{
    [CreateAssetMenu(menuName = "Ogiri Dice/Topic Data Store")]
    public sealed class TopicDataStore : ScriptableObject
    {
        [SerializeField] private Topic[] topics = Array.Empty<Topic>();

        public Topic[] Topics => topics;

        public TopicRepository ToRepository() => new TopicRepository(topics);
    }
}
