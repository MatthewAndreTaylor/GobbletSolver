const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Load the browser script without adding a second engine or runtime dependency.
const engine = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../shared.js"), "utf8") +
    ";({ GameConfig, Move, getWinner, getTopPiece, getPossibleMoves, playMove, getScore, selectMoveAlphabeta, negamax, Bound })"
);
const { GameConfig, Move, getWinner, getTopPiece, getPossibleMoves, playMove,
  getScore, selectMoveAlphabeta, negamax, Bound } = engine;
const plain = (value) => JSON.parse(JSON.stringify(value));
const emptyGame = () => new GameConfig(0, 0, 0, 0, 0, 0, [2, 2, 2], [2, 2, 2]);
const moveKey = ({ size, start_sq, end_sq }) => `${size}:${start_sq}:${end_sq}`;

function swapPlayers(game) {
  return new GameConfig(
    game.p1_s, game.p1_m, game.p1_l, game.p0_s, game.p0_m, game.p0_l,
    [...game.p1_unused], [...game.p0_unused],
    game.last_player == null ? null : 1 - game.last_player
  );
}

// This model uses square stacks and coordinate lines instead of engine bitmasks.
function squareModel(game) {
  return Array.from({ length: 9 }, (_, square) => {
    const pieces = [];
    for (let size = 0; size < 3; size++) {
      for (let player = 0; player < 2; player++) {
        if (game[`p${player}_${["s", "m", "l"][size]}`] & (1 << square)) {
          pieces.push({ color: player, size });
        }
      }
    }
    return pieces;
  });
}

function modelWinner(squares, lastPlayer) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
  ];
  const winners = [0, 1].filter((player) =>
    lines.some((line) => line.every((square) => squares[square].at(-1)?.color === player))
  );
  if (winners.length === 2) return lastPlayer == null ? -1 : 1 - lastPlayer;
  return winners.length ? winners[0] : null;
}

function modelMoves(game, player, squares) {
  if (modelWinner(squares, game.last_player) !== null) return [];
  const moves = [];
  for (let size = 0; size < 3; size++) {
    const starts = [];
    if (game[`p${player}_unused`][size] > 0) starts.push(null);
    squares.forEach((stack, square) => {
      const top = stack.at(-1);
      if (top?.color === player && top.size === size) starts.push(square);
    });
    for (const start_sq of starts) {
      squares.forEach((stack, end_sq) => {
        if (end_sq !== start_sq && (!stack.length || stack.at(-1).size < size)) {
          moves.push({ size, start_sq, end_sq });
        }
      });
    }
  }
  return moves;
}

test("legal moves and state transitions agree with an independent stack model", () => {
  let seed = 0x62beef;
  const randomIndex = (length) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % length;
  };
  for (let trial = 0; trial < 30; trial++) {
    let game = emptyGame();
    let turn = trial % 2;
    for (let ply = 0; ply < 16; ply++) {
      const before = plain(game);
      const squares = squareModel(game);
      assert.equal(getWinner(game), modelWinner(squares, game.last_player));
      squares.forEach((stack, square) => {
        assert.deepEqual(plain(getTopPiece(game, square)), stack.at(-1) ?? null);
      });
      for (const player of [0, 1]) {
        const moves = getPossibleMoves(game, player);
        const expected = modelMoves(game, player, squares);
        assert.deepEqual(Array.from(moves, moveKey).sort(), expected.map(moveKey).sort());
        for (const move of moves) {
          const child = playMove(game, player, move);
          const expectedSquares = plain(squares);
          const unused = [...game[`p${player}_unused`]];
          if (move.start_sq === null) unused[move.size]--;
          else expectedSquares[move.start_sq].pop();
          expectedSquares[move.end_sq].push({ color: player, size: move.size });
          assert.deepEqual(squareModel(child), expectedSquares);
          assert.deepEqual(plain(child[`p${player}_unused`]), unused);
          assert.deepEqual(plain(child[`p${1 - player}_unused`]), plain(game[`p${1 - player}_unused`]));
          assert.equal(getWinner(child), modelWinner(expectedSquares, player));
        }
      }
      assert.deepEqual(plain(game), before, "generating and applying moves must not mutate the parent");
      const moves = getPossibleMoves(game, turn);
      if (!moves.length) break;
      game = playMove(game, turn, moves[randomIndex(moves.length)]);
      turn = 1 - turn;
    }
  }
});

for (const player of [0, 1]) {
  test(`player ${player} takes an immediate win instead of delaying a proven win`, () => {
    // Reachable history: medium->6, large->1, medium->7, medium->5.
    // The old depth-8 solver chose large->3 despite winning immediately at 8.
    let game = new GameConfig(0, 192, 0, 0, 32, 2, [2, 0, 2], [2, 1, 1]);
    if (player === 1) game = swapPlayers(game);
    const snapshot = plain(game);
    const [move, score] = selectMoveAlphabeta(game, player, 8);
    assert.ok(move);
    assert.equal(getWinner(playMove(game, player, move)), player);
    assert.ok(score > 0);
    assert.deepEqual(plain(game), snapshot);
  });

  test(`player ${player} blocks an immediate loss`, () => {
    let game = new GameConfig(0, 16, 0, 0, 3, 0, [2, 1, 2], [2, 0, 2]);
    if (player === 1) game = swapPlayers(game);
    const [move] = selectMoveAlphabeta(game, player, 4);
    assert.ok(move);
    const child = playMove(game, player, move);
    assert.notEqual(getWinner(child), 1 - player);
    for (const reply of getPossibleMoves(child, 1 - player)) {
      assert.notEqual(getWinner(playMove(child, 1 - player, reply)), 1 - player);
    }
  });

  test(`player ${player} loses when uncovering an opponent row while making its own row`, () => {
    let game = new GameConfig(0, 24, 1, 3, 4, 0, [2, 0, 1], [0, 1, 2]);
    if (player === 1) game = swapPlayers(game);
    assert.equal(getWinner(game), null);
    const child = playMove(game, player, new Move(2, 0, 5));
    assert.equal(getWinner(child), 1 - player);
    assert.equal(getPossibleMoves(child, player).length, 0);
    assert.equal(getPossibleMoves(child, 1 - player).length, 0);
  });

  test(`player ${player} can cover another piece in a row exposed by lifting`, () => {
    let game = new GameConfig(0, 24, 1, 3, 4, 0, [2, 0, 1], [0, 1, 2]);
    if (player === 1) game = swapPlayers(game);
    for (const destination of [1, 2]) {
      const move = new Move(2, 0, destination);
      assert.ok(getPossibleMoves(game, player).some((candidate) => moveKey(candidate) === moveKey(move)));
      assert.equal(getWinner(playMove(game, player, move)), null);
    }
  });

  test(`search returns no move once player ${player} has won`, () => {
    let game = new GameConfig(1, 2, 4, 0, 0, 0, [1, 1, 1], [2, 2, 2]);
    if (player === 1) game = swapPlayers(game);
    for (const side of [0, 1]) {
      const [move, score] = selectMoveAlphabeta(game, side, 8);
      assert.equal(move, null);
      assert.equal(Math.sign(score), side === player ? 1 : -1);
    }
  });
}

test("the cutoff evaluation distinguishes positions and is symmetric between players", () => {
  const game = new GameConfig(0, 192, 0, 0, 32, 2, [2, 0, 2], [2, 1, 1]);
  assert.notEqual(getScore(game, 0), 0);
  assert.equal(getScore(game, 0), -getScore(game, 1));
  assert.equal(getScore(swapPlayers(game), 1), getScore(game, 0));
});

test("ambiguous manually constructed simultaneous rows do not favor one color", () => {
  const game = new GameConfig(1, 2, 4, 8, 16, 32, [1, 1, 1], [1, 1, 1]);
  assert.equal(getWinner(game), -1);
  assert.equal(getWinner(swapPlayers(game)), -1);
  assert.equal(getScore(game, 0), 0);
  assert.equal(getScore(game, 1), 0);
});

test("negamax and cached bounds agree with unpruned minimax for both players", () => {
  function minimax(game, root, turn, depth) {
    const winner = getWinner(game);
    if (winner !== null) {
      const score = getScore(game, root);
      return score === 0 ? 0 : score + Math.sign(score) * depth;
    }
    if (depth === 0) return getScore(game, root);
    const moves = getPossibleMoves(game, turn);
    if (!moves.length) return 0;
    let best = turn === root ? -Infinity : Infinity;
    for (const move of moves) {
      const score = minimax(playMove(game, turn, move), root, 1 - turn, depth - 1);
      best = turn === root ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }
  const game = new GameConfig(0, 1, 16, 0, 64, 256, [2, 1, 1], [2, 1, 1]);
  const table = new Map();
  for (const player of [0, 1]) {
    for (const depth of [3, 4]) {
      const [move, score] = selectMoveAlphabeta(game, player, depth);
      const expected = minimax(game, player, player, depth);
      assert.equal(score, expected, `player ${player}, depth ${depth}`);
      assert.equal(minimax(playMove(game, player, move), player, 1 - player, depth - 1), expected);
      for (const [alpha, beta, bound] of [
        [expected - 1, expected, Bound.LOWER],
        [expected, expected + 1, Bound.UPPER],
      ]) {
        const narrowTable = new Map();
        negamax(game, player, alpha, beta, depth, narrowTable);
        assert.ok([...narrowTable.values()].some(entry => entry.bound === bound));
        const [cachedMove, cachedScore] = negamax(game, player, -Infinity, Infinity, depth, narrowTable);
        assert.equal(cachedScore, expected);
        assert.equal(minimax(playMove(game, player, cachedMove), player, 1 - player, depth - 1), expected);
      }
      // Cached scores belong to the side to move, even across different root searches.
      const [, sharedScore] = negamax(game, player, -Infinity, Infinity, depth, table);
      assert.equal(sharedScore, expected);
    }
  }
});
