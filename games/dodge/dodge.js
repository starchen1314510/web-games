/* ==========================================================
   星尘闪避 Stardust Dodge
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const BEST_KEY = 'webgames.dodge.best';
    const PAD = 14;
    const TOP = 104;
    const HIT_R = 5;               // 判定半径小于视觉半径，容错更友好

    const COLORS = [
        ['#ff6b8b', '255, 107, 139'],
        ['#ffb454', '255, 180, 84'],
        ['#c58bff', '197, 139, 255'],
        ['#5fd8ff', '95, 216, 255'],
        ['#7affc4', '122, 255, 196']
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
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + w, y, x + w, y + h, rr);
        c.arcTo(x + w, y + h, x, y + h, rr);
        c.arcTo(x, y + h, x, y, rr);
        c.arcTo(x, y, x + w, y, rr);
        c.closePath();
    }

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function rand(a, b) {
        return a + Math.random() * (b - a);
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
        lives: document.getElementById('lives'),
        time: document.getElementById('time'),
        best: document.getElementById('best'),
        coins: document.getElementById('coins'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';           // ready | playing | over
    let elapsed = 0;
    let lives = 3;
    let stars = 0;
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);

    const player = {
        x: W / 2, y: H / 2 + 40,
        r: 9,
        vx: 0, vy: 0,
        inv: 0,
        trail: []
    };

    let target = null;             // 指针目标点
    const keys = {};
    let bullets = [];
    let pickups = [];
    let fx = [];
    let dust = [];                 // 背景星尘

    let spawnT = 1.1;
    let driftT = 0.6;
    let ringT = 7;
    let spiralT = 15;
    let starT = 2.6;
    let spiralA = 0;
    let shake = 0;
    let hudCache = '';
    let shownSec = -1;

    /* ---------- 初始化 ---------- */

    function makeDust() {
        dust = [];
        for (let i = 0; i < 64; i++) {
            dust.push({
                x: rand(0, W), y: rand(0, H),
                r: rand(0.5, 1.6),
                a: rand(0.12, 0.5),
                sp: rand(4, 18)
            });
        }
    }

    function begin() {
        state = 'playing';
        elapsed = 0;
        lives = 3;
        stars = 0;
        score = 0;
        bullets = [];
        pickups = [];
        fx = [];
        spawnT = 1.1;
        driftT = 0.6;
        ringT = 7;
        spiralT = 15;
        starT = 2.2;
        spiralA = 0;
        shake = 0;
        player.x = W / 2;
        player.y = H / 2 + 40;
        player.vx = 0;
        player.vy = 0;
        player.inv = 1;
        player.trail = [];
        target = null;
        hudCache = '';
        shownSec = -1;
        els.overlay.classList.remove('show');
        updateHud();
    }

    /* ---------- 子弹 ---------- */

    function shoot(x, y, ang, spd, r, ci) {
        bullets.push({
            x: x, y: y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: r || 5,
            ci: ci === undefined ? Math.floor(Math.random() * COLORS.length) : ci,
            spin: rand(-4, 4),
            rot: rand(0, TAU)
        });
    }

    function edgePoint() {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) return { x: rand(PAD, W - PAD), y: TOP + 4 };
        if (side === 1) return { x: W - PAD - 4, y: rand(TOP, H - PAD) };
        if (side === 2) return { x: rand(PAD, W - PAD), y: H - PAD - 4 };
        return { x: PAD + 4, y: rand(TOP, H - PAD) };
    }

    function aimedVolley() {
        const p = edgePoint();
        const base = Math.atan2(player.y - p.y, player.x - p.x);
        const n = elapsed > 45 ? 3 : (elapsed > 20 ? 2 : 1);
        const spd = Math.min(292, 126 + elapsed * 1.6);
        for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * 0.16;
            shoot(p.x, p.y, base + off, spd, 5.4);
        }
    }

    function ringBurst() {
        const p = {
            x: rand(W * 0.24, W * 0.76),
            y: rand(TOP + 60, H * 0.7)
        };
        const n = Math.min(18, 8 + Math.floor(elapsed / 14) * 2);
        const spd = Math.min(236, 104 + elapsed * 0.9);
        const base = rand(0, TAU);
        for (let i = 0; i < n; i++) {
            shoot(p.x, p.y, base + (i / n) * TAU, spd, 5);
        }
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            fx.push({
                x: p.x, y: p.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
                life: 0.4, max: 0.4, r: 2.4, ci: 2
            });
        }
    }

    function rainLine() {
        const y = TOP + 4;
        const gap = rand(PAD + 20, W - PAD - 60);
        const spd = Math.min(252, 142 + elapsed);
        for (let i = 0; i < 5; i++) {
            shoot(gap + i * 14, y, Math.PI / 2, spd, 4.4);
        }
    }

    function spiralBurst() {
        for (let i = 0; i < 3; i++) {
            const p = edgePoint();
            const a = Math.atan2(player.y - p.y, player.x - p.x) + Math.PI / 2;
            shoot(p.x, p.y, a + spiralA, 150, 4.6, 3);
            shoot(p.x, p.y, a + spiralA + Math.PI, 150, 4.6, 3);
            spiralA += 0.5;
        }
    }

    function spawnPickup() {
        pickups.push({
            x: rand(PAD + 26, W - PAD - 26),
            y: rand(TOP + 26, H - PAD - 26),
            r: 9,
            life: 5,
            max: 5,
            rot: rand(0, TAU)
        });
    }

    /* ---------- 逻辑 ---------- */

    function hurt() {
        if (player.inv > 0) return;
        lives--;
        player.inv = 1.7;
        shake = 14;
        for (let i = 0; i < 22; i++) {
            const a = rand(0, TAU);
            const s = rand(60, 260);
            fx.push({
                x: player.x, y: player.y,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0.55, max: 0.55, r: rand(1.6, 3.4), ci: 0
            });
        }
        bullets = bullets.filter(function (b) {
            const d = Math.hypot(b.x - player.x, b.y - player.y);
            return d > 88;
        });
        hudCache = '';
        updateHud();
        if (lives <= 0) gameOver();
    }

    function gameOver() {
        state = 'over';
        const secs = Math.floor(elapsed);
        const isBest = score > best;
        if (isBest) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        hudCache = '';
        updateHud();

        els.ovTitle.textContent = '星尘熄灭';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '坚持了 ' + fmt(secs) + '，捡到 ' + stars + ' 粒星尘。' +
            (isBest ? ' 新的最高分！' : ' 最高分 ' + best + '。');
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.textContent = '再来一次';
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        els.overlay.classList.add('show');
    }

    function step(dt) {
        if (state !== 'playing') {
            updateFx(dt);
            return;
        }

        elapsed += dt;

        /* 玩家移动：指针优先，键盘补充 */
        const acc = 2400;
        const maxV = 330;
        let ax = 0;
        let ay = 0;
        if (keys.left) ax -= 1;
        if (keys.right) ax += 1;
        if (keys.up) ay -= 1;
        if (keys.down) ay += 1;

        if (target) {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const d = Math.hypot(dx, dy);
            if (d > 2.5) {
                player.x += dx * Math.min(1, dt * 15);
                player.y += dy * Math.min(1, dt * 15);
            }
            player.vx = 0;
            player.vy = 0;
        } else if (ax || ay) {
            const l = Math.hypot(ax, ay);
            player.vx = clamp(player.vx + (ax / l) * acc * dt, -maxV, maxV);
            player.vy = clamp(player.vy + (ay / l) * acc * dt, -maxV, maxV);
            player.x += player.vx * dt;
            player.y += player.vy * dt;
        } else {
            player.vx *= 0.82;
            player.vy *= 0.82;
            player.x += player.vx * dt;
            player.y += player.vy * dt;
        }

        player.x = clamp(player.x, PAD + player.r, W - PAD - player.r);
        player.y = clamp(player.y, TOP + player.r, H - PAD - player.r);

        if (player.inv > 0) player.inv -= dt;

        player.trail.unshift({ x: player.x, y: player.y, t: 0.5 });
        if (player.trail.length > 16) player.trail.pop();
        for (let i = 0; i < player.trail.length; i++) player.trail[i].t -= dt;

        /* 出弹 */
        driftT -= dt;
        if (driftT <= 0) {
            driftT = 0.55;
            const d = edgePoint();
            const ang = Math.atan2(rand(TOP, H - PAD) - d.y, rand(PAD, W - PAD) - d.x);
            shoot(d.x, d.y, ang, rand(55, 86), 4.4);
        }

        spawnT -= dt;
        if (spawnT <= 0) {
            spawnT = Math.max(0.24, 0.88 - elapsed * 0.005);
            aimedVolley();
            if (elapsed > 26 && Math.random() < 0.34) rainLine();
        }

        if (elapsed > 15) {
            ringT -= dt;
            if (ringT <= 0) {
                ringT = Math.max(3.6, 8 - elapsed * 0.045);
                ringBurst();
            }
        }
        if (elapsed > 40) {
            spiralT -= dt;
            if (spiralT <= 0) {
                spiralT = rand(4.2, 6.4);
                spiralBurst();
            }
        }

        starT -= dt;
        if (starT <= 0) {
            starT = rand(2.4, 3.6);
            spawnPickup();
        }

        if (shake > 0) shake = Math.max(0, shake - dt * 40);

        /* 子弹推进与碰撞 */
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.rot += b.spin * dt;
            if (b.x < -26 || b.x > W + 26 || b.y < -26 || b.y > H + 26) {
                bullets.splice(i, 1);
                continue;
            }
            const d = Math.hypot(b.x - player.x, b.y - player.y);
            if (d < b.r + HIT_R) {
                bullets.splice(i, 1);
                hurt();
            }
        }

        /* 星尘 */
        for (let i = pickups.length - 1; i >= 0; i--) {
            const s = pickups[i];
            s.life -= dt;
            s.rot += dt * 1.6;
            if (s.life <= 0) {
                pickups.splice(i, 1);
                continue;
            }
            if (Math.hypot(s.x - player.x, s.y - player.y) < s.r + player.r + 4) {
                pickups.splice(i, 1);
                stars++;
                score += 10;
                for (let k = 0; k < 12; k++) {
                    const a = rand(0, TAU);
                    const sp = rand(40, 150);
                    fx.push({
                        x: s.x, y: s.y,
                        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                        life: 0.5, max: 0.5, r: rand(1.4, 2.8), ci: 4
                    });
                }
                hudCache = '';
                updateHud();
            }
        }

        /* 背景星尘 */
        for (let i = 0; i < dust.length; i++) {
            const d = dust[i];
            d.y += d.sp * dt;
            if (d.y > H) {
                d.y = -2;
                d.x = rand(0, W);
            }
        }

        updateFx(dt);

        const sec = Math.floor(elapsed);
        if (sec !== shownSec) {
            shownSec = sec;
            score += 1;
            hudCache = '';
            updateHud();
        }
    }

    function updateFx(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= dt;
            if (p.life <= 0) {
                fx.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
        }
    }

    /* ---------- 渲染 ---------- */

    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#080d1a');
        g.addColorStop(0.5, '#0a1020');
        g.addColorStop(1, '#04060e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, (TOP + H) / 2, 30, W / 2, (TOP + H) / 2, 400);
        halo.addColorStop(0, 'rgba(95, 216, 255, .10)');
        halo.addColorStop(1, 'rgba(95, 216, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < dust.length; i++) {
            const d = dust[i];
            ctx.fillStyle = 'rgba(180, 215, 255, ' + d.a + ')';
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, TAU);
            ctx.fill();
        }
    }

    function drawArena() {
        ctx.save();
        roundRectPath(ctx, PAD, TOP, W - PAD * 2, H - TOP - PAD, 18);
        ctx.fillStyle = 'rgba(7, 13, 24, .55)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(95, 216, 255, .18)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
    }

    function drawBullets() {
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            const col = COLORS[b.ci];
            ctx.save();
            ctx.translate(b.x, b.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r * 2.6);
            g.addColorStop(0, 'rgba(' + col[1] + ', .95)');
            g.addColorStop(0.45, 'rgba(' + col[1] + ', .38)');
            g.addColorStop(1, 'rgba(' + col[1] + ', 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, b.r * 2.6, 0, TAU);
            ctx.fill();
            ctx.fillStyle = col[0];
            ctx.beginPath();
            ctx.arc(0, 0, b.r * 0.62, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawPickups(t) {
        for (let i = 0; i < pickups.length; i++) {
            const s = pickups[i];
            const k = s.life / s.max;
            const pulse = 1 + Math.sin(t * 6 + s.rot) * 0.12;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot * 0.5);
            ctx.globalAlpha = 0.35 + k * 0.65;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 24 * pulse);
            g.addColorStop(0, 'rgba(122, 255, 196, .8)');
            g.addColorStop(1, 'rgba(122, 255, 196, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, 24 * pulse, 0, TAU);
            ctx.fill();

            ctx.strokeStyle = '#c8ffe6';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let k2 = 0; k2 < 4; k2++) {
                const a = (k2 / 4) * TAU;
                const r1 = 3.4 * pulse;
                const r2 = 11 * pulse;
                ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
                ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawPlayer() {
        ctx.save();
        if (player.inv > 0) {
            ctx.globalAlpha = 0.45 + Math.abs(Math.sin(player.inv * 22)) * 0.4;
        }
        for (let i = player.trail.length - 1; i >= 0; i--) {
            const p = player.trail[i];
            if (p.t <= 0) continue;
            const k = i / player.trail.length;
            ctx.save();
            ctx.globalAlpha = (1 - k) * 0.24 * Math.max(0, p.t / 0.5);
            ctx.fillStyle = '#7fd8ff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, player.r * (1 - k * 0.6), 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        const halo = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r * 3.4);
        halo.addColorStop(0, 'rgba(150, 235, 255, .55)');
        halo.addColorStop(1, 'rgba(120, 210, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r * 3.4, 0, TAU);
        ctx.fill();

        const body = ctx.createRadialGradient(player.x - 2, player.y - 3, 1,
            player.x, player.y, player.r);
        body.addColorStop(0, '#ffffff');
        body.addColorStop(0.5, '#9fe6ff');
        body.addColorStop(1, '#3a86c8');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = 'rgba(200, 245, 255, .8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r + 3 + Math.sin(elapsed * 8) * 1.2, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }

    function drawFx() {
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const k = p.life / p.max;
            const col = COLORS[p.ci];
            ctx.save();
            ctx.globalAlpha = k;
            ctx.fillStyle = col[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.8), 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawFrame() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(95, 216, 255, .45)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('STARDUST DODGE', W / 2, 26);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = 'rgba(200, 230, 250, .82)';
        ctx.font = '800 14px ' + FONT;
        ctx.fillText(fmt(elapsed), W / 2, 52);

        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = 'rgba(140, 185, 215, .65)';
        ctx.fillText('星尘 ' + stars + ' · 生命 ' + lives, W / 2, 70);

        /* 生命指示 */
        for (let i = 0; i < 3; i++) {
            const x = W / 2 - 22 + i * 22;
            const on = i < lives;
            ctx.beginPath();
            ctx.arc(x, 88, 4.2, 0, TAU);
            ctx.fillStyle = on ? '#ff6b8b' : 'rgba(120, 150, 180, .25)';
            ctx.fill();
        }
        ctx.restore();
    }

    function render(dt) {
        drawBg();
        if (shake > 0) {
            ctx.save();
            ctx.translate(rand(-shake, shake) * 0.4, rand(-shake, shake) * 0.4);
        }
        drawArena();
        ctx.save();
        roundRectPath(ctx, PAD, TOP, W - PAD * 2, H - TOP - PAD, 18);
        ctx.clip();
        drawPickups(elapsed);
        drawBullets();
        drawFx();
        if (state === 'playing' || state === 'over') drawPlayer();
        ctx.restore();
        if (shake > 0) ctx.restore();
        drawFrame();
    }

    /* ---------- HUD ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '生命耗尽';
        return '闪避中';
    }

    function updateHud() {
        const key = score + '|' + lives + '|' + stars + '|' + state + '|' + best + '|' + Math.floor(elapsed);
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.score.textContent = String(score);
        els.lives.textContent = String(Math.max(0, lives));
        els.coins.textContent = String(stars);
        els.best.textContent = String(best);
        els.time.textContent = fmt(elapsed);
        els.restartBtn.textContent = state === 'playing' ? '重新开始' : '换一局';
    }

    /* ---------- 输入 ---------- */

    function locate(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        return {
            x: clamp((e.clientX - rect.left) * (W / rect.width), 0, W),
            y: clamp((e.clientY - rect.top) * (H / rect.height), 0, H)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const p = locate(e);
        if (p) target = p;
    });

    canvas.addEventListener('pointermove', function (e) {
        const p = locate(e);
        if (p) target = p;
    });

    canvas.addEventListener('pointerleave', function () {
        target = null;
    });

    canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
    });

    const KEYMAP = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down'
    };

    window.addEventListener('keydown', function (e) {
        if (KEYMAP[e.code]) {
            keys[KEYMAP[e.code]] = true;
            target = null;
            e.preventDefault();
            return;
        }
        if (e.code === 'KeyR') {
            e.preventDefault();
            begin();
        } else if (e.code === 'Space' && state !== 'playing') {
            e.preventDefault();
            begin();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (KEYMAP[e.code]) {
            keys[KEYMAP[e.code]] = false;
            e.preventDefault();
        }
    });

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
        render(dt);
        requestAnimationFrame(frame);
    }

    makeDust();
    updateHud();
    requestAnimationFrame(frame);
})();
