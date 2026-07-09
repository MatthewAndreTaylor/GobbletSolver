"""Performance benchmarks for the base Gobblet engine."""

from __future__ import annotations

from timeit import timeit

from base.main import select_move_alphabeta
from base.shared import GameConfig, Player

# do the same for bitboards




def build_empty_game() -> GameConfig:
    board = [[[-1], [-1], [-1]], [[-1], [-1], [-1]], [[-1], [-1], [-1]]]
    player1 = Player(frozenset([0, 1, 2, 3, 4, 5]))
    player2 = Player(frozenset([6, 7, 8, 9, 10, 11]))
    return GameConfig(board, [player1, player2])


def benchmark(label: str, callable_, number: int) -> None:
    elapsed = timeit(callable_, number=number)
    per_call_ms = (elapsed / number) * 1000
    print(f"{label}: {per_call_ms:.4f} ms/call over {number} runs")


def main() -> None:
    game = build_empty_game()
    benchmark("select_move_alphabeta(empty board, depth 5)", lambda: select_move_alphabeta(game, 0, 5), 1)


if __name__ == "__main__":
    main()