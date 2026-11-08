/* ==========================================================
   炸弹人 Bomberman
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 500;
    const COLS = 15;
    const ROWS = 13;
    const CELL = 30;
    const OFFX = (W - COLS * CELL) / 2;
    const OFFY = 52;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const BEST_KEY = 'webgames.bomber.best';

    const UP = { x: 0, y: -1 };
    const DOWN = { x: 0, y: 1 };
    const LEFT = { x: -1, y: 0 };
    const RIGHT = { x: 1, y: 0 };
    const DIRS = [UP, DOWN, LEFT, RIGHT];

    const WALL = '#';
    const BRICK = 'B';
    const EMPTY = ' ';
    const EXIT = 'E';

    const FUSE = 2.2;
    const BLAST_TIME = 0.42;
    const ITEM_KINDS = ['power', 'bomb', 'speed'];

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

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        lives: document.getElementById('lives'),
        enemies: document.getElementById('enemies'),
        power: document.getElementById('power'),
        bombs: document.getElementById('bombs'),
        level: document.getElementById('level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let grid = [];
    let player = null;
    let enemies = [];
    let bombs = [];
    let blasts = [];
    let items = [];
    let exitCell = null;
    let exitOpen = false;
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let lives = 3;
    let level = 1;
    let state = 'ready';
    let clock = 0;
    let deathTimer = 0;
    let clearTimer = 0;
    let invuln = 0;
    let hudCache = '';
    let particles = [];
    let texts = [];
    let basePower = 1;
    let baseBombs = 1;
    let baseSpeed = 5.6;

    /* ---------- 地图 ---------- */
    function buildMap() {
        grid = [];
        for (let r = 0; r < ROWS; r++) {
            const row = [];
            for (let c = 0; c < COLS; c++) {
                let ch = EMPTY;
                if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) {
                    ch = WALL;
                } else if (r % 2 === 0 && c % 2 === 0) {
                    ch = WALL;
                } else if (Math.random() < 0.62) {
                    ch = BRICK;
                }
                row.push(ch);
            }
            grid.push(row);
        }
        // 出生点附近清空
        for (let r = 1; r <= 3; r++) {
            for (let c = 1; c <= 3; c++) {
                if (r < ROWS - 1 && c < COLS - 1 && grid[r][c] !== WALL) grid[r][c] = EMPTY;
            }
        }
        // 敌人出生点清空
        const spots = [
            [COLS - 2, ROWS - 2], [COLS - 2, 1], [1, ROWS - 2]
        ];
        for (let i = 0; i < spots.length; i++) {
            const c = spots[i][0];
            const r = spots[i][1];
            grid[r][c] = EMPTY;
            if (grid[r][c - 1] !== WALL) grid[r][c - 1] = EMPTY;
            if (grid[r + 1] && grid[r + 1][c] !== WALL) grid[r + 1][c] = EMPTY;
        }

        // 选一个砖块作为出口
        const bricks = [];
        for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLS - 1; c++) {
                if (grid[r][c] === BRICK && (c + r) > 6) bricks.push([c, r]);
            }
        }
        exitCell = bricks.length ? bricks[Math.floor(Math.random() * bricks.length)] : null;
        if (!exitCell) exitCell = { c: COLS - 2, r: ROWS - 2 };
        else exitCell = { c: exitCell[0], r: exitCell[1] };
        exitOpen = false;
    }

    function wallAt(c, r) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
        return grid[r][c] === WALL;
    }

    function solidAt(c, r) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
        const ch = grid[r][c];
        return ch === WALL || ch === BRICK;
    }

    function bombAt(c, r) {
        for (let i = 0; i < bombs.length; i++) {
            if (bombs[i].c === c && bombs[i].r === r && !bombs[i].exploded) return bombs[i];
        }
        return null;
    }

    function itemAt(c, r) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].c === c && items[i].r === r) return items[i];
        }
        return null;
    }

    function canWalk(c, r) {
        if (solidAt(c, r)) return false;
        if (bombAt(c, r)) return false;
        return true;
    }

    function canEnemyWalk(c, r) {
        return !solidAt(c, r) && !bombAt(c, r);
    }

    /* ---------- 实体 ---------- */
    function makePlayer() {
        return { c: 1, r: 1, fc: 1, fr: 1, t: 0, dir: null, power: basePower, maxBombs: baseBombs, speed: baseSpeed };
    }

    function makeEnemies(n) {
        const list = [];
        const spots = [
            [COLS - 2, ROWS - 2], [COLS - 2, 1], [1, ROWS - 2], [COLS - 4, ROWS - 2]
        ];
        for (let i = 0; i < n; i++) {
            const s = spots[i % spots.length];
            list.push({
                c: s[0], r: s[1], fc: s[0], fr: s[1], t: 0, dir: null,
                speed: 2.3 + level * 0.16, hue: i, alive: true, wobble: Math.random() * TAU
            });
        }
        return list;
    }

    function entPos(e) {
        const tx = OFFX + (e.c + 0.5) * CELL;
        const ty = OFFY + (e.r + 0.5) * CELL;
        // t 为 0 时刚到达当前格（fc/fr 已过期），直接返回格心
        if (e.t === 0) return { x: tx, y: ty };
        const fx = OFFX + (e.fc + 0.5) * CELL;
        const fy = OFFY + (e.fr + 0.5) * CELL;
        const t = Math.min(1, e.t);
        return { x: lerp(fx, tx, t), y: lerp(fy, ty, t) };
    }

    function tileOfPoint(px, py) {
        return {
            c: clamp(Math.floor((px - OFFX) / CELL), 0, COLS - 1),
            r: clamp(Math.floor((py - OFFY) / CELL), 0, ROWS - 1)
        };
    }

    function advance(e, dt, speed, canWalkFn, onArrive) {
        if (e.t === 0) {
            if (!e.dir) return;
            if (!canWalkFn(e.c + e.dir.x, e.r + e.dir.y)) {
                e.dir = null;
                return;
            }
            e.fc = e.c;
            e.fr = e.r;
            e.c += e.dir.x;
            e.r += e.dir.y;
        }
        e.t += speed * dt;
        if (e.t >= 1) {
            e.t = 0;
            if (onArrive) onArrive(e);
        }
    }

    /* ---------- 粒子 ---------- */
    function burst(x, y, color, n, spread) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const sp = 30 + Math.random() * (spread || 120);
            particles.push({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0.3 + Math.random() * 0.5,
                max: 0.8,
                r: 1.2 + Math.random() * 2.4,
                color: color
            });
        }
    }

    function floatText(x, y, text, color) {
        texts.push({ x: x, y: y, text: text, color: color, life: 0.85, max: 0.85 });
    }

    /* ---------- 炸弹与爆炸 ---------- */
    function placeBomb() {
        if (state !== 'playing' || deathTimer > 0) return;
        if (bombs.length >= player.maxBombs) return;
        const p = entPos(player);
        const tp = tileOfPoint(p.x, p.y);
        if (bombAt(tp.c, tp.r)) return;
        bombs.push({
            c: tp.c, r: tp.r, timer: FUSE, power: player.power, exploded: false,
            owner: 'player'
        });
    }

    function dropItem(c, r) {
        if (Math.random() > 0.28) return;
        if (itemAt(c, r)) return;
        items.push({
            c: c, r: r,
            kind: ITEM_KINDS[Math.floor(Math.random() * ITEM_KINDS.length)],
            born: clock
        });
    }

    function detonate(bomb) {
        if (bomb.exploded) return;
        bomb.exploded = true;

        const idx = bombs.indexOf(bomb);
        if (idx >= 0) bombs.splice(idx, 1);

        const cells = [{ c: bomb.c, r: bomb.r }];
        const chain = [];

        for (let d = 0; d < DIRS.length; d++) {
            const dir = DIRS[d];
            for (let i = 1; i <= bomb.power; i++) {
                const c = bomb.c + dir.x * i;
                const r = bomb.r + dir.y * i;
                if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
                const ch = grid[r][c];
                if (ch === WALL) break;
                if (ch === BRICK) {
                    grid[r][c] = EMPTY;
                    score += 5;
                    const px = OFFX + (c + 0.5) * CELL;
                    const py = OFFY + (r + 0.5) * CELL;
                    burst(px, py, '#c8794a', 8, 100);
                    if (exitCell && exitCell.c === c && exitCell.r === r) {
                        exitOpen = enemiesAlive() === 0;
                    }
                    dropItem(c, r);
                    cells.push({ c: c, r: r });
                    break;
                }
                cells.push({ c: c, r: r });
                const other = bombAt(c, r);
                if (other && other !== bomb && !other.exploded) chain.push(other);
            }
        }

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const it = itemAt(cell.c, cell.r);
            if (it) items.splice(items.indexOf(it), 1);
            const px = OFFX + (cell.c + 0.5) * CELL;
            const py = OFFY + (cell.r + 0.5) * CELL;
            burst(px, py, '#ffb257', 3, 60);
        }

        blasts.push({ cells: cells, timer: BLAST_TIME, max: BLAST_TIME });
        for (let i = 0; i < chain.length; i++) detonate(chain[i]);
    }

    function blastAt(c, r) {
        for (let i = 0; i < blasts.length; i++) {
            const cells = blasts[i].cells;
            for (let k = 0; k < cells.length; k++) {
                if (cells[k].c === c && cells[k].r === r) return true;
            }
        }
        return false;
    }

    function enemiesAlive() {
        let n = 0;
        for (let i = 0; i < enemies.length; i++) if (enemies[i].alive) n += 1;
        return n;
    }

    /* ---------- 流程 ---------- */
    function startLevel(keepScore) {
        buildMap();
        player = makePlayer();
        bombs = [];
        blasts = [];
        items = [];
        particles = [];
        texts = [];
        invuln = 1.2;
        enemies = makeEnemies(Math.min(3 + Math.floor((level - 1) / 2), 5));
        state = 'playing';
        deathTimer = 0;
        clearTimer = 0;
        hudCache = '';
        hideOverlay();
        updateHud();
        if (!keepScore) clock = 0;
    }

    function startGame() {
        score = 0;
        lives = 3;
        level = 1;
        basePower = 1;
        baseBombs = 1;
        baseSpeed = 5.6;
        clock = 0;
        startLevel(true);
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function gameOver() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        els.ovTitle.textContent = '被炸飞了';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '这一局你拿到 ' + score + ' 分，闯到第 ' + level + ' 关。';
        els.ovScore.innerHTML = '最高分 <b>' + best + '</b>';
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    function loseLife() {
        if (deathTimer > 0 || invuln > 0) return;
        lives -= 1;
        deathTimer = 1.3;
        state = 'dying';
        const p = entPos(player);
        burst(p.x, p.y, '#ff8a6b', 18, 150);
        floatText(p.x, p.y - 22, '被炸中', '#ffb4a0');
        updateHud();
    }

    function levelClear() {
        state = 'clear';
        clearTimer = 1.4;
        score += 300;
        floatText(W / 2, OFFY + ROWS * CELL / 2, '过关！', '#8fe3ff');
        updateHud();
    }

    function updateHud() {
        const alive = enemiesAlive();
        const key = [score, lives, alive, level, player.power, player.maxBombs, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.lives.textContent = lives > 0 ? '♥'.repeat(lives) : '—';
        els.enemies.textContent = String(alive);
        els.power.textContent = String(player.power);
        els.bombs.textContent = String(player.maxBombs);
        els.level.textContent = String(level);
    }

    /* ---------- 敌人 AI ---------- */
    function chooseEnemyDir(e) {
        const back = e.dir ? { x: -e.dir.x, y: -e.dir.y } : null;
        const opts = [];
        for (let i = 0; i < DIRS.length; i++) {
            const d = DIRS[i];
            if (back && d.x === back.x && d.y === back.y) continue;
            if (!canEnemyWalk(e.c + d.x, e.r + d.y)) continue;
            opts.push(d);
        }
        if (!opts.length) {
            if (back && canEnemyWalk(e.c + back.x, e.r + back.y)) {
                e.dir = back;
            } else {
                e.dir = null;
            }
            return;
        }
        const pp = entPos(player);
        const pt = tileOfPoint(pp.x, pp.y);
        if (Math.random() < 0.62) {
            let pick = opts[0];
            let bestD = 1e9;
            for (let i = 0; i < opts.length; i++) {
                const d = opts[i];
                const dist = Math.abs(e.c + d.x - pt.c) + Math.abs(e.r + d.y - pt.r);
                if (dist < bestD) {
                    bestD = dist;
                    pick = d;
                }
            }
            e.dir = pick;
        } else {
            e.dir = opts[Math.floor(Math.random() * opts.length)];
        }
    }

    /* ---------- 输入 ---------- */
    const keys = {};

    function wantDir() {
        if (keys.up) return UP;
        if (keys.down) return DOWN;
        if (keys.left) return LEFT;
        if (keys.right) return RIGHT;
        return null;
    }

    const KEYMAP = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right'
    };

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            e.preventDefault();
            placeBomb();
            return;
        }
        const k = KEYMAP[e.key];
        if (!k) return;
        e.preventDefault();
        keys[k] = true;
    });

    window.addEventListener('keyup', function (e) {
        const k = KEYMAP[e.key];
        if (!k) return;
        keys[k] = false;
    });

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        placeBomb();
    });

    let swipeFrom = null;

    canvas.addEventListener('pointermove', function (e) {
        if (swipeFrom === null) return;
        const dx = e.clientX - swipeFrom.x;
        const dy = e.clientY - swipeFrom.y;
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
        for (const k in keys) keys[k] = false;
        if (Math.abs(dx) > Math.abs(dy)) keys[dx > 0 ? 'right' : 'left'] = true;
        else keys[dy > 0 ? 'down' : 'up'] = true;
        swipeFrom = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', function () {
        swipeFrom = null;
        for (const k in keys) keys[k] = false;
    });

    canvas.addEventListener('pointerleave', function () {
        swipeFrom = null;
        for (const k in keys) keys[k] = false;
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 24 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }
        for (let i = blasts.length - 1; i >= 0; i--) {
            blasts[i].timer -= dt;
            if (blasts[i].timer <= 0) blasts.splice(i, 1);
        }

        if (state === 'clear') {
            clearTimer -= dt;
            if (clearTimer <= 0) {
                level += 1;
                startLevel(true);
            }
            return;
        }

        if (state === 'dying') {
            deathTimer -= dt;
            if (deathTimer <= 0) {
                if (lives <= 0) {
                    gameOver();
                } else {
                    player = makePlayer();
                    bombs = [];
                    blasts = [];
                    invuln = 1.4;
                    state = 'playing';
                    updateHud();
                }
            }
            return;
        }

        if (state !== 'playing') return;

        if (invuln > 0) invuln -= dt;

        // 玩家
        if (player.t === 0) {
            const want = wantDir();
            if (want && canWalk(player.c + want.x, player.r + want.y)) {
                player.dir = want;
            } else {
                player.dir = null;
            }
        }
        advance(player, dt, player.speed, canWalk, function () {
            pickup();
        });

        // 敌人
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            if (e.t === 0) chooseEnemyDir(e);
            advance(e, dt, e.speed, canEnemyWalk, null);
        }

        // 炸弹倒计时
        for (let i = bombs.length - 1; i >= 0; i--) {
            const b = bombs[i];
            b.timer -= dt;
            if (b.timer <= 0) {
                bombs.splice(i, 1);
                detonate(b);
            }
        }

        // 爆炸伤害
        const pp = entPos(player);
        const pt = tileOfPoint(pp.x, pp.y);
        if (invuln <= 0 && blastAt(pt.c, pt.r)) {
            loseLife();
            return;
        }
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            const ep = entPos(e);
            const et = tileOfPoint(ep.x, ep.y);
            if (blastAt(et.c, et.r)) {
                e.alive = false;
                score += 100;
                burst(ep.x, ep.y, '#c88bff', 14, 140);
                floatText(ep.x, ep.y - 18, '+100', '#d7b6ff');
                updateHud();
            }
        }

        // 敌人碰撞
        if (invuln <= 0) {
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e.alive) continue;
                const ep = entPos(e);
                const dx = ep.x - pp.x;
                const dy = ep.y - pp.y;
                if (dx * dx + dy * dy < CELL * CELL * 0.5 * 0.5) {
                    loseLife();
                    return;
                }
            }
        }

        // 敌人全灭 → 开出口
        if (!exitOpen && enemiesAlive() === 0) {
            exitOpen = true;
            if (exitCell && grid[exitCell.r][exitCell.c] === BRICK) {
                grid[exitCell.r][exitCell.c] = EMPTY;
            }
            if (exitCell) {
                const ex = OFFX + (exitCell.c + 0.5) * CELL;
                const ey = OFFY + (exitCell.r + 0.5) * CELL;
                burst(ex, ey, '#8fe0a8', 16, 130);
                floatText(ex, ey - 24, '出口出现', '#9df0bd');
            }
        }

        // 进入出口
        if (exitOpen && exitCell && pt.c === exitCell.c && pt.r === exitCell.r) {
            levelClear();
        }

        updateHud();
    }

    function pickup() {
        const p = entPos(player);
        const tp = tileOfPoint(p.x, p.y);
        const it = itemAt(tp.c, tp.r);
        if (!it) return;
        items.splice(items.indexOf(it), 1);
        score += 20;
        if (it.kind === 'power') {
            player.power = Math.min(player.power + 1, 6);
            floatText(p.x, p.y - 20, '火力 +1', '#ffc978');
        } else if (it.kind === 'bomb') {
            player.maxBombs = Math.min(player.maxBombs + 1, 5);
            floatText(p.x, p.y - 20, '炸弹 +1', '#9fd4ff');
        } else {
            player.speed = Math.min(player.speed + 0.7, 9.4);
            floatText(p.x, p.y - 20, '速度 +1', '#a8f0c8');
        }
        const px = OFFX + (tp.c + 0.5) * CELL;
        const py = OFFY + (tp.r + 0.5) * CELL;
        burst(px, py, '#ffe08a', 10, 90);
        updateHud();
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawField() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1219');
        g.addColorStop(0.6, '#0b1620');
        g.addColorStop(1, '#0d1a24');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === WALL) continue;
                const x = OFFX + c * CELL;
                const y = OFFY + r * CELL;
                ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(26, 48, 42, .85)' : 'rgba(22, 42, 38, .85)';
                ctx.fillRect(x, y, CELL, CELL);
                ctx.fillStyle = 'rgba(120, 200, 160, .06)';
                ctx.fillRect(x + CELL / 2 - 1, y + CELL / 2 - 1, 2, 2);
            }
        }
    }

    function drawWalls() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const x = OFFX + c * CELL;
                const y = OFFY + r * CELL;
                if (grid[r][c] === WALL) {
                    const g = ctx.createLinearGradient(x, y, x, y + CELL);
                    g.addColorStop(0, '#4a5568');
                    g.addColorStop(0.5, '#39424f');
                    g.addColorStop(1, '#252d38');
                    ctx.fillStyle = g;
                    roundRect(x + 1, y + 1, CELL - 2, CELL - 2, 4);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(190, 210, 235, .16)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(220, 235, 255, .14)';
                    roundRect(x + 3, y + 2.5, CELL - 6, 2.5, 1.2);
                    ctx.fill();
                } else if (grid[r][c] === BRICK) {
                    const bg = ctx.createLinearGradient(x, y, x, y + CELL);
                    bg.addColorStop(0, '#8a4d2f');
                    bg.addColorStop(0.55, '#753d26');
                    bg.addColorStop(1, '#5b2f1d');
                    ctx.fillStyle = bg;
                    roundRect(x + 1, y + 1, CELL - 2, CELL - 2, 3);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(240, 190, 150, .22)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(255, 208, 160, .16)';
                    roundRect(x + 3, y + 2.5, CELL - 6, 2.5, 1.2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(44, 20, 10, .55)';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(x + 3, y + CELL * 0.36);
                    ctx.lineTo(x + CELL - 3, y + CELL * 0.36);
                    ctx.moveTo(x + 3, y + CELL * 0.68);
                    ctx.lineTo(x + CELL - 3, y + CELL * 0.68);
                    ctx.moveTo(x + CELL * 0.5, y + 3);
                    ctx.lineTo(x + CELL * 0.5, y + CELL * 0.36);
                    ctx.moveTo(x + CELL * 0.28, y + CELL * 0.36);
                    ctx.lineTo(x + CELL * 0.28, y + CELL * 0.68);
                    ctx.moveTo(x + CELL * 0.72, y + CELL * 0.36);
                    ctx.lineTo(x + CELL * 0.72, y + CELL * 0.68);
                    ctx.stroke();
                }
            }
        }
    }

    function drawExit() {
        if (!exitCell) return;
        const open = exitOpen;
        const x = OFFX + exitCell.c * CELL;
        const y = OFFY + exitCell.r * CELL;

        if (!open) return;
        ctx.save();
        const pulse = 0.6 + Math.sin(clock * 4) * 0.2;
        const g = ctx.createRadialGradient(x + CELL / 2, y + CELL / 2, 2, x + CELL / 2, y + CELL / 2, CELL * 0.95);
        g.addColorStop(0, 'rgba(130, 240, 180, ' + (0.42 * pulse).toFixed(2) + ')');
        g.addColorStop(1, 'rgba(130, 240, 180, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - CELL * 0.5, y - CELL * 0.5, CELL * 2, CELL * 2);

        ctx.fillStyle = '#14351f';
        roundRect(x + 4, y + 2, CELL - 8, CELL - 4, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140, 240, 180, .9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(150, 245, 190, .85)';
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2 - 3, 2.6, 0, TAU);
        ctx.fill();
        ctx.fillRect(x + CELL / 2 - 3.4, y + CELL / 2, 6.8, CELL * 0.3);
        ctx.restore();
    }

    function drawItems() {
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const x = OFFX + (it.c + 0.5) * CELL;
            const y = OFFY + (it.r + 0.5) * CELL;
            const bob = Math.sin(clock * 3.4 + i) * 1.6;
            const color = it.kind === 'power' ? '#ff9b52' : (it.kind === 'bomb' ? '#6fb8ff' : '#7ce0a8');
            ctx.save();
            ctx.translate(x, y + bob);
            ctx.fillStyle = 'rgba(0, 0, 0, .3)';
            roundRect(-8, -8, 16, 16, 4);
            ctx.fill();
            const g = ctx.createLinearGradient(0, -9, 0, 9);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(0, 0, 0, .3)');
            ctx.fillStyle = g;
            roundRect(-9, -9, 18, 18, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, .4)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = 'rgba(10, 18, 26, .8)';
            if (it.kind === 'power') {
                ctx.beginPath();
                ctx.moveTo(1, -5.5);
                ctx.lineTo(-3.4, 1);
                ctx.lineTo(-0.2, 1);
                ctx.lineTo(-1.2, 6);
                ctx.lineTo(3.6, -1.2);
                ctx.lineTo(0.4, -1.2);
                ctx.closePath();
                ctx.fill();
            } else if (it.kind === 'bomb') {
                ctx.beginPath();
                ctx.arc(0, 1, 4.2, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(10, 18, 26, .8)';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(2, -3);
                ctx.quadraticCurveTo(5, -6, 3, -7.5);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(-4, 2);
                ctx.lineTo(4, 2);
                ctx.lineTo(2.4, 5);
                ctx.lineTo(-2.4, 5);
                ctx.closePath();
                ctx.fill();
                ctx.fillRect(-4.6, -2, 9.2, 3.4);
            }
            ctx.restore();
        }
    }

    function drawBomb() {
        for (let i = 0; i < bombs.length; i++) {
            const b = bombs[i];
            const x = OFFX + (b.c + 0.5) * CELL;
            const y = OFFY + (b.r + 0.5) * CELL;
            const rate = 1 - b.timer / FUSE;
            const pulse = 1 + Math.sin(clock * (8 + rate * 22)) * (0.06 + rate * 0.14);
            const r = CELL * 0.35 * pulse;

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, .34)';
            ctx.beginPath();
            ctx.ellipse(x + 1.5, y + r * 0.85, r * 0.9, r * 0.34, 0, 0, TAU);
            ctx.fill();

            if (rate > 0.4) {
                const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.1);
                halo.addColorStop(0, 'rgba(255, 138, 96, ' + (0.24 * rate).toFixed(2) + ')');
                halo.addColorStop(1, 'rgba(255, 138, 96, 0)');
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(x, y, r * 2.1, 0, TAU);
                ctx.fill();
            }

            const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
            g.addColorStop(0, '#78838f');
            g.addColorStop(0.55, '#2b3440');
            g.addColorStop(1, '#0e141c');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(186, 212, 245, .38)';
            ctx.lineWidth = 1.3;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, .42)';
            ctx.beginPath();
            ctx.arc(x - r * 0.34, y - r * 0.38, r * 0.26, 0, TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 210, 120, .5)';
            ctx.beginPath();
            ctx.arc(x + r * 0.3, y + r * 0.34, r * 0.14, 0, TAU);
            ctx.fill();

            ctx.strokeStyle = '#8a6a42';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + r * 0.55, y - r * 0.75);
            ctx.quadraticCurveTo(x + r * 1.15, y - r * 1.45, x + r * 0.55, y - r * 1.8);
            ctx.stroke();

            if (rate > 0.55 && Math.floor(clock * 14) % 2 === 0) {
                ctx.fillStyle = '#ff6b4a';
            } else {
                ctx.fillStyle = '#ffd166';
            }
            ctx.beginPath();
            ctx.arc(x + r * 0.55, y - r * 1.85, 2.6, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawBlasts() {
        for (let i = 0; i < blasts.length; i++) {
            const b = blasts[i];
            const k = clamp(b.timer / b.max, 0, 1);
            const grow = 1 - Math.pow(1 - k, 0.45);
            const fade = Math.pow(k, 0.4);
            for (let j = 0; j < b.cells.length; j++) {
                const cell = b.cells[j];
                const x = OFFX + (cell.c + 0.5) * CELL;
                const y = OFFY + (cell.r + 0.5) * CELL;
                const size = CELL * (0.44 + grow * 0.4);

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(x, y, size * 0.08, x, y, size * 1.12);
                g.addColorStop(0, 'rgba(255, 248, 216, ' + (0.9 * fade).toFixed(2) + ')');
                g.addColorStop(0.22, 'rgba(255, 198, 92, ' + (0.86 * fade).toFixed(2) + ')');
                g.addColorStop(0.58, 'rgba(255, 118, 44, ' + (0.58 * fade).toFixed(2) + ')');
                g.addColorStop(1, 'rgba(235, 62, 24, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, size * 1.12, 0, TAU);
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 252, 236, ' + (0.5 * fade * k).toFixed(2) + ')';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.22, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        const p = entPos(player);
        const blink = invuln > 0 && Math.floor(clock * 12) % 2 === 0;
        ctx.save();
        if (blink) ctx.globalAlpha = 0.42;
        ctx.translate(p.x, p.y);

        ctx.fillStyle = 'rgba(0, 0, 0, .32)';
        ctx.beginPath();
        ctx.ellipse(1.5, CELL * 0.3, CELL * 0.3, CELL * 0.13, 0, 0, TAU);
        ctx.fill();

        // 身体
        ctx.fillStyle = '#e8f1ff';
        ctx.beginPath();
        ctx.ellipse(0, CELL * 0.12, CELL * 0.24, CELL * 0.2, 0, 0, TAU);
        ctx.fill();

        // 头盔
        const hg = ctx.createLinearGradient(0, -CELL * 0.36, 0, CELL * 0.1);
        hg.addColorStop(0, '#6ec2ff');
        hg.addColorStop(1, '#2f7fd0');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(0, -CELL * 0.06, CELL * 0.26, Math.PI, 0);
        ctx.lineTo(CELL * 0.26, CELL * 0.02);
        ctx.lineTo(-CELL * 0.26, CELL * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(12, 30, 50, .5)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // 眼睛
        const face = player.dir ? player.dir.x : 1;
        ctx.fillStyle = '#132433';
        ctx.beginPath();
        ctx.arc(-CELL * 0.08 + face * 1.4, -CELL * 0.02, 1.7, 0, TAU);
        ctx.arc(CELL * 0.08 + face * 1.4, -CELL * 0.02, 1.7, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawEnemies() {
        const colors = ['#c88bff', '#ff8da8', '#7fd8ff', '#ffc46e', '#9df0bd'];
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            const p = entPos(e);
            const bob = Math.sin(clock * 5 + e.wobble) * 1.4;
            const r = CELL * 0.3;
            const color = colors[e.hue % colors.length];

            ctx.save();
            ctx.translate(p.x, p.y + bob);
            ctx.fillStyle = 'rgba(0, 0, 0, .3)';
            ctx.beginPath();
            ctx.ellipse(1.5, r * 0.85 - bob, r * 0.9, r * 0.32, 0, 0, TAU);
            ctx.fill();

            const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.15, 0, 0, r);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(0, 0, 0, .38)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(12, 18, 30, .45)';
            ctx.lineWidth = 1.1;
            ctx.stroke();

            // 尖刺
            ctx.fillStyle = color;
            for (let k = 0; k < 5; k++) {
                const a = -Math.PI * 0.9 + k * (Math.PI * 0.45) + Math.sin(clock * 3 + k) * 0.05;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
                ctx.lineTo(Math.cos(a + 0.16) * r * 1.32, Math.sin(a + 0.16) * r * 1.32);
                ctx.lineTo(Math.cos(a + 0.32) * r * 0.9, Math.sin(a + 0.32) * r * 0.9);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = '#f9fbff';
            ctx.beginPath();
            ctx.arc(-r * 0.3, -r * 0.1, r * 0.26, 0, TAU);
            ctx.arc(r * 0.3, -r * 0.1, r * 0.26, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#1a2230';
            const look = e.dir ? e.dir.x * r * 0.1 : 0;
            ctx.beginPath();
            ctx.arc(-r * 0.3 + look, -r * 0.1, r * 0.13, 0, TAU);
            ctx.arc(r * 0.3 + look, -r * 0.1, r * 0.13, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawParticles() {
        ctx.save();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = t.color || 'rgba(236, 248, 255, .96)';
            ctx.font = '800 14px ' + FONT;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawTopBar() {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, OFFY);
        g.addColorStop(0, 'rgba(10, 16, 24, .98)');
        g.addColorStop(1, 'rgba(10, 16, 24, .74)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, OFFY);

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(160, 195, 220, .7)';
        ctx.fillText('得分', 14, OFFY / 2);
        ctx.font = '800 18px ' + FONT;
        ctx.fillStyle = '#ffe8b0';
        ctx.fillText(String(score), 46, OFFY / 2 + 1);

        ctx.textAlign = 'center';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = 'rgba(255, 128, 140, .95)';
        ctx.fillText(lives > 0 ? '♥ '.repeat(lives).trim() : '—', W / 2, OFFY / 2 - 7);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(160, 195, 220, .72)';
        ctx.fillText('火力 ' + player.power + ' · 炸弹 ' + player.maxBombs, W / 2, OFFY / 2 + 11);

        ctx.textAlign = 'right';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(160, 195, 220, .7)';
        ctx.fillText('第 ' + level + ' 关', W - 14, OFFY / 2);
        ctx.restore();
    }

    function drawBottomTip() {
        const y = OFFY + ROWS * CELL + 18;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT;
        if (exitOpen) {
            ctx.fillStyle = 'rgba(140, 240, 180, .9)';
            ctx.fillText('出口已开启，快去下一关', W / 2, y);
        } else {
            ctx.fillStyle = 'rgba(150, 175, 200, .48)';
            ctx.fillText('方向键移动 · 空格放炸弹 · 清光敌人后走进出口', W / 2, y);
        }
        ctx.restore();
    }

    function draw() {
        drawField();
        drawWalls();
        drawExit();
        drawItems();
        drawBomb();
        drawEnemies();
        if (state !== 'dying') drawPlayer();
        drawBlasts();
        drawParticles();
        drawTexts();
        drawTopBar();
        drawBottomTip();
    }

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

    buildMap();
    player = makePlayer();
    enemies = makeEnemies(3);
    updateHud();
    requestAnimationFrame(loop);
})();
