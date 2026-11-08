/* ==========================================================
   五子棋 Gomoku
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 480;
    const N = 15;
    const TAU = Math.PI * 2;
    const PAD = 28;
    const CELL = (W - PAD * 2) / (N - 1);
    const RAD = CELL * 0.42;

    const WIN_KEY = 'webgames.gomoku.wins';
    const LOSS_KEY = 'webgames.gomoku.losses';
    const BEST_KEY = 'webgames.gomoku.best';

    const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const DIFFS = { easy: '轻松', normal: '普通', hard: '困难' };

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        you: document.getElementById('you'),
        cpu: document.getElementById('cpu'),
        moves: document.getElementById('moves'),
        record: document.getElementById('record'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        diffGroup: document.getElementById('diff-group'),
        undoBtn: document.getElementById('undo-btn'),
        swapBtn: document.getElementById('swap-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let board = [];
    let moves = [];
    let lastMove = null;
    let winLine = null;
    let state = 'ready';           // ready | playing | over
    let thinking = false;
    let humanFirst = true;
    let diff = 'normal';
    let hover = null;
    let hudCache = '';
    let aiTimer = 0;

    const boardBg = ctx.createLinearGradient(0, 0, W, H);
    boardBg.addColorStop(0, '#33261a');
    boardBg.addColorStop(0.5, '#271d14');
    boardBg.addColorStop(1, '#1a130d');

    /* ---------- 基础 ---------- */
    function inb(r, c) {
        return r >= 0 && r < N && c >= 0 && c < N;
    }

    function pxOf(c) {
        return PAD + c * CELL;
    }

    function resetBoard() {
        board = [];
        for (let r = 0; r < N; r++) {
            const row = [];
            for (let c = 0; c < N; c++) row.push(0);
            board.push(row);
        }
        moves = [];
        lastMove = null;
        winLine = null;
        hover = null;
        thinking = false;
        hudCache = '';
        window.clearTimeout(aiTimer);
    }

    function record() {
        return {
            wins: Number(localStorage.getItem(WIN_KEY) || 0),
            losses: Number(localStorage.getItem(LOSS_KEY) || 0)
        };
    }

    function updateHud() {
        const rec = record();
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        const st = statusText();
        const key = st + '|' + moves.length + '|' + rec.wins + '|' + rec.losses + '|' + best +
            '|' + humanFirst + '|' + thinking;
        if (key === hudCache) return;
        hudCache = key;

        els.status.textContent = st;
        els.you.textContent = humanFirst ? '黑棋 · 先行' : '白棋 · 后行';
        els.cpu.textContent = humanFirst ? '白棋' : '黑棋 · 先行';
        els.moves.textContent = String(moves.length);
        els.record.textContent = rec.wins + ' 胜 ' + rec.losses + ' 负';
        els.best.textContent = best ? best + ' 步' : '--';
        els.undoBtn.disabled = state !== 'playing' || thinking || moves.length === 0;
        els.swapBtn.textContent = humanFirst ? '让电脑先手' : '让我先手';
    }

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') {
            if (winLine && winLine.who === 1) return '你赢了';
            if (winLine && winLine.who === 2) return '电脑赢了';
            return '和棋';
        }
        if (thinking) return '电脑思考中…';
        return '轮到你落子';
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '五子棋';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '在交叉点上落子，先连成五子的一方获胜。' +
                (humanFirst ? '你执黑先行，电脑会立刻应手。' : '这一局电脑执黑先行，你要接住它的开局。');
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始对局';
            els.ovRestart.hidden = true;
        } else if (kind === 'over') {
            const youWin = winLine && winLine.who === 1;
            const draw = !winLine;
            els.ovTitle.textContent = draw ? '和棋' : (youWin ? '你赢了' : '电脑赢了');
            els.ovTitle.classList.toggle('danger', !youWin && !draw);
            els.ovDesc.textContent = draw
                ? '棋盘填满也没有五连，握手言和。'
                : (youWin
                    ? '用 ' + moves.length + ' 手连成五子，尝试更高难度？'
                    : '电脑连成五子。注意别让它同时形成两个活三。');
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(moves.length);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 对局 ---------- */
    function begin() {
        resetBoard();
        state = 'playing';
        hideOverlay();
        updateHud();

        if (!humanFirst) {
            thinking = true;
            updateHud();
            aiTimer = window.setTimeout(aiMove, 320);
        }
    }

    function newGame() {
        resetBoard();
        state = 'ready';
        updateHud();
        showOverlay('ready');
    }

    function winAt(r, c, who) {
        for (let d = 0; d < DIRS.length; d++) {
            const dr = DIRS[d][0];
            const dc = DIRS[d][1];
            const line = [{ r: r, c: c }];

            for (let s = 1; s <= 4; s++) {
                const rr = r + dr * s;
                const cc = c + dc * s;
                if (!inb(rr, cc) || board[rr][cc] !== who) break;
                line.push({ r: rr, c: cc });
            }
            for (let s = 1; s <= 4; s++) {
                const rr = r - dr * s;
                const cc = c - dc * s;
                if (!inb(rr, cc) || board[rr][cc] !== who) break;
                line.unshift({ r: rr, c: cc });
            }

            if (line.length >= 5) {
                winLine = { who: who, line: line.slice(0, 5) };
                return true;
            }
        }
        return false;
    }

    function place(r, c, who) {
        board[r][c] = who;
        moves.push({ r: r, c: c, who: who });
        lastMove = { r: r, c: c };

        if (winAt(r, c, who)) {
            finish(who);
            return;
        }
        if (moves.length >= N * N) {
            finish(0);
            return;
        }
        updateHud();
    }

    function finish(who) {
        state = 'over';
        thinking = false;

        const rec = record();
        if (who === 1) {
            localStorage.setItem(WIN_KEY, String(rec.wins + 1));
            const best = Number(localStorage.getItem(BEST_KEY) || 0);
            if (!best || moves.length < best) {
                localStorage.setItem(BEST_KEY, String(moves.length));
            }
        } else if (who === 2) {
            localStorage.setItem(LOSS_KEY, String(rec.losses + 1));
        }

        updateHud();
        window.setTimeout(function () { showOverlay('over'); }, 420);
    }

    /* ---------- AI ---------- */
    function shapeAt(r, c, dr, dc, who) {
        let count = 1;
        let opens = 0;

        for (let s = 1; s <= 4; s++) {
            const rr = r + dr * s;
            const cc = c + dc * s;
            if (!inb(rr, cc)) break;
            if (board[rr][cc] === who) { count++; continue; }
            if (board[rr][cc] === 0) opens++;
            break;
        }
        for (let s = 1; s <= 4; s++) {
            const rr = r - dr * s;
            const cc = c - dc * s;
            if (!inb(rr, cc)) break;
            if (board[rr][cc] === who) { count++; continue; }
            if (board[rr][cc] === 0) opens++;
            break;
        }
        return { count: count, opens: opens };
    }

    function shapeScore(count, opens) {
        if (count >= 5) return 300000;
        if (opens === 0) return 0;
        if (count === 4) return opens === 2 ? 40000 : 3200;
        if (count === 3) return opens === 2 ? 2600 : 300;
        if (count === 2) return opens === 2 ? 200 : 28;
        return opens === 2 ? 18 : 5;
    }

    function evaluate(r, c, who) {
        let total = 0;
        for (let d = 0; d < DIRS.length; d++) {
            const s = shapeAt(r, c, DIRS[d][0], DIRS[d][1], who);
            total += shapeScore(s.count, s.opens);
        }
        return total;
    }

    function candidates() {
        const list = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (board[r][c] !== 0) continue;

                let near = false;
                for (let dr = -2; dr <= 2 && !near; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        if (!dr && !dc) continue;
                        const rr = r + dr;
                        const cc = c + dc;
                        if (inb(rr, cc) && board[rr][cc] !== 0) { near = true; break; }
                    }
                }
                if (near) list.push({ r: r, c: c });
            }
        }
        return list;
    }

    function aiMove() {
        if (state !== 'playing') return;

        const ai = humanFirst ? 2 : 1;
        const human = humanFirst ? 1 : 2;
        const list = candidates();

        let pick = null;

        if (!moves.length) {
            pick = { r: 7, c: 7 };
        } else if (list.length) {
            if (diff === 'easy' && Math.random() < 0.3) {
                pick = list[Math.floor(Math.random() * list.length)];
            } else {
                const atkW = diff === 'hard' ? 1.2 : 1.08;
                const defW = diff === 'hard' ? 1.16 : 1;
                let bestScore = -1;

                for (let i = 0; i < list.length; i++) {
                    const p = list[i];
                    const atk = evaluate(p.r, p.c, ai);
                    const def = evaluate(p.r, p.c, human);
                    const s = atk * atkW + def * defW + Math.random() * 0.8;
                    if (s > bestScore) {
                        bestScore = s;
                        pick = p;
                    }
                }
            }
        }

        if (!pick) {
            for (let r = 0; r < N && !pick; r++) {
                for (let c = 0; c < N; c++) {
                    if (board[r][c] === 0) { pick = { r: r, c: c }; break; }
                }
            }
        }
        if (!pick) return;

        thinking = false;
        place(pick.r, pick.c, ai);
        if (state === 'playing') updateHud();
    }

    function humanPlay(r, c) {
        if (state !== 'playing' || thinking) return;
        if (!inb(r, c) || board[r][c] !== 0) return;
        if (winLine) return;

        place(r, c, humanFirst ? 1 : 2);
        if (state !== 'playing') return;

        thinking = true;
        updateHud();
        aiTimer = window.setTimeout(aiMove, 260);
    }

    /* ---------- 悔棋 ---------- */
    function undo() {
        if (state !== 'playing' || thinking || !moves.length) return;

        let removed = 0;
        while (moves.length && removed < 2) {
            const m = moves.pop();
            board[m.r][m.c] = 0;
            removed++;
            if (m.who === (humanFirst ? 1 : 2)) break;
        }

        lastMove = moves.length ? { r: moves[moves.length - 1].r, c: moves[moves.length - 1].c } : null;
        winLine = null;
        updateHud();
    }

    /* ---------- 绘制 ---------- */
    function drawBoard() {
        ctx.fillStyle = boardBg;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(224, 200, 158, .32)';
        ctx.lineWidth = 1;
        for (let i = 0; i < N; i++) {
            const p = pxOf(i);
            ctx.beginPath();
            ctx.moveTo(pxOf(0), p);
            ctx.lineTo(pxOf(N - 1), p);
            ctx.moveTo(p, pxOf(0));
            ctx.lineTo(p, pxOf(N - 1));
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(228, 204, 162, .58)';
        ctx.lineWidth = 2;
        ctx.strokeRect(pxOf(0) - 1, pxOf(0) - 1, CELL * (N - 1) + 2, CELL * (N - 1) + 2);

        const stars = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
        ctx.fillStyle = 'rgba(228, 204, 162, .66)';
        for (let i = 0; i < stars.length; i++) {
            ctx.beginPath();
            ctx.arc(pxOf(stars[i][1]), pxOf(stars[i][0]), 3, 0, TAU);
            ctx.fill();
        }
    }

    function drawStone(r, c, who, alpha) {
        const x = pxOf(c);
        const y = pxOf(r);

        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.fillStyle = 'rgba(0, 0, 0, .38)';
        ctx.beginPath();
        ctx.arc(x + 1.4, y + 2.6, RAD, 0, TAU);
        ctx.fill();

        const g = ctx.createRadialGradient(x - RAD * 0.36, y - RAD * 0.42, RAD * 0.12, x, y, RAD);
        if (who === 1) {
            g.addColorStop(0, '#5a677c');
            g.addColorStop(0.55, '#28313e');
            g.addColorStop(1, '#0b0f15');
        } else {
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.6, '#e7eff8');
            g.addColorStop(1, '#b0c2d6');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, RAD, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = who === 1 ? 'rgba(150, 175, 210, .25)' : 'rgba(110, 130, 160, .38)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    function drawHover() {
        if (state !== 'playing' || thinking || !hover) return;
        if (board[hover.r][hover.c] !== 0) return;
        drawStone(hover.r, hover.c, humanFirst ? 1 : 2, 0.32);
    }

    function drawMarks() {
        if (lastMove && board[lastMove.r][lastMove.c] !== 0) {
            const x = pxOf(lastMove.c);
            const y = pxOf(lastMove.r);
            ctx.fillStyle = board[lastMove.r][lastMove.c] === 1 ? 'rgba(90, 210, 255, .95)' : 'rgba(255, 92, 108, .95)';
            ctx.beginPath();
            ctx.arc(x, y, 3.2, 0, TAU);
            ctx.fill();
        }

        if (winLine) {
            const a = winLine.line[0];
            const b = winLine.line[winLine.line.length - 1];
            ctx.strokeStyle = winLine.who === 1 ? 'rgba(90, 210, 255, .92)' : 'rgba(255, 92, 108, .92)';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(pxOf(a.c), pxOf(a.r));
            ctx.lineTo(pxOf(b.c), pxOf(b.r));
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    function drawHint() {
        if (state !== 'ready') return;
        ctx.fillStyle = 'rgba(214, 190, 150, .5)';
        ctx.font = '700 15px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('点击「开始对局」落子', W / 2, pxOf(N - 1) + 20);
    }

    function render() {
        drawBoard();
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (board[r][c] !== 0) drawStone(r, c, board[r][c], 1);
            }
        }
        drawHover();
        drawMarks();
        drawHint();
    }

    function frame() {
        render();
        requestAnimationFrame(frame);
    }

    /* ---------- 输入 ---------- */
    function locate(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.round((x - PAD) / CELL);
        const r = Math.round((y - PAD) / CELL);
        if (!inb(r, c)) return null;
        if (Math.abs(pxOf(c) - x) > CELL * 0.52) return null;
        if (Math.abs(pxOf(r) - y) > CELL * 0.52) return null;
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
        const p = locate(e);
        if (!p) return;
        if (state === 'over') return;
        humanPlay(p.r, p.c);
    });

    window.addEventListener('keydown', function (e) {
        if (e.key === 'z' || e.key === 'Z') {
            undo();
            e.preventDefault();
        } else if (e.key === 'r' || e.key === 'R') {
            newGame();
            e.preventDefault();
        }
    });

    /* ---------- 事件绑定 ---------- */
    els.ovBtn.addEventListener('click', begin);
    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', function () {
        begin();
    });
    els.undoBtn.addEventListener('click', undo);

    els.swapBtn.addEventListener('click', function () {
        humanFirst = !humanFirst;
        begin();
    });

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
        updateHud();
    });

    /* ---------- 启动 ---------- */
    resetBoard();
    updateHud();
    showOverlay('ready');
    frame();
})();
