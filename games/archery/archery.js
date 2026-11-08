/* ==========================================================
   射箭 Archery
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const BOW_X = 118;
    const BOW_Y = 438;
    const TARGET_X = 350;
    const TARGET_Y = 262;
    const GROUND_Y = 512;

    const RINGS = [12, 24, 38, 52, 66];
    const RING_SCORE = [10, 8, 6, 4, 2];
    const RING_FILL = ['#efe9db', '#232b3a', '#2f6fbf', '#d2413f', '#ffd166'];

    const G = 520;
    const WIND_ACC = 265;
    const CHARGE_TIME = 1.0;
    const SPEED_MIN = 380;
    const SPEED_MAX = 1000;
    const TOTAL_ARROWS = 8;

    const AIM_MIN = -1.30;
    const AIM_MAX = 0.10;

    const BEST_KEY = 'webgames.archery.best';

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        left: document.getElementById('left'),
        last: document.getElementById('last'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';
    let phase = 'idle';
    let aim = -0.72;
    let power = 0;
    let wind = 0;
    let arrowsLeft = TOTAL_ARROWS;
    let score = 0;
    let lastScore = null;
    let arrow = null;
    let stuck = [];
    let floaters = [];
    let resolveT = 0;
    let banner = null;
    let hudCache = '';
    let grass = [];

    /* ---------- 初始化 ---------- */
    function makeGrass() {
        grass = [];
        let x = 6;
        while (x < W) {
            grass.push({
                x: x,
                h: 5 + Math.random() * 9,
                lean: (Math.random() - 0.5) * 4
            });
            x += 7 + Math.random() * 9;
        }
    }

    function newWind() {
        wind = Math.random() * 2 - 1;
        if (Math.abs(wind) < 0.22) wind = wind < 0 ? -0.22 : 0.22;
    }

    function reset() {
        arrowsLeft = TOTAL_ARROWS;
        score = 0;
        lastScore = null;
        arrow = null;
        stuck = [];
        floaters = [];
        resolveT = 0;
        phase = 'idle';
        aim = -0.72;
        power = 0;
        banner = null;
        newWind();
        makeGrass();
        hudCache = '';
    }

    function startGame() {
        reset();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function updateHud() {
        const key = [score, arrowsLeft, lastScore, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.left.textContent = String(arrowsLeft);
        els.last.textContent = lastScore === null ? '--' : (lastScore === 0 ? '脱靶' : lastScore + ' 环');
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
    }

    /* ---------- 射击 ---------- */
    function aimAt(px, py) {
        const dx = px - BOW_X;
        const dy = py - BOW_Y;
        if (dx < 6) {
            aim = dy < 0 ? AIM_MIN : AIM_MAX;
            return;
        }
        aim = clamp(Math.atan2(dy, dx), AIM_MIN, AIM_MAX);
    }

    function shoot() {
        if (phase !== 'charge') return;
        const speed = SPEED_MIN + power * (SPEED_MAX - SPEED_MIN);
        arrow = {
            x: BOW_X + Math.cos(aim) * 26,
            y: BOW_Y + Math.sin(aim) * 26,
            vx: Math.cos(aim) * speed,
            vy: Math.sin(aim) * speed,
            trail: []
        };
        phase = 'fly';
        power = 0;
    }

    function ringScore(d) {
        for (let i = 0; i < RINGS.length; i++) {
            if (d <= RINGS[i]) return RING_SCORE[i];
        }
        return 0;
    }

    function finishShot(hitX, hitY, hit) {
        arrowsLeft--;
        let gained = 0;
        if (hit) {
            const d = Math.hypot(hitX - TARGET_X, hitY - TARGET_Y);
            gained = ringScore(d);
            stuck.push({ x: hitX, y: hitY, a: Math.atan2(hitY - BOW_Y, hitX - BOW_X) });
            if (stuck.length > 12) stuck.shift();
        }
        score += gained;
        lastScore = gained;
        floaters.push({
            x: hit ? TARGET_X : W / 2,
            y: hit ? TARGET_Y - 104 : GROUND_Y - 44,
            text: hit ? (gained === 10 ? '正中靶心 +10' : '+' + gained) : '脱靶',
            t: 1.1,
            color: hit ? (gained === 10 ? '#ffd166' : '#dff0ff') : '#ff8f8f'
        });
        arrow = null;
        resolveT = 0.7;
        phase = 'resolve';
        hudCache = '';
        updateHud();
    }

    function gameOver() {
        state = 'over';
        phase = 'idle';
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        banner = {
            t: 0,
            title: score >= 60 ? '神射手' : (score >= 40 ? '箭法不错' : '再练练手'),
            sub: '总分 ' + score + ' / 80 · 命中 ' + stuck.length + ' 箭',
            note: score > best ? '新纪录已保存' : '最高分 ' + best + ' · 按 R 再来一轮'
        };
        hudCache = '';
        updateHud();
    }

    /* ---------- 输入 ---------- */
    function localPoint(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (W / r.width),
            y: (e.clientY - r.top) * (H / r.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing' || phase !== 'idle') return;
        const p = localPoint(e);
        aimAt(p.x, p.y);
        phase = 'charge';
        power = 0;
    });

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'playing') return;
        if (phase === 'idle' || phase === 'charge') {
            const p = localPoint(e);
            aimAt(p.x, p.y);
        }
    });

    canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        if (phase === 'charge') shoot();
    });

    canvas.addEventListener('pointercancel', function () {
        if (phase === 'charge') {
            phase = 'idle';
            power = 0;
        }
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
            return;
        }
        if (state !== 'playing') {
            if (e.code === 'Enter') {
                e.preventDefault();
                startGame();
            }
            return;
        }
        if (e.code === 'ArrowUp') {
            e.preventDefault();
            aim = clamp(aim - 0.028, AIM_MIN, AIM_MAX);
            return;
        }
        if (e.code === 'ArrowDown') {
            e.preventDefault();
            aim = clamp(aim + 0.028, AIM_MIN, AIM_MAX);
            return;
        }
        if (e.code === 'Space') {
            e.preventDefault();
            if (phase === 'idle') {
                phase = 'charge';
                power = 0;
            }
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'Space' && state === 'playing' && phase === 'charge') {
            e.preventDefault();
            shoot();
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 逻辑 ---------- */
    function stepArrow(dt) {
        const steps = 6;
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
            if (!arrow) return;
            const px = arrow.x;
            const py = arrow.y;

            arrow.vy += G * h;
            arrow.vx += wind * WIND_ACC * h;
            arrow.x = px + arrow.vx * h;
            arrow.y = py + arrow.vy * h;
            arrow.trail.push({ x: arrow.x, y: arrow.y });
            if (arrow.trail.length > 12) arrow.trail.shift();

            // 靶面视为过靶心的垂直平面，取穿越点作为着弹点
            if (px < TARGET_X && arrow.x >= TARGET_X) {
                const t = (TARGET_X - px) / (arrow.x - px);
                const yc = py + (arrow.y - py) * t;
                if (Math.abs(yc - TARGET_Y) <= RINGS[4]) {
                    finishShot(TARGET_X, yc, true);
                    return;
                }
            }
            if (arrow.y > GROUND_Y) {
                finishShot(arrow.x, GROUND_Y, false);
                return;
            }
            if (arrow.x > W + 30 || arrow.x < -30 || arrow.y < -80) {
                finishShot(arrow.x, arrow.y, false);
                return;
            }
        }
    }

    function update(dt) {
        if (phase === 'charge') {
            power = Math.min(1, power + dt / CHARGE_TIME);
        }
        if (phase === 'fly') stepArrow(dt);
        if (phase === 'resolve') {
            resolveT -= dt;
            if (resolveT <= 0) {
                if (arrowsLeft <= 0) {
                    gameOver();
                } else {
                    phase = 'idle';
                    newWind();
                }
            }
        }
        for (let i = floaters.length - 1; i >= 0; i--) {
            floaters[i].t -= dt;
            floaters[i].y -= dt * 26;
            if (floaters[i].t <= 0) floaters.splice(i, 1);
        }
        if (banner) banner.t += dt;
        updateHud();
    }

    /* ---------- 绘制 ---------- */
    function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        g.addColorStop(0, '#0a1322');
        g.addColorStop(0.45, '#16243a');
        g.addColorStop(0.78, '#2e3648');
        g.addColorStop(1, '#4a4136');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, GROUND_Y + 2);

        const sun = ctx.createRadialGradient(300, 470, 8, 300, 470, 190);
        sun.addColorStop(0, 'rgba(255, 196, 120, .34)');
        sun.addColorStop(0.45, 'rgba(255, 160, 90, .12)');
        sun.addColorStop(1, 'rgba(255, 150, 90, 0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 180, W, GROUND_Y - 180);

        // 远山
        ctx.beginPath();
        ctx.moveTo(-10, 470);
        ctx.quadraticCurveTo(60, 386, 128, 452);
        ctx.quadraticCurveTo(190, 502, 250, 444);
        ctx.quadraticCurveTo(316, 382, 386, 448);
        ctx.quadraticCurveTo(438, 496, 500, 452);
        ctx.lineTo(500, GROUND_Y);
        ctx.lineTo(-10, GROUND_Y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(19, 33, 46, .92)';
        ctx.fill();

        // 近山
        ctx.beginPath();
        ctx.moveTo(-10, 496);
        ctx.quadraticCurveTo(80, 452, 168, 492);
        ctx.quadraticCurveTo(250, 528, 330, 486);
        ctx.quadraticCurveTo(404, 448, 500, 490);
        ctx.lineTo(500, GROUND_Y);
        ctx.lineTo(-10, GROUND_Y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(10, 20, 30, .95)';
        ctx.fill();

        const vg = ctx.createRadialGradient(W / 2, 300, 180, W / 2, 300, 420);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawGround() {
        const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
        g.addColorStop(0, '#22331f');
        g.addColorStop(0.35, '#16241a');
        g.addColorStop(1, '#080f0c');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(W, GROUND_Y);
        ctx.strokeStyle = 'rgba(160, 200, 150, .25)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(120, 170, 120, .32)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        for (let i = 0; i < grass.length; i++) {
            const b = grass[i];
            ctx.beginPath();
            ctx.moveTo(b.x, GROUND_Y + 1);
            ctx.quadraticCurveTo(b.x + b.lean * 0.5, GROUND_Y - b.h * 0.6, b.x + b.lean, GROUND_Y - b.h);
            ctx.stroke();
        }
    }

    function drawTarget() {
        // 支架
        ctx.save();
        ctx.strokeStyle = '#3b2b1c';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(TARGET_X - 12, TARGET_Y + 44);
        ctx.lineTo(TARGET_X - 34, GROUND_Y + 2);
        ctx.moveTo(TARGET_X + 12, TARGET_Y + 44);
        ctx.lineTo(TARGET_X + 34, GROUND_Y + 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120, 92, 60, .55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // 靶面阴影
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;
        ctx.beginPath();
        ctx.arc(TARGET_X, TARGET_Y, RINGS[4], 0, Math.PI * 2);
        ctx.fillStyle = '#efe9db';
        ctx.fill();
        ctx.restore();

        for (let i = RINGS.length - 1; i >= 0; i--) {
            ctx.beginPath();
            ctx.arc(TARGET_X, TARGET_Y, RINGS[i], 0, Math.PI * 2);
            ctx.fillStyle = RING_FILL[RINGS.length - 1 - i];
            ctx.fill();
        }

        // 环线
        ctx.strokeStyle = 'rgba(10, 12, 16, .35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < RINGS.length; i++) {
            ctx.beginPath();
            ctx.arc(TARGET_X, TARGET_Y, RINGS[i], 0, Math.PI * 2);
            ctx.stroke();
        }

        // 中心十字
        ctx.strokeStyle = 'rgba(120, 74, 10, .5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(TARGET_X - 5, TARGET_Y);
        ctx.lineTo(TARGET_X + 5, TARGET_Y);
        ctx.moveTo(TARGET_X, TARGET_Y - 5);
        ctx.lineTo(TARGET_X, TARGET_Y + 5);
        ctx.stroke();

        // 已中的箭
        for (let i = 0; i < stuck.length; i++) {
            const s = stuck[i];
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.a + Math.PI);
            ctx.strokeStyle = '#d9c08a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(26, 0);
            ctx.stroke();
            ctx.fillStyle = '#7fd8ff';
            ctx.beginPath();
            ctx.moveTo(26, 0);
            ctx.lineTo(20, -4);
            ctx.lineTo(20, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    function drawArcher() {
        const bob = phase === 'charge' ? -1 - power * 1.5 : 0;

        ctx.save();
        // 影子
        ctx.beginPath();
        ctx.ellipse(118, GROUND_Y + 3, 30, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, .38)';
        ctx.fill();

        // 双腿
        ctx.strokeStyle = '#16232f';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(115, 478 + bob);
        ctx.lineTo(106, GROUND_Y - 2);
        ctx.moveTo(116, 478 + bob);
        ctx.lineTo(131, GROUND_Y - 2);
        ctx.stroke();

        // 躯干
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(115, 480 + bob);
        ctx.lineTo(120, 432 + bob);
        ctx.stroke();

        // 披风侧光
        ctx.strokeStyle = 'rgba(255, 198, 128, .5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(123, 476 + bob);
        ctx.lineTo(127, 436 + bob);
        ctx.stroke();

        // 头
        ctx.beginPath();
        ctx.arc(122, 416 + bob, 11.5, 0, Math.PI * 2);
        ctx.fillStyle = '#16232f';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 198, 128, .6)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(122, 416 + bob, 11.5, -1.75, -0.35);
        ctx.stroke();

        // 前臂伸向弓把
        const gripX = BOW_X + Math.cos(aim) * 22;
        const gripY = BOW_Y + Math.sin(aim) * 22;
        ctx.strokeStyle = '#16232f';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(121, 436 + bob);
        ctx.lineTo(gripX, gripY);
        ctx.stroke();

        // 后臂拉弦
        const pull = 8 + power * 22;
        const bx = BOW_X + Math.cos(aim) * (10 - pull) - Math.sin(aim) * 6;
        const by = BOW_Y + Math.sin(aim) * (10 - pull) + Math.cos(aim) * 6;
        ctx.beginPath();
        ctx.moveTo(124, 441 + bob);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
    }

    function drawBow() {
        ctx.save();
        ctx.translate(BOW_X, BOW_Y);
        ctx.rotate(aim);

        // 瞄准虚线
        if (state === 'playing' && (phase === 'idle' || phase === 'charge')) {
            ctx.save();
            ctx.setLineDash([4, 7]);
            ctx.strokeStyle = 'rgba(255, 209, 102, ' + (0.16 + power * 0.42) + ')';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(26, 0);
            ctx.lineTo(26 + 54 + power * 40, 0);
            ctx.stroke();
            ctx.restore();
        }

        // 弓身
        ctx.beginPath();
        ctx.arc(-8, 0, 30, -1.2, 1.2);
        ctx.strokeStyle = '#c8913f';
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 224, 160, .55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const tipY = 30 * Math.sin(1.2);
        const tipX = -8 + 30 * Math.cos(1.2);
        const nock = 2.9 - 26 * power;

        // 弦
        ctx.beginPath();
        ctx.moveTo(tipX, -tipY);
        ctx.lineTo(nock, 0);
        ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = 'rgba(226, 236, 245, .8)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // 箭
        if (state === 'playing' && phase !== 'fly' && phase !== 'resolve') {
            ctx.beginPath();
            ctx.moveTo(nock, 0);
            ctx.lineTo(54, 0);
            ctx.strokeStyle = '#e6d3a8';
            ctx.lineWidth = 2.2;
            ctx.stroke();

            ctx.fillStyle = '#dfefff';
            ctx.beginPath();
            ctx.moveTo(62, 0);
            ctx.lineTo(52, -4.4);
            ctx.lineTo(52, 4.4);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(127, 216, 255, .9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(nock + 1, 0);
            ctx.lineTo(nock + 9, -5);
            ctx.moveTo(nock + 1, 0);
            ctx.lineTo(nock + 9, 5);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawArrow() {
        if (!arrow) return;
        ctx.save();
        for (let i = 0; i < arrow.trail.length; i++) {
            const t = arrow.trail[i];
            const k = (i + 1) / arrow.trail.length;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 1 + 2.6 * k, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(190, 230, 255, ' + (0.1 + 0.34 * k) + ')';
            ctx.fill();
        }

        const a = Math.atan2(arrow.vy, arrow.vx);
        ctx.translate(arrow.x, arrow.y);
        ctx.rotate(a);
        ctx.strokeStyle = '#f0dcb0';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(4, 0);
        ctx.stroke();
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(2, -4.4);
        ctx.lineTo(2, 4.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(127, 216, 255, .95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(-14, -5);
        ctx.moveTo(-22, 0);
        ctx.lineTo(-14, 5);
        ctx.stroke();
        ctx.restore();
    }

    function drawWind() {
        const x = 24;
        const y = 92;
        const w = 132;
        const h = 34;

        roundRectPath(ctx, x, y, w, h, 12);
        ctx.fillStyle = 'rgba(10, 18, 26, .72)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 190, 220, .18)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = 'rgba(160, 185, 210, .6)';
        ctx.fillText('侧风', x + 12, y + h / 2);

        const dir = wind > 0 ? 1 : -1;
        const cx = x + 52;
        const cy = y + h / 2;
        ctx.strokeStyle = 'rgba(130, 220, 255, .9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - dir * 10, cy);
        ctx.lineTo(cx + dir * 12, cy);
        ctx.moveTo(cx + dir * 12, cy);
        ctx.lineTo(cx + dir * 5, cy - 5);
        ctx.moveTo(cx + dir * 12, cy);
        ctx.lineTo(cx + dir * 5, cy + 5);
        ctx.stroke();

        const bars = Math.max(1, Math.round(Math.abs(wind) * 4));
        for (let i = 0; i < 4; i++) {
            const bh = 5 + i * 3.4;
            const bx = x + 78 + i * 11;
            roundRectPath(ctx, bx, cy + 9 - bh, 7, bh, 2);
            ctx.fillStyle = i < bars ? 'rgba(130, 220, 255, .85)' : 'rgba(130, 220, 255, .16)';
            ctx.fill();
        }
        ctx.restore();
    }

    function drawPower() {
        const x = 30;
        const y = 540;
        const w = 148;
        const h = 9;

        roundRectPath(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, .1)';
        ctx.fill();

        if (power > 0) {
            const g = ctx.createLinearGradient(x, 0, x + w, 0);
            g.addColorStop(0, 'rgba(127, 216, 255, .95)');
            g.addColorStop(0.65, 'rgba(255, 209, 102, .95)');
            g.addColorStop(1, 'rgba(255, 122, 90, .95)');
            roundRectPath(ctx, x, y, Math.max(h, w * power), h, h / 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = 'rgba(180, 200, 220, .55)';
        ctx.fillText('力度', x, y - 10);
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(power * 100) + '%', x + w, y - 10);
        ctx.restore();
    }

    function drawArrowsLeft() {
        const x = W - 26;
        const y = 92;
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = 'rgba(180, 200, 220, .55)';
        ctx.fillText('箭袋', x - 8, y + 12);

        for (let i = 0; i < TOTAL_ARROWS; i++) {
            const ax = x - i * 15;
            const ay = y + 32;
            ctx.strokeStyle = i < arrowsLeft ? 'rgba(230, 211, 168, .95)' : 'rgba(230, 211, 168, .18)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ax, ay - 7);
            ctx.lineTo(ax, ay + 7);
            ctx.stroke();
            ctx.fillStyle = i < arrowsLeft ? 'rgba(127, 216, 255, .9)' : 'rgba(127, 216, 255, .16)';
            ctx.beginPath();
            ctx.moveTo(ax, ay - 11);
            ctx.lineTo(ax - 3, ay - 5);
            ctx.lineTo(ax + 3, ay - 5);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(255, 196, 130, .48)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('ARCHERY', W / 2, 22);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#f6ecdc';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('射箭', W / 2, 46);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(210, 200, 182, .55)';
        ctx.fillText('按住蓄力 · 松开出箭 · 顶着风往上瞄', W / 2, 70);
        ctx.restore();
    }

    function drawFloaters() {
        for (let i = 0; i < floaters.length; i++) {
            const f = floaters[i];
            const a = Math.min(1, f.t * 1.6);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 15px ' + FONT;
            ctx.fillStyle = 'rgba(0, 0, 0, .45)';
            ctx.fillText(f.text, f.x + 1, f.y + 1);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
            ctx.restore();
        }
    }

    function drawBanner() {
        if (!banner) return;
        const k = Math.min(1, banner.t / 0.28);
        const ease = 1 - Math.pow(1 - k, 3);
        const bw = 320;
        const bh = 118;
        const x = (W - bw) / 2;
        const y = 236 + (1 - ease) * 18;

        ctx.save();
        ctx.globalAlpha = ease;
        ctx.shadowColor = 'rgba(0, 0, 0, .6)';
        ctx.shadowBlur = 24;
        roundRectPath(ctx, x, y, bw, bh, 16);
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, 'rgba(44, 34, 24, .98)');
        g.addColorStop(1, 'rgba(12, 10, 8, .98)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;

        roundRectPath(ctx, x, y, bw, bh, 16);
        ctx.strokeStyle = 'rgba(255, 209, 102, .42)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd166';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, y + 38);

        ctx.fillStyle = 'rgba(240, 232, 214, .84)';
        ctx.font = '700 13px ' + FONT;
        ctx.fillText(banner.sub, W / 2, y + 66);

        ctx.fillStyle = 'rgba(210, 196, 170, .6)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText(banner.note, W / 2, y + 91);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(196, 196, 178, .45)';
        ctx.fillText('按住画布瞄准并蓄力 · 松手射箭 · ↑↓ 微调角度', W / 2, 578);
        ctx.restore();
    }

    function draw() {
        drawSky();
        drawGround();
        drawTarget();
        drawArcher();
        drawBow();
        drawArrow();
        drawFloaters();
        drawWind();
        drawArrowsLeft();
        drawPower();
        drawHeader();
        drawFooter();
        drawBanner();
    }

    /* ---------- 主循环 ---------- */
    let last = 0;

    function loop(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        if (state === 'playing') update(dt);
        else if (banner) banner.t += dt;

        draw();
        requestAnimationFrame(loop);
    }

    reset();
    updateHud();
    requestAnimationFrame(loop);
})();
