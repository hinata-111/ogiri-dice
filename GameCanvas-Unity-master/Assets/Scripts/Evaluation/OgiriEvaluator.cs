using System;
using System.Threading;
using System.Threading.Tasks;
using OgiriDice.Data;

namespace OgiriDice.Evaluation
{
    /// <summary>
    /// Gemini に送る「辛口放送作家」プロンプトを組み立て、IEvaluator を実装する予定のクラス。
    /// まずは Prompt を生成するヘルパーを提供します。
    /// </summary>
    public sealed class OgiriEvaluator : IEvaluator
    {
        private const string SystemPrompt =
            "あなたは辛口の放送作家です。提供された【お題】に対する【回答】を評価し、以下のJSONスキーマのみを返してください。マークダウン記法は不要です。\n" +
            "{ \"score\": 1~6の整数, \"comment\": \"短いツッコミ\" }";

        /// <summary>
        /// topic/answer から Gemini 用の contents.parts.text を整形する。
        /// System Prompt とユーザープロンプトを含む文字列を返します。
        /// </summary>
        public string PreparePrompt(Topic topic, string answer)
        {
            if (topic is null)
            {
                throw new ArgumentNullException(nameof(topic));
            }

            answer ??= string.Empty;
            return $"{SystemPrompt}\n\n【お題】{topic.Prompt}\n【回答】{answer}";
        }

        public Task<EvaluationResult> EvaluateAsync(string topic, string answer, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException("まだ実装されていません。");
        }
    }
}
