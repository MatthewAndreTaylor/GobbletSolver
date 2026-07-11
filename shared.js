/*******************************************************
 * Author: Matthew Taylor
 * Created: 2024
 *******************************************************/

const WINNING_MASKS = [
    0b000_000_111,  // Row 0
    0b000_111_000,  // Row 1
    0b111_000_000,  // Row 2
    0b001_001_001,  // Col 0
    0b010_010_010,  // Col 1
    0b100_100_100,  // Col 2
    0b100_010_001,  // Diag 1
    0b001_010_100,  // Diag 2
];

class GameConfig {
    constructor(p0_s, p0_m, p0_l, p1_s, p1_m, p1_l, p0_unused, p1_unused) {
        this.p0_s = p0_s; this.p0_m = p0_m; this.p0_l = p0_l;
        this.p1_s = p1_s; this.p1_m = p1_m; this.p1_l = p1_l;
        this.p0_unused = p0_unused; // [small, medium, large]
        this.p1_unused = p1_unused; // [small, medium, large]
    }
}

class Move {
    constructor(size, start_sq, end_sq) {
        this.size = size;
        this.start_sq = start_sq; // null if from unused
        this.end_sq = end_sq;
    }
}

function getWinner(game) {
    const l_any = game.p0_l | game.p1_l;
    const m_any = game.p0_m | game.p1_m;

    const vis_0_l = game.p0_l;
    const vis_0_m = game.p0_m & ~l_any;
    const vis_0_s = game.p0_s & ~l_any & ~m_any;
    const p0_control = vis_0_l | vis_0_m | vis_0_s;

    for (let mask of WINNING_MASKS) {
        if ((p0_control & mask) === mask) return 0;
    }

    const vis_1_l = game.p1_l;
    const vis_1_m = game.p1_m & ~l_any;
    const vis_1_s = game.p1_s & ~l_any & ~m_any;
    const p1_control = vis_1_l | vis_1_m | vis_1_s;

    for (let mask of WINNING_MASKS) {
        if ((p1_control & mask) === mask) return 1;
    }

    return null;
}

function getTopPiece(game, sq) {
    const mask = 1 << sq;
    if (game.p0_l & mask) return { color: 0, size: 2 };
    if (game.p1_l & mask) return { color: 1, size: 2 };
    if (game.p0_m & mask) return { color: 0, size: 1 };
    if (game.p1_m & mask) return { color: 1, size: 1 };
    if (game.p0_s & mask) return { color: 0, size: 0 };
    if (game.p1_s & mask) return { color: 1, size: 0 };
    return null;
}

function getBits(mask) {
    const bits = [];
    for (let i = 0; i < 9; i++) {
        if (mask & (1 << i)) bits.push(i);
    }
    return bits;
}

function getPossibleMoves(game, player) {
    const moves = [];
    if (getWinner(game) !== null) return moves;

    const unused = player === 0 ? game.p0_unused : game.p1_unused;
    const l_any = game.p0_l | game.p1_l;
    const m_any = game.p0_m | game.p1_m;
    const s_any = game.p0_s | game.p1_s;

    // JavaScript bitwise operations are 32-bit signed, restrict inversion to our 9-bit board layout
    const can_place_l = (~l_any) & 0x1FF;
    const can_place_m = (~(l_any | m_any)) & 0x1FF;
    const can_place_s = (~(l_any | m_any | s_any)) & 0x1FF;

    if (unused[2] > 0) {
        for (let sq of getBits(can_place_l)) moves.push(new Move(2, null, sq));
    }
    if (unused[1] > 0) {
        for (let sq of getBits(can_place_m)) moves.push(new Move(1, null, sq));
    }
    if (unused[0] > 0) {
        for (let sq of getBits(can_place_s)) moves.push(new Move(0, null, sq));
    }

    const vis_l = player === 0 ? game.p0_l : game.p1_l;
    const vis_m = (player === 0 ? game.p0_m : game.p1_m) & ~l_any;
    const vis_s = (player === 0 ? game.p0_s : game.p1_s) & ~(l_any | m_any);

    for (let sq of getBits(vis_l)) {
        for (let target of getBits(can_place_l)) {
            if (target !== sq) moves.push(new Move(2, sq, target));
        }
    }
    for (let sq of getBits(vis_m)) {
        for (let target of getBits(can_place_m)) {
            if (target !== sq) moves.push(new Move(1, sq, target));
        }
    }
    for (let sq of getBits(vis_s)) {
        for (let target of getBits(can_place_s)) {
            if (target !== sq) moves.push(new Move(0, sq, target));
        }
    }

    return moves;
}

function nextPlayer(player) {
    return 1 - player;
}

function playMove(game, player, move) {
    let p0_s = game.p0_s, p0_m = game.p0_m, p0_l = game.p0_l;
    let p1_s = game.p1_s, p1_m = game.p1_m, p1_l = game.p1_l;
    let p0_u = [...game.p0_unused], p1_u = [...game.p1_unused];

    const { size, start_sq, end_sq } = move;

    if (start_sq !== null) {
        const mask = ~(1 << start_sq);
        if (player === 0) {
            if (size === 0) p0_s &= mask;
            else if (size === 1) p0_m &= mask;
            else p0_l &= mask;
        } else {
            if (size === 0) p1_s &= mask;
            else if (size === 1) p1_m &= mask;
            else p1_l &= mask;
        }
    } else {
        if (player === 0) p0_u[size] -= 1;
        else p1_u[size] -= 1;
    }

    const target_mask = 1 << end_sq;
    if (player === 0) {
        if (size === 0) p0_s |= target_mask;
        else if (size === 1) p0_m |= target_mask;
        else p0_l |= target_mask;
    } else {
        if (size === 0) p1_s |= target_mask;
        else if (size === 1) p1_m |= target_mask;
        else p1_l |= target_mask;
    }

    return new GameConfig(p0_s, p0_m, p0_l, p1_s, p1_m, p1_l, p0_u, p1_u);
}

function getScore(game, player) {
    const winner = getWinner(game);
    if (winner === player) return 1000;
    if (winner === nextPlayer(player)) return -1000;
    return 0;
}

function alphabetaMinNode(board, color, alpha, beta, limit) {
    const nextCol = nextPlayer(color);
    const moves = getPossibleMoves(board, nextCol);
    let bestMove = null;
    let bestUtility = Infinity;

    if (limit <= 0 || moves.length === 0) {
        return [null, getScore(board, color)];
    }

    for (let move of moves) {
        const newBoard = playMove(board, nextCol, move);
        const [_, utility] = alphabetaMaxNode(newBoard, color, alpha, beta, limit - 1);

        if (utility < bestUtility) {
            bestMove = move;
            bestUtility = utility;
        }

        beta = Math.min(beta, utility);
        if (beta <= alpha) break;
    }

    return [bestMove, bestUtility];
}

function alphabetaMaxNode(board, color, alpha, beta, limit) {
    const moves = getPossibleMoves(board, color);
    let bestMove = null;
    let bestUtility = -Infinity;

    if (limit <= 0 || moves.length === 0) {
        return [null, getScore(board, color)];
    }

    for (let move of moves) {
        const newBoard = playMove(board, color, move);
        const [_, utility] = alphabetaMinNode(newBoard, color, alpha, beta, limit - 1);

        if (utility > bestUtility) {
            bestMove = move;
            bestUtility = utility;
        }

        alpha = Math.max(alpha, utility);
        if (beta <= alpha) break;
    }

    return [bestMove, bestUtility];
}

function selectMoveAlphabeta(gameConfig, color, limit) {
    return alphabetaMaxNode(gameConfig, color, -Infinity, Infinity, limit);
}