import tkinter as tk
from tkinter import messagebox
from functools import partial
from shared import *

class GameGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Gobblet Game")
        self.selection = None
        self.game = GameConfig(
            0, 0, 0,  
            0, 0, 0,  
            (2, 2, 2), (2, 2, 2)
        )
        self.current_player = 0
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

    def update_selection(self):
        for widget in self.piece_frame.winfo_children():
            widget.destroy()

        # Display buttons for currently unused pieces
        unused = self.game.p0_unused if self.current_player == 0 else self.game.p1_unused
        for size, count in enumerate(unused):
            for _ in range(count):
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
                self.update_board()
                self.current_player = next_player(self.current_player)
                self.update_selection()

                if self.current_player == 1 and get_winner(self.game) is None:
                    print("Robot says to move: ")
                    best_move, score = select_move_alphabeta(
                        self.game, self.current_player, 5
                    )
                    if best_move:
                        print(
                            "Best Move: ", best_move,
                            "color: ", self.current_player,
                            "power: ", best_move.size + 1
                        )
                        print("Score: ", score)

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
    root = tk.Tk()
    gui = GameGUI(root)
    root.mainloop()