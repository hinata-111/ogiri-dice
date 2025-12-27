using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace OgiriDice.Evaluation
{
    [CreateAssetMenu(menuName = "Ogiri Dice/Gemini API Manager")]
    public sealed class GeminiAPIManager : ScriptableObject
    {
        [Header("Credentials")]
        [SerializeField] private string apiKey;

        [Header("Models")]
        [SerializeField] private string primaryModel = "gemini-1.5-pro";
        [SerializeField] private string fallbackModel = "gemini-1.5-flash";

        [Header("Generation settings")]
        [SerializeField] private string responseMimeType = "application/json";

        private const string EndpointTemplate = "https://generativelanguage.googleapis.com/v1beta/models/{0}:generateContent?key={1}";

        public async Task<string> GenerateAsync(string prompt, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("GeminiAPIManager: API Key is not configured.");
            }

            if (string.IsNullOrWhiteSpace(prompt))
            {
                throw new ArgumentException("Prompt cannot be empty.", nameof(prompt));
            }

            var primary = await SendRequestAsync(prompt, primaryModel, cancellationToken);
            if (primary.Success)
            {
                return primary.Body;
            }

            if (primary.IsRateLimited && !string.Equals(primaryModel, fallbackModel, StringComparison.OrdinalIgnoreCase))
            {
                var fallback = await SendRequestAsync(prompt, fallbackModel, cancellationToken);
                if (fallback.Success)
                {
                    Debug.Log("GeminiAPIManager: Fallback model succeeded.");
                    return fallback.Body;
                }

                Debug.LogWarning($"GeminiAPIManager: Both primary and fallback failed. Primary error: {primary.ErrorMessage}, fallback error: {fallback.ErrorMessage}");
                throw new InvalidOperationException($"GeminiAPIManager: fallback failed ({fallback.ErrorMessage}).");
            }

            Debug.LogWarning($"GeminiAPIManager: Primary model failed: {primary.ErrorMessage}");
            throw new InvalidOperationException($"GeminiAPIManager: primary model failed ({primary.ErrorMessage}).");
        }

        private async Task<RequestResult> SendRequestAsync(string prompt, string model, CancellationToken cancellationToken)
        {
            var url = string.Format(EndpointTemplate, model, apiKey);
            var payload = BuildPayload(prompt);
            var json = JsonUtility.ToJson(payload);
            using var request = new UnityWebRequest(url, "POST");
            var bodyRaw = Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            var operation = request.SendWebRequest();

            while (!operation.isDone)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    request.Abort();
                    cancellationToken.ThrowIfCancellationRequested();
                }

                await Task.Yield();
            }

            var responseText = request.downloadHandler?.text ?? string.Empty;
            var success = request.result == UnityWebRequest.Result.Success;
            var rateLimited = !success && (request.responseCode == 429 || LooksLikeRateLimit(responseText));
            var error = success ? string.Empty : request.error ?? $"HTTP {request.responseCode}";

            Debug.Log($"GeminiAPIManager: {model} -> success={success}, rateLimit={rateLimited}, responseCode={request.responseCode}");
            return new RequestResult(success, rateLimited, responseText, model, error);
        }

        private RequestPayload BuildPayload(string prompt)
        {
            return new RequestPayload
            {
                contents = new[]
                {
                    new RequestContent
                    {
                        parts = new[]
                        {
                            new RequestPart { text = prompt }
                        }
                    }
                },
                generationConfig = new GenerationConfig
                {
                    responseMimeType = responseMimeType
                }
            };
        }

        private static bool LooksLikeRateLimit(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            var lowered = text.ToLowerInvariant();
            return lowered.Contains("quotaexceeded") ||
                   lowered.Contains("resource_exhausted") ||
                   lowered.Contains("limitexceeded");
        }

        [Serializable]
        private sealed class RequestPayload
        {
            public RequestContent[] contents;
            public GenerationConfig generationConfig;
        }

        [Serializable]
        private sealed class RequestContent
        {
            public RequestPart[] parts;
        }

        [Serializable]
        private sealed class RequestPart
        {
            public string text;
        }

        [Serializable]
        private sealed class GenerationConfig
        {
            public string responseMimeType;
        }

        private readonly struct RequestResult
        {
            public RequestResult(bool success, bool isRateLimited, string body, string model, string errorMessage)
            {
                Success = success;
                IsRateLimited = isRateLimited;
                Body = body;
                Model = model;
                ErrorMessage = errorMessage;
            }

            public bool Success { get; }
            public bool IsRateLimited { get; }
            public string Body { get; }
            public string Model { get; }
            public string ErrorMessage { get; }
        }
    }
}
