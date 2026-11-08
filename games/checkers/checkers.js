/* ==========================================================
   跳棋 Checkers
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const N = 8;
    const CELL = 52;
    const BS = CELL * N;
    const BX = (W - BS) / 2;
    const BY = 96;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const RAD = 21;

    const WIN_KEY = 'webgames.checkers.wins';
    const LOSS_KEY = 'webgames.checkers.losses';

    const DIFFS = { easy: 1, normal: 3, hard: 4 };

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function roundRectPath(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + w, y, x + w, y + h, rr);
        c.arcTo(x + w, y + h, x, y + h, rr);
        c.arcTo(x, y + h, x, y, rr);
        c.arcTo(x, y, x + w, y, rr);
        c.closePath();
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        youCount: document.getElementById('you-count'),
        cpuCount: document.getElementById('cpu-count'),
        moves: document.getElementById('moves'),
        record: document.getElementById('record'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        diffGroup: document.getElementById('diff-group'),
        undoBtn: document.getElementById('undo-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let board = new Int8Array(64);
    let turn = 1;                  // 1 玩家 2 电脑
    let state = 'ready';           // ready | playing | over
    let diff = 'normal';
    let selected = null;           // {r, c}
    let legal = [];                // 当前全部合法走法
    let lastMove = null;
    let moveCount = 0;
    let history = [];
    let thinking = false;
    let busy = false;              // 动画 / AI 落子期间
    let hover = null;
    let toast = null;
    let fx = [];
    let hudCache = '';
    let aiTimer = 0;
    let winnerSide = 0;

    /* ---------- 棋盘数据 ---------- */

    function ownerOf(v) {
        return v === 0 ? 0 : (v <= 2 ? 1 : 2);
    }

    function isKing(v) {
        return v === 2 || v === 4;
    }

    function dirsFor(v) {
        if (isKing(v)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        return v <= 2 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    }

    function isDark(r, c) {
        return (r + c) % 2 === 1;
    }

    function newBoard() {
        const bd = new Int8Array(64);
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (!isDark(r, c)) continue;
                if (r < 3) bd[r * N + c] = 3;
                else if (r > 4) bd[r * N + c] = 1;
            }
        }
        return bd;
    }

    function countOf(bd, side) {
        let n = 0;
        for (let i = 0; i < 64; i++) {
            if (bd[i] && ownerOf(bd[i]) === side) n++;
        }
        return n;
    }

    /* ---------- 走法生成 ---------- */

    function capPaths(bd, r, c, prefix, out) {
        const v = bd[r * N + c];
        const ds = dirsFor(v);
        let extended = false;
        for (let k = 0; k < ds.length; k++) {
            const mr = r + ds[k][0];
            const mc = c + ds[k][1];
            const tr = r + ds[k][0] * 2;
            const tc = c + ds[k][1] * 2;
            if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
            const mv = bd[mr * N + mc];
            if (!mv || ownerOf(mv) === ownerOf(v)) continue;
            if (bd[tr * N + tc]) continue;

            extended = true;
            const b2 = bd.slice();
            b2[r * N + c] = 0;
            b2[mr * N + mc] = 0;
            let nv = v;
            let promoted = false;
            if (!isKing(v) && tr === (v <= 2 ? 0 : 7)) {
                nv = v + 1;
                promoted = true;
            }
            b2[tr * N + tc] = nv;
            const step = { r: tr, c: tc, cr: mr, cc: mc, promo: promoted };
            if (promoted) out.push(prefix.concat([step]));
            else capPaths(b2, tr, tc, prefix.concat([step]), out);
        }
        if (!extended && prefix.length) out.push(prefix);
    }

    function allMoves(bd, side) {
        const caps = [];
        const plain = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const v = bd[r * N + c];
                if (!v || ownerOf(v) !== side) continue;

                const paths = [];
                capPaths(bd, r, c, [], paths);
                for (let i = 0; i < paths.length; i++) {
                    caps.push({ fr: r, fc: c, path: paths[i], cap: true });
                }

                const ds = dirsFor(v);
                for (let k = 0; k < ds.length; k++) {
                    const tr = r + ds[k][0];
                    const tc = c + ds[k][1];
                    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
                    if (bd[tr * N + tc]) continue;
                    plain.push({
                        fr: r, fc: c,
                        path: [{ r: tr, c: tc, cr: -1, cc: -1, promo: false }],
                        cap: false
                    });
                }
            }
        }
        return caps.length ? caps : plain;
    }

    function applyMove(bd, mv) {
        let cr = mv.fr;
        let cc = mv.fc;
        let v = bd[cr * N + cc];
        for (let i = 0; i < mv.path.length; i++) {
            const st = mv.path[i];
            bd[cr * N + cc] = 0;
            if (st.cr >= 0) bd[st.cr * N + st.cc] = 0;
            let nv = v;
            if (!isKing(v) && st.r === (v <= 2 ? 0 : 7)) nv = v + 1;
            bd[st.r * N + st.c] = nv;
            v = nv;
            cr = st.r;
            cc = st.c;
        }
    }

    /* ---------- AI ---------- */

    function evalBoard(bd, side) {
        let s = 0;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const v = bd[r * N + c];
                if (!v) continue;
                const o = ownerOf(v);
                let val = isKing(v) ? 190 : 100;
                if (o === 1) val += (7 - r) * 3;
                else val += r * 3;
                if (!isKing(v)) {
                    if (o === 1 && r === 7) val += 8;
                    if (o === 2 && r === 0) val += 8;
                }
                if (c >= 2 && c <= 5) val += 3;
                if (c === 0 || c === 7) val -= 2;
                s += o === side ? val : -val;
            }
        }
        return s;
    }

    function orderMoves(list) {
        list.sort(function (a, b) {
            return (b.path.length - a.path.length) || ((b.cap ? 1 : 0) - (a.cap ? 1 : 0));
        });
        return list;
    }

    function search(bd, side, depth, alpha, beta, root) {
        if (depth <= 0) return evalBoard(bd, root);
        const moves = orderMoves(allMoves(bd, side));
        if (!moves.length) return side === root ? -99999 : 99999;

        let best = side === root ? -Infinity : Infinity;
        for (let i = 0; i < moves.length; i++) {
            const b2 = bd.slice();
            applyMove(b2, moves[i]);
            const sc = search(b2, 3 - side, depth - 1, alpha, beta, root);
            if (side === root) {
                if (sc > best) best = sc;
                if (best > alpha) alpha = best;
            } else {
                if (sc < best) best = sc;
                if (best < beta) beta = best;
            }
            if (beta <= alpha) break;
        }
        return best;
    }

    function bestMove(bd, side, depth) {
        const moves = allMoves(bd, side);
        if (!moves.length) return null;
        if (depth <= 1 && moves.length > 1 && Math.random() < 0.32) {
            return moves[Math.floor(Math.random() * moves.length)];
        }
        const list = moves.slice();
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = list[i]; list[i] = list[j]; list[j] = t;
        }
        let best = null;
        let bestSc = -Infinity;
        for (let i = 0; i < list.length; i++) {
            const b2 = bd.slice();
            applyMove(b2, list[i]);
            const sc = search(b2, 3 - side, depth - 1, -Infinity, Infinity, side);
            if (sc > bestSc) {
                bestSc = sc;
                best = list[i];
            }
        }
        return best;
    }

    /* ---------- 流程 ---------- */

    function reset() {
        board = newBoard();
        turn = 1;
        selected = null;
        legal = [];
        lastMove = null;
        moveCount = 0;
        history = [];
        thinking = false;
        busy = false;
        hover = null;
        toast = null;
        fx = [];
        winnerSide = 0;
        aiTimer = 0;
        hudCache = '';
        refreshLegal();
    }

    function refreshLegal() {
        legal = allMoves(board, turn);
    }

    function begin() {
        if (aiTimer) {
            window.clearTimeout(aiTimer);
            aiTimer = 0;
        }
        reset();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function myMoves() {
        return legal.filter(function (mv) { return mv.fr === selected.r && mv.fc === selected.c; });
    }

    function humanPick(r, c) {
        const v = board[r * N + c];
        if (v && ownerOf(v) === 1) {
            const own = legal.filter(function (mv) { return mv.fr === r && mv.fc === c; });
            if (!own.length) {
                selected = null;
                say(legal[0] && legal[0].cap ? '有子可吃，必须吃' : '这枚棋子走不动了');
                return;
            }
            selected = { r: r, c: c };
            return;
        }
        if (!selected) return;

        const cands = myMoves();
        let hit = null;
        for (let i = 0; i < cands.length; i++) {
            const st = cands[i].path[0];
            if (st.r === r && st.c === c) { hit = cands[i]; break; }
        }
        if (!hit) {
            selected = null;
            return;
        }
        pushHistory();
        playMove(hit, function () {
            selected = null;
            nextTurn();
        });
    }

    function pushHistory() {
        history.push({
            board: board.slice(),
            moves: moveCount,
            lastMove: lastMove ? { fr: lastMove.fr, fc: lastMove.fc, path: lastMove.path } : null,
            turn: turn
        });
        if (history.length > 60) history.shift();
    }

    function playMove(mv, done) {
        busy = true;
        applyMove(board, mv);
        lastMove = { fr: mv.fr, fc: mv.fc, path: mv.path };
        moveCount++;
        refreshLegal();

        for (let i = 0; i < mv.path.length; i++) {
            const st = mv.path[i];
            if (st.cr >= 0) spark(st.cr, st.cc);
            if (st.promo) say('升王！');
        }
        if (mv.path.length > 1) toast = { text: '连吃 ' + mv.path.length + ' 子', t: 1.1 };

        hudCache = '';
        updateHud();
        busy = false;
        if (done) done();
    }

    function nextTurn() {
        turn = 3 - turn;
        refreshLegal();
        if (!legal.length) {
            endGame(3 - turn);
            return;
        }
        hudCache = '';
        updateHud();
        if (turn === 2) scheduleAI();
    }

    function scheduleAI() {
        thinking = true;
        hudCache = '';
        updateHud();
        aiTimer = window.setTimeout(function () {
            aiTimer = 0;
            if (state !== 'playing' || turn !== 2) return;
            const mv = bestMove(board, 2, DIFFS[diff]);
            thinking = false;
            if (!mv) {
                endGame(1);
                return;
            }
            playMove(mv, function () { nextTurn(); });
        }, 260);
    }

    function endGame(winner) {
        state = 'over';
        thinking = false;
        selected = null;
        winnerSide = winner;
        if (winner === 1) {
            localStorage.setItem(WIN_KEY, String(Number(localStorage.getItem(WIN_KEY) || 0) + 1));
        } else {
            localStorage.setItem(LOSS_KEY, String(Number(localStorage.getItem(LOSS_KEY) || 0) + 1));
        }
        hudCache = '';
        updateHud();
        showOverlay('over', winner);
    }

    function undo() {
        if (state !== 'playing' || busy || thinking || !history.length) return;
        if (aiTimer) {
            window.clearTimeout(aiTimer);
            aiTimer = 0;
        }
        const snap = history.pop();
        board = snap.board;
        moveCount = snap.moves;
        lastMove = snap.lastMove;
        turn = 1;
        selected = null;
        thinking = false;
        refreshLegal();
        hudCache = '';
        updateHud();
    }

    function say(text) {
        toast = { text: text, t: 1.2 };
    }

    /* ---------- 提示与特效 ---------- */

    function spark(r, c) {
        const x = px(c);
        const y = py(r);
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * TAU;
            const s = 40 + Math.random() * 110;
            fx.push({
                x: x, y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 0.45, max: 0.45,
                color: '#ff9b7a'
            });
        }
    }

    /* ---------- 渲染 ---------- */

    function px(c) {
        return BX + c * CELL + CELL / 2;
    }

    function py(r) {
        return BY + r * CELL + CELL / 2;
    }

    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1520');
        g.addColorStop(0.6, '#060d14');
        g.addColorStop(1, '#03070b');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(240, 300, 40, 240, 300, 360);
        halo.addColorStop(0, 'rgba(80, 150, 255, .09)');
        halo.addColorStop(1, 'rgba(80, 150, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 460);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .55)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(120, 190, 255, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('CHECKERS', W / 2, 30);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.fillStyle = '#e8f2ff';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText('跳棋', W / 2, 56);
        ctx.restore();
    }

    function drawBoard() {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 8;
        roundRectPath(ctx, BX - 10, BY - 10, BS + 20, BS + 20, 16);
        const frame = ctx.createLinearGradient(BX, BY, BX + BS, BY + BS);
        frame.addColorStop(0, '#2a2116');
        frame.addColorStop(0.5, '#1a140d');
        frame.addColorStop(1, '#241b11');
        ctx.fillStyle = frame;
        ctx.fill();
        ctx.restore();

        roundRectPath(ctx, BX - 10, BY - 10, BS + 20, BS + 20, 16);
        ctx.strokeStyle = 'rgba(201, 155, 82, .55)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const x = BX + c * CELL;
                const y = BY + r * CELL;
                if (isDark(r, c)) {
                    ctx.fillStyle = r % 2 === 0 ? '#1d3752' : '#1a3049';
                } else {
                    ctx.fillStyle = '#091320';
                }
                ctx.fillRect(x, y, CELL, CELL);
                if (isDark(r, c)) {
                    ctx.strokeStyle = 'rgba(120, 180, 240, .05)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
                }
            }
        }

        // 棋盘内框
        ctx.strokeStyle = 'rgba(120, 180, 240, .12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(BX + 0.5, BY + 0.5, BS - 1, BS - 1);
    }

    function drawHighlights() {
        // 最后一步
        if (lastMove) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 209, 102, .5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(px(lastMove.fc), py(lastMove.fr));
            for (let i = 0; i < lastMove.path.length; i++) {
                ctx.lineTo(px(lastMove.path[i].c), py(lastMove.path[i].r));
            }
            ctx.stroke();
            ctx.setLineDash([]);
            for (let i = 0; i < lastMove.path.length; i++) {
                const st = lastMove.path[i];
                if (st.cr < 0) continue;
                const ex = px(st.cc);
                const ey = py(st.cr);
                ctx.strokeStyle = 'rgba(255, 120, 120, .75)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ex - 7, ey - 7);
                ctx.lineTo(ex + 7, ey + 7);
                ctx.moveTo(ex + 7, ey - 7);
                ctx.lineTo(ex - 7, ey + 7);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (selected) {
            const x = px(selected.c);
            const y = py(selected.r);
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 209, 102, .95)';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(x, y, RAD + 5, 0, TAU);
            ctx.stroke();

            const cands = myMoves();
            for (let i = 0; i < cands.length; i++) {
                const st = cands[i].path[0];
                const tx = px(st.c);
                const ty = py(st.r);
                if (cands[i].cap) {
                    ctx.strokeStyle = 'rgba(255, 140, 120, .9)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(tx, ty, RAD * 0.78, 0, TAU);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(tx - 5, ty);
                    ctx.lineTo(tx + 5, ty);
                    ctx.moveTo(tx, ty - 5);
                    ctx.lineTo(tx, ty + 5);
                    ctx.stroke();
                } else {
                    ctx.fillStyle = 'rgba(141, 255, 196, .55)';
                    ctx.beginPath();
                    ctx.arc(tx, ty, 7, 0, TAU);
                    ctx.fill();
                }
            }
            ctx.restore();
        } else if (hover && state === 'playing') {
            const v = board[hover.r * N + hover.c];
            if (v && ownerOf(v) === 1) {
                ctx.save();
                ctx.strokeStyle = 'rgba(200, 225, 255, .3)';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.arc(px(hover.c), py(hover.r), RAD + 4, 0, TAU);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    function drawCrown(x, y) {
        ctx.save();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(x - 9, y + 4);
        ctx.lineTo(x - 9, y - 4);
        ctx.lineTo(x - 4.5, y + 0.5);
        ctx.lineTo(x, y - 6);
        ctx.lineTo(x + 4.5, y + 0.5);
        ctx.lineTo(x + 9, y - 4);
        ctx.lineTo(x + 9, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawPiece(x, y, v) {
        const player = v <= 2;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y + 4, RAD * 0.94, RAD * 0.54, 0, 0, TAU);
        ctx.fillStyle = 'rgba(0, 0, 0, .42)';
        ctx.fill();
        ctx.restore();

        const g = ctx.createRadialGradient(x - 7, y - 8, 2, x, y, RAD);
        if (player) {
            g.addColorStop(0, '#a8d4ff');
            g.addColorStop(0.55, '#4a86e8');
            g.addColorStop(1, '#1b3a75');
        } else {
            g.addColorStop(0, '#ffdcae');
            g.addColorStop(0.55, '#e8903c');
            g.addColorStop(1, '#7f4210');
        }

        ctx.beginPath();
        ctx.arc(x, y, RAD, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = player ? 'rgba(168, 212, 255, .85)' : 'rgba(255, 220, 168, .85)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, RAD * 0.66, 0, TAU);
        ctx.strokeStyle = 'rgba(255, 255, 255, .2)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(x - 5, y - 9, 7.5, 4, -0.5, 0, TAU);
        ctx.fillStyle = 'rgba(255, 255, 255, .3)';
        ctx.fill();

        if (isKing(v)) drawCrown(x, y + 1);
    }

    function drawPieces() {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const v = board[r * N + c];
                if (!v) continue;
                drawPiece(px(c), py(r), v);
            }
        }
    }

    function drawFx(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= dt;
            if (p.life <= 0) { fx.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 240 * dt;
            const k = p.life / p.max;
            ctx.save();
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * k + 1, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawFooter(dt) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '700 12px ' + FONT;
        const y = BY + BS + 44;

        const forced = legal.length > 0 && legal[0].cap;
        let text;
        let color;
        if (state === 'ready') {
            text = '按开始对局';
            color = 'rgba(150, 175, 200, .6)';
        } else if (state === 'over') {
            text = winnerSide === 1 ? '你赢了 · 再按 R 来一局' : '这局输了 · 再按 R 重来';
            color = winnerSide === 1 ? 'rgba(141, 255, 196, .85)' : 'rgba(255, 150, 150, .85)';
        } else if (thinking) {
            text = '电脑思考中…';
            color = 'rgba(255, 190, 120, .85)';
        } else if (forced) {
            text = '有子可吃 · 必须吃';
            color = 'rgba(255, 180, 120, .9)';
        } else {
            text = '轮到你走';
            color = 'rgba(141, 255, 196, .9)';
        }
        ctx.fillStyle = color;
        ctx.fillText(text, BX + 4, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(140, 170, 200, .45)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText('吃子可连跳 · 到底线升王', BX + BS - 4, y);

        if (toast) {
            toast.t -= dt;
            if (toast.t <= 0) toast = null;
            else {
                const a = Math.min(1, toast.t * 2.4);
                ctx.globalAlpha = a;
                ctx.textAlign = 'center';
                ctx.font = '700 13px ' + FONT;
                const tw = ctx.measureText(toast.text).width;
                roundRectPath(ctx, W / 2 - tw / 2 - 14, BY + BS + 62, tw + 28, 28, 14);
                ctx.fillStyle = 'rgba(24, 18, 10, .92)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 209, 102, .5)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = '#ffd166';
                ctx.fillText(toast.text, W / 2, BY + BS + 76);
                ctx.globalAlpha = 1;
            }
        }
        ctx.restore();
    }

    function render(dt) {
        drawBg();
        drawHeader();
        drawBoard();
        drawHighlights();
        drawPieces();
        drawFx(dt);
        drawFooter(dt);
    }

    /* ---------- HUD ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return winnerSide === 1 ? '你赢了' : '你输了';
        if (thinking) return '电脑思考中…';
        return '轮到你走';
    }

    function updateHud() {
        const wins = Number(localStorage.getItem(WIN_KEY) || 0);
        const losses = Number(localStorage.getItem(LOSS_KEY) || 0);
        const key = statusText() + '|' + countOf(board, 1) + '|' + countOf(board, 2) + '|' +
            moveCount + '|' + wins + '|' + losses + '|' + diff + '|' + history.length;
        if (key === hudCache) return;
        hudCache = key;

        els.status.textContent = statusText();
        els.youCount.textContent = String(countOf(board, 1));
        els.cpuCount.textContent = String(countOf(board, 2));
        els.moves.textContent = String(moveCount);
        els.record.textContent = wins + ' 胜 ' + losses + ' 负';
        els.undoBtn.disabled = state !== 'playing' || busy || thinking || !history.length;
    }

    function showOverlay(kind, winner) {
        if (kind === 'over') {
            const youWin = winner === 1;
            els.ovTitle.textContent = youWin ? '你赢了' : '电脑赢了';
            els.ovTitle.classList.toggle('danger', !youWin);
            els.ovDesc.textContent = youWin
                ? '用了 ' + moveCount + ' 步拿下这一局。升王的棋子可以四向吃子，记得优先保它。'
                : '电脑把你的棋子吃干净了。注意别让后排出现连续可吃的空档。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(moveCount);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    /* ---------- 输入 ---------- */

    function locate(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - BX) / CELL);
        const r = Math.floor((y - BY) / CELL);
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;
        return { r: r, c: c };
    }

    canvas.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        hover = locate(e);
    });

    canvas.addEventListener('pointerleave', function () {
        hover = null;
    });

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'playing' || busy || thinking || turn !== 1) return;
        const p = locate(e);
        if (!p) return;
        humanPick(p.r, p.c);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyZ') {
            e.preventDefault();
            undo();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            begin();
        } else if (e.code === 'Escape') {
            selected = null;
        }
    });

    els.ovBtn.addEventListener('click', begin);
    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);
    els.undoBtn.addEventListener('click', undo);

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        const next = btn.getAttribute('data-diff');
        if (!DIFFS[next] || next === diff) return;
        diff = next;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', all[i].getAttribute('data-diff') === diff);
        }
        hudCache = '';
        updateHud();
    });

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;
        render(dt);
        requestAnimationFrame(frame);
    }

    reset();
    updateHud();
    requestAnimationFrame(frame);
})();
