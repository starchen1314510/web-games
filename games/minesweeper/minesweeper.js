/* ==========================================================
   扫雷 Minesweeper
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 480;
    const PAD = 4;

    const LEVELS = {
        easy: { cols: 9, rows: 9, mines: 10, label: '初级', bestKey: 'webgames.minesweeper.best.easy' },
        medium: { cols: 12, rows: 12, mines: 22, label: '中级', bestKey: 'webgames.minesweeper.best.medium' },
        hard: { cols: 16, rows: 16, mines: 40, label: '高级', bestKey: 'webgames.minesweeper.best.hard' }
    };

    const NUM_COLORS = [
        '', '#5b9bff', '#2fd48b', '#ff6b7a',
        '#a874ff', '#ff9f43', '#3ad0e0', '#ff6fbf', '#c9d8ee'
    ];

    const THEME = {
        bg: '#0c131e',
        hidden: '#2b3a52',
        hiddenHi: '#41567a',
        hiddenLo: '#1a2435',
        revealed: '#131b28',
        revealLine: '#1f2b3d',
        flag: '#ff5c6c',
        mine: '#ff4d6d',
        exploded: 'rgba(255, 77, 109, .28)'
    };

    /* ---------- 画布 ---------- */
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

    function fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        if (s < 60) return s + 's';
        const m = Math.floor(s / 60);
        const r = s % 60;
        return m + ':' + String(r).padStart(2, '0');
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        minesLeft: document.getElementById('mines-left'),
        time: document.getElementById('time'),
        best: document.getElementById('best'),
        progress: document.getElementById('progress'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 状态 ---------- */
    let difficulty = 'easy';
    let cols = 9;
    let rows = 9;
    let mineCount = 10;
    let cellSize = 52;
    let offsetX = 0;
    let offsetY = 0;

    let board = [];
    let flags = 0;
    let revealedCount = 0;
    let state = 'ready';          // ready | playing | over | win
    let startTime = 0;
    let elapsed = 0;
    let hover = null;
    let overlayTimer = null;

    /* ---------- 工具 ---------- */
    function eachNeighbor(r, c, fn) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                fn(nr, nc);
            }
        }
    }

    function bestFor(lv) {
        const v = Number(localStorage.getItem(LEVELS[lv].bestKey) || 0);
        return v > 0 ? v : 0;
    }

    /* ---------- 布局与重置 ---------- */
    function layout() {
        const lv = LEVELS[difficulty];
        cols = lv.cols;
        rows = lv.rows;
        mineCount = lv.mines;
        cellSize = Math.floor(Math.min((W - PAD * 2) / cols, (H - PAD * 2) / rows));
        offsetX = Math.floor((W - cellSize * cols) / 2);
        offsetY = Math.floor((H - cellSize * rows) / 2);
    }

    function reset(silent) {
        if (overlayTimer) {
            clearTimeout(overlayTimer);
            overlayTimer = null;
        }
        layout();
        board = [];
        for (let r = 0; r < rows; r++) {
            const line = [];
            for (let c = 0; c < cols; c++) {
                line.push({ mine: false, revealed: false, flagged: false, adj: 0, exploded: false });
            }
            board.push(line);
        }
        flags = 0;
        revealedCount = 0;
        elapsed = 0;
        startTime = 0;
        hover = null;
        state = 'ready';
        updateHud();
        if (!silent) showOverlay('ready');
    }

    function updateHud() {
        els.minesLeft.textContent = String(mineCount - flags);
        els.time.textContent = fmtTime(elapsed);
        const total = cols * rows - mineCount;
        els.progress.textContent = revealedCount + ' / ' + total;
        const b = bestFor(difficulty);
        els.best.textContent = b > 0 ? fmtTime(b * 1000) : '--';
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        const lv = LEVELS[difficulty];
        if (kind === 'ready') {
            els.ovTitle.textContent = '扫雷';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.innerHTML = '左键翻开格子，右键插旗标记地雷。数字代表周围八格的地雷数量，翻开全部安全格即可获胜。当前难度：'
                + lv.label + '，' + lv.mines + ' 颗雷。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始游戏';
            els.ovRestart.hidden = true;
        } else if (kind === 'win') {
            const s = Math.floor(elapsed / 1000);
            const prev = bestFor(difficulty);
            const isRecord = prev === 0 || s < prev;
            if (isRecord) localStorage.setItem(lv.bestKey, String(s));

            els.ovTitle.textContent = isRecord ? '新纪录！' : '扫雷成功';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = lv.label + '难度全部安全格已翻开，用时 ' + fmtTime(elapsed) + '。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = fmtTime(elapsed);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
            updateHud();
        } else if (kind === 'over') {
            els.ovTitle.textContent = '踩到地雷';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '很遗憾，这一格下面埋着雷。调整思路再试一次吧。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = fmtTime(elapsed);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 布雷 ---------- */
    function placeMines(safeR, safeC) {
        const forbidden = {};
        forbidden[safeR + ',' + safeC] = true;
        eachNeighbor(safeR, safeC, function (r, c) {
            forbidden[r + ',' + c] = true;
        });

        const pool = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!forbidden[r + ',' + c]) pool.push([r, c]);
            }
        }

        // 极端情况下（雷数接近格子总数）退化为只避开点击格
        if (pool.length < mineCount) {
            pool.length = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (r !== safeR || c !== safeC) pool.push([r, c]);
                }
            }
        }

        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = pool[i];
            pool[i] = pool[j];
            pool[j] = t;
        }

        for (let i = 0; i < mineCount && i < pool.length; i++) {
            const p = pool[i];
            board[p[0]][p[1]].mine = true;
        }

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].mine) continue;
                let n = 0;
                eachNeighbor(r, c, function (nr, nc) {
                    if (board[nr][nc].mine) n++;
                });
                board[r][c].adj = n;
            }
        }
    }

    /* ---------- 开局 ---------- */
    function start(r, c) {
        placeMines(r, c);
        state = 'playing';
        startTime = performance.now();
        elapsed = 0;
        hideOverlay();
    }

    /* ---------- 翻开 ---------- */
    function openSafe(r, c) {
        const stack = [[r, c]];
        while (stack.length) {
            const cur = stack.pop();
            const cr = cur[0];
            const cc = cur[1];
            const tile = board[cr][cc];
            if (tile.revealed || tile.flagged || tile.mine) continue;

            tile.revealed = true;
            revealedCount++;

            if (tile.adj === 0) {
                eachNeighbor(cr, cc, function (nr, nc) {
                    const n = board[nr][nc];
                    if (!n.revealed && !n.flagged && !n.mine) stack.push([nr, nc]);
                });
            }
        }
    }

    function boom(r, c) {
        board[r][c].exploded = true;
        state = 'over';
        if (!startTime) elapsed = 0;
        hover = null;

        // 展示全部地雷，便于复盘
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (board[i][j].mine) board[i][j].revealed = true;
            }
        }
        updateHud();
        overlayTimer = setTimeout(function () {
            showOverlay('over');
        }, 650);
    }

    function checkWin() {
        if (revealedCount !== cols * rows - mineCount) return false;
        state = 'win';
        if (startTime) elapsed = performance.now() - startTime;
        startTime = 0;
        // 自动补齐剩余旗子
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const t = board[r][c];
                if (t.mine && !t.flagged) {
                    t.flagged = true;
                    flags++;
                }
            }
        }
        updateHud();
        overlayTimer = setTimeout(function () {
            showOverlay('win');
        }, 450);
        return true;
    }

    function reveal(r, c) {
        if (state === 'over' || state === 'win') return;
        const tile = board[r][c];

        if (state === 'ready') {
            start(r, c);
        }

        if (tile.revealed) {
            if (tile.adj > 0) chord(r, c);
            return;
        }
        if (tile.flagged) return;

        if (tile.mine) {
            boom(r, c);
            return;
        }

        openSafe(r, c);
        updateHud();
        checkWin();
    }

    /* ---------- 数字格快速展开 ---------- */
    function chord(r, c) {
        if (state !== 'playing') return;
        let marked = 0;
        const targets = [];
        eachNeighbor(r, c, function (nr, nc) {
            const n = board[nr][nc];
            if (n.flagged) marked++;
            else if (!n.revealed) targets.push([nr, nc]);
        });
        if (marked !== board[r][c].adj || !targets.length) return;

        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (board[t[0]][t[1]].mine) {
                boom(t[0], t[1]);
                return;
            }
        }
        for (let i = 0; i < targets.length; i++) {
            openSafe(targets[i][0], targets[i][1]);
        }
        updateHud();
        checkWin();
    }

    function toggleFlag(r, c) {
        if (state === 'over' || state === 'win' || state === 'ready') return;
        const tile = board[r][c];
        if (tile.revealed) return;
        tile.flagged = !tile.flagged;
        flags += tile.flagged ? 1 : -1;
        updateHud();
    }

    /* ---------- 输入 ---------- */
    function cellAt(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const x = (clientX - rect.left) * (W / rect.width);
        const y = (clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - offsetX) / cellSize);
        const r = Math.floor((y - offsetY) / cellSize);
        if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
        return { r: r, c: c };
    }

    let pressTimer = null;
    let pressCell = null;
    let longPressed = false;

    function clearPress() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        pressCell = null;
        longPressed = false;
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (e.button === 2) return;
        const pos = cellAt(e.clientX, e.clientY);
        if (!pos) return;
        pressCell = pos;
        longPressed = false;
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = setTimeout(function () {
            if (pressCell) {
                toggleFlag(pressCell.r, pressCell.c);
                longPressed = true;
            }
        }, 420);
    });

    canvas.addEventListener('pointerup', function (e) {
        if (e.button === 2) return;
        const pos = cellAt(e.clientX, e.clientY);
        const wasLong = longPressed;
        const startCell = pressCell;
        clearPress();
        if (!pos || !startCell) return;
        if (pos.r !== startCell.r || pos.c !== startCell.c) return;
        if (wasLong) return;
        reveal(pos.r, pos.c);
    });

    canvas.addEventListener('pointercancel', clearPress);
    canvas.addEventListener('pointerleave', function () {
        clearPress();
        hover = null;
    });

    canvas.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        hover = cellAt(e.clientX, e.clientY);
    });

    canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const pos = cellAt(e.clientX, e.clientY);
        if (pos) toggleFlag(pos.r, pos.c);
    });

    /* 移动端：双击式快速展开交给 chord，长按已用于插旗 */

    els.ovBtn.addEventListener('click', function () {
        if (state === 'ready') {
            hideOverlay();
        } else {
            reset(false);
        }
    });

    els.ovRestart.addEventListener('click', function () {
        reset(false);
    });

    els.restartBtn.addEventListener('click', function () {
        reset(false);
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        const next = btn.getAttribute('data-diff');
        if (!LEVELS[next] || next === difficulty) return;
        difficulty = next;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', all[i] === btn);
        }
        reset(false);
    });

    /* ---------- 绘制 ---------- */
    function drawMine(cx, cy, size, color, alpha) {
        const r = size * 0.26;
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.6, size * 0.075);
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
            ctx.lineTo(cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.65)';
        ctx.fill();
        ctx.restore();
    }

    function drawFlag(cx, cy, size, wrong) {
        const s = size * 0.3;
        ctx.save();
        ctx.lineCap = 'round';
        // 旗杆
        ctx.strokeStyle = '#c9d8ee';
        ctx.lineWidth = Math.max(1.6, size * 0.06);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.15, cy + s * 0.95);
        ctx.lineTo(cx - s * 0.15, cy - s * 0.85);
        ctx.stroke();
        // 底座
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.85, cy + s * 0.95);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.95);
        ctx.stroke();
        // 旗面
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.1, cy - s * 0.85);
        ctx.lineTo(cx + s * 1.0, cy - s * 0.4);
        ctx.lineTo(cx - s * 0.1, cy + s * 0.05);
        ctx.closePath();
        ctx.fillStyle = wrong ? '#ff9f43' : THEME.flag;
        ctx.fill();

        if (wrong) {
            ctx.strokeStyle = THEME.flag;
            ctx.lineWidth = Math.max(2, size * 0.07);
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.7, cy - s * 0.7);
            ctx.lineTo(cx + s * 0.7, cy + s * 0.7);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawCell(r, c) {
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;
        const tile = board[r][c];
        const inset = 1;
        const w = cellSize - inset * 2;
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;

        if (tile.revealed) {
            ctx.fillStyle = tile.exploded ? THEME.exploded : THEME.revealed;
            roundRect(ctx, x + inset, y + inset, w, w, Math.max(3, cellSize * 0.1));
            ctx.fill();

            if (tile.mine) {
                drawMine(cx, cy, cellSize, THEME.mine, tile.exploded ? 1 : 0.75);
            } else if (tile.adj > 0) {
                ctx.fillStyle = NUM_COLORS[tile.adj] || '#c9d8ee';
                ctx.font = '700 ' + Math.round(cellSize * 0.56) + 'px ui-monospace, Menlo, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(tile.adj), cx, cy + cellSize * 0.03);
            }
            return;
        }

        // 未翻开：立体凸起
        const isHover = hover && hover.r === r && hover.c === c && state !== 'over' && state !== 'win';
        ctx.fillStyle = tile.flagged ? '#33415c' : (isHover ? THEME.hiddenHi : THEME.hidden);
        roundRect(ctx, x + inset, y + inset, w, w, Math.max(3, cellSize * 0.1));
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = THEME.hiddenHi;
        ctx.beginPath();
        ctx.moveTo(x + inset + 1, y + inset + w - 1);
        ctx.lineTo(x + inset + 1, y + inset + 1);
        ctx.lineTo(x + inset + w - 1, y + inset + 1);
        ctx.stroke();

        ctx.strokeStyle = THEME.hiddenLo;
        ctx.beginPath();
        ctx.moveTo(x + inset + 1, y + inset + w - 1);
        ctx.lineTo(x + inset + w - 1, y + inset + w - 1);
        ctx.lineTo(x + inset + w - 1, y + inset + 1);
        ctx.stroke();

        if (tile.flagged) {
            // 失败复盘时，插在空地上的旗子标为错误
            drawFlag(cx, cy, cellSize, state === 'over' && !tile.mine);
        }
    }

    function render() {
        // 背景
        ctx.fillStyle = THEME.bg;
        ctx.fillRect(0, 0, W, H);

        const pad = Math.max(0, cellSize * 0.02);
        ctx.fillStyle = 'rgba(255,255,255,.02)';
        roundRect(ctx, offsetX - pad - 4, offsetY - pad - 4,
            cellSize * cols + pad * 2 + 8, cellSize * rows + pad * 2 + 8, 10);
        ctx.fill();

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                drawCell(r, c);
            }
        }
    }

    /* ---------- 主循环 ---------- */
    function loop() {
        if (state === 'playing' && startTime) {
            elapsed = performance.now() - startTime;
            els.time.textContent = fmtTime(elapsed);
        }
        render();
        requestAnimationFrame(loop);
    }

    /* ---------- 启动 ---------- */
    reset(false);
    loop();
})();
