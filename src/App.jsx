import React, { useState, useEffect, useMemo } from "react";
import { initialState, legalMoves, applyMove, toSAN, getStatus } from "./chess.js";
import "./App.css";

const V = "\uFE0E"; // forces text (not emoji) rendering
const GLYPH = { k: "♚" + V, q: "♛" + V, r: "♜" + V, b: "♝" + V, n: "♞" + V, p: "♟" + V };
const NAMES = { w: "White", b: "Black" };
const FILES = "abcdefgh";

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function App() {
  const [minutes, setMinutes] = useState(10);
  const [game, setGame] = useState(initialState);
  const [moves, setMoves] = useState([]); // SAN strings
  const [lastMove, setLastMove] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null); // move waiting for promotion choice
  const [message, setMessage] = useState("");
  const [times, setTimes] = useState({ w: 600, b: 600 });
  const [started, setStarted] = useState(false);

  const status = useMemo(() => getStatus(game), [game]);
  const timeout = times.w <= 0 ? "w" : times.b <= 0 ? "b" : null;
  const over = status === "checkmate" || status === "stalemate" || timeout !== null;
  const targets = useMemo(
    () => (selected === null ? [] : legalMoves(game, selected)),
    [game, selected]
  );

  // Only the player whose turn it is has a running clock
  useEffect(() => {
    if (!started || over) return;
    const id = setInterval(() => {
      setTimes((t) => ({ ...t, [game.turn]: Math.max(0, t[game.turn] - 1) }));
    }, 1000);
    return () => clearInterval(id);
  }, [started, over, game.turn]);

  const makeMove = (move, promo = "q") => {
    const san = toSAN(game, move, promo);
    setGame(applyMove(game, move, promo));
    setMoves((m) => [...m, san]);
    setLastMove(move);
    setSelected(null);
    setPending(null);
    setMessage("");
    setStarted(true); // clocks begin after White's first move
  };

  const handleSquare = (i) => {
    if (over || pending) return;
    const piece = game.board[i];

    if (selected !== null) {
      if (i === selected) {
        setSelected(null);
        return;
      }
      const move = targets.find((t) => t.to === i);
      if (move) {
        if (move.promo) setPending(move);
        else makeMove(move);
        return;
      }
    }

    if (piece && piece.c === game.turn) {
      setSelected(i);
      setMessage("");
      return;
    }

    if (selected !== null) {
      setMessage(
        status === "check"
          ? "Illegal move: your king is in check."
          : "Illegal move: that piece can't go there, or it would expose your king."
      );
      setSelected(null);
    } else if (piece) {
      setMessage(`It's ${NAMES[game.turn]}'s turn.`);
    }
  };

  const newGame = (mins = minutes) => {
    setGame(initialState());
    setMoves([]);
    setLastMove(null);
    setSelected(null);
    setPending(null);
    setMessage("");
    setStarted(false);
    setTimes({ w: mins * 60, b: mins * 60 });
  };

  const changeTime = (e) => {
    const mins = Number(e.target.value);
    setMinutes(mins);
    newGame(mins);
  };

  // Banner text
  const winner = game.turn === "w" ? "Black" : "White";
  let banner = `${NAMES[game.turn]} to move`;
  let bannerClass = "";
  if (timeout) {
    banner = `⏰ ${NAMES[timeout]} ran out of time. ${NAMES[timeout === "w" ? "b" : "w"]} wins!`;
    bannerClass = "end";
  } else if (status === "checkmate") {
    banner = `♚ Checkmate! ${winner} wins.`;
    bannerClass = "end";
  } else if (status === "stalemate") {
    banner = "Stalemate. The game is a draw.";
    bannerClass = "end";
  } else if (status === "check") {
    banner = `Check! ${NAMES[game.turn]} must respond.`;
    bannerClass = "check";
  }

  // Move list in pairs: 1. e4 e5
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  }

  const clock = (color) => (
    <div className={`clock ${game.turn === color && !over ? "active" : ""} ${times[color] <= 30 ? "low" : ""}`}>
      <span>{NAMES[color]}</span>
      <strong>{fmt(times[color])}</strong>
    </div>
  );

  return (
    <div className="chess-app">
      <h1>♞ Chess</h1>

      <div className="layout">
        <div className="board-area">
          {clock("b")}

          <div className="board">
            {game.board.map((piece, i) => {
              const r = i >> 3;
              const c = i & 7;
              const isTarget = targets.find((t) => t.to === i);
              const isCheckedKing =
                piece && piece.t === "k" && piece.c === game.turn &&
                (status === "check" || status === "checkmate");
              const cls = [
                "square",
                (r + c) % 2 === 0 ? "light" : "dark",
                selected === i ? "selected" : "",
                lastMove && (lastMove.from === i || lastMove.to === i) ? "last" : "",
                isCheckedKing ? "in-check" : "",
                isTarget ? (isTarget.capture ? "target capture" : "target") : "",
              ].join(" ");

              return (
                <div key={i} className={cls} onClick={() => handleSquare(i)}>
                  {c === 0 && <span className="coord rank">{8 - r}</span>}
                  {r === 7 && <span className="coord file">{FILES[c]}</span>}
                  {piece && <span className={`piece ${piece.c}`}>{GLYPH[piece.t]}</span>}
                </div>
              );
            })}
          </div>

          {clock("w")}
        </div>

        <aside className="side">
          <div className={`banner ${bannerClass}`}>{banner}</div>
          {message && <div className="notice">{message}</div>}

          <div className="controls">
            <label>
              Time per player
              <select value={minutes} onChange={changeTime}>
                <option value={1}>1 min</option>
                <option value={3}>3 min</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
              </select>
            </label>
            <button onClick={() => newGame()}>New Game</button>
          </div>

          <h2>Moves</h2>
          <div className="move-list">
            {rows.length === 0 ? (
              <p className="empty">No moves yet. White starts.</p>
            ) : (
              <table>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.n}>
                      <td className="num">{row.n}.</td>
                      <td>{row.white}</td>
                      <td>{row.black || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </aside>
      </div>

      {pending && (
        <div className="overlay">
          <div className="dialog">
            <h3>Promote pawn to:</h3>
            <div className="promo-options">
              {["q", "r", "b", "n"].map((t) => (
                <button key={t} onClick={() => makeMove(pending, t)}>
                  <span className={`piece ${game.turn}`}>{GLYPH[t]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;