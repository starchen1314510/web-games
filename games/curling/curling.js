/* ==========================================================
   冰壶 Curling
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

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

    function dist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        round: document.getElementById('round'),
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        rank: document.getElementById('rank'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* 场地参数 */
    const MARGIN = 22;
    const SHEET_W = W - MARGIN * 2;
    const SHEET_H = H - 180;
    const SHEET_X = MARGIN;
    const SHEET_Y = 120;
    const TARGET = { x: W / 2, y: SHEET_Y + 90 };
    const START = { x: W / 2, y: SHEET_Y + SHEET_H - 50 };
    const STONE_R = 16;
    const MAX_DRAG = 110;
    const MAX_SPEED = 520;
    const FRICTION = 140;
    const ROUNDS = 3;

    let state = 'ready';       // ready | play | aiming | sliding | stopped | over
    let round = 1;
    let shots = [];
    let currentScore = 0;
    let best = -1;
    let stone = { x: START.x, y: START.y, vx: 0, vy: 0 };
    let dragStart = null;
    let dragCurrent = null;
    let aimPower = 0;
    let aimAngle = -Math.PI / 2;
    let parts = [];
    let trail = [];
    let banner = '';
    let bannerT = 0;
    let bannerCol = '#dff4ff';
    let hudCache = '';
    let t = 0;

    function resetStone() {
        stone.x = START.x;
        stone.y = START.y;
        stone.vx = 0;
        stone.vy = 0;
        trail = [];
    }

    function startGame() {
        state = 'aiming';
        round = 1;
        shots = [];
        currentScore = 0;
        resetStone();
        dragStart = null;
        dragCurrent = null;
        aimPower = 0;
        parts = [];
        banner = '';
        bannerT = 0;
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        hudCache = '';
        updateHud();
    }

    function rankText(score) {
        if (score >= 950) return '完美一击';
        if (score >= 800) return '神准';
        if (score >= 600) return '漂亮';
        if (score >= 400) return '不错';
        if (score > 0) return '还行';
        return '脱靶';
    }

    function scoreFor(d) {
        if (d > 160) return 0;
        return Math.max(0, Math.round(1000 - d * d / 25.6));
    }

    function endRound() {
        const outOfBounds = stone.x < SHEET_X - 20 || stone.x > SHEET_X + SHEET_W + 20 ||
            stone.y < SHEET_Y - 20 || stone.y > SHEET_Y + SHEET_H + 20;
        const d = outOfBounds ? 999 : dist(stone, TARGET);
        const s = outOfBounds ? 0 : scoreFor(d);
        currentScore = Math.max(currentScore, s);
        shots.push({ x: stone.x, y: stone.y, score: s, d: d });

        if (s > 0 && (best < 0 || s > best)) {
            best = s;
            try { localStorage.setItem('webgames.curling.best', String(best)); } catch (e) { }
        }

        banner = s > 0 ? '+' + s + ' 分' : '脱靶';
        bannerCol = s >= 800 ? '#7dffc8' : (s >= 400 ? '#ffd166' : '#ffa3ad');
        bannerT = 1.4;

        for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU;
            const sp = 30 + Math.random() * 90;
            parts.push({
                x: stone.x, y: stone.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.3 + Math.random() * 0.4, max: 0.7,
                col: s >= 800 ? '#7dffc8' : '#dff4ff'
            });
        }

        state = 'stopped';
        hudCache = '';
        updateHud();

        if (round >= ROUNDS) {
            gameOver();
        } else {
            round++;
            setTimeout(function () {
                if (state !== 'over') {
                    resetStone();
                    state = 'aiming';
                    updateHud();
                }
            }, 800);
        }
    }

    function gameOver() {
        state = 'over';
        els.ovTitle.textContent = '本局结束';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '最高得分 ' + currentScore + ' 分，评级「' + rankText(currentScore) +
            '」。历史最佳 ' + Math.max(0, best) + ' 分。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(currentScore);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 交互 ---------- */

    function toCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    function onDown(e) {
        if (e) e.preventDefault();
        if (state !== 'aiming') return;
        const p = toCanvasPos(e);
        const d = Math.hypot(p.x - stone.x, p.y - stone.y);
        if (d > STONE_R * 2.5) return;
        dragStart = { x: stone.x, y: stone.y };
        dragCurrent = p;
    }

    function onMove(e) {
        if (state !== 'aiming' || !dragStart) return;
        dragCurrent = toCanvasPos(e);
    }

    function onUp(e) {
        if (state !== 'aiming' || !dragStart) return;
        if (aimPower > 0.08) {
            const speed = aimPower * MAX_SPEED;
            stone.vx = Math.cos(aimAngle) * speed;
            stone.vy = Math.sin(aimAngle) * speed;
            state = 'sliding';
        }
        dragStart = null;
        dragCurrent = null;
        aimPower = 0;
        updateHud();
    }

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') startGame();
    });

    els.ovBtn.addEventListener('click', startGame);
    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '本局结束';
        if (state === 'sliding') return '冰壶滑行中';
        if (state === 'stopped') return '计算得分';
        if (dragStart) return '松开掷出';
        return '拖拽冰壶瞄准';
    }

    function updateHud() {
        if (dragStart && dragCurrent) {
            const dx = dragStart.x - dragCurrent.x;
            const dy = dragStart.y - dragCurrent.y;
            const raw = Math.hypot(dx, dy);
            aimPower = clamp(raw / MAX_DRAG, 0, 1);
            if (raw > 2) aimAngle = Math.atan2(-dy, -dx);
        }
        const key = state + '|' + round + '|' + currentScore + '|' + best + '|' + aimPower.toFixed(2);
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.round.textContent = round + ' / ' + ROUNDS;
        els.score.textContent = currentScore > 0 ? String(currentScore) : '--';
        els.best.textContent = best >= 0 ? String(best) : '--';
        els.rank.textContent = state === 'ready' ? '--' : rankText(currentScore);
        els.restartBtn.textContent = state === 'ready' ? '开始挑战' : '重新开始';
    }

    /* ---------- 绘制 ---------- */

    function drawSheet() {
        ctx.fillStyle = '#0d1a22';
        roundRect(ctx, SHEET_X - 6, SHEET_Y - 6, SHEET_W + 12, SHEET_H + 12, 12);
        ctx.fill();

        const g = ctx.createLinearGradient(SHEET_X, SHEET_Y, SHEET_X, SHEET_Y + SHEET_H);
        g.addColorStop(0, '#1c3a4a');
        g.addColorStop(0.5, '#244b5e');
        g.addColorStop(1, '#1c3a4a');
        ctx.fillStyle = g;
        roundRect(ctx, SHEET_X, SHEET_Y, SHEET_W, SHEET_H, 8);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, .08)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
            const y = SHEET_Y + i * (SHEET_H / 6);
            ctx.beginPath();
            ctx.moveTo(SHEET_X + 10, y);
            ctx.lineTo(SHEET_X + SHEET_W - 10, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, .12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(SHEET_X + SHEET_W / 2, SHEET_Y + 20);
        ctx.lineTo(SHEET_X + SHEET_W / 2, SHEET_Y + SHEET_H - 20);
        ctx.stroke();

        drawHouse(TARGET.x, TARGET.y);
    }

    function drawHouse(x, y) {
        const rings = [
            { r: 70, col: 'rgba(255, 255, 255, .10)' },
            { r: 52, col: 'rgba(255, 255, 255, .16)' },
            { r: 34, col: 'rgba(255, 120, 120, .28)' },
            { r: 16, col: 'rgba(255, 80, 80, .55)' }
        ];
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(x, y, rings[i].r, 0, TAU);
            ctx.fillStyle = rings[i].col;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, .18)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, TAU);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }

    function roundRect(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.lineTo(x + w - rr, y);
        c.arcTo(x + w, y, x + w, y + rr, rr);
        c.lineTo(x + w, y + h - rr);
        c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
        c.lineTo(x + rr, y + h);
        c.arcTo(x, y + h, x, y + h - rr, rr);
        c.lineTo(x, y + rr);
        c.arcTo(x, y, x + rr, y, rr);
        c.closePath();
    }

    function drawStone(s, alpha) {
        const a = alpha === undefined ? 1 : alpha;
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(s.x - 5, s.y - 5, 2, s.x, s.y, STONE_R);
        g.addColorStop(0, '#e8f4ff');
        g.addColorStop(0.4, '#9dd0ff');
        g.addColorStop(1, '#3a7fc4');
        ctx.beginPath();
        ctx.arc(s.x, s.y, STONE_R, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, STONE_R - 5, 0, TAU);
        ctx.strokeStyle = 'rgba(255, 255, 255, .2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function drawAim() {
        if (!dragStart || state !== 'aiming') return;
        const len = aimPower * MAX_DRAG * 1.6;
        const ex = stone.x + Math.cos(aimAngle) * len;
        const ey = stone.y + Math.sin(aimAngle) * len;

        ctx.beginPath();
        ctx.moveTo(stone.x, stone.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = 'rgba(125, 255, 200, .55)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, TAU);
        ctx.fillStyle = 'rgba(125, 255, 200, .8)';
        ctx.fill();

        const powerText = Math.round(aimPower * 100) + '%';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '700 12px ' + MONO;
        ctx.fillStyle = '#7dffc8';
        ctx.fillText(powerText, ex, ey - 8);
        ctx.textAlign = 'left';
    }

    function drawTrail() {
        if (trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = 'rgba(157, 208, 255, .35)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function drawShots() {
        for (let i = 0; i < shots.length; i++) {
            drawStone(shots[i], 0.45);
        }
    }

    function drawParts() {
        for (let i = parts.length - 1; i >= 0; i--) {
            const q = parts[i];
            q.life -= 0.016;
            if (q.life <= 0) {
                parts.splice(i, 1);
                continue;
            }
            q.x += q.vx * 0.016;
            q.y += q.vy * 0.016;
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = q.col;
            ctx.beginPath();
            ctx.arc(q.x, q.y, 2.2 * a + 0.8, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eaf6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('冰壶', 24, 32);
        ctx.fillStyle = 'rgba(150, 200, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('瞄准靶心 · 一杆定乾坤', 24, 54);

        const bw = 96;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(125, 200, 255, .12)';
        roundRect(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 200, 255, .35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9dd0ff';
        ctx.font = '700 12px ' + MONO;
        ctx.fillText('CURLING', bx + bw / 2, 38);
        ctx.textAlign = 'left';
    }

    function drawBanner() {
        if (bannerT <= 0) return;
        const a = clamp(bannerT, 0, 1);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 28px ' + FONT;
        ctx.fillStyle = bannerCol;
        ctx.fillText(banner, W / 2, 96);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(150, 195, 215, .68)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('拖拽冰壶底部瞄准，松开掷出', 24, 578);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(125, 200, 255, .7)';
        ctx.fillText('最佳 ' + Math.max(0, best) + ' 分', W - 24, 578);
        ctx.textAlign = 'left';
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        drawSheet();
        drawTrail();
        drawShots();
        drawStone(stone);
        drawAim();
        drawParts();
        drawHeader();
        drawBanner();
        drawFooter();
    }

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;
        t += dt;

        if (state === 'sliding') {
            const v = Math.hypot(stone.vx, stone.vy);
            if (v > 0) {
                const ax = -stone.vx / v * FRICTION;
                const ay = -stone.vy / v * FRICTION;
                stone.vx += ax * dt;
                stone.vy += ay * dt;
                if (Math.hypot(stone.vx, stone.vy) < 8) {
                    stone.vx = 0;
                    stone.vy = 0;
                }
            }
            stone.x += stone.vx * dt;
            stone.y += stone.vy * dt;

            trail.push({ x: stone.x, y: stone.y });
            if (trail.length > 80) trail.shift();

            if (stone.vx === 0 && stone.vy === 0) {
                endRound();
            }
        }

        if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
        updateHud();
        render();
        requestAnimationFrame(frame);
    }

    try { best = Number(localStorage.getItem('webgames.curling.best') || -1); } catch (e) { best = -1; }
    updateHud();
    requestAnimationFrame(frame);
})();
