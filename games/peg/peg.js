/* ==========================================================
   孔明棋 Peg Solitaire
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const N = 7;
    const CELL = 52;
    const BW = N * CELL;
    const BH = N * CELL;
    const BX = (W - BW) / 2;
    const BY = 126;
    const PEG_R = 17.5;
    const HOLE_R = 11;

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function roundRectPath(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.lineTo(x + w - rr, y);
        c.arcTo(x + w, y, x + w, y + rr, rr);
        c.lineTo(x + w, y + h - rr);
        c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
        c.lineTo(x + rr, y + h);
        c.arcTo(x, y + h, x, y + h - rr, rr);
        c.lineTo(x, y + rr);
        c.arcTo(x, y, x + rr, y, rr);
        c.closePath();
    }

    function inBoard(c, r) {
        if (c < 0 || c >= N || r < 0 || r >= N) return false;
        if ((c < 2 && r < 2) || (c > 4 && r < 2) ||
            (c < 2 && r > 4) || (c > 4 && r > 4)) return false;
        return true;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        left: document.getElementById('left'),
        steps: document.getElementById('steps'),
        best: document.getElementById('best'),
        rank: document.getElementById('rank'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let board = [];
    let selected = null;
    let steps = 0;
    let best = -1;
    let state = 'ready';       // ready | play | over
    let hudCache = '';
    let parts = [];
    let flyers = [];
    let shakeT = 0;
    let banner = '';
    let bannerT = 0;
    let bannerCol = '#dff4ff';
    let t = 0;

    function resetBoard() {
        board = [];
        for (let r = 0; r < N; r++) {
            const row = [];
            for (let c = 0; c < N; c++) {
                row.push(inBoard(c, r) ? 1 : 0);
            }
            board.push(row);
        }
        board[3][3] = 0;
    }

    function pegCount() {
        let n = 0;
        if (!board.length) return n;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (inBoard(c, r) && board[r][c]) n++;
            }
        }
        return n;
    }

    function anyMoves() {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (!inBoard(c, r) || !board[r][c]) continue;
                const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
                for (let i = 0; i < 4; i++) {
                    const nc = c + dirs[i][0];
                    const nr = r + dirs[i][1];
                    const mc = c + dirs[i][0] / 2;
                    const mr = r + dirs[i][1] / 2;
                    if (inBoard(nc, nr) && !board[nr][nc] && board[mr][mc]) return true;
                }
            }
        }
        return false;
    }

    function rankText(left) {
        if (left === 1) return '独步天下';
        if (left <= 3) return '高手';
        if (left <= 5) return '尚可';
        if (left <= 10) return '入门';
        return '再接再厉';
    }

    function scoreFor(left) {
        if (left === 1) return 5000;
        if (left === 2) return 2500;
        if (left === 3) return 1500;
        if (left === 4) return 800;
        if (left === 5) return 400;
        if (left <= 10) return 200;
        return 100;
    }

    function startGame() {
        resetBoard();
        selected = null;
        steps = 0;
        state = 'play';
        parts = [];
        flyers = [];
        shakeT = 0;
        banner = '';
        bannerT = 0;
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        hudCache = '';
        updateHud();
        if (!anyMoves()) gameOver();
    }

    function gameOver() {
        state = 'over';
        const left = pegCount();
        const score = scoreFor(left);
        if (best < 0 || score > best) {
            best = score;
            localStorage.setItem('webgames.peg.best', String(best));
        }
        els.ovTitle.textContent = '棋局结束';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '剩余 ' + left + ' 枚棋子，评级「' + rankText(left) +
            '」。最佳得分 ' + Math.max(0, best) + ' 分。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 交互 ---------- */

    function posOf(c, r) {
        return { x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2 };
    }

    function hitCell(x, y) {
        const c = Math.floor((x - BX) / CELL);
        const r = Math.floor((y - BY) / CELL);
        if (!inBoard(c, r)) return null;
        const p = posOf(c, r);
        const d = Math.hypot(x - p.x, y - p.y);
        return d <= CELL / 2 ? { c, r } : null;
    }

    function tryMove(from, to) {
        const dc = to.c - from.c;
        const dr = to.r - from.r;
        if (Math.abs(dc) + Math.abs(dr) !== 2 || dc * dr !== 0) return false;
        const mc = from.c + dc / 2;
        const mr = from.r + dr / 2;
        if (!board[from.r][from.c] || board[to.r][to.c] || !board[mr][mc]) return false;
        board[to.r][to.c] = 1;
        board[from.r][from.c] = 0;
        board[mr][mc] = 0;
        steps++;
        const mid = posOf(mc, mr);
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 120;
            parts.push({
                x: mid.x, y: mid.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.4 + Math.random() * 0.3, max: 0.7,
                col: i % 2 === 0 ? '#7dffc8' : '#ffd166'
            });
        }
        flyers.push({
            x: mid.x, y: mid.y - 10, txt: '吃', life: 0.8, max: 0.8, col: '#7dffc8'
        });
        selected = null;
        shakeT = 0.12;
        if (!anyMoves()) {
            banner = '无子可跳';
            bannerCol = '#ffa3ad';
            bannerT = 1.2;
            gameOver();
        } else {
            hudCache = '';
            updateHud();
        }
        return true;
    }

    function onClick(e) {
        if (e) e.preventDefault();
        if (state !== 'play') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const cell = hitCell(x, y);
        if (!cell) return;
        if (selected) {
            if (selected.c === cell.c && selected.r === cell.r) {
                selected = null;
                updateHud();
                return;
            }
            if (tryMove(selected, cell)) return;
        }
        if (board[cell.r][cell.c]) {
            selected = cell;
            updateHud();
        }
    }

    canvas.addEventListener('pointerdown', onClick);

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') startGame();
    });

    els.ovBtn.addEventListener('click', startGame);
    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '棋局结束';
        if (selected) return '已选子，点空格跳吃';
        return '点一枚棋子';
    }

    function updateHud() {
        const left = pegCount();
        const key = state + '|' + left + '|' + steps + '|' + best + '|' + (selected ? selected.c + ',' + selected.r : '-');
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.left.textContent = String(left);
        els.steps.textContent = String(steps);
        els.best.textContent = best >= 0 ? String(best) : '--';
        els.rank.textContent = state === 'ready' ? '--' : rankText(left);
        els.restartBtn.textContent = state === 'ready' ? '开始挑战' : '重新开始';
    }

    /* ---------- 绘制 ---------- */

    function drawBoard() {
        /* 外框 */
        ctx.fillStyle = '#5a3d2b';
        roundRectPath(ctx, BX - 12, BY - 12, BW + 24, BH + 24, 14);
        ctx.fill();
        ctx.strokeStyle = '#3e2a1d';
        ctx.lineWidth = 2;
        ctx.stroke();

        /* 木纹棋盘 */
        const g = ctx.createLinearGradient(BX, BY, BX + BW, BY + BH);
        g.addColorStop(0, '#d4a574');
        g.addColorStop(0.5, '#c18e5a');
        g.addColorStop(1, '#a8764a');
        ctx.fillStyle = g;
        roundRectPath(ctx, BX, BY, BW, BH, 8);
        ctx.fill();

        /* 同心圆木纹 */
        ctx.strokeStyle = 'rgba(90, 55, 30, .12)';
        ctx.lineWidth = 1.5;
        const cx = BX + BW / 2, cy = BY + BH / 2;
        for (let i = 1; i <= 6; i++) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, i * 38, i * 38 * (BH / BW), 0, 0, TAU);
            ctx.stroke();
        }

        /* 网格 */
        ctx.strokeStyle = 'rgba(80, 45, 25, .35)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i <= N; i++) {
            ctx.beginPath();
            ctx.moveTo(BX + i * CELL, BY);
            ctx.lineTo(BX + i * CELL, BY + BH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(BX, BY + i * CELL);
            ctx.lineTo(BX + BW, BY + i * CELL);
            ctx.stroke();
        }

        /* 孔洞 */
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (!inBoard(c, r)) continue;
                const p = posOf(c, r);
                ctx.beginPath();
                ctx.arc(p.x, p.y, HOLE_R, 0, TAU);
                ctx.fillStyle = 'rgba(40, 20, 10, .45)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(80, 45, 25, .4)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
        }
    }

    function drawPegs() {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (!inBoard(c, r) || !board[r][c]) continue;
                const p = posOf(c, r);
                const sel = selected && selected.c === c && selected.r === r;

                if (sel) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, PEG_R + 6, 0, TAU);
                    ctx.strokeStyle = 'rgba(125, 255, 200, .5)';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }

                const g = ctx.createRadialGradient(p.x - 5, p.y - 5, 2, p.x, p.y, PEG_R);
                g.addColorStop(0, '#d4f7e6');
                g.addColorStop(0.35, '#7dffc8');
                g.addColorStop(1, '#2aa876');
                ctx.beginPath();
                ctx.arc(p.x, p.y, PEG_R, 0, TAU);
                ctx.fillStyle = g;
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 255, 255, .25)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(p.x - 3, p.y - 3, PEG_R - 6, 0, TAU);
                ctx.stroke();
            }
        }
    }

    function drawHints() {
        if (!selected) return;
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
        ctx.fillStyle = 'rgba(125, 255, 200, .55)';
        for (let i = 0; i < 4; i++) {
            const nc = selected.c + dirs[i][0];
            const nr = selected.r + dirs[i][1];
            const mc = selected.c + dirs[i][0] / 2;
            const mr = selected.r + dirs[i][1] / 2;
            if (inBoard(nc, nr) && !board[nr][nc] && board[mr][mc]) {
                const p = posOf(nc, nr);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5.5, 0, TAU);
                ctx.fill();
            }
        }
    }

    function drawParts() {
        for (let i = parts.length - 1; i >= 0; i--) {
            const q = parts[i];
            q.life -= 0.016;
            if (q.life <= 0) {
                parts.splice(i, 1);
                continue;
            }
            q.x += q.vx * 0.016;
            q.y += q.vy * 0.016;
            q.vy += 120 * 0.016;
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = q.col;
            ctx.beginPath();
            ctx.arc(q.x, q.y, 2.2 * a + 0.8, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFlyers() {
        for (let i = flyers.length - 1; i >= 0; i--) {
            const q = flyers[i];
            q.life -= 0.016;
            if (q.life <= 0) {
                flyers.splice(i, 1);
                continue;
            }
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 15px ' + FONT;
            ctx.fillStyle = q.col;
            ctx.fillText(q.txt, q.x, q.y - (1 - a) * 18);
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'left';
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eaf6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('孔明棋', 24, 32);
        ctx.fillStyle = 'rgba(150, 200, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('隔子跳吃 · 剩子越少越厉害', 24, 54);

        const bw = 96;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(125, 255, 200, .12)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 255, 200, .35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7dffc8';
        ctx.font = '700 12px ' + MONO;
        ctx.fillText('PEG', bx + bw / 2, 38);
        ctx.textAlign = 'left';
    }

    function drawBanner() {
        if (bannerT <= 0) return;
        const a = clamp(bannerT, 0, 1);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 24px ' + FONT;
        ctx.fillStyle = bannerCol;
        ctx.fillText(banner, W / 2, 96);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(150, 195, 215, .68)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('点击棋子，再点空格跳吃', 24, 578);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(125, 255, 200, .7)';
        ctx.fillText('剩子 ' + pegCount() + ' · 步数 ' + steps, W - 24, 578);
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (shakeT > 0) {
            const k = shakeT / 0.12;
            ctx.translate((Math.random() - 0.5) * 6 * k, (Math.random() - 0.5) * 6 * k);
        }
        drawBoard();
        drawPegs();
        drawHints();
        drawParts();
        drawFlyers();
        ctx.restore();
        drawHeader();
        drawBanner();
        drawFooter();
    }

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        t += dt;
        if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

        render();
        requestAnimationFrame(frame);
    }

    try { best = Number(localStorage.getItem('webgames.peg.best') || -1); } catch (e) { best = -1; }
    updateHud();
    requestAnimationFrame(frame);
})();
