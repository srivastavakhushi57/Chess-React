export const FILES = "abcdefgh";

const idx = (r, c) => r * 8 + c;
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const opp = (color) => (color === "w" ? "b" : "w");
export const sqName = (s) => FILES[s & 7] + (8 - (s >> 3));

const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function initialState() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board = Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    board[idx(0, c)] = { t: back[c], c: "b" };
    board[idx(1, c)] = { t: "p", c: "b" };
    board[idx(6, c)] = { t: "p", c: "w" };
    board[idx(7, c)] = { t: back[c], c: "w" };
  }
  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null, 
  };
}

export function isAttacked(board, sq, by) {
  const r = sq >> 3;
  const c = sq & 7;

  const d = by === "w" ? 1 : -1;
  for (const dc of [-1, 1]) {
    const rr = r + d, cc = c + dc;
    if (inB(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p && p.c === by && p.t === "p") return true;
    }
  }
  for (const [dr, dc] of KNIGHT) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p && p.c === by && p.t === "n") return true;
    }
  }
  for (const [dr, dc] of KING) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) {
      const p = board[idx(rr, cc)];
      if (p && p.c === by && p.t === "k") return true;
    }
  }
  const slide = (dirs, types) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) {
        const p = board[idx(rr, cc)];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  };
  return slide(DIAG, ["b", "q"]) || slide(ORTH, ["r", "q"]);
}

export function inCheck(board, color) {
  const k = board.findIndex((p) => p && p.t === "k" && p.c === color);
  return isAttacked(board, k, opp(color));
}

function pseudoMoves(state, from) {
  const { board, castling, ep } = state;
  const p = board[from];
  if (!p) return [];
  const r = from >> 3;
  const c = from & 7;
  const out = [];
  const add = (to, extra = {}) => out.push({ from, to, capture: !!board[to], ...extra });

  if (p.t === "p") {
    const d = p.c === "w" ? -1 : 1;
    const start = p.c === "w" ? 6 : 1;
    const last = p.c === "w" ? 0 : 7;
    if (inB(r + d, c) && !board[idx(r + d, c)]) {
      add(idx(r + d, c), { promo: r + d === last });
      if (r === start && !board[idx(r + 2 * d, c)]) {
        add(idx(r + 2 * d, c), { double: true });
      }
    }
    for (const dc of [-1, 1]) {
      const rr = r + d, cc = c + dc;
      if (!inB(rr, cc)) continue;
      const to = idx(rr, cc);
      const target = board[to];
      if (target && target.c !== p.c) add(to, { promo: rr === last });
      else if (!target && to === ep) add(to, { ep: true, capture: true });
    }
  } else if (p.t === "n" || p.t === "k") {
    const deltas = p.t === "n" ? KNIGHT : KING;
    for (const [dr, dc] of deltas) {
      const rr = r + dr, cc = c + dc;
      if (!inB(rr, cc)) continue;
      const t = board[idx(rr, cc)];
      if (!t || t.c !== p.c) add(idx(rr, cc));
    }
    if (p.t === "k") {
      const row = p.c === "w" ? 7 : 0;
      const enemy = opp(p.c);
      if (from === idx(row, 4)) {
        if (
          castling[p.c + "K"] &&
          !board[idx(row, 5)] && !board[idx(row, 6)] &&
          !isAttacked(board, idx(row, 4), enemy) &&
          !isAttacked(board, idx(row, 5), enemy)
        ) add(idx(row, 6), { castle: "K" });
        if (
          castling[p.c + "Q"] &&
          !board[idx(row, 1)] && !board[idx(row, 2)] && !board[idx(row, 3)] &&
          !isAttacked(board, idx(row, 4), enemy) &&
          !isAttacked(board, idx(row, 3), enemy)
        ) add(idx(row, 2), { castle: "Q" });
      }
    }
  } else {
    const dirs = p.t === "b" ? DIAG : p.t === "r" ? ORTH : [...DIAG, ...ORTH];
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) {
        const t = board[idx(rr, cc)];
        if (!t) add(idx(rr, cc));
        else {
          if (t.c !== p.c) add(idx(rr, cc));
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return out;
}

export function applyMove(state, move, promoType = "q") {
  const board = state.board.slice();
  const piece = board[move.from];
  const r = move.from >> 3;

  board[move.to] = move.promo ? { t: promoType, c: piece.c } : piece;
  board[move.from] = null;

  if (move.ep) board[idx(r, move.to & 7)] = null; // remove captured pawn
  if (move.castle === "K") {
    board[idx(r, 5)] = board[idx(r, 7)];
    board[idx(r, 7)] = null;
  } else if (move.castle === "Q") {
    board[idx(r, 3)] = board[idx(r, 0)];
    board[idx(r, 0)] = null;
  }

  const castling = { ...state.castling };
  if (piece.t === "k") {
    castling[piece.c + "K"] = false;
    castling[piece.c + "Q"] = false;
  }
  const corners = { [idx(7, 0)]: "wQ", [idx(7, 7)]: "wK", [idx(0, 0)]: "bQ", [idx(0, 7)]: "bK" };
  if (corners[move.from]) castling[corners[move.from]] = false;
  if (corners[move.to]) castling[corners[move.to]] = false;

  const ep = move.double ? idx((r + (move.to >> 3)) / 2, move.from & 7) : null;

  return { board, turn: opp(state.turn), castling, ep };
}

export function legalMoves(state, from) {
  const piece = state.board[from];
  if (!piece) return [];
  return pseudoMoves(state, from).filter((m) => {
    const next = applyMove(state, m);
    return !inCheck(next.board, piece.c);
  });
}

export function allLegalMoves(state) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (p && p.c === state.turn) out.push(...legalMoves(state, i));
  }
  return out;
}

export function getStatus(state) {
  const check = inCheck(state.board, state.turn);
  const hasMoves = allLegalMoves(state).length > 0;
  if (!hasMoves) return check ? "checkmate" : "stalemate";
  return check ? "check" : "ok";
}

export function toSAN(state, move, promoType = "q") {
  const piece = state.board[move.from];
  let san = "";

  if (move.castle) {
    san = move.castle === "K" ? "O-O" : "O-O-O";
  } else {
    if (piece.t === "p") {
      if (move.capture) san += FILES[move.from & 7];
    } else {
      san += piece.t.toUpperCase();
      const others = allLegalMoves(state).filter(
        (m) => m.to === move.to && m.from !== move.from && state.board[m.from].t === piece.t
      );
      if (others.length) {
        const sameFile = others.some((m) => (m.from & 7) === (move.from & 7));
        const sameRank = others.some((m) => (m.from >> 3) === (move.from >> 3));
        if (!sameFile) san += FILES[move.from & 7];
        else if (!sameRank) san += 8 - (move.from >> 3);
        else san += sqName(move.from);
      }
    }
    if (move.capture) san += "x";
    san += sqName(move.to);
    if (move.promo) san += "=" + promoType.toUpperCase();
  }

  const status = getStatus(applyMove(state, move, promoType));
  if (status === "checkmate") san += "#";
  else if (status === "check") san += "+";
  return san;
}