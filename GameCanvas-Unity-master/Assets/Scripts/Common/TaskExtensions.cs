using System;
using System.Threading.Tasks;
using UnityEngine;

namespace OgiriDice
{
    internal static class TaskExtensions
    {
        public static async void Forget(this Task task)
        {
            try
            {
                await task.ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Debug.LogException(ex);
            }
        }
    }
}
