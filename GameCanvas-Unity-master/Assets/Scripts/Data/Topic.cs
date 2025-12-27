using System;
using UnityEngine;

namespace OgiriDice.Data
{
    /// <summary>
    /// お題1件を保持する DTO。ScriptableObject と JSON 両方で使えるように Serializable として定義。
    /// </summary>
    [Serializable]
    public sealed class Topic
    {
        [SerializeField] private string id;
        [SerializeField] private string category;
        [SerializeField] private string prompt;
        [SerializeField] private TopicDifficulty difficulty = TopicDifficulty.Normal;

        public string Id => id ?? string.Empty;
        public string Category => category ?? string.Empty;
        public string Prompt => prompt ?? string.Empty;
        public TopicDifficulty Difficulty => difficulty;
    }

    /// <summary>
    /// 難易度を3段階で表現するための列挙型。UI のフィルターやターゲット選定に使える。
    /// </summary>
    public enum TopicDifficulty
    {
        Easy,
        Normal,
        Hard
    }

    /// <summary>
    /// JsonUtility で読み込む際のルートオブジェクト。topics 配列を含める構造に合わせる。
    /// </summary>
    [Serializable]
    public sealed class TopicContainer
    {
        public Topic[] topics = Array.Empty<Topic>();
    }
}
