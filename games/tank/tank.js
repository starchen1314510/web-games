/* ==========================================================
   坦克大战
   ========================================================== */
(function () {
    'use strict';

    const TILE = 32;
    const COLS = 20;
    const ROWS = 15;
    const W = COLS * TILE;
    const H = ROWS * TILE;
    const TANK_SIZE = 28;
    const BULLET_SIZE = 6;
    const BULLET_SPEED = 260;
    const BEST_KEY = 'webgames.tank.best';

    /* 地图：# 砖墙  @ 钢墙  B 基地  . 空地 */
    const LEVEL_MAPS = [
        [
            '....................',
            '..#....#....#....#..',
            '..#....#....#....#..',
            '....................',
            '..##..##....##..##..',
            '..##..##....##..##..',
            '........@..@........',
            '........@..@........',
            '..##..##....##..##..',
            '..##..##....##..##..',
            '....................',
            '..#....#....#....#..',
            '..#....#.#..#....#..',
            '........#BB#........',
            '........#BB#........'
        ],
        [
            '....................',
            '..###..........###..',
            '..#..............#..',
            '..#..@@......@@..#..',
            '.....##......##.....',
            '.....##......##.....',
            '....................',
            '..####....##....####',
            '.......##....##.....',
            '..####....##....####',
            '....................',
            '..#....#....#....#..',
            '..#....#....#....#..',
            '........#BB#........',
            '........#BB#........'
        ],
        [
            '....................',
            '..@....#....#....@..',
            '..@....#....#....@..',
            '..@....#....#....@..',
            '..@....#....#....@..',
            '.......#....#.......',
            '..####.#....#.####..',
            '.......#....#.......',
            '..@....#....#....@..',
            '..@....#....#....@..',
            '..@....#....#....@..',
            '..@....#....#....@..',
            '.......#....#.......',
            '........#BB#........',
            '........#BB#........'
        ]
    ];

    const DIR_VEC = {
        up: [0, -1],
        down: [0, 1],
        left: [-1, 0],
        right: [1, 0]
    };
    const DIR_ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
    const DIRS = ['up', 'down', 'left', 'right'];

    const SPAWN_POINTS = [
        { c: 1, r: 1 },
        { c: 18, r: 1 },
        { c: 9, r: 1 }
    ];
    const PLAYER_START = { c: 6, r: 13 };

    const ENEMY_SKINS = [
        { color: '#ff5c6c', dark: '#8e2733' },
        { color: '#ff9f43', dark: '#8e5417' },
        { color: '#c07bff', dark: '#5c3388' },
        { color: '#5ad2ff', dark: '#1f6a88' }
    ];

    /* ---------- Canvas ---------- */
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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        level: document.getElementById('level'),
        lives: document.getElementById('lives'),
        enemies: document.getElementById('enemies'),
        best: document.getElementById('best'),
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
    let map = [];
    let baseCells = [];
    let baseRect = null;
    let baseDestroyed = false;
    let player = null;
    let enemies = [];
    let bullets = [];
    let explosions = [];

    let score = 0;
    let level = 1;
    let lives = 3;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let enemyQuota = 0;
    let spawnTimer = 0;
    let respawnTimer = 0;
    let state = 'ready';    // ready | playing | paused | over | clear
    let lastTime = 0;
    let timeAcc = 0;

    const pressedDirs = [];
    let shootHeld = false;

    /* ---------- 地图工具 ---------- */
    function loadMap(rows) {
        map = rows.map(function (row) { return row.split(''); });
        baseCells = [];
        let minC = COLS, minR = ROWS, maxC = -1, maxR = -1;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (map[r][c] === 'B') {
                    baseCells.push({ c: c, r: r });
                    minC = Math.min(minC, c);
                    minR = Math.min(minR, r);
                    maxC = Math.max(maxC, c);
                    maxR = Math.max(maxR, r);
                }
            }
        }

        baseRect = baseCells.length
            ? {
                x: minC * TILE,
                y: minR * TILE,
                w: (maxC - minC + 1) * TILE,
                h: (maxR - minR + 1) * TILE
            }
            : null;
        baseDestroyed = false;
    }

    function isSolidChar(ch) {
        return ch === '#' || ch === '@' || ch === 'B';
    }

    function areaBlocked(x, y, w, h) {
        const c1 = Math.floor(x / TILE);
        const c2 = Math.floor((x + w - 1) / TILE);
        const r1 = Math.floor(y / TILE);
        const r2 = Math.floor((y + h - 1) / TILE);

        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
                if (isSolidChar(map[r][c])) return true;
            }
        }
        return false;
    }

    function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    /* ---------- 坦克 ---------- */
    function makeTank(opts) {
        return {
            x: opts.x,
            y: opts.y,
            w: TANK_SIZE,
            h: TANK_SIZE,
            dir: opts.dir || 'up',
            speed: opts.speed,
            color: opts.color,
            dark: opts.dark,
            isPlayer: !!opts.isPlayer,
            cooldown: 0,
            fireDelay: opts.fireDelay,
            aiTimer: 0,
            fireTimer: 0.8 + Math.random(),
            invincible: 0,
            alive: true
        };
    }

    function makePlayer() {
        return makeTank({
            x: PLAYER_START.c * TILE + (TILE - TANK_SIZE) / 2,
            y: PLAYER_START.r * TILE + (TILE - TANK_SIZE) / 2,
            dir: 'up',
            speed: 96,
            color: '#43e39b',
            dark: '#146a49',
            isPlayer: true,
            fireDelay: 0.34
        });
    }

    function activeTanks() {
        const list = enemies.slice();
        if (player && player.alive) list.push(player);
        return list;
    }

    function tankBlockedByTank(self, x, y) {
        const list = activeTanks();
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (t === self) continue;
            if (rectsOverlap(x, y, TANK_SIZE, TANK_SIZE, t.x, t.y, t.w, t.h)) return true;
        }
        return false;
    }

    function moveTank(tank, dt) {
        const vec = DIR_VEC[tank.dir];
        const dist = tank.speed * dt;
        const steps = Math.max(1, Math.ceil(dist / 4));
        const stepX = vec[0] * dist / steps;
        const stepY = vec[1] * dist / steps;

        for (let i = 0; i < steps; i++) {
            const nx = tank.x + stepX;
            const ny = tank.y + stepY;
            if (areaBlocked(nx, ny, tank.w, tank.h) || tankBlockedByTank(tank, nx, ny)) {
                return false;
            }
            tank.x = nx;
            tank.y = ny;
        }
        return true;
    }

    function turnTank(tank, dir) {
        if (tank.dir === dir) return;
        const oldX = tank.x;
        const oldY = tank.y;
        tank.dir = dir;

        /* 转向时把另一条轴吸附到 8px 网格，避免卡在窄缝里 */
        if (dir === 'left' || dir === 'right') {
            tank.y = Math.round(tank.y / 8) * 8;
        } else {
            tank.x = Math.round(tank.x / 8) * 8;
        }

        if (areaBlocked(tank.x, tank.y, tank.w, tank.h) ||
            tankBlockedByTank(tank, tank.x, tank.y)) {
            tank.x = oldX;
            tank.y = oldY;
        }
    }

    /* ---------- 子弹 ---------- */
    function shoot(tank) {
        if (!tank.alive || tank.cooldown > 0) return;
        tank.cooldown = tank.fireDelay;

        const vec = DIR_VEC[tank.dir];
        const cx = tank.x + tank.w / 2 + vec[0] * 16;
        const cy = tank.y + tank.h / 2 + vec[1] * 16;

        bullets.push({
            x: cx - BULLET_SIZE / 2,
            y: cy - BULLET_SIZE / 2,
            w: BULLET_SIZE,
            h: BULLET_SIZE,
            vx: vec[0] * BULLET_SPEED,
            vy: vec[1] * BULLET_SPEED,
            owner: tank.isPlayer ? 'player' : 'enemy',
            color: tank.isPlayer ? '#c9ffe4' : '#ffd8b0',
            dead: false
        });
    }

    function explode(x, y, size) {
        explosions.push({ x: x, y: y, t: 0, life: 0.4, size: size || 16 });
    }

    function updateBullets(dt) {
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            const dist = BULLET_SPEED * dt;
            const steps = Math.max(1, Math.ceil(dist / 5));

            for (let s = 0; s < steps && !b.dead; s++) {
                b.x += b.vx * dt / steps;
                b.y += b.vy * dt / steps;
                checkBulletHit(b);
            }
        }
        bullets = bullets.filter(function (b) { return !b.dead; });
    }

    function checkBulletHit(b) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;

        if (cx < 0 || cx > W || cy < 0 || cy > H) {
            b.dead = true;
            explode(cx, cy, 8);
            return;
        }

        /* 命中坦克 */
        const targets = b.owner === 'player' ? enemies : (player.alive ? [player] : []);
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (!rectsOverlap(b.x, b.y, b.w, b.h, t.x, t.y, t.w, t.h)) continue;

            b.dead = true;
            if (t.isPlayer) {
                hitPlayer();
            } else {
                t.alive = false;
                explode(t.x + t.w / 2, t.y + t.h / 2, 20);
                score += 100;
                updateHud();
            }
            return;
        }

        /* 命中地图 */
        const c = Math.floor(cx / TILE);
        const r = Math.floor(cy / TILE);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
            b.dead = true;
            return;
        }

        const cell = map[r][c];
        if (cell === '#') {
            map[r][c] = '.';
            b.dead = true;
            explode(c * TILE + TILE / 2, r * TILE + TILE / 2, 12);
        } else if (cell === '@') {
            b.dead = true;
            explode(c * TILE + TILE / 2, r * TILE + TILE / 2, 10);
        } else if (cell === 'B') {
            b.dead = true;
            destroyBase();
        }
    }

    /* ---------- 敌人 AI ---------- */
    function spawnEnemy() {
        if (enemyQuota <= 0) return;

        const maxAlive = Math.min(3 + Math.floor((level - 1) / 2), 5);
        if (enemies.length >= maxAlive) return;

        const order = SPAWN_POINTS.slice().sort(function () { return Math.random() - 0.5; });
        for (let i = 0; i < order.length; i++) {
            const p = order[i];
            const x = p.c * TILE + (TILE - TANK_SIZE) / 2;
            const y = p.r * TILE + (TILE - TANK_SIZE) / 2;
            if (areaBlocked(x, y, TANK_SIZE, TANK_SIZE)) continue;
            if (tankBlockedByTank(null, x, y)) continue;

            const skin = ENEMY_SKINS[Math.floor(Math.random() * ENEMY_SKINS.length)];
            enemies.push(makeTank({
                x: x,
                y: y,
                dir: 'down',
                speed: 62 + level * 6,
                color: skin.color,
                dark: skin.dark,
                isPlayer: false,
                fireDelay: Math.max(0.55, 1.5 - level * 0.1)
            }));
            enemyQuota--;
            updateHud();
            return;
        }
    }

    function pickEnemyDir(tank) {
        /* 大概率朝基地/玩家靠近，小概率随机游走 */
        const target = (Math.random() < 0.72 && baseRect)
            ? { x: baseRect.x + baseRect.w / 2, y: baseRect.y + baseRect.h / 2 }
            : (player.alive ? { x: player.x, y: player.y } : null);

        if (target && Math.random() < 0.75) {
            const dx = target.x - (tank.x + tank.w / 2);
            const dy = target.y - (tank.y + tank.h / 2);
            if (Math.abs(dx) > Math.abs(dy)) {
                return dx > 0 ? 'right' : 'left';
            }
            return dy > 0 ? 'down' : 'up';
        }
        return DIRS[Math.floor(Math.random() * DIRS.length)];
    }

    function updateEnemies(dt) {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            e.cooldown = Math.max(0, e.cooldown - dt);
            e.aiTimer -= dt;

            if (e.aiTimer <= 0) {
                e.aiTimer = 0.6 + Math.random() * 1.1;
                turnTank(e, pickEnemyDir(e));
            }

            if (!moveTank(e, dt)) {
                e.aiTimer = 0;
                turnTank(e, DIRS[Math.floor(Math.random() * DIRS.length)]);
            }

            e.fireTimer -= dt;
            if (e.fireTimer <= 0) {
                shoot(e);
                e.fireTimer = 0.7 + Math.random() * 1.4;
            }
        }
    }

    /* ---------- 玩家 ---------- */
    function currentDir() {
        for (let i = pressedDirs.length - 1; i >= 0; i--) {
            if (pressedDirs[i]) return pressedDirs[i];
        }
        return null;
    }

    function pressDir(dir) {
        if (pressedDirs.indexOf(dir) === -1) pressedDirs.push(dir);
    }

    function releaseDir(dir) {
        const i = pressedDirs.indexOf(dir);
        if (i >= 0) pressedDirs.splice(i, 1);
    }

    function updatePlayer(dt) {
        if (!player.alive) {
            respawnTimer -= dt;
            if (respawnTimer <= 0) {
                player = makePlayer();
                player.invincible = 2.4;
            }
            return;
        }

        player.cooldown = Math.max(0, player.cooldown - dt);
        player.invincible = Math.max(0, player.invincible - dt);

        const dir = currentDir();
        if (dir) {
            turnTank(player, dir);
            moveTank(player, dt);
        }

        if (shootHeld) shoot(player);
    }

    function hitPlayer() {
        if (!player.alive || player.invincible > 0) return;

        player.alive = false;
        explode(player.x + player.w / 2, player.y + player.h / 2, 22);
        lives--;
        updateHud();

        if (lives <= 0) {
            endGame('所有坦克都被击毁了，基地失守只是时间问题。');
        } else {
            respawnTimer = 1.5;
        }
    }

    /* ---------- 关卡流程 ---------- */
    function destroyBase() {
        if (baseDestroyed) return;
        baseDestroyed = true;
        for (let i = 0; i < baseCells.length; i++) {
            const cell = baseCells[i];
            map[cell.r][cell.c] = 'X';
        }
        if (baseRect) {
            explode(baseRect.x + baseRect.w / 2, baseRect.y + baseRect.h / 2, 34);
        }
        endGame('基地被炮火摧毁了。');
    }

    function startLevel(index) {
        level = index + 1;
        loadMap(LEVEL_MAPS[index % LEVEL_MAPS.length]);
        enemies = [];
        bullets = [];
        explosions = [];
        player = makePlayer();
        player.invincible = 1.6;

        enemyQuota = 7 + level * 2;
        spawnTimer = 1.2;
        respawnTimer = 0;
        state = 'playing';
        pressedDirs.length = 0;
        shootHeld = false;

        updateHud();
        hideOverlay();
    }

    function levelClear() {
        state = 'clear';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        els.ovTitle.textContent = '关卡完成';
        els.ovTitle.className = 'overlay-title';
        els.ovDesc.textContent = '第 ' + level + ' 关的敌军已被全部消灭，准备迎接更强的对手。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = score;
        els.ovBtn.textContent = '进入第 ' + (level + 1) + ' 关';
        showOverlay();
    }

    function endGame(reason) {
        if (state === 'over') return;
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        els.ovTitle.textContent = '战斗失败';
        els.ovTitle.className = 'overlay-title danger';
        els.ovDesc.textContent = reason;
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = score;
        els.ovBtn.textContent = '重新开始';
        showOverlay();
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        pressedDirs.length = 0;
        shootHeld = false;
        els.ovTitle.textContent = '已暂停';
        els.ovTitle.className = 'overlay-title';
        els.ovDesc.textContent = '战场已冻结，按 P 或点击按钮继续战斗。';
        els.ovScore.hidden = true;
        els.ovBtn.textContent = '继续战斗';
        showOverlay();
    }

    function resume() {
        if (state !== 'paused') return;
        state = 'playing';
        lastTime = 0;
        hideOverlay();
    }

    function togglePause() {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
    }

    function showOverlay() { els.overlay.classList.add('show'); }
    function hideOverlay() { els.overlay.classList.remove('show'); }

    function updateHud() {
        els.score.textContent = score;
        els.level.textContent = level;
        els.lives.textContent = Math.max(0, lives);
        els.enemies.textContent = enemyQuota + enemies.length;
        els.best.textContent = best;
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        timeAcc += dt;
        updatePlayer(dt);
        updateEnemies(dt);
        updateBullets(dt);

        for (let i = explosions.length - 1; i >= 0; i--) {
            explosions[i].t += dt;
            if (explosions[i].t >= explosions[i].life) explosions.splice(i, 1);
        }

        enemies = enemies.filter(function (e) { return e.alive; });

        if (enemyQuota > 0) {
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnTimer = Math.max(0.9, 2.2 - level * 0.12);
                spawnEnemy();
            }
        }

        if (state === 'playing' && enemyQuota <= 0 && enemies.length === 0 &&
            bullets.filter(function (b) { return b.owner === 'enemy'; }).length === 0) {
            levelClear();
        }
    }

    /* ---------- 渲染 ---------- */
    function drawBrick(x, y) {
        ctx.fillStyle = '#6d2f20';
        ctx.fillRect(x, y, TILE, TILE);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                const bx = x + i * 16 + 1;
                const by = y + j * 16 + 1;
                ctx.fillStyle = '#c4633c';
                ctx.fillRect(bx, by, 14, 14);
                ctx.fillStyle = 'rgba(255, 255, 255, .16)';
                ctx.fillRect(bx, by, 14, 3);
                ctx.fillStyle = 'rgba(0, 0, 0, .22)';
                ctx.fillRect(bx, by + 11, 14, 3);
            }
        }
    }

    function drawSteel(x, y) {
        ctx.fillStyle = '#46536b';
        ctx.fillRect(x, y, TILE, TILE);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                const bx = x + i * 16 + 1;
                const by = y + j * 16 + 1;
                ctx.fillStyle = '#7d8ca6';
                ctx.fillRect(bx, by, 14, 14);
                ctx.fillStyle = 'rgba(255, 255, 255, .32)';
                ctx.fillRect(bx, by, 14, 4);
                ctx.fillStyle = 'rgba(0, 0, 0, .25)';
                ctx.fillRect(bx, by + 10, 14, 4);
            }
        }
    }

    function drawRubble(x, y) {
        ctx.fillStyle = '#2b303a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3d444f';
        for (let i = 0; i < 4; i++) {
            const bx = x + (i % 2) * 15 + 2;
            const by = y + Math.floor(i / 2) * 15 + 2;
            ctx.fillRect(bx, by, 11, 10);
        }
    }

    function drawBase() {
        if (!baseRect) return;
        const x = baseRect.x;
        const y = baseRect.y;
        const w = baseRect.w;
        const h = baseRect.h;
        const cx = x + w / 2;

        ctx.fillStyle = baseDestroyed ? '#242a33' : '#4a3c14';
        roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 6);
        ctx.fill();

        if (baseDestroyed) {
            ctx.fillStyle = '#5b6470';
            ctx.beginPath();
            ctx.moveTo(cx, y + 12);
            ctx.lineTo(x + w - 12, y + h - 12);
            ctx.lineTo(x + 12, y + h - 12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7a8492';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 10);
            ctx.lineTo(x + w - 10, y + h - 10);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#ffc548';
            ctx.beginPath();
            ctx.moveTo(cx, y + 12);
            ctx.lineTo(x + w - 12, y + h - 12);
            ctx.lineTo(x + 12, y + h - 12);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffe9a8';
            ctx.beginPath();
            ctx.moveTo(cx, y + 22);
            ctx.lineTo(cx + 9, y + h - 20);
            ctx.lineTo(cx - 9, y + h - 20);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(0, 0, 0, .35)';
            ctx.fillRect(x + 8, y + h - 10, w - 16, 4);
        }
    }

    function drawTank(t) {
        if (!t.alive) return;

        if (t.invincible > 0) {
            const blink = Math.sin(timeAcc * 24) > 0;
            if (!blink) return;
        }

        const cx = t.x + t.w / 2;
        const cy = t.y + t.h / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(DIR_ANGLE[t.dir]);

        /* 履带 */
        ctx.fillStyle = t.dark;
        roundRect(ctx, -14, -13, 8, 26, 3);
        ctx.fill();
        roundRect(ctx, 6, -13, 8, 26, 3);
        ctx.fill();

        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        for (let i = -10; i < 12; i += 6) {
            ctx.fillRect(-14, i, 8, 2);
            ctx.fillRect(6, i, 8, 2);
        }

        /* 车身 */
        ctx.fillStyle = t.color;
        roundRect(ctx, -8, -12, 16, 24, 4);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, .2)';
        roundRect(ctx, -6, -10, 12, 8, 2);
        ctx.fill();

        /* 炮塔 */
        ctx.fillStyle = t.dark;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        /* 炮管 */
        ctx.fillStyle = t.dark;
        roundRect(ctx, -2.5, -17, 5, 13, 2);
        ctx.fill();

        ctx.restore();
    }

    function drawBullets() {
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            const cx = b.x + b.w / 2;
            const cy = b.y + b.h / 2;

            ctx.save();
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(cx, cy, b.w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawExplosions() {
        for (let i = 0; i < explosions.length; i++) {
            const e = explosions[i];
            const p = e.t / e.life;
            const r = e.size * (0.4 + p * 0.9);

            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - p);
            ctx.fillStyle = '#ffb347';
            ctx.beginPath();
            ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#fff3c4';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(e.x, e.y, r * 1.25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0b1018';
        ctx.fillRect(0, 0, W, H);

        /* 背景网格 */
        ctx.strokeStyle = 'rgba(255, 255, 255, .022)';
        ctx.lineWidth = 1;
        for (let c = 1; c < COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * TILE + .5, 0);
            ctx.lineTo(c * TILE + .5, H);
            ctx.stroke();
        }
        for (let r = 1; r < ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * TILE + .5);
            ctx.lineTo(W, r * TILE + .5);
            ctx.stroke();
        }

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const ch = map[r] ? map[r][c] : '.';
                const x = c * TILE;
                const y = r * TILE;
                if (ch === '#') drawBrick(x, y);
                else if (ch === '@') drawSteel(x, y);
                else if (ch === 'X') drawRubble(x, y);
            }
        }

        drawBase();

        if (player) drawTank(player);
        for (let i = 0; i < enemies.length; i++) drawTank(enemies[i]);

        drawBullets();
        drawExplosions();
    }

    /* ---------- 主循环 ---------- */
    function loop(t) {
        if (!lastTime) lastTime = t;
        const dt = Math.min(0.05, (t - lastTime) / 1000);
        lastTime = t;

        if (state === 'playing') update(dt);
        else timeAcc += dt;

        render();
        requestAnimationFrame(loop);
    }

    /* ---------- 输入 ---------- */
    const KEY_DIR = {
        arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right'
    };

    document.addEventListener('keydown', function (e) {
        const key = e.key;
        const lower = key.toLowerCase();

        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(lower) !== -1) {
            e.preventDefault();
        }

        if (lower === 'p' || key === 'Escape') {
            togglePause();
            return;
        }

        if (state === 'ready' || state === 'over') {
            if (lower === 'enter' || lower === ' ') startGame();
            return;
        }

        if (state === 'clear') {
            if (lower === 'enter' || lower === ' ') nextLevel();
            return;
        }

        if (state !== 'playing') return;

        const dir = KEY_DIR[lower];
        if (dir) pressDir(dir);

        if (lower === ' ' || lower === 'j') {
            shootHeld = true;
            if (player.alive) shoot(player);
        }
    });

    document.addEventListener('keyup', function (e) {
        const lower = e.key.toLowerCase();
        const dir = KEY_DIR[lower];
        if (dir) releaseDir(dir);
        if (lower === ' ' || lower === 'j') shootHeld = false;
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') resume();
        else if (state === 'clear') nextLevel();
        else startGame();
    });

    els.pauseBtn.addEventListener('click', togglePause);

    /* 触屏方向键 */
    document.querySelectorAll('[data-dir]').forEach(function (btn) {
        const dir = btn.dataset.dir;

        function down(e) {
            e.preventDefault();
            pressDir(dir);
        }

        function up(e) {
            if (e) e.preventDefault();
            releaseDir(dir);
        }

        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
    });

    document.querySelectorAll('[data-fire]').forEach(function (btn) {
        function down(e) {
            e.preventDefault();
            shootHeld = true;
            if (state === 'playing' && player.alive) shoot(player);
        }

        function up(e) {
            if (e) e.preventDefault();
            shootHeld = false;
        }

        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
    });

    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }

    window.addEventListener('blur', function () {
        if (state === 'playing') pause();
    });

    /* ---------- 启动 ---------- */
    function startGame() {
        score = 0;
        lives = 3;
        startLevel(0);
        updateHud();
    }

    function nextLevel() {
        startLevel(level);
        updateHud();
    }

    loadMap(LEVEL_MAPS[0]);
    player = makePlayer();
    enemyQuota = 7 + 2;
    updateHud();
    render();
    requestAnimationFrame(loop);
})();
