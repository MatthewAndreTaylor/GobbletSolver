# Gobblet Game Solver

This repo includes JavaScript and Python implementations of a search engine for 3x3 Gobblet Gobblers.
To make it simple the game uses numbers to signify which gobblets can be stacked onto each other.
Three gobblets in a row to win

```bash
python gobblet_py/latest/main.py
```

Select the piece you want to move by clicking it and click an end location on the board afterwards

Open `index.html` for the browser version. In Python, append `1` to the command to let the AI start; the default is human first. The `_legacy_prototype` directory is an older implementation.

To report a browser game, reload after updating the code, play the game, and copy the final `Gobblet replay:` line from the browser console. It records both players' moves in order; each move is also logged as it happens.

### Search behavior

Both interfaces search to 20 plies without a fixed time limit. The engines evaluate both players' threats, prefer faster wins and slower forced losses, and cache search bounds. Difficult positions can take longer while the search completes. Engine callers can still explicitly request a time budget, which uses the deepest fully completed iteration.

After each AI move, the result indicator shows who can force a win and how many moves remain with best play. Each player's turn counts as one move; the AI move already displayed on the board is excluded. A proven drawing result shows that the AI can secure a draw, while an unresolved search shows "Outcome uncertain." The indicator uses the existing search result and refreshes after the next AI move; a human move clears the previous prediction while analysis runs.

Both games use a fourfold-repetition draw rule: reaching the same complete position with the same player to move for the fourth time ends the game in a draw. Covered pieces and unused reserves are part of the position. Both engines include the played history and possible future repetitions in their search; their caches distinguish different repetition histories.

The AI prefers a proven win, then a confirmed draw, then an unresolved heuristic position, and finally a proven loss. A cutoff evaluation of zero is not a confirmed draw. A drawing continuation does not stop the search for a win. For engine callers, pass the position-key history (including the current position) using the JavaScript selector's fifth argument or Python's `history=` keyword.

If every defense is proven losing, the AI maximizes survival against the opponent's fastest win.

It searches again after each human move, so a mistake can create a new winning or drawing opportunity. This does not predict human mistakes or guarantee an escape. In the reported replay after move 9, moving the AI's large piece from square 0 to 8 survives four more plies; every other defense loses within two.

This is a depth-limited engine, not an exhaustive solution of the game. It cannot guarantee unbeatable play. Moreover, standard Gobblet Gobblers is a [forced win for the first player with perfect play](https://possiblywrong.wordpress.com/2024/06/11/strongly-solving-gobblet-gobblers-using-retrograde-analysis/), so an AI playing second can legitimately lose.

Moving a piece that exposes an opponent's winning line loses unless its destination breaks that line. If both players have a line after a move, the opponent of the mover wins.

### Tests

No additional test dependencies are needed (Node.js 18+ and Python 3.10+):

```bash
node --test tests/*.test.js
python -m unittest discover -s gobblet_py/latest -p "test_*.py"
```

The tests cover tactical regressions for both colors, stacking and uncovering, agreement with exhaustive minimax on small searches, fourfold repetition, draw preferences, delaying forced losses, history-sensitive caching, optional search timeouts, and UI turn handling. They do not prove perfect play over the entire game.

Verify the human's large-center opening with a separate rules implementation:

```bash
node tools/verify_opening.js --opening
```

This verifier uses its own square stacks, move generation, win detection, and fourfold-repetition tracking, without importing either production engine. It checks every AI reply and proves a human win within 13 total plies from this opening, including the added repetition rule. Its cache distinguishes complete repetition histories. The AI therefore cannot force a draw against correct human play from this opening. This check does not solve every possible position; failure to prove a win within the search bound alone would not prove a draw.

### Benchmarks

Run the Python performance benchmark from the current engine directory:

```bash
cd gobblet_py/latest
python benchmark.py
```

In the browser you initially play blue; use the start buttons to choose who moves first.

## Game information 🔍

[Gobblet wiki](https://en.wikipedia.org/wiki/Gobblet)

[Game official rules](https://www.blueorangegames.com/webroot/img/games/rules/Gobblers_Rules_US.pdf)

<img title="Gobblet Game" alt="An image of the Gobblet board game" src="https://brightbean.com/cdn/shop/products/71dXqfCymPL._AC_SL1400_814x700.jpg?v=1674147347" width="300">


