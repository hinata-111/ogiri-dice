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
        [SerializeField] private GameManager gameManager = null!;

        [Header("Topic Display")]
        [SerializeField] private TMP_Text topicText = null!;
        [SerializeField] private TMP_Text categoryText = null!;
        [SerializeField] private TMP_Text difficultyText = null!;

        [Header("Status Message")]
        [SerializeField] private TMP_Text statusMessage = null!;

        [Header("Player Status")]
        [SerializeField] private TMP_Text? playerStatusText;

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
            gameManager.OnPlayerUpdated += UpdatePlayerStatus;
            UpdateTopicDisplay(gameManager.CurrentTopic);
            UpdateStatus(gameManager.CurrentState);
            if (gameManager.CurrentPlayer != null)
            {
                UpdatePlayerStatus(gameManager.CurrentPlayer);
            }
        }

        private void OnDisable()
        {
            if (gameManager == null)
            {
                return;
            }

            gameManager.OnTopicChanged -= UpdateTopicDisplay;
            gameManager.OnStateChanged -= UpdateStatus;
            gameManager.OnPlayerUpdated -= UpdatePlayerStatus;
        }

        private void UpdateTopicDisplay(Topic? topic)
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

        private void UpdatePlayerStatus(Player player)
        {
            if (playerStatusText == null)
            {
                return;
            }

            playerStatusText.text = $"{player.Name}: {player.Money}円";
        }
    }
}
