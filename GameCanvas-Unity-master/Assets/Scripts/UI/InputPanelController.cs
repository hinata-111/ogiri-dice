using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace OgiriDice.UI
{
    public sealed class InputPanelController : MonoBehaviour
    {
        [SerializeField] private CanvasGroup canvasGroup;
        [SerializeField] private TMP_InputField answerInput;
        [SerializeField] private Button submitButton;

        public event Action<string> OnSubmit;

        private void Awake()
        {
            if (submitButton != null)
            {
                submitButton.onClick.AddListener(HandleSubmit);
            }
        }

        private void OnDestroy()
        {
            if (submitButton != null)
            {
                submitButton.onClick.RemoveListener(HandleSubmit);
            }
        }

        private void HandleSubmit()
        {
            var answer = answerInput?.text?.Trim();
            if (string.IsNullOrWhiteSpace(answer))
            {
                return;
            }

            OnSubmit?.Invoke(answer);
        }

        public void Clear()
        {
            if (answerInput != null)
            {
                answerInput.text = string.Empty;
            }
        }

        public void SetInteractable(bool value)
        {
            if (canvasGroup != null)
            {
                canvasGroup.interactable = value;
                canvasGroup.blocksRaycasts = value;
            }

            if (submitButton != null)
            {
                submitButton.interactable = value;
            }
        }

        public void Activate(bool active)
        {
            if (canvasGroup == null)
            {
                return;
            }

            canvasGroup.alpha = active ? 1f : 0f;
            canvasGroup.interactable = active;
            canvasGroup.blocksRaycasts = active;
        }
    }
}
