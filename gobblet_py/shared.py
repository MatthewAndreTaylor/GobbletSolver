"""
 * Author: Matthew Taylor
 * Created: 2024
 *
 * © 2024 Matthew Taylor. All rights reserved.
"""


from __future__ import annotations
from typing import NamedTuple

piece_map = {
    0: (0, 1),
    1: (0, 1),
    2: (0, 2),
    3: (0, 2),
    4: (0, 3),
    5: (0, 3),
    6: (1, 1),
    7: (1, 1),
    8: (1, 2),
    9: (1, 2),
    10: (1, 3),
    11: (1, 3),
}

# each number represents a different piece


def get_color(piece: int) -> int:
    return piece_map.get(piece)[0]


def get_power(piece: int) -> int:
    if piece == -1:
        return 0
    return piece_map.get(piece)[1]


class Player:
    def __init__(self, pieces: frozenset[int], unused_pieces: frozenset[int]):
        self.pieces = pieces
        self.unused_pieces = unused_pieces

    def __repr__(self) -> str:
        return f"""Player(
                        pieces={self.pieces}
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

    for line in winning_lines:
        if all(game.board[i][j][-1] in game.players[0].pieces for i, j in line):
            return True
        if all(game.board[i][j][-1] in game.players[1].pieces for i, j in line):
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
            if game.board[i][j][-1] in game.players[player].pieces:
                my_pieces_ontop.add(game.board[i][j][-1])
                my_piece_locations[game.board[i][j][-1]] = (i, j)

    available_pieces = game.players[player].unused_pieces | my_pieces_ontop

    for i in range(3):
        for j in range(3):
            for piece in available_pieces:
                if game.board[i][j][-1] == -1:
                    if piece in game.players[player].unused_pieces:
                        moves.append(Move(piece, None, (i, j)))
                    else:
                        moves.append(Move(piece, my_piece_locations[piece], (i, j)))

                elif get_power(piece) > get_power(game.board[i][j][-1]):
                    if piece in game.players[player].unused_pieces:
                        moves.append(Move(piece, None, (i, j)))
                    else:
                        moves.append(Move(piece, my_piece_locations[piece], (i, j)))

    return moves


def next_player(player: int) -> int:
    return 1 - player


def play_move(game: GameConfig, player: int, move: Move) -> GameConfig:
    """
    >>> player1 = Player(frozenset([0, 1, 2, 3, 4, 5]), frozenset([0, 1, 2, 3, 4, 5]))
    >>> player2 = Player(frozenset([6, 7, 8, 9, 10, 11]), frozenset([6, 7, 8, 9, 10, 11]))
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

    i, j = move.end_pos
    new_board[i][j].append(move.pid)

    new_players = [None, None]
    new_players[player] = Player(
        game.players[player].pieces, game.players[player].unused_pieces - {move.pid}
    )

    player2 = next_player(player)
    new_players[player2] = Player(
        game.players[player2].pieces, game.players[player2].unused_pieces
    )

    return GameConfig(new_board, new_players)


def compute_utility(game: GameConfig, player: int) -> int:
    # Base Tic Tac Toe score function
    player2 = next_player(player)

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

    # Check if a player has won
    for line in winning_lines:
        opponent_line = all(
            game.board[i][j][-1] in game.players[player2].pieces for i, j in line
        )
        if opponent_line:
            return -1000

        player_line = all(
            game.board[i][j][-1] in game.players[player].pieces for i, j in line
        )
        if player_line:
            return 1000

    # Check lines of 2
    player_score = 0
    opponent_score = 0

    for line in winning_lines:
        player_pieces_in_line = sum(
            1
            for i, j in line
            if game.board[i][j] and game.board[i][j][-1] in game.players[player].pieces
        )
        opponent_pieces_in_line = sum(
            1
            for i, j in line
            if game.board[i][j] and game.board[i][j][-1] in game.players[player2].pieces
        )
        if opponent_pieces_in_line == 2 and player_pieces_in_line == 0:
            opponent_score += 100
        elif player_pieces_in_line == 2 and opponent_pieces_in_line == 0:
            player_score += 100

    return player_score - opponent_score


def compute_utility_simple(game: GameConfig, player: int) -> int:
    # Base Tic Tac Toe score function
    player2 = next_player(player)

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

    # Check if a player has won
    for line in winning_lines:
        opponent_line = all(
            game.board[i][j][-1] in game.players[player2].pieces for i, j in line
        )
        if opponent_line:
            return -1000

        player_line = all(
            game.board[i][j][-1] in game.players[player].pieces for i, j in line
        )
        if player_line:
            return 1000

    return 0
