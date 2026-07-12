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
const depthLimit = 8;

let currentGame = null;
let playerColors = ["blue", "orange"];
let selection = null;
let selectedElement = null;
let my_turn = true;
let announcedOutcome = null;

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
  if (!pieceCell || !my_turn || getWinner(currentGame) !== null) {
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
  } else if (getPossibleMoves(game, 0).length === 0 && getPossibleMoves(game, 1).length === 0) {
    outcome = "Draw!";
  }

  if (outcome && outcome !== announcedOutcome) {
    announcedOutcome = outcome;
    showToast(outcome);
  }
}

aistartButton.addEventListener("click", () => {
  startNewGame();
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

function startNewGame() {
  currentGame = createStartingGame();
  selection = null;
  clearSelectionHighlight();
  my_turn = true;
  announcedOutcome = null;
  updateBoard(currentGame);
}

blueUnusedPieces.addEventListener("click", (e) => {
  handleUnusedPieceClick(e);
});

orangeUnusedPieces.addEventListener("click", (e) => {
  handleUnusedPieceClick(e);
});

function aiMove() {
  my_turn = false;
  const startTime = Date.now();

  const ai_selection = selectMoveAlphabeta(currentGame, 1, depthLimit);
  const aiMove = ai_selection[0];

  const timeTaken = Date.now() - startTime;
  console.log(`AI move computed in ${timeTaken} ms`);
  console.log(ai_selection);

  currentGame = playMove(currentGame, 1, aiMove);
  updateBoard(currentGame);
  my_turn = true;
}

boardElement.addEventListener("click", (e) => {
  const boardCell = e.target.closest(".cell[data-row][data-col]");
  if (!boardCell || !my_turn) return;

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
  clearSelectionHighlight();
  selection = null;
  updateBoard(currentGame);

  aiMove();
});

createBoard();
currentGame = createStartingGame();
updateBoard(currentGame);