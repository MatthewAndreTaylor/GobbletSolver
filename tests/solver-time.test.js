const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadEngine(now) {
  return vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../shared.js"), "utf8") +
      ";({ GameConfig, getPossibleMoves, selectMoveAlphabeta })",
    { Date: { now } }
  );
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const position = ({ GameConfig }) =>
  new GameConfig(1, 0, 0, 0, 2, 0, [1, 2, 2], [2, 1, 2], 1);

test("a timeout inside the next iteration keeps the last completed result", () => {
  let calls = 0;
  let expiresAfter = Infinity;
  const engine = loadEngine(() => ++calls > expiresAfter ? 10 : 0);
  const game = position(engine);
  const completed = engine.selectMoveAlphabeta(game, 0, 1, 1);
  const completedCalls = calls;

  // This position separates the first legal fallback, depth one, and depth two.
  assert.notDeepEqual(plain(completed[0]), plain(engine.getPossibleMoves(game, 0)[0]));
  assert.notEqual(completed[1], engine.selectMoveAlphabeta(game, 0, 2)[1]);

  calls = 0;
  expiresAfter = completedCalls + 3;
  const interrupted = engine.selectMoveAlphabeta(game, 0, 5, 1);
  assert.ok(calls > completedCalls);
  assert.deepEqual(plain(interrupted), plain(completed));
});

test("expiration before the first completed iteration returns a legal move", () => {
  let calls = 0;
  const engine = loadEngine(() => ++calls === 1 ? 0 : 10);
  const game = position(engine);
  const [move, score] = engine.selectMoveAlphabeta(game, 0, 13, 1);
  assert.ok(calls >= 2);
  assert.ok(engine.getPossibleMoves(game, 0).some(
    (legal) => JSON.stringify(legal) === JSON.stringify(move)
  ));
  assert.ok(Number.isFinite(score));
});

test("a terminal position has no move even with an expired time budget", () => {
  const engine = loadEngine(() => { throw new Error("Terminal search should not use a deadline"); });
  const game = new engine.GameConfig(0, 0, 16, 3, 4, 0, [2, 2, 1], [0, 1, 2], 1);
  const [move, score] = engine.selectMoveAlphabeta(game, 0, 13, 0);
  assert.equal(move, null);
  assert.ok(score < 0);
});
