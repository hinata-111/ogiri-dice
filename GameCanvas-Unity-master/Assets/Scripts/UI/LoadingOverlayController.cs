using TMPro;
using UnityEngine;

namespace OgiriDice.UI
{
    public sealed class LoadingOverlayController : MonoBehaviour
    {
        [SerializeField] private CanvasGroup canvasGroup = null!;
        [SerializeField] private TMP_Text loadingText = null!;
        [SerializeField] private Animator animator = null!;

        private const string DefaultMessage = "評価中…しばらくお待ちください";
        private const string EvaluatingTrigger = "TriggerEvaluating";

        public void Show(string message = DefaultMessage)
        {
            if (canvasGroup != null)
            {
                canvasGroup.alpha = 1f;
                canvasGroup.interactable = true;
                canvasGroup.blocksRaycasts = true;
            }

            if (loadingText != null)
            {
                loadingText.text = message;
            }

            animator?.SetTrigger(EvaluatingTrigger);
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
        }
    }
}
