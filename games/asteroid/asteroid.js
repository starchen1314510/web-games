/* ==========================================================
   小行星 Asteroids
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const TURN = 3.15;
    const ACC = 300;
    const MAXV = 330;
    const BULLET_SPEED = 520;
    const BULLET_LIFE = 0.82;
    const FIRE_CD = 0.19;
    const MAX_BULLETS = 5;

    const AST = {
        3: { r: 46, lo: 26, hi: 52, score: 20 },
        2: { r: 26, lo: 52, hi: 86, score: 50 },
        1: { r: 14, lo: 88, hi: 132, score: 100 }
    };

    const BEST_KEY = 'webgames.asteroid.best';
    const ROCK_KEY = 'webgames.asteroid.rocks';

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function rand(lo, hi) {
        return lo + Math.random() * (hi - lo);
    }

    function wrap(v, max) {
        if (v < 0) return v + max;
        if (v > max) return v - max;
        return v;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        wave: document.getElementById('wave'),
        lives: document.getElementById('lives'),
        best: document.getElementById('best'),
        rocks: document.getElementById('rocks'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    const stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: 0.4 + Math.random() * 1.1,
            a: 0.16 + Math.random() * 0.5,
            ph: Math.random() * TAU,
            sp: 0.5 + Math.random() * 1.8
        });
    }

    const ship = {
        x: W / 2,
        y: H / 2,
        vx: 0,
        vy: 0,
        a: -Math.PI / 2,
        invuln: 0
    };

    let asteroids = [];
    let bullets = [];
    let particles = [];
    let score = 0;
    let wave = 1;
    let lives = 3;
    let rocks = 0;
    let state = 'ready';
    let clock = 0;
    let fireCd = 0;
    let thrusting = false;
    let waveBanner = 0;
    let waveTimer = 0;
    let hudCache = '';

    const keys = { left: false, right: false, thrust: false, fire: false };

    /* ---------- 生成 ---------- */
    function makeAsteroid(x, y, size, vx, vy) {
        const spec = AST[size];
        const pts = [];
        const n = 10 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            pts.push({
                a: i / n * TAU,
                rr: 0.74 + Math.random() * 0.36
            });
        }
        let svx = vx;
        let svy = vy;
        if (svx === undefined) {
            const sp = rand(spec.lo, spec.hi);
            const a = Math.random() * TAU;
            svx = Math.cos(a) * sp;
            svy = Math.sin(a) * sp;
        }
        return {
            x: x,
            y: y,
            vx: svx,
            vy: svy,
            r: spec.r,
            size: size,
            pts: pts,
            rot: Math.random() * TAU,
            spin: rand(-0.7, 0.7)
        };
    }

    function spawnWave(count) {
        for (let i = 0; i < count; i++) {
            let x = 0;
            let y = 0;
            let guard = 0;
            do {
                x = rand(30, W - 30);
                y = rand(90, H - 40);
                guard++;
            } while (Math.hypot(x - W / 2, y - H / 2) < 150 && guard < 40);
            asteroids.push(makeAsteroid(x, y, 3));
        }
    }

    function startGame() {
        asteroids = [];
        bullets = [];
        particles = [];
        score = 0;
        wave = 1;
        lives = 3;
        rocks = 0;
        clock = 0;
        fireCd = 0;
        waveTimer = 0;
        waveBanner = 1.8;
        ship.x = W / 2;
        ship.y = H / 2;
        ship.vx = 0;
        ship.vy = 0;
        ship.a = -Math.PI / 2;
        ship.invuln = 2;
        keys.left = false;
        keys.right = false;
        keys.thrust = false;
        keys.fire = false;
        state = 'playing';
        hudCache = '';
        spawnWave(4);
        els.overlay.classList.remove('show');
        updateHud();
    }

    function updateHud() {
        const key = [score, wave, lives, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.wave.textContent = String(wave);
        els.lives.textContent = String(lives);
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
        els.rocks.textContent = String(Number(localStorage.getItem(ROCK_KEY) || 0));
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, n, spread, root, hue) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const sp = rand(spread * 0.3, spread);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: rand(0.4, 0.95),
                max: 0.95,
                r: rand(1.1, 2.8),
                hue: hue
            });
        }
        if (root) {
            particles.push({
                x: x, y: y, vx: 0, vy: 0,
                life: 0.3, max: 0.3, r: 3, hue: hue, ring: true
            });
        }
    }

    function splitAsteroid(ast) {
        if (ast.size <= 1) return;
        const next = ast.size - 1;
        for (let i = 0; i < 2; i++) {
            const a = Math.random() * TAU;
            const sp = rand(AST[next].lo, AST[next].hi);
            asteroids.push(makeAsteroid(
                ast.x + Math.cos(a) * 8,
                ast.y + Math.sin(a) * 8,
                next,
                Math.cos(a) * sp + ast.vx * 0.35,
                Math.sin(a) * sp + ast.vy * 0.35
            ));
        }
    }

    /* ---------- 逻辑 ---------- */
    function shoot() {
        if (bullets.length >= MAX_BULLETS || fireCd > 0) return;
        fireCd = FIRE_CD;
        const nx = Math.cos(ship.a);
        const ny = Math.sin(ship.a);
        bullets.push({
            x: ship.x + nx * 16,
            y: ship.y + ny * 16,
            vx: nx * BULLET_SPEED + ship.vx * 0.35,
            vy: ny * BULLET_SPEED + ship.vy * 0.35,
            life: BULLET_LIFE
        });
        particles.push({
            x: ship.x + nx * 18,
            y: ship.y + ny * 18,
            vx: nx * 60,
            vy: ny * 60,
            life: 0.12,
            max: 0.12,
            r: 2.6,
            hue: '255, 232, 160'
        });
    }

    function hitPlayer() {
        if (ship.invuln > 0 || state !== 'playing') return;
        burst(ship.x, ship.y, 26, 190, true, '255, 190, 120');
        lives--;
        if (lives <= 0) {
            gameOver();
            return;
        }
        ship.x = W / 2;
        ship.y = H / 2;
        ship.vx = 0;
        ship.vy = 0;
        ship.a = -Math.PI / 2;
        ship.invuln = 2.2;
        updateHud();
    }

    function gameOver() {
        state = 'over';
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        els.ovTitle.textContent = '飞船解体';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '你坚持到了第 ' + wave + ' 波。';
        els.ovScore.innerHTML = '本局 <b>' + score + '</b> 分 · 最高 <b>' +
            Math.max(score, best) + '</b> 分';
        els.ovBtn.textContent = '再来一次';
        els.overlay.classList.add('show');
        updateHud();
    }

    function update(dt) {
        clock += dt;
        if (state !== 'playing') {
            updateParticles(dt);
            return;
        }

        if (ship.invuln > 0) ship.invuln -= dt;
        if (fireCd > 0) fireCd -= dt;
        if (waveBanner > 0) waveBanner -= dt;

        // 转向与推进
        if (keys.left) ship.a -= TURN * dt;
        if (keys.right) ship.a += TURN * dt;

        thrusting = keys.thrust;
        if (thrusting) {
            ship.vx += Math.cos(ship.a) * ACC * dt;
            ship.vy += Math.sin(ship.a) * ACC * dt;
        }

        const damp = Math.pow(0.84, dt);
        ship.vx *= damp;
        ship.vy *= damp;

        const sp = Math.hypot(ship.vx, ship.vy);
        if (sp > MAXV) {
            ship.vx = ship.vx / sp * MAXV;
            ship.vy = ship.vy / sp * MAXV;
        }

        ship.x = wrap(ship.x + ship.vx * dt, W);
        ship.y = wrap(ship.y + ship.vy * dt, H);

        if (keys.fire) shoot();

        // 子弹
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.life -= dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.x = wrap(b.x, W);
            b.y = wrap(b.y, H);
            if (b.life <= 0) bullets.splice(i, 1);
        }

        // 小行星移动
        for (let i = 0; i < asteroids.length; i++) {
            const a = asteroids[i];
            a.x = wrap(a.x + a.vx * dt, W);
            a.y = wrap(a.y + a.vy * dt, H);
            a.rot += a.spin * dt;
        }

        // 子弹命中
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = asteroids.length - 1; j >= 0; j--) {
                const a = asteroids[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                if (dx * dx + dy * dy > (a.r + 3) * (a.r + 3)) continue;

                bullets.splice(i, 1);
                asteroids.splice(j, 1);
                score += AST[a.size].score;
                rocks++;
                localStorage.setItem(ROCK_KEY, String(Number(localStorage.getItem(ROCK_KEY) || 0) + 1));
                burst(a.x, a.y, a.size === 3 ? 16 : (a.size === 2 ? 11 : 8),
                    a.size === 3 ? 130 : 175, true, '190, 214, 240');
                splitAsteroid(a);
                hudCache = '';
                updateHud();
                break;
            }
        }

        // 飞船碰撞
        if (ship.invuln <= 0) {
            for (let j = 0; j < asteroids.length; j++) {
                const a = asteroids[j];
                if (Math.hypot(ship.x - a.x, ship.y - a.y) < a.r + 11) {
                    hitPlayer();
                    break;
                }
            }
        }

        updateParticles(dt);

        // 波次
        if (asteroids.length === 0) {
            if (waveTimer <= 0) {
                waveTimer = 1.4;
            } else {
                waveTimer -= dt;
                if (waveTimer <= 0) {
                    wave++;
                    waveBanner = 1.6;
                    spawnWave(Math.min(4 + wave, 9));
                    hudCache = '';
                    updateHud();
                }
            }
        } else {
            waveTimer = 0;
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
        }
    }

    /* ---------- 绘制 ---------- */
    function drawStars() {
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const tw = s.a * (0.62 + Math.sin(clock * s.sp + s.ph) * 0.38);
            ctx.fillStyle = 'rgba(200, 222, 255, ' + tw.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, TAU);
            ctx.fill();
        }
    }

    function shipPath(x, y, a, s) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 17 * s, y + Math.sin(a) * 17 * s);
        ctx.lineTo(x + Math.cos(a + 2.45) * 15 * s, y + Math.sin(a + 2.45) * 15 * s);
        ctx.lineTo(x + Math.cos(a + Math.PI) * 7.5 * s, y + Math.sin(a + Math.PI) * 7.5 * s);
        ctx.lineTo(x + Math.cos(a - 2.45) * 15 * s, y + Math.sin(a - 2.45) * 15 * s);
        ctx.closePath();
    }

    function drawShip() {
        if (state !== 'playing') return;
        if (ship.invuln > 0 && Math.floor(clock * 12) % 2 === 0) return;

        ctx.save();

        if (thrusting && state === 'playing') {
            const back = ship.a + Math.PI;
            const flick = 10 + Math.random() * 12;
            ctx.beginPath();
            ctx.moveTo(ship.x + Math.cos(back - 0.42) * 10, ship.y + Math.sin(back - 0.42) * 10);
            ctx.lineTo(ship.x + Math.cos(back) * (12 + flick), ship.y + Math.sin(back) * (12 + flick));
            ctx.lineTo(ship.x + Math.cos(back + 0.42) * 10, ship.y + Math.sin(back + 0.42) * 10);
            ctx.closePath();
            const fg = ctx.createLinearGradient(
                ship.x + Math.cos(back) * 6, ship.y + Math.sin(back) * 6,
                ship.x + Math.cos(back) * (14 + flick), ship.y + Math.sin(back) * (14 + flick)
            );
            fg.addColorStop(0, 'rgba(255, 236, 180, .95)');
            fg.addColorStop(0.5, 'rgba(255, 168, 72, .72)');
            fg.addColorStop(1, 'rgba(255, 96, 40, 0)');
            ctx.fillStyle = fg;
            ctx.fill();
        }

        shipPath(ship.x, ship.y, ship.a, 1);
        ctx.shadowColor = 'rgba(130, 205, 255, .85)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(15, 27, 43, .92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(228, 245, 255, 1)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(150, 210, 255, .55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ship.x + Math.cos(ship.a) * 13, ship.y + Math.sin(ship.a) * 13);
        ctx.lineTo(ship.x + Math.cos(ship.a + Math.PI) * 4, ship.y + Math.sin(ship.a + Math.PI) * 4);
        ctx.stroke();
        ctx.restore();
    }

    function drawAsteroids() {
        ctx.save();
        ctx.lineJoin = 'round';
        for (let i = 0; i < asteroids.length; i++) {
            const a = asteroids[i];
            ctx.beginPath();
            for (let k = 0; k < a.pts.length; k++) {
                const p = a.pts[k];
                const ang = p.a + a.rot;
                const px = a.x + Math.cos(ang) * a.r * p.rr;
                const py = a.y + Math.sin(ang) * a.r * p.rr;
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            ctx.fillStyle = 'rgba(48, 64, 86, .9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 202, 228, .95)';
            ctx.lineWidth = 1.9;
            ctx.stroke();

            // 内部纹理
            ctx.strokeStyle = 'rgba(146, 172, 204, .5)';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(a.x - a.r * 0.28, a.y - a.r * 0.16);
            ctx.lineTo(a.x + a.r * 0.1, a.y + a.r * 0.22);
            ctx.lineTo(a.x + a.r * 0.34, a.y - a.r * 0.06);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawBullets() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            const nx = b.vx / BULLET_SPEED;
            const ny = b.vy / BULLET_SPEED;
            const g = ctx.createLinearGradient(
                b.x - nx * 9, b.y - ny * 9, b.x + nx * 2.5, b.y + ny * 2.5
            );
            g.addColorStop(0, 'rgba(255, 220, 120, 0)');
            g.addColorStop(1, 'rgba(255, 246, 200, .95)');
            ctx.strokeStyle = g;
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(b.x - nx * 9, b.y - ny * 9);
            ctx.lineTo(b.x + nx * 2.5, b.y + ny * 2.5);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawParticles() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const k = Math.max(0, p.life / p.max);
            if (p.ring) {
                ctx.strokeStyle = 'rgba(' + p.hue + ', ' + (k * 0.5).toFixed(3) + ')';
                ctx.lineWidth = 2 * k + 0.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6 + (1 - k) * 26, 0, TAU);
                ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(' + p.hue + ', ' + (k * 0.85).toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * k + 0.3, 0, TAU);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawHud() {
        ctx.save();
        ctx.textBaseline = 'middle';

        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(140, 172, 208, .52)';
        ctx.font = '700 9px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '2px';
        ctx.fillText('SCORE', 22, 18);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eef5ff';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(String(score), 22, 40);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(140, 172, 208, .52)';
        ctx.font = '700 9px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '2px';
        ctx.fillText('WAVE', W - 22, 18);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = 'rgba(226, 240, 255, .92)';
        ctx.font = '800 16px ' + FONT;
        ctx.fillText('第 ' + wave + ' 波', W - 22, 40);

        // 生命图标
        for (let i = 0; i < 3; i++) {
            const x = W / 2 - 28 + i * 28;
            ctx.save();
            ctx.globalAlpha = i < lives ? 0.95 : 0.16;
            shipPath(x, 30, -Math.PI / 2, 0.74);
            ctx.fillStyle = 'rgba(16, 28, 44, .8)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(196, 228, 255, .92)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }

        const g = ctx.createLinearGradient(60, 0, W - 60, 0);
        g.addColorStop(0, 'rgba(110, 152, 200, 0)');
        g.addColorStop(0.5, 'rgba(120, 165, 220, .3)');
        g.addColorStop(1, 'rgba(110, 152, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(60, 60, W - 120, 1);

        ctx.restore();
    }

    function drawWaveBanner() {
        if (waveBanner <= 0 || state !== 'playing') return;
        const k = waveBanner > 1.35 ? (1.8 - waveBanner) / 0.45 : Math.min(1, waveBanner / 0.5);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, k));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 222, 150, .95)';
        ctx.font = '800 26px ' + FONT;
        ctx.fillText('第 ' + wave + ' 波', W / 2, H * 0.32);
        ctx.fillStyle = 'rgba(170, 200, 232, .7)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText('岩石 ×' + asteroids.length, W / 2, H * 0.32 + 30);
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05080f');
        g.addColorStop(0.5, '#070d18');
        g.addColorStop(1, '#04070d');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        drawStars();
        drawAsteroids();
        drawBullets();
        drawShip();
        drawParticles();
        drawWaveBanner();
        drawHud();
    }

    /* ---------- 输入 ---------- */
    const KEYMAP = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'thrust', KeyW: 'thrust',
        Space: 'fire'
    };

    window.addEventListener('keydown', function (e) {
        const k = KEYMAP[e.code];
        if (!k) return;
        e.preventDefault();
        if (state !== 'playing') {
            if (e.code === 'Space' && state === 'over') startGame();
            return;
        }
        keys[k] = true;
    });

    window.addEventListener('keyup', function (e) {
        const k = KEYMAP[e.code];
        if (!k) return;
        e.preventDefault();
        keys[k] = false;
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
