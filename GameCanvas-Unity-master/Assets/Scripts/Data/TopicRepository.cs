using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace OgiriDice.Data
{
    /// <summary>
    /// お題リストをメモリに保持し、カテゴリや難易度で絞り込み/ランダム取得を提供するユーティリティクラス。
    /// </summary>
    public sealed class TopicRepository
    {
        private readonly List<Topic> topics;

        public IReadOnlyList<Topic> Topics => topics;

        public TopicRepository(IEnumerable<Topic> sourceTopics)
        {
            topics = sourceTopics?.Where(t => t != null).ToList() ?? new List<Topic>();
        }

        /// <summary>
        /// StreamingAssets に置いた JSON から読み込む。通常は起動時に一度だけ呼ぶ。
        /// </summary>
        public static TopicRepository LoadFromStreamingAssets(string relativeFileName)
        {
            var path = Path.Combine(Application.streamingAssetsPath, relativeFileName);
            if (!File.Exists(path))
            {
                Debug.LogWarning("TopicRepository: JSON data file not found: " + path);
                return new TopicRepository(Array.Empty<Topic>());
            }

            var payload = File.ReadAllText(path);
            return FromJson(payload);
        }

        public static TopicRepository FromJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new TopicRepository(Array.Empty<Topic>());
            }

            var container = JsonUtility.FromJson<TopicContainer>(json);
            return new TopicRepository(container?.topics);
        }

        public static TopicRepository FromTextAsset(TextAsset asset)
        {
            if (asset == null)
            {
                return new TopicRepository(Array.Empty<Topic>());
            }

            return FromJson(asset.text);
        }

        public static TopicRepository FromStore(TopicDataStore store)
        {
            if (store == null)
            {
                return new TopicRepository(Array.Empty<Topic>());
            }

            return new TopicRepository(store.Topics);
        }

        public Topic[] GetTopics(string category = null, TopicDifficulty? difficulty = null)
        {
            var query = topics.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(t => string.Equals(t.Category, category, StringComparison.OrdinalIgnoreCase));
            }

            if (difficulty.HasValue)
            {
                query = query.Where(t => t.Difficulty == difficulty.Value);
            }

            return query.ToArray();
        }

        public Topic GetRandomTopic(string category = null, TopicDifficulty? difficulty = null, System.Random random = null)
        {
            var pool = GetTopics(category, difficulty);
            if (pool.Length == 0)
            {
                return null;
            }

            random ??= new System.Random();
            return pool[random.Next(pool.Length)];
        }

        public bool TryPickNextTopic(out Topic result, string category = null, TopicDifficulty? difficulty = null, System.Random random = null)
        {
            result = GetRandomTopic(category, difficulty, random);
            return result != null;
        }
    }
}
