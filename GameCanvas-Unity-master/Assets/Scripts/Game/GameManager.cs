using System;
using OgiriDice.Data;
using UnityEngine;

namespace OgiriDice.Game
{
    /// <summary>
    /// TopicRepository を初期化し、カテゴリ＋難易度でお題を選ぶテスト用 GameManager クラス。
    /// Inspector でカテゴリ・難易度・StreamingAssets ファイルを切り替え可能。
    /// </summary>
    public sealed class GameManager : MonoBehaviour
    {
        [Header("Topic Settings")]
        [SerializeField] private string streamingAssetFileName = "topics.json";
        [SerializeField] private bool preferStreamingAssets = true;
        [SerializeField] private TopicDifficulty defaultDifficulty = TopicDifficulty.Normal;
        [SerializeField] private string defaultCategory = "こんな〇〇はイヤだ";
        [SerializeField] private TextAsset fallbackTextAsset;

        private TopicRepository repository;
        private Topic currentTopic;
        private System.Random random;

        public Topic CurrentTopic => currentTopic;

        private void Awake()
        {
            random = new System.Random();
            repository = LoadRepository();
            TryPickNextTopic();
        }

        private TopicRepository LoadRepository()
        {
            if (preferStreamingAssets)
            {
                var streamingRepository = TopicRepository.LoadFromStreamingAssets(streamingAssetFileName);
                if (streamingRepository.Topics.Count > 0)
                {
                    Debug.Log($"GameManager: Loaded {streamingRepository.Topics.Count} topics from StreamingAssets/{streamingAssetFileName}");
                    return streamingRepository;
                }

                Debug.LogWarning("GameManager: StreamingAssets topic file was empty or missing, falling back to TextAsset.");
            }

            var asset = fallbackTextAsset ?? Resources.Load<TextAsset>("topics");
            var fallbackRepository = TopicRepository.FromTextAsset(asset);
            Debug.Log($"GameManager: Loaded {fallbackRepository.Topics.Count} topics from TextAsset");
            return fallbackRepository;
        }

        public bool TryPickNextTopic(string category = null, TopicDifficulty? difficulty = null)
        {
            category ??= defaultCategory;
            difficulty ??= defaultDifficulty;

            if (repository.TryPickNextTopic(out var nextTopic, category, difficulty, random))
            {
                currentTopic = nextTopic;
                Debug.Log($"GameManager: Selected topic '{currentTopic.Prompt}' ({currentTopic.Category}/{currentTopic.Difficulty})");
                return true;
            }

            Debug.LogWarning($"GameManager: No topic available for category='{category}' difficulty='{difficulty}'.");
            return false;
        }

        [ContextMenu("Pick Next Topic")]
        private void DebugPickNextTopic()
        {
            TryPickNextTopic();
        }

        public void ForcePickTopic(string category, TopicDifficulty difficulty)
        {
            TryPickNextTopic(category, difficulty);
        }
    }
}
