using System;
using System.Threading;
using System.Threading.Tasks;
using OgiriDice.Evaluation;
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
        [SerializeField] private OgiriEvaluator ogiriEvaluator;

        private TopicRepository repository;
        private Topic currentTopic;
        private System.Random random;

        public Topic CurrentTopic => currentTopic;

        public bool HasEvaluator => ogiriEvaluator != null;

        public async Task<EvaluationResult> EvaluateCurrentAnswerAsync(string answer, CancellationToken cancellationToken = default)
        {
            if (currentTopic == null)
            {
                Debug.LogWarning("GameManager: お題が選ばれていないので評価をスキップします。");
                return new EvaluationResult(1, "お題がありません");
            }

            if (ogiriEvaluator == null)
            {
                Debug.LogWarning("GameManager: OgiriEvaluator が割り当てられていないため評価をスキップします。");
                return new EvaluationResult(1, "評価器が設定されていません");
            }

            try
            {
                var result = await ogiriEvaluator.EvaluateAsync(currentTopic.Prompt, answer, cancellationToken);
                Debug.Log($"GameManager: {currentTopic.Id} evaluated -> score={result.Score}, comment={result.Comment}");
                return result;
            }
            catch (OperationCanceledException)
            {
                Debug.LogWarning("GameManager: 評価処理がキャンセルされました。");
                throw;
            }
            catch (Exception ex)
            {
                Debug.LogError($"GameManager: 評価に失敗しました ({ex.Message})");
                return new EvaluationResult(1, "評価に失敗しました");
            }
        }

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
