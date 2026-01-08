using System;
using System.Threading;
using System.Threading.Tasks;
using OgiriDice.Data;
using UnityEngine;

namespace OgiriDice.Evaluation
{
    /// <summary>
    /// Gemini に送る「辛口放送作家」プロンプトを組み立てる MonoBehaviour 評価器。
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class OgiriEvaluator : MonoBehaviour, IEvaluator
    {
        private const string SystemPrompt =
            "あなたは辛口の放送作家です。提供された【お題】に対する【回答】を評価し、以下のJSONスキーマのみを返してください。マークダウン記法は不要です。\n" +
            "{ \"score\": 1~6の整数, \"comment\": \"短いツッコミ\" }";

        [Header("Gemini Settings")]
        [SerializeField] private GeminiAPIManager geminiApiManager;
        [SerializeField] private string fallbackComment = EvaluationResult.FailureComment;

        private void Awake()
        {
            if (geminiApiManager == null)
            {
                Debug.LogWarning("OgiriEvaluator: GeminiAPIManager が未設定です。");
            }
        }

        public string PreparePrompt(string topicPrompt, string answer)
        {
            var safePrompt = string.IsNullOrWhiteSpace(topicPrompt) ? "（お題がありません）" : topicPrompt.Trim();
            answer ??= string.Empty;
            return $"{SystemPrompt}\n\n【お題】{safePrompt}\n【回答】{answer}";
        }

        public async Task<EvaluationResult> EvaluateAsync(string topic, string answer, CancellationToken cancellationToken = default)
        {
            if (geminiApiManager == null)
            {
                Debug.LogWarning("OgiriEvaluator: GeminiAPIManager が割り当てられていないためデフォルト結果を返します。");
                return new EvaluationResult(1, fallbackComment);
            }

            var prompt = PreparePrompt(topic, answer);
            try
            {
                var json = await geminiApiManager.GenerateAsync(prompt, cancellationToken);
                return EvaluationResponseParser.Parse(json);
            }
            catch (OperationCanceledException)
            {
                Debug.LogWarning("OgiriEvaluator: 評価をキャンセルしました。");
                throw;
            }
            catch (Exception ex)
            {
                Debug.LogError($"OgiriEvaluator: 評価に失敗しました ({ex.Message})。");
                return new EvaluationResult(1, fallbackComment);
            }
        }
    }
}
