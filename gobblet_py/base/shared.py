"""
 * Author: Matthew Taylor
 * Created: 2024
 *
 * © 2024 Matthew Taylor. All rights reserved.
"""


from __future__ import annotations
from typing import NamedTuple

piece_map = [
    (0, 1),
    (0, 1),
    (0, 2),
    (0, 2),
    (0, 3),
    (0, 3),
    (1, 1),
    (1, 1),
    (1, 2),
    (1, 2),
    (1, 3),
    (1, 3),
]

# each number represents a different piece


winning_lines = [
        [(0, 0), (0, 1), (0, 2)],
        [(1, 0), (1, 1), (1, 2)],
        [(2, 0), (2, 1), (2, 2)],
        [(0, 0), (1, 0), (2, 0)],
        [(0, 1), (1, 1), (2, 1)],
        [(0, 2), (1, 2), (2, 2)],
        [(0, 0), (1, 1), (2, 2)],
        [(0, 2), (1, 1), (2, 0)],
    ]


def get_color(piece: int) -> int:
    return piece_map[piece][0]


def get_power(piece: int) -> int:
    if piece == -1:
        return 0
    return piece_map[piece][1]


def piece_belongs_to_player(piece: int, player: int) -> bool:
    return piece != -1 and get_color(piece) == player

class Player:
    def __init__(self, unused_pieces: frozenset[int]):
        self.unused_pieces = unused_pieces

    def __repr__(self) -> str:
        return f"""Player(
                        unused_pieces={self.unused_pieces}
                    )"""


class GameConfig:
    def __init__(self, board: list[list[list[int]]], players: list[Player]):
        self.board = board
        self.players = players

    def __repr__(self) -> str:
        return f"""GameConfig(
                        board={self.board}
                        players={self.players}
                    )"""


class Move(NamedTuple):
    pid: int | None  # Each move has an associated piece

    # Each move has a starting position (row, col) if the piece is already on the board
    # If the piece is not on the board, start_pos is None
    start_pos: tuple[int, int] | None

    # Each move has an ending position (row, col)
    end_pos: tuple[int, int]


def game_over(game: GameConfig) -> bool:
    for line in winning_lines:
        if all(piece_belongs_to_player(game.board[i][j][-1], 0) for i, j in line):
            return True
        if all(piece_belongs_to_player(game.board[i][j][-1], 1) for i, j in line):
            return True

    return False


def get_possible_moves(game: GameConfig, player: int) -> list[Move]:
    moves = []

    if game_over(game):
        return moves

    my_pieces_ontop = set()
    my_piece_locations = {}

    for i in range(3):
        for j in range(3):
            piece = game.board[i][j][-1]
            if piece_belongs_to_player(piece, player):
                my_pieces_ontop.add(piece)
                my_piece_locations[piece] = (i, j)

    for piece in game.players[player].unused_pieces:
        for i in range(3):
            for j in range(3):
                target_piece = game.board[i][j][-1]
                if target_piece == -1 or get_power(piece) > get_power(target_piece):
                    moves.append(Move(piece, None, (i, j)))


    for piece in my_pieces_ontop:
        for i in range(3):
            for j in range(3):
                target_piece = game.board[i][j][-1]
                if (i, j) != my_piece_locations[piece] and (target_piece == -1 or get_power(piece) > get_power(target_piece)):
                    moves.append(Move(piece, my_piece_locations[piece], (i, j)))

    return moves


def next_player(player: int) -> int:
    return 1 - player


def play_move(game: GameConfig, player: int, move: Move) -> GameConfig:
    """
    >>> player1 = Player(frozenset([0, 1, 2, 3, 4, 5]))
    >>> player2 = Player(frozenset([6, 7, 8, 9, 10, 11]))
    >>> game = GameConfig([[[-1] for i in range(3)] for j in range(3)], [player1, player2])
    >>> current_player = 0
    >>> move = Move(0, None, (0, 0))
    >>> new_game = play_move(game, current_player, move)
    >>> get_score(new_game, current_player)
    0
    >>> current_player = 1
    >>> move = Move(6, None, (0, 1))
    >>> new_game = play_move(new_game, current_player, move)
    >>> get_score(new_game, current_player)
    0
    >>> current_player = 0
    >>> move = Move(1, None, (1, 0))
    >>> new_game = play_move(new_game, current_player, move)
    >>> get_score(new_game, current_player)
    0
    >>> current_player = 1
    >>> move = Move(7, None, (1, 1))
    >>> new_game = play_move(new_game, current_player, move)
    >>> get_score(new_game, current_player)
    0
    >>> current_player = 0
    >>> move = Move(2, None, (2, 0))
    >>> game_over = play_move(new_game, current_player, move)
    >>> get_score(game_over, current_player)
    100
    """
    new_board = [[stack.copy() for stack in row] for row in game.board]

    if move.start_pos is not None:
        x, y = move.start_pos
        new_board[x][y].pop()
        if not new_board[x][y]:
            new_board[x][y].append(-1)

    i, j = move.end_pos
    new_board[i][j].append(move.pid)

    new_players = [None, None]
    new_players[player] = Player(game.players[player].unused_pieces - {move.pid})

    player2 = next_player(player)
    new_players[player2] = Player(game.players[player2].unused_pieces)

    return GameConfig(new_board, new_players)


def compute_utility_simple(game: GameConfig, player: int) -> int:
    # Base Tic Tac Toe score function
    player2 = next_player(player)

    # Check if a player has won
    for line in winning_lines:
        opponent_line = all(
            piece_belongs_to_player(game.board[i][j][-1], player2)
            for i, j in line
        )
        if opponent_line:
            return -1000

        player_line = all(
            piece_belongs_to_player(game.board[i][j][-1], player)
            for i, j in line
        )
        if player_line:
            return 1000

    return 0
