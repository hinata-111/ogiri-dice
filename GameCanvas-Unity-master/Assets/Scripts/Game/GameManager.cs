using System;
using System.Collections;
using System.Collections.Generic;
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
        [SerializeField] private InputPanelController inputPanel = null!;
        [SerializeField] private LoadingOverlayController loadingOverlay = null!;
        [SerializeField] private ResultPanelController resultPanel = null!;
        [SerializeField] private Animator backgroundAnimator = null!;
        [SerializeField] private CanvasGroup uiCanvasGroup = null!;

        [Header("Board/Turn")]
        [SerializeField, Range(1, 6)] private int playerCount = 1;
        [SerializeField] private BoardManager boardManager = null!;
        [SerializeField] private string boardStreamingAssetFileName = "board.json";
        [SerializeField] private float boardLoadTimeoutSeconds = 5f;
        [SerializeField] private CountdownTimer countdownTimer = null!;

        [Header("Topic Settings")]
        [SerializeField] private string streamingAssetFileName = "topics.json";
        [SerializeField] private bool preferStreamingAssets = true;
        [SerializeField] private TopicDifficulty defaultDifficulty = TopicDifficulty.Normal;
        [SerializeField] private string defaultCategory = "こんな〇〇はイヤだ";
        [SerializeField] private TextAsset fallbackTextAsset = null!;
        [SerializeField] private OgiriEvaluator ogiriEvaluator = null!;

        private TopicRepository repository = null!;
        private Topic? currentTopic;
        private System.Random random = null!;
        private CancellationTokenSource? evaluationToken;
        private string lastAnswer = string.Empty;
        private bool lastEvaluationFailed;
        private bool isEvaluating;
        private GameState currentState = GameState.AwaitingInput;
        private TurnManager turnManager = new TurnManager();
        private List<Player> players = new List<Player>();
        private Board? board;
        private bool isBoardLoaded;
        private bool boardLoadFailed;
        private bool isGameOver;
        private bool timeoutTriggered;

        private const string TriggerAwaitingInput = "TriggerAwaitingInput";
        private const string TriggerEvaluating = "TriggerEvaluating";
        private const string TriggerShowingResult = "TriggerShowingResult";
        private const string TriggerRetry = "TriggerRetry";

        public event Action<GameState> OnStateChanged = delegate { };
        public event Action<Topic?> OnTopicChanged = delegate { };
        public event Action<Player> OnPlayerUpdated = delegate { };

        public GameState CurrentState => currentState;
        public Topic? CurrentTopic => currentTopic;
        public bool HasEvaluator => ogiriEvaluator != null;
        public Player? CurrentPlayer => turnManager.CurrentPlayer;

        private void Awake()
        {
            random = new System.Random();
            repository = LoadRepository();
            players = CreatePlayers(playerCount);
            turnManager.Initialize(players);
            var currentPlayer = turnManager.CurrentPlayer;
            if (currentPlayer != null)
            {
                OnPlayerUpdated(currentPlayer);
            }

            StartCoroutine(LoadBoardAsync());
            SetState(GameState.AwaitingInput);
            TryPickNextTopic();
        }

        private void OnEnable()
        {
            RegisterPanelEvents();
            RegisterTimerEvents();
        }

        private void OnDisable()
        {
            UnregisterPanelEvents();
            UnregisterTimerEvents();
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

        private void RegisterTimerEvents()
        {
            if (countdownTimer == null)
            {
                return;
            }

            countdownTimer.OnTimeout -= HandleTimeout;
            countdownTimer.OnTimeout += HandleTimeout;
        }

        private void UnregisterTimerEvents()
        {
            if (countdownTimer == null)
            {
                return;
            }

            countdownTimer.OnTimeout -= HandleTimeout;
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

            timeoutTriggered = false;
            countdownTimer?.StopTimer();
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

        private void HandleTimeout()
        {
            if (isEvaluating || timeoutTriggered || currentState != GameState.AwaitingInput)
            {
                return;
            }

            timeoutTriggered = true;
            lastAnswer = string.Empty;
            StartEvaluationAsync(lastAnswer).Forget();
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
                StartMoveSequence(result);
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

        public List<Player> CreatePlayers(int count)
        {
            var safeCount = Mathf.Clamp(count, 1, 6);
            var created = new List<Player>(safeCount);
            for (var i = 0; i < safeCount; i++)
            {
                created.Add(new Player($"Player{i + 1}"));
            }

            return created;
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
                    timeoutTriggered = false;
                    countdownTimer?.StartTimer();
                    break;
                case GameState.Evaluating:
                    inputPanel?.SetInteractable(false);
                    loadingOverlay?.Show();
                    resultPanel?.Hide();
                    countdownTimer?.StopTimer();
                    break;
                case GameState.ShowingResult:
                    inputPanel?.SetInteractable(false);
                    loadingOverlay?.Hide();
                    countdownTimer?.StopTimer();
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

        private void StartMoveSequence(EvaluationResult result)
        {
            if (boardManager == null)
            {
                Debug.LogWarning("GameManager: BoardManager is not assigned.");
                return;
            }

            if (boardLoadFailed)
            {
                Debug.LogError("GameManager: Board load failed. Movement is blocked.");
                return;
            }

            var currentPlayer = turnManager.CurrentPlayer;
            if (currentPlayer == null)
            {
                Debug.LogWarning("GameManager: Current player is not available.");
                return;
            }

            var score = string.IsNullOrWhiteSpace(lastAnswer) ? 0 : result.Score;
            var steps = score;
            if (!isBoardLoaded)
            {
                StartCoroutine(WaitForBoardAndMove(currentPlayer, steps, score));
                return;
            }

            StartCoroutine(MoveAndAdvanceTurn(currentPlayer, steps, score));
        }

        private IEnumerator WaitForBoardAndMove(Player player, int steps, int score)
        {
            var elapsed = 0f;
            while (!isBoardLoaded && !boardLoadFailed && elapsed < boardLoadTimeoutSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                yield return null;
            }

            if (!isBoardLoaded)
            {
                boardLoadFailed = true;
                Debug.LogError("GameManager: Board load timed out.");
                yield break;
            }

            yield return MoveAndAdvanceTurn(player, steps, score);
        }

        private IEnumerator MoveAndAdvanceTurn(Player player, int steps, int score)
        {
            yield return boardManager.MovePlayerCoroutine(player, steps);
            if (board != null && board.TryGetCell(player.Position, out var cell) && cell != null)
            {
                OnLandOnCell(cell, player, score);
            }

            turnManager.NextTurn();
            var currentPlayer = turnManager.CurrentPlayer;
            if (currentPlayer != null)
            {
                OnPlayerUpdated(currentPlayer);
            }
        }

        private IEnumerator LoadBoardAsync()
        {
            if (boardManager == null)
            {
                Debug.LogWarning("GameManager: BoardManager is not assigned.");
                boardLoadFailed = true;
                yield break;
            }

            BoardData? loaded = null;
            yield return BoardLoader.LoadDataFromStreamingAssetsAsync(boardStreamingAssetFileName, data => loaded = data);
            if (loaded == null)
            {
                Debug.LogError("GameManager: Board data could not be loaded.");
                boardLoadFailed = true;
                yield break;
            }

            var cells = BoardLoader.ToBoardCells(loaded);
            if (cells.Length == 0)
            {
                Debug.LogError("GameManager: Board data is empty.");
                boardLoadFailed = true;
                yield break;
            }

            board = new Board(cells);
            boardManager.SetBoard(board);
            isBoardLoaded = true;
            boardLoadFailed = false;
            Debug.Log($"GameManager: Board loaded. cells={board.CellCount}");
        }

        private void OnLandOnCell(BoardCell cell, Player player, int score)
        {
            if (cell.Type == CellType.Blue)
            {
                var delta = score * 100;
                player.AddMoney(delta);
                Debug.Log($"{player.Name}: 青マス +{delta}円 (score={score})");
                if (player.Money >= 1000000)
                {
                    isGameOver = true;
                    Debug.Log($"{player.Name}が100万円到達！ゲーム終了");
                    HandleGameOver(player);
                }
            }
            else if (cell.Type == CellType.Red)
            {
                var target = UnityEngine.Random.Range(1, 5);
                var penalty = (target - score) * 10000;
                if (penalty > 0)
                {
                    player.AddMoney(-penalty);
                }

                Debug.Log($"目標値: {target}, Score: {score}, ペナルティ: {Mathf.Max(penalty, 0)}円");
                Debug.Log($"{player.Name}の所持金: {player.Money}円");
            }

            OnPlayerUpdated(player);
        }

        private void HandleGameOver(Player player)
        {
            if (!isGameOver)
            {
                return;
            }

            Debug.Log("GameManager: Game over requested.");
        }
    }
}
