"""Performance benchmarks for the current Gobblet engine."""

from __future__ import annotations

from timeit import timeit

from shared import GameConfig, INITIAL_UNUSED, select_move_alphabeta



def build_empty_game() -> GameConfig:
    return GameConfig(
            0, 0, 0,  
            0, 0, 0,  
            INITIAL_UNUSED
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
