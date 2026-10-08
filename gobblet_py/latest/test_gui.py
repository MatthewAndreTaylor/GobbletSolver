import unittest
from unittest.mock import Mock, patch

import main


class GuiTests(unittest.TestCase):
    def make_gui(self, player=0):
        gui = main.GameGUI.__new__(main.GameGUI)
        gui.game = main.GameConfig(0, 0, 0, 0, 0, 0, main.INITIAL_UNUSED)
        gui.current_player = player
        gui.repetition_history = [main.position_key(gui.game, player)]
        gui.selection = None
        gui.root = Mock()
        gui.prediction_label = Mock()
        gui.piece_frame = Mock()
        gui.piece_frame.winfo_children.return_value = []
        gui.buttons = [[Mock() for _ in range(3)] for _ in range(3)]
        gui.record_move = Mock()
        gui.update_board = Mock()
        return gui

    def test_ai_turn_has_no_human_piece_bindings(self):
        gui = self.make_gui(player=1)
        with patch.object(main.tk, "Button") as button:
            gui.update_selection()
        button.assert_not_called()
        for row in gui.buttons:
            for cell in row:
                cell.configure.call_args.kwargs["command"]()
        self.assertIsNone(gui.selection)

    def test_queued_human_callbacks_cannot_play_ai_turn(self):
        gui = self.make_gui(player=1)
        before = gui.game
        gui.make_selection((2, None))
        self.assertIsNone(gui.selection)
        gui.selection = (2, None)
        gui.on_board_click(0)
        self.assertEqual(gui.game, before)
        gui.record_move.assert_not_called()
        gui.root.after.assert_not_called()

    def test_human_move_schedules_ai_with_input_locked(self):
        gui = self.make_gui()
        gui.selection = (2, None)
        with patch.object(main.tk, "Button") as button:
            gui.on_board_click(0)
        self.assertEqual(gui.current_player, 1)
        self.assertIsNone(gui.selection)
        gui.root.after.assert_called_once_with(500, gui.ai_move)
        gui.prediction_label.configure.assert_called_once_with(text="Analyzing position...")
        button.assert_not_called()

    def test_human_win_does_not_reconfigure_destroyed_window(self):
        gui = self.make_gui()
        gui.game = main.GameConfig(3, 0, 0, 0, 0, 16, main.INITIAL_UNUSED)
        gui.selection = (1, None)
        gui.update_selection = Mock()
        gui.on_board_click(2)
        self.assertEqual(main.get_winner(gui.game), 0)
        gui.update_board.assert_called_once()
        gui.update_selection.assert_not_called()
        gui.root.after.assert_not_called()
        self.assertIsNone(gui.selection)

    def test_ai_has_no_search_time_limit_and_returns_control_to_human(self):
        gui = self.make_gui(player=1)
        before = gui.game
        history = gui.repetition_history
        move = main.Move(2, None, 4)
        gui.update_selection = Mock()
        with patch.object(main, "select_move_alphabeta", return_value=(0, move)) as search:
            gui.ai_move()
        search.assert_called_once_with(before, 1, 20, history=history)
        self.assertEqual(main.get_top_piece(gui.game, 4), (1, 2))
        self.assertEqual(gui.current_player, 0)
        gui.record_move.assert_called_once_with(1, move)
        gui.update_selection.assert_called_once()
        gui.root.update_idletasks.assert_called_once()
        gui.prediction_label.configure.assert_called_with(text="Outcome uncertain.")

    def test_prediction_uses_ai_perspective_and_remaining_moves_after_its_move(self):
        gui = self.make_gui(player=1)
        for score, text in (
            (main.WIN_SCORE + 17, "AI can force a win in 2 moves."),
            (-main.WIN_SCORE - 16, "Human can force a win in 3 moves."),
            (-main.WIN_SCORE - 18, "Human can force a win in 1 move."),
            (-main.WIN_SCORE, "Human can force a win in 19 moves."),
            (main.DRAW_SCORE, "AI can secure a draw."),
            (0, "Outcome uncertain."),
            (100, "Outcome uncertain."),
            (-100, "Outcome uncertain."),
        ):
            with self.subTest(score=score):
                gui.update_prediction(score)
                gui.prediction_label.configure.assert_called_with(text=text)

    def test_replay_last_defense_predicts_one_remaining_human_move(self):
        gui = self.make_gui(player=1)
        gui.game = main.GameConfig(0, 257, 68, 0, 68, 272, 130, 0)
        gui.repetition_history = [main.position_key(gui.game, 1)]
        gui.update_selection = Mock()
        # A short exact search proves this late replay position; no clock budget.
        with patch.object(main, "SEARCH_DEPTH", 2):
            gui.ai_move()
        self.assertEqual(main.get_top_piece(gui.game, 5), (1, 0))
        self.assertIsNone(main.get_winner(gui.game))
        gui.prediction_label.configure.assert_called_with(text="Human can force a win in 1 move.")

    def test_forced_ai_win_predicts_remaining_human_and_ai_moves(self):
        gui = self.make_gui(player=1)
        gui.game = main.GameConfig(272, 256, 2, 0, 32, 192, 404, 0)
        gui.repetition_history = [main.position_key(gui.game, 1)]
        gui.update_selection = Mock()
        with patch.object(main, "SEARCH_DEPTH", 3):
            gui.ai_move()
        self.assertIsNone(main.get_winner(gui.game))
        gui.prediction_label.configure.assert_called_with(text="AI can force a win in 2 moves.")

    def test_selection_and_illegal_move_preserve_prediction(self):
        gui = self.make_gui()
        gui.game = main.play_move(gui.game, 1, main.Move(2, None, 0))
        gui.make_selection((0, None))
        gui.on_board_click(0)
        gui.prediction_label.configure.assert_not_called()

    def test_search_paints_analysis_status_and_clears_it_on_failure(self):
        gui = self.make_gui(player=1)

        def fail_search(*args, **kwargs):
            gui.prediction_label.configure.assert_called_with(text="Analyzing position...")
            gui.root.update_idletasks.assert_called_once()
            raise RuntimeError("search failed")

        with patch.object(main, "select_move_alphabeta", side_effect=fail_search):
            with self.assertRaisesRegex(RuntimeError, "search failed"):
                gui.ai_move()
        gui.prediction_label.configure.assert_called_with(text="Analysis unavailable.")

    def test_missing_ai_move_clears_analysis_status(self):
        gui = self.make_gui(player=1)
        with patch.object(main, "select_move_alphabeta", return_value=(0, None)):
            gui.ai_move()
        gui.prediction_label.configure.assert_called_with(text="Analysis unavailable.")

    def test_immediate_ai_win_overrides_zero_move_prediction_before_window_close(self):
        gui = self.make_gui(player=1)
        gui.game = main.GameConfig(24, 0, 0, 3, 0, 0, main.INITIAL_UNUSED)
        gui.repetition_history = [main.position_key(gui.game, 1)]
        gui.update_selection = Mock()
        del gui.update_board
        with patch.object(main, "SEARCH_DEPTH", 1), patch.object(
            main.messagebox, "showinfo"
        ) as showinfo:
            gui.ai_move()
        self.assertEqual(main.get_winner(gui.game), 1)
        gui.prediction_label.configure.assert_called_with(text="AI wins.")
        showinfo.assert_called_once_with("Game Over", "Player 1 wins!")
        gui.root.destroy.assert_called_once()
        gui.update_selection.assert_not_called()

    def test_actual_human_win_overrides_prediction_without_searching(self):
        gui = self.make_gui()
        gui.game = main.GameConfig(3, 0, 0, 0, 0, 16, main.INITIAL_UNUSED)
        gui.selection = (1, None)
        gui.update_selection = Mock()
        del gui.update_board
        with patch.object(main.messagebox, "showinfo") as showinfo:
            gui.on_board_click(2)
        gui.prediction_label.configure.assert_called_with(text="Human wins.")
        showinfo.assert_called_once_with("Game Over", "Player 0 wins!")
        gui.root.destroy.assert_called_once()
        gui.update_selection.assert_not_called()
        gui.root.after.assert_not_called()

    def test_draw_announces_draw_instead_of_player_minus_one(self):
        gui = self.make_gui()
        with patch.object(main, "get_winner", return_value=-1), patch.object(
            main.messagebox, "showinfo"
        ) as showinfo:
            main.GameGUI.update_board(gui)
        showinfo.assert_called_once_with("Game Over", "Draw!")
        gui.prediction_label.configure.assert_called_with(text="Draw.")
        gui.root.destroy.assert_called_once()

    def prepare_repetition(self, gui, finishing_player):
        leading_player = 1 - finishing_player
        gui.repetition_history = [main.position_key(gui.game, leading_player)]

        def move(player, start, end):
            played = main.Move(2, start, end)
            gui.game = main.play_move(gui.game, player, played)
            gui.repetition_history = main.advance_history(
                gui.repetition_history, gui.game, 1 - player, played
            )

        move(leading_player, None, 0)
        move(finishing_player, None, 8)
        for cycle in range(3):
            move(leading_player, 0, 1)
            move(finishing_player, 8, 7)
            move(leading_player, 1, 0)
            if cycle < 2:
                move(finishing_player, 7, 8)
                self.assertFalse(main.is_repetition_draw(gui.repetition_history))
        gui.current_player = finishing_player
        return main.Move(2, 7, 8)

    def test_human_fourfold_draw_closes_without_scheduling_ai(self):
        gui = self.make_gui()
        move = self.prepare_repetition(gui, 0)
        gui.selection = (move.size, move.start_sq)
        gui.update_selection = Mock()
        del gui.update_board  # Exercise the actual draw announcement and window close.
        with patch.object(main.messagebox, "showinfo") as showinfo:
            gui.on_board_click(move.end_sq)
        showinfo.assert_called_once_with("Game Over", "Draw!")
        gui.root.destroy.assert_called_once()
        gui.root.after.assert_not_called()
        gui.update_selection.assert_not_called()
        self.assertTrue(main.is_repetition_draw(gui.repetition_history))

    def test_ai_fourfold_draw_closes_without_rebinding_human_input(self):
        gui = self.make_gui(player=1)
        move = self.prepare_repetition(gui, 1)
        before, history = gui.game, gui.repetition_history
        gui.update_selection = Mock()
        del gui.update_board
        with patch.object(main, "select_move_alphabeta", return_value=(main.DRAW_SCORE, move)) as search, patch.object(
            main.messagebox, "showinfo"
        ) as showinfo:
            gui.ai_move()
        search.assert_called_once_with(before, 1, 20, history=history)
        showinfo.assert_called_once_with("Game Over", "Draw!")
        gui.root.destroy.assert_called_once()
        gui.update_selection.assert_not_called()
        self.assertTrue(main.is_repetition_draw(gui.repetition_history))
        gui.prediction_label.configure.assert_called_with(text="Draw.")

    def test_fourfold_draw_blocks_queued_moves_and_searches(self):
        gui = self.make_gui()
        gui.repetition_history *= 4
        before = gui.game
        gui.make_selection((2, None))
        self.assertIsNone(gui.selection)
        gui.selection = (2, None)
        gui.on_board_click(0)
        gui.current_player = 1
        with patch.object(main, "select_move_alphabeta") as search:
            gui.ai_move()
        search.assert_not_called()
        gui.record_move.assert_not_called()
        self.assertEqual(gui.game, before)

    def test_winning_line_takes_precedence_over_repetition(self):
        gui = self.make_gui()
        gui.game = main.GameConfig(3, 4, 0, 0, 0, 16, main.INITIAL_UNUSED)
        gui.repetition_history = [main.position_key(gui.game, 1)] * 4
        with patch.object(main.messagebox, "showinfo") as showinfo:
            main.GameGUI.update_board(gui)
        showinfo.assert_called_once_with("Game Over", "Player 0 wins!")


if __name__ == "__main__":
    unittest.main()
