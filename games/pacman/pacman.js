/* ==========================================================
   吃豆人 Pac-Man
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const COLS = 19;
    const ROWS = 21;
    const CELL = 22;
    const OFFX = (W - COLS * CELL) / 2;
    const OFFY = 44;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const BEST_KEY = 'webgames.pacman.best';

    const UP = { x: 0, y: -1 };
    const DOWN = { x: 0, y: 1 };
    const LEFT = { x: -1, y: 0 };
    const RIGHT = { x: 1, y: 0 };
    const DIRS = [UP, DOWN, LEFT, RIGHT];

    const GHOST_COLORS = ['#ff5f6d', '#ffb45f', '#5fd3ff', '#c98bff'];
    const GHOST_NAMES = ['阿红', '阿橙', '阿蓝', '阿紫'];
    const ENERGY_N = 4;

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

    /* ---------- 固定种子随机 ---------- */
    let seed = 20261107;

    function rnd() {
        seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        lives: document.getElementById('lives'),
        dots: document.getElementById('dots'),
        level: document.getElementById('level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let grid = [];
    let pac = null;
    let ghosts = [];
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let lives = 3;
    let level = 1;
    let dotsLeft = 0;
    let state = 'ready';
    let frightTimer = 0;
    let ghostEaten = 0;
    let deathTimer = 0;
    let clearTimer = 0;
    let clock = 0;
    let hudCache = '';
    let pendingDir = null;
    let particles = [];
    let texts = [];
    let startPhase = 0;

    /* ---------- 迷宫 ---------- */
    function wallAt(c, r) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
        return grid[r][c] === '#';
    }

    function canGo(c, r, d) {
        return !wallAt(c + d.x, r + d.y);
    }

    function buildMaze() {
        grid = [];
        for (let r = 0; r < ROWS; r++) {
            const row = [];
            for (let c = 0; c < COLS; c++) row.push('#');
            grid.push(row);
        }

        const startC = (COLS - 1) / 2;
        const startR = ROWS - 2;
        const stack = [[startC, startR]];
        grid[startR][startC] = ' ';

        while (stack.length) {
            const top = stack[stack.length - 1];
            const c = top[0];
            const r = top[1];
            const cand = [];
            for (let i = 0; i < DIRS.length; i++) {
                const d = DIRS[i];
                const nc = c + d.x * 2;
                const nr = r + d.y * 2;
                if (nc > 0 && nc < COLS - 1 && nr > 0 && nr < ROWS - 1 &&
                    grid[nr][nc] === '#') {
                    cand.push([nc, nr, c + d.x, r + d.y]);
                }
            }
            if (!cand.length) {
                stack.pop();
                continue;
            }
            const pick = cand[Math.floor(rnd() * cand.length)];
            grid[pick[3]][pick[2]] = ' ';
            grid[pick[1]][pick[0]] = ' ';
            stack.push([pick[0], pick[1]]);
        }

        // 打通部分隔断，形成环路，方便吃豆人绕圈
        for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLS - 1; c++) {
                if (grid[r][c] !== '#') continue;
                const oddC = c % 2 === 1;
                const oddR = r % 2 === 1;
                if (oddC === oddR) continue;
                if (rnd() > 0.18) continue;
                if (oddC) {
                    if (grid[r - 1][c] === ' ' && grid[r + 1][c] === ' ') grid[r][c] = ' ';
                } else if (grid[r][c - 1] === ' ' && grid[r][c + 1] === ' ') {
                    grid[r][c] = ' ';
                }
            }
        }

        // 起点上方开一条纵向通道，方便起步
        const homeC = Math.round((COLS - 1) / 2);
        const homeR = ROWS - 2;
        for (let k = 1; k <= 4; k++) {
            const rr = homeR - k;
            if (rr > 0) grid[rr][homeC] = ' ';
        }
    }

    function placeDots() {
        const home = { c: Math.round(pac ? pac.c : (COLS - 1) / 2), r: ROWS - 2 };
        const spots = [];
        for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLS - 1; c++) {
                if (grid[r][c] !== ' ') continue;
                grid[r][c] = '.';
                spots.push([c, r]);
            }
        }
        // 起点格不放豆
        for (let i = 0; i < ghosts.length; i++) {
            if (grid[ghosts[i].r][ghosts[i].c] === '.') {
                grid[ghosts[i].r][ghosts[i].c] = ' ';
            }
        }
        if (grid[home.r][home.c] === '.') grid[home.r][home.c] = ' ';

        const far = spots.filter(function (p) {
            return Math.abs(p[0] - home.c) + Math.abs(p[1] - home.r) >= 8;
        });
        const pool = far.length >= ENERGY_N ? far : spots;
        let placed = 0;
        let guard = 0;
        while (placed < ENERGY_N && guard < 500) {
            guard += 1;
            const p = pool[Math.floor(rnd() * pool.length)];
            if (grid[p[1]][p[0]] !== '.') continue;
            grid[p[1]][p[0]] = 'o';
            placed += 1;
        }

        dotsLeft = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === '.' || grid[r][c] === 'o') dotsLeft += 1;
            }
        }
    }

    /* ---------- 实体 ---------- */
    function makePac() {
        const c = Math.round((COLS - 1) / 2);
        const r = ROWS - 2;
        return {
            c: c, r: r, fc: c, fr: r, t: 0,
            dir: null, speed: 8.4, mouth: 0, dead: false
        };
    }

    function makeGhosts() {
        const c0 = Math.round((COLS - 1) / 2);
        const seeds = [
            { c: 1, r: 1 },
            { c: COLS - 2, r: 1 },
            { c: c0, r: 1 },
            { c: 1, r: ROWS - 2 }
        ];
        return seeds.map(function (s, i) {
            return {
                c: s.c, r: s.r, fc: s.c, fr: s.r, t: 0,
                dir: null, speed: 7.1, color: GHOST_COLORS[i],
                name: GHOST_NAMES[i], scatter: 0
            };
        });
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

    function isOpposite(a, b) {
        return a && b && a.x === -b.x && a.y === -b.y;
    }

    /* ---------- 移动 ---------- */
    function advance(e, dt, speed, onArrive) {
        if (e.t === 0) {
            if (!e.dir || !canGo(e.c, e.r, e.dir)) return;
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

    function reverseIfNeeded(e, want) {
        if (!want || e.t === 0) return;
        if (!isOpposite(want, e.dir)) return;
        const tc = e.c;
        const tr = e.r;
        e.c = e.fc;
        e.r = e.fr;
        e.fc = tc;
        e.fr = tr;
        e.t = 1 - e.t;
        e.dir = want;
    }

    function choosePacDir() {
        if (pendingDir && canGo(pac.c, pac.r, pendingDir)) {
            pac.dir = pendingDir;
            pendingDir = null;
            return;
        }
        if (pac.dir && !canGo(pac.c, pac.r, pac.dir)) pac.dir = null;
    }

    function chooseGhostDir(g) {
        const back = g.dir ? { x: -g.dir.x, y: -g.dir.y } : null;
        const options = [];
        for (let i = 0; i < DIRS.length; i++) {
            const d = DIRS[i];
            if (isOpposite(d, back)) continue;
            if (!canGo(g.c, g.r, d)) continue;
            options.push(d);
        }
        if (!options.length) {
            if (back && canGo(g.c, g.r, back)) {
                g.dir = back;
            } else {
                g.dir = null;
            }
            return;
        }
        const target = entPos(pac);
        const tp = tileOfPoint(target.x, target.y);
        let pick = options[0];
        let pickScore = null;
        for (let i = 0; i < options.length; i++) {
            const d = options[i];
            const nc = g.c + d.x;
            const nr = g.r + d.y;
            let dist = Math.abs(nc - tp.c) + Math.abs(nr - tp.r);
            if (g.scatter > 0) dist = -dist;
            if (frightTimer > 0) dist = -dist;
            if (pickScore === null || dist < pickScore) {
                pickScore = dist;
                pick = d;
            }
        }
        g.dir = pick;
    }

    /* ---------- 粒子与文字 ---------- */
    function burst(x, y, color, n, spread) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const sp = 30 + Math.random() * (spread || 110);
            particles.push({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0.35 + Math.random() * 0.45,
                max: 0.8,
                r: 1.2 + Math.random() * 2,
                color: color
            });
        }
    }

    function floatText(x, y, text, color) {
        texts.push({ x: x, y: y, text: text, color: color, life: 0.85, max: 0.85 });
    }

    /* ---------- 游戏流程 ---------- */
    function startLevel(reset) {
        buildMaze();
        pac = makePac();
        ghosts = makeGhosts();
        placeDots();
        frightTimer = 0;
        ghostEaten = 0;
        particles = [];
        texts = [];
        pendingDir = null;
        startPhase = 1.6;
        state = 'playing';
        hudCache = '';
        hideOverlay();
        updateHud();
    }

    function startGame() {
        seed = 20261107 + Math.floor(Math.random() * 100000);
        score = 0;
        lives = 3;
        level = 1;
        deathTimer = 0;
        clearTimer = 0;
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
        els.ovTitle.textContent = '被吃光了';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '这一局你拿到 ' + score + ' 分，闯到第 ' + level + ' 关。';
        els.ovScore.innerHTML = '最高分 <b>' + best + '</b>';
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    function levelClear() {
        state = 'clear';
        clearTimer = 1.5;
        score += 300;
        const p = entPos(pac);
        floatText(p.x, p.y - 26, '过关！', '#8fe3ff');
        updateHud();
    }

    function loseLife() {
        state = 'dying';
        deathTimer = 1.5;
        lives -= 1;
        const p = entPos(pac);
        burst(p.x, p.y, '#ffd166', 18, 140);
        updateHud();
    }

    function checkDotPickup() {
        const p = entPos(pac);
        const tp = tileOfPoint(p.x, p.y);
        const ch = grid[tp.r][tp.c];
        if (ch !== '.' && ch !== 'o') return;
        grid[tp.r][tp.c] = ' ';
        dotsLeft -= 1;
        if (ch === '.') {
            score += 10;
        } else {
            score += 50;
            frightTimer = 7.5;
            ghostEaten = 0;
            for (let i = 0; i < ghosts.length; i++) {
                ghosts[i].scatter = 0;
                if (ghosts[i].dir) {
                    ghosts[i].dir = { x: -ghosts[i].dir.x, y: -ghosts[i].dir.y };
                }
            }
        }
        burst(p.x, p.y, ch === 'o' ? '#ffe08a' : '#ffd166', ch === 'o' ? 12 : 4, 70);
        updateHud();
        if (dotsLeft <= 0) levelClear();
    }

    function checkGhostHit() {
        const p = entPos(pac);
        for (let i = 0; i < ghosts.length; i++) {
            const g = ghosts[i];
            const gp = entPos(g);
            const dx = gp.x - p.x;
            const dy = gp.y - p.y;
            if (dx * dx + dy * dy > CELL * CELL * 0.62 * 0.62) continue;
            if (frightTimer > 0) {
                ghostEaten += 1;
                const gain = 200 * Math.pow(2, Math.min(ghostEaten - 1, 3));
                score += gain;
                floatText(gp.x, gp.y - 20, '+' + gain, '#8fd3ff');
                burst(gp.x, gp.y, g.color, 14, 130);
                g.c = g.fc = 1;
                g.r = g.fr = 1;
                g.t = 0;
                g.dir = null;
                updateHud();
            } else {
                loseLife();
                return;
            }
        }
    }

    function updateHud() {
        const key = score + '|' + lives + '|' + dotsLeft + '|' + level + '|' + state;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.lives.textContent = lives > 0 ? '♥'.repeat(lives) : '—';
        els.dots.textContent = String(dotsLeft);
        els.level.textContent = String(level);
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 24 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }

        if (state === 'ready' || state === 'over') return;

        if (state === 'clear') {
            clearTimer -= dt;
            if (clearTimer <= 0) {
                level += 1;
                startLevel(false);
            }
            return;
        }

        if (state === 'dying') {
            deathTimer -= dt;
            pac.mouth += dt * 14;
            if (deathTimer <= 0) {
                if (lives <= 0) {
                    gameOver();
                } else {
                    const keep = level;
                    startLevel(false);
                    level = keep;
                    updateHud();
                }
            }
            return;
        }

        if (frightTimer > 0) frightTimer -= dt;

        pac.mouth += dt * (frightTimer > 0 ? 13 : 9);

        // 开局 READY 定格
        if (startPhase > 0) {
            startPhase -= dt;
            return;
        }

        if (pac.t === 0) choosePacDir();
        reverseIfNeeded(pac, pendingDir);
        advance(pac, dt, pac.speed, checkDotPickup);
        if (state !== 'playing') return;

        checkDotPickup();
        if (state !== 'playing') return;

        const gSpeed = ghostSpeed();
        for (let i = 0; i < ghosts.length; i++) {
            const g = ghosts[i];
            if (g.t === 0) chooseGhostDir(g);
            advance(g, dt, gSpeed, null);
        }

        checkGhostHit();
    }

    function ghostSpeed() {
        const base = 6.9 + (level - 1) * 0.28;
        return frightTimer > 0 ? base * 0.58 : base;
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawField() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070b16');
        g.addColorStop(0.5, '#080d1c');
        g.addColorStop(1, '#0a1224');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    function drawWalls() {
        const used = [];
        for (let r = 0; r < ROWS; r++) used.push(new Array(COLS).fill(false));

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] !== '#' || used[r][c]) continue;

                let w = 1;
                while (c + w < COLS && grid[r][c + w] === '#' && !used[r][c + w]) w += 1;

                let h = 1;
                let grow = true;
                while (r + h < ROWS && grow) {
                    for (let i = 0; i < w; i++) {
                        if (grid[r + h][c + i] !== '#' || used[r + h][c + i]) {
                            grow = false;
                            break;
                        }
                    }
                    if (grow) h += 1;
                }

                for (let rr = 0; rr < h; rr++) {
                    for (let cc = 0; cc < w; cc++) used[r + rr][c + cc] = true;
                }

                const x = OFFX + c * CELL;
                const y = OFFY + r * CELL;
                const bw = w * CELL;
                const bh = h * CELL;

                const g = ctx.createLinearGradient(x, y, x, y + bh);
                g.addColorStop(0, '#25478a');
                g.addColorStop(0.55, '#1a3266');
                g.addColorStop(1, '#11224a');
                ctx.fillStyle = g;
                roundRect(x, y, bw, bh, 5);
                ctx.fill();

                ctx.strokeStyle = 'rgba(112, 166, 255, .26)';
                ctx.lineWidth = 1;
                roundRect(x + 0.5, y + 0.5, bw - 1, bh - 1, 5);
                ctx.stroke();

                ctx.fillStyle = 'rgba(160, 205, 255, .14)';
                roundRect(x + 2, y + 2, bw - 4, 2.5, 1.2);
                ctx.fill();
            }
        }
    }

    function drawDots() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const ch = grid[r][c];
                if (ch !== '.' && ch !== 'o') continue;
                const x = OFFX + (c + 0.5) * CELL;
                const y = OFFY + (r + 0.5) * CELL;
                if (ch === '.') {
                    ctx.fillStyle = 'rgba(255, 232, 176, .88)';
                    ctx.beginPath();
                    ctx.arc(x, y, 1.9, 0, TAU);
                    ctx.fill();
                } else {
                    const pulse = 1 + Math.sin(clock * 6) * 0.18;
                    ctx.fillStyle = 'rgba(255, 232, 176, .18)';
                    ctx.beginPath();
                    ctx.arc(x, y, 7.4 * pulse, 0, TAU);
                    ctx.fill();
                    ctx.fillStyle = '#ffe8b0';
                    ctx.beginPath();
                    ctx.arc(x, y, 4.4 * pulse, 0, TAU);
                    ctx.fill();
                }
            }
        }
    }

    function drawPac() {
        const p = entPos(pac);
        const dying = state === 'dying';
        const ang = pac.dir ? Math.atan2(pac.dir.y, pac.dir.x) : 0;
        const openBase = dying ? 0.04 : 0.09;
        const open = openBase + Math.abs(Math.sin(pac.mouth)) * (dying ? 0.9 : 0.34);
        const rad = CELL * 0.45;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        ctx.beginPath();
        ctx.arc(1.5, 2.5, rad * 0.96, 0, TAU);
        ctx.fill();

        const g = ctx.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.15, 0, 0, rad);
        g.addColorStop(0, '#ffe888');
        g.addColorStop(0.7, '#ffd341');
        g.addColorStop(1, '#f0b31d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, ang + open, ang + TAU - open);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 78, 0, .35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
    }

    function drawGhost(g) {
        const p = entPos(g);
        const rad = CELL * 0.43;
        const fright = frightTimer > 0;
        const blink = fright && frightTimer < 2.2 && Math.floor(clock * 8) % 2 === 0;
        const body = fright ? (blink ? '#e8f2ff' : '#2f52c4') : g.color;

        ctx.save();
        ctx.translate(p.x, p.y);

        ctx.fillStyle = 'rgba(0, 0, 0, .28)';
        ctx.beginPath();
        ctx.ellipse(1.5, rad * 0.92, rad * 0.92, rad * 0.3, 0, 0, TAU);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, -rad * 0.14, rad, Math.PI, 0);
        ctx.lineTo(rad, rad * 0.78);
        const feet = 4;
        const step = (rad * 2) / feet;
        const wobble = Math.sin(clock * 9 + g.c) * 0.14;
        for (let i = feet - 1; i >= 0; i--) {
            const x0 = -rad + step * i;
            const x1 = x0 + step * 0.5;
            const x2 = x0 + step;
            ctx.quadraticCurveTo(x1, rad * (0.78 + wobble), x2, rad * 0.78);
        }
        ctx.closePath();
        const gg = ctx.createLinearGradient(0, -rad, 0, rad);
        gg.addColorStop(0, body);
        gg.addColorStop(1, 'rgba(0, 0, 0, .34)');
        ctx.fillStyle = fright ? body : gg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(10, 16, 30, .5)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        if (fright) {
            ctx.fillStyle = blink ? '#2f52c4' : '#eaf3ff';
            ctx.beginPath();
            ctx.arc(-rad * 0.34, -rad * 0.22, rad * 0.19, 0, TAU);
            ctx.arc(rad * 0.34, -rad * 0.22, rad * 0.19, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = blink ? '#2f52c4' : '#eaf3ff';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let k = 0; k < 4; k++) {
                const x0 = -rad * 0.44 + k * rad * 0.29;
                ctx.moveTo(x0, rad * 0.3);
                ctx.lineTo(x0 + rad * 0.15, rad * 0.12);
                ctx.lineTo(x0 + rad * 0.29, rad * 0.3);
            }
            ctx.stroke();
        } else {
            const target = entPos(pac);
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const dl = Math.sqrt(dx * dx + dy * dy) || 1;
            const lx = (dx / dl) * rad * 0.22;
            const ly = (dy / dl) * rad * 0.22;
            ctx.fillStyle = '#f7fbff';
            ctx.beginPath();
            ctx.ellipse(-rad * 0.36, -rad * 0.2, rad * 0.29, rad * 0.34, 0, 0, TAU);
            ctx.ellipse(rad * 0.36, -rad * 0.2, rad * 0.29, rad * 0.34, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#16203a';
            ctx.beginPath();
            ctx.arc(-rad * 0.36 + lx, -rad * 0.2 + ly, rad * 0.145, 0, TAU);
            ctx.arc(rad * 0.36 + lx, -rad * 0.2 + ly, rad * 0.145, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
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
            ctx.fillStyle = t.color || 'rgba(232, 250, 238, .96)';
            ctx.font = '800 16px ' + FONT;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawTopBar() {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, OFFY);
        g.addColorStop(0, 'rgba(8, 14, 26, .98)');
        g.addColorStop(1, 'rgba(8, 14, 26, .74)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, OFFY);

        ctx.textBaseline = 'middle';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(150, 190, 245, .7)';
        ctx.textAlign = 'left';
        ctx.fillText('得分', 14, OFFY / 2);
        ctx.font = '800 18px ' + FONT;
        ctx.fillStyle = '#ffe8b0';
        ctx.fillText(String(score), 46, OFFY / 2 + 1);

        ctx.textAlign = 'center';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = 'rgba(255, 122, 138, .95)';
        ctx.fillText(lives > 0 ? '♥ '.repeat(lives).trim() : '—', W / 2, OFFY / 2);

        ctx.textAlign = 'right';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(150, 190, 245, .7)';
        ctx.fillText('第 ' + level + ' 关', W - 14, OFFY / 2);
        ctx.restore();
    }

    function drawBottomTip() {
        const y = OFFY + ROWS * CELL + 16;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = 'rgba(140, 170, 210, .5)';
        ctx.fillText('方向键 / WASD 移动 · 吃光豆子过关', W / 2, y);

        if (frightTimer > 0) {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(140, 220, 255, .9)';
            ctx.fillText('能量模式 ' + frightTimer.toFixed(1) + 's', W / 2, y + 20);
        }
        ctx.restore();
    }

    function drawStartHint() {
        if (startPhase <= 0 || state !== 'playing') return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = clamp(startPhase / 1.6, 0, 1);
        ctx.fillStyle = 'rgba(255, 232, 176, .95)';
        ctx.font = '800 26px ' + FONT;
        ctx.fillText('READY!', W / 2, OFFY + ROWS * CELL / 2);
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function draw() {
        drawField();
        drawWalls();
        drawDots();
        for (let i = 0; i < ghosts.length; i++) drawGhost(ghosts[i]);
        if (state !== 'dying' || deathTimer > 0.6) drawPac();
        drawParticles();
        drawTexts();
        drawTopBar();
        drawBottomTip();
        drawStartHint();
    }

    /* ---------- 输入 ---------- */
    function setDir(d) {
        if (state !== 'playing') return;
        pendingDir = d;
        reverseIfNeeded(pac, d);
    }

    const KEYMAP = {
        ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
        w: UP, s: DOWN, a: LEFT, d: RIGHT,
        W: UP, S: DOWN, A: LEFT, D: RIGHT
    };

    window.addEventListener('keydown', function (e) {
        const d = KEYMAP[e.key];
        if (!d) return;
        e.preventDefault();
        setDir(d);
    });

    let swipeFrom = null;

    canvas.addEventListener('pointerdown', function (e) {
        swipeFrom = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', function (e) {
        if (!swipeFrom) return;
        const dx = e.clientX - swipeFrom.x;
        const dy = e.clientY - swipeFrom.y;
        swipeFrom = null;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
        if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? RIGHT : LEFT);
        else setDir(dy > 0 ? DOWN : UP);
    });

    canvas.addEventListener('pointercancel', function () {
        swipeFrom = null;
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

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

    // 初始展示：先生成地图，等开始
    buildMaze();
    pac = makePac();
    ghosts = makeGhosts();
    placeDots();
    updateHud();
    requestAnimationFrame(loop);
})();
