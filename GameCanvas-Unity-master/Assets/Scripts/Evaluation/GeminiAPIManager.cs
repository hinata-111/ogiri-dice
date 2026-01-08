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
        private const string EnvKeyName = "OGIRI_GEMINI_KEY";

        public async Task<string> GenerateAsync(string prompt, CancellationToken cancellationToken = default)
        {
            var effectiveKey = ResolveApiKey();
            if (string.IsNullOrWhiteSpace(effectiveKey))
            {
                throw new InvalidOperationException("GeminiAPIManager: API Key is not configured.");
            }

            if (string.IsNullOrWhiteSpace(prompt))
            {
                throw new ArgumentException("Prompt cannot be empty.", nameof(prompt));
            }

            var primary = await SendRequestAsync(prompt, primaryModel, effectiveKey, cancellationToken);
            if (primary.Success)
            {
                Debug.Log($"GeminiAPIManager: primary ({primaryModel}) succeeded.");
                return primary.Body;
            }

            if (primary.IsRateLimited && !string.Equals(primaryModel, fallbackModel, StringComparison.OrdinalIgnoreCase))
            {
                Debug.Log($"GeminiAPIManager: primary rate-limited, trying fallback ({fallbackModel}).");
                var fallback = await SendRequestAsync(prompt, fallbackModel, effectiveKey, cancellationToken);
                if (fallback.Success)
                {
                    Debug.Log("GeminiAPIManager: fallback succeeded.");
                    return fallback.Body;
                }

                Debug.LogWarning($"GeminiAPIManager: Both primary and fallback failed. Primary error: {primary.ErrorMessage}, fallback error: {fallback.ErrorMessage}");
                throw new InvalidOperationException($"GeminiAPIManager: fallback failed ({fallback.ErrorMessage}).");
            }

            Debug.LogWarning($"GeminiAPIManager: Primary model failed: {primary.ErrorMessage}");
            throw new InvalidOperationException($"GeminiAPIManager: primary model failed ({primary.ErrorMessage}).");
        }

        private async Task<RequestResult> SendRequestAsync(string prompt, string model, string key, CancellationToken cancellationToken)
        {
            var url = string.Format(EndpointTemplate, model, key);
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

            Debug.Log($"GeminiAPIManager: {model} -> success={success}, rateLimit={rateLimited}, responseCode={request.responseCode}, error={error}, body={Summarize(responseText)}");
            return new RequestResult(success, rateLimited, responseText, model, error, request.responseCode);
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

        private string ResolveApiKey()
        {
            var envKey = Environment.GetEnvironmentVariable(EnvKeyName);
            if (!string.IsNullOrWhiteSpace(envKey))
            {
                Debug.Log("GeminiAPIManager: OGIRI_GEMINI_KEY detected; using environment variable value.");
                return envKey;
            }

            return apiKey;
        }

        private static string Summarize(string text, int maxLength = 400)
        {
            if (string.IsNullOrEmpty(text))
            {
                return string.Empty;
            }

            if (text.Length <= maxLength)
            {
                return text;
            }

            return text.Substring(0, maxLength) + "...";
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
            public RequestResult(bool success, bool isRateLimited, string body, string model, string errorMessage, long responseCode)
            {
                Success = success;
                IsRateLimited = isRateLimited;
                Body = body;
                Model = model;
                ErrorMessage = errorMessage;
                ResponseCode = responseCode;
            }

            public bool Success { get; }
            public bool IsRateLimited { get; }
            public string Body { get; }
            public string Model { get; }
            public string ErrorMessage { get; }
            public long ResponseCode { get; }
        }
    }
}
