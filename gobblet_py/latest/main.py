"""
 * Author: Matthew Taylor
 * Created: 2024
"""

import sys
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox
from functools import partial
from shared import *

SEARCH_DEPTH = 20


class GameGUI:
    def __init__(self, root, starting_player=0):
        self.root = root
        self.root.title("Gobblet Game")
        self.selection = None
        self.move_log_path = Path(__file__).with_name(f"move_history_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.log")
        self.move_log_path.write_text("", encoding="utf-8")
        self.game = GameConfig(
            0, 0, 0,  
            0, 0, 0,  
            INITIAL_UNUSED
        )
        self.current_player = starting_player
        self.repetition_history = [position_key(self.game, starting_player)]
        self.buttons = [[None for _ in range(3)] for _ in range(3)]
        
        self.create_board()
        self.prediction_label = tk.Label(self.root, text="Outcome not yet analyzed.")
        self.prediction_label.grid(row=4, column=0, columnspan=3)
        tk.Label(
            self.root,
            text="With best play. Each player's turn counts as one move.",
            wraplength=300,
        ).grid(row=5, column=0, columnspan=3)
        self.create_selection_frame()

    def create_board(self):
        for i in range(3):
            for j in range(3):
                btn = tk.Button(
                    self.root,
                    text="",
                    width=10,
                    height=3,
                    command=lambda: None,
                )
                btn.grid(row=i, column=j)
                self.buttons[i][j] = btn

    def create_selection_frame(self):
        self.piece_frame = tk.Frame(self.root)
        self.piece_frame.grid(row=3, column=0, columnspan=3)
        self.update_selection()
        
        # If AI starts first, make its move
        if self.current_player == 1 and not self.game_is_over():
            self.root.after(500, self.ai_move)

    def game_is_over(self):
        return get_winner(self.game) is not None or is_repetition_draw(self.repetition_history)

    def record_move(self, player, move):
        with self.move_log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(f"player={player} | move={move!r}\n")

    def update_selection(self):
        for widget in self.piece_frame.winfo_children():
            widget.destroy()

        for row in self.buttons:
            for button in row:
                button.configure(command=lambda: None)
        if self.current_player != 0 or self.game_is_over():
            self.selection = None
            return

        # Display buttons for currently unused pieces
        for size in range(3):
            for _ in range(get_unused(self.game.unused, self.current_player, size)):
                btn = tk.Button(
                    self.piece_frame,
                    text=f"{self.current_player}-{size+1}",
                    command=partial(self.make_selection, (size, None)),
                )
                btn.pack(side=tk.LEFT)

        # Clear board bindings, rebind top pieces controlled by current player
        l_any = self.game.p0_l | self.game.p1_l
        m_any = self.game.p0_m | self.game.p1_m

        vis_l = self.game.p0_l
        vis_m = self.game.p0_m & ~l_any
        vis_s = self.game.p0_s & ~(l_any | m_any)

        for sq in range(9):
            i, j = divmod(sq, 3)
            mask = 1 << sq
            if vis_l & mask:
                self.buttons[i][j].configure(command=partial(self.make_selection, (2, sq)))
            elif vis_m & mask:
                self.buttons[i][j].configure(command=partial(self.make_selection, (1, sq)))
            elif vis_s & mask:
                self.buttons[i][j].configure(command=partial(self.make_selection, (0, sq)))

    def make_selection(self, selection):
        if self.current_player != 0 or self.game_is_over():
            return
        self.selection = selection
        for sq in range(9):
            i, j = divmod(sq, 3)
            self.buttons[i][j].configure(
                command=partial(self.on_board_click, sq)
            )

    def on_board_click(self, end_sq):
        if self.current_player != 0 or self.game_is_over():
            return
        if self.selection:
            size, start_sq = self.selection
            move = Move(size, start_sq, end_sq)

            if move in get_possible_moves(self.game, self.current_player):
                self.game = play_move(self.game, self.current_player, move)
                self.repetition_history = advance_history(
                    self.repetition_history, self.game, next_player(self.current_player), move
                )
                self.record_move(self.current_player, move)
                self.selection = None
                self.prediction_label.configure(text="Analyzing position...")
                self.update_board()
                if self.game_is_over():
                    return
                self.current_player = next_player(self.current_player)
                self.update_selection()

                if self.current_player == 1 and not self.game_is_over():
                    self.root.after(500, self.ai_move)

    def ai_move(self):
        if self.current_player == 1 and not self.game_is_over():
            print("Robot says to move: ")
            self.prediction_label.configure(text="Analyzing position...")
            self.root.update_idletasks()
            try:
                score, best_move = select_move_alphabeta(
                    self.game, self.current_player, SEARCH_DEPTH, history=self.repetition_history
                )
            except Exception:
                self.prediction_label.configure(text="Analysis unavailable.")
                raise
            if best_move:
                print(
                    "Best Move: ", best_move,
                    "color: ", self.current_player,
                    "power: ", best_move.size + 1
                )
                print("Score: ", score)
                self.game = play_move(self.game, self.current_player, best_move)
                self.repetition_history = advance_history(
                    self.repetition_history, self.game, next_player(self.current_player), best_move
                )
                self.record_move(self.current_player, best_move)
                self.update_prediction(score)
                self.update_board()

                if not self.game_is_over():
                    self.current_player = next_player(self.current_player)
                    self.update_selection()
            else:
                self.prediction_label.configure(text="Analysis unavailable.")

    def update_prediction(self, score):
        if abs(score) >= WIN_SCORE:
            # The score counts from before the AI's move; the board now includes it.
            remaining_moves = SEARCH_DEPTH - (abs(score) - WIN_SCORE) - 1
            winner = "AI" if score > 0 else "Human"
            unit = "move" if remaining_moves == 1 else "moves"
            text = f"{winner} can force a win in {remaining_moves} {unit}."
        elif score == DRAW_SCORE:
            text = "AI can secure a draw."
        else:
            text = "Outcome uncertain."
        self.prediction_label.configure(text=text)

    def update_board(self):
        for sq in range(9):
            i, j = divmod(sq, 3)
            color, size = get_top_piece(self.game, sq)

            if color is None:
                self.buttons[i][j].configure(text="")
            else:
                self.buttons[i][j].configure(text=f"{color}-{size+1}")

        # Post-move Win Check
        winner = get_winner(self.game)
        if self.game_is_over():
            outcome = "Human wins." if winner == 0 else "AI wins." if winner == 1 else "Draw."
            self.prediction_label.configure(text=outcome)
            messagebox.showinfo("Game Over", f"Player {winner} wins!" if winner in (0, 1) else "Draw!")
            self.root.destroy()

if __name__ == "__main__":
    starting_player = 0
    if len(sys.argv) > 1:
        try:
            starting_player = int(sys.argv[1])
        except ValueError:
            print(f"Error: Starting player must be an integer, got '{sys.argv[1]}'")
            sys.exit(1)
    
    root = tk.Tk()
    gui = GameGUI(root, starting_player)
    root.mainloop()
