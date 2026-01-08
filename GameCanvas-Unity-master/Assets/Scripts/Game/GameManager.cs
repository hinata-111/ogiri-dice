using System;
using System.Threading;
using System.Threading.Tasks;
using OgiriDice;
using OgiriDice.Data;
using OgiriDice.Evaluation;
using OgiriDice.UI;
using UnityEngine;

namespace OgiriDice.Game
{
    public enum GameState
    {
        AwaitingInput,
        Evaluating,
        ShowingResult
    }

    /// <summary>
    /// TopicRepository を初期化し、カテゴリ＋難易度でお題を選ぶテスト用 GameManager クラス。
    /// </summary>
    public sealed class GameManager : MonoBehaviour
    {
        [Header("UI Panels")]
        [SerializeField] private InputPanelController inputPanel;
        [SerializeField] private LoadingOverlayController loadingOverlay;
        [SerializeField] private ResultPanelController resultPanel;
        [SerializeField] private Animator backgroundAnimator;
        [SerializeField] private CanvasGroup uiCanvasGroup;

        [Header("Topic Settings")]
        [SerializeField] private string streamingAssetFileName = "topics.json";
        [SerializeField] private bool preferStreamingAssets = true;
        [SerializeField] private TopicDifficulty defaultDifficulty = TopicDifficulty.Normal;
        [SerializeField] private string defaultCategory = "こんな〇〇はイヤだ";
        [SerializeField] private TextAsset fallbackTextAsset;
        [SerializeField] private OgiriEvaluator ogiriEvaluator;

        private TopicRepository repository;
        private Topic? currentTopic;
        private System.Random random;
        private CancellationTokenSource evaluationToken;
        private string lastAnswer;
        private bool lastEvaluationFailed;
        private bool isEvaluating;
        private GameState currentState = GameState.AwaitingInput;

        private const string TriggerAwaitingInput = "TriggerAwaitingInput";
        private const string TriggerEvaluating = "TriggerEvaluating";
        private const string TriggerShowingResult = "TriggerShowingResult";
        private const string TriggerRetry = "TriggerRetry";

        public event Action<GameState> OnStateChanged;
        public event Action<Topic?> OnTopicChanged;

        public GameState CurrentState => currentState;
        public Topic? CurrentTopic => currentTopic;
        public bool HasEvaluator => ogiriEvaluator != null;

        private void Awake()
        {
            random = new System.Random();
            repository = LoadRepository();
            SetState(GameState.AwaitingInput);
            TryPickNextTopic();
        }

        private void OnEnable()
        {
            RegisterPanelEvents();
        }

        private void OnDisable()
        {
            UnregisterPanelEvents();
        }

        private void OnDestroy()
        {
            evaluationToken?.Cancel();
            evaluationToken?.Dispose();
        }

        private void RegisterPanelEvents()
        {
            if (inputPanel != null)
            {
                inputPanel.OnSubmit -= HandleAnswerSubmitted;
                inputPanel.OnSubmit += HandleAnswerSubmitted;
            }

            if (resultPanel != null)
            {
                resultPanel.OnNext -= HandleNextTopic;
                resultPanel.OnNext += HandleNextTopic;
                resultPanel.OnRetry -= RetryEvaluation;
                resultPanel.OnRetry += RetryEvaluation;
            }
        }

        private void UnregisterPanelEvents()
        {
            if (inputPanel != null)
            {
                inputPanel.OnSubmit -= HandleAnswerSubmitted;
            }

            if (resultPanel != null)
            {
                resultPanel.OnNext -= HandleNextTopic;
                resultPanel.OnRetry -= RetryEvaluation;
            }
        }

        private void HandleAnswerSubmitted(string answer)
        {
            if (string.IsNullOrWhiteSpace(answer) || isEvaluating)
            {
                return;
            }

            lastAnswer = answer.Trim();
            StartEvaluationAsync(lastAnswer).Forget();
        }

        private void HandleNextTopic()
        {
            if (!TryPickNextTopic())
            {
                Debug.LogWarning("GameManager: 次のお題を取得できませんでした。");
                return;
            }

            resultPanel?.Hide();
            inputPanel?.Clear();
            SetState(GameState.AwaitingInput);
        }

        public void RetryEvaluation()
        {
            if (string.IsNullOrWhiteSpace(lastAnswer) || isEvaluating)
            {
                Debug.LogWarning("GameManager: 再評価する回答がありません。");
                return;
            }

            StartEvaluationAsync(lastAnswer).Forget();
        }

        public async Task<EvaluationResult> EvaluateCurrentAnswerAsync(string answer, CancellationToken cancellationToken = default)
        {
            if (currentTopic == null)
            {
                Debug.LogWarning("GameManager: お題が選ばれていないので評価をスキップします。");
                return new EvaluationResult(1, EvaluationResult.FailureComment);
            }

            if (ogiriEvaluator == null)
            {
                Debug.LogWarning("GameManager: OgiriEvaluator が割り当てられていないため評価をスキップします。");
                return new EvaluationResult(1, EvaluationResult.FailureComment);
            }

            try
            {
                var result = await ogiriEvaluator.EvaluateAsync(currentTopic.Prompt, answer, cancellationToken);
                Debug.Log($"GameManager: 評価結果 -> score={result.Score}, comment={result.Comment}");
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
                return new EvaluationResult(1, EvaluationResult.FailureComment);
            }
        }

        private async Task StartEvaluationAsync(string answer)
        {
            evaluationToken?.Cancel();
            evaluationToken?.Dispose();
            evaluationToken = new CancellationTokenSource();

            SetState(GameState.Evaluating);
            lastEvaluationFailed = false;

            try
            {
                isEvaluating = true;
                var result = await EvaluateCurrentAnswerAsync(answer, evaluationToken.Token);
                lastEvaluationFailed = result.Score == 1 && string.Equals(result.Comment, EvaluationResult.FailureComment, StringComparison.Ordinal);
                resultPanel?.ShowResult(result, lastEvaluationFailed);
                SetState(GameState.ShowingResult, lastEvaluationFailed);
            }
            catch (OperationCanceledException)
            {
                SetState(GameState.AwaitingInput);
            }
            finally
            {
                isEvaluating = false;
            }
        }

        public bool TryPickNextTopic(string? category = null, TopicDifficulty? difficulty = null)
        {
            category ??= defaultCategory;
            difficulty ??= defaultDifficulty;

            if (repository.TryPickNextTopic(out var nextTopic, category, difficulty, random))
            {
                currentTopic = nextTopic;
                lastEvaluationFailed = false;
                lastAnswer = string.Empty;
                if (currentTopic != null)
                {
                    Debug.Log($"GameManager: Selected topic '{currentTopic.Prompt}' ({currentTopic.Category}/{currentTopic.Difficulty})");
                }
                OnTopicChanged?.Invoke(currentTopic);
                return true;
            }

            Debug.LogWarning($"GameManager: No topic available for category='{category}' difficulty='{difficulty}'.");
            return false;
        }

        public void ForcePickTopic(string category, TopicDifficulty difficulty)
        {
            TryPickNextTopic(category, difficulty);
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

        private void SetState(GameState state, bool useRetryTrigger = false)
        {
            currentState = state;
            OnStateChanged?.Invoke(state);

            if (uiCanvasGroup != null)
            {
                uiCanvasGroup.interactable = state != GameState.Evaluating;
            }

            switch (state)
            {
                case GameState.AwaitingInput:
                    inputPanel?.Activate(true);
                    inputPanel?.SetInteractable(true);
                    loadingOverlay?.Hide();
                    resultPanel?.Hide();
                    break;
                case GameState.Evaluating:
                    inputPanel?.SetInteractable(false);
                    loadingOverlay?.Show();
                    resultPanel?.Hide();
                    break;
                case GameState.ShowingResult:
                    inputPanel?.SetInteractable(false);
                    loadingOverlay?.Hide();
                    break;
            }

            if (backgroundAnimator != null)
            {
                var trigger = state switch
                {
                    GameState.AwaitingInput => TriggerAwaitingInput,
                    GameState.Evaluating => TriggerEvaluating,
                    GameState.ShowingResult => useRetryTrigger ? TriggerRetry : TriggerShowingResult,
                    _ => null
                };

                if (!string.IsNullOrEmpty(trigger))
                {
                    backgroundAnimator.SetTrigger(trigger);
                }
            }
        }
    }
}
