const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { GameConfig, getWinner, getPossibleMoves, playMove, selectMoveAlphabeta, WIN_SCORE } =
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../shared.js"), "utf8") +
    ";({ GameConfig, getWinner, getPossibleMoves, playMove, selectMoveAlphabeta, WIN_SCORE })");

// The user's human-first browser game, with squares numbered 0–8 in row order.
const replay = [
  [0, 2, null, 4], [1, 2, null, 0], [0, 2, null, 6],
  [1, 1, null, 2], [0, 2, 6, 2], [1, 1, null, 6],
  [0, 2, 4, 6], [1, 2, null, 4], [0, 1, null, 8],
  [1, 2, 0, 8], [0, 1, null, 0], [1, 0, null, 5],
  [0, 0, null, 3],
].map(([player, size, start_sq, end_sq]) => ({ player, size, start_sq, end_sq }));

function replayPositions() {
  const positions = [new GameConfig(0, 0, 0, 0, 0, 0, [2, 2, 2], [2, 2, 2])];
  for (const move of replay) positions.push(playMove(positions.at(-1), move.player, move));
  return positions;
}

// Unpruned distance proof using the verifier's separate square-stack rules.
// Fourfold repetition cannot occur within this four-ply continuation of move 9.
const reference = require("../tools/verify_opening.js");
function pliesUntilHumanWin(state, player, remaining) {
  const winner = reference.winner(state, player);
  if (winner !== null) return winner === 0 ? 0 : Infinity;
  if (remaining === 0) return Infinity;
  const moves = reference.legalMoves(state, player);
  if (moves.length === 0) return Infinity;
  let result = player === 0 ? Infinity : -Infinity;
  for (const move of moves) {
    reference.apply(state, move);
    const distance = 1 + pliesUntilHumanWin(state, 1 - player, remaining - 1);
    reference.apply(state, move, -1);
    result = player === 0 ? Math.min(result, distance) : Math.max(result, distance);
  }
  return result;
}

test("both colors choose the defense that prolongs a forced loss, including timed searches", () => {
  const state = reference.initialState();
  for (const { player, size, start_sq, end_sq } of replay.slice(0, 9)) {
    reference.apply(state, [player, size, start_sq, end_sq]);
  }
  const distances = reference.legalMoves(state, 1).map(move => {
    reference.apply(state, move);
    const distance = 1 + pliesUntilHumanWin(state, 0, 3);
    reference.apply(state, move, -1);
    return { move, distance };
  });
  assert.equal(distances.filter(({ distance }) => distance === 2).length, 13);
  assert.deepEqual(distances.filter(({ distance }) => distance === 4),
    [{ move: [1, 2, 0, 8], distance: 4 }]);

  const game = replayPositions()[9];
  const swapped = new GameConfig(game.p1_s, game.p1_m, game.p1_l,
    game.p0_s, game.p0_m, game.p0_l, game.p1_unused, game.p0_unused, 1);
  for (const [board, player] of [[game, 1], [swapped, 0]]) {
    for (const [depth, budget] of [[4, undefined], [13, 1000]]) {
      const [move, score] = selectMoveAlphabeta(board, player, depth, budget);
      assert.deepEqual([move.size, move.start_sq, move.end_sq], [2, 0, 8]);
      assert.equal(score, -WIN_SCORE);
    }
  }
});

test("both colors exploit a human mistake after delaying defeat", () => {
  const game = replayPositions()[9];
  const swapped = new GameConfig(game.p1_s, game.p1_m, game.p1_l,
    game.p0_s, game.p0_m, game.p0_l, game.p1_unused, game.p0_unused, 1);
  for (const [board, player] of [[game, 1], [swapped, 0]]) {
    const defended = playMove(board, player, { size: 2, start_sq: 0, end_sq: 8 });
    const mistaken = playMove(defended, 1 - player, { size: 1, start_sq: null, end_sq: 1 });
    const [move, score] = selectMoveAlphabeta(mistaken, player, 2);
    assert.deepEqual([move.size, move.start_sq, move.end_sq], [0, null, 0]);
    assert.equal(getWinner(playMove(mistaken, player, move)), player);
    assert.ok(score >= WIN_SCORE);
  }
});

test("the reported browser loss consists of legal alternating moves and ends in a human win", () => {
  const positions = replayPositions();
  replay.forEach((move, index) => {
    assert.equal(move.player, index % 2);
    assert.equal(getWinner(positions[index]), null, `game ended before move ${index + 1}`);
    assert.ok(getPossibleMoves(positions[index], move.player).some(legal =>
      legal.size === move.size && legal.start_sq === move.start_sq && legal.end_sq === move.end_sq
    ), `illegal move ${index + 1}`);
  });
  assert.equal(getWinner(positions.at(-1)), 0);
});

test("every AI defense in the reported final six plies allows a forced human win", () => {
  // Boolean game-tree proof: no heuristic evaluation, alpha-beta bounds, or search cache.
  function humanCanForceWin(game, player, depth) {
    const winner = getWinner(game);
    if (winner !== null) return winner === 0;
    if (depth === 0) return false;
    const moves = getPossibleMoves(game, player);
    const continuation = move => humanCanForceWin(playMove(game, player, move), 1 - player, depth - 1);
    return player === 0 ? moves.some(continuation) : moves.length > 0 && moves.every(continuation);
  }

  const positions = replayPositions();
  for (const [ply, depth, expectedDefenses] of [[7, 6, 18], [9, 4, 14], [11, 2, 14]]) {
    const game = positions[ply];
    const defenses = getPossibleMoves(game, 1);
    assert.equal(defenses.length, expectedDefenses);
    for (const move of defenses) {
      assert.ok(humanCanForceWin(playMove(game, 1, move), 0, depth - 1),
        `unproved AI defense after move ${ply}: ${JSON.stringify(move)}`);
    }
    const [move, score] = selectMoveAlphabeta(game, 1, depth);
    assert.ok(move);
    assert.ok(score <= -WIN_SCORE, `search must recognize the forced loss after move ${ply}`);
  }
});
