/* ==========================================================
   推箱子 Sokoban
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 520;
    const TAU = Math.PI * 2;
    const BEST_PREFIX = 'webgames.sokoban.best.';

    /* # 墙  空格 地板  . 目标  $ 箱子  * 箱子在目标  @ 玩家  + 玩家在目标 */
    const LEVELS = [
        [
            '#########',
            '#       #',
            '# @$  . #',
            '#       #',
            '#       #',
            '#########'
        ],
        [
            '##########',
            '#        #',
            '#  .  .  #',
            '#  $  $  #',
            '#   @    #',
            '#        #',
            '##########'
        ],
        [
            '##########',
            '#        #',
            '#  . . . #',
            '#        #',
            '#  $ $ $ #',
            '#   @    #',
            '#        #',
            '##########'
        ],
        [
            '###########',
            '#         #',
            '#         #',
            '#  . . . .#',
            '#         #',
            '#  $ $ $ $#',
            '#    @    #',
            '###########'
        ],
        [
            '###########',
            '#         #',
            '#  .   .  #',
            '#   ###   #',
            '#  $   $  #',
            '#    @    #',
            '#   $ .   #',
            '###########'
        ],
        [
            '############',
            '#          #',
            '#  ######  #',
            '#  .    .  #',
            '#   $  $   #',
            '#  .    .  #',
            '#   $  $   #',
            '#     @    #',
            '############'
        ]
    ];

    const canvas = document.getElementById('stage');
    const ctx = (function () {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        const c = canvas.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    })();

    const els = {
        level: document.getElementById('level'),
        steps: document.getElementById('steps'),
        pushes: document.getElementById('pushes'),
        boxes: document.getElementById('boxes'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        levelGroup: document.getElementById('level-group'),
        undoBtn: document.getElementById('undo-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let levelIndex = 0;
    let rows = 0;
    let cols = 0;
    let grid = [];
    let goals = [];
    let boxes = [];
    let player = { r: 0, c: 0, vx: 0, vy: 0, face: 1 };
    let steps = 0;
    let pushes = 0;
    let history = [];
    let state = 'ready';           // ready | playing | win
    let cell = 56;
    let ox = 0;
    let oy = 0;
    let flash = 0;
    let hudCache = '';
    let ovAction = 'start';

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0c1522');
    bgGrad.addColorStop(1, '#070b12');

    function roundRect(x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    }

    /* ---------- 关卡装载 ---------- */
    function parseLevel(lines) {
        rows = lines.length;
        cols = 0;
        for (let r = 0; r < rows; r++) {
            if (lines[r].length > cols) cols = lines[r].length;
        }

        grid = [];
        goals = [];
        boxes = [];

        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                const ch = lines[r].charAt(c) || ' ';
                row.push(ch === '#' ? 1 : 0);
                if (ch === '.' || ch === '*' || ch === '+') goals.push({ r: r, c: c });
                if (ch === '$' || ch === '*') boxes.push({ r: r, c: c, vx: 0, vy: 0 });
                if (ch === '@' || ch === '+') {
                    player = { r: r, c: c, vx: 0, vy: 0, face: 1 };
                }
            }
            grid.push(row);
        }
    }

    function layout() {
        const padX = 28;
        const padY = 30;
        cell = Math.min((W - padX * 2) / cols, (H - padY * 2) / rows, 64);
        ox = (W - cols * cell) / 2;
        oy = (H - rows * cell) / 2;
    }

    function snapVisual() {
        player.vx = ox + player.c * cell + cell / 2;
        player.vy = oy + player.r * cell + cell / 2;
        for (let i = 0; i < boxes.length; i++) {
            boxes[i].vx = ox + boxes[i].c * cell + cell / 2;
            boxes[i].vy = oy + boxes[i].r * cell + cell / 2;
        }
    }

    function loadLevel(i) {
        levelIndex = i;
        parseLevel(LEVELS[i]);
        layout();
        snapVisual();
        steps = 0;
        pushes = 0;
        history = [];
        flash = 0;
        hudCache = '';
        updateHud();
        syncLevelButtons();
    }

    /* ---------- 状态 ---------- */
    function boxAt(r, c) {
        for (let i = 0; i < boxes.length; i++) {
            if (boxes[i].r === r && boxes[i].c === c) return boxes[i];
        }
        return null;
    }

    function isGoal(r, c) {
        for (let i = 0; i < goals.length; i++) {
            if (goals[i].r === r && goals[i].c === c) return true;
        }
        return false;
    }

    function doneCount() {
        let n = 0;
        for (let i = 0; i < boxes.length; i++) {
            if (isGoal(boxes[i].r, boxes[i].c)) n++;
        }
        return n;
    }

    function bestOf(i) {
        return Number(localStorage.getItem(BEST_PREFIX + i) || 0);
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const done = doneCount();
        const best = bestOf(levelIndex);
        const key = levelIndex + '|' + steps + '|' + pushes + '|' + done + '|' + best + '|' + state;
        if (key === hudCache) return;
        hudCache = key;

        els.level.textContent = (levelIndex + 1) + ' / ' + LEVELS.length;
        els.steps.textContent = String(steps);
        els.pushes.textContent = String(pushes);
        els.boxes.textContent = done + ' / ' + boxes.length;
        els.best.textContent = best ? String(best) : '--';
        els.undoBtn.disabled = state !== 'playing' || history.length === 0;
    }

    function syncLevelButtons() {
        const all = els.levelGroup.querySelectorAll('[data-level]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', Number(all[i].getAttribute('data-level')) === levelIndex);
        }
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            ovAction = 'start';
            els.ovTitle.textContent = '第 ' + (levelIndex + 1) + ' 关';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '把 ' + boxes.length + ' 个木箱全部推到圆点上。箱子只能推不能拉，推到墙角就再也动不了。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始挑战';
            els.ovRestart.hidden = true;
        } else if (kind === 'win') {
            const last = levelIndex >= LEVELS.length - 1;
            ovAction = last ? 'restart' : 'next';
            els.ovTitle.textContent = last ? '全部通关' : '第 ' + (levelIndex + 1) + ' 关通过';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '共 ' + steps + ' 步、推动 ' + pushes + ' 次完成本关。' +
                (last ? '六关全部搞定，试试用更少的步数重来一次？' : '下一关的箱子会更多，注意留好回旋空间。');
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(steps);
            els.ovBtn.textContent = last ? '再玩一次' : '下一关';
            els.ovRestart.hidden = false;
            els.ovRestart.textContent = '重玩本关';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 流程 ---------- */
    function begin() {
        hideOverlay();
        state = 'playing';
        updateHud();
    }

    function nextLevel() {
        if (levelIndex >= LEVELS.length - 1) {
            loadLevel(0);
        } else {
            loadLevel(levelIndex + 1);
        }
        state = 'ready';
        showOverlay('ready');
    }

    function restart() {
        loadLevel(levelIndex);
        begin();
    }

    function checkWin() {
        if (doneCount() !== boxes.length) return;

        state = 'win';
        const best = bestOf(levelIndex);
        if (!best || steps < best) {
            localStorage.setItem(BEST_PREFIX + levelIndex, String(steps));
        }
        flash = 0.8;
        updateHud();
        window.setTimeout(function () { showOverlay('win'); }, 260);
    }

    /* ---------- 移动 ---------- */
    function undo() {
        if (state !== 'playing' || !history.length) return;
        const h = history.pop();
        player.r = h.player.r;
        player.c = h.player.c;
        if (h.box) {
            const b = boxes[h.box.idx];
            b.r = h.box.r;
            b.c = h.box.c;
        }
        steps = h.steps;
        pushes = h.pushes;
        updateHud();
    }

    function move(dr, dc) {
        if (state !== 'playing') return;

        const nr = player.r + dr;
        const nc = player.c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
        if (grid[nr][nc] === 1) return;

        const box = boxAt(nr, nc);
        if (box) {
            const br = nr + dr;
            const bc = nc + dc;
            if (br < 0 || br >= rows || bc < 0 || bc >= cols) return;
            if (grid[br][bc] === 1 || boxAt(br, bc)) return;

            history.push({
                player: { r: player.r, c: player.c },
                box: { idx: boxes.indexOf(box), r: box.r, c: box.c },
                steps: steps,
                pushes: pushes
            });
            box.r = br;
            box.c = bc;
            pushes += 1;
        } else {
            history.push({
                player: { r: player.r, c: player.c },
                box: null,
                steps: steps,
                pushes: pushes
            });
        }

        player.r = nr;
        player.c = nc;
        if (dc > 0) player.face = 1;
        else if (dc < 0) player.face = -1;

        steps += 1;
        updateHud();
        checkWin();
    }

    /* ---------- 绘制 ---------- */
    function drawFloor() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] === 1) continue;
                const x = ox + c * cell;
                const y = oy + r * cell;

                ctx.fillStyle = 'rgba(255, 255, 255, .028)';
                roundRect(x + 1, y + 1, cell - 2, cell - 2, 6);
                ctx.fill();

                ctx.strokeStyle = 'rgba(120, 160, 220, .07)';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (isGoal(r, c)) {
                    const cx = x + cell / 2;
                    const cy = y + cell / 2;
                    const onBox = !!boxAt(r, c);
                    ctx.strokeStyle = onBox ? 'rgba(47, 212, 139, .85)' : 'rgba(255, 197, 72, .68)';
                    ctx.lineWidth = 2.4;
                    ctx.beginPath();
                    ctx.arc(cx, cy, cell * 0.18, 0, TAU);
                    ctx.stroke();

                    ctx.fillStyle = onBox ? 'rgba(47, 212, 139, .2)' : 'rgba(255, 197, 72, .16)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, cell * 0.1, 0, TAU);
                    ctx.fill();
                }
            }
        }
    }

    function drawWalls() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] !== 1) continue;

                const x = ox + c * cell;
                const y = oy + r * cell;

                const g = ctx.createLinearGradient(x, y, x, y + cell);
                g.addColorStop(0, '#31445f');
                g.addColorStop(1, '#1c2839');
                ctx.fillStyle = g;
                roundRect(x + 1, y + 1, cell - 2, cell - 2, 5);
                ctx.fill();

                ctx.strokeStyle = 'rgba(140, 180, 235, .14)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 4, y + cell * 0.52);
                ctx.lineTo(x + cell - 4, y + cell * 0.52);
                ctx.moveTo(x + cell * 0.5, y + 4);
                ctx.lineTo(x + cell * 0.5, y + cell * 0.52);
                ctx.stroke();
            }
        }
    }

    function drawBox(b, idx) {
        const s = cell * 0.74;
        const x = b.vx - s / 2;
        const y = b.vy - s / 2;
        const onGoal = isGoal(b.r, b.c);

        ctx.fillStyle = 'rgba(0, 0, 0, .34)';
        roundRect(x + 2, y + 5, s, s, 8);
        ctx.fill();

        const g = ctx.createLinearGradient(x, y, x, y + s);
        if (onGoal) {
            g.addColorStop(0, '#49e2a4');
            g.addColorStop(1, '#1d9a6b');
        } else {
            g.addColorStop(0, '#c98f57');
            g.addColorStop(1, '#855a31');
        }
        ctx.fillStyle = g;
        roundRect(x, y, s, s, 8);
        ctx.fill();

        ctx.strokeStyle = onGoal ? 'rgba(255, 255, 255, .5)' : 'rgba(255, 236, 200, .34)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.strokeStyle = onGoal ? 'rgba(9, 40, 28, .45)' : 'rgba(60, 34, 12, .48)';
        ctx.lineWidth = 2;
        const m = s * 0.26;
        ctx.beginPath();
        ctx.moveTo(x + m, y + m);
        ctx.lineTo(x + s - m, y + s - m);
        ctx.moveTo(x + s - m, y + m);
        ctx.lineTo(x + m, y + s - m);
        ctx.stroke();

        const pulse = onGoal ? 0.5 + Math.sin(performance.now() / 260 + idx) * 0.2 : 0;
        if (pulse > 0) {
            ctx.strokeStyle = 'rgba(47, 212, 139, ' + pulse.toFixed(2) + ')';
            ctx.lineWidth = 1.6;
            roundRect(x - 3, y - 3, s + 6, s + 6, 10);
            ctx.stroke();
        }
    }

    function drawPlayer() {
        const px = player.vx;
        const py = player.vy;
        const s = cell * 0.62;

        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        ctx.beginPath();
        ctx.ellipse(px, py + s * 0.42, s * 0.4, s * 0.14, 0, 0, TAU);
        ctx.fill();

        const g = ctx.createLinearGradient(px, py - s / 2, px, py + s / 2);
        g.addColorStop(0, '#79b0ff');
        g.addColorStop(1, '#3d6fe0');
        ctx.fillStyle = g;
        roundRect(px - s * 0.3, py - s * 0.1, s * 0.6, s * 0.52, s * 0.2);
        ctx.fill();

        ctx.fillStyle = '#dbe9ff';
        ctx.beginPath();
        ctx.arc(px, py - s * 0.3, s * 0.27, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#1a2b45';
        const ex = player.face * s * 0.08;
        ctx.beginPath();
        ctx.arc(px - s * 0.1 + ex, py - s * 0.32, s * 0.05, 0, TAU);
        ctx.arc(px + s * 0.1 + ex, py - s * 0.32, s * 0.05, 0, TAU);
        ctx.fill();
    }

    function drawHints() {
        ctx.font = '600 13px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(160, 180, 210, .55)';
        ctx.fillText('第 ' + (levelIndex + 1) + ' / ' + LEVELS.length + ' 关', 20, 16);
        ctx.textAlign = 'right';
        ctx.fillText(steps + ' 步 · 推动 ' + pushes + ' 次', W - 20, 16);
    }

    function render() {
        const px = ox + player.c * cell + cell / 2;
        const py = oy + player.r * cell + cell / 2;
        player.vx += (px - player.vx) * 0.34;
        player.vy += (py - player.vy) * 0.34;

        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            const bx = ox + b.c * cell + cell / 2;
            const by = oy + b.r * cell + cell / 2;
            b.vx += (bx - b.vx) * 0.34;
            b.vy += (by - b.vy) * 0.34;
        }

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        drawFloor();
        drawWalls();
        for (let i = 0; i < boxes.length; i++) drawBox(boxes[i], i);
        drawPlayer();
        drawHints();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(47, 212, 139, ' + (flash * 0.16).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
            flash = Math.max(0, flash - 0.02);
        }
    }

    function frame() {
        render();
        requestAnimationFrame(frame);
    }

    /* ---------- 输入 ---------- */
    const MOVES = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
        W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1]
    };

    window.addEventListener('keydown', function (e) {
        if (MOVES[e.key]) {
            const m = MOVES[e.key];
            move(m[0], m[1]);
            e.preventDefault();
            return;
        }
        if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') {
            undo();
            e.preventDefault();
            return;
        }
        if (e.key === 'r' || e.key === 'R') {
            restart();
            e.preventDefault();
        }
    });

    let dragFrom = null;

    canvas.addEventListener('pointerdown', function (e) {
        dragFrom = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', function (e) {
        if (!dragFrom) return;
        const dx = e.clientX - dragFrom.x;
        const dy = e.clientY - dragFrom.y;
        dragFrom = null;
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            move(0, dx > 0 ? 1 : -1);
        } else {
            move(dy > 0 ? 1 : -1, 0);
        }
    });

    canvas.addEventListener('pointercancel', function () {
        dragFrom = null;
    });

    /* ---------- 事件绑定 ---------- */
    els.ovBtn.addEventListener('click', function () {
        if (ovAction === 'next') {
            nextLevel();
        } else if (ovAction === 'restart') {
            restart();
        } else {
            begin();
        }
    });

    els.ovRestart.addEventListener('click', restart);
    els.restartBtn.addEventListener('click', restart);
    els.undoBtn.addEventListener('click', undo);

    els.levelGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-level]');
        if (!btn) return;
        const i = Number(btn.getAttribute('data-level'));
        if (i === levelIndex) return;
        loadLevel(i);
        state = 'ready';
        showOverlay('ready');
    });

    /* ---------- 启动 ---------- */
    loadLevel(0);
    showOverlay('ready');
    frame();
})();
