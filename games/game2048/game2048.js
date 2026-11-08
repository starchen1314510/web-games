/* ==========================================================
   2048
   ========================================================== */
(function () {
    'use strict';

    const SIZE = 4;
    const PAD = 12;
    const GAP = 12;
    const CELL = 110;
    const W = PAD * 2 + CELL * SIZE + GAP * (SIZE - 1);
    const H = W;
    const ANIM_MS = 120;
    const BEST_KEY = 'webgames.2048.best';

    const VECTORS = {
        up: { r: -1, c: 0 },
        down: { r: 1, c: 0 },
        left: { r: 0, c: -1 },
        right: { r: 0, c: 1 }
    };

    const TILE_COLORS = {
        2: ['#3a4a64', '#eaf1fb'],
        4: ['#4b5f83', '#eaf1fb'],
        8: ['#f2a65a', '#20160a'],
        16: ['#f28c4a', '#20160a'],
        32: ['#ff6f5e', '#ffffff'],
        64: ['#ff4d6d', '#ffffff'],
        128: ['#e8c14a', '#241a04'],
        256: ['#ffc548', '#241a04'],
        512: ['#ffb01f', '#241a04'],
        1024: ['#9d5bff', '#ffffff'],
        2048: ['#4f8cff', '#ffffff']
    };

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

    function easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        maxTile: document.getElementById('max-tile'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn'),
        touchPad: document.getElementById('touch-pad')
    };

    /* ---------- 状态 ---------- */
    let grid = [];
    let deadTiles = [];
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let state = 'ready';       // ready | playing | win | over
    let animating = false;
    let animStart = 0;
    let needSpawn = false;
    let hasWon = false;

    /* ---------- 基础操作 ---------- */
    function createGrid() {
        grid = [];
        for (let r = 0; r < SIZE; r++) {
            grid.push([null, null, null, null]);
        }
        deadTiles = [];
    }

    function addRandomTile() {
        const empty = [];
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (!grid[r][c]) empty.push({ r: r, c: c });
            }
        }
        if (!empty.length) return;

        const cell = empty[Math.floor(Math.random() * empty.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const tile = {
            value: value,
            r: cell.r,
            c: cell.c,
            from: { r: cell.r, c: cell.c },
            to: { r: cell.r, c: cell.c },
            isNew: true,
            appearStart: performance.now(),
            pulseStart: null,
            mergedThisTurn: false,
            dead: false
        };
        grid[cell.r][cell.c] = tile;
    }

    function maxTileValue() {
        let m = 0;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c]) m = Math.max(m, grid[r][c].value);
            }
        }
        return m;
    }

    function canMove() {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const t = grid[r][c];
                if (!t) return true;
                if (c < SIZE - 1 && grid[r][c + 1] && grid[r][c + 1].value === t.value) return true;
                if (r < SIZE - 1 && grid[r + 1][c] && grid[r + 1][c].value === t.value) return true;
            }
        }
        return false;
    }

    function updateHud() {
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        els.score.textContent = score;
        els.best.textContent = best;
        const m = maxTileValue();
        els.maxTile.textContent = m || 0;
    }

    /* ---------- 移动 ---------- */
    function move(dir) {
        if (state !== 'playing' || animating) return;

        const vec = VECTORS[dir];
        const rows = [0, 1, 2, 3];
        const cols = [0, 1, 2, 3];
        if (vec.r > 0) rows.reverse();
        if (vec.c > 0) cols.reverse();

        const now = performance.now();
        let moved = false;

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const t = grid[r][c];
                if (!t) continue;
                t.from = { r: r, c: c };
                t.to = { r: r, c: c };
                t.mergedThisTurn = false;
                t.pulseStart = null;
                t.isNew = false;
                t.dead = false;
            }
        }

        rows.forEach(function (r) {
            cols.forEach(function (c) {
                const tile = grid[r][c];
                if (!tile) return;

                let nr = r;
                let nc = c;
                for (;;) {
                    const tr = nr + vec.r;
                    const tc = nc + vec.c;
                    if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;
                    if (grid[tr][tc]) break;
                    nr = tr;
                    nc = tc;
                }

                const tr = nr + vec.r;
                const tc = nc + vec.c;
                const target = (tr >= 0 && tr < SIZE && tc >= 0 && tc < SIZE) ? grid[tr][tc] : null;

                if (target && target.value === tile.value && !target.mergedThisTurn) {
                    grid[r][c] = null;
                    target.value *= 2;
                    target.mergedThisTurn = true;
                    target.pulseStart = now + ANIM_MS;
                    target.isNew = false;

                    tile.dead = true;
                    tile.to = { r: tr, c: tc };
                    deadTiles.push(tile);

                    score += target.value;
                    moved = true;
                } else if (nr !== r || nc !== c) {
                    grid[r][c] = null;
                    grid[nr][nc] = tile;
                    tile.r = nr;
                    tile.c = nc;
                    tile.from = { r: r, c: c };
                    tile.to = { r: nr, c: nc };
                    moved = true;
                }
            });
        });

        if (!moved) return;

        animStart = now;
        animating = true;
        needSpawn = true;
        updateHud();
    }

    function afterMove() {
        if (!hasWon && maxTileValue() >= 2048) {
            hasWon = true;
            state = 'win';
            els.ovTitle.textContent = '达成 2048';
            els.ovTitle.className = 'overlay-title';
            els.ovDesc.textContent = '你拼出了 2048 方块。还可以继续挑战更大的数字。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = score;
            els.ovBtn.textContent = '继续挑战';
            els.ovRestart.hidden = false;
            showOverlay();
            return;
        }

        if (!canMove()) {
            state = 'over';
            updateHud();
            els.ovTitle.textContent = '无法移动了';
            els.ovTitle.className = 'overlay-title danger';
            els.ovDesc.textContent = '棋盘已经填满，没有可以合并的方块。最终最大方块是 ' + maxTileValue() + '。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = score;
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
            showOverlay();
        }
    }

    /* ---------- 渲染 ---------- */
    function cellPos(index) {
        return PAD + index * (CELL + GAP);
    }

    function colorFor(value) {
        return TILE_COLORS[value] || ['#2fd48b', '#04241a'];
    }

    function fontFor(value) {
        const digits = String(value).length;
        if (digits <= 2) return 40;
        if (digits === 3) return 34;
        if (digits === 4) return 27;
        return 22;
    }

    function drawTile(tile, progress, now) {
        const t = tile.to;
        const f = tile.from;
        const row = f.r + (t.r - f.r) * progress;
        const col = f.c + (t.c - f.c) * progress;

        const x = cellPos(col);
        const y = cellPos(row);

        let scale = 1;
        if (tile.isNew) {
            const p = Math.min(1, Math.max(0, (now - tile.appearStart) / 160));
            scale = Math.max(0.05, easeOutBack(p));
        }
        if (tile.pulseStart !== null && tile.pulseStart !== undefined) {
            const p = (now - tile.pulseStart) / 220;
            if (p > 0 && p < 1) scale *= 1 + 0.13 * Math.sin(p * Math.PI);
        }

        const size = CELL * scale;
        const ox = x + (CELL - size) / 2;
        const oy = y + (CELL - size) / 2;
        const colors = colorFor(tile.value);

        ctx.globalAlpha = tile.dead ? Math.max(0, 1 - progress) : 1;

        ctx.fillStyle = colors[0];
        roundRect(ctx, ox, oy, size, size, 8);
        ctx.fill();

        ctx.fillStyle = colors[1];
        ctx.font = '700 ' + Math.round(fontFor(tile.value) * scale) + 'px ' +
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(tile.value), ox + size / 2, oy + size / 2 + 1);

        ctx.globalAlpha = 1;
    }

    function render(now) {
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#0e1622';
        roundRect(ctx, 0, 0, W, H, 14);
        ctx.fill();

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                ctx.fillStyle = '#1a2434';
                roundRect(ctx, cellPos(c), cellPos(r), CELL, CELL, 8);
                ctx.fill();
            }
        }

        let progress = 1;
        if (animating) {
            progress = Math.min(1, (now - animStart) / ANIM_MS);
            progress = easeOutCubic(progress);
        }

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c]) drawTile(grid[r][c], progress, now);
            }
        }
        for (let i = 0; i < deadTiles.length; i++) {
            drawTile(deadTiles[i], progress, now);
        }
    }

    /* ---------- 主循环 ---------- */
    function loop() {
        const now = performance.now();

        if (animating && now - animStart >= ANIM_MS) {
            animating = false;
            deadTiles = [];
            if (needSpawn) {
                needSpawn = false;
                addRandomTile();
                updateHud();
            }
            if (state === 'playing') afterMove();
        }

        render(now);
        requestAnimationFrame(loop);
    }

    /* ---------- 流程 ---------- */
    function startGame() {
        createGrid();
        score = 0;
        hasWon = false;
        animating = false;
        needSpawn = false;
        addRandomTile();
        addRandomTile();
        state = 'playing';
        updateHud();
        hideOverlay();
    }

    function handleDirection(dir) {
        if (state === 'ready') {
            startGame();
        } else if (state === 'win') {
            state = 'playing';
            hideOverlay();
        }
        if (state === 'playing') {
            move(dir);
        }
    }

    function showOverlay() { els.overlay.classList.add('show'); }
    function hideOverlay() { els.overlay.classList.remove('show'); }

    /* ---------- 输入 ---------- */
    const KEY_DIR = {
        arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right'
    };

    document.addEventListener('keydown', function (e) {
        const dir = KEY_DIR[e.key.toLowerCase()];
        if (dir) {
            e.preventDefault();
            handleDirection(dir);
            return;
        }
        if ((e.key === 'Enter' || e.key === 'r' || e.key === 'R')) {
            if (state === 'over' || state === 'win' || state === 'ready') startGame();
        }
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'win') {
            state = 'playing';
            hideOverlay();
        } else {
            startGame();
        }
    });

    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    document.querySelectorAll('[data-dir]').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            handleDirection(btn.dataset.dir);
        });
    });

    /* 触屏滑动 */
    let touchStart = null;

    canvas.addEventListener('touchstart', function (e) {
        const t = e.changedTouches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    canvas.addEventListener('touchend', function (e) {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        touchStart = null;

        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            handleDirection(dx > 0 ? 'right' : 'left');
        } else {
            handleDirection(dy > 0 ? 'down' : 'up');
        }
    }, { passive: true });

    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }

    /* ---------- 启动 ---------- */
    createGrid();
    updateHud();
    render(performance.now());
    requestAnimationFrame(loop);
})();
