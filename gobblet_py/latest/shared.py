"""
 * Author: Matthew Taylor
 * Created: 2024
"""

from typing import NamedTuple

WINNING_MASKS = (
    0b000_000_111,  # Row 0
    0b000_111_000,  # Row 1
    0b111_000_000,  # Row 2
    0b001_001_001,  # Col 0
    0b010_010_010,  # Col 1
    0b100_100_100,  # Col 2
    0b100_010_001,  # Diag 1
    0b001_010_100,  # Diag 2
)

# Player 0:
# bits  0-1   small
# bits  2-3   medium
# bits  4-5   large

# Player 1:
# bits  6-7   small
# bits  8-9   medium
# bits 10-11  large

INITIAL_UNUSED = (
    (2 << 0)  |  # p0 small
    (2 << 2)  |  # p0 medium
    (2 << 4)  |  # p0 large
    (2 << 6)  |  # p1 small
    (2 << 8)  |  # p1 medium
    (2 << 10)    # p1 large
)

class GameConfig(NamedTuple):
    # Bitboards for player 0 (bits 0-8 represent squares left-to-right, top-to-bottom)
    p0_s: int
    p0_m: int
    p0_l: int

    # Bitboards for player 1
    p1_s: int
    p1_m: int
    p1_l: int

    # Counts of unused pieces: 
    # (small, medium, large) (small, medium, large) for both players, packed into int
    unused: int


class Move(NamedTuple):
    size: int  # 0 = small, 1 = medium, 2 = large
    start_sq: int | None  # 0-8 for board positions, None if placing from unused
    end_sq: int  # 0-8 for destination


def game_over(game: GameConfig) -> int | None:
    l_any = game.p0_l | game.p1_l
    m_any = game.p0_m | game.p1_m

    p0_control = (
        game.p0_l |
        (game.p0_m & ~l_any) |
        (game.p0_s & ~l_any & ~m_any)
    )
    p1_control = (
        game.p1_l |
        (game.p1_m & ~l_any) |
        (game.p1_s & ~l_any & ~m_any)
    )

    return any(
        (p0_control & mask) == mask or
        (p1_control & mask) == mask
        for mask in WINNING_MASKS
    )


def get_top_piece(game: GameConfig, sq: int) -> tuple[int | None, int | None]:
    """Returns (color, size) of the top piece on a given square, or (None, None)."""
    mask = 1 << sq
    if game.p0_l & mask:
        return 0, 2
    if game.p1_l & mask:
        return 1, 2
    if game.p0_m & mask:
        return 0, 1
    if game.p1_m & mask:
        return 1, 1
    if game.p0_s & mask:
        return 0, 0
    if game.p1_s & mask:
        return 1, 0
    return None, None


def get_bits(mask: int):
    for i in range(9):
        if mask & (1 << i):
            yield i
            
            

def get_unused(unused: int, player: int, size: int) -> int:
    shift = player * 6 + size * 2
    return (unused >> shift) & 0b11

def dec_unused(unused: int, player: int, size: int) -> int:
    return unused - (1 << (player * 6 + size * 2))


def get_possible_moves(game: GameConfig, player: int) -> list[Move]:
    moves: list[Move] = []

    # Combined bitmasks of all pieces by size across both players
    l_any = game.p0_l | game.p1_l
    m_any = game.p0_m | game.p1_m
    s_any = game.p0_s | game.p1_s

    # Squares available for placing pieces of various sizes
    can_place_l = ~l_any & 0x1FF
    can_place_m = ~(l_any | m_any) & 0x1FF
    can_place_s = ~(l_any | m_any | s_any) & 0x1FF

    # Placing unused pieces
    if get_unused(game.unused, player, 0):
        for sq in get_bits(can_place_s):
            moves.append(Move(0, None, sq))
    if get_unused(game.unused, player, 1) > 0:
        for sq in get_bits(can_place_m):
            moves.append(Move(1, None, sq))
    if get_unused(game.unused, player, 2) > 0:
        for sq in get_bits(can_place_l):
            moves.append(Move(2, None, sq))

    # Moving visible pieces on the board
    vis_l = game.p0_l if player == 0 else game.p1_l
    vis_m = (game.p0_m if player == 0 else game.p1_m) & ~l_any
    vis_s = (game.p0_s if player == 0 else game.p1_s) & ~(l_any | m_any)
    
    for sq in get_bits(vis_s):
        for target in get_bits(can_place_s):
            if target != sq:
                moves.append(Move(0, sq, target))
                
    for sq in get_bits(vis_m):
        for target in get_bits(can_place_m):
            if target != sq:
                moves.append(Move(1, sq, target))

    for sq in get_bits(vis_l):
        for target in get_bits(can_place_l):
            if target != sq:
                moves.append(Move(2, sq, target))

    return moves


def next_player(player: int) -> int:
    return 1 - player


def play_move(game: GameConfig, player: int, move: Move) -> GameConfig:
    boards = [
        game.p0_s, game.p0_m, game.p0_l,
        game.p1_s, game.p1_m, game.p1_l,
    ]

    size, start_sq, end_sq = move
    idx = player * 3 + size
    unused = game.unused

    if start_sq is None:
        unused = dec_unused(game.unused, player, size)
    else:
        boards[idx] &= ~(1 << start_sq)

    boards[idx] |= 1 << end_sq

    return GameConfig(*boards, unused)
    
    
def get_winner(game: GameConfig) -> int | None:
    l_any = game.p0_l | game.p1_l
    m_any = game.p0_m | game.p1_m

    p0_control = (
        game.p0_l |
        (game.p0_m & ~l_any) |
        (game.p0_s & ~l_any & ~m_any)
    )
    p1_control = (
        game.p1_l |
        (game.p1_m & ~l_any) |
        (game.p1_s & ~l_any & ~m_any)
    )
    
    p0_wins = any((p0_control & mask) == mask for mask in WINNING_MASKS)
    p1_wins = any((p1_control & mask) == mask for mask in WINNING_MASKS)
    
    if p0_wins and p1_wins:
        return -1  # Tie
    if p0_wins:
        return 0
    if p1_wins:
        return 1
        
    return None


def get_control(game: GameConfig, player: int):
    l_any = game.p0_l | game.p1_l
    m_any = game.p0_m | game.p1_m

    if player == 0:
        return (
            game.p0_l |
            (game.p0_m & ~l_any) |
            (game.p0_s & ~l_any & ~m_any)
        )

    else:
        return (
            game.p1_l |
            (game.p1_m & ~l_any) |
            (game.p1_s & ~l_any & ~m_any)
        )


def get_score(game: GameConfig, player: int) -> int:
    winner = get_winner(game)

    if winner == player:
        return 100000

    score = 0
    control = get_control(game, player)

    for mask in WINNING_MASKS:
        pieces = (control & mask).bit_count()

        if pieces == 2:
            score += 100

    return score


def move_score(game: GameConfig, player: int, move: Move) -> int:
    # Score moves based on how many lines they create or block
    new_game = play_move(game, player, move)
    return get_score(new_game, player)



WIN_SCORE = 1000000

def negamax(game, player, alpha, beta, limit):
    winner = get_winner(game)

    if winner is not None:
        if winner == -1:
            return 0, None
        elif winner == player:
            # add a bonus for winning sooner
            return WIN_SCORE + limit, None
        else:
            return -WIN_SCORE - limit, None
    
    if limit <= 0:
        return get_score(game, player), None

    moves = get_possible_moves(game, player)

    if not moves:
        return 0, None

    moves.sort(
        key=lambda m: move_score(game, player, m),
        reverse=True,
    )

    best_move = None
    best_score = -float("inf")

    for move in moves:
        child = play_move(game, player, move)
        score, _ = negamax(child, 1-player, -beta, -alpha, limit - 1)
        score = -score

        if score > best_score:
            best_score = score
            best_move = move
 
        alpha = max(alpha, score)

        if alpha >= beta:
            break

    return best_score, best_move


def select_move_alphabeta(game_config: GameConfig, color, limit):
    return negamax(game_config, color, -float("inf"), float("inf"), limit)
