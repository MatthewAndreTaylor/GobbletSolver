function showToast(text) {
  const toast = document.getElementById("toast");
  toast.className = "show";
  toast.textContent = text;
  setTimeout(function () {
    toast.className = toast.className.replace("show", "");
  }, 4000);
}

// Game setup and rendering
const boardElement = document.getElementById("board");
const orangeUnusedPieces = document.getElementById("orange-unused-pieces");
const blueUnusedPieces = document.getElementById("blue-unused-pieces");
const playerPieceContainers = [blueUnusedPieces, orangeUnusedPieces];
const colorToggleButton = document.getElementById("color-toggle");
const pieceSizes = ["piece-size-1", "piece-size-2", "piece-size-3"];

const aistartButton = document.getElementById("ai-start");
const humanstartButton = document.getElementById("human-start");
const depthLimit = 20;
const aiThinking = document.getElementById("ai-thinking");
const outcomePrediction = document.getElementById("outcome-prediction");

let currentGame = null;
let playerColors = ["blue", "orange"];
let selection = null;
let selectedElement = null;
let my_turn = true;
let announcedOutcome = null;
let moveHistory = [];
let repetitionHistory = [];

function gameIsOver() {
  return getWinner(currentGame) !== null || isRepetitionDraw(repetitionHistory);
}

function showSearchPrediction(score, depth, movesPlayed) {
  if (Math.abs(score) >= WIN_SCORE) {
    // Mate scores include unused search depth; the board already shows the AI move.
    const remainingMoves = depth - (Math.abs(score) - WIN_SCORE) - movesPlayed;
    const winner = score > 0 ? "AI" : "Human";
    outcomePrediction.textContent = `${winner} can force a win in ${remainingMoves} ${remainingMoves === 1 ? "move" : "moves"}.`;
  } else if (score === DRAW_SCORE) {
    outcomePrediction.textContent = "AI can secure a draw.";
  } else {
    outcomePrediction.textContent = "Outcome uncertain.";
  }
}

function recordMove(player, move) {
  const entry = { player, size: move.size, start_sq: move.start_sq, end_sq: move.end_sq };
  moveHistory.push(entry);
  repetitionHistory = advanceHistory(repetitionHistory, currentGame, 1 - player, move);
  console.log(`Gobblet move ${moveHistory.length}: ${JSON.stringify(entry)}`);
}

function hideButtons() {
  aistartButton.disabled = true;
  humanstartButton.disabled = true;
  aistartButton.style.display = "none";
  humanstartButton.style.display = "none";
}

function createPieceElement(player, size) {
  const pieceElement = document.createElement("img");
  pieceElement.classList.add("piece-token", pieceSizes[size]);
  pieceElement.dataset.player = String(player);
  pieceElement.dataset.size = String(size);
  pieceElement.src = `game_pieces/${playerColors[player]}.jpg`;
  pieceElement.alt = `Gobblet piece ${size + 1}`;
  pieceElement.draggable = false;
  return pieceElement;
}

function updateAllPieceArt() {
  document.querySelectorAll(".piece-token").forEach((pieceElement) => {
    const player = parseInt(pieceElement.dataset.player, 10);
    const size = parseInt(pieceElement.dataset.size, 10);

    if (Number.isNaN(player) || Number.isNaN(size)) {
      return;
    }

    pieceElement.src = `game_pieces/${playerColors[player]}.jpg`;
    pieceElement.alt = `Gobblet piece (color: ${playerColors[player]}, size: ${size + 1})`;
  });
}

function renderPiece(cell, player, size) {
  cell.replaceChildren(createPieceElement(player, size));
}

function createStartingGame() {
  return new GameConfig(0, 0, 0, 0, 0, 0, [2, 2, 2], [2, 2, 2]);
}

function clearSelectionHighlight() {
  if (selectedElement) {
    selectedElement.style.backgroundColor = "white";
    selectedElement = null;
  }
}

function setSelection(element) {
  clearSelectionHighlight();
  selection = element;
  selectedElement = element.domElement || null;

  if (selectedElement) {
    selectedElement.style.backgroundColor = "lightyellow";
  }
}

function renderUnusedPieces(game) {
  playerPieceContainers.forEach((container, player) => {
    const unused = player === 0 ? game.p0_unused : game.p1_unused;

    container.replaceChildren();

    unused.forEach((count, size) => {
      for (let i = 0; i < count; i++) {
        const pieceCell = document.createElement("div");
        pieceCell.classList.add("cell");
        pieceCell.dataset.player = String(player);
        pieceCell.dataset.size = String(size);
        renderPiece(pieceCell, player, size);
        container.appendChild(pieceCell);
      }
    });
  });
}

function handleUnusedPieceClick(e) {
  const pieceCell = e.target.closest(".cell[data-player][data-size]");
  if (!pieceCell || !my_turn || gameIsOver()) {
    return;
  }

  const player = parseInt(pieceCell.dataset.player, 10);
  const size = parseInt(pieceCell.dataset.size, 10);

  if (Number.isNaN(player) || Number.isNaN(size) || player !== 0) {
    return;
  }

  if (selection && selection.start_sq === null && selectedElement === pieceCell) {
    clearSelectionHighlight();
    selection = null;
    return;
  }

  clearSelectionHighlight();
  selection = { size, start_sq: null };
  selectedElement = pieceCell;
  selectedElement.style.backgroundColor = "lightyellow";
}

function isValidMove(moves, candidateMove) {
  return moves.some(
    (move) =>
      move.size === candidateMove.size &&
      move.start_sq === candidateMove.start_sq &&
      move.end_sq === candidateMove.end_sq
  );
}

function announceOutcome(game) {
  const winner = getWinner(game);
  let outcome = null;

  if (winner === 0) {
    outcome = "You Win!";
  } else if (winner === 1) {
    outcome = "You Lose!";
  } else if (winner === -1 || isRepetitionDraw(repetitionHistory) ||
      (getPossibleMoves(game, 0).length === 0 && getPossibleMoves(game, 1).length === 0)) {
    outcome = "Draw!";
  }

  if (outcome) {
    outcomePrediction.textContent = winner === 0 ? "Human wins." : winner === 1 ? "AI wins." : "Draw.";
  }
  if (outcome && outcome !== announcedOutcome) {
    announcedOutcome = outcome;
    my_turn = false;
    selection = null;
    clearSelectionHighlight();
    console.log(`Gobblet replay: ${JSON.stringify(moveHistory)}`);
    showToast(outcome);
  }
}

aistartButton.addEventListener("click", () => {
  startNewGame(1);
  aiMove();
  hideButtons();
});

humanstartButton.addEventListener("click", () => {
  startNewGame();
  hideButtons();
});

colorToggleButton.addEventListener("click", () => {
  playerColors = [playerColors[1], playerColors[0]];
  colorToggleButton.textContent = `Switch Colors: ${playerColors[0]} / ${playerColors[1]}`;
  updateAllPieceArt();
  if (currentGame) {
    updateBoard(currentGame);
  }
});

function createBoard() {
  boardElement.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.row = i;
      cell.dataset.col = j;
      boardElement.appendChild(cell);
    }
  }
}

function updateBoard(game) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const cell = document.querySelector(`.cell[data-row='${i}'][data-col='${j}']`);
      cell.replaceChildren();
      const square = i * 3 + j;
      const topPiece = getTopPiece(game, square);

      if (topPiece !== null) {
        renderPiece(cell, topPiece.color, topPiece.size);
      }
    }
  }

  renderUnusedPieces(game);
  updateAllPieceArt();
  announceOutcome(game);
}

function startNewGame(startingPlayer = 0) {
  currentGame = createStartingGame();
  moveHistory = [];
  repetitionHistory = [positionKey(currentGame, startingPlayer)];
  selection = null;
  clearSelectionHighlight();
  my_turn = startingPlayer === 0;
  announcedOutcome = null;
  outcomePrediction.textContent = "Outcome not yet analyzed.";
  updateBoard(currentGame);
}

blueUnusedPieces.addEventListener("click", (e) => {
  handleUnusedPieceClick(e);
});

orangeUnusedPieces.addEventListener("click", (e) => {
  handleUnusedPieceClick(e);
});

function aiMove() {
  if (!aiThinking.hidden) return;
  my_turn = false;
  if (gameIsOver()) {
    return;
  }
  aiThinking.hidden = false;
  outcomePrediction.textContent = "Analyzing position...";
  // Allow a paint before the synchronous search so the spinner is visible.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      const startTime = Date.now();
      const ai_selection = selectMoveAlphabeta(currentGame, 1, depthLimit, undefined, repetitionHistory);
      const move = ai_selection[0];
      console.log(`AI move computed in ${Date.now() - startTime} ms`);
      console.log(ai_selection);

      if (move === null) {
        announceOutcome(currentGame);
        if (announcedOutcome === null) outcomePrediction.textContent = "Analysis unavailable.";
        return;
      }
      currentGame = playMove(currentGame, 1, move);
      recordMove(1, move);
      updateBoard(currentGame);
      if (announcedOutcome === null) showSearchPrediction(ai_selection[1], depthLimit, 1);
      my_turn = !gameIsOver();
    } catch (error) {
      outcomePrediction.textContent = "Analysis unavailable.";
      throw error;
    } finally {
      aiThinking.hidden = true;
    }
  }));
}

boardElement.addEventListener("click", (e) => {
  const boardCell = e.target.closest(".cell[data-row][data-col]");
  if (!boardCell || !my_turn || gameIsOver()) return;

  const row = parseInt(boardCell.dataset.row, 10);
  const col = parseInt(boardCell.dataset.col, 10);
  const sq = row * 3 + col;

  if (selection === null) {
    const topPiece = getTopPiece(currentGame, sq);
    if (topPiece && topPiece.color === 0) {
      selection = { size: topPiece.size, start_sq: sq };
      clearSelectionHighlight();
      selectedElement = boardCell;
      selectedElement.style.backgroundColor = "lightyellow";
    }
    return;
  }

  const move = new Move(selection.size, selection.start_sq, sq);

  if (!isValidMove(getPossibleMoves(currentGame, 0), move)) {
    const topPiece = getTopPiece(currentGame, sq);
    if (topPiece && topPiece.color === 0) {
      selection = { size: topPiece.size, start_sq: sq };
      clearSelectionHighlight();
      selectedElement = boardCell;
      selectedElement.style.backgroundColor = "lightyellow";
    } else {
      clearSelectionHighlight();
      selection = null;
    }
    return;
  }

  currentGame = playMove(currentGame, 0, move);
  recordMove(0, move);
  clearSelectionHighlight();
  selection = null;
  outcomePrediction.textContent = "Outcome not yet analyzed.";
  updateBoard(currentGame);

  aiMove();
});

createBoard();
startNewGame();
