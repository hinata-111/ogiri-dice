using System;
using System.Collections.Generic;
using UnityEngine;

namespace OgiriDice.Game
{
    public sealed class TurnManager
    {
        private readonly List<Player> players = new List<Player>();
        private int currentPlayerIndex;

        public Player? CurrentPlayer => players.Count == 0 ? null : players[currentPlayerIndex];

        public event Action<Player> OnTurnChanged = delegate { };

        public void Initialize(List<Player> playerList)
        {
            players.Clear();
            if (playerList != null)
            {
                players.AddRange(playerList);
            }

            currentPlayerIndex = 0;
            if (players.Count == 0)
            {
                Debug.LogWarning("TurnManager: Player list is empty.");
                return;
            }

            LogTurn();
            var current = CurrentPlayer;
            if (current != null)
            {
                OnTurnChanged(current);
            }
        }

        public void NextTurn()
        {
            if (players.Count == 0)
            {
                Debug.LogWarning("TurnManager: Player list is empty.");
                return;
            }

            currentPlayerIndex++;
            if (currentPlayerIndex >= players.Count)
            {
                currentPlayerIndex = 0;
            }

            LogTurn();
            var current = CurrentPlayer;
            if (current != null)
            {
                OnTurnChanged(current);
            }
        }

        private void LogTurn()
        {
            Debug.Log($"TurnManager: Player{currentPlayerIndex + 1}のターン");
        }
    }
}
