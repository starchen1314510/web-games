/* ==========================================================
   像素跳跃 Pixel Hop
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const GRAV = 1900;
    const JUMP = -620;
    const RUN = 232;
    const ACC = 1900;
    const FRIC = 1500;
    const MAX_FALL = 940;
    const BEST_KEY = 'webgames.platformer.best';
    const BAR = 56;

    const GROUND = 520;

    const LEVELS = [
        {
            w: 1900,
            spawn: [50, 470],
            plats: [
                /* 地面：中间留出深坑 */
                [0, 520, 400, 80], [460, 520, 240, 80], [760, 520, 280, 80],
                [1100, 520, 320, 80], [1480, 520, 420, 80],
                /* 浮岛 */
                [190, 444, 104, 22], [320, 372, 96, 22], [440, 448, 104, 22],
                [560, 380, 100, 22], [660, 312, 92, 22], [772, 440, 100, 22],
                [880, 372, 96, 22], [990, 444, 92, 22], [1120, 376, 100, 22],
                [1230, 308, 92, 22], [1330, 444, 96, 22], [1520, 380, 100, 22],
                [1640, 312, 92, 22], [1740, 444, 104, 22]
            ],
            coins: [
                [140, 494], [170, 494], [220, 418], [252, 418],
                [348, 346], [376, 346], [430, 436], [470, 422],
                [500, 422], [590, 354], [618, 354], [688, 286],
                [714, 286], [730, 430], [800, 414], [828, 414],
                [906, 346], [934, 346], [1016, 418], [1070, 430],
                [1148, 350], [1176, 350], [1256, 282], [1358, 418],
                [1386, 418], [1450, 430], [1548, 354], [1576, 354],
                [1666, 286], [1692, 286], [1768, 418], [1792, 418]
            ],
            foes: [
                [600, 500, 470, 700], [1200, 500, 1100, 1420],
                [1700, 500, 1480, 1900]
            ],
            flag: 1846
        },
        {
            w: 2150,
            spawn: [46, 470],
            plats: [
                [0, 520, 340, 80], [400, 520, 200, 80], [660, 520, 240, 80],
                [980, 520, 260, 80], [1320, 520, 200, 80], [1600, 520, 550, 80],
                [140, 440, 100, 22], [270, 368, 92, 22], [400, 296, 88, 22],
                [420, 448, 104, 22], [530, 380, 96, 22], [640, 308, 92, 22],
                [700, 440, 104, 22], [810, 372, 96, 22], [900, 300, 92, 22],
                [1000, 444, 100, 22], [1110, 376, 96, 22], [1220, 308, 88, 22],
                [1330, 444, 100, 22], [1440, 372, 96, 22], [1550, 300, 92, 22],
                [1660, 440, 104, 22], [1790, 372, 96, 22], [1900, 444, 100, 22]
            ],
            coins: [
                [100, 494], [170, 414], [200, 414], [298, 342],
                [326, 342], [360, 420], [428, 270], [450, 422],
                [480, 422], [558, 354], [586, 354], [668, 282],
                [694, 282], [728, 414], [756, 414], [838, 346],
                [866, 346], [920, 430], [928, 274], [1028, 418],
                [1056, 418], [1138, 350], [1166, 350], [1248, 282],
                [1270, 430], [1358, 418], [1386, 418], [1468, 346],
                [1496, 346], [1578, 274], [1604, 274], [1688, 414],
                [1716, 414], [1818, 346], [1846, 346], [1928, 418],
                [1952, 418], [2036, 430]
            ],
            foes: [
                [780, 500, 690, 900], [1080, 500, 1000, 1220],
                [1380, 500, 1340, 1500], [1750, 500, 1620, 2130],
                [1030, 424, 1002, 1088]
            ],
            flag: 2096
        },
        {
            w: 2400,
            spawn: [44, 470],
            plats: [
                [0, 520, 320, 80], [390, 520, 220, 80], [680, 520, 200, 80],
                [950, 520, 200, 80], [1220, 520, 190, 80], [1480, 520, 210, 80],
                [1760, 520, 640, 80],
                [120, 444, 96, 22], [240, 372, 88, 22], [330, 300, 84, 22],
                [400, 448, 96, 22], [500, 376, 92, 22], [600, 304, 88, 22],
                [650, 444, 96, 22], [740, 372, 92, 22], [820, 300, 88, 22],
                [890, 444, 96, 22], [980, 372, 92, 22], [1120, 444, 100, 22],
                [1210, 368, 92, 22], [1290, 296, 88, 22], [1360, 440, 96, 22],
                [1450, 364, 92, 22], [1580, 440, 96, 22], [1670, 364, 96, 22],
                [1760, 296, 92, 22], [1850, 440, 104, 22], [1970, 368, 100, 22],
                [2100, 440, 104, 22], [2230, 368, 96, 22]
            ],
            coins: [
                [120, 494], [168, 418], [196, 418], [268, 346],
                [292, 346], [352, 274], [360, 420], [428, 422],
                [456, 422], [528, 350], [554, 350], [628, 278],
                [678, 418], [706, 418], [768, 346], [794, 346],
                [848, 274], [918, 418], [944, 418], [1008, 346],
                [1034, 346], [1070, 430], [1148, 418], [1176, 418],
                [1238, 342], [1264, 342], [1318, 270], [1388, 414],
                [1414, 414], [1478, 338], [1504, 338], [1540, 430],
                [1608, 414], [1636, 414], [1698, 338], [1724, 338],
                [1788, 270], [1878, 414], [1906, 414], [1998, 342],
                [2024, 342], [2128, 414], [2156, 414], [2258, 342],
                [2284, 342]
            ],
            foes: [
                [480, 500, 396, 610], [1030, 500, 956, 1150],
                [1560, 500, 1486, 1690], [2100, 500, 1766, 2390],
                [938, 424, 892, 984]
            ],
            flag: 2346
        }
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

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function fmt(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        score: document.getElementById('score'),
        stage: document.getElementById('stage-no'),
        coins: document.getElementById('coins'),
        lives: document.getElementById('lives'),
        time: document.getElementById('time'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';           // ready | playing | clear | over | win
    let stage = 0;
    let elapsed = 0;
    let score = 0;
    let coins = 0;
    let lives = 3;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let bestStage = Number(localStorage.getItem(BEST_KEY + '.stage') || 0);

    const player = {
        x: 50, y: 470, w: 18, h: 24,
        vx: 0, vy: 0,
        onGround: false,
        face: 1,
        anim: 0,
        inv: 0,
        coyote: 0
    };

    let level = LEVELS[0];
    let cam = 0;
    let solids = [];
    let deco = [];
    let items = [];
    let foes = [];
    let fx = [];
    let stars = [];
    let toast = 0;
    let toastText = '';
    let hudCache = '';
    let shownSec = -1;
    let clearT = 0;

    /* ---------- 关卡 ---------- */

    function buildStars() {
        stars = [];
        for (let i = 0; i < 70; i++) {
            stars.push({
                x: Math.random() * 2400,
                y: Math.random() * 420,
                r: 0.6 + Math.random() * 1.2,
                a: 0.15 + Math.random() * 0.4,
                p: 0.2 + Math.random() * 0.5
            });
        }
    }

    function loadLevel(i, keepStats) {
        stage = i;
        level = LEVELS[i];
        solids = level.plats.map(function (p) {
            return { x: p[0], y: p[1], w: p[2], h: p[3] };
        });
        items = level.coins.map(function (c) {
            return { x: c[0], y: c[1], taken: false, t: Math.random() * TAU };
        });
        foes = level.foes.map(function (f) {
            return {
                x: f[0], y: f[1], w: 22, h: 20,
                min: f[2], max: f[3],
                dir: Math.random() < 0.5 ? -1 : 1,
                sp: 46 + Math.random() * 26,
                dead: 0
            };
        });
        fx = [];
        buildDeco();
        player.x = level.spawn[0];
        player.y = level.spawn[1];
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.inv = 1;
        player.face = 1;
        cam = 0;
        toast = 1.5;
        toastText = '第 ' + (i + 1) + ' 关';
        if (!keepStats) {
            score = 0;
            coins = 0;
            lives = 3;
            elapsed = 0;
        }
        hudCache = '';
        shownSec = -1;
        updateHud();
    }

    function begin() {
        buildStars();
        state = 'playing';
        loadLevel(0, false);
        els.overlay.classList.remove('show');
    }

    /* ---------- 物理 ---------- */

    function overlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function moveAxis(dx, dy) {
        player.x += dx;
        for (let i = 0; i < solids.length; i++) {
            const s = solids[i];
            if (!overlap(player, s)) continue;
            if (dx > 0) player.x = s.x - player.w;
            else if (dx < 0) player.x = s.x + s.w;
            player.vx = 0;
        }
        player.y += dy;
        for (let i = 0; i < solids.length; i++) {
            const s = solids[i];
            if (!overlap(player, s)) continue;
            if (dy > 0) {
                player.y = s.y - player.h;
                player.vy = 0;
                player.onGround = true;
            } else if (dy < 0) {
                player.y = s.y + s.h;
                player.vy = 0;
            }
        }
    }

    function respawn() {
        player.x = level.spawn[0];
        player.y = level.spawn[1];
        player.vx = 0;
        player.vy = 0;
        player.inv = 1.4;
        player.onGround = false;
        cam = clamp(player.x - W * 0.42, 0, level.w - W);
    }

    function hurt() {
        if (player.inv > 0) return;
        lives--;
        hudCache = '';
        updateHud();
        if (lives <= 0) {
            gameOver();
            return;
        }
        burst(player.x + player.w / 2, player.y + player.h / 2, '#ff7a7a', 16);
        respawn();
    }

    function gameOver() {
        state = 'over';
        const isBest = score > best;
        if (isBest) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        if (stage + 1 > bestStage) {
            bestStage = stage + 1;
            localStorage.setItem(BEST_KEY + '.stage', String(bestStage));
        }
        hudCache = '';
        updateHud();
        els.ovTitle.textContent = '旅程结束';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '走到第 ' + (stage + 1) + ' 关，攒下 ' + coins + ' 枚金币。' +
            (isBest ? ' 新的最高分！' : ' 最高分 ' + best + '。');
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.textContent = '再试一次';
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        els.overlay.classList.add('show');
    }

    function finishGame() {
        state = 'win';
        const bonus = Math.max(0, 300 - Math.floor(elapsed) * 2);
        score += bonus;
        const isBest = score > best;
        if (isBest) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        bestStage = 3;
        localStorage.setItem(BEST_KEY + '.stage', '3');
        hudCache = '';
        updateHud();
        els.ovTitle.textContent = '三关通关';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '三关全清，用时 ' + fmt(elapsed) + '，收下 ' + coins +
            ' 枚金币，时间奖励 +' + bonus + '。' + (isBest ? ' 新纪录！' : '');
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.textContent = '再来一轮';
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        els.overlay.classList.add('show');
    }

    function burst(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const s = 60 + Math.random() * 180;
            fx.push({
                x: x, y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 60,
                life: 0.5, max: 0.5,
                color: color,
                r: 1.6 + Math.random() * 2
            });
        }
    }

    /* ---------- 逻辑 ---------- */

    const keys = { left: false, right: false, jump: false };
    let jumpHeld = false;

    function step(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= dt;
            if (p.life <= 0) { fx.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 700 * dt;
        }

        if (state === 'clear') {
            clearT -= dt;
            if (clearT <= 0) {
                if (stage + 1 >= LEVELS.length) finishGame();
                else {
                    state = 'playing';
                    loadLevel(stage + 1, true);
                }
            }
            return;
        }

        if (state !== 'playing') return;

        elapsed += dt;
        if (toast > 0) toast -= dt;
        if (player.inv > 0) player.inv -= dt;

        /* 水平 */
        let dir = 0;
        if (keys.left) dir -= 1;
        if (keys.right) dir += 1;
        if (dir) {
            player.face = dir;
            player.vx = clamp(player.vx + dir * ACC * dt, -RUN, RUN);
        } else {
            const f = FRIC * dt;
            if (player.vx > 0) player.vx = Math.max(0, player.vx - f);
            else if (player.vx < 0) player.vx = Math.min(0, player.vx + f);
        }

        /* 跳跃（带土狼时间） */
        if (player.onGround) player.coyote = 0.1;
        else player.coyote -= dt;

        if (keys.jump && !jumpHeld && player.coyote > 0) {
            player.vy = JUMP;
            player.coyote = 0;
            player.onGround = false;
            jumpHeld = true;
        }
        if (!keys.jump) jumpHeld = false;

        /* 重力 */
        player.vy = Math.min(MAX_FALL, player.vy + GRAV * dt);

        player.onGround = false;
        moveAxis(player.vx * dt, player.vy * dt);

        if (player.vx !== 0 && player.onGround) player.anim += Math.abs(player.vx) * dt * 0.05;

        /* 掉落 */
        if (player.y > H + 80) {
            lives--;
            hudCache = '';
            updateHud();
            if (lives <= 0) { gameOver(); return; }
            respawn();
        }

        /* 摄像机 */
        const targetCam = clamp(player.x + player.w / 2 - W * 0.42, 0, Math.max(0, level.w - W));
        cam += (targetCam - cam) * Math.min(1, dt * 9);

        /* 金币 */
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.taken) continue;
            it.t += dt * 3;
            const box = { x: it.x - 8, y: it.y - 8, w: 16, h: 16 };
            if (overlap(player, box)) {
                it.taken = true;
                coins++;
                score += 10;
                burst(it.x, it.y, '#ffd166', 10);
                hudCache = '';
                updateHud();
            }
        }

        /* 敌人 */
        for (let i = 0; i < foes.length; i++) {
            const f = foes[i];
            if (f.dead > 0) { f.dead -= dt; continue; }
            f.x += f.dir * f.sp * dt;
            if (f.x < f.min) { f.x = f.min; f.dir = 1; }
            if (f.x + f.w > f.max) { f.x = f.max - f.w; f.dir = -1; }

            if (player.inv > 0) continue;
            if (!overlap(player, f)) continue;
            const feet = player.y + player.h;
            if (player.vy > 60 && feet - player.vy * dt <= f.y + 8) {
                f.dead = 0.35;
                player.vy = JUMP * 0.62;
                score += 20;
                burst(f.x + f.w / 2, f.y + f.h / 2, '#c39bff', 14);
                hudCache = '';
                updateHud();
            } else {
                hurt();
                if (state !== 'playing') return;
            }
        }

        /* 终点 */
        if (player.x + player.w > level.flag && player.y + player.h > 380) {
            state = 'clear';
            clearT = 1.1;
            score += 100;
            burst(level.flag + 6, 430, '#7affc4', 22);
            hudCache = '';
            updateHud();
        }

        const sec = Math.floor(elapsed);
        if (sec !== shownSec) {
            shownSec = sec;
            hudCache = '';
            updateHud();
        }
    }

    /* ---------- 渲染 ---------- */

    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#060b18');
        g.addColorStop(0.5, '#0c1730');
        g.addColorStop(0.82, '#122340');
        g.addColorStop(1, '#070d1a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        /* 星云 */
        const halo = ctx.createRadialGradient(W * 0.68, 190, 20, W * 0.68, 190, 330);
        halo.addColorStop(0, 'rgba(95, 216, 255, .13)');
        halo.addColorStop(1, 'rgba(95, 216, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        const halo2 = ctx.createRadialGradient(W * 0.2, 320, 20, W * 0.2, 320, 260);
        halo2.addColorStop(0, 'rgba(150, 120, 255, .10)');
        halo2.addColorStop(1, 'rgba(150, 120, 255, 0)');
        ctx.fillStyle = halo2;
        ctx.fillRect(0, 0, W, H);

        /* 远处行星 */
        const px = W * 0.76 - cam * 0.04;
        const py = 168;
        ctx.fillStyle = 'rgba(18, 48, 76, .55)';
        ctx.beginPath();
        ctx.arc(px, py, 58, 0, TAU);
        ctx.fill();
        const pg = ctx.createRadialGradient(px - 20, py - 22, 6, px + 8, py + 10, 62);
        pg.addColorStop(0, 'rgba(150, 255, 220, .38)');
        pg.addColorStop(0.5, 'rgba(72, 186, 200, .20)');
        pg.addColorStop(1, 'rgba(24, 62, 100, .05)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, 58, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 240, 255, .26)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(px, py, 80, 16, -0.32, 0, TAU);
        ctx.stroke();

        /* 星星 */
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const x = s.x - cam * s.p;
            if (x < -4 || x > W + 4) continue;
            ctx.fillStyle = 'rgba(190, 220, 255, ' + s.a + ')';
            ctx.fillRect(x, s.y, s.r, s.r);
        }

        /* 漂浮尘屑 */
        for (let i = 0; i < 18; i++) {
            const t = elapsed * 12 + i * 137.5;
            const x = ((i * 61.7 + Math.sin(t * 0.01) * 26) % (W + 40)) - 20;
            const y = ((i * 93.1 + t * 0.25) % (360)) + 120;
            ctx.fillStyle = 'rgba(140, 220, 255, .12)';
            ctx.fillRect(x, y, 2, 2);
        }

        /* 远景浮岛（视差） */
        for (let i = 0; i < 11; i++) {
            const bx = ((i * 271 + 40 - cam * 0.42) % 1500 + 1500) % 1500 - 260;
            const by = 132 + ((i * 83) % 190);
            const bw = 64 + (i % 4) * 34;
            const bh = 9 + (i % 3) * 6;
            ctx.fillStyle = 'rgba(23, 43, 72, .82)';
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + bw, by);
            ctx.lineTo(bx + bw - 14, by + bh);
            ctx.lineTo(bx + 14, by + bh);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(110, 190, 230, .26)';
            ctx.fillRect(bx + 8, by, bw - 16, 1.6);
        }

        /* 远山 */
        ctx.fillStyle = 'rgba(22, 38, 62, .85)';
        ctx.beginPath();
        ctx.moveTo(-40, 470);
        for (let x = -40; x <= W + 40; x += 40) {
            const y = 400 + Math.sin((x + cam * 0.25) * 0.008) * 46 +
                Math.sin((x + cam * 0.25) * 0.021) * 18;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 40, H);
        ctx.lineTo(-40, H);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(15, 27, 46, .95)';
        ctx.beginPath();
        ctx.moveTo(-40, 520);
        for (let x = -40; x <= W + 40; x += 32) {
            const y = 486 + Math.sin((x + cam * 0.45) * 0.011 + 2) * 30;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 40, H);
        ctx.lineTo(-40, H);
        ctx.closePath();
        ctx.fill();
    }

    function drawPlatform(s) {
        const x = Math.round(s.x);
        const y = Math.round(s.y);
        const w = s.w;
        const h = s.h;
        const ground = h >= 60;

        /* 落影 */
        ctx.fillStyle = 'rgba(3, 8, 16, .42)';
        ctx.fillRect(x + 4, y + h, w - 8, ground ? 12 : 7);

        /* 岩体 */
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, ground ? '#20395a' : '#1b3352');
        g.addColorStop(0.5, '#152943');
        g.addColorStop(1, '#0a1524');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);

        /* 草皮顶面 */
        ctx.fillStyle = '#27607c';
        ctx.fillRect(x, y, w, 7);
        ctx.fillStyle = '#3aa8d0';
        ctx.fillRect(x, y, w, 2.4);
        ctx.fillStyle = 'rgba(170, 240, 255, .65)';
        ctx.fillRect(x, y, w, 1);

        /* 侧面光影 */
        ctx.fillStyle = 'rgba(120, 200, 255, .12)';
        ctx.fillRect(x, y, 2, h);
        ctx.fillStyle = 'rgba(0, 0, 0, .28)';
        ctx.fillRect(x + w - 2, y, 2, h);

        /* 砖纹 */
        ctx.fillStyle = 'rgba(0, 0, 0, .20)';
        if (ground) {
            for (let i = 12; i < h - 4; i += 16) {
                for (let j = 0; j < w - 8; j += 34) {
                    const off = ((i / 16) | 0) % 2 ? 17 : 0;
                    ctx.fillRect(x + j + off + 3, y + i, 24, 2);
                }
            }
        } else {
            ctx.fillRect(x + 6, y + h - 7, w - 12, 2);
            ctx.fillStyle = 'rgba(150, 220, 255, .16)';
            ctx.fillRect(x + 6, y + h - 5, w - 12, 1);
        }

        /* 端头铆钉 */
        ctx.fillStyle = 'rgba(170, 225, 255, .22)';
        ctx.fillRect(x + 4, y + 11, 3, 3);
        ctx.fillRect(x + w - 7, y + 11, 3, 3);
    }

    /* ---------- 关卡装饰 ---------- */

    function buildDeco() {
        deco = [];
        let seed = (stage + 1) * 7919 + 31;
        function rnd() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        }
        for (let i = 0; i < level.plats.length; i++) {
            const p = level.plats[i];
            if (p[3] >= 60) {
                for (let x = p[0] + 26; x < p[0] + p[2] - 24; x += 76) {
                    const r = rnd();
                    const dx = x + rnd() * 16;
                    if (r < 0.40) deco.push({ t: 'bush', x: dx, y: p[1] });
                    else if (r < 0.56) deco.push({ t: 'lamp', x: dx, y: p[1] });
                    else if (r < 0.72) deco.push({ t: 'rock', x: dx, y: p[1] });
                }
            } else if (rnd() < 0.6) {
                deco.push({ t: 'crystal', x: p[0] + p[2] * (0.3 + rnd() * 0.4), y: p[1] });
            }
        }
    }

    function drawDeco(d) {
        const x = Math.round(d.x);
        const y = Math.round(d.y);
        const wob = Math.sin(elapsed * 2 + d.x * 0.05);

        if (d.t === 'bush') {
            ctx.fillStyle = 'rgba(6, 20, 32, .5)';
            ctx.beginPath();
            ctx.ellipse(x, y + 1, 15, 4, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#123a4a';
            ctx.beginPath();
            ctx.arc(x - 7, y - 5, 7, 0, TAU);
            ctx.arc(x + 2, y - 9, 8, 0, TAU);
            ctx.arc(x + 10, y - 4, 6, 0, TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(122, 255, 196, .22)';
            ctx.beginPath();
            ctx.arc(x + 2, y - 12, 3, 0, TAU);
            ctx.fill();
        } else if (d.t === 'rock') {
            ctx.fillStyle = '#1b3149';
            ctx.beginPath();
            ctx.moveTo(x - 9, y);
            ctx.lineTo(x - 5, y - 9);
            ctx.lineTo(x + 3, y - 11);
            ctx.lineTo(x + 9, y - 3);
            ctx.lineTo(x + 8, y);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(150, 210, 255, .18)';
            ctx.fillRect(x - 4, y - 8, 6, 2);
        } else if (d.t === 'lamp') {
            ctx.fillStyle = '#22405e';
            ctx.fillRect(x - 1.5, y - 30, 3, 30);
            ctx.fillStyle = '#2f5f7e';
            ctx.fillRect(x - 5, y - 32, 10, 3);
            const lg = ctx.createRadialGradient(x, y - 32, 1, x, y - 32, 24);
            lg.addColorStop(0, 'rgba(140, 240, 255, ' + (0.42 + wob * 0.08) + ')');
            lg.addColorStop(1, 'rgba(95, 216, 255, 0)');
            ctx.fillStyle = lg;
            ctx.beginPath();
            ctx.arc(x, y - 32, 24, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#cdf6ff';
            ctx.beginPath();
            ctx.arc(x, y - 33, 2.6, 0, TAU);
            ctx.fill();
        } else if (d.t === 'crystal') {
            const h = 12 + Math.abs(wob) * 4;
            const cg = ctx.createRadialGradient(x, y - h, 1, x, y - h, 26);
            cg.addColorStop(0, 'rgba(120, 235, 255, .30)');
            cg.addColorStop(1, 'rgba(95, 216, 255, 0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(x, y - h, 26, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#63d6ff';
            ctx.beginPath();
            ctx.moveTo(x, y - h * 2);
            ctx.lineTo(x + 7, y - h);
            ctx.lineTo(x, y - 2);
            ctx.lineTo(x - 7, y - h);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(230, 255, 255, .8)';
            ctx.beginPath();
            ctx.moveTo(x, y - h * 2);
            ctx.lineTo(x + 3, y - h);
            ctx.lineTo(x, y - 2);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawCoin(it) {
        if (it.taken) return;
        const bob = Math.sin(it.t) * 2.4;
        const sc = 0.55 + Math.abs(Math.cos(it.t * 0.9)) * 0.45;
        ctx.save();
        ctx.translate(it.x, it.y + bob);
        ctx.scale(sc, 1);
        const g = ctx.createRadialGradient(0, -2, 1, 0, 0, 9);
        g.addColorStop(0, '#fff3c4');
        g.addColorStop(0.6, '#ffd166');
        g.addColorStop(1, '#c58b1f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 240, 190, .85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }

    function drawFoe(f) {
        const x = Math.round(f.x);
        const y = Math.round(f.y);
        if (f.dead > 0) {
            ctx.save();
            ctx.globalAlpha = f.dead / 0.35;
            ctx.fillStyle = '#c39bff';
            ctx.fillRect(x + 2, y + 12, 18, 6);
            ctx.restore();
            return;
        }
        const wob = Math.sin(performance.now() * 0.008 + f.x * 0.1) * 1.2;
        ctx.fillStyle = '#4a2d6b';
        ctx.fillRect(x, y + 4 + wob, f.w, f.h - 4);
        ctx.fillStyle = '#7d55b8';
        ctx.fillRect(x + 2, y + 2 + wob, f.w - 4, 6);
        ctx.fillStyle = '#c39bff';
        ctx.fillRect(x + 3, y + 1 + wob, f.w - 6, 2);
        ctx.fillStyle = '#0b1220';
        const ex = f.dir > 0 ? x + 11 : x + 5;
        ctx.fillRect(ex, y + 9 + wob, 3, 4);
        ctx.fillRect(ex + 5, y + 9 + wob, 3, 4);
        ctx.fillStyle = '#2a1a3d';
        ctx.fillRect(x + 2, y + f.h - 2, 6, 2);
        ctx.fillRect(x + f.w - 8, y + f.h - 2, 6, 2);
    }

    function drawFlag() {
        const x = Math.round(level.flag);
        const base = GROUND;
        ctx.fillStyle = 'rgba(3, 8, 16, .4)';
        ctx.fillRect(x - 10, base - 4, 28, 4);
        ctx.fillStyle = '#3b5878';
        ctx.fillRect(x, base - 140, 4, 140);
        ctx.fillStyle = '#7affc4';
        ctx.beginPath();
        ctx.moveTo(x + 4, base - 138);
        const w1 = Math.sin(elapsed * 4) * 5;
        ctx.lineTo(x + 52, base - 126 + w1);
        ctx.lineTo(x + 4, base - 112);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(122, 255, 196, .25)';
        ctx.fillRect(x - 10, base - 6, 26, 6);
    }

    function drawPlayer() {
        const x = Math.round(player.x);
        const y = Math.round(player.y);
        const run = player.onGround && Math.abs(player.vx) > 20;
        const step = run ? Math.sin(player.anim * 6) : 0;

        ctx.save();
        if (player.inv > 0) ctx.globalAlpha = 0.45 + Math.abs(Math.sin(player.inv * 20)) * 0.4;

        /* 影子 */
        ctx.fillStyle = 'rgba(0, 0, 0, .28)';
        ctx.beginPath();
        ctx.ellipse(x + player.w / 2, y + player.h + 2, 9, 3, 0, 0, TAU);
        ctx.fill();

        /* 腿 */
        ctx.fillStyle = '#25476b';
        if (player.onGround) {
            ctx.fillRect(x + 3, y + 17, 5, 7 + step * 1.5);
            ctx.fillRect(x + 11, y + 17, 5, 7 - step * 1.5);
        } else {
            ctx.fillRect(x + 2, y + 16, 5, 6);
            ctx.fillRect(x + 12, y + 18, 5, 5);
        }

        /* 身体 */
        const g = ctx.createLinearGradient(x, y, x, y + 20);
        g.addColorStop(0, '#a8d4ff');
        g.addColorStop(0.55, '#4a86e8');
        g.addColorStop(1, '#2b5aa8');
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 6, player.w - 4, 12);

        /* 头 */
        ctx.fillStyle = '#cfe6ff';
        ctx.fillRect(x + 3, y, player.w - 6, 7);
        ctx.fillStyle = '#0b1220';
        const ex = player.face > 0 ? x + 10 : x + 5;
        ctx.fillRect(ex, y + 2, 2, 3);
        ctx.fillRect(ex + 4, y + 2, 2, 3);

        /* 手臂 */
        ctx.fillStyle = '#3f74c8';
        const ax = player.face > 0 ? x + player.w - 4 : x;
        ctx.fillRect(ax, y + 8, 4, 6);

        ctx.restore();
    }

    function drawFx() {
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const k = p.life / p.max;
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
            ctx.globalAlpha = 1;
        }
    }

    function drawBar() {
        ctx.fillStyle = 'rgba(6, 11, 22, .78)';
        ctx.fillRect(0, 0, W, BAR);
        ctx.fillStyle = 'rgba(95, 216, 255, .16)';
        ctx.fillRect(0, BAR - 1, W, 1);

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(95, 216, 255, .45)';
        ctx.font = '700 9px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('PIXEL HOP', W / 2, 14);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 15px ' + FONT;
        ctx.fillText('第 ' + (stage + 1) + ' / ' + LEVELS.length + ' 关', W / 2, 33);

        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = 'rgba(150, 190, 220, .8)';
        ctx.fillText(fmt(elapsed) + ' · 金币 ' + coins + ' · 生命 ' + lives, W / 2, 47);

        /* 进度条 */
        const pw = 300;
        const px0 = (W - pw) / 2;
        const prog = clamp((player.x + player.w) / level.flag, 0, 1);
        ctx.fillStyle = 'rgba(120, 160, 200, .18)';
        ctx.fillRect(px0, 52, pw, 2);
        ctx.fillStyle = '#7affc4';
        ctx.fillRect(px0, 52, pw * prog, 2);
        ctx.restore();

        if (toast > 0) {
            const k = Math.min(1, toast / 0.35);
            ctx.save();
            ctx.globalAlpha = k;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(230, 246, 255, .92)';
            ctx.font = '800 26px ' + FONT;
            ctx.fillText(toastText, W / 2, H * 0.36);
            ctx.restore();
        }
    }

    function render() {
        drawBg();
        ctx.save();
        ctx.translate(-Math.round(cam), 0);

        for (let i = 0; i < solids.length; i++) drawPlatform(solids[i]);
        for (let i = 0; i < deco.length; i++) drawDeco(deco[i]);
        drawFlag();
        for (let i = 0; i < items.length; i++) drawCoin(items[i]);
        for (let i = 0; i < foes.length; i++) drawFoe(foes[i]);
        drawFx();
        if (state !== 'over') drawPlayer();

        ctx.restore();
        drawBar();
    }

    /* ---------- HUD ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '旅程结束';
        if (state === 'win') return '三关通关';
        if (state === 'clear') return '过关！';
        return '闯关中';
    }

    function updateHud() {
        const key = score + '|' + coins + '|' + lives + '|' + stage + '|' + state + '|' +
            best + '|' + Math.floor(elapsed);
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.score.textContent = String(score);
        els.stage.textContent = (stage + 1) + ' / ' + LEVELS.length;
        els.coins.textContent = String(coins);
        els.lives.textContent = String(Math.max(0, lives));
        els.time.textContent = fmt(elapsed);
        els.best.textContent = String(best);
        els.restartBtn.textContent = state === 'playing' ? '从头再来' : '换一局';
    }

    /* ---------- 输入 ---------- */

    const MAP = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'jump', KeyW: 'jump', Space: 'jump'
    };

    window.addEventListener('keydown', function (e) {
        if (MAP[e.code]) {
            keys[MAP[e.code]] = true;
            e.preventDefault();
            return;
        }
        if (e.code === 'KeyR') {
            e.preventDefault();
            begin();
        } else if (e.code === 'Enter' && state !== 'playing') {
            e.preventDefault();
            begin();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (MAP[e.code]) {
            keys[MAP[e.code]] = false;
            e.preventDefault();
        }
    });

    /* 触屏：左侧行走 / 右侧行走 / 中间跳跃 */
    const active = new Map();

    function zoneOf(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        if (y < BAR) return null;
        if (x < W * 0.34) return 'left';
        if (x > W * 0.66) return 'right';
        return 'jump';
    }

    canvas.addEventListener('pointerdown', function (e) {
        const k = zoneOf(e);
        if (!k) return;
        e.preventDefault();
        active.set(e.pointerId, k);
        keys[k] = true;
    });

    function release(e) {
        const k = active.get(e.pointerId);
        if (!k) return;
        active.delete(e.pointerId);
        keys[k] = false;
    }

    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', release);

    els.ovBtn.addEventListener('click', begin);
    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;
        step(dt);
        render();
        requestAnimationFrame(frame);
    }

    loadLevel(0, false);
    state = 'ready';
    buildStars();
    updateHud();
    requestAnimationFrame(frame);
})();
