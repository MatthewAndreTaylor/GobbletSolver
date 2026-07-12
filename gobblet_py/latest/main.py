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
        self.buttons = [[None for _ in range(3)] for _ in range(3)]
        
        self.create_board()
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
        if self.current_player == 1 and get_winner(self.game) is None:
            self.root.after(500, self.ai_move)

    def record_move(self, player, move):
        with self.move_log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(f"player={player} | move={move!r}\n")

    def update_selection(self):
        for widget in self.piece_frame.winfo_children():
            widget.destroy()

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

        if self.current_player == 0:
            vis_l = self.game.p0_l
            vis_m = self.game.p0_m & ~l_any
            vis_s = self.game.p0_s & ~(l_any | m_any)
        else:
            vis_l = self.game.p1_l
            vis_m = self.game.p1_m & ~l_any
            vis_s = self.game.p1_s & ~(l_any | m_any)

        for sq in range(9):
            i, j = divmod(sq, 3)
            self.buttons[i][j].configure(command=lambda: None)
            
            mask = 1 << sq
            if vis_l & mask:
                self.buttons[i][j].configure(command=partial(self.make_selection, (2, sq)))
            elif vis_m & mask:
                self.buttons[i][j].configure(command=partial(self.make_selection, (1, sq)))
            elif vis_s & mask:
                self.buttons[i][j].configure(command=partial(self.make_selection, (0, sq)))

    def make_selection(self, selection):
        self.selection = selection
        for sq in range(9):
            i, j = divmod(sq, 3)
            self.buttons[i][j].configure(
                command=partial(self.on_board_click, sq)
            )

    def on_board_click(self, end_sq):
        if self.selection:
            size, start_sq = self.selection
            move = Move(size, start_sq, end_sq)

            if move in get_possible_moves(self.game, self.current_player):
                self.game = play_move(self.game, self.current_player, move)
                self.record_move(self.current_player, move)
                self.update_board()
                self.current_player = next_player(self.current_player)
                self.selection = None
                self.update_selection()

                if self.current_player == 1 and get_winner(self.game) is None:
                    self.root.after(500, self.ai_move)

    def ai_move(self):
        if self.current_player == 1 and get_winner(self.game) is None:
            print("Robot says to move: ")
            score, best_move = select_move_alphabeta(
                self.game, self.current_player, 13
            )
            if best_move:
                print(
                    "Best Move: ", best_move,
                    "color: ", self.current_player,
                    "power: ", best_move.size + 1
                )
                print("Score: ", score)
                self.game = play_move(self.game, self.current_player, best_move)
                self.record_move(self.current_player, best_move)
                self.update_board()

                if get_winner(self.game) is None:
                    self.current_player = next_player(self.current_player)
                    self.update_selection()

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
        if winner is not None:
            messagebox.showinfo("Game Over", f"Player {winner} wins!")
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