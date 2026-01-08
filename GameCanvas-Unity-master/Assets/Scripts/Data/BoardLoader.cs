using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;
using OgiriDice.Game;

namespace OgiriDice.Data
{
    /// <summary>
    /// Board の JSON を読み込み、DTO と BoardCell 配列へ変換するローダー。
    /// </summary>
    public sealed class BoardLoader
    {
        /// <summary>
        /// StreamingAssets に置いた JSON から BoardData を読み込む。
        /// モバイル/WebGL は非同期版を使う。
        /// </summary>
        public static BoardData LoadDataFromStreamingAssets(string relativeFileName)
        {
            var path = Path.Combine(Application.streamingAssetsPath, relativeFileName);
            if (IsStreamingAssetWebPath(path))
            {
                Debug.LogWarning("BoardLoader: StreamingAssets is a web path. Use LoadDataFromStreamingAssetsAsync instead.");
                return BoardData.Empty;
            }

            if (!File.Exists(path))
            {
                Debug.LogWarning("BoardLoader: JSON data file not found: " + path);
                return BoardData.Empty;
            }

            var payload = File.ReadAllText(path);
            return FromJson(payload);
        }

        /// <summary>
        /// StreamingAssets から非同期で読み込み、完了時にコールバックを呼ぶ。
        /// </summary>
        public static IEnumerator LoadDataFromStreamingAssetsAsync(string relativeFileName, Action<BoardData> onCompleted)
        {
            if (string.IsNullOrWhiteSpace(relativeFileName))
            {
                Debug.LogWarning("BoardLoader: Relative file name is empty.");
                onCompleted?.Invoke(BoardData.Empty);
                yield break;
            }

            var path = Path.Combine(Application.streamingAssetsPath, relativeFileName);
            if (IsStreamingAssetWebPath(path))
            {
                using (var request = UnityWebRequest.Get(path))
                {
                    yield return request.SendWebRequest();
                    if (request.result != UnityWebRequest.Result.Success)
                    {
                        Debug.LogWarning("BoardLoader: JSON download failed. " + request.error);
                        onCompleted?.Invoke(BoardData.Empty);
                        yield break;
                    }

                    onCompleted?.Invoke(FromJson(request.downloadHandler.text));
                    yield break;
                }
            }

            if (!File.Exists(path))
            {
                Debug.LogWarning("BoardLoader: JSON data file not found: " + path);
                onCompleted?.Invoke(BoardData.Empty);
                yield break;
            }

            var payload = File.ReadAllText(path);
            onCompleted?.Invoke(FromJson(payload));
        }

        public static BoardData FromJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                Debug.LogWarning("BoardLoader: JSON payload is empty.");
                return BoardData.Empty;
            }

            try
            {
                var container = JsonUtility.FromJson<BoardData>(json);
                return BoardData.NormalizeOrEmpty(container);
            }
            catch (Exception ex)
            {
                Debug.LogWarning("BoardLoader: JSON parse failed. " + ex.Message);
                return BoardData.Empty;
            }
        }

        public static BoardCell[] ToBoardCells(BoardData data)
        {
            if (data == null || data.cells == null || data.cells.Length == 0)
            {
                return Array.Empty<BoardCell>();
            }

            var cells = new BoardCell[data.cells.Length];
            for (var i = 0; i < data.cells.Length; i++)
            {
                var source = data.cells[i];
                var cellType = ParseCellType(source?.type);
                cells[i] = new BoardCell(source?.id ?? string.Empty, source?.index ?? i, cellType, source?.label ?? string.Empty);
            }

            return cells;
        }

        private static CellType ParseCellType(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return CellType.Normal;
            }

            if (Enum.TryParse(raw, true, out CellType result))
            {
                return result;
            }

            return CellType.Normal;
        }

        private static bool IsStreamingAssetWebPath(string path)
        {
            return path.Contains("://");
        }
    }

    [Serializable]
    public sealed class BoardData
    {
        public CellData[] cells = Array.Empty<CellData>();
        public EdgeData[] edges = Array.Empty<EdgeData>();
        public string startCellId = string.Empty;
        public string goalCellId = string.Empty;
        public string[] goalCandidates = Array.Empty<string>();

        public static BoardData Empty => new BoardData
        {
            cells = Array.Empty<CellData>(),
            edges = Array.Empty<EdgeData>(),
            goalCandidates = Array.Empty<string>(),
            startCellId = string.Empty,
            goalCellId = string.Empty
        };

        public static BoardData NormalizeOrEmpty(BoardData data)
        {
            if (data == null)
            {
                return Empty;
            }

            data.cells ??= Array.Empty<CellData>();
            data.edges ??= Array.Empty<EdgeData>();
            data.goalCandidates ??= Array.Empty<string>();
            data.startCellId ??= string.Empty;
            data.goalCellId ??= string.Empty;
            return data;
        }
    }

    [Serializable]
    public sealed class CellData
    {
        public string id = string.Empty;
        public int index;
        public string type = string.Empty;
        public string label = string.Empty;
    }

    [Serializable]
    public sealed class EdgeData
    {
        public string from = string.Empty;
        public string[] to = Array.Empty<string>();
    }
}
