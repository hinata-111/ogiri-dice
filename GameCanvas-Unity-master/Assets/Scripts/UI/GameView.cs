using OgiriDice.Data;
using OgiriDice.Game;
using TMPro;
using UnityEngine;

namespace OgiriDice.UI
{
    /// <summary>
    /// Canvas に置いて GameManager の状態とトピックを表示する UI コントローラ。
    /// </summary>
    public class GameView : MonoBehaviour
    {
        [Header("Controller")]
        [SerializeField] private GameManager gameManager;

        [Header("Topic Display")]
        [SerializeField] private TMP_Text topicText;
        [SerializeField] private TMP_Text categoryText;
        [SerializeField] private TMP_Text difficultyText;

        [Header("Status Message")]
        [SerializeField] private TMP_Text statusMessage;

        private void Awake()
        {
            if (gameManager == null)
            {
                Debug.LogError("GameView: GameManager が割り当てられていません。");
            }
        }

        private void OnEnable()
        {
            if (gameManager == null)
            {
                return;
            }

            gameManager.OnTopicChanged += UpdateTopicDisplay;
            gameManager.OnStateChanged += UpdateStatus;
            UpdateTopicDisplay(gameManager.CurrentTopic);
            UpdateStatus(gameManager.CurrentState);
        }

        private void OnDisable()
        {
            if (gameManager == null)
            {
                return;
            }

            gameManager.OnTopicChanged -= UpdateTopicDisplay;
            gameManager.OnStateChanged -= UpdateStatus;
        }

        private void UpdateTopicDisplay(Topic topic)
        {
            topicText.text = topic?.Prompt ?? "お題を取得しています…";
            categoryText.text = topic?.Category ?? "-";
            difficultyText.text = topic?.Difficulty.ToString() ?? "-";
        }

        private void UpdateStatus(GameState state)
        {
            if (statusMessage == null)
            {
                return;
            }

            statusMessage.text = state switch
            {
                GameState.AwaitingInput => "回答を入力してください",
                GameState.Evaluating => "評価中…しばらくお待ちください",
                GameState.ShowingResult => "結果を確認して次へ",
                _ => string.Empty
            };
        }
    }
}
