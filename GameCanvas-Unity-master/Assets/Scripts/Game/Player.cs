using UnityEngine;

namespace OgiriDice.Game
{
    public sealed class Player
    {
        public const int InitialMoney = 10000;

        public string Name { get; }
        public int Position { get; private set; }
        public int Money { get; private set; }

        public Player(int startPosition = 0, int initialMoney = InitialMoney)
        {
            Name = "Player";
            Position = startPosition;
            Money = initialMoney;
        }

        public Player(string name, int startPosition = 0, int initialMoney = InitialMoney)
        {
            Name = string.IsNullOrWhiteSpace(name) ? "Player" : name;
            Position = startPosition;
            Money = initialMoney;
        }

        public void MoveTo(int newPosition)
        {
            Position = newPosition;
        }

        public void AddMoney(int delta)
        {
            Money += delta;
        }

        public void LogStatus(string label = "")
        {
            var displayLabel = string.IsNullOrWhiteSpace(label) ? Name : label;
            Debug.Log($"{displayLabel}: position={Position}, money={Money}");
        }
    }
}
