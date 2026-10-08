// Run: node tools/verify_opening.js --opening
// Independent bounded proof for 3x3 Gobblet Gobblers with fourfold repetition.
// No imports from either production engine; a false result only means no win within the bound.
// A square has three base-3 digits (small, medium, large): 0 empty, 1 human, 2 AI.
const assert = require("node:assert/strict");

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];
const LAYER = [1, 3, 9];
const SQUARE = Array.from({ length: 9 }, (_, i) => 27 ** i);
const TOP_SIZE = [], TOP_OWNER = [];
for (let square = 0; square < 27; square++) {
  TOP_SIZE[square] = -1;
  TOP_OWNER[square] = -1;
  for (let size = 0; size < 3; size++) {
    const owner = Math.floor(square / LAYER[size]) % 3;
    if (owner) {
      TOP_SIZE[square] = size;
      TOP_OWNER[square] = owner - 1;
    }
  }
}

const REPLAY = [
  [0, 2, null, 4], [1, 2, null, 0], [0, 2, null, 6],
  [1, 1, null, 2], [0, 2, 6, 2], [1, 1, null, 6],
  [0, 2, 4, 6], [1, 2, null, 4], [0, 1, null, 8],
  [1, 2, 0, 8], [0, 1, null, 0], [1, 0, null, 5],
  [0, 0, null, 3],
];

function initialState() {
  return { squares: Array(9).fill(0), reserve: [[2, 2, 2], [2, 2, 2]], key: 0 };
}

function winner(state, nextPlayer) {
  const won = [false, false];
  for (const [a, b, c] of LINES) {
    const owner = TOP_OWNER[state.squares[a]];
    if (owner !== -1 && owner === TOP_OWNER[state.squares[b]] && owner === TOP_OWNER[state.squares[c]]) {
      won[owner] = true;
    }
  }
  // If lifting exposes the opponent's line and it remains uncovered, the mover loses.
  return won[nextPlayer] ? nextPlayer : won[1 - nextPlayer] ? 1 - nextPlayer : null;
}

function legalMoves(state, player) {
  const moves = [];
  // Ordering changes proof runtime only; every legal defense is still considered.
  for (const size of [2, 1, 0]) {
    if (state.reserve[player][size] > 0) {
      for (const end of [4, 0, 2, 6, 8, 1, 3, 5, 7]) {
        if (size > TOP_SIZE[state.squares[end]]) moves.push([player, size, null, end]);
      }
    }
    for (let start = 0; start < 9; start++) {
      if (TOP_OWNER[state.squares[start]] !== player || TOP_SIZE[state.squares[start]] !== size) continue;
      for (const end of [4, 0, 2, 6, 8, 1, 3, 5, 7]) {
        if (end !== start && size > TOP_SIZE[state.squares[end]]) moves.push([player, size, start, end]);
      }
    }
  }
  return moves;
}

function apply(state, [player, size, start, end], direction = 1) {
  const piece = (player + 1) * LAYER[size] * direction;
  if (start === null) state.reserve[player][size] -= direction;
  else {
    state.squares[start] -= piece;
    state.key -= piece * SQUARE[start];
  }
  state.squares[end] += piece;
  state.key += piece * SQUARE[end];
}

function positionKey(state, player) {
  // With two pieces per size/player, reserves follow from all board layers.
  return state.key * 2 + player;
}

function proofSearch(seconds = 60) {
  const memo = new Map();
  const deadline = performance.now() + seconds * 1000;
  let nodes = 0;
  let repetitionDraws = 0;
  function humanCanForceWin(state, player, remaining, history = []) {
    const counts = new Map();
    for (const key of history) counts.set(key, (counts.get(key) || 0) + 1);
    const current = positionKey(state, player);
    if (history[history.length - 1] !== current) counts.set(current, (counts.get(current) || 0) + 1);
    return search(state, player, remaining, counts);
  }
  function search(state, player, remaining, counts) {
    if (++nodes % 16384 === 0 && performance.now() > deadline) throw Error("proof time budget exhausted");
    const terminal = winner(state, player);
    if (terminal !== null) return terminal === 0;
    const current = positionKey(state, player);
    if (counts.get(current) >= 4) {
      repetitionDraws++;
      return false;
    }
    if (remaining === 0) return false;
    // Identical boards can have different results when repetition counts differ.
    const key = `${current}|${[...counts].sort((a, b) => a[0] - b[0])
      .map(([position, count]) => `${position}:${count}`).join(';')}`;
    const cached = memo.get(key);
    if (cached && remaining >= cached.win) return true;
    if (cached && remaining <= cached.fail) return false;
    const moves = legalMoves(state, player);
    // Put immediate wins first without giving them a numerical evaluation score.
    for (let i = 0; i < moves.length; i++) {
      apply(state, moves[i]);
      const win = winner(state, 1 - player);
      apply(state, moves[i], -1);
      if (win === player) {
        [moves[0], moves[i]] = [moves[i], moves[0]];
        break;
      }
    }
    let result = player === 1 && moves.length > 0;
    for (const move of moves) {
      apply(state, move);
      // Reserve placements cannot return to any earlier complete position.
      const childCounts = move[2] === null ? new Map() : counts;
      const childKey = positionKey(state, 1 - player);
      const previousCount = childCounts.get(childKey) || 0;
      childCounts.set(childKey, previousCount + 1);
      let child;
      try {
        child = search(state, 1 - player, remaining - 1, childCounts);
      } finally {
        if (previousCount) childCounts.set(childKey, previousCount);
        else childCounts.delete(childKey);
        apply(state, move, -1);
      }
      if (player === 0 && child) { result = true; break; }
      if (player === 1 && !child) { result = false; break; }
    }
    const entry = cached || { win: Infinity, fail: -1 };
    if (result) entry.win = Math.min(entry.win, remaining);
    else entry.fail = Math.max(entry.fail, remaining);
    if (memo.size < 500000 || cached) memo.set(key, entry);
    return result;
  }
  return { humanCanForceWin, stats: () => ({ nodes, cachedPositions: memo.size, repetitionDraws }) };
}

function selfCheck() {
  const state = initialState();
  assert.equal(legalMoves(state, 0).length, 27);
  apply(state, [0, 0, null, 4]);
  apply(state, [1, 1, null, 4]);
  assert.equal(TOP_OWNER[state.squares[4]], 1);
  assert.ok(!legalMoves(state, 0).some(move => move[2] === 4));
  assert.ok(!legalMoves(state, 0).some(move => move[1] === 1 && move[3] === 4));
  apply(state, [1, 1, 4, 0]);
  assert.equal(TOP_OWNER[state.squares[4]], 0);
  apply(state, [1, 1, 4, 0], -1);
  apply(state, [1, 1, null, 4], -1);
  apply(state, [0, 0, null, 4], -1);
  assert.deepEqual(state, initialState());
  const bothLines = { squares: [1, 1, 1, 2, 2, 2, 0, 0, 0] };
  assert.equal(winner(bothLines, 0), 0);
  assert.equal(winner(bothLines, 1), 1);
}

function verifyReplay() {
  selfCheck();
  const state = initialState();
  const positions = [structuredClone(state)];
  const history = [positionKey(state, 0)];
  REPLAY.forEach((move, i) => {
    assert.equal(move[0], i % 2);
    assert.equal(winner(state, move[0]), null, `terminal before replay move ${i + 1}`);
    assert.ok(legalMoves(state, move[0]).some(candidate =>
      candidate.every((value, j) => value === move[j])), `illegal replay move ${i + 1}`);
    apply(state, move);
    positions.push(structuredClone(state));
    history.push(positionKey(state, 1 - move[0]));
    assert.ok(history.filter(key => key === history[history.length - 1]).length < 4,
      `fourfold draw on replay move ${i + 1}`);
  });
  assert.equal(winner(state, 1), 0);
  console.log(JSON.stringify({ replayLegal: true, winner: "human", plies: REPLAY.length }));
  for (const [ply, depth, expected] of [[11, 2, 14], [9, 4, 14], [7, 6, 18]]) {
    const search = proofSearch();
    const position = positions[ply];
    const defenses = legalMoves(position, 1);
    assert.equal(defenses.length, expected);
    for (const move of defenses) {
      apply(position, move);
      assert.ok(search.humanCanForceWin(position, 0, depth - 1,
        [...history.slice(0, ply + 1), positionKey(position, 0)]), `unproven defense ${move}`);
      apply(position, move, -1);
    }
    console.log(JSON.stringify({ afterPly: ply, forcedHumanWinWithin: depth, allDefenses: defenses.length, ...search.stats() }));
  }
  return positions;
}

function verifyOpening(position, seconds) {
  const search = proofSearch(seconds);
  const start = performance.now();
  const defenses = legalMoves(position, 1);
  assert.equal(defenses.length, 24);
  let provenDefenses = 0;
  for (const move of defenses) {
    apply(position, move);
    let proven;
    try {
      proven = search.humanCanForceWin(position, 0, 11);
    } catch (error) {
      console.log(JSON.stringify({ openingProven: false, incomplete: true, reason: error.message, provenDefenses, totalDefenses: defenses.length, ...search.stats() }));
      return false;
    } finally {
      apply(position, move, -1);
    }
    console.log(JSON.stringify({ defense: move, humanWinWithin11FurtherPlies: proven, seconds: (performance.now() - start) / 1000, ...search.stats() }));
    if (!proven) return false;
    provenDefenses++;
  }
  console.log(JSON.stringify({ openingProven: true, repetitionLimit: 4, forcedHumanWinWithin: 12, allDefenses: defenses.length, ...search.stats() }));
  return true;
}

if (require.main === module) {
  const positions = verifyReplay();
  if (process.argv.includes("--opening")) {
    process.exitCode = verifyOpening(positions[1], Number(process.env.PROOF_SECONDS || 120)) ? 0 : 1;
  }
}

module.exports = { initialState, legalMoves, apply, winner, positionKey, proofSearch, verifyReplay, verifyOpening };
