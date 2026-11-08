/* ==========================================================
   迷你高尔夫 Mini Golf
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const PAD = 14;
    const R = 8.6;
    const HOLE_R = 15;
    const MAX_POWER = 1420;
    const MAX_DRAG = 150;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const BEST_KEY = 'webgames.golf.best';
    const LAST_KEY = 'webgames.golf.last';

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

    function len(x, y) {
        return Math.sqrt(x * x + y * y);
    }

    const LEVELS = [
        {
            par: 2,
            start: { x: 240, y: 520 },
            hole: { x: 240, y: 118 },
            walls: [
                { x: 136, y: 300, w: 86, h: 18 },
                { x: 258, y: 300, w: 86, h: 18 }
            ],
            sand: [{ x: 196, y: 356, w: 88, h: 62 }],
            water: []
        },
        {
            par: 3,
            start: { x: 96, y: 522 },
            hole: { x: 384, y: 116 },
            walls: [
                { x: 60, y: 300, w: 250, h: 17 },
                { x: 250, y: 300, w: 170, h: 17 },
                { x: 60, y: 300, w: 17, h: 130 }
            ],
            sand: [],
            water: [{ x: 300, y: 396, w: 150, h: 74 }]
        },
        {
            par: 3,
            start: { x: 240, y: 532 },
            hole: { x: 240, y: 104 },
            walls: [
                { x: 96, y: 380, w: 128, h: 16 },
                { x: 256, y: 380, w: 128, h: 16 },
                { x: 96, y: 220, w: 128, h: 16 },
                { x: 256, y: 220, w: 128, h: 16 }
            ],
            sand: [{ x: 200, y: 268, w: 80, h: 96 }],
            water: []
        },
        {
            par: 4,
            start: { x: 240, y: 540 },
            hole: { x: 240, y: 96 },
            walls: [
                { x: 60, y: 330, w: 150, h: 16 },
                { x: 270, y: 330, w: 150, h: 16 },
                { x: 60, y: 188, w: 132, h: 16 },
                { x: 288, y: 188, w: 132, h: 16 }
            ],
            sand: [],
            water: [{ x: 148, y: 402, w: 184, h: 82 }]
        },
        {
            par: 4,
            start: { x: 66, y: 540 },
            hole: { x: 414, y: 92 },
            walls: [
                { x: 60, y: 452, w: 236, h: 16 },
                { x: 184, y: 350, w: 236, h: 16 },
                { x: 60, y: 248, w: 236, h: 16 },
                { x: 184, y: 150, w: 150, h: 16 },
                { x: 380, y: 196, w: 16, h: 120 }
            ],
            sand: [{ x: 300, y: 392, w: 120, h: 56 }],
            water: [{ x: 320, y: 470, w: 110, h: 66 }]
        }
    ];

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        level: document.getElementById('level'),
        strokes: document.getElementById('strokes'),
        par: document.getElementById('par'),
        total: document.getElementById('total'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        retryBtn: document.getElementById('retry-btn'),
        skipBtn: document.getElementById('skip-btn')
    };

    let li = 0;
    let level = LEVELS[0];
    let ball = { x: 0, y: 0 };
    let vel = { x: 0, y: 0 };
    let strokes = 0;
    let totalStrokes = 0;
    let totalPar = 0;
    let state = 'ready';
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let dragNow = { x: 0, y: 0 };
    let dragOk = false;
    let sinkT = 0;
    let sinkPos = { x: 0, y: 0 };
    let particles = [];
    let texts = [];
    let clock = 0;
    let hudCache = '';
    let flagWave = 0;
    let ballRot = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || -99);

    /* ---------- 关卡 ---------- */
    function loadLevel(i) {
        li = i;
        level = LEVELS[i];
        ball.x = level.start.x;
        ball.y = level.start.y;
        vel.x = 0;
        vel.y = 0;
        strokes = 0;
        dragging = false;
        dragOk = false;
        sinkT = 0;
        particles = [];
        texts = [];
        state = 'playing';
        hudCache = '';
        hideOverlay();
        updateHud();
    }

    function restartLevel() {
        ball.x = level.start.x;
        ball.y = level.start.y;
        vel.x = 0;
        vel.y = 0;
        dragging = false;
        dragOk = false;
        sinkT = 0;
        state = 'playing';
        updateHud();
    }

    function nextLevel() {
        if (li + 1 >= LEVELS.length) {
            finishCourse();
            return;
        }
        loadLevel(li + 1);
    }

    function finishCourse() {
        state = 'done';
        const diff = totalStrokes - totalPar;
        let title = '全场结束';
        if (diff <= -2) title = '低于标准杆';
        else if (diff < 0) title = '小幅领先';
        else if (diff === 0) title = '正好打平';
        else title = '继续练习';
        els.ovTitle.textContent = title;
        els.ovTitle.classList.toggle('danger', false);
        els.ovDesc.textContent = '你用了 ' + totalStrokes + ' 杆，标准杆 ' + totalPar + ' 杆。';
        els.ovScore.innerHTML = '成绩 <b>' + (diff > 0 ? '+' + diff : diff) + '</b>';
        els.ovBtn.textContent = '再打一轮';
        els.overlay.classList.add('show');
        localStorage.setItem(LAST_KEY, String(diff));
        if (best === -99 || diff < best) {
            best = diff;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();
    }

    function showOverlay(title, desc, btn) {
        els.ovTitle.textContent = title;
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = desc;
        els.ovScore.innerHTML = '';
        els.ovBtn.textContent = btn;
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function updateHud() {
        const key = li + '|' + strokes + '|' + totalStrokes + '|' + state;
        if (key === hudCache) return;
        hudCache = key;
        els.level.textContent = (li + 1) + ' / ' + LEVELS.length;
        els.strokes.textContent = String(strokes);
        els.par.textContent = String(level.par);
        els.total.textContent = totalStrokes + ' 杆';
        els.best.textContent = best === -99 ? '—' : (best > 0 ? '+' + best : String(best));
    }

    /* ---------- 物理 ---------- */
    function inRect(x, y, r) {
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    function inSand(x, y) {
        for (let i = 0; i < level.sand.length; i++) {
            if (inRect(x, y, level.sand[i])) return true;
        }
        return false;
    }

    function bounceBox(b) {
        const cx = clamp(ball.x, b.x, b.x + b.w);
        const cy = clamp(ball.y, b.y, b.y + b.h);
        let dx = ball.x - cx;
        let dy = ball.y - cy;
        let d = len(dx, dy);
        if (d >= R) return false;
        if (d < 0.0001) {
            const left = ball.x - b.x;
            const right = b.x + b.w - ball.x;
            const top = ball.y - b.y;
            const bottom = b.y + b.h - ball.y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) { dx = -1; dy = 0; }
            else if (m === right) { dx = 1; dy = 0; }
            else if (m === top) { dx = 0; dy = -1; }
            else { dx = 0; dy = 1; }
            d = 1;
        }
        const nx = dx / d;
        const ny = dy / d;
        ball.x = cx + nx * (R + 0.2);
        ball.y = cy + ny * (R + 0.2);
        const vn = vel.x * nx + vel.y * ny;
        if (vn < 0) {
            vel.x -= 1.82 * vn * nx;
            vel.y -= 1.82 * vn * ny;
        }
        return true;
    }

    function checkWater() {
        for (let i = 0; i < level.water.length; i++) {
            if (inRect(ball.x, ball.y, level.water[i])) {
                strokes += 1;
                ball.x = level.start.x;
                ball.y = level.start.y;
                vel.x = 0;
                vel.y = 0;
                texts.push({ x: W / 2, y: H / 2, text: '落水 +1 杆', life: 1.3, max: 1.3, size: 18 });
                updateHud();
                return true;
            }
        }
        return false;
    }

    function stepPhysics(dt) {
        const steps = 6;
        const s = dt / steps;
        for (let i = 0; i < steps; i++) {
            ball.x += vel.x * s;
            ball.y += vel.y * s;

            if (ball.x - R < PAD) {
                ball.x = PAD + R;
                vel.x = Math.abs(vel.x) * 0.84;
            } else if (ball.x + R > W - PAD) {
                ball.x = W - PAD - R;
                vel.x = -Math.abs(vel.x) * 0.84;
            }
            if (ball.y - R < PAD) {
                ball.y = PAD + R;
                vel.y = Math.abs(vel.y) * 0.84;
            } else if (ball.y + R > H - PAD) {
                ball.y = H - PAD - R;
                vel.y = -Math.abs(vel.y) * 0.84;
            }

            for (let k = 0; k < level.walls.length; k++) bounceBox(level.walls[k]);

            const f = inSand(ball.x, ball.y) ? 0.03 : 0.2;
            const damp = Math.pow(f, s);
            vel.x *= damp;
            vel.y *= damp;

            const sp = len(vel.x, vel.y);
            if (sp < 6) {
                vel.x = 0;
                vel.y = 0;
            }
            if (checkWater()) return;

            const hd = len(ball.x - level.hole.x, ball.y - level.hole.y);
            if (hd < HOLE_R - 3) {
                sink(sp);
                return;
            }
        }

        const sp2 = len(vel.x, vel.y);
        if (sp2 > 0) ballRot += sp2 * dt * 0.04;
    }

    function sink(speed) {
        if (speed > 900) {
            ball.x += vel.x * 0.016;
            ball.y += vel.y * 0.016;
            return;
        }
        sinkT = 0;
        sinkPos = { x: ball.x, y: ball.y };
        vel.x = 0;
        vel.y = 0;
        totalStrokes += strokes;
        for (let i = 0; i < 16; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 90;
            particles.push({
                x: ball.x,
                y: ball.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 30,
                life: 0.7 + Math.random() * 0.4,
                max: 1.1,
                r: 1.4 + Math.random() * 2
            });
        }
        const diff = strokes - level.par;
        const word = diff <= -2 ? '老鹰球！' : (diff === -1 ? '小鸟球！' : (diff === 0 ? '标准杆' : (diff === 1 ? '柏忌' : '+' + diff)));
        texts.push({ x: W / 2, y: H / 2 - 20, text: word, life: 1.6, max: 1.6, size: 26 });
        texts.push({ x: W / 2, y: H / 2 + 14, text: strokes + ' 杆 / 标准 ' + level.par, life: 1.6, max: 1.6, size: 15 });
        state = 'sink';
        sinkT = 1.5;
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        flagWave += dt * 2.4;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 120 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }

        if (state === 'playing') {
            if (vel.x !== 0 || vel.y !== 0) stepPhysics(dt);
        } else if (state === 'sink') {
            sinkT -= dt;
            if (sinkT <= 0) {
                updateHud();
                if (li + 1 >= LEVELS.length) finishCourse();
                else loadLevel(li + 1);
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawCourse() {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#1a3b2d');
        g.addColorStop(0.5, '#153025');
        g.addColorStop(1, '#1b3f30');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.globalAlpha = 0.032;
        ctx.strokeStyle = '#bfe8cf';
        ctx.lineWidth = 10;
        for (let i = -H; i < W + H; i += 46) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + H, H);
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(150, 220, 180, .22)';
        ctx.lineWidth = 2;
        roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, 12);
        ctx.stroke();
        ctx.restore();
    }

    function drawGreen() {
        const h = level.hole;
        ctx.save();
        const g = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, 58);
        g.addColorStop(0, 'rgba(132, 214, 168, .26)');
        g.addColorStop(0.6, 'rgba(132, 214, 168, .1)');
        g.addColorStop(1, 'rgba(132, 214, 168, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 58, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawSand() {
        for (let i = 0; i < level.sand.length; i++) {
            const s = level.sand[i];
            const cx = s.x + s.w / 2;
            const cy = s.y + s.h / 2;
            const rx = s.w / 2;
            const ry = s.h / 2;
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, .16)';
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy + 4, rx, ry, 0, 0, TAU);
            ctx.fill();

            const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 5, cx, cy, rx);
            g.addColorStop(0, 'rgba(232, 212, 166, .92)');
            g.addColorStop(1, 'rgba(176, 146, 94, .9)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(120, 96, 56, .32)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.globalAlpha = 0.34;
            ctx.fillStyle = '#fff6dd';
            for (let k = 0; k < 18; k++) {
                const a = k * 2.3;
                const rr = 0.16 + ((k * 37) % 62) / 100;
                const px = cx + Math.cos(a) * rx * rr;
                const py = cy + Math.sin(a * 1.4) * ry * rr;
                ctx.beginPath();
                ctx.arc(px, py, 1.1, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function drawWater() {
        for (let i = 0; i < level.water.length; i++) {
            const w = level.water[i];
            ctx.save();
            const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
            g.addColorStop(0, 'rgba(58, 130, 190, .72)');
            g.addColorStop(1, 'rgba(30, 86, 140, .78)');
            ctx.fillStyle = g;
            roundRect(w.x, w.y, w.w, w.h, 14);
            ctx.fill();
            ctx.strokeStyle = 'rgba(160, 220, 255, .35)';
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.globalAlpha = 0.32;
            ctx.strokeStyle = '#cfeaff';
            ctx.lineWidth = 1.6;
            for (let k = 0; k < 3; k++) {
                const yy = w.y + 16 + k * (w.h - 26) / 2.4;
                ctx.beginPath();
                for (let x = w.x + 8; x < w.x + w.w - 8; x += 4) {
                    const yy2 = yy + Math.sin((x * 0.09) + clock * 2 + k) * 3;
                    if (x === w.x + 8) ctx.moveTo(x, yy2);
                    else ctx.lineTo(x, yy2);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    function drawWalls() {
        for (let i = 0; i < level.walls.length; i++) {
            const b = level.walls[i];
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, .32)';
            roundRect(b.x + 2, b.y + 4, b.w, b.h, 6);
            ctx.fill();
            const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
            g.addColorStop(0, '#2b4438');
            g.addColorStop(0.55, '#1d3027');
            g.addColorStop(1, '#131f19');
            ctx.fillStyle = g;
            roundRect(b.x, b.y, b.w, b.h, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(116, 168, 142, .34)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = 'rgba(172, 220, 192, .28)';
            roundRect(b.x + 2.5, b.y + 2, b.w - 5, 3, 1.5);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawHole() {
        const h = level.hole;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        ctx.beginPath();
        ctx.ellipse(h.x + 3, h.y + 4, HOLE_R, HOLE_R * 0.9, 0, 0, TAU);
        ctx.fill();

        const g = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, HOLE_R);
        g.addColorStop(0, '#05090c');
        g.addColorStop(0.72, '#0a1216');
        g.addColorStop(1, '#1c2b24');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, HOLE_R, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 240, 215, .32)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        const wave = Math.sin(flagWave) * 3;
        ctx.strokeStyle = 'rgba(232, 244, 255, .8)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y - 2);
        ctx.lineTo(h.x, h.y - 52);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(h.x + 1, h.y - 52);
        ctx.lineTo(h.x + 26 + wave, h.y - 43);
        ctx.lineTo(h.x + 1, h.y - 33);
        ctx.closePath();
        ctx.fillStyle = '#ff5c6c';
        ctx.fill();
        ctx.restore();
    }

    function drawBall() {
        if (state === 'sink') {
            const k = clamp(1 - sinkT / 1.5, 0, 1);
            const s = 1 - k * 0.85;
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.7;
            ctx.translate(sinkPos.x, sinkPos.y);
            ctx.scale(s, s);
            ctx.fillStyle = '#f4f9ff';
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, TAU);
            ctx.fill();
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, .32)';
        ctx.beginPath();
        ctx.ellipse(ball.x + 1.6, ball.y + 2.6, R * 1.05, R * 0.92, 0, 0, TAU);
        ctx.fill();

        const g = ctx.createRadialGradient(ball.x - R * 0.4, ball.y - R * 0.45, R * 0.2, ball.x, ball.y, R);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.72, '#eef4fc');
        g.addColorStop(1, '#c3d2e2');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, R, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 178, 205, .7)';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.globalAlpha = 0.26;
        ctx.strokeStyle = '#8fa3ba';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, R * (0.35 + i * 0.22), ballRot + i * 1.1, ballRot + i * 1.1 + 1.5);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAim() {
        if (!dragging) return;
        let dx = dragStart.x - dragNow.x;
        let dy = dragStart.y - dragNow.y;
        const d = len(dx, dy);
        if (d < 4) return;
        const power = Math.min(1, d / MAX_DRAG);
        const nx = dx / d;
        const ny = dy / d;
        const far = 40 + power * 120;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 236, 160, .55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(ball.x + nx * (R + 4), ball.y + ny * (R + 4));
        ctx.lineTo(ball.x + nx * (R + 4 + far), ball.y + ny * (R + 4 + far));
        ctx.stroke();
        ctx.setLineDash([]);

        const ax = ball.x + nx * (R + 6 + far);
        const ay = ball.y + ny * (R + 6 + far);
        ctx.translate(ax, ay);
        ctx.rotate(Math.atan2(ny, nx));
        ctx.fillStyle = 'rgba(255, 236, 160, .82)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-11, -5.5);
        ctx.lineTo(-11, 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        const bw = 128;
        const bx = W / 2 - bw / 2;
        const by = H - 40;
        ctx.fillStyle = 'rgba(6, 14, 12, .62)';
        roundRect(bx - 3, by - 3, bw + 6, 16, 8);
        ctx.fill();
        const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        pg.addColorStop(0, '#5ce08f');
        pg.addColorStop(0.6, '#ffd166');
        pg.addColorStop(1, '#ff5c6c');
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = pg;
        roundRect(bx, by, bw, 10, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pg;
        roundRect(bx, by, Math.max(6, bw * power), 10, 5);
        ctx.fill();
        ctx.restore();
    }

    function drawParticles() {
        ctx.save();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
            ctx.fillStyle = '#ffe9a8';
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
            ctx.fillStyle = 'rgba(244, 252, 236, .96)';
            ctx.font = '700 ' + t.size + 'px ' + FONT;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawHudOnCanvas() {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = 'rgba(190, 232, 210, .68)';
        ctx.fillText('第 ' + (li + 1) + ' 关 · 标准杆 ' + level.par, PAD + 10, PAD + 18);
        ctx.textAlign = 'right';
        ctx.fillText(strokes + ' 杆', W - PAD - 10, PAD + 18);
        ctx.restore();
    }

    function render() {
        drawCourse();
        drawGreen();
        drawSand();
        drawWater();
        drawWalls();
        drawHole();
        drawBall();
        drawParticles();
        drawAim();
        drawHudOnCanvas();
        drawTexts();
    }

    /* ---------- 循环 ---------- */
    let last = performance.now();

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        render();
        window.requestAnimationFrame(loop);
    }

    /* ---------- 交互 ---------- */
    function pos(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        if (vel.x !== 0 || vel.y !== 0) return;
        const p = pos(e);
        dragging = true;
        dragStart = p;
        dragNow = p;
        dragOk = len(p.x - ball.x, p.y - ball.y) < 120;
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        e.preventDefault();
        const p = pos(e);
        let dx = p.x - dragStart.x;
        let dy = p.y - dragStart.y;
        const d = len(dx, dy);
        if (d > MAX_DRAG) {
            dx = dx / d * MAX_DRAG;
            dy = dy / d * MAX_DRAG;
        }
        dragNow = { x: dragStart.x + dx, y: dragStart.y + dy };
    });

    function release() {
        if (!dragging) return;
        dragging = false;
        if (!dragOk || state !== 'playing') return;
        const dx = dragStart.x - dragNow.x;
        const dy = dragStart.y - dragNow.y;
        const d = len(dx, dy);
        if (d < 10) return;
        const power = Math.min(1, d / MAX_DRAG);
        vel.x = dx / d * power * MAX_POWER;
        vel.y = dy / d * power * MAX_POWER;
        strokes += 1;
        updateHud();
    }

    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', release);

    window.addEventListener('keydown', function (e) {
        if (e.key === 'r' || e.key === 'R') {
            if (state === 'playing') restartLevel();
            e.preventDefault();
        }
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'done') {
            totalStrokes = 0;
            totalPar = 0;
            for (let i = 0; i < LEVELS.length; i++) totalPar += LEVELS[i].par;
            loadLevel(0);
        } else {
            loadLevel(0);
        }
    });
    els.retryBtn.addEventListener('click', function () {
        if (state === 'playing') restartLevel();
    });
    els.skipBtn.addEventListener('click', function () {
        if (state !== 'playing') return;
        totalStrokes += level.par;
        if (li + 1 >= LEVELS.length) finishCourse();
        else loadLevel(li + 1);
    });

    /* ---------- 启动 ---------- */
    for (let i = 0; i < LEVELS.length; i++) totalPar += LEVELS[i].par;
    ball.x = level.start.x;
    ball.y = level.start.y;
    updateHud();
    showOverlay('迷你高尔夫',
        '按住球往后拉，松手击球。力度越大滚得越远，沙地减速、水塘罚一杆。把球打进洞里。', '开始第一关');
    window.requestAnimationFrame(loop);
})();
