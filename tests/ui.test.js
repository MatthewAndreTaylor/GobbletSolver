const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class Element {
  constructor() {
    this.hidden = true;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList = { add() {} };
    this.listeners = {};
  }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  closest() { return this; }
}

function loadUI() {
  let frames = [];
  const logs = [];
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); },
    querySelector(selector) {
      const [, row, col] = selector.match(/data-row='(\d)'\]\[data-col='(\d)'/);
      return elements.get("board").children[Number(row) * 3 + Number(col)];
    },
    querySelectorAll() { return []; },
  };
  const context = vm.createContext({ document, console: { log(...args) { logs.push(args); } }, setTimeout() {},
    requestAnimationFrame(callback) { frames.push(callback); } });
  for (const file of ["shared.js", "main.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
  }
  return { context, elements, logs, run: (source) => vm.runInContext(source, context),
    frame() { const pending = frames; frames = []; pending.forEach(callback => callback()); } };
}

test("a human winning move stops before starting another AI search", () => {
  const ui = loadUI();
  ui.run(`
    currentGame = new GameConfig(3, 0, 0, 0, 0, 16, [0, 2, 2], [2, 2, 1]);
    selection = { size: 1, start_sq: null };
    selectMoveAlphabeta = () => { throw new Error("Search after game over"); };
  `);
  const board = ui.elements.get("board");
  assert.doesNotThrow(() => board.listeners.click({ target: board.children[2] }));
  assert.equal(ui.run("getWinner(currentGame)"), 0);
  assert.equal(ui.run("my_turn"), false);
  assert.equal(ui.elements.get("toast").textContent, "You Win!");
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Human wins.");
  ui.run("updateBoard(currentGame)");
  const replays = ui.logs.map(([message]) => message).filter(
    message => typeof message === "string" && message.startsWith("Gobblet replay: ")
  );
  assert.equal(replays.length, 1, "redrawing the finished game must not duplicate its replay");
  assert.deepEqual(JSON.parse(replays[0].slice("Gobblet replay: ".length)), [
    { player: 0, size: 1, start_sq: null, end_sq: 2 },
  ]);
});

test("move logging records human and AI moves once, ignores selections and illegal moves, and resets", () => {
  const ui = loadUI();
  ui.elements.get("human-start").listeners.click();
  ui.run("selectMoveAlphabeta = () => [new Move(1, null, 4), 0]");
  const board = ui.elements.get("board");
  const unused = ui.elements.get("blue-unused-pieces");
  const smallPiece = unused.children.find(piece => piece.dataset.size === "0");
  unused.listeners.click({ target: smallPiece });
  assert.equal(ui.run("moveHistory.length"), 0, "selecting a piece is not a move");
  board.listeners.click({ target: board.children[0] });
  assert.equal(ui.run("moveHistory.length"), 1, "the human move is recorded before AI search");
  board.listeners.click({ target: board.children[1] }); // Input is locked during the AI turn.
  ui.frame();
  ui.frame();
  board.listeners.click({ target: board.children[0] });
  board.listeners.click({ target: board.children[4] }); // A small piece cannot cover a medium one.

  const expected = [
    { player: 0, size: 0, start_sq: null, end_sq: 0 },
    { player: 1, size: 1, start_sq: null, end_sq: 4 },
  ];
  assert.deepEqual(JSON.parse(ui.run("JSON.stringify(moveHistory)")), expected);
  const moveLogs = ui.logs.map(([message]) => message).filter(
    message => typeof message === "string" && /^Gobblet move \d+: /.test(message)
  );
  assert.deepEqual(moveLogs, expected.map((move, index) =>
    `Gobblet move ${index + 1}: ${JSON.stringify(move)}`
  ));
  ui.run("startNewGame()");
  assert.equal(ui.run("moveHistory.length"), 0);
  assert.deepEqual(moveLogs.map(line => JSON.parse(line.slice(line.indexOf(": ") + 2))), expected,
    "logged JSON remains a snapshot after starting a new game");
});

test("a completed board cannot select pieces or start another search", () => {
  const ui = loadUI();
  ui.run(`
    currentGame = new GameConfig(3, 4, 0, 0, 0, 16, [0, 1, 2], [2, 2, 1]);
    selectMoveAlphabeta = () => { throw new Error("Search after game over"); };
  `);
  const board = ui.elements.get("board");
  board.listeners.click({ target: board.children[0] });
  assert.equal(ui.run("selection"), null);
  assert.doesNotThrow(() => ui.run("aiMove()"));
});

test("an AI winning move keeps human input locked", () => {
  const ui = loadUI();
  ui.run(`
    currentGame = new GameConfig(0, 0, 16, 3, 0, 0, [2, 2, 1], [0, 2, 2]);
    selectMoveAlphabeta = () => [new Move(1, null, 2), 100];
    aiMove();
  `);
  ui.frame();
  ui.frame();
  assert.equal(ui.run("getWinner(currentGame)"), 1);
  assert.equal(ui.run("my_turn"), false);
  assert.equal(ui.elements.get("toast").textContent, "You Lose!");
  assert.equal(ui.elements.get("outcome-prediction").textContent, "AI wins.");
});

test("the UI never tries to play a null AI move", () => {
  const ui = loadUI();
  const before = ui.run("currentGame");
  ui.run("selectMoveAlphabeta = () => [null, 0]");
  assert.doesNotThrow(() => ui.run("aiMove()"));
  ui.frame();
  ui.frame();
  assert.equal(ui.run("currentGame"), before);
  assert.equal(ui.run("my_turn"), false);
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Analysis unavailable.");
});

test("a drawn position announces a draw", () => {
  const ui = loadUI();
  ui.run("getWinner = () => -1; announceOutcome(currentGame)");
  assert.equal(ui.elements.get("toast").textContent, "Draw!");
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Draw.");
});

test("AI Start displays loading before search and hides it after the move", () => {
  const ui = loadUI();
  ui.run("let searches = 0; selectMoveAlphabeta = () => { searches++; return [new Move(2, null, 4), 0]; }");
  ui.elements.get("ai-start").listeners.click();
  assert.equal(ui.elements.get("ai-thinking").hidden, false);
  assert.equal(ui.run("my_turn"), false);
  assert.equal(ui.run("searches"), 0);
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Analyzing position...");
  ui.run("aiMove()"); // A duplicate call must not queue another AI turn.
  ui.frame();
  assert.equal(ui.run("searches"), 0);
  ui.frame();
  assert.equal(ui.run("searches"), 1);
  assert.equal(ui.elements.get("ai-thinking").hidden, true);
  assert.equal(ui.run("my_turn"), true);
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Outcome uncertain.");
});

test("loading is cleared even if search throws", () => {
  const ui = loadUI();
  ui.run('selectMoveAlphabeta = () => { throw new Error("Search failed"); }; aiMove();');
  ui.frame();
  assert.throws(() => ui.frame(), /Search failed/);
  assert.equal(ui.elements.get("ai-thinking").hidden, true);
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Analysis unavailable.");
});

test("AI Start passes the correct initial side and played history without a search time limit", () => {
  const ui = loadUI();
  assert.equal(ui.run("repetitionHistory[0] === positionKey(currentGame, 0)"), true);
  ui.run(`
    let searchHistory, searchDepth, searchBudget;
    selectMoveAlphabeta = (game, player, depth, budget, history) => {
      searchHistory = history.slice();
      searchDepth = depth;
      searchBudget = budget;
      return [new Move(2, null, 0), 0];
    };
  `);
  ui.elements.get("ai-start").listeners.click();
  const initialKey = ui.run("positionKey(currentGame, 1)");
  assert.equal(ui.run("repetitionHistory[0]"), initialKey);
  ui.frame();
  ui.frame();
  assert.equal(ui.run("searchHistory.length"), 1);
  assert.equal(ui.run("searchHistory[0]"), initialKey);
  assert.equal(ui.run("searchDepth"), 20);
  assert.equal(ui.run("searchBudget"), undefined);
  assert.equal(ui.run("repetitionHistory[0] === positionKey(currentGame, 0)"), true);
});

test("the fourth repetition after an AI move ends play, logs once, and resets", () => {
  const ui = loadUI();
  ui.run(`
    const aiMoves = [new Move(2, null, 8), ...Array.from({ length: 3 }, () =>
      [new Move(2, 8, 7), new Move(2, 7, 8)]).flat()];
    selectMoveAlphabeta = () => [aiMoves.shift(), 0];
    selection = { size: 2, start_sq: null };
  `);
  const board = ui.elements.get("board");
  const click = (square) => board.listeners.click({ target: board.children[square] });
  click(0);
  ui.frame();
  ui.frame();
  for (let cycle = 0; cycle < 3; cycle++) {
    click(0);
    click(1);
    ui.frame();
    ui.frame();
    click(1);
    click(0);
    ui.frame();
    ui.frame();
    assert.equal(ui.run("isRepetitionDraw(repetitionHistory)"), cycle === 2);
    if (cycle < 2) assert.equal(ui.run("announcedOutcome"), null);
  }
  assert.equal(ui.run("my_turn"), false);
  assert.equal(ui.run("moveHistory.length"), 14);
  assert.equal(ui.elements.get("toast").textContent, "Draw!");
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Draw.");
  ui.run('selectMoveAlphabeta = () => { throw new Error("Search after draw"); }; aiMove(); updateBoard(currentGame);');
  click(0);
  const unused = ui.elements.get("blue-unused-pieces");
  unused.listeners.click({ target: unused.children[0] });
  assert.equal(ui.run("selection"), null);
  const replays = ui.logs.map(([message]) => message).filter(
    message => typeof message === "string" && message.startsWith("Gobblet replay: ")
  );
  assert.equal(replays.length, 1);
  assert.equal(JSON.parse(replays[0].slice("Gobblet replay: ".length)).length, 14);
  ui.run("startNewGame()");
  assert.equal(ui.run("repetitionHistory.length"), 1);
  assert.equal(ui.run("isRepetitionDraw(repetitionHistory)"), false);
  assert.equal(ui.run("moveHistory.length"), 0);
  assert.equal(ui.run("my_turn"), true);
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Outcome not yet analyzed.");
});

test("a human fourth repetition stops before another AI search", () => {
  const ui = loadUI();
  ui.run(`
    startNewGame(1);
    function prepareMove(player, start, end) {
      const move = new Move(2, start, end);
      currentGame = playMove(currentGame, player, move);
      recordMove(player, move);
    }
    prepareMove(1, null, 0);
    prepareMove(0, null, 8);
    for (let cycle = 0; cycle < 3; cycle++) {
      prepareMove(1, 0, 1);
      prepareMove(0, 8, 7);
      prepareMove(1, 1, 0);
      if (cycle < 2) prepareMove(0, 7, 8);
    }
    my_turn = true;
    selection = { size: 2, start_sq: 7 };
    selectMoveAlphabeta = () => { throw new Error("Search after draw"); };
  `);
  const board = ui.elements.get("board");
  board.listeners.click({ target: board.children[8] });
  ui.frame();
  ui.frame();
  assert.equal(ui.run("isRepetitionDraw(repetitionHistory)"), true);
  assert.equal(ui.run("my_turn"), false);
  assert.equal(ui.elements.get("ai-thinking").hidden, true);
  assert.equal(ui.elements.get("toast").textContent, "Draw!");
});

test("a winning line takes precedence over repetition in the announcement", () => {
  const ui = loadUI();
  ui.run(`
    currentGame = new GameConfig(3, 4, 0, 0, 0, 16, [0, 1, 2], [2, 2, 1]);
    repetitionHistory = Array(4).fill(positionKey(currentGame, 1));
    updateBoard(currentGame);
  `);
  assert.equal(ui.elements.get("toast").textContent, "You Win!");
});

test("predictions use the AI score and count remaining individual moves after its move", () => {
  const cases = [
    ["WIN_SCORE + 16", "AI can force a win in 3 moves."],
    ["-WIN_SCORE - 18", "Human can force a win in 1 move."],
    ["-WIN_SCORE", "Human can force a win in 19 moves."],
    ["DRAW_SCORE", "AI can secure a draw."],
    ["0", "Outcome uncertain."],
    ["800", "Outcome uncertain."],
    ["-800", "Outcome uncertain."],
  ];
  for (const [score, expected] of cases) {
    const ui = loadUI();
    assert.equal(ui.elements.get("outcome-prediction").textContent, "Outcome not yet analyzed.");
    ui.run(`
      let searches = 0;
      selectMoveAlphabeta = () => { searches++; return [new Move(2, null, 4), ${score}]; };
      aiMove();
    `);
    ui.frame();
    ui.frame();
    assert.equal(ui.elements.get("outcome-prediction").textContent, expected, score);
    assert.equal(ui.run("searches"), 1, "displaying a prediction must not run another search");
  }
});

test("a legal human move invalidates the prediction; selection and illegal moves preserve it", () => {
  const ui = loadUI();
  ui.run("selectMoveAlphabeta = () => [new Move(1, null, 4), WIN_SCORE + 16]; aiMove();");
  ui.frame();
  ui.frame();
  const prediction = ui.elements.get("outcome-prediction");
  const previous = prediction.textContent;
  const board = ui.elements.get("board");
  const unused = ui.elements.get("blue-unused-pieces");
  const small = unused.children.find(piece => piece.dataset.size === "0");
  unused.listeners.click({ target: small });
  assert.equal(prediction.textContent, previous);
  board.listeners.click({ target: board.children[4] }); // Small cannot cover medium.
  assert.equal(prediction.textContent, previous);
  unused.listeners.click({ target: small });
  board.listeners.click({ target: board.children[0] });
  assert.equal(prediction.textContent, "Analyzing position...");
});

test("the real replay prediction shows a human win three individual moves after the AI defense", () => {
  const ui = loadUI();
  ui.run(`
    const replay = [
      [0, 2, null, 4], [1, 2, null, 0], [0, 2, null, 6],
      [1, 1, null, 2], [0, 2, 6, 2], [1, 1, null, 6],
      [0, 2, 4, 6], [1, 2, null, 4], [0, 1, null, 8],
    ];
    for (const [player, size, start, end] of replay) {
      const move = new Move(size, start, end);
      currentGame = playMove(currentGame, player, move);
      recordMove(player, move);
    }
    const realSearch = selectMoveAlphabeta;
    let searches = 0;
    selectMoveAlphabeta = (...args) => { searches++; return realSearch(...args); };
    aiMove();
  `);
  ui.frame();
  ui.frame();
  assert.deepEqual(JSON.parse(ui.run("JSON.stringify(moveHistory.at(-1))")),
    { player: 1, size: 2, start_sq: 0, end_sq: 8 });
  assert.equal(ui.elements.get("outcome-prediction").textContent, "Human can force a win in 3 moves.");
  assert.equal(ui.run("searches"), 1);
});
