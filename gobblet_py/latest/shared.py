from typing import NamedTuple


WINNING_MASKS = [
    0b000_000_111,  # Row 0
    0b000_111_000,  # Row 1
    0b111_000_000,  # Row 2
    0b001_001_001,  # Col 0
    0b010_010_010,  # Col 1
    0b100_100_100,  # Col 2
    0b100_010_001,  # Diag 1
    0b001_010_100,  # Diag 2
]

class GameConfig(NamedTuple):
    # Bitboards for player 0 (bits 0-8 represent squares left-to-right, top-to-bottom)
    p0_s: int
    p0_m: int
    p0_l: int
    
    # Bitboards for player 1
    p1_s: int
    p1_m: int
    p1_l: int
    
    # Counts of unused pieces: (small, medium, large)
    p0_unused: tuple[int, int, int]
    p1_unused: tuple[int, int, int]

class Move(NamedTuple):
    size: int               # 0 = small, 1 = medium, 2 = large
    start_sq: int | None    # 0-8 for board positions, None if placing from unused
    end_sq: int             # 0-8 for destination

def get_winner(game: GameConfig) -> int | None:
    l_any = game.p0_l | game.p1_l
    m_any = game.p0_m | game.p1_m

    # A piece is visible if no larger piece is occupying the same square
    vis_0_l = game.p0_l
    vis_0_m = game.p0_m & ~l_any
    vis_0_s = game.p0_s & ~l_any & ~m_any
    p0_control = vis_0_l | vis_0_m | vis_0_s

    for mask in WINNING_MASKS:
        if (p0_control & mask) == mask:
            return 0

    vis_1_l = game.p1_l
    vis_1_m = game.p1_m & ~l_any
    vis_1_s = game.p1_s & ~l_any & ~m_any
    p1_control = vis_1_l | vis_1_m | vis_1_s

    for mask in WINNING_MASKS:
        if (p1_control & mask) == mask:
            return 1

    return None

def get_top_piece(game: GameConfig, sq: int) -> tuple[int | None, int | None]:
    """Returns (color, size) of the top piece on a given square, or (None, None)."""
    mask = 1 << sq
    if game.p0_l & mask: return 0, 2
    if game.p1_l & mask: return 1, 2
    if game.p0_m & mask: return 0, 1
    if game.p1_m & mask: return 1, 1
    if game.p0_s & mask: return 0, 0
    if game.p1_s & mask: return 1, 0
    return None, None

def get_bits(mask: int):
    for i in range(9):
        if mask & (1 << i):
            yield i

def get_possible_moves(game: GameConfig, player: int) -> list[Move]:
    moves: list[Move] = []
    if get_winner(game) is not None:
        return moves

    unused = game.p0_unused if player == 0 else game.p1_unused
    
    # Combined bitmasks of all pieces by size across both players
    l_any = game.p0_l | game.p1_l
    m_any = game.p0_m | game.p1_m
    s_any = game.p0_s | game.p1_s

    # Squares available for placing pieces of various sizes
    can_place_l = ~l_any & 0x1FF
    can_place_m = ~(l_any | m_any) & 0x1FF
    can_place_s = ~(l_any | m_any | s_any) & 0x1FF

    # Placing unused pieces
    if unused[2] > 0:
        for sq in get_bits(can_place_l): moves.append(Move(2, None, sq))
    if unused[1] > 0:
        for sq in get_bits(can_place_m): moves.append(Move(1, None, sq))
    if unused[0] > 0:
        for sq in get_bits(can_place_s): moves.append(Move(0, None, sq))

    # Moving visible pieces on the board
    vis_l = game.p0_l if player == 0 else game.p1_l
    vis_m = (game.p0_m if player == 0 else game.p1_m) & ~l_any
    vis_s = (game.p0_s if player == 0 else game.p1_s) & ~(l_any | m_any)

    for sq in get_bits(vis_l):
        for target in get_bits(can_place_l):
            if target != sq: moves.append(Move(2, sq, target))

    for sq in get_bits(vis_m):
        for target in get_bits(can_place_m):
            if target != sq: moves.append(Move(1, sq, target))

    for sq in get_bits(vis_s):
        for target in get_bits(can_place_s):
            if target != sq: moves.append(Move(0, sq, target))

    return moves

def next_player(player: int) -> int:
    return 1 - player

def play_move(game: GameConfig, player: int, move: Move) -> GameConfig:
    p0_s, p0_m, p0_l = game.p0_s, game.p0_m, game.p0_l
    p1_s, p1_m, p1_l = game.p1_s, game.p1_m, game.p1_l
    p0_u, p1_u = list(game.p0_unused), list(game.p1_unused)

    size, start_sq, end_sq = move
    
    if start_sq is not None:
        mask = ~(1 << start_sq)
        if player == 0:
            if size == 0: p0_s &= mask
            elif size == 1: p0_m &= mask
            else: p0_l &= mask
        else:
            if size == 0: p1_s &= mask
            elif size == 1: p1_m &= mask
            else: p1_l &= mask
    else:
        if player == 0: p0_u[size] -= 1
        else: p1_u[size] -= 1

    target_mask = 1 << end_sq
    if player == 0:
        if size == 0: p0_s |= target_mask
        elif size == 1: p0_m |= target_mask
        else: p0_l |= target_mask
    else:
        if size == 0: p1_s |= target_mask
        elif size == 1: p1_m |= target_mask
        else: p1_l |= target_mask

    return GameConfig(
        p0_s, p0_m, p0_l,
        p1_s, p1_m, p1_l,
        tuple(p0_u), tuple(p1_u)
    )

def compute_utility_simple(game: GameConfig, player: int) -> int:
    winner = get_winner(game)
    if winner == next_player(player):
        return -1000
    if winner == player:
        return 1000
    return 0


EXACT = 0
LOWERBOUND = 1
UPPERBOUND = 2

def alphabeta_min_node(board, color, alpha, beta, limit, tt):
    next_col = next_player(color)
    state_key = (board, next_col)

    if state_key in tt:
        entry_depth, flag, value, move = tt[state_key]
        if entry_depth >= limit:
            if flag == EXACT:
                return move, value
            elif flag == LOWERBOUND:
                alpha = max(alpha, value)
            elif flag == UPPERBOUND:
                beta = min(beta, value)
            
            if alpha >= beta:
                return move, value

    moves = get_possible_moves(board, next_col)
    
    if limit <= 0 or not moves:
        return None, compute_utility_simple(board, color)

    best_move = None
    best_utility = float("inf")
    original_beta = beta

    evaluated = []
    for move in moves:
        new_board = play_move(board, next_col, move)
        util = compute_utility_simple(new_board, color)
        evaluated.append((move, new_board, util))

    evaluated.sort(key=lambda t: t[2])

    for move, new_board, _ in evaluated:
        _, utility = alphabeta_max_node(new_board, color, alpha, beta, limit - 1, tt)
        
        if utility < best_utility:
            best_move = move
            best_utility = utility
            
        beta = min(beta, utility)
        if beta <= alpha:
            break

    flag = EXACT
    if best_utility <= alpha:
        flag = UPPERBOUND
    elif best_utility >= original_beta:
        flag = LOWERBOUND
        
    tt[state_key] = (limit, flag, best_utility, best_move)
    return best_move, best_utility


def alphabeta_max_node(board, color, alpha, beta, limit, tt):
    state_key = (board, color)
    
    if state_key in tt:
        entry_depth, flag, value, move = tt[state_key]
        if entry_depth >= limit:
            if flag == EXACT:
                return move, value
            elif flag == LOWERBOUND:
                alpha = max(alpha, value)
            elif flag == UPPERBOUND:
                beta = min(beta, value)
            
            if alpha >= beta:
                return move, value

    moves = get_possible_moves(board, color)
    
    if limit <= 0 or not moves:
        return None, compute_utility_simple(board, color)

    best_move = None
    best_utility = float("-inf")
    original_alpha = alpha

    evaluated = []
    for move in moves:
        new_board = play_move(board, color, move)
        util = compute_utility_simple(new_board, color)
        evaluated.append((move, new_board, util))

    evaluated.sort(key=lambda t: t[2], reverse=True)

    for move, new_board, _ in evaluated:
        _, utility = alphabeta_min_node(new_board, color, alpha, beta, limit - 1, tt)
        
        if utility > best_utility:
            best_move = move
            best_utility = utility
            
        alpha = max(alpha, utility)
        if beta <= alpha:
            break

    flag = EXACT
    if best_utility <= original_alpha:
        flag = UPPERBOUND
    elif best_utility >= beta:
        flag = LOWERBOUND
        
    tt[state_key] = (limit, flag, best_utility, best_move)
    return best_move, best_utility


def select_move_alphabeta(game_config: GameConfig, color, limit):
    return alphabeta_max_node(game_config, color, float("-inf"), float("inf"), limit, tt={})