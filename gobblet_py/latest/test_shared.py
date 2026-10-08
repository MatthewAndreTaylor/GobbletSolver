"""Run with: python -m unittest discover -s gobblet_py/latest -v."""

import random
import unittest
from unittest.mock import patch

import shared
from shared import (
    DRAW_SCORE, GameConfig, INITIAL_UNUSED, Move, REPETITION_LIMIT, WIN_SCORE,
    advance_history, get_control, get_possible_moves, get_score, get_top_piece,
    get_unused, get_winner, is_repetition_draw, negamax, play_move, position_key,
    select_move_alphabeta,
)


def position(*boards):
    unused = sum((2 - board.bit_count()) << (index * 2)
                 for index, board in enumerate(boards))
    return GameConfig(*boards, unused)


def swap_players(game):
    unused = ((game.unused & 63) << 6) | (game.unused >> 6)
    last_player = None if game.last_player is None else 1 - game.last_player
    return GameConfig(game.p1_s, game.p1_m, game.p1_l,
                      game.p0_s, game.p0_m, game.p0_l, unused, last_player)


def minimax(game, player, depth, history=()):
    """Small exhaustive oracle without pruning, negamax, or a cache."""
    def visit(board, current, remaining, seen):
        winner = get_winner(board)
        if winner is not None:
            if winner == -1:
                return DRAW_SCORE
            value = WIN_SCORE + remaining
            return value if winner == player else -value
        if is_repetition_draw(seen):
            return DRAW_SCORE
        if remaining == 0:
            return get_score(board, player)
        values = []
        for move in get_possible_moves(board, current):
            child = play_move(board, current, move)
            values.append(visit(child, 1 - current, remaining - 1,
                                advance_history(seen, child, 1 - current, move)))
        if not values:
            return DRAW_SCORE
        return (max if current == player else min)(values)

    seen = list(history)
    if not seen or seen[-1] != position_key(game, player):
        seen.append(position_key(game, player))
    return visit(game, player, depth, seen)


class RulesTests(unittest.TestCase):
    def test_repetition_identity_includes_covered_pieces_reserves_and_side(self):
        game = position(1, 0, 0, 0, 0, 1)
        key = position_key(game, 0)
        self.assertNotEqual(key, position_key(game, 1))
        self.assertNotEqual(key, position_key(game._replace(p0_s=0), 0))
        self.assertNotEqual(key, position_key(game._replace(unused=0), 0))
        self.assertEqual(key, position_key(game._replace(last_player=1), 0))

    def test_only_the_fourth_occurrence_of_a_legal_cycle_is_a_draw(self):
        game = position(0, 0, 1, 0, 0, 256)
        history = [position_key(game, 0)]
        cycle = (Move(2, 0, 1), Move(2, 8, 7), Move(2, 1, 0), Move(2, 7, 8))
        for turn in range(12):
            player, move = turn % 2, cycle[turn % 4]
            self.assertIn(move, get_possible_moves(game, player))
            game = play_move(game, player, move)
            history = advance_history(history, game, 1 - player, move)
            self.assertEqual(is_repetition_draw(history), turn == 11)
        self.assertEqual(history.count(history[-1]), REPETITION_LIMIT)

    def test_reserve_placement_resets_history_without_mutating_the_caller(self):
        game = position(0, 0, 1, 0, 0, 256)
        history = [position_key(game, 0)] * 3
        before = history[:]
        move = Move(0, None, 4)
        child = play_move(game, 0, move)
        self.assertEqual(advance_history(history, child, 1, move),
                         [position_key(child, 1)])
        self.assertEqual(history, before)

    def test_covering_hides_piece_and_moving_reveals_it(self):
        game = position(1, 0, 0, 0, 0, 1)
        self.assertEqual(get_top_piece(game, 0), (1, 2))
        self.assertEqual(get_control(game, 0), 0)
        self.assertFalse(any(move.start_sq == 0 for move in get_possible_moves(game, 0)))
        moved = play_move(game, 1, Move(2, 0, 4))
        self.assertEqual(get_top_piece(moved, 0), (0, 0))
        self.assertEqual(get_top_piece(moved, 4), (1, 2))
        self.assertEqual(moved.unused, game.unused)
        self.assertEqual(moved.last_player, 1)

    def test_placement_only_consumes_the_placed_size(self):
        game = GameConfig(0, 0, 0, 0, 0, 0, INITIAL_UNUSED)
        moved = play_move(game, 1, Move(1, None, 4))
        for player in range(2):
            for size in range(3):
                self.assertEqual(get_unused(moved.unused, player, size),
                                 1 if (player, size) == (1, 1) else 2)
        self.assertEqual(game.unused, INITIAL_UNUSED)

    def test_simultaneous_lines_lose_for_mover_for_either_color(self):
        game = position(3, 4, 0, 24, 0, 4)
        for board, mover in ((game, 1), (swap_players(game), 0)):
            with self.subTest(mover=mover):
                self.assertIsNone(get_winner(board))
                move = Move(2, 2, 5)
                self.assertIn(move, get_possible_moves(board, mover))
                moved = play_move(board, mover, move)
                self.assertEqual(get_winner(moved), 1 - mover)
                self.assertEqual(get_possible_moves(moved, 0), [])
                self.assertEqual(get_possible_moves(moved, 1), [])
                self.assertEqual(get_score(moved, mover), -WIN_SCORE)

    def test_revealing_line_is_allowed_if_destination_breaks_it(self):
        game = position(3, 4, 0, 72, 0, 4)
        for board, mover in ((game, 1), (swap_players(game), 0)):
            with self.subTest(mover=mover):
                self.assertIsNone(get_winner(board))
                moved = play_move(board, mover, Move(2, 2, 0))
                self.assertEqual(get_winner(moved), mover)


class SearchTests(unittest.TestCase):
    def test_fourfold_draw_is_terminal_before_cutoff_but_after_a_win(self):
        game = position(0, 0, 1, 0, 0, 256)
        won = play_move(position(3, 0, 0, 24, 0, 0), 0, Move(1, None, 2))
        for board, player in ((game, 0), (swap_players(game), 1)):
            key = position_key(board, player)
            self.assertEqual(select_move_alphabeta(board, player, 0, history=[key] * 3),
                             (get_score(board, player), None))
            for depth in (0, 3):
                self.assertEqual(select_move_alphabeta(
                    board, player, depth, time_limit=0, history=[key] * 4),
                    (DRAW_SCORE, None))
            win_board = won if player == 0 else swap_players(won)
            self.assertEqual(select_move_alphabeta(
                win_board, player, 0, history=[position_key(win_board, player)] * 4),
                (WIN_SCORE, None))

    def test_seek_fourfold_draw_over_an_unresolved_position_for_both_colors(self):
        game = position(0, 0, 1, 0, 0, 256)
        cycle = (Move(2, 0, 1), Move(2, 8, 7), Move(2, 1, 0), Move(2, 7, 8))
        drawing_move = Move(2, 7, 8)
        for board, player in ((game, 0), (swap_players(game), 1)):
            history = [position_key(board, player)]
            for turn in range(11):
                move = cycle[turn % 4]
                board = play_move(board, player, move)
                player = 1 - player
                history = advance_history(history, board, player, move)
            before = history[:]
            self.assertEqual(select_move_alphabeta(board, player, 2, history=history),
                             (DRAW_SCORE, drawing_move))
            self.assertEqual(history, before)

    def test_seek_fourfold_draw_instead_of_an_unavoidable_loss_for_both_colors(self):
        game = GameConfig(0, 257, 68, 0, 68, 272, 130, 0)
        drawing_move = Move(2, 4, 0)
        for board, player in ((game, 1), (swap_players(game), 0)):
            self.assertEqual(minimax(board, player, 2), -WIN_SCORE)
            child = play_move(board, player, drawing_move)
            history = [position_key(child, 1 - player)] * 3 + [position_key(board, player)]
            self.assertEqual(select_move_alphabeta(board, player, 2, history=history),
                             (DRAW_SCORE, drawing_move))

    def test_iterative_search_keeps_looking_for_a_win_after_finding_a_draw(self):
        game = GameConfig(272, 256, 2, 0, 32, 192, 404, 0)
        drawing_move = Move(1, 5, 0)
        for board, player in ((game, 1), (swap_players(game), 0)):
            child = play_move(board, player, drawing_move)
            history = [position_key(child, 1 - player)] * 3 + [position_key(board, player)]
            self.assertEqual(select_move_alphabeta(board, player, 1, history=history),
                             (DRAW_SCORE, drawing_move))
            with patch("shared.perf_counter", return_value=0):
                score, move = select_move_alphabeta(
                    board, player, 3, time_limit=1, history=history)
            self.assertGreaterEqual(score, WIN_SCORE)
            self.assertNotEqual(move, drawing_move)

    def test_cache_distinguishes_repetition_histories_with_the_same_current_count(self):
        game = position(0, 0, 1, 0, 0, 128)
        for board, player in ((game, 1), (swap_players(game), 0)):
            table = {}
            child = play_move(board, player, Move(2, 7, 8))
            histories = ([position_key(board, player)],
                         [position_key(child, 1 - player)] * 3 + [position_key(board, player)])
            for history in (*histories, histories[0]):
                score, _ = negamax(board, player, -float("inf"), float("inf"),
                                   2, table, history=history)
                self.assertEqual(score, minimax(board, player, 2, history))
                self.assertEqual(score == DRAW_SCORE, len(history) == 4)

    def test_evaluation_is_antisymmetric_at_every_leaf(self):
        game = position(3, 0, 0, 0, 0, 16)
        self.assertEqual(get_score(game, 0), 100)
        self.assertEqual(get_score(game, 1), -100)
        for move in get_possible_moves(game, 0):
            child = play_move(game, 0, move)
            self.assertEqual(get_score(child, 0), -get_score(child, 1))

    def test_takes_immediate_win_for_both_colors(self):
        game = position(3, 0, 0, 24, 0, 0)
        for board, player in ((game, 0), (swap_players(game), 1)):
            for depth in (1, 2, 3):
                with self.subTest(player=player, depth=depth):
                    score, move = select_move_alphabeta(board, player, depth)
                    self.assertEqual(get_winner(play_move(board, player, move)), player)
                    self.assertEqual(score, WIN_SCORE + depth - 1)

    def test_blocks_all_immediate_winning_replies(self):
        # Recorded legal play: the old shallow evaluator moved 2 from 3 to 6,
        # allowing player 0 to complete the top row with a small piece at 1.
        game = GameConfig(4, 64, 1, 64, 8, 136, 341, 0)
        for board, player in ((game, 1), (swap_players(game), 0)):
            for depth in (2, 3):
                with self.subTest(player=player, depth=depth):
                    _, move = select_move_alphabeta(board, player, depth)
                    child = play_move(board, player, move)
                    self.assertNotEqual(get_winner(child), 1 - player)
                    for reply in get_possible_moves(child, 1 - player):
                        self.assertNotEqual(get_winner(play_move(child, 1 - player, reply)),
                                            1 - player)

    def test_delays_a_forced_loss_as_long_as_possible_for_both_colors(self):
        # The user's replay after nine plies: large 0 -> 8 survives four
        # more plies; each of the other thirteen defenses loses in two.
        game = GameConfig(0, 256, 68, 0, 68, 17, 134, 0)
        delaying_move = Move(2, 0, 8)
        for board, player in ((game, 1), (swap_players(game), 0)):
            with self.subTest(player=player):
                moves = get_possible_moves(board, player)
                self.assertEqual(len(moves), 14)
                scores = {
                    move: -minimax(play_move(board, player, move), 1 - player, 3)
                    for move in moves
                }
                self.assertEqual(scores, {
                    move: -WIN_SCORE if move == delaying_move else -WIN_SCORE - 2
                    for move in moves
                })
                expected = (-WIN_SCORE, delaying_move)
                self.assertEqual(select_move_alphabeta(board, player, 4), expected)
                # With no clock expiry, iterative search should finish at the
                # first proven loss, preserving the longest available defense.
                with patch("shared.perf_counter", return_value=0):
                    self.assertEqual(select_move_alphabeta(
                        board, player, 13, time_limit=1), expected)

    def test_delaying_defense_can_capitalize_on_an_opponents_mistake(self):
        game = GameConfig(0, 256, 68, 0, 68, 17, 134, 0)
        for board, player in ((game, 1), (swap_players(game), 0)):
            with self.subTest(player=player):
                board = play_move(board, player, Move(2, 0, 8))
                # Medium reserve -> 0 would block the diagonal. Playing it
                # at 1 instead lets the formerly losing side win immediately.
                mistake = Move(1, None, 1)
                self.assertIn(mistake, get_possible_moves(board, 1 - player))
                board = play_move(board, 1 - player, mistake)
                self.assertIsNone(get_winner(board))
                score, move = select_move_alphabeta(board, player, 3)
                self.assertEqual((score, move), (WIN_SCORE + 2, Move(0, None, 0)))
                self.assertEqual(get_winner(play_move(board, player, move)), player)

    def test_losing_move_uses_normal_negamax_for_both_colors(self):
        game = GameConfig(0, 257, 68, 0, 68, 272, 130, 0)
        for board, player in ((game, 1), (swap_players(game), 0)):
            with self.subTest(player=player):
                history = [position_key(board, player)]
                expected = negamax(board, player, -float("inf"), float("inf"),
                                   2, history=history)
                self.assertEqual(expected, (-WIN_SCORE, Move(0, None, 5)))
                self.assertEqual(select_move_alphabeta(
                    board, player, 2, history=history), expected)
                with patch("shared.perf_counter", return_value=0):
                    self.assertEqual(select_move_alphabeta(
                        board, player, 20, time_limit=1, history=history), expected)
                self.assertEqual(history, [position_key(board, player)])

    def test_terminal_win_is_checked_before_depth_cutoff(self):
        game = play_move(position(3, 0, 0, 24, 0, 0), 0, Move(1, None, 2))
        self.assertEqual(select_move_alphabeta(game, 0, 0), (WIN_SCORE, None))
        self.assertEqual(select_move_alphabeta(game, 1, 0), (-WIN_SCORE, None))
        self.assertEqual(select_move_alphabeta(game, 0, -1), (WIN_SCORE, None))

    def test_search_matches_exhaustive_minimax_on_seeded_positions(self):
        rng = random.Random(728)
        positions = []
        while len(positions) < 10:
            game = GameConfig(0, 0, 0, 0, 0, 0, INITIAL_UNUSED)
            player = 0
            for _ in range(rng.randrange(3, 14)):
                moves = get_possible_moves(game, player)
                if not moves:
                    break
                game = play_move(game, player, rng.choice(moves))
                player = 1 - player
            if get_winner(game) is None:
                positions.append((game, player))
        for game, player in positions:
            with self.subTest(game=game, player=player):
                score, move = select_move_alphabeta(game, player, 2)
                self.assertEqual(score, minimax(game, player, 2))
                self.assertIn(move, get_possible_moves(game, player))
                child = play_move(game, player, move)
                self.assertEqual(score, -minimax(child, 1 - player, 1))

    def test_transposition_bounds_depth_and_side_are_not_exact_scores(self):
        game = position(1, 0, 0, 0, 0, 16)
        for alpha, beta in ((-1, 0), (0, 1), (-1001, -1000), (1000, 1001)):
            table = {}
            negamax(game, 0, alpha, beta, 3, table)
            for player, depth in ((0, 3), (0, 2), (1, 2)):
                with self.subTest(alpha=alpha, beta=beta, player=player, depth=depth):
                    actual, _ = negamax(game, player, -float("inf"), float("inf"), depth, table)
                    self.assertEqual(actual, minimax(game, player, depth))

    def test_timeout_keeps_last_completed_iteration(self):
        game = position(1, 0, 0, 0, 0, 16)
        expected = select_move_alphabeta(game, 0, 1)
        # Budget allows depth 1 and enters depth 2 before expiring.
        calls_before_timeout = len(get_possible_moves(game, 0)) + 4
        times = iter([0.0] * calls_before_timeout + [2.0])
        with patch("shared.perf_counter", side_effect=lambda: next(times)):
            self.assertEqual(select_move_alphabeta(game, 0, 4, time_limit=1.0), expected)

    def test_timeout_unwinds_repetition_counts_before_the_next_search(self):
        game = position(0, 0, 1, 0, 0, 256)
        history = [position_key(game, 0)] * 3
        counts = shared._history_counts(game, 0, history)
        before = counts.copy()
        moves = sorted(get_possible_moves(game, 0),
                       key=lambda move: get_score(play_move(game, 0, move), 0),
                       reverse=True)
        index = next(i for i, move in enumerate(moves) if move.start_sq is not None)
        # Expire on a reversible child, whose counts are shared with its parent.
        times = iter([0.0] * (index + 1) + [2.0])
        table = {}
        with patch("shared.perf_counter", side_effect=lambda: next(times)):
            with self.assertRaises(shared._SearchTimeout):
                shared._negamax(game, 0, -float("inf"), float("inf"),
                                1, table, 1.0, counts, 0)
        self.assertEqual(counts, before)
        self.assertEqual(shared._negamax(game, 0, -float("inf"), float("inf"),
                                         2, table, None, counts, 0),
                         select_move_alphabeta(game, 0, 2, history=history))
        self.assertEqual(counts, before)

    def test_cache_size_is_bounded_without_changing_result(self):
        game = position(1, 0, 0, 0, 0, 16)
        table = {}
        with patch("shared.MAX_TABLE_SIZE", 2):
            score, _ = negamax(game, 0, -float("inf"), float("inf"), 3, table)
        self.assertEqual(len(table), 2)
        self.assertEqual(score, minimax(game, 0, 3))

    def test_expired_budget_still_returns_a_legal_move(self):
        game = position(1, 0, 0, 0, 0, 16)
        with patch("shared.perf_counter", return_value=0.0):
            _, move = select_move_alphabeta(game, 0, 13, time_limit=0)
        self.assertIn(move, get_possible_moves(game, 0))


if __name__ == "__main__":
    unittest.main()
