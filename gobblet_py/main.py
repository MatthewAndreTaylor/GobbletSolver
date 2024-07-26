"""
 * Author: Matthew Taylor
 * Created: 2024
 *
 * © 2024 Matthew Taylor. All rights reserved.
"""

import tkinter as tk
from tkinter import messagebox
from functools import partial
from shared import *


def alphabeta_min_node(board, color, alpha, beta, limit):
    next_col = next_player(color)
    moves = get_possible_moves(board, next_col)
    best_move = (0, 0)
    best_utility = float("inf")

    if limit <= 0 or not moves:
        return None, compute_utility_simple(board, color)

    for move in moves:
        new_board = play_move(board, next_col, move)
        _, utility = alphabeta_max_node(new_board, color, alpha, beta, limit - 1)

        if utility < best_utility:
            best_move = move
            best_utility = utility

        beta = min(beta, utility)
        if beta <= alpha:
            break

    return best_move, best_utility


def alphabeta_max_node(board, color, alpha, beta, limit):
    moves = get_possible_moves(board, color)
    best_move = (0, 0)
    best_utility = float("-inf")

    if limit <= 0 or not moves:
        return None, compute_utility_simple(board, color)

    for move in moves:
        new_board = play_move(board, color, move)
        _, utility = alphabeta_min_node(new_board, color, alpha, beta, limit - 1)

        if utility > best_utility:
            best_move = move
            best_utility = utility

        alpha = max(alpha, utility)
        if beta <= alpha:
            break

    return best_move, best_utility


def select_move_alphabeta(game_config: GameConfig, color, limit):
    return alphabeta_max_node(game_config, color, float("-inf"), float("inf"), limit)


class GameGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Board Game")
        self.selection = None

        starting_board = [[[-1], [-1], [-1]], [[-1], [-1], [-1]], [[-1], [-1], [-1]]]

        player1 = Player(
            frozenset([0, 1, 2, 3, 4, 5]), frozenset([0, 1, 2, 3, 4, 5])
        )  # player 1 has pieces 0-5
        player2 = Player(
            frozenset([6, 7, 8, 9, 10, 11]), frozenset([6, 7, 8, 9, 10, 11])
        )  # player 2 has pieces 6-11
        self.game = GameConfig(starting_board, [player1, player2])
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
                    command=lambda i=i, j=j: self.on_board_click(i, j),
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

        player = self.game.players[self.current_player]

        for pid in player.unused_pieces:
            color = get_color(pid)
            power = get_power(pid)

            btn = tk.Button(
                self.piece_frame,
                text=f"{color}-{power}",
                command=partial(self.make_selection, (pid, None)),
            )
            btn.pack(side=tk.LEFT)

        for i in range(3):
            for j in range(3):
                pid = self.game.board[i][j][-1]
                if pid in self.game.players[self.current_player].pieces:
                    self.buttons[i][j].configure(
                        command=partial(self.make_selection, (pid, (i, j)))
                    )

    def make_selection(self, selection):
        self.selection = selection

        for i in range(3):
            for j in range(3):
                self.buttons[i][j].configure(
                    command=lambda i=i, j=j: self.on_board_click(i, j)
                )

    def on_board_click(self, i, j):
        if self.selection:
            selected_pid = self.selection[0]
            start_pos = self.selection[1]

            move = Move(selected_pid, start_pos, (i, j))

            if move in get_possible_moves(self.game, self.current_player):
                # Play a turn of the game
                self.game = play_move(self.game, self.current_player, move)

                self.update_board()
                self.current_player = next_player(self.current_player)
                self.update_selection()

                if self.current_player == 1:
                    print("Robot says to move: ")

                    best_move, score = select_move_alphabeta(
                        self.game, self.current_player, 4
                    )

                    print(
                        "Best Move: ",
                        best_move,
                        "color: ",
                        get_color(best_move.pid),
                        "power: ",
                        get_power(best_move.pid),
                    )
                    print("Score: ", score)

    def update_board(self):
        for i in range(3):
            for j in range(3):
                pid = self.game.board[i][j][-1]

                if pid == -1:
                    self.buttons[i][j].configure(text="")
                else:
                    color = get_color(pid)
                    power = get_power(pid)
                    self.buttons[i][j].configure(text=f"{color}-{power}")

        if compute_utility_simple(self.game, self.current_player) == 1000:
            messagebox.showinfo("Game Over", f"Player {self.current_player} wins!")
            self.root.destroy()
        elif compute_utility_simple(self.game, self.current_player) == -1000:
            messagebox.showinfo(
                "Game Over", f"Player {next_player(self.current_player)} wins!"
            )
            self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    gui = GameGUI(root)
    root.mainloop()
