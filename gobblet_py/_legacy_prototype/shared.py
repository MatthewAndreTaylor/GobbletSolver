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
        if all(belongs_to_player(game.board[i][j][-1], 0) for i, j in line):
            return True
        if all(belongs_to_player(game.board[i][j][-1], 1) for i, j in line):
            return True

    return False


def get_possible_moves(game: GameConfig, player: int) -> list[Move]:
    moves = []
    
    if game_over(game):
        return moves

    my_on_board = []
    target_cells = []

    for i in range(3):
        for j in range(3):
            target_piece = game.board[i][j][-1]
            t_power = get_power(target_piece)
            target_cells.append((i, j, t_power))

            if target_piece != -1 and belongs_to_player(target_piece, player):
                my_on_board.append((target_piece, t_power, i, j))

    # Pieces that are unused: Generate moves
    for piece in game.players[player].unused_pieces:
        p_power = get_power(piece)
        for i, j, t_power in target_cells:
            if p_power > t_power:
                moves.append(Move(piece, None, (i, j)))

    # Pieces already on the board: Generate moves
    for piece, p_power, p_i, p_j in my_on_board:
        for i, j, t_power in target_cells:
            if (i != p_i or j != p_j) and p_power > t_power:
                moves.append(Move(piece, (p_i, p_j), (i, j)))

    return moves


def next_player(player: int) -> int:
    return 1 - player

def belongs_to_player(piece: int, player: int) -> bool:
    if piece == -1:
        return False
    return get_color(piece) == player


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
            belongs_to_player(game.board[i][j][-1], player2) for i, j in line
        )
        if opponent_line:
            return -1000

        player_line = all(
            belongs_to_player(game.board[i][j][-1], player) for i, j in line
        )
        if player_line:
            return 1000

    return 0


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