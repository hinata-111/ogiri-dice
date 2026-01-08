using System;
using UnityEngine;

namespace OgiriDice.Game
{
    public sealed class CountdownTimer : MonoBehaviour
    {
        [SerializeField] private float durationSeconds = 15f;

        private float remainingSeconds;
        private bool isRunning;

        public event Action<float> OnTick = delegate { };
        public event Action OnTimeout = delegate { };

        public bool IsRunning => isRunning;
        public float RemainingSeconds => remainingSeconds;

        private void Awake()
        {
            ResetTimer();
        }

        private void Update()
        {
            if (!isRunning)
            {
                return;
            }

            remainingSeconds -= Time.deltaTime;
            if (remainingSeconds <= 0f)
            {
                remainingSeconds = 0f;
                isRunning = false;
                OnTick(remainingSeconds);
                OnTimeout();
                return;
            }

            OnTick(remainingSeconds);
        }

        public void StartTimer()
        {
            remainingSeconds = durationSeconds;
            isRunning = true;
            OnTick(remainingSeconds);
        }

        public void StopTimer()
        {
            isRunning = false;
        }

        public void ResetTimer()
        {
            remainingSeconds = durationSeconds;
            isRunning = false;
            OnTick(remainingSeconds);
        }
    }
}
