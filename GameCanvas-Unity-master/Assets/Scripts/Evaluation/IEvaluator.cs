using System;
using System.Threading;
using System.Threading.Tasks;

namespace OgiriDice.Evaluation
{
    /// <summary>
    /// 評価結果（Gemini から受け取る JSON の score/comment に相当）。
    /// </summary>
    public sealed class EvaluationResult
    {
        public const string FailureComment = "評価失敗";

        public int Score { get; }
        public string Comment { get; }

        public EvaluationResult(int score, string comment)
        {
            Score = Math.Clamp(score, 1, 6);
            Comment = comment ?? string.Empty;
        }
    }

    /// <summary>
    /// 入力されたお題と回答を評価して <see cref="EvaluationResult"/> を返す契約。
    /// </summary>
    public interface IEvaluator
    {
        Task<EvaluationResult> EvaluateAsync(string topic, string answer, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// 本番用（Gemini + OgiriEvaluator）の実装を差し込むためのプレースホルダー。
    /// GameManager/TODO はコンストラクタやフィールドでプレーンな IEvaluator を受け取る。
    /// </summary>
    public sealed class MockEvaluator : IEvaluator
    {
        private readonly Func<string, string, EvaluationResult> _factory;

        public MockEvaluator(Func<string, string, EvaluationResult> factory)
        {
            _factory = factory ?? ((t, a) => new EvaluationResult(1, "まだコメントがありません"));
        }

        public Task<EvaluationResult> EvaluateAsync(string topic, string answer, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_factory(topic, answer));
        }
    }
}
