using System;
using System.Linq;
using UnityEngine;

namespace OgiriDice.Evaluation
{
    /// <summary>
    /// Gemini API の JSON レスポンスを <see cref="EvaluationResult"/> に変換します。
    /// </summary>
    public static class EvaluationResponseParser
    {
        private const string DefaultComment = "評価できませんでした";

        public static EvaluationResult Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new EvaluationResult(1, DefaultComment);
            }

            try
            {
                var response = JsonUtility.FromJson<EvaluationResponse>(json);
                var partText = response?.candidates?
                    .Select(c => c?.content)
                    .Where(c => c != null)
                    .SelectMany(c => c.parts ?? Array.Empty<ResponsePart>())
                    .FirstOrDefault()?.text;

                if (string.IsNullOrWhiteSpace(partText))
                {
                    return new EvaluationResult(1, DefaultComment);
                }

                var dto = JsonUtility.FromJson<EvaluationResultDto>(partText);
                if (dto == null)
                {
                    return new EvaluationResult(1, DefaultComment);
                }

                var score = Mathf.Clamp(dto.score, 1, 6);
                var comment = string.IsNullOrWhiteSpace(dto.comment) ? DefaultComment : dto.comment.Trim();
                return new EvaluationResult(score, comment);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"EvaluationResponseParser: failed to parse JSON ({ex.Message})");
                return new EvaluationResult(1, DefaultComment);
            }
        }

        [Serializable]
        private sealed class EvaluationResponse
        {
            public Candidate[] candidates;
        }

        [Serializable]
        private sealed class Candidate
        {
            public CandidateContent content;
        }

        [Serializable]
        private sealed class CandidateContent
        {
            public ResponsePart[] parts;
        }

        [Serializable]
        private sealed class ResponsePart
        {
            public string text;
        }

        [Serializable]
        private sealed class EvaluationResultDto
        {
            public int score;
            public string comment;
        }
    }
}
