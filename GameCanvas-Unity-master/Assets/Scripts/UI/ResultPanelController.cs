using System;
using OgiriDice.Evaluation;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace OgiriDice.UI
{
    public sealed class ResultPanelController : MonoBehaviour
    {
        [SerializeField] private CanvasGroup canvasGroup = null!;
        [SerializeField] private TMP_Text scoreText = null!;
        [SerializeField] private TMP_Text commentText = null!;
        [SerializeField] private TMP_Text statusText = null!;
        [SerializeField] private Button nextButton = null!;
        [SerializeField] private Button retryButton = null!;

        public event Action OnNext = delegate { };
        public event Action OnRetry = delegate { };

        private void Awake()
        {
            if (nextButton != null)
            {
                nextButton.onClick.AddListener(HandleNext);
            }

            if (retryButton != null)
            {
                retryButton.onClick.AddListener(HandleRetry);
            }

            Hide();
        }

        private void OnDestroy()
        {
            if (nextButton != null)
            {
                nextButton.onClick.RemoveListener(HandleNext);
            }

            if (retryButton != null)
            {
                retryButton.onClick.RemoveListener(HandleRetry);
            }
        }

        private void HandleNext()
        {
            OnNext?.Invoke();
        }

        private void HandleRetry()
        {
            OnRetry?.Invoke();
        }

        public void ShowResult(EvaluationResult result, bool isFailure)
        {
            if (canvasGroup != null)
            {
                canvasGroup.alpha = 1f;
                canvasGroup.interactable = true;
                canvasGroup.blocksRaycasts = true;
            }

            if (scoreText != null)
            {
                scoreText.text = $"スコア: {result.Score}";
            }

            if (commentText != null)
            {
                commentText.text = result.Comment;
            }

            if (statusText != null)
            {
                statusText.text = isFailure ? "評価に失敗しました" : "評価完了";
            }

            if (nextButton != null)
            {
                nextButton.gameObject.SetActive(!isFailure);
            }

            if (retryButton != null)
            {
                retryButton.gameObject.SetActive(isFailure);
            }
        }

        public void Hide()
        {
            if (canvasGroup == null)
            {
                return;
            }

            canvasGroup.alpha = 0f;
            canvasGroup.interactable = false;
            canvasGroup.blocksRaycasts = false;

            if (nextButton != null)
            {
                nextButton.gameObject.SetActive(false);
            }

            if (retryButton != null)
            {
                retryButton.gameObject.SetActive(false);
            }
        }
    }
}
