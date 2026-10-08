const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const engine = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../shared.js"), "utf8") +
    ";({ GameConfig, Move, WIN_SCORE, DRAW_SCORE, REPETITION_LIMIT, positionKey, " +
    "isRepetitionDraw, advanceHistory, getWinner, getPossibleMoves, getScore, " +
    "playMove, selectMoveAlphabeta, negamax })"
);
const { GameConfig, Move, WIN_SCORE, DRAW_SCORE, REPETITION_LIMIT, positionKey,
  isRepetitionDraw, advanceHistory, getWinner, getPossibleMoves, getScore,
  playMove, selectMoveAlphabeta, negamax } = engine;
const moveKey = ({ size, start_sq, end_sq }) => `${size}:${start_sq}:${end_sq}`;
const emptyGame = () => new GameConfig(0, 0, 0, 0, 0, 0, [2, 2, 2], [2, 2, 2]);

// Replay legal moves, stopping one move before the fourth occurrence of a position.
function drawFixture(player, withWinningMove = false) {
  let game = emptyGame();
  let turn = 1 - player;
  const history = [positionKey(game, turn)];
  let parent;
  function apply(move) {
    assert.ok(getPossibleMoves(game, turn).some(legal => moveKey(legal) === moveKey(move)));
    parent = { game, history: [...history], player: turn };
    game = playMove(game, turn, move);
    turn = 1 - turn;
    history.push(positionKey(game, turn));
    assert.equal(getWinner(game), null, "fixture must not continue after a win");
  }
  if (withWinningMove) {
    apply(new Move(1, null, 1));
    apply(new Move(1, null, 6));
  }
  apply(new Move(2, null, 0));
  apply(new Move(2, null, 8));
  for (let cycle = 0; cycle < 3; cycle++) {
    const away = withWinningMove ? 3 : 1;
    apply(new Move(2, 0, away));
    apply(new Move(2, 8, 7));
    apply(new Move(2, away, 0));
    if (cycle < 2) apply(new Move(2, 7, 8));
  }
  assert.equal(turn, player);
  return { game, player, history, parent, drawMove: new Move(2, 7, 8) };
}

test("fourfold repetition distinguishes turns, covered pieces, and reserves", () => {
  assert.equal(REPETITION_LIMIT, 4);
  const game = new GameConfig(1, 0, 0, 0, 0, 17, [1, 2, 2], [2, 2, 0]);
  const key = positionKey(game, 0);
  assert.notEqual(positionKey(game, 1), key);
  const coveredElsewhere = new GameConfig(16, 0, 0, 0, 0, 17, [1, 2, 2], [2, 2, 0]);
  assert.notEqual(positionKey(coveredElsewhere, 0), key);
  const differentReserve = new GameConfig(1, 0, 0, 0, 0, 17, [0, 2, 2], [2, 2, 0]);
  assert.notEqual(positionKey(differentReserve, 0), key);
  game.last_player = 1;
  assert.equal(positionKey(game, 0), key);
  assert.equal(isRepetitionDraw([key, key, key]), false);
  assert.equal(isRepetitionDraw([key, key, key, positionKey(game, 1)]), false);
  assert.equal(isRepetitionDraw([key, key, key, key]), true);
});

test("history follows board moves and discards positions before reserve placements", () => {
  const { game, player, history, drawMove } = drawFixture(1);
  const snapshot = [...history];
  const child = playMove(game, player, drawMove);
  const repeated = advanceHistory(history, child, 1 - player, drawMove);
  assert.deepEqual(Array.from(repeated), [...history, positionKey(child, 1 - player)]);
  assert.equal(isRepetitionDraw(repeated), true);
  const placement = new Move(1, null, 4);
  const placed = playMove(game, player, placement);
  assert.deepEqual(Array.from(advanceHistory(history, placed, 1 - player, placement)),
    [positionKey(placed, 1 - player)]);
  assert.deepEqual(history, snapshot, "advancing history must not change sibling search paths");
});

test("an expired budget still recognizes a draw when history omits the current position", () => {
  const { game, player, history, drawMove } = drawFixture(1);
  const child = playMove(game, player, drawMove);
  const [move, score] = selectMoveAlphabeta(child, 1 - player, 3, 0, history);
  assert.equal(move, null);
  assert.equal(score, DRAW_SCORE);
  assert.equal(isRepetitionDraw(history), false, "the caller's history must stay unchanged");
});

for (const player of [0, 1]) {
  test(`player ${player} takes a certain draw over an unproven advantage`, () => {
    const { game, history, drawMove } = drawFixture(player);
    assert.equal(isRepetitionDraw(history), false);
    assert.ok(getPossibleMoves(game, player).some(move =>
      getScore(playMove(game, player, move), player) > 0));
    const snapshot = [...history];
    for (const timeLimit of [undefined, 1000]) {
      const [move, score] = selectMoveAlphabeta(game, player, 1, timeLimit, history);
      assert.equal(moveKey(move), moveKey(drawMove));
      assert.equal(score, DRAW_SCORE);
    }
    assert.deepEqual(history, snapshot);
    const [, horizonScore] = selectMoveAlphabeta(game, player, 0, undefined, history);
    assert.equal(horizonScore, getScore(game, player), "do not count the current position twice");
    const child = playMove(game, player, drawMove);
    const finishedHistory = [...history, positionKey(child, 1 - player)];
    const [move, score] = selectMoveAlphabeta(child, 1 - player, 0, 0, finishedHistory);
    assert.equal(move, null);
    assert.equal(score, DRAW_SCORE, "recognize a draw even at the search horizon");
  });

  test(`player ${player} chooses a proven win before an available draw`, () => {
    const { game, history, drawMove } = drawFixture(player, true);
    const drawn = playMove(game, player, drawMove);
    assert.equal(isRepetitionDraw([...history, positionKey(drawn, 1 - player)]), true);
    const [move, score] = selectMoveAlphabeta(game, player, 2, undefined, history);
    const won = playMove(game, player, move);
    assert.equal(getWinner(won), player);
    assert.ok(score >= WIN_SCORE);
    for (const side of [0, 1]) {
      const terminalHistory = Array(4).fill(positionKey(won, side));
      const [terminalMove, terminalScore] = selectMoveAlphabeta(won, side, 0, 0, terminalHistory);
      assert.equal(terminalMove, null);
      assert.equal(Math.sign(terminalScore), side === player ? 1 : -1);
      assert.ok(Math.abs(terminalScore) >= WIN_SCORE, "winning lines take priority over repetition");
    }
  });

  test(`player ${player} keeps searching for a deeper win after finding a draw`, () => {
    const boards = player === 1 ? [272, 256, 2, 0, 32, 192] : [0, 32, 192, 272, 256, 2];
    const reserves = player === 1 ? [[0, 1, 1], [2, 1, 0]] : [[2, 1, 0], [0, 1, 1]];
    const game = new GameConfig(...boards, ...reserves, 1 - player);
    const drawMove = new Move(1, 5, 0);
    const child = playMove(game, player, drawMove);
    const history = [...Array(3).fill(positionKey(child, 1 - player)), positionKey(game, player)];
    const [shallowMove, shallowScore] = selectMoveAlphabeta(game, player, 1, undefined, history);
    assert.equal(moveKey(shallowMove), moveKey(drawMove));
    assert.equal(shallowScore, DRAW_SCORE);
    const [deeperMove, deeperScore] = selectMoveAlphabeta(game, player, 3, 1000, history);
    assert.notEqual(moveKey(deeperMove), moveKey(drawMove));
    assert.ok(deeperScore >= WIN_SCORE);
  });
}

test("timing out after finding a draw retains that result and leaves history reusable", () => {
  let calls = 0;
  let expiresAfter = Infinity;
  const timed = vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../shared.js"), "utf8") + ";({ selectMoveAlphabeta })",
    { Date: { now: () => ++calls > expiresAfter ? 10 : 0 } }
  );
  const { game, player, history, drawMove } = drawFixture(1);
  const before = [...history];
  const completed = timed.selectMoveAlphabeta(game, player, 1, 1, history);
  expiresAfter = calls + 3;
  calls = 0;
  const [move, score] = timed.selectMoveAlphabeta(game, player, 3, 1, history);
  assert.ok(calls > expiresAfter, "the next iteration must enter and time out");
  assert.equal(moveKey(move), moveKey(drawMove));
  assert.equal(score, completed[1]);
  assert.equal(score, DRAW_SCORE);
  assert.deepEqual(history, before);
  assert.equal(selectMoveAlphabeta(game, player, 2, undefined, history)[1], DRAW_SCORE);
});

test("transposition scores depend on repetition counts and the root player's draw preference", () => {
  const { game, player, history, parent } = drawFixture(1);
  for (const initialHistory of [[positionKey(game, player)], history]) {
    const table = new Map();
    negamax(game, player, -Infinity, Infinity, 1, table, Infinity, initialHistory);
    for (const nextHistory of [history, [positionKey(game, player)]]) {
      const [, expected] = selectMoveAlphabeta(game, player, 1, undefined, nextHistory);
      const [, actual] = negamax(game, player, -Infinity, Infinity, 1, table, Infinity, nextHistory);
      assert.equal(actual, expected);
    }
  }
  const table = new Map();
  // The child was first evaluated as the opponent of a different search root.
  negamax(parent.game, parent.player, -Infinity, Infinity, 2, table, Infinity, parent.history);
  const [, score] = negamax(game, player, -Infinity, Infinity, 1, table, Infinity, history);
  assert.equal(score, DRAW_SCORE);
  for (const [alpha, beta] of [[DRAW_SCORE - 1, DRAW_SCORE], [DRAW_SCORE, DRAW_SCORE + 1]]) {
    const bounds = new Map();
    negamax(game, player, alpha, beta, 2, bounds, Infinity, history);
    const [, cached] = negamax(game, player, -Infinity, Infinity, 2, bounds, Infinity, history);
    assert.equal(cached, DRAW_SCORE);
  }
});
