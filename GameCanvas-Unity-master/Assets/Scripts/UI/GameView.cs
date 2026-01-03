using System;
using System.Threading;
using System.Threading.Tasks;
using OgiriDice.Evaluation;
using OgiriDice.Game;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace OgiriDice.UI
{
    /// <summary>
    /// Canvas に置いて GameManager と連携し、回答入力 → 評価 → 結果表示の UI を制御します。
    /// </summary>
    public class GameView : MonoBehaviour
    {
        [Header("Controller")]
        [SerializeField] private GameManager gameManager;

        [Header("Topic Display")]
        [SerializeField] private TMP_Text topicText;
        [SerializeField] private TMP_Text categoryText;
        [SerializeField] private TMP_Text difficultyText;

        [Header("Answer Input")]
        [SerializeField] private TMP_InputField answerInput;
        [SerializeField] private Button submitButton;

        [Header("Evaluation Result")]
        [SerializeField] private GameObject resultPanel;
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private TMP_Text commentText;
        [SerializeField] private Button nextButton;

        [Header("Status")]
        [SerializeField] private GameObject loadingIndicator;
        [SerializeField] private TMP_Text statusMessage;

        private CancellationTokenSource evaluationToken;

        private void Awake()
        {
            if (gameManager == null)
            {
                Debug.LogError("GameView: GameManager が割り当てられていません。");
            }

            submitButton.onClick.AddListener(SubmitAnswer);
            nextButton.onClick.AddListener(ShowNextTopic);
        }

        private void OnEnable()
        {
            RefreshTopic();
            SetState(UIState.AwaitingInput);
        }

        private void OnDisable()
        {
            submitButton.onClick.RemoveListener(SubmitAnswer);
            nextButton.onClick.RemoveListener(ShowNextTopic);
            evaluationToken?.Cancel();
            evaluationToken?.Dispose();
        }

        public void RefreshTopic()
        {
            var topic = gameManager?.CurrentTopic;
            topicText.text = topic?.Prompt ?? "お題を取得しています…";
            categoryText.text = topic?.Category ?? "-";
            difficultyText.text = topic?.Difficulty.ToString() ?? "-";
            resultPanel.SetActive(false);
            answerInput.text = string.Empty;
            answerInput.interactable = true;
            submitButton.interactable = true;
        }

        private void SubmitAnswer()
        {
            if (string.IsNullOrWhiteSpace(answerInput.text))
            {
                return;
            }

            if (evaluationToken != null && !evaluationToken.IsCancellationRequested)
            {
                evaluationToken.Cancel();
            }

            evaluationToken = new CancellationTokenSource();
            EvaluateAnswerAsync(answerInput.text, evaluationToken.Token).Forget();
        }

        private async Task EvaluateAnswerAsync(string answer, CancellationToken token)
        {
            SetState(UIState.Evaluating);
            try
            {
                var result = await gameManager.EvaluateCurrentAnswerAsync(answer, token);
                ShowResult(result);
            }
            catch (OperationCanceledException)
            {
                statusMessage.text = "評価をキャンセルしました";
                SetState(UIState.AwaitingInput);
            }
            catch (Exception ex)
            {
                Debug.LogError($"GameView: 評価中に例外 ({ex.Message})");
                statusMessage.text = "評価に失敗しました。再試行してください。";
                SetState(UIState.AwaitingInput);
            }
        }

        private void ShowResult(EvaluationResult result)
        {
            scoreText.text = $"スコア: {result.Score}";
            commentText.text = result.Comment;
            statusMessage.text = $"評価完了 ({result.Score}点)";
            resultPanel.SetActive(true);
            SetState(UIState.ShowingResult);
        }

        private void ShowNextTopic()
        {
            if (gameManager.TryPickNextTopic())
            {
                RefreshTopic();
                SetState(UIState.AwaitingInput);
            }
            else
            {
                statusMessage.text = "次のお題を取得できませんでした";
            }
        }

        private void SetState(UIState state)
        {
            loadingIndicator.SetActive(state == UIState.Evaluating);
            submitButton.interactable = state == UIState.AwaitingInput;
            nextButton.gameObject.SetActive(state == UIState.ShowingResult);
            statusMessage.text = state switch
            {
                UIState.AwaitingInput => "回答を入力してください",
                UIState.Evaluating => "評価中…しばらくお待ちください",
                UIState.ShowingResult => "結果を確認して次へ",
                _ => string.Empty
            };
        }

        private enum UIState
        {
            AwaitingInput,
            Evaluating,
            ShowingResult
        }
    }

    internal static class TaskExtensions
    {
        public static async void Forget(this Task task)
        {
            try
            {
                await task;
            }
            catch
            {
                // Intentionally ignore
            }
        }
    }
}
