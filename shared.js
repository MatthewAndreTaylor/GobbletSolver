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
    constructor(p0_s, p0_m, p0_l, p1_s, p1_m, p1_l, p0_unused, p1_unused, last_player = null) {
        this.p0_s = p0_s; this.p0_m = p0_m; this.p0_l = p0_l;
        this.p1_s = p1_s; this.p1_m = p1_m; this.p1_l = p1_l;
        this.p0_unused = p0_unused; // [small, medium, large]
        this.p1_unused = p1_unused; // [small, medium, large]
        this.last_player = last_player;
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

    const vis_1_l = game.p1_l;
    const vis_1_m = game.p1_m & ~l_any;
    const vis_1_s = game.p1_s & ~l_any & ~m_any;
    const p1_control = vis_1_l | vis_1_m | vis_1_s;

    const p0_wins = WINNING_MASKS.some(mask => (p0_control & mask) === mask);
    const p1_wins = WINNING_MASKS.some(mask => (p1_control & mask) === mask);
    if (p0_wins && p1_wins) {
        // An uncovered opponent's line wins before the moving piece completes its line.
        return game.last_player === null ? -1 : nextPlayer(game.last_player);
    }
    if (p0_wins) return 0;
    if (p1_wins) return 1;
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

    return new GameConfig(p0_s, p0_m, p0_l, p1_s, p1_m, p1_l, p0_u, p1_u, player);
}

const WIN_SCORE = 1000000;
const DRAW_SCORE = 10000;
const REPETITION_LIMIT = 4;
const Bound = Object.freeze({ EXACT: 0, LOWER: 1, UPPER: -1 });

function positionKey(game, player) {
    return [game.p0_s, game.p0_m, game.p0_l, game.p1_s, game.p1_m,
        game.p1_l, ...game.p0_unused, ...game.p1_unused, player].join(',');
}

function isRepetitionDraw(history) {
    const current = history[history.length - 1];
    return history.filter(key => key === current).length >= REPETITION_LIMIT;
}

function advanceHistory(history, game, player, move) {
    // A reserve placement is irreversible, so earlier positions cannot recur.
    return [...(move.start_sq === null ? [] : history), positionKey(game, player)];
}

function getScore(game, player) {
    const winner = getWinner(game);
    if (winner === player) return WIN_SCORE;
    if (winner === nextPlayer(player)) return -WIN_SCORE;
    if (winner === -1) return 0;

    const large = game.p0_l | game.p1_l;
    const medium = game.p0_m | game.p1_m;
    const controls = [
        game.p0_l | (game.p0_m & ~large) | (game.p0_s & ~(large | medium)),
        game.p1_l | (game.p1_m & ~large) | (game.p1_s & ~(large | medium)),
    ];
    let score = 0;
    for (const mask of WINNING_MASKS) {
        for (let side = 0; side < 2; side++) {
            const pieces = controls[side] & mask;
            const remaining = pieces & (pieces - 1);
            if (remaining && !(remaining & (remaining - 1))) {
                score += side === player ? 100 : -100;
            }
        }
    }
    return score;
}

class SearchTimeout extends Error {}

function repetitionCounts(board, player, history) {
    const counts = new Map();
    for (const key of history) counts.set(key, (counts.get(key) || 0) + 1);
    const current = positionKey(board, player);
    if (history[history.length - 1] !== current) {
        counts.set(current, (counts.get(current) || 0) + 1);
    }
    return counts;
}

function negamax(board, player, alpha, beta, limit, table = new Map(), deadline = Infinity, history = []) {
    return searchNegamax(board, player, alpha, beta, limit, table, deadline,
        repetitionCounts(board, player, history), player);
}

function searchNegamax(board, player, alpha, beta, limit, table, deadline, counts, rootPlayer) {
    if (deadline !== Infinity && Date.now() >= deadline) throw new SearchTimeout();
    // Draw utility is relative to the root so negation preserves its preference.
    const drawScore = player === rootPlayer ? DRAW_SCORE : -DRAW_SCORE;
    const winner = getWinner(board);
    if (winner !== null) {
        const score = getScore(board, player);
        // Remaining depth rewards faster wins and penalizes faster losses.
        return [null, score === 0 ? drawScore : score + Math.sign(score) * Math.max(0, limit)];
    }
    const current = positionKey(board, player);
    if (counts.get(current) >= REPETITION_LIMIT) return [null, drawScore];
    if (limit <= 0) return [null, getScore(board, player)];

    // Values depend on remaining depth, root draw preference, and repetition history.
    const key = `${current}|${limit}|${rootPlayer}|${[...counts].sort()
        .map(([position, count]) => `${position}:${count}`).join(';')}`;
    const cached = table.get(key);
    if (cached) {
        if (cached.bound === Bound.EXACT) return [cached.move, cached.score];
        if (cached.bound === Bound.LOWER) alpha = Math.max(alpha, cached.score);
        else beta = Math.min(beta, cached.score);
        if (alpha >= beta) return [cached.move, cached.score];
    }
    const originalAlpha = alpha;
    const originalBeta = beta;
    const children = getPossibleMoves(board, player).map(move => {
        const child = playMove(board, player, move);
        return { move, child, score: getScore(child, player) };
    });
    if (children.length === 0) return [null, drawScore];
    children.sort((a, b) => b.score - a.score);

    let bestMove = null;
    let bestUtility = -Infinity;
    for (const { move, child } of children) {
        const childKey = positionKey(child, nextPlayer(player));
        const childCounts = move.start_sq === null ? new Map() : counts;
        const previousCount = childCounts.get(childKey) || 0;
        childCounts.set(childKey, previousCount + 1);
        let childScore;
        try {
            [, childScore] = searchNegamax(child, nextPlayer(player), -beta, -alpha,
                limit - 1, table, deadline, childCounts, rootPlayer);
        } finally {
            // Restore the path even when a time-limited iteration is interrupted.
            if (previousCount) childCounts.set(childKey, previousCount);
            else childCounts.delete(childKey);
        }
        const utility = childScore === 0 ? 0 : -childScore;
        if (utility > bestUtility) {
            bestMove = move;
            bestUtility = utility;
        }
        alpha = Math.max(alpha, utility);
        if (beta <= alpha) break;
    }
    const bound = bestUtility <= originalAlpha ? Bound.UPPER
        : bestUtility >= originalBeta ? Bound.LOWER : Bound.EXACT;
    // Bound memory while keeping the search correct when the cache is full.
    if (table.size < 100000) table.set(key, { move: bestMove, score: bestUtility, bound });
    return [bestMove, bestUtility];
}

function selectMoveAlphabeta(gameConfig, color, limit, timeLimitMs, history = []) {
    const counts = repetitionCounts(gameConfig, color, history);
    const table = new Map();
    if (timeLimitMs === undefined || limit <= 0 || getWinner(gameConfig) !== null
        || counts.get(positionKey(gameConfig, color)) >= REPETITION_LIMIT) {
        return searchNegamax(gameConfig, color, -Infinity, Infinity,
            limit, table, Infinity, counts, color);
    }
    const deadline = Date.now() + timeLimitMs;
    const moves = getPossibleMoves(gameConfig, color);
    if (moves.length === 0) return [null, DRAW_SCORE];
    let result = [moves[0], getScore(gameConfig, color)];
    // shortcut: bounded search is heuristic; perfect play requires a solved tablebase.
    for (let depth = 1; depth <= limit; depth++) {
        try {
            // Only a completed iteration may replace the chosen move.
            result = searchNegamax(gameConfig, color, -Infinity, Infinity, depth, table, deadline, counts, color);
        } catch (error) {
            if (!(error instanceof SearchTimeout)) throw error;
            break;
        }
        if (Math.abs(result[1]) >= WIN_SCORE) break;
    }
    return result;
}
