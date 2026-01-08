using System;

namespace OgiriDice.Game
{
    public sealed class Board
    {
        private readonly BoardCell[] cells;

        public BoardCell[] Cells => cells;
        public int CellCount => cells.Length;

        public Board(BoardCell[] sourceCells)
        {
            cells = sourceCells ?? Array.Empty<BoardCell>();
        }

        public bool IsValidIndex(int index)
        {
            return index >= 0 && index < cells.Length;
        }

        public bool TryGetCell(int index, out BoardCell? cell)
        {
            if (IsValidIndex(index))
            {
                cell = cells[index];
                return true;
            }

            cell = null;
            return false;
        }
    }
}
