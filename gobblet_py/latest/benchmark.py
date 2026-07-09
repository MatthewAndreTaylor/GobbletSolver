"""Performance benchmarks for the base Gobblet engine."""

from __future__ import annotations

from timeit import timeit

from main import select_move_alphabeta
from shared import GameConfig



def build_empty_game() -> GameConfig:
    return GameConfig(
            0, 0, 0,  
            0, 0, 0,  
            (2, 2, 2), (2, 2, 2)
        )


def benchmark(label: str, callable_, number: int) -> None:
    elapsed = timeit(callable_, number=number)
    per_call_ms = (elapsed / number) * 1000
    print(f"{label}: {per_call_ms:.4f} ms/call over {number} runs")


def main() -> None:
    game = build_empty_game()
    benchmark("select_move_alphabeta(empty board, depth 6)", lambda: select_move_alphabeta(game, 0, 6), 1)


if __name__ == "__main__":
    main()