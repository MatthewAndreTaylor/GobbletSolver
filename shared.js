/*******************************************************
 * Author: Matthew Taylor
 * Created: 2024
 *
 * © 2024 Matthew Taylor. All rights reserved.
 *******************************************************/

const pieceMap = new Map([
    [0, [0, 1]],
    [1, [0, 1]],
    [2, [0, 2]],
    [3, [0, 2]],
    [4, [0, 3]],
    [5, [0, 3]],
    [6, [1, 1]],
    [7, [1, 1]],
    [8, [1, 2]],
    [9, [1, 2]],
    [10, [1, 3]],
    [11, [1, 3]]
]);

function getColor(piece) {
    return pieceMap.get(piece)[0];
}

function getPower(piece) {
    if (piece === -1) {
        return 0;
    }
    return pieceMap.get(piece)[1];
}

function next_player(player_id) {
    return 1 - player_id;
}

class Player {
    constructor(pieces, unusedPieces) {
      this.pieces = pieces;
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

    for (let line of winningLines) {
        if (line.every(([i, j]) => game.players[0].pieces.includes(game.board[i][j].slice(-1)[0]))) {
            return true;
        }
        if (line.every(([i, j]) => game.players[1].pieces.includes(game.board[i][j].slice(-1)[0]))) {
            return true;
        }
    }

    return false;
}

function computeUtility(game, player) {
  const player2 = next_player(player);

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

  // Check if a player has won
  for (let line of winningLines) {
    const opponentLine = line.every(([i, j]) => game.players[player2].pieces.includes(game.board[i][j].slice(-1)[0]));
    if (opponentLine) {
      return -1000;
    }

    const playerLine = line.every(([i, j]) => game.players[player].pieces.includes(game.board[i][j].slice(-1)[0]));
    if (playerLine) {
      return 1000;
    }
  }

  // Check lines of 2
  let playerScore = 0;
  let opponentScore = 0;

  for (let line of winningLines) {
    const playerPiecesInLine = line.reduce((count, [i, j]) => 
      count + (game.board[i][j].length > 0 && game.players[player].pieces.includes(game.board[i][j].slice(-1)[0]) ? 1 : 0), 0
    );
    const opponentPiecesInLine = line.reduce((count, [i, j]) => 
      count + (game.board[i][j].length > 0 && game.players[player2].pieces.includes(game.board[i][j].slice(-1)[0]) ? 1 : 0), 0
    );

    if (opponentPiecesInLine === 2 && playerPiecesInLine === 0) {
      opponentScore += 100;
    } else if (playerPiecesInLine === 2 && opponentPiecesInLine === 0) {
      playerScore += 100;
    }
  }

  return playerScore - opponentScore;
}

function computeUtilitySimple(game, player) {
  const player2 = next_player(player);

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

  // Check if a player has won
  for (let line of winningLines) {
    const opponentLine = line.every(([i, j]) => game.players[player2].pieces.includes(game.board[i][j].slice(-1)[0]));
    if (opponentLine) {
      return -1000;
    }

    const playerLine = line.every(([i, j]) => game.players[player].pieces.includes(game.board[i][j].slice(-1)[0]));
    if (playerLine) {
      return 1000;
    }
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
  if (a === null || b === null) {
    return a === b;
  }
  return (a.length === b.length && a.every((v, i) => v === b[i]));
}

function moveExists(movesList, moveInstance) {
    return movesList.some(move =>
        posEq(move.start_pos, moveInstance.start_pos) &&
        posEq(move.end_pos, moveInstance.end_pos) &&
        move.pid === moveInstance.pid
    );
}

const test_pieces = [6,7,8,9,10,11];


function getPossibleMoves(game, player_id) {
  const moves = []

  if (gameOver(game)){
      return moves
  }

  const my_piece_locations = new Map();
  for (let i = 0; i < 3; i++){
      for (let j = 0; j < 3; j++){
          let pid = game.board[i][j].slice(-1)[0];
          if (game.players[player_id].pieces.includes(pid)){
              my_piece_locations.set(pid, [i, j]);
          }
      }
  }

  const available_pieces = [...game.players[player_id].unusedPieces];

  for (let piece of my_piece_locations.keys()){
      available_pieces.push(piece);
  }

  for (let i = 0; i < 3; i++){
      for (let j = 0; j < 3; j++){
          for (let piece of available_pieces){
              if (game.board[i][j].slice(-1)[0] == -1){
                  if (game.players[player_id].unusedPieces.includes(piece)){
                      moves.push(new Move(piece, null, [i, j]));
                  } else {
                      moves.push(new Move(piece, my_piece_locations.get(piece), [i, j]));
                  }
              } else if (getPower(piece) > getPower(game.board[i][j].slice(-1)[0])){
                  if (game.players[player_id].unusedPieces.includes(piece)){
                      moves.push(new Move(piece, null, [i, j]));
                  } else {
                      moves.push(new Move(piece, my_piece_locations.get(piece), [i, j]));
                  }
              }
          }
      }
  }

  return moves
}



function play_move(game, player_id, move) {
    let new_board = [];
    for (let i = 0; i < 3; i++){
        new_board.push([]);
        for (let j = 0; j < 3; j++){
            new_board[i].push(Array.from(game.board[i][j]));
        }
      }

    if (move.start_pos !== null){
        const [x, y] = move.start_pos;
        new_board[x][y].pop();
    }

    const [i, j] = move.end_pos;
    new_board[i][j].push(move.pid)

    let new_players = [null, null]

    let playerUnusedPieces = game.players[player_id].unusedPieces.filter(function(item) {
        return item !== move.pid
    })

    new_players[player_id] = new Player(Array.from(game.players[player_id].pieces), playerUnusedPieces)

    let player2_id = next_player(player_id)
    new_players[player2_id] = new Player(Array.from(game.players[player2_id].pieces), Array.from(game.players[player2_id].unusedPieces));

    return new GameConfig(new_board, new_players)
}





// Solvers
function alphabetaMinNode(board, color, alpha, beta, limit) {
    const nextCol = next_player(color);
    const moves = getPossibleMoves(board, nextCol);
    let bestMove = [0, 0];
    let bestUtility = Infinity;
  
    if (limit <= 0 || moves.length === 0) {
      return [null, computeUtilitySimple(board, color)];
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
    let bestMove = [0, 0];
    let bestUtility = -Infinity;
  
    if (limit <= 0 || moves.length === 0) {
      return [null, computeUtilitySimple(board, color)];
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