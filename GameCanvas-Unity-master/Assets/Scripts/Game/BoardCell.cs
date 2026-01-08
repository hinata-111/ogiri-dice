namespace OgiriDice.Game
{
    public sealed class BoardCell
    {
        public string Id { get; }
        public int Index { get; }
        public CellType Type { get; }
        public string Label { get; }

        public BoardCell(string id, int index, CellType type, string label)
        {
            Id = id;
            Index = index;
            Type = type;
            Label = label;
        }
    }
}
