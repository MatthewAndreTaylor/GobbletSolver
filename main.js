function showToast(text) {
    let toast = document.getElementById("toast");
    toast.className = "show";
    toast.textContent = text;
    setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 4000);
}

// Game setup and rendering
const boardElement = document.getElementById('board');
const orangeUnusedPieces = document.getElementById('orange-unused-pieces');
const blueUnusedPieces = document.getElementById('blue-unused-pieces');
const playerPieceContainers = [blueUnusedPieces, orangeUnusedPieces];
const colorToggleButton = document.getElementById('color-toggle');
const pieceSizes = {
    1: 'piece-size-1',
    2: 'piece-size-2',
    3: 'piece-size-3'
};

const aistartButton = document.getElementById('ai-start');
const humanstartButton = document.getElementById('human-start');

function hideButtons() {
    aistartButton.disabled = true;
    humanstartButton.disabled = true;
    aistartButton.style.display = 'none';
    humanstartButton.style.display = 'none';
}

function createPieceElement(piece) {
    const pieceElement = document.createElement('img');
    pieceElement.classList.add('piece-token', pieceSizes[getPower(piece)]);
    pieceElement.dataset.pieceId = piece;
    pieceElement.src = getPieceImage(piece);
    pieceElement.alt = `Gobblet piece ${getPower(piece)}`;
    pieceElement.draggable = false;
    return pieceElement;
}

function getPieceImage(piece) {
    return `game_pieces/${playerColors[getColor(piece)]}.jpg`;
}

function updateAllPieceArt() {
    document.querySelectorAll('.piece-token').forEach((pieceElement) => {
        const piece = parseInt(pieceElement.dataset.pieceId);
        pieceElement.src = getPieceImage(piece);
        pieceElement.alt = `Gobblet piece ${getPower(piece)}`;
    });
}

function renderPiece(cell, piece) {
    cell.replaceChildren(createPieceElement(piece));
}

aistartButton.addEventListener('click', () => {
    startNewGame();
    aiMove();
    hideButtons();
});

humanstartButton.addEventListener('click', () => {
    startNewGame();
    hideButtons();
});


let currentGame = null;
let playerColors = ['blue', 'orange'];

colorToggleButton.addEventListener('click', () => {
    playerColors = [playerColors[1], playerColors[0]];
    colorToggleButton.textContent = `Switch Colors: ${playerColors[0]} / ${playerColors[1]}`;
    updateAllPieceArt();
});

let board = [
        [[-1], [-1], [-1]],
        [[-1], [-1], [-1]],
        [[-1], [-1], [-1]]
    ];
let players = [
    new Player([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]),
    new Player([6, 7, 8, 9, 10, 11], [6, 7, 8, 9, 10, 11])
];

function createBoard() {
    boardElement.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = i;
            cell.dataset.col = j;
            boardElement.appendChild(cell);
        }
    }

    // Each player has a list unused pieces
    for (let i = 0; i < 2; i++) {
        for (let piece of players[i].unusedPieces) {
            const pieceElement = document.createElement('div');
            pieceElement.classList.add('cell');
            pieceElement.dataset.id = piece;
            renderPiece(pieceElement, piece);
            playerPieceContainers[i].appendChild(pieceElement);
        }
    }
    
}

function updateBoard(game) {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const cell = document.querySelector(`.cell[data-row='${i}'][data-col='${j}']`);
            cell.replaceChildren();
            if (game.board[i][j].slice(-1)[0] !== -1) {
                const piece = game.board[i][j].slice(-1)[0];
                renderPiece(cell, piece);
            }
        }
    }

    // Each player has a list unused pieces
    for (let i = 0; i < 2; i++) {
        for (let piece of game.players[i].pieces) {
            const cell = document.querySelector(`.cell[data-id='${piece}']`);
            if (game.players[i].unusedPieces.includes(piece)) {
                cell.replaceChildren(createPieceElement(piece));
            }
            else if (cell) {
                cell.remove();   
            }
        }
    }

    if (gameOver(game)) {
        let utility = computeUtility(game, 0);
        let text;
        if (utility > 0) {
            text = 'You Win!';
        } else if (utility < 0) {
            text = 'You Lose!';
        } else {
            text = 'Draw!';
        }
        showToast(text);
    }
}

function startNewGame() {
    currentGame = new GameConfig(board, players);
    updateBoard(currentGame);
}

let selection = null;
let my_turn = true;

blueUnusedPieces.addEventListener('click', (e) => {
    const pieceCell = e.target.closest('.cell[data-id]');
    if (!pieceCell) {
        return;
    }
    const piece = parseInt(pieceCell.dataset.id);
    if (selection === null) {
        selection = [piece, null];
        const cell = document.querySelector(`.cell[data-id='${piece}']`);
        cell.style.backgroundColor = 'lightyellow';
    } else {
        let selection_pid = selection[0];
        const cell = document.querySelector(`.cell[data-id='${selection_pid}']`);
        cell.style.backgroundColor = 'white';
        selection = null;
    }
});

function aiMove() {
    my_turn = false;

    let depth_limit = 5; // Set the depth for the AI search

    // Logic to handle the AI's move
    const ai_selection = selectMoveAlphabeta(currentGame, 1, depth_limit);
    const aiMove = ai_selection[0];
    console.log(aiMove);

    console.log(ai_selection[1]);

    currentGame = play_move(currentGame, 1, aiMove);
    updateBoard(currentGame);

    my_turn = true;
}

boardElement.addEventListener('click', (e) => {
    const boardCell = e.target.closest('.cell[data-row][data-col]');
    if (!boardCell) {
        return;
    }

    const row = parseInt(boardCell.dataset.row);
    const col = parseInt(boardCell.dataset.col);

    if (!my_turn) {
        return;
    }

    if (selection == null) {
        let pid = currentGame.board[row][col].slice(-1)[0];
        if (pid in currentGame.players[0].pieces) {
            const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
            cell.style.backgroundColor = 'lightyellow';
            selection = [pid, [row, col]];
        }
        return;
    }

    let selection_pid = selection[0];
    let start_pos = selection[1];

    const move = new Move(selection_pid, start_pos, [row, col]);

    if (!moveExists(getPossibleMoves(currentGame, 0), move)) {
        return;
    }

    currentGame = play_move(currentGame, 0, move);
    const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
    cell.style.backgroundColor = 'white';

    if (start_pos !== null) {
        const cell = document.querySelector(`.cell[data-row='${start_pos[0]}'][data-col='${start_pos[1]}']`);
        cell.style.backgroundColor = 'white';
    }
    
    updateBoard(currentGame);
    selection = null;

    aiMove();
});


createBoard();