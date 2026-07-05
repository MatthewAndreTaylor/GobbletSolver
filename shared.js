/*******************************************************
 * Author: Matthew Taylor
 * Created: 2024
 *
 * © 2024 Matthew Taylor. All rights reserved.
 *******************************************************/

const pieceMap = [
    [0, 1], [0, 1], [0, 2], [0, 2], [0, 3], [0, 3],
    [1, 1], [1, 1], [1, 2], [1, 2], [1, 3], [1, 3]
];

const winningLines = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]]
];

function getColor(piece) {
    return pieceMap[piece][0];
}

function getPower(piece) {
    if (piece === -1) {
        return 0;
    }
    return pieceMap[piece][1];
}

function next_player(player_id) {
    return 1 - player_id;
}

function peek(cell) {
    return cell.length > 0 ? cell[cell.length - 1] : -1;
}

class Player {
    constructor(unusedPieces) {
      this.unusedPieces = unusedPieces;
    }
}
  
class GameConfig {
    constructor(board, players) {
        this.board = board;
        this.players = players;
    }
}

function gameOver(game) {
    for (let line of winningLines) {
        let p1Wins = true;
        let p2Wins = true;

        for (let j = 0; j < 3; j++) {
            const [r, c] = line[j];
            const topPiece = peek(game.board[r][c]);
            
            if (topPiece === -1 || getColor(topPiece) !== 0) p1Wins = false;
            if (topPiece === -1 || getColor(topPiece) !== 1) p2Wins = false;
        }

        if (p1Wins || p2Wins) return true;
    }

    return false;
}

function computeUtility(game, player) {
  const player2 = next_player(player);

  // Check if a player has won
  for (let line of winningLines) {
    let p1Count = 0;
    let p2Count = 0;
    for (let j = 0; j < 3; j++) {
          const [r, c] = line[j];
          const topPiece = peek(game.board[r][c]);
          if (topPiece !== -1) {
              if (getColor(topPiece) === player) p1Count++;
              if (getColor(topPiece) === player2) p2Count++;
          }
      }
    if (p2Count === 3) return -1000;
    if (p1Count === 3) return 1000;
  }

  return 0;
}


class Move {
    constructor(pid, start_pos, end_pos) {
        this.pid = pid;
        this.start_pos = start_pos;
        this.end_pos = end_pos;
    } 
}

function posEq(a, b) {
    if (a === null || b === null) return a === b;
    return a[0] === b[0] && a[1] === b[1];
}

function moveExists(movesList, moveInstance) {
    return movesList.some(move =>
        posEq(move.start_pos, moveInstance.start_pos) &&
        posEq(move.end_pos, moveInstance.end_pos) &&
        move.pid === moveInstance.pid
    );
}


function getPossibleMoves(game, player_id) {
  const moves = [];

  if (gameOver(game)) return moves;

  const player = game.players[player_id];
  const topPieces = new Array(9);
  const cellPowers = new Array(9);
  const myPieceIndices = [];

  let cellIndex = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const pid = peek(game.board[i][j]);
      topPieces[cellIndex] = pid;
      cellPowers[cellIndex] = (pid === -1) ? -1 : getPower(pid);
      if (pid !== -1 && getColor(pid) === player_id) {
          myPieceIndices.push(cellIndex);
      }
      cellIndex++;
    }
  }

  for (let i = 0; i < player.unusedPieces.length; i++) {
    const piece = player.unusedPieces[i];
    const piecePower = getPower(piece);

    for (let c = 0; c < 9; c++) {
      if (topPieces[c] === -1 || piecePower > cellPowers[c]) {
        moves.push(new Move(piece, null, [Math.floor(c / 3), c % 3]));
      }
    }
  }

  for (let i = 0; i < myPieceIndices.length; i++) {
    const startIndex = myPieceIndices[i];
    const piece = topPieces[startIndex];
    const piecePower = cellPowers[startIndex];
    const startPos = [Math.floor(startIndex / 3), startIndex % 3];

    for (let c = 0; c < 9; c++) {
      if (c === startIndex) continue; // Skip current position
      if (topPieces[c] === -1 || piecePower > cellPowers[c]) {
        moves.push(new Move(piece, startPos, [Math.floor(c / 3), c % 3]));
      }
    }
  }

  return moves;
}

function play_move(game, player_id, move) {
    const new_board = game.board.map(row => row.map(cell => [...cell]));

    if (move.start_pos !== null){
        const [x, y] = move.start_pos;
        new_board[x][y].pop();
    }

    const [i, j] = move.end_pos;
    new_board[i][j].push(move.pid);

    let new_players = [null, null];
    const playerUnusedPieces = game.players[player_id].unusedPieces.filter(item => item !== move.pid);

    new_players[player_id] = new Player(playerUnusedPieces);

    let player2_id = next_player(player_id);
    new_players[player2_id] = new Player(Array.from(game.players[player2_id].unusedPieces));

    return new GameConfig(new_board, new_players);
}

// Solvers
function alphabetaMinNode(board, color, alpha, beta, limit) {
    const nextCol = next_player(color);
    const moves = getPossibleMoves(board, nextCol);
    let bestMove = null;
    let bestUtility = Infinity;
  
    if (limit <= 0 || moves.length === 0) {
      return [null, computeUtility(board, color)];
    }
  
    for (let move of moves) {
      const newBoard = play_move(board, nextCol, move);
      const [_, utility] = alphabetaMaxNode(newBoard, color, alpha, beta, limit - 1);
  
      if (utility < bestUtility) {
        bestMove = move;
        bestUtility = utility;
      }
  
      beta = Math.min(beta, utility);
      if (beta <= alpha) {
        break;
      }
    }
  
    return [bestMove, bestUtility];
  }
  
  function alphabetaMaxNode(board, color, alpha, beta, limit) {
    const moves = getPossibleMoves(board, color);
    let bestMove = null;
    let bestUtility = -Infinity;
  
    if (limit <= 0 || moves.length === 0) {
      return [null, computeUtility(board, color)];
    }
  
    for (let move of moves) {
      const newBoard = play_move(board, color, move);
      const [_, utility] = alphabetaMinNode(newBoard, color, alpha, beta, limit - 1);
  
      if (utility > bestUtility) {
        bestMove = move;
        bestUtility = utility;
      }
  
      alpha = Math.max(alpha, utility);
      if (beta <= alpha) {
        break;
      }
    }
  
    return [bestMove, bestUtility];
  }
  
  function selectMoveAlphabeta(gameConfig, color, limit) {
    return alphabetaMaxNode(gameConfig, color, -Infinity, Infinity, limit);
  }