const assert = require("node:assert/strict");
const test = require("node:test");
const { initialState, legalMoves, apply, winner, positionKey, proofSearch,
  verifyReplay } = require("../tools/verify_opening.js");

function repeatedPosition(occurrences) {
  const state = initialState();
  const history = [positionKey(state, 0)];
  function play(move) {
    assert.equal(winner(state, move[0]), null);
    assert.ok(legalMoves(state, move[0]).some(candidate =>
      candidate.every((value, index) => value === move[index])));
    apply(state, move);
    assert.equal(winner(state, 1 - move[0]), null);
    history.push(positionKey(state, 1 - move[0]));
  }
  for (const move of [[0, 1, null, 6], [1, 1, null, 1],
    [0, 2, null, 8], [1, 2, null, 0]]) play(move);
  for (let cycle = 1; cycle < occurrences; cycle++) {
    for (const move of [[0, 2, 8, 7], [1, 2, 0, 3],
      [0, 2, 7, 8], [1, 2, 3, 0]]) play(move);
  }
  return { state, history };
}

test("independent square-stack rules validate the replay and every late AI defense", () => {
  verifyReplay();
});

test("independent fourfold proof finds a human win within 13 plies after large-center opening", () => {
  const position = initialState();
  apply(position, [0, 2, null, 4]);
  const before = structuredClone(position);
  const search = proofSearch(30);
  assert.equal(search.humanCanForceWin(position, 1, 12), true);
  assert.deepEqual(position, before, "search restores the complete position");
});

test("a legal repeated cycle draws on the fourth occurrence, counting the current state once", () => {
  const search = proofSearch();
  const third = repeatedPosition(3);
  const fourth = repeatedPosition(4);
  assert.deepEqual(third.state, fourth.state);
  assert.equal(search.humanCanForceWin(third.state, 0, 1, third.history), true,
    "a third occurrence still allows the human's immediate winning placement");
  assert.equal(search.humanCanForceWin(fourth.state, 0, 1, fourth.history), false,
    "the fourth occurrence ends play before the winning placement");
  assert.equal(search.humanCanForceWin(fourth.state, 0, 1, fourth.history.slice(0, -1)), false,
    "append the current position when the caller's history stops before it");
  assert.equal(search.stats().repetitionDraws, 2);
});

test("winning lines take priority over a repeated terminal position", () => {
  const { state } = repeatedPosition(1);
  apply(state, [0, 0, null, 7]);
  assert.equal(winner(state, 1), 0);
  const history = Array(4).fill(positionKey(state, 1));
  assert.equal(proofSearch().humanCanForceWin(state, 1, 0, history), true);
});

test("proof caches distinguish the same board with different repetition counts", () => {
  const state = initialState();
  for (const move of [[0, 2, null, 4], [1, 2, null, 0], [0, 2, null, 6],
    [1, 1, null, 2], [0, 2, 6, 2], [1, 1, null, 6], [0, 2, 4, 6],
    [1, 2, null, 4], [0, 1, null, 8], [1, 2, 0, 8], [0, 1, null, 0]]) {
    apply(state, move);
  }
  const before = structuredClone(state);
  const current = positionKey(state, 1);
  apply(state, [1, 2, 4, 0]);
  assert.equal(winner(state, 0), null);
  const drawingChild = positionKey(state, 0);
  apply(state, [1, 2, 4, 0], -1);
  const fresh = [current];
  const repeated = [drawingChild, drawingChild, drawingChild, current];
  for (const order of [[[fresh, true], [repeated, false]], [[repeated, false], [fresh, true]]]) {
    const search = proofSearch();
    for (const [history, expected] of order) {
      const historyBefore = [...history];
      assert.equal(search.humanCanForceWin(state, 1, 2, history), expected);
      assert.deepEqual(history, historyBefore);
      assert.deepEqual(state, before);
    }
  }
});

test("a timed-out proof restores its board and keeps supplied history reusable", t => {
  let clock = 0;
  t.mock.method(performance, "now", () => clock);
  const search = proofSearch(1);
  const state = initialState();
  apply(state, [0, 2, null, 4]);
  const history = [positionKey(state, 1)];
  const before = structuredClone(state);
  clock = 2000;
  assert.throws(() => search.humanCanForceWin(state, 1, 12, history), /time budget exhausted/);
  assert.deepEqual(state, before);
  assert.deepEqual(history, [positionKey(state, 1)]);
  clock = 0;
  const third = repeatedPosition(3);
  assert.equal(search.humanCanForceWin(third.state, 0, 1, third.history), true);
});
