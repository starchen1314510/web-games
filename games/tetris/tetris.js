/* ==========================================================
   俄罗斯方块
   ========================================================== */
(function () {
    'use strict';

    const COLS = 10;
    const ROWS = 20;
    const CELL = 30;
    const BOARD_W = COLS * CELL;
    const BOARD_H = ROWS * CELL;
    const BEST_KEY = 'webgames.tetris.best';

    const PIECES = {
        I: { color: '#3ad0e0', matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
        J: { color: '#4f8cff', matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
        L: { color: '#ff9f43', matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
        O: { color: '#ffc548', matrix: [[1, 1], [1, 1]] },
        S: { color: '#2fd48b', matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
        T: { color: '#9d5bff', matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
        Z: { color: '#ff5c6c', matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] }
    };

    const SCORE_TABLE = [0, 100, 300, 500, 800];

    /* ---------- 画布初始化 ---------- */
    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function roundRect(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + w, y, x + w, y + h, rr);
        c.arcTo(x + w, y + h, x, y + h, rr);
        c.arcTo(x, y + h, x, y, rr);
        c.arcTo(x, y, x + w, y, rr);
        c.closePath();
    }

    /* ---------- 元素引用 ---------- */
    const boardCanvas = document.getElementById('board');
    const ctx = initCanvas(boardCanvas, BOARD_W, BOARD_H);
    const nextCanvas = document.getElementById('next');
    const nctx = initCanvas(nextCanvas, 120, 120);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        level: document.getElementById('level'),
        lines: document.getElementById('lines'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        touchPad: document.getElementById('touch-pad')
    };

    /* ---------- 状态 ---------- */
    let board = [];
    let current = null;
    let nextType = null;
    let bag = [];
    let score = 0;
    let lines = 0;
    let level = 1;
    let dropInterval = 800;
    let dropTimer = 0;
    let lastTime = 0;
    let state = 'ready';   // ready | playing | paused | over
    let best = Number(localStorage.getItem(BEST_KEY) || 0);

    /* ---------- 工具 ---------- */
    function emptyBoard() {
        return Array.from({ length: ROWS }, function () {
            return new Array(COLS).fill(null);
        });
    }

    function takeFromBag() {
        if (!bag.length) {
            bag = Object.keys(PIECES);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = bag[i];
                bag[i] = bag[j];
                bag[j] = t;
            }
        }
        return bag.pop();
    }

    function speedFor(lv) {
        return Math.max(80, 800 - (lv - 1) * 70);
    }

    function collide(matrix, ox, oy) {
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (!matrix[r][c]) continue;
                const x = ox + c;
                const y = oy + r;
                if (x < 0 || x >= COLS || y >= ROWS) return true;
                if (y >= 0 && board[y][x]) return true;
            }
        }
        return false;
    }

    function rotateMatrix(matrix, dir) {
        const n = matrix.length;
        const out = [];
        for (let r = 0; r < n; r++) out.push(new Array(n).fill(0));
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (dir > 0) out[c][n - 1 - r] = matrix[r][c];
                else out[n - 1 - c][r] = matrix[r][c];
            }
        }
        return out;
    }

    /* ---------- 绘制 ---------- */
    function drawBlock(c, px, py, size, color, ghost) {
        const pad = Math.max(1, size * 0.045);
        const x = px + pad;
        const y = py + pad;
        const s = size - pad * 2;
        const radius = Math.max(3, size * 0.16);

        if (ghost) {
            c.strokeStyle = color;
            c.globalAlpha = 0.42;
            c.lineWidth = 2;
            roundRect(c, x, y, s, s, radius);
            c.stroke();
            c.globalAlpha = 1;
            return;
        }

        c.fillStyle = color;
        roundRect(c, x, y, s, s, radius);
        c.fill();

        c.fillStyle = 'rgba(255, 255, 255, .26)';
        roundRect(c, x + s * 0.13, y + s * 0.11, s * 0.74, s * 0.2, radius * 0.6);
        c.fill();

        c.fillStyle = 'rgba(0, 0, 0, .18)';
        roundRect(c, x + s * 0.11, y + s * 0.73, s * 0.78, s * 0.16, radius * 0.6);
        c.fill();
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, .045)';
        ctx.lineWidth = 1;
        for (let c = 1; c < COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * CELL + .5, 0);
            ctx.lineTo(c * CELL + .5, BOARD_H);
            ctx.stroke();
        }
        for (let r = 1; r < ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * CELL + .5);
            ctx.lineTo(BOARD_W, r * CELL + .5);
            ctx.stroke();
        }
    }

    function ghostY() {
        let y = current.y;
        while (!collide(current.matrix, current.x, y + 1)) y++;
        return y;
    }

    function draw() {
        ctx.clearRect(0, 0, BOARD_W, BOARD_H);
        ctx.fillStyle = '#080c14';
        ctx.fillRect(0, 0, BOARD_W, BOARD_H);
        drawGrid();

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r] && board[r][c]) {
                    drawBlock(ctx, c * CELL, r * CELL, CELL, board[r][c], false);
                }
            }
        }

        if (current && (state === 'playing' || state === 'paused')) {
            const gy = ghostY();
            for (let r = 0; r < current.matrix.length; r++) {
                for (let c = 0; c < current.matrix[r].length; c++) {
                    if (!current.matrix[r][c]) continue;
                    drawBlock(ctx, (current.x + c) * CELL, (gy + r) * CELL, CELL, current.color, true);
                }
            }
            for (let r = 0; r < current.matrix.length; r++) {
                for (let c = 0; c < current.matrix[r].length; c++) {
                    if (!current.matrix[r][c]) continue;
                    const y = current.y + r;
                    if (y < 0) continue;
                    drawBlock(ctx, (current.x + c) * CELL, y * CELL, CELL, current.color, false);
                }
            }
        }
    }

    function drawNext() {
        nctx.clearRect(0, 0, 120, 120);
        if (!nextType) return;

        const matrix = PIECES[nextType].matrix;
        let minR = 99, maxR = -1, minC = 99, maxC = -1;
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (!matrix[r][c]) continue;
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                minC = Math.min(minC, c);
                maxC = Math.max(maxC, c);
            }
        }

        const w = maxC - minC + 1;
        const h = maxR - minR + 1;
        const size = Math.min(24, 92 / Math.max(w, h));
        const ox = (120 - w * size) / 2 - minC * size;
        const oy = (120 - h * size) / 2 - minR * size;

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (!matrix[r][c]) continue;
                drawBlock(nctx, ox + c * size, oy + r * size, size, PIECES[nextType].color, false);
            }
        }
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        els.score.textContent = score;
        els.lines.textContent = lines;
        els.level.textContent = level;
        els.best.textContent = best;
    }

    /* ---------- 流程 ---------- */
    function spawn() {
        const type = nextType;
        nextType = takeFromBag();
        const def = PIECES[type];
        const matrix = def.matrix.map(function (row) { return row.slice(); });

        current = {
            type: type,
            color: def.color,
            matrix: matrix,
            x: Math.floor((COLS - matrix[0].length) / 2),
            y: type === 'I' ? -1 : 0
        };

        dropTimer = 0;
        drawNext();

        if (collide(current.matrix, current.x, current.y)) {
            gameOver();
        }
    }

    function clearLines() {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            const full = board[r].every(function (cell) { return !!cell; });
            if (full) {
                board.splice(r, 1);
                board.unshift(new Array(COLS).fill(null));
                cleared++;
                r++;
            }
        }
        return cleared;
    }

    function lock() {
        for (let r = 0; r < current.matrix.length; r++) {
            for (let c = 0; c < current.matrix[r].length; c++) {
                if (!current.matrix[r][c]) continue;
                const y = current.y + r;
                if (y < 0) continue;
                board[y][current.x + c] = current.color;
            }
        }

        const cleared = clearLines();
        if (cleared > 0) {
            score += SCORE_TABLE[cleared] * level;
            lines += cleared;
            const nextLevel = Math.floor(lines / 10) + 1;
            if (nextLevel > level) {
                level = nextLevel;
                dropInterval = speedFor(level);
            }
        }
        updateHud();
        spawn();
        draw();
    }

    function move(dx) {
        if (state !== 'playing' || !current) return;
        if (!collide(current.matrix, current.x + dx, current.y)) {
            current.x += dx;
            draw();
        }
    }

    function rotate(dir) {
        if (state !== 'playing' || !current) return;
        const rotated = rotateMatrix(current.matrix, dir);
        const kicks = [0, -1, 1, -2, 2];
        for (let i = 0; i < kicks.length; i++) {
            if (!collide(rotated, current.x + kicks[i], current.y)) {
                current.matrix = rotated;
                current.x += kicks[i];
                draw();
                return;
            }
        }
    }

    function softDrop() {
        if (state !== 'playing' || !current) return;
        if (!collide(current.matrix, current.x, current.y + 1)) {
            current.y++;
            score += 1;
            dropTimer = 0;
            updateHud();
            draw();
        } else {
            lock();
        }
    }

    function hardDrop() {
        if (state !== 'playing' || !current) return;
        let dist = 0;
        while (!collide(current.matrix, current.x, current.y + 1)) {
            current.y++;
            dist++;
        }
        score += dist * 2;
        updateHud();
        lock();
    }

    function startGame() {
        board = emptyBoard();
        bag = [];
        nextType = takeFromBag();
        score = 0;
        lines = 0;
        level = 1;
        dropInterval = speedFor(level);
        dropTimer = 0;
        current = null;
        state = 'playing';

        updateHud();
        hideOverlay();
        spawn();
        draw();
    }

    function gameOver() {
        state = 'over';
        current = null;

        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();

        els.ovTitle.textContent = '游戏结束';
        els.ovTitle.className = 'overlay-title danger';
        els.ovDesc.textContent = '方块堆到顶了。本局消除 ' + lines + ' 行，到达等级 ' + level + '。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = score;
        els.ovBtn.textContent = '再来一局';
        showOverlay();
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        els.ovTitle.textContent = '已暂停';
        els.ovTitle.className = 'overlay-title';
        els.ovDesc.textContent = '休息一下，按 P 或点击下方按钮继续游戏。';
        els.ovScore.hidden = true;
        els.ovBtn.textContent = '继续游戏';
        showOverlay();
    }

    function resume() {
        if (state !== 'paused') return;
        state = 'playing';
        dropTimer = 0;
        lastTime = 0;
        hideOverlay();
    }

    function togglePause() {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
    }

    function showOverlay() {
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 主循环 ---------- */
    function loop(t) {
        if (!lastTime) lastTime = t;
        const dt = Math.min(100, t - lastTime);
        lastTime = t;

        if (state === 'playing' && current) {
            dropTimer += dt;
            if (dropTimer >= dropInterval) {
                dropTimer = 0;
                if (!collide(current.matrix, current.x, current.y + 1)) {
                    current.y++;
                } else {
                    lock();
                }
            }
        }

        draw();
        requestAnimationFrame(loop);
    }

    /* ---------- 输入 ---------- */
    const HANDLED = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar'];

    document.addEventListener('keydown', function (e) {
        if (HANDLED.indexOf(e.key) !== -1) e.preventDefault();

        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            togglePause();
            return;
        }

        if (state === 'ready' || state === 'over') {
            if (e.key === 'Enter' || e.key === ' ') startGame();
            return;
        }

        if (state !== 'playing') return;

        switch (e.key) {
            case 'ArrowLeft':
                move(-1);
                break;
            case 'ArrowRight':
                move(1);
                break;
            case 'ArrowDown':
                softDrop();
                break;
            case 'ArrowUp':
            case 'x':
            case 'X':
                if (!e.repeat) rotate(1);
                break;
            case 'z':
            case 'Z':
                if (!e.repeat) rotate(-1);
                break;
            case ' ':
            case 'Spacebar':
                if (!e.repeat) hardDrop();
                break;
            default:
                break;
        }
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') resume();
        else startGame();
    });

    els.pauseBtn.addEventListener('click', togglePause);

    /* 触屏按钮（支持长按连发） */
    document.querySelectorAll('.pad-btn').forEach(function (btn) {
        const act = btn.dataset.act;
        let delayTimer = null;
        let repeatTimer = null;

        function fire() {
            if (act === 'left') move(-1);
            else if (act === 'right') move(1);
            else if (act === 'down') softDrop();
            else if (act === 'rotate') rotate(1);
            else if (act === 'drop') hardDrop();
        }

        function stop() {
            clearTimeout(delayTimer);
            clearInterval(repeatTimer);
            delayTimer = null;
            repeatTimer = null;
        }

        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            fire();
            if (act === 'left' || act === 'right' || act === 'down') {
                delayTimer = setTimeout(function () {
                    repeatTimer = setInterval(fire, 70);
                }, 250);
            }
        });
        btn.addEventListener('pointerup', stop);
        btn.addEventListener('pointercancel', stop);
        btn.addEventListener('pointerleave', stop);
    });

    /* 触屏设备显示虚拟按键 */
    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }

    /* 切走窗口自动暂停 */
    window.addEventListener('blur', function () {
        if (state === 'playing') pause();
    });

    /* ---------- 启动 ---------- */
    board = emptyBoard();
    nextType = takeFromBag();
    updateHud();
    drawNext();
    draw();
    requestAnimationFrame(loop);
})();
