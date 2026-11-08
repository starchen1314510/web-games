/* ==========================================================
   海战棋 Battleship
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const N = 10;
    const CELL = 20;
    const SIZE = N * CELL;
    const GRID_X = 150;
    const ENEMY_Y = 114;
    const MINE_Y = 356;
    const LETTERS = 'ABCDEFGHIJ';

    const WIN_KEY = 'webgames.battleship.win';
    const LOSE_KEY = 'webgames.battleship.lose';

    const FLEET = [
        { len: 5, name: '航母' },
        { len: 4, name: '战列舰' },
        { len: 3, name: '巡洋舰' },
        { len: 3, name: '潜艇' },
        { len: 2, name: '驱逐舰' }
    ];

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
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    function randInt(n) {
        return Math.floor(Math.random() * n);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        enemyleft: document.getElementById('enemyleft'),
        myleft: document.getElementById('myleft'),
        acc: document.getElementById('acc'),
        wins: document.getElementById('wins'),
        losses: document.getElementById('losses'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 棋局数据 ---------- */
    function makeBoard() {
        const cells = new Array(N * N).fill(-1);
        const ships = [];

        for (let si = 0; si < FLEET.length; si++) {
            const spec = FLEET[si];
            let placed = false;
            let guard = 0;
            while (!placed && guard < 1200) {
                guard++;
                const horiz = Math.random() < 0.5;
                const r = randInt(N);
                const c = randInt(N);
                const dc = horiz ? 1 : 0;
                const dr = horiz ? 0 : 1;
                if (c + dc * (spec.len - 1) >= N) continue;
                if (r + dr * (spec.len - 1) >= N) continue;

                // 船与船之间留出一格间隙，避免视觉上连成长条
                let ok = true;
                for (let k = -1; k <= spec.len && ok; k++) {
                    for (let s = -1; s <= 1 && ok; s++) {
                        const rr = r + dr * k + (dc ? s : 0);
                        const cc = c + dc * k + (dr ? s : 0);
                        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
                        if (cells[rr * N + cc] !== -1) ok = false;
                    }
                }
                if (!ok) continue;

                const idxs = [];
                for (let i = 0; i < spec.len; i++) {
                    const k = (r + dr * i) * N + (c + dc * i);
                    cells[k] = si;
                    idxs.push(k);
                }
                ships.push({ len: spec.len, name: spec.name, cells: idxs, hits: [], sunk: false });
                placed = true;
            }
        }
        return { cells: cells, ships: ships };
    }

    let myBoard = null;
    let enemyBoard = null;
    let myShots = null;
    let enemyShots = null;

    let state = 'ready';
    let enemyTimer = 0;
    let aiQueue = [];
    let marks = [];
    let clock = 0;
    let hoverIdx = -1;
    let msg = '';
    let msgTone = 'normal';
    let msgTimer = 0;
    let fired = 0;
    let hits = 0;
    let hudCache = '';

    /* ---------- 布阵 ---------- */
    function reset() {
        myBoard = makeBoard();
        enemyBoard = makeBoard();
        myShots = new Array(N * N).fill(0);
        enemyShots = new Array(N * N).fill(0);
        state = 'player';
        enemyTimer = 0;
        aiQueue = [];
        marks = [];
        hoverIdx = -1;
        fired = 0;
        hits = 0;
        msg = '你先手，点击上方海域开火';
        msgTone = 'hint';
        msgTimer = 2;
        hudCache = '';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function leftShips(board) {
        let n = 0;
        for (let i = 0; i < board.ships.length; i++) if (!board.ships[i].sunk) n++;
        return n;
    }

    function updateHud() {
        const acc = fired > 0 ? Math.round(hits / fired * 100) + '%' : '--';
        const key = [leftShips(enemyBoard), leftShips(myBoard), acc, state,
            els.wins.textContent, els.losses.textContent].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.enemyleft.textContent = String(leftShips(enemyBoard));
        els.myleft.textContent = String(leftShips(myBoard));
        els.acc.textContent = acc;
        els.wins.textContent = String(Number(localStorage.getItem(WIN_KEY) || 0));
        els.losses.textContent = String(Number(localStorage.getItem(LOSE_KEY) || 0));
    }

    /* ---------- 开火 ---------- */
    function resolveShot(board, shots, idx) {
        shots[idx] = board.cells[idx] < 0 ? 1 : 2;
        if (shots[idx] === 1) return { hit: false, sunk: false, ship: null };

        const ship = board.ships[board.cells[idx]];
        ship.hits.push(idx);
        const sunk = ship.hits.length >= ship.len;
        if (sunk) ship.sunk = true;
        return { hit: true, sunk: sunk, ship: ship };
    }

    function spawnMark(idx, by, hit, sunk) {
        const c = idx % N;
        const r = (idx - c) / N;
        const x = GRID_X + c * CELL + CELL / 2;
        const y = by + r * CELL + CELL / 2;
        marks.push({ x: x, y: y, t: 0, max: sunk ? 1.1 : 0.62, hit: hit, sunk: sunk });
    }

    function playerFire(idx) {
        if (state !== 'player') return;
        if (enemyShots[idx] !== 0) return;

        const res = resolveShot(enemyBoard, enemyShots, idx);
        fired++;
        if (res.hit) hits++;
        spawnMark(idx, ENEMY_Y, res.hit, res.sunk);

        if (res.sunk) {
            msg = '击沉敌方' + res.ship.name + '！';
            msgTone = 'good';
            msgTimer = 1.6;
        } else if (res.hit) {
            msg = '命中，再来一发';
            msgTone = 'good';
            msgTimer = 1.2;
            state = 'player';
            updateHud();
            return;
        } else {
            msg = '落空，轮到敌方';
            msgTone = 'normal';
            msgTimer = 1.2;
        }

        updateHud();
        if (leftShips(enemyBoard) === 0) {
            gameOver(true);
            return;
        }
        if (res.hit) {
            // 命中后仍由玩家继续开火（经典规则：命中不换手）
            state = 'player';
            return;
        }
        state = 'enemy';
        enemyTimer = 0.62;
    }

    function pushNeighbors(idx) {
        const c = idx % N;
        const r = (idx - c) / N;
        const near = [];
        if (c > 0) near.push(idx - 1);
        if (c < N - 1) near.push(idx + 1);
        if (r > 0) near.push(idx - N);
        if (r < N - 1) near.push(idx + N);
        for (let i = 0; i < near.length; i++) {
            if (myShots[near[i]] === 0 && aiQueue.indexOf(near[i]) === -1) aiQueue.push(near[i]);
        }
    }

    function aiPick() {
        while (aiQueue.length && myShots[aiQueue[0]] !== 0) aiQueue.shift();
        if (aiQueue.length) return aiQueue.shift();

        const free = [];
        for (let i = 0; i < N * N; i++) if (myShots[i] === 0) free.push(i);
        if (!free.length) return -1;
        return free[randInt(free.length)];
    }

    function enemyTurn() {
        if (state !== 'enemy') return;
        const idx = aiPick();
        if (idx < 0) return;

        const res = resolveShot(myBoard, myShots, idx);
        spawnMark(idx, MINE_Y, res.hit, res.sunk);

        if (res.sunk) {
            aiQueue = [];
            msg = '我方' + res.ship.name + '被击沉';
            msgTone = 'bad';
            msgTimer = 1.8;
        } else if (res.hit) {
            pushNeighbors(idx);
            msg = '我方被命中';
            msgTone = 'bad';
            msgTimer = 1.2;
        } else {
            msg = '敌方落空，继续开火';
            msgTone = 'hint';
            msgTimer = 1.2;
        }

        updateHud();
        if (leftShips(myBoard) === 0) {
            gameOver(false);
            return;
        }
        if (res.hit) {
            state = 'enemy';
            enemyTimer = 0.55;
            return;
        }
        state = 'player';
    }

    function gameOver(win) {
        state = 'over';
        if (win) {
            const w = Number(localStorage.getItem(WIN_KEY) || 0) + 1;
            localStorage.setItem(WIN_KEY, String(w));
            els.ovTitle.textContent = '全歼敌舰';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '敌方五艘军舰全部沉没，这片海域归你了。';
            els.ovScore.innerHTML = '开火 <b>' + fired + '</b> 次 · 命中 <b>' + hits + '</b> 次';
            els.ovBtn.textContent = '再来一局';
        } else {
            const l = Number(localStorage.getItem(LOSE_KEY) || 0) + 1;
            localStorage.setItem(LOSE_KEY, String(l));
            els.ovTitle.textContent = '舰队全灭';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '我方五艘军舰全部被击沉，换一套布阵再战。';
            els.ovScore.innerHTML = '敌方还剩 <b>' + leftShips(enemyBoard) + '</b> 艘';
            els.ovBtn.textContent = '重新布阵';
        }
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 命中测试 ---------- */
    function boardHitTest(x, y, by) {
        const c = Math.floor((x - GRID_X) / CELL);
        const r = Math.floor((y - by) / CELL);
        if (c < 0 || c >= N || r < 0 || r >= N) return -1;
        return r * N + c;
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        if (msgTimer > 0) msgTimer -= dt;

        for (let i = marks.length - 1; i >= 0; i--) {
            marks[i].t += dt;
            if (marks[i].t >= marks[i].max) marks.splice(i, 1);
        }

        if (state === 'enemy') {
            enemyTimer -= dt;
            if (enemyTimer <= 0) enemyTurn();
        }
    }

    /* ---------- 绘制 ---------- */
    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .46)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('BATTLESHIP', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('海战棋', W / 2, 50);

        const g = ctx.createLinearGradient(150, 0, W - 150, 0);
        g.addColorStop(0, 'rgba(110, 152, 200, 0)');
        g.addColorStop(0.5, 'rgba(120, 165, 220, .32)');
        g.addColorStop(1, 'rgba(110, 152, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(150, 74, W - 300, 1);
        ctx.restore();
    }

    function drawStatus() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;

        if (msgTimer > 0 && msg) {
            const c = msgTone === 'bad' ? 'rgba(255, 140, 150, .95)'
                : (msgTone === 'good' ? 'rgba(140, 240, 180, .95)'
                    : (msgTone === 'hint' ? 'rgba(255, 214, 130, .95)'
                        : 'rgba(190, 212, 240, .85)'));
            ctx.fillStyle = c;
            ctx.fillText(msg, W / 2, 578);
        } else if (state === 'player') {
            ctx.fillStyle = 'rgba(160, 190, 220, .62)';
            ctx.fillText('你的回合 · 点击敌方海域', W / 2, 578);
        } else if (state === 'enemy') {
            ctx.fillStyle = 'rgba(255, 170, 150, .8)';
            ctx.fillText('敌方开火中…', W / 2, 578);
        }
        ctx.restore();
    }

    function drawGridLabel(text, y, tone) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = tone;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '1.6px';
        ctx.fillText(text, W / 2, y);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.restore();
    }

    function drawBoard(bx, by, board, shots, reveal, active) {
        ctx.save();

        ctx.fillStyle = 'rgba(8, 20, 36, .92)';
        roundRectPath(ctx, bx - 5, by - 5, SIZE + 10, SIZE + 10, 7);
        ctx.fill();
        ctx.strokeStyle = active ? 'rgba(120, 180, 240, .42)' : 'rgba(96, 140, 190, .24)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const idx = r * N + c;
                const x = bx + c * CELL;
                const y = by + r * CELL;
                const si = board.cells[idx];
                const ship = si >= 0 ? board.ships[si] : null;
                const shot = shots[idx];
                const showShip = ship && (reveal || ship.sunk);

                let fill = (r + c) % 2 === 0 ? 'rgba(17, 35, 58, .95)' : 'rgba(12, 27, 46, .95)';
                if (showShip) fill = ship.sunk ? 'rgba(92, 36, 42, .94)' : 'rgba(84, 148, 216, .9)';
                if (shot === 1) fill = (r + c) % 2 === 0 ? 'rgba(10, 26, 44, .96)' : 'rgba(15, 33, 54, .96)';
                if (shot === 2) fill = ship && ship.sunk ? 'rgba(158, 46, 48, .96)' : 'rgba(206, 68, 68, .92)';

                ctx.fillStyle = fill;
                ctx.fillRect(x + 0.6, y + 0.6, CELL - 1.2, CELL - 1.2);
            }
        }

        // 网格线
        ctx.strokeStyle = 'rgba(104, 148, 198, .2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < N; i++) {
            ctx.moveTo(bx + i * CELL + 0.5, by);
            ctx.lineTo(bx + i * CELL + 0.5, by + SIZE);
            ctx.moveTo(bx, by + i * CELL + 0.5);
            ctx.lineTo(bx + SIZE, by + i * CELL + 0.5);
        }
        ctx.stroke();

        // 坐标（左侧行号 + 上方列字母）
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 8px ' + FONT;
        ctx.fillStyle = 'rgba(136, 170, 208, .55)';
        for (let i = 0; i < N; i++) {
            ctx.fillText(LETTERS[i], bx + i * CELL + CELL / 2, by - 9);
            ctx.fillText(String(i + 1), bx - 9, by + i * CELL + CELL / 2);
        }

        // 落空点
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const idx = r * N + c;
                if (shots[idx] !== 1) continue;
                const x = bx + c * CELL + CELL / 2;
                const y = by + r * CELL + CELL / 2;
                ctx.fillStyle = 'rgba(150, 195, 240, .55)';
                ctx.beginPath();
                ctx.arc(x, y, 2.2, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(150, 195, 240, .28)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 4.6, 0, TAU);
                ctx.stroke();
            }
        }

        // 命中与沉没叉号
        for (let i = 0; i < board.ships.length; i++) {
            const ship = board.ships[i];
            if (!ship.sunk) continue;
            const a = ship.cells[0];
            const b = ship.cells[ship.cells.length - 1];
            const ax = bx + (a % N) * CELL + CELL / 2;
            const ay = by + Math.floor(a / N) * CELL + CELL / 2;
            const bx2 = bx + (b % N) * CELL + CELL / 2;
            const by2 = by + Math.floor(b / N) * CELL + CELL / 2;
            ctx.strokeStyle = 'rgba(255, 176, 176, .82)';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx2, by2);
            ctx.stroke();
        }

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const idx = r * N + c;
                if (shots[idx] !== 2) continue;
                const x = bx + c * CELL + CELL / 2;
                const y = by + r * CELL + CELL / 2;
                const d = CELL * 0.22;
                ctx.strokeStyle = 'rgba(255, 246, 240, .92)';
                ctx.lineWidth = 2.2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x - d, y - d);
                ctx.lineTo(x + d, y + d);
                ctx.moveTo(x + d, y - d);
                ctx.lineTo(x - d, y + d);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    function drawHover() {
        if (hoverIdx < 0 || state !== 'player') return;
        if (enemyShots[hoverIdx] !== 0) return;
        const c = hoverIdx % N;
        const r = Math.floor(hoverIdx / N);
        const x = GRID_X + c * CELL;
        const y = ENEMY_Y + r * CELL;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 214, 120, .16)';
        ctx.fillRect(x + 0.6, y + 0.6, CELL - 1.2, CELL - 1.2);
        ctx.strokeStyle = 'rgba(255, 214, 120, .7)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.restore();
    }

    function drawMarks() {
        ctx.save();
        for (let i = 0; i < marks.length; i++) {
            const m = marks[i];
            const k = m.t / m.max;
            if (m.hit) {
                const rad = CELL * 0.28 + k * CELL * 0.9;
                ctx.strokeStyle = 'rgba(255, 150, 120, ' + ((1 - k) * 0.75).toFixed(3) + ')';
                ctx.lineWidth = 2.4 * (1 - k) + 0.5;
                ctx.beginPath();
                ctx.arc(m.x, m.y, rad, 0, TAU);
                ctx.stroke();

                if (k < 0.5) {
                    const p = 1 - k / 0.5;
                    ctx.fillStyle = 'rgba(255, 236, 200, ' + (p * 0.85).toFixed(3) + ')';
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, CELL * 0.34 * p, 0, TAU);
                    ctx.fill();
                }
            } else {
                const rad = CELL * 0.2 + k * CELL * 0.62;
                ctx.strokeStyle = 'rgba(140, 195, 245, ' + ((1 - k) * 0.6).toFixed(3) + ')';
                ctx.lineWidth = 1.8 * (1 - k) + 0.4;
                ctx.beginPath();
                ctx.arc(m.x, m.y, rad, 0, TAU);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#050b14');
        g.addColorStop(0.45, '#08131f');
        g.addColorStop(1, '#06101a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        drawHeader();
        drawStatus();

        drawGridLabel('敌 方 海 域', 92, state === 'player' ? 'rgba(255, 208, 130, .8)' : 'rgba(150, 182, 216, .5)');
        drawBoard(GRID_X, ENEMY_Y, enemyBoard, enemyShots, false, state === 'player');

        drawGridLabel('我 方 海 域', 332, 'rgba(150, 182, 216, .5)');
        drawBoard(GRID_X, MINE_Y, myBoard, myShots, true, false);

        drawHover();
        drawMarks();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const idx = boardHitTest(x, y, ENEMY_Y);
        if (idx >= 0) playerFire(idx);
    });

    canvas.addEventListener('pointermove', function (e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        hoverIdx = boardHitTest(x, y, ENEMY_Y);
    });

    canvas.addEventListener('pointerleave', function () {
        hoverIdx = -1;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            reset();
        }
    });

    els.ovBtn.addEventListener('click', reset);
    els.restartBtn.addEventListener('click', reset);

    /* ---------- 主循环 ---------- */
    let last = 0;

    function loop(now) {
        if (!last) last = now;
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    myBoard = makeBoard();
    enemyBoard = makeBoard();
    myShots = new Array(N * N).fill(0);
    enemyShots = new Array(N * N).fill(0);
    updateHud();
    requestAnimationFrame(loop);
})();
