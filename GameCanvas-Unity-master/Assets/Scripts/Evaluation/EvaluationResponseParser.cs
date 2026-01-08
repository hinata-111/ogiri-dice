using System;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace OgiriDice.Evaluation
{
    /// <summary>
    /// Gemini API の JSON レスポンスを <see cref="EvaluationResult"/> に変換します。
    /// </summary>
    public static class EvaluationResponseParser
    {
        private const string DefaultComment = EvaluationResult.FailureComment;

        public static EvaluationResult Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new EvaluationResult(1, DefaultComment);
            }

            try
            {
                var partText = ExtractCandidateText(json);
                if (string.IsNullOrWhiteSpace(partText))
                {
                    return new EvaluationResult(1, DefaultComment);
                }

                var dto = JsonConvert.DeserializeObject<EvaluationResultDto>(partText);
                if (dto == null)
                {
                    return new EvaluationResult(1, DefaultComment);
                }

                var score = Mathf.Clamp(dto.Score, 1, 6);
                var comment = string.IsNullOrWhiteSpace(dto.Comment) ? DefaultComment : dto.Comment.Trim();
                return new EvaluationResult(score, comment);
            }
            catch (JsonException ex)
            {
                Debug.LogWarning($"EvaluationResponseParser: JSON parsing failed ({ex.Message})");
                return new EvaluationResult(1, DefaultComment);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"EvaluationResponseParser: unexpected error ({ex.Message})");
                return new EvaluationResult(1, DefaultComment);
            }
        }

        private static string? ExtractCandidateText(string json)
        {
            var document = JObject.Parse(json);
            var candidates = document["candidates"] as JArray;
            var firstContent = candidates?
                .First?
                ["content"]?["parts"] as JArray;

            if (firstContent == null || firstContent.Count == 0)
            {
                return null;
            }

            return firstContent[0]?["text"]?.ToString();
        }

        private sealed class EvaluationResultDto
        {
            [JsonProperty("score")]
            public int Score { get; set; }

            [JsonProperty("comment")]
            public string? Comment { get; set; }
        }
    }
}
