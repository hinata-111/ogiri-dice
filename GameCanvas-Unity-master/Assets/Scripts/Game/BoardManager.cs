using System;
using System.Collections;
using UnityEngine;

namespace OgiriDice.Game
{
    public sealed class BoardManager : MonoBehaviour
    {
        [SerializeField] private float moveIntervalSeconds = 0.1f;

        public event Action<Player> OnMoveFinished = delegate { };

        private Board? board;

        public void SetBoard(Board sourceBoard)
        {
            board = sourceBoard;
        }

        public IEnumerator MovePlayerCoroutine(Player player, int steps)
        {
            if (player == null)
            {
                Debug.LogWarning("BoardManager: Player is null.");
                yield break;
            }

            if (board == null)
            {
                Debug.LogWarning("BoardManager: Board is not assigned.");
                OnMoveFinished?.Invoke(player);
                yield break;
            }

            if (steps <= 0)
            {
                OnMoveFinished?.Invoke(player);
                yield break;
            }

            for (var i = 0; i < steps; i++)
            {
                var nextIndex = player.Position + 1;
                if (!board.IsValidIndex(nextIndex))
                {
                    break;
                }

                player.MoveTo(nextIndex);
                yield return new WaitForSeconds(moveIntervalSeconds);
            }

            OnMoveFinished?.Invoke(player);
        }
    }
}
