/* ==========================================================
   弹球台 Pinball
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const LEFT = 44;
    const RIGHT = 436;
    const TOP = 112;
    const BOT = 548;

    const BR = 8;
    const GRAV = 900;
    const FLEN = 74;
    const FTHICK = 5;
    const MAX_SPEED = 1080;

    const WALLS = [
        [44, 170, 44, 528],
        [44, 170, 102, 112],
        [102, 112, 378, 112],
        [378, 112, 436, 170],
        [436, 170, 436, 528],
        [44, 528, 168, 548],
        [436, 528, 312, 548]
    ];

    const BUMPERS = [
        { x: 240, y: 186, r: 28, score: 120, pulse: 0 },
        { x: 160, y: 274, r: 23, score: 80, pulse: 0 },
        { x: 320, y: 274, r: 23, score: 80, pulse: 0 },
        { x: 240, y: 344, r: 21, score: 70, pulse: 0 },
        { x: 112, y: 384, r: 20, score: 60, pulse: 0 },
        { x: 368, y: 384, r: 20, score: 60, pulse: 0 }
    ];

    const POSTS = [
        { x: 106, y: 466, r: 9, pulse: 0 },
        { x: 374, y: 466, r: 9, pulse: 0 }
    ];

    // 弹弓斜面（下单弓），补足挡板上方的空场
    const SLINGS = [
        [46, 414, 138, 462],
        [434, 414, 342, 462]
    ];
    const sling = [{ pulse: 0 }, { pulse: 0 }];

    const BEST_KEY = 'webgames.pinball.best';
    const RUN_KEY = 'webgames.pinball.runs';

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        balls: document.getElementById('balls'),
        hits: document.getElementById('hits'),
        best: document.getElementById('best'),
        runs: document.getElementById('runs'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    const flippers = [
        { px: 140, py: 490, rest: 0.56, act: -0.5, ang: 0.56, omega: 0, down: false },
        { px: 340, py: 490, rest: Math.PI - 0.56, act: Math.PI + 0.5, ang: Math.PI - 0.56, omega: 0, down: false }
    ];

    let ball = { x: 240, y: 440, vx: 0, vy: 0 };
    let trail = [];
    let state = 'ready';
    let clock = 0;
    let score = 0;
    let balls = 3;
    let hits = 0;
    let combo = 0;
    let idle = 0;
    let flash = 0;
    let hudCache = '';

    /* ---------- 流程 ---------- */
    function spawnBall() {
        ball = {
            x: 240 + (Math.random() - 0.5) * 40,
            y: 442,
            vx: (Math.random() - 0.5) * 120,
            vy: -640
        };
        trail = [];
        idle = 0;
    }

    function startGame() {
        score = 0;
        balls = 3;
        hits = 0;
        combo = 0;
        flash = 0;
        for (let i = 0; i < BUMPERS.length; i++) BUMPERS[i].pulse = 0;
        for (let i = 0; i < POSTS.length; i++) POSTS[i].pulse = 0;
        for (let i = 0; i < sling.length; i++) sling[i].pulse = 0;
        spawnBall();
        state = 'playing';
        hudCache = '';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function loseBall() {
        balls--;
        combo = 0;
        flash = 1;
        hudCache = '';
        updateHud();
        if (balls <= 0) {
            gameOver();
        } else {
            spawnBall();
        }
    }

    function gameOver() {
        state = 'over';
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        const runs = Number(localStorage.getItem(RUN_KEY) || 0) + 1;
        localStorage.setItem(RUN_KEY, String(runs));

        els.ovTitle.textContent = '球用完了';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '三颗球全部掉进底槽。用挡板把球顶回去，才能继续加分。';
        els.ovScore.innerHTML = '本局得分 <b>' + score + '</b> · 最高 <b>' + Math.max(score, best) + '</b>';
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    function addScore(v) {
        score += v + combo * 5;
        if (combo < 9) combo++;
        hudCache = '';
    }

    function updateHud() {
        const key = [score, balls, hits, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.balls.textContent = String(Math.max(0, balls));
        els.hits.textContent = String(hits);
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
        els.runs.textContent = String(Number(localStorage.getItem(RUN_KEY) || 0));
    }

    /* ---------- 物理 ---------- */
    function resolveSeg(x1, y1, x2, y2, rad, e) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const l2 = dx * dx + dy * dy || 1;
        let t = ((ball.x - x1) * dx + (ball.y - y1) * dy) / l2;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const cx = x1 + dx * t;
        const cy = y1 + dy * t;
        let nx = ball.x - cx;
        let ny = ball.y - cy;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d > rad) return null;
        if (d < 0.0001) {
            nx = 0;
            ny = -1;
        } else {
            nx /= d;
            ny /= d;
        }
        ball.x = cx + nx * rad;
        ball.y = cy + ny * rad;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
            ball.vx -= (1 + e) * vn * nx;
            ball.vy -= (1 + e) * vn * ny;
        }
        return { nx: nx, ny: ny, vn: vn };
    }

    function resolveCircle(o, rad, e, boost) {
        let nx = ball.x - o.x;
        let ny = ball.y - o.y;
        const d = Math.sqrt(nx * nx + ny * ny);
        const R = o.r + rad;
        if (d > R || d < 0.0001) return false;
        nx /= d;
        ny /= d;
        ball.x = o.x + nx * R;
        ball.y = o.y + ny * R;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
            ball.vx -= (1 + e) * vn * nx;
            ball.vy -= (1 + e) * vn * ny;
        }
        ball.vx += nx * boost;
        ball.vy += ny * boost;
        return true;
    }

    function physics(h) {
        ball.vy += GRAV * h;
        ball.x += ball.vx * h;
        ball.y += ball.vy * h;

        for (let i = 0; i < WALLS.length; i++) {
            const s = WALLS[i];
            resolveSeg(s[0], s[1], s[2], s[3], BR, 0.56);
        }

        for (let i = 0; i < SLINGS.length; i++) {
            const s = SLINGS[i];
            const hit = resolveSeg(s[0], s[1], s[2], s[3], BR, 0.86);
            if (hit && hit.vn < -40) {
                const k = Math.min(1, -hit.vn / 340);
                ball.vx += hit.nx * 240 * k;
                ball.vy += hit.ny * 240 * k;
                sling[i].pulse = 1;
                addScore(15);
                hits++;
            }
        }

        for (let i = 0; i < BUMPERS.length; i++) {
            const b = BUMPERS[i];
            if (resolveCircle(b, BR, 0.5, 300)) {
                b.pulse = 1;
                addScore(b.score);
                hits++;
            }
        }

        for (let i = 0; i < POSTS.length; i++) {
            const p = POSTS[i];
            if (resolveCircle(p, BR, 0.9, 190)) {
                p.pulse = 1;
                addScore(25);
                hits++;
            }
        }

        for (let i = 0; i < 2; i++) {
            const f = flippers[i];
            const tx = f.px + Math.cos(f.ang) * FLEN;
            const ty = f.py + Math.sin(f.ang) * FLEN;
            const hit = resolveSeg(f.px, f.py, tx, ty, BR + FTHICK, 0.42);
            if (hit) {
                hits++;
                if (Math.abs(f.omega) > 1.4) {
                    const kick = Math.min(900, Math.abs(f.omega) * 42);
                    ball.vy -= kick * 0.9;
                    ball.vx += hit.nx * kick * 0.3;
                    addScore(20);
                }
            }
        }

        const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (sp > MAX_SPEED) {
            ball.vx *= MAX_SPEED / sp;
            ball.vy *= MAX_SPEED / sp;
        }
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (flash > 0) flash = Math.max(0, flash - dt * 1.8);

        for (let i = 0; i < BUMPERS.length; i++) {
            if (BUMPERS[i].pulse > 0) BUMPERS[i].pulse = Math.max(0, BUMPERS[i].pulse - dt * 2.6);
        }
        for (let i = 0; i < POSTS.length; i++) {
            if (POSTS[i].pulse > 0) POSTS[i].pulse = Math.max(0, POSTS[i].pulse - dt * 3.2);
        }
        for (let i = 0; i < sling.length; i++) {
            if (sling[i].pulse > 0) sling[i].pulse = Math.max(0, sling[i].pulse - dt * 3.4);
        }

        for (let i = 0; i < 2; i++) {
            const f = flippers[i];
            const target = (f.down && state === 'playing') ? f.act : f.rest;
            const prev = f.ang;
            f.ang += (target - f.ang) * Math.min(1, dt * 26);
            f.omega = (f.ang - prev) / Math.max(dt, 0.0001);
        }

        if (state !== 'playing') return;

        let remain = dt;
        let guard = 0;
        while (remain > 0.0002 && guard < 14) {
            const h = Math.min(remain, 1 / 180);
            physics(h);
            remain -= h;
            guard++;
        }

        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 14) trail.shift();

        // 卡住保护
        if (Math.abs(ball.vx) + Math.abs(ball.vy) < 46) {
            idle += dt;
            if (idle > 2.4) {
                ball.vx += (Math.random() - 0.5) * 260;
                ball.vy -= 220;
                idle = 0;
            }
        } else {
            idle = 0;
        }

        if (ball.y > 572 || ball.x < 30 || ball.x > W - 30) loseBall();
        updateHud();
    }

    /* ---------- 绘制 ---------- */
    function tablePath() {
        ctx.beginPath();
        ctx.moveTo(102, TOP);
        ctx.lineTo(378, TOP);
        ctx.lineTo(RIGHT, 170);
        ctx.lineTo(RIGHT, BOT);
        ctx.lineTo(168, BOT);
        ctx.lineTo(LEFT, BOT);
        ctx.lineTo(LEFT, 170);
        ctx.closePath();
    }

    function drawTable() {
        ctx.save();
        tablePath();
        const g = ctx.createLinearGradient(0, TOP, 0, BOT);
        g.addColorStop(0, '#0d1c30');
        g.addColorStop(0.55, '#0a1524');
        g.addColorStop(1, '#070e19');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.clip();

        const halo = ctx.createRadialGradient(240, 220, 20, 240, 220, 220);
        halo.addColorStop(0, 'rgba(72, 132, 210, .18)');
        halo.addColorStop(1, 'rgba(72, 132, 210, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BOT - TOP);

        // 底槽
        const dg = ctx.createLinearGradient(0, 528, 0, BOT);
        dg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        dg.addColorStop(1, 'rgba(0, 0, 0, .6)');
        ctx.fillStyle = dg;
        ctx.fillRect(168, 520, 144, 28);
        ctx.restore();
    }

    function drawWalls() {
        ctx.save();
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 3; pass++) {
            ctx.strokeStyle = pass === 0 ? 'rgba(9, 18, 30, .95)'
                : (pass === 1 ? '#33506f' : 'rgba(150, 190, 230, .45)');
            ctx.lineWidth = pass === 0 ? 11 : (pass === 1 ? 8 : 2.4);
            for (let i = 0; i < WALLS.length; i++) {
                const s = WALLS[i];
                ctx.beginPath();
                ctx.moveTo(s[0], s[1]);
                ctx.lineTo(s[2], s[3]);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function drawSlings() {
        for (let i = 0; i < SLINGS.length; i++) {
            const s = SLINGS[i];
            const k = sling[i].pulse;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(s[0], s[1]);
            ctx.lineTo(s[2], s[3]);
            ctx.lineTo(s[0], s[3] + 4);
            ctx.closePath();
            const g = ctx.createLinearGradient(s[0], s[1], s[2], s[3]);
            g.addColorStop(0, 'rgba(96, 60, 48, .95)');
            g.addColorStop(1, 'rgba(44, 30, 30, .95)');
            ctx.fillStyle = g;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(s[0], s[1]);
            ctx.lineTo(s[2], s[3]);
            ctx.strokeStyle = k > 0
                ? 'rgba(255, 214, 168, .98)'
                : 'rgba(255, 150, 92, .82)';
            ctx.lineWidth = k > 0 ? 5 : 3.4;
            ctx.lineCap = 'round';
            if (k > 0) {
                ctx.shadowColor = 'rgba(255, 170, 110, .9)';
                ctx.shadowBlur = 14 * k;
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawBumpers() {
        for (let i = 0; i < BUMPERS.length; i++) {
            const b = BUMPERS[i];
            const k = b.pulse;

            if (k > 0) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r + 6 + (1 - k) * 16, 0, TAU);
                ctx.strokeStyle = 'rgba(120, 220, 255, ' + (k * 0.55) + ')';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.4, 2, b.x, b.y, b.r);
            g.addColorStop(0, k > 0 ? 'rgba(190, 240, 255, .98)' : 'rgba(96, 186, 240, .95)');
            g.addColorStop(0.62, k > 0 ? 'rgba(70, 176, 232, .95)' : 'rgba(40, 118, 186, .95)');
            g.addColorStop(1, 'rgba(14, 42, 72, .98)');
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();

            ctx.strokeStyle = k > 0 ? 'rgba(220, 248, 255, .95)' : 'rgba(140, 200, 245, .6)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 0.42, 0, TAU);
            ctx.fillStyle = k > 0 ? 'rgba(240, 252, 255, .9)' : 'rgba(180, 226, 250, .34)';
            ctx.fill();
        }

        for (let i = 0; i < POSTS.length; i++) {
            const p = POSTS[i];
            const k = p.pulse;
            if (k > 0) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r + 5 + (1 - k) * 10, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 176, 110, ' + (k * 0.55) + ')';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            // 琥珀色圆环柱，白色小球才不会被认错
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, TAU);
            ctx.fillStyle = 'rgba(58, 36, 26, .94)';
            ctx.fill();
            ctx.strokeStyle = k > 0 ? 'rgba(255, 232, 190, .98)' : 'rgba(255, 168, 104, .88)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 0.32, 0, TAU);
            ctx.fillStyle = 'rgba(255, 202, 152, .8)';
            ctx.fill();
        }
    }

    function drawFlippers() {
        for (let i = 0; i < 2; i++) {
            const f = flippers[i];
            const tx = f.px + Math.cos(f.ang) * FLEN;
            const ty = f.py + Math.sin(f.ang) * FLEN;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(6, 12, 22, .9)';
            ctx.lineWidth = 15;
            ctx.beginPath();
            ctx.moveTo(f.px, f.py);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            const g = ctx.createLinearGradient(f.px, f.py - 8, tx, ty + 8);
            g.addColorStop(0, '#ff9f5a');
            g.addColorStop(0.55, '#f2743a');
            g.addColorStop(1, '#b8421c');
            ctx.strokeStyle = g;
            ctx.lineWidth = 11;
            ctx.beginPath();
            ctx.moveTo(f.px, f.py);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 220, 190, .5)';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(f.px, f.py - 2.6);
            ctx.lineTo(tx, ty - 2.2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(f.px, f.py, 6, 0, TAU);
            ctx.fillStyle = '#2b3f58';
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 212, 240, .6)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawBall() {
        if (state !== 'playing') return;

        for (let i = 0; i < trail.length; i++) {
            const t = trail[i];
            const k = (i + 1) / trail.length;
            ctx.beginPath();
            ctx.arc(t.x, t.y, BR * 0.46 * k, 0, TAU);
            ctx.fillStyle = 'rgba(140, 210, 255, ' + (k * 0.16) + ')';
            ctx.fill();
        }

        ctx.save();
        ctx.shadowColor = 'rgba(160, 226, 255, .85)';
        ctx.shadowBlur = 10;
        const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3.4, 1, ball.x, ball.y, BR);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.42, '#eaf7ff');
        g.addColorStop(0.78, '#9fcbec');
        g.addColorStop(1, '#4a7ba3');
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BR, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BR, 0, TAU);
        ctx.strokeStyle = 'rgba(226, 244, 255, .8)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .46)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('PINBALL', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('弹球台', W / 2, 48);

        const g = ctx.createLinearGradient(110, 0, W - 110, 0);
        g.addColorStop(0, 'rgba(120, 150, 200, 0)');
        g.addColorStop(0.5, 'rgba(255, 160, 96, .3)');
        g.addColorStop(1, 'rgba(120, 150, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(110, 70, W - 220, 1);

        ctx.textAlign = 'left';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(170, 200, 232, .6)';
        ctx.fillText('分数', LEFT, 92);
        ctx.fillStyle = '#ffd5a8';
        ctx.font = '800 14px ' + FONT;
        ctx.fillText(String(score), LEFT + 32, 92);

        ctx.textAlign = 'right';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(170, 200, 232, .6)';
        ctx.fillText('剩余', RIGHT - 58, 92);
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(RIGHT - 42 + i * 15, 92, 4.6, 0, TAU);
            ctx.fillStyle = i < balls ? 'rgba(255, 214, 168, .95)' : 'rgba(120, 140, 165, .26)';
            ctx.fill();
        }
        ctx.restore();
    }

    function drawFooter() {
        if (flash <= 0) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = flash;
        ctx.fillStyle = 'rgba(255, 150, 130, .95)';
        ctx.font = '800 16px ' + FONT;
        ctx.fillText('掉球', W / 2, 512);
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1220');
        g.addColorStop(0.55, '#0b1526');
        g.addColorStop(1, '#070c15');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 330);
        halo.addColorStop(0, 'rgba(200, 110, 60, .1)');
        halo.addColorStop(1, 'rgba(200, 110, 60, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 100, W, H - 100);

        drawTable();
        drawSlings();
        drawBumpers();
        drawFlippers();
        drawWalls();
        drawBall();

        drawHeader();
        drawFooter();
    }

    /* ---------- 输入 ---------- */
    function pressLeft(v) {
        flippers[0].down = v;
    }

    function pressRight(v) {
        flippers[1].down = v;
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        if (x < W / 2) pressLeft(true);
        else pressRight(true);
    });

    window.addEventListener('pointerup', function () {
        pressLeft(false);
        pressRight(false);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            e.preventDefault();
            pressLeft(true);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            e.preventDefault();
            pressRight(true);
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') pressLeft(false);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') pressRight(false);
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

    updateHud();
    requestAnimationFrame(loop);
})();
