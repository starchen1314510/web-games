/* ==========================================================
   黑白棋 Reversi
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 480;
    const TAU = Math.PI * 2;
    const N = 8;
    const M = 16;
    const CELL = (W - M * 2) / N;

    const EMPTY = 0;
    const BLACK = 1;
    const WHITE = 2;

    const WIN_KEY = 'webgames.reversi.wins';
    const PLAY_KEY = 'webgames.reversi.plays';

    const W8 = [
        120, -20, 20, 5, 5, 20, -20, 120,
        -20, -40, -5, -5, -5, -5, -40, -20,
        20, -5, 15, 3, 3, 15, -5, 20,
        5, -5, 3, 3, 3, 3, -5, 5,
        5, -5, 3, 3, 3, 3, -5, 5,
        20, -5, 15, 3, 3, 15, -5, 20,
        -20, -40, -5, -5, -5, -5, -40, -20,
        120, -20, 20, 5, 5, 20, -20, 120
    ];

    const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function clamp(v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        black: document.getElementById('black'),
        white: document.getElementById('white'),
        turn: document.getElementById('turn'),
        wins: document.getElementById('wins'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let board = new Array(N * N).fill(EMPTY);
    let turn = BLACK;
    let state = 'ready';
    let busy = false;
    let busyTimer = 0;
    let aiTimer = 0;
    let anims = [];
    let texts = [];
    let lastMove = -1;
    let hintPulse = 0;
    let clock = 0;
    let diff = 'normal';
    let wins = Number(localStorage.getItem(WIN_KEY) || 0);
    let plays = Number(localStorage.getItem(PLAY_KEY) || 0);
    let hudCache = '';
    let hintMoves = [];

    /* ---------- 规则 ---------- */
    function idx(r, c) {
        return r * N + c;
    }

    function onBoard(r, c) {
        return r >= 0 && r < N && c >= 0 && c < N;
    }

    function flipsOf(b, r, c, player) {
        if (b[idx(r, c)] !== EMPTY) return null;
        const other = 3 - player;
        const out = [];
        for (let d = 0; d < DIRS.length; d++) {
            const dr = DIRS[d][0];
            const dc = DIRS[d][1];
            let rr = r + dr;
            let cc = c + dc;
            const line = [];
            while (onBoard(rr, cc) && b[idx(rr, cc)] === other) {
                line.push(idx(rr, cc));
                rr += dr;
                cc += dc;
            }
            if (line.length && onBoard(rr, cc) && b[idx(rr, cc)] === player) {
                for (let i = 0; i < line.length; i++) out.push(line[i]);
            }
        }
        return out.length ? out : null;
    }

    function legalMoves(b, player) {
        const out = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const f = flipsOf(b, r, c, player);
                if (f) out.push({ r: r, c: c, flips: f });
            }
        }
        return out;
    }

    function applied(b, move, player) {
        const nb = b.slice();
        nb[idx(move.r, move.c)] = player;
        for (let i = 0; i < move.flips.length; i++) nb[move.flips[i]] = player;
        return nb;
    }

    function counts(b) {
        let black = 0;
        let white = 0;
        for (let i = 0; i < b.length; i++) {
            if (b[i] === BLACK) black++;
            else if (b[i] === WHITE) white++;
        }
        return { black: black, white: white, empty: N * N - black - white };
    }

    /* ---------- AI ---------- */
    function evaluate(b, me) {
        let s = 0;
        let mine = 0;
        let theirs = 0;
        for (let i = 0; i < 64; i++) {
            if (b[i] === me) {
                s += W8[i];
                mine++;
            } else if (b[i] !== EMPTY) {
                s -= W8[i];
                theirs++;
            }
        }
        return s + (mine - theirs) * 2;
    }

    function search(b, player, depth, alpha, beta, me) {
        if (depth <= 0) return evaluate(b, me);
        const moves = legalMoves(b, player);
        if (!moves.length) {
            if (!legalMoves(b, 3 - player).length) return evaluate(b, me);
            return search(b, 3 - player, depth - 1, alpha, beta, me);
        }
        let best = player === me ? -Infinity : Infinity;
        for (let i = 0; i < moves.length; i++) {
            const v = search(applied(b, moves[i], player), 3 - player, depth - 1, alpha, beta, me);
            if (player === me) {
                if (v > best) best = v;
                if (best > alpha) alpha = best;
            } else {
                if (v < best) best = v;
                if (best < beta) beta = best;
            }
            if (beta <= alpha) break;
        }
        return best;
    }

    function chooseMove(player) {
        const moves = legalMoves(board, player);
        if (!moves.length) return null;
        if (diff === 'easy') {
            return moves[Math.floor(Math.random() * moves.length)];
        }
        if (diff === 'normal') {
            let best = moves[0];
            let bestV = -Infinity;
            for (let i = 0; i < moves.length; i++) {
                const b = applied(board, moves[i], player);
                let v = evaluate(b, player) + moves[i].flips.length * 3;
                v += (Math.random() - 0.5) * 8;
                if (v > bestV) { bestV = v; best = moves[i]; }
            }
            return best;
        }
        const depth = 4;
        let best = moves[0];
        let bestV = -Infinity;
        for (let i = 0; i < moves.length; i++) {
            const v = search(applied(board, moves[i], player), 3 - player, depth - 1, -Infinity, Infinity, player);
            if (v > bestV) { bestV = v; best = moves[i]; }
        }
        return best;
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const c = counts(board);
        const key = c.black + '|' + c.white + '|' + turn + '|' + wins + '|' + state;
        if (key === hudCache) return;
        hudCache = key;
        els.black.textContent = String(c.black);
        els.white.textContent = String(c.white);
        els.wins.textContent = wins + ' 胜 / ' + plays + ' 局';
        if (state === 'over') els.turn.textContent = '本局结束';
        else if (state === 'ready') els.turn.textContent = '等你开局';
        else els.turn.textContent = turn === BLACK ? '你（黑）' : '电脑（白）';
    }

    function showOverlay(kind, title, desc) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '黑白棋';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '你执黑先行。落子后夹住对方的棋子就把它翻成自己的颜色，' +
                '最后棋子多的一方获胜。棋盘上的光点是可以落子的位置。';
            els.ovBtn.textContent = '开始对局';
        } else {
            els.ovTitle.textContent = title;
            els.ovTitle.classList.toggle('danger', title.indexOf('输') >= 0);
            els.ovDesc.textContent = desc;
            els.ovBtn.textContent = '再来一局';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 流程 ---------- */
    function resetBoard() {
        board = new Array(N * N).fill(EMPTY);
        board[idx(3, 3)] = WHITE;
        board[idx(3, 4)] = BLACK;
        board[idx(4, 3)] = BLACK;
        board[idx(4, 4)] = WHITE;
    }

    function begin() {
        resetBoard();
        turn = BLACK;
        busy = false;
        busyTimer = 0;
        aiTimer = 0;
        anims = [];
        texts = [];
        lastMove = -1;
        hintPulse = 0;
        hudCache = '';
        state = 'playing';
        plays += 1;
        localStorage.setItem(PLAY_KEY, String(plays));
        hideOverlay();
        refreshHints();
        updateHud();
    }

    function finish() {
        state = 'over';
        const c = counts(board);
        let title;
        let desc;
        if (c.black > c.white) {
            title = '你赢了';
            desc = '最终比分 黑 ' + c.black + ' : ' + c.white + ' 白，干得漂亮。';
            wins += 1;
            localStorage.setItem(WIN_KEY, String(wins));
        } else if (c.black < c.white) {
            title = '你输了';
            desc = '最终比分 黑 ' + c.black + ' : ' + c.white + ' 白，再来一局找回场子。';
        } else {
            title = '平局';
            desc = '双方各 ' + c.black + ' 子，旗鼓相当。';
        }
        updateHud();
        showOverlay('over', title, desc);
    }

    function refreshHints() {
        hintMoves = state === 'playing' && turn === BLACK && !busy ? legalMoves(board, BLACK) : [];
    }

    function passTurn() {
        texts.push({ x: W / 2, y: 60, text: (turn === BLACK ? '你无子可落' : '电脑无子可落') + '，跳过一手', life: 1.2, max: 1.2, size: 17 });
        turn = 3 - turn;
        refreshHints();
        updateHud();
        if (!legalMoves(board, turn).length) {
            finish();
            return;
        }
        if (turn === WHITE) aiTimer = 0.5;
    }

    function doMove(move, player) {
        const placed = idx(move.r, move.c);
        board[placed] = player;
        anims.push({ i: placed, from: EMPTY, to: player, t: 0, dur: 0.18 });
        for (let i = 0; i < move.flips.length; i++) {
            anims.push({ i: move.flips[i], from: 3 - player, to: player, t: 0, dur: 0.28 });
        }
        lastMove = placed;
        if (move.flips.length >= 4) {
            texts.push({
                x: M + (move.c + 0.5) * CELL,
                y: M + (move.r + 0.5) * CELL - 26,
                text: '翻转 ×' + move.flips.length,
                life: 1,
                max: 1,
                size: 16
            });
        }
        turn = 3 - player;
        busy = true;
        busyTimer = 0.34;
        hintMoves = [];
        updateHud();
    }

    function afterMove() {
        if (attemptEnd()) return;
        if (!legalMoves(board, turn).length) {
            passTurn();
            return;
        }
        if (turn === WHITE) aiTimer = 0.42;
        refreshHints();
    }

    function attemptEnd() {
        if (legalMoves(board, BLACK).length || legalMoves(board, WHITE).length) return false;
        finish();
        return true;
    }

    /* ---------- 交互 ---------- */
    function cellAt(x, y) {
        const c = Math.floor((x - M) / CELL);
        const r = Math.floor((y - M) / CELL);
        if (!onBoard(r, c)) return null;
        return { r: r, c: c };
    }

    function click(x, y) {
        if (state !== 'playing' || busy || turn !== BLACK || aiTimer > 0) return;
        const cell = cellAt(x, y);
        if (!cell) return;
        const flips = flipsOf(board, cell.r, cell.c, BLACK);
        if (!flips) {
            texts.push({ x: x, y: y - 12, text: '这里不能落子', life: 0.8, max: 0.8, size: 15 });
            return;
        }
        doMove({ r: cell.r, c: cell.c, flips: flips }, BLACK);
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        hintPulse = (hintPulse + dt * 2.2) % TAU;

        for (let i = anims.length - 1; i >= 0; i--) {
            anims[i].t += dt;
            if (anims[i].t >= anims[i].dur) anims.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 26 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }

        if (busy) {
            busyTimer -= dt;
            if (busyTimer <= 0) {
                busy = false;
                afterMove();
            }
            return;
        }

        if (aiTimer > 0) {
            aiTimer -= dt;
            if (aiTimer <= 0) {
                const move = chooseMove(WHITE);
                if (move) doMove(move, WHITE);
                else passTurn();
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function drawBoard() {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#12241f');
        g.addColorStop(0.5, '#0d1a18');
        g.addColorStop(1, '#152a24');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const boardG = ctx.createLinearGradient(M, M, W - M, H - M);
        boardG.addColorStop(0, '#1e5c48');
        boardG.addColorStop(0.55, '#17553f');
        boardG.addColorStop(1, '#123f2f');
        ctx.fillStyle = boardG;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(M - 6, M - 6, W - (M - 6) * 2, H - (M - 6) * 2, 12)
            : ctx.rect(M - 6, M - 6, W - (M - 6) * 2, H - (M - 6) * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(6, 20, 16, .55)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= N; i++) {
            const p = M + i * CELL;
            ctx.beginPath();
            ctx.moveTo(M + 0.5, p + 0.5);
            ctx.lineTo(W - M + 0.5, p + 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p + 0.5, M + 0.5);
            ctx.lineTo(p + 0.5, H - M + 0.5);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(10, 30, 24, .75)';
        const stars = [[2, 2], [2, 6], [6, 2], [6, 6]];
        for (let i = 0; i < stars.length; i++) {
            const x = M + (stars[i][0] + 0.5) * CELL;
            const y = M + (stars[i][1] + 0.5) * CELL;
            ctx.beginPath();
            ctx.arc(x, y, 3.4, 0, TAU);
            ctx.fill();
        }
    }

    function drawDisc(x, y, color, scaleX, scale) {
        const rr = CELL * 0.40 * (scale || 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(Math.max(0.04, scaleX), 1);

        ctx.fillStyle = 'rgba(0, 0, 0, .35)';
        ctx.beginPath();
        ctx.ellipse(1.5, rr * 0.16, rr, rr * 0.98, 0, 0, TAU);
        ctx.fill();

        const g = ctx.createRadialGradient(-rr * 0.34, -rr * 0.4, rr * 0.1, 0, 0, rr);
        if (color === BLACK) {
            g.addColorStop(0, '#5d6a7d');
            g.addColorStop(0.42, '#2a3444');
            g.addColorStop(1, '#0a0f18');
        } else {
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.55, '#e2ebf7');
            g.addColorStop(1, '#9fb0c6');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = color === BLACK ? 'rgba(120, 150, 190, .35)' : 'rgba(255, 255, 255, .7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = color === BLACK ? 'rgba(190, 214, 255, .28)' : 'rgba(255, 255, 255, .95)';
        ctx.beginPath();
        ctx.ellipse(-rr * 0.3, -rr * 0.34, rr * 0.26, rr * 0.15, -0.6, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function animOf(i) {
        for (let k = 0; k < anims.length; k++) {
            if (anims[k].i === i) return anims[k];
        }
        return null;
    }

    function drawPieces() {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const i = idx(r, c);
                const x = M + (c + 0.5) * CELL;
                const y = M + (r + 0.5) * CELL;
                const a = animOf(i);
                if (a) {
                    const k = clamp(a.t / a.dur, 0, 1);
                    if (a.from === EMPTY) {
                        drawDisc(x, y, a.to, Math.min(1, k * 1.5), 0.6 + k * 0.4);
                    } else {
                        const sx = Math.abs(Math.cos(k * Math.PI));
                        drawDisc(x, y, k < 0.5 ? a.from : a.to, sx, 1);
                    }
                    continue;
                }
                if (board[i] !== EMPTY) drawDisc(x, y, board[i], 1, 1);
            }
        }

        if (lastMove >= 0 && !busy) {
            const r = Math.floor(lastMove / N);
            const c = lastMove % N;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 210, 120, .85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(M + (c + 0.5) * CELL, M + (r + 0.5) * CELL, CELL * 0.46, 0, TAU);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawHints() {
        if (!hintMoves.length) return;
        const a = 0.28 + Math.sin(hintPulse) * 0.16;
        for (let i = 0; i < hintMoves.length; i++) {
            const m = hintMoves[i];
            const x = M + (m.c + 0.5) * CELL;
            const y = M + (m.r + 0.5) * CELL;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = '#9fd8ff';
            ctx.beginPath();
            ctx.arc(x, y, CELL * 0.13, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = 'rgba(210, 240, 255, .95)';
            ctx.font = '700 ' + t.size + 'px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function render() {
        drawBoard();
        drawHints();
        drawPieces();
        drawTexts();
    }

    /* ---------- 循环 ---------- */
    let last = performance.now();

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (state === 'playing') update(dt);
        else {
            clock += dt;
            for (let i = texts.length - 1; i >= 0; i--) {
                texts[i].life -= dt;
                if (texts[i].life <= 0) texts.splice(i, 1);
            }
        }
        render();
        window.requestAnimationFrame(loop);
    }

    /* ---------- 交互 ---------- */
    function pos(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const p = pos(e);
        click(p.x, p.y);
    });

    window.addEventListener('keydown', function (e) {
        if (e.key === 'r' || e.key === 'R') {
            begin();
            e.preventDefault();
        }
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        els.diffGroup.querySelectorAll('[data-diff]').forEach(function (b) {
            b.classList.toggle('active', b === btn);
        });
        if (state === 'playing') begin();
    });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    resetBoard();
    updateHud();
    showOverlay('ready');
    window.requestAnimationFrame(loop);
})();
