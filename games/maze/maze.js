/* ==========================================================
   迷宫逃亡 Maze
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 480;
    const PAD = 14;
    const TAU = Math.PI * 2;

    const SIZES = [11, 15, 19];
    const CLEARED_KEY = 'webgames.maze.cleared';

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
        time: document.getElementById('time'),
        steps: document.getElementById('steps'),
        size: document.getElementById('size'),
        bestSteps: document.getElementById('best-steps'),
        bestTime: document.getElementById('best-time'),
        cleared: document.getElementById('cleared'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        hintBtn: document.getElementById('hint-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let n = 15;
    let CS = (W - PAD * 2) / n;
    let walls = [];
    let player = { r: 0, c: 0 };
    let view = { x: 0, y: 0 };
    let trail = new Set();
    let steps = 0;
    let elapsed = 0;
    let state = 'ready';          // ready | playing | over
    let hintPath = [];
    let hintUntil = 0;
    let hudCache = '';
    let flash = 0;

    /* ---------- 生成 ---------- */
    function makeWalls() {
        walls = [];
        for (let r = 0; r < n; r++) {
            const row = [];
            for (let c = 0; c < n; c++) {
                row.push({ n: true, e: true, s: true, w: true, v: false });
            }
            walls.push(row);
        }
    }

    function carve(a, b) {
        if (b.r < a.r) { walls[a.r][a.c].n = false; walls[b.r][b.c].s = false; }
        else if (b.r > a.r) { walls[a.r][a.c].s = false; walls[b.r][b.c].n = false; }
        else if (b.c < a.c) { walls[a.r][a.c].w = false; walls[b.r][b.c].e = false; }
        else if (b.c > a.c) { walls[a.r][a.c].e = false; walls[b.r][b.c].w = false; }
    }

    function neighbors(r, c) {
        const list = [];
        if (r > 0 && !walls[r - 1][c].v) list.push({ r: r - 1, c: c });
        if (r < n - 1 && !walls[r + 1][c].v) list.push({ r: r + 1, c: c });
        if (c > 0 && !walls[r][c - 1].v) list.push({ r: r, c: c - 1 });
        if (c < n - 1 && !walls[r][c + 1].v) list.push({ r: r, c: c + 1 });
        return list;
    }

    function generate() {
        makeWalls();
        const stack = [{ r: 0, c: 0 }];
        walls[0][0].v = true;

        while (stack.length) {
            const cur = stack[stack.length - 1];
            const next = neighbors(cur.r, cur.c);
            if (!next.length) {
                stack.pop();
                continue;
            }
            const pick = next[Math.floor(Math.random() * next.length)];
            carve(cur, pick);
            walls[pick.r][pick.c].v = true;
            stack.push(pick);
        }
    }

    /* ---------- 寻路 ---------- */
    function openNeighbors(r, c) {
        const w = walls[r][c];
        const list = [];
        if (!w.n && r > 0) list.push({ r: r - 1, c: c });
        if (!w.s && r < n - 1) list.push({ r: r + 1, c: c });
        if (!w.w && c > 0) list.push({ r: r, c: c - 1 });
        if (!w.e && c < n - 1) list.push({ r: r, c: c + 1 });
        return list;
    }

    function solve() {
        const start = player.r * n + player.c;
        const goal = (n - 1) * n + (n - 1);
        const prev = new Map();
        const queue = [start];
        prev.set(start, -1);

        for (let head = 0; head < queue.length; head++) {
            const cur = queue[head];
            if (cur === goal) break;
            const r = Math.floor(cur / n);
            const c = cur % n;
            const nb = openNeighbors(r, c);
            for (let i = 0; i < nb.length; i++) {
                const k = nb[i].r * n + nb[i].c;
                if (prev.has(k)) continue;
                prev.set(k, cur);
                queue.push(k);
            }
        }

        if (!prev.has(goal)) return [];
        const path = [];
        let cur = goal;
        while (cur !== -1) {
            path.push(cur);
            cur = prev.get(cur);
        }
        return path.reverse();
    }

    /* ---------- 记录 ---------- */
    function bestKey(kind) {
        return 'webgames.maze.' + kind + '.' + n;
    }

    function readBest(kind) {
        const v = localStorage.getItem(bestKey(kind));
        return v === null ? null : Number(v);
    }

    function saveBest() {
        const bs = readBest('steps');
        if (bs === null || steps < bs) localStorage.setItem(bestKey('steps'), String(steps));
        const bt = readBest('time');
        if (bt === null || elapsed < bt) localStorage.setItem(bestKey('time'), String(elapsed));

        const cleared = Number(localStorage.getItem(CLEARED_KEY) || 0) + 1;
        localStorage.setItem(CLEARED_KEY, String(cleared));
    }

    /* ---------- HUD ---------- */
    function fmtTime(v) {
        return v.toFixed(1) + 's';
    }

    function updateHud() {
        const bs = readBest('steps');
        const bt = readBest('time');
        const cleared = Number(localStorage.getItem(CLEARED_KEY) || 0);
        const key = steps + '|' + Math.round(elapsed * 10) + '|' + n + '|' + bs + '|' + bt + '|' + cleared;
        if (key === hudCache) return;
        hudCache = key;

        els.time.textContent = fmtTime(elapsed);
        els.steps.textContent = String(steps);
        els.size.textContent = n + ' × ' + n;
        els.bestSteps.textContent = bs === null ? '--' : (bs + ' 步');
        els.bestTime.textContent = bt === null ? '--' : fmtTime(bt);
        els.cleared.textContent = String(cleared);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '迷宫逃亡';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '从左上角走到右下角的出口。每局的迷宫都会重新生成，' +
                '用最少的步数最快逃出去。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始探索';
        } else {
            els.ovTitle.textContent = '逃出来了';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '用时 ' + fmtTime(elapsed) + '，走了 ' + steps +
                ' 步。下一座迷宫已经准备好了。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(steps);
            els.ovBtn.textContent = '继续下一座';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 流程 ---------- */
    function placePlayer() {
        player = { r: 0, c: 0 };
        view.x = PAD + CS * 0.5;
        view.y = PAD + CS * 0.5;
        trail = new Set(['0,0']);
    }

    function newMaze() {
        CS = (W - PAD * 2) / n;
        generate();
        placePlayer();
        steps = 0;
        elapsed = 0;
        hintPath = [];
        hintUntil = 0;
        flash = 0;
        hudCache = '';
        updateHud();
    }

    function begin() {
        newMaze();
        state = 'playing';
        hideOverlay();
        updateHud();
    }

    function finish() {
        state = 'over';
        saveBest();
        hudCache = '';
        updateHud();
        showOverlay('over');
    }

    /* ---------- 移动 ---------- */
    function move(dr, dc) {
        if (state !== 'playing') return;
        const w = walls[player.r][player.c];
        if (dr < 0 && w.n) return;
        if (dr > 0 && w.s) return;
        if (dc < 0 && w.w) return;
        if (dc > 0 && w.e) return;

        player.r += dr;
        player.c += dc;
        steps += 1;
        trail.add(player.r + ',' + player.c);
        hintUntil = 0;
        updateHud();

        if (player.r === n - 1 && player.c === n - 1) {
            flash = 0.6;
            finish();
        }
    }

    function showHint() {
        if (state !== 'playing') return;
        hintPath = solve();
        hintUntil = performance.now() + 3200;
    }

    /* ---------- 绘制 ---------- */
    function cellX(r, c) {
        return PAD + c * CS;
    }

    function cellY(r, c) {
        return PAD + r * CS;
    }

    function drawBackdrop() {
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0b1220');
        bg.addColorStop(1, '#070b12');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(79, 140, 255, .05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= n; i++) {
            const p = Math.round(PAD + i * CS) + 0.5;
            ctx.beginPath();
            ctx.moveTo(p, PAD);
            ctx.lineTo(p, H - PAD);
            ctx.moveTo(PAD, p);
            ctx.lineTo(W - PAD, p);
            ctx.stroke();
        }
    }

    function drawTrail() {
        ctx.fillStyle = 'rgba(90, 210, 255, .16)';
        trail.forEach(function (key) {
            const parts = key.split(',');
            const r = Number(parts[0]);
            const c = Number(parts[1]);
            ctx.beginPath();
            ctx.arc(cellX(r, c) + CS / 2, cellY(r, c) + CS / 2, Math.max(1.6, CS * 0.09), 0, TAU);
            ctx.fill();
        });
    }

    function drawWalls() {
        const path = new Path2D();
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const w = walls[r][c];
                const x = cellX(r, c);
                const y = cellY(r, c);
                if (w.n) { path.moveTo(x, y); path.lineTo(x + CS, y); }
                if (w.w) { path.moveTo(x, y); path.lineTo(x, y + CS); }
                if (c === n - 1) { path.moveTo(x + CS, y); path.lineTo(x + CS, y + CS); }
                if (r === n - 1) { path.moveTo(x, y + CS); path.lineTo(x + CS, y + CS); }
            }
        }

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(79, 140, 255, .16)';
        ctx.lineWidth = 7;
        ctx.stroke(path);
        ctx.strokeStyle = 'rgba(130, 180, 255, .72)';
        ctx.lineWidth = 2.4;
        ctx.stroke(path);
        ctx.restore();
    }

    function drawHint() {
        if (!hintPath.length) return;
        if (performance.now() > hintUntil) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 197, 72, .8)';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        for (let i = 0; i < hintPath.length; i++) {
            const r = Math.floor(hintPath[i] / n);
            const c = hintPath[i] % n;
            const x = cellX(r, c) + CS / 2;
            const y = cellY(r, c) + CS / 2;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawExit() {
        const x = cellX(n - 1, n - 1) + CS / 2;
        const y = cellY(n - 1, n - 1) + CS / 2;
        const pulse = 0.5 + Math.sin(elapsed * 3.2) * 0.5;

        ctx.save();
        ctx.shadowColor = 'rgba(47, 212, 139, .9)';
        ctx.shadowBlur = 16 + pulse * 12;
        ctx.strokeStyle = 'rgba(47, 212, 139, .85)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y, CS * (0.24 + pulse * 0.06), 0, TAU);
        ctx.stroke();

        ctx.fillStyle = 'rgba(47, 212, 139, .85)';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, CS * 0.1), 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawPlayer() {
        const rad = Math.max(4, CS * 0.27);

        ctx.save();
        ctx.shadowColor = 'rgba(90, 210, 255, .95)';
        ctx.shadowBlur = 18;

        const g = ctx.createRadialGradient(
            view.x - rad * 0.35, view.y - rad * 0.4, rad * 0.15,
            view.x, view.y, rad
        );
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.55, '#a8e6ff');
        g.addColorStop(1, '#3d9fe0');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(view.x, view.y, rad, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawStart() {
        const x = cellX(0, 0) + CS / 2;
        const y = cellY(0, 0) + CS / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, .18)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, CS * 0.3, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }

    function render(dt) {
        const k = Math.min(1, dt * 20);
        const tx = cellX(player.r, player.c) + CS / 2;
        const ty = cellY(player.r, player.c) + CS / 2;
        view.x += (tx - view.x) * k;
        view.y += (ty - view.y) * k;

        drawBackdrop();
        drawTrail();
        drawHint();
        drawExit();
        drawStart();
        drawWalls();
        drawPlayer();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(47, 212, 139, ' + (flash * 0.18).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
            flash = Math.max(0, flash - dt * 1.4);
        }

        if (state === 'ready') {
            ctx.save();
            ctx.fillStyle = 'rgba(150, 175, 210, .72)';
            ctx.font = '700 15px -apple-system, "PingFang SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('点击「开始探索」出发', W / 2, H - 26);
            ctx.restore();
        }
    }

    /* ---------- 交互 ---------- */
    window.addEventListener('keydown', function (e) {
        const k = e.key;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') { move(-1, 0); e.preventDefault(); }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { move(1, 0); e.preventDefault(); }
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { move(0, -1); e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { move(0, 1); e.preventDefault(); }
        else if (k === 'h' || k === 'H') { showHint(); e.preventDefault(); }
        else if (k === 'r' || k === 'R') { begin(); e.preventDefault(); }
    });

    let swipe = null;

    canvas.addEventListener('pointerdown', function (e) {
        swipe = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', function (e) {
        if (!swipe) return;
        const dx = e.clientX - swipe.x;
        const dy = e.clientY - swipe.y;
        swipe = null;
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
        else move(dy > 0 ? 1 : -1, 0);
    });

    canvas.addEventListener('pointercancel', function () { swipe = null; });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);
    els.hintBtn.addEventListener('click', showHint);

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-size]');
        if (!btn) return;
        n = Number(btn.dataset.size);
        els.diffGroup.querySelectorAll('[data-size]').forEach(function (b) {
            b.classList.toggle('active', b === btn);
        });
        begin();
    });

    /* ---------- 启动 ---------- */
    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;

        if (state === 'playing') {
            elapsed += dt;
            updateHud();
        }

        render(dt);
        requestAnimationFrame(frame);
    }

    newMaze();
    showOverlay('ready');
    requestAnimationFrame(frame);
})();
