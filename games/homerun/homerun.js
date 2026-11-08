/* ==========================================================
   全垒打 Homerun Derby
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const BAT_X = 162;
    const PLATE_Y = 396;
    const RUBBER = { x: 398, y: 350 };
    const TOTAL = 10;
    const BALL_R = 6;

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

    function roundRectPath(c, x, y, w, h, r) {
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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        score: document.getElementById('score'),
        shots: document.getElementById('shots'),
        combo: document.getElementById('combo'),
        best: document.getElementById('best'),
        level: document.getElementById('level'),
        total: document.getElementById('total'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';       // ready | windup | pitch | result | over
    let pitchNo = 0;
    let score = 0;
    let combo = 0;
    let best = 0;
    let windupT = 0;
    let resultT = 0;
    let swingT = 0;
    let batAng = -2.6;
    let ball = { x: RUBBER.x, y: RUBBER.y, vx: 0, vy: 0 };
    let pitchSpeed = 0;
    let trail = [];
    let parts = [];
    let flyers = [];
    let banner = '';
    let bannerT = 0;
    let bannerCol = '#dff4ff';
    let flashT = 0;
    let shakeT = 0;
    let t = 0;
    let hudCache = '';
    let lastKind = '';

    function startGame() {
        pitchNo = 0;
        score = 0;
        combo = 0;
        swingT = 0;
        batAng = -2.6;
        parts = [];
        flyers = [];
        banner = '';
        bannerT = 0;
        flashT = 0;
        shakeT = 0;
        lastKind = '';
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        nextPitch(true);
    }

    function nextPitch(first) {
        if (!first) pitchNo++;
        if (pitchNo >= TOTAL) {
            gameOver();
            return;
        }
        ball.x = RUBBER.x;
        ball.y = RUBBER.y;
        ball.vx = 0;
        ball.vy = 0;
        trail = [];
        state = 'windup';
        windupT = first ? 0.9 : 0.7;
        pitchSpeed = Math.round(118 + pitchNo * 4 + Math.random() * 8);
        hudCache = '';
        updateHud();
    }

    function launch() {
        const dur = 0.86 - pitchNo * 0.022 + (Math.random() - 0.5) * 0.06;
        const tx = BAT_X + 6;
        ball.vx = (tx - ball.x) / dur;
        ball.vy = (PLATE_Y - 4 - ball.y) / dur;
        state = 'pitch';
        hudCache = '';
        updateHud();
    }

    function swing() {
        if (state === 'windup') {
            finishSwing('early');
            return;
        }
        if (state !== 'pitch') return;
        swingT = 0.26;
        batAng = -2.6;
        const dx = ball.x - BAT_X;
        const ad = Math.abs(dx);
        if (ad <= 16) finishSwing('homer', dx);
        else if (ad <= 32) finishSwing('hit', dx);
        else if (ad <= 52) finishSwing('foul', dx);
        else finishSwing('miss', dx);
    }

    function finishSwing(kind, dx) {
        lastKind = kind;
        state = 'result';
        resultT = kind === 'homer' ? 1.8 : 1.5;
        const bonus = Math.min(combo, 3);

        if (kind === 'homer') {
            const gain = 3 + bonus;
            score += gain;
            combo++;
            banner = '全垒打！+' + gain + ' 分';
            bannerCol = '#ffe08a';
            flashT = 0.4;
            shakeT = 0.2;
            ball.vx = -820;
            ball.vy = -560;
            flyers.push({
                x: 200, y: 300, txt: 'HOME RUN', life: 1.5, max: 1.5, col: '#ffe08a'
            });
        } else if (kind === 'hit') {
            const gain = 1 + bonus;
            score += gain;
            combo++;
            banner = '安打 +' + gain + ' 分';
            bannerCol = '#9df7cd';
            ball.vx = -520;
            ball.vy = -360;
        } else if (kind === 'foul') {
            combo = 0;
            banner = '界外球';
            bannerCol = '#c9d8e6';
            ball.vx = -400;
            ball.vy = -470;
        } else if (kind === 'early') {
            combo = 0;
            banner = '出手太早';
            bannerCol = '#ffa3ad';
            ball.vx = 0;
            ball.vy = 0;
            ball.x = BAT_X + 40;
        } else if (kind === 'ball') {
            combo = 0;
            banner = '没挥棒';
            bannerCol = '#ffa3ad';
        } else {
            combo = 0;
            banner = '挥空了';
            bannerCol = '#ffa3ad';
            ball.vx *= 0.4;
        }
        bannerT = 1.4;
        if (score > best) {
            best = score;
            localStorage.setItem('webgames.homerun.best', String(best));
        }
        hudCache = '';
        updateHud();
    }

    function gameOver() {
        state = 'over';
        els.ovTitle.textContent = '十球结束';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '十次投球打完，共得 ' + score + ' 分。最佳成绩 ' + best +
            ' 分，试试把每一球都打中球心。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '本轮结束';
        if (state === 'windup') return '投手准备…';
        if (state === 'pitch') return '看准了再挥棒';
        return banner;
    }

    function updateHud() {
        const key = state + '|' + score + '|' + pitchNo + '|' + combo + '|' + best + '|' + pitchSpeed;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.score.textContent = String(score);
        els.shots.textContent = Math.min(pitchNo + (state === 'ready' || state === 'over' ? 0 : 1), TOTAL) + ' / ' + TOTAL;
        els.combo.textContent = String(combo);
        els.best.textContent = String(best);
        els.level.textContent = pitchSpeed ? pitchSpeed + ' km/h' : '--';
        els.total.textContent = TOTAL + ' 球';
        els.restartBtn.textContent = state === 'ready' ? '开始打击' : '重新开始';
    }

    /* ---------- 绘制 ---------- */

    function drawStadium() {
        const sky = ctx.createLinearGradient(0, 0, 0, 300);
        sky.addColorStop(0, '#060b16');
        sky.addColorStop(0.6, '#0b1826');
        sky.addColorStop(1, '#102436');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, 300);

        /* 灯塔 */
        const towers = [56, 424];
        for (let i = 0; i < towers.length; i++) {
            const tx = towers[i];
            ctx.strokeStyle = 'rgba(140, 170, 200, .35)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(tx, 152);
            ctx.lineTo(tx, 76);
            ctx.stroke();
            const g = ctx.createRadialGradient(tx, 70, 2, tx, 70, 112);
            g.addColorStop(0, 'rgba(230, 245, 255, .34)');
            g.addColorStop(0.3, 'rgba(180, 220, 255, .1)');
            g.addColorStop(1, 'rgba(180, 220, 255, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx - 112, 30, 224, 200);
            for (let k = 0; k < 4; k++) {
                ctx.fillStyle = 'rgba(240, 250, 255, .85)';
                ctx.beginPath();
                ctx.arc(tx - 12 + k * 8, 70, 3.2, 0, TAU);
                ctx.fill();
            }
        }

        /* 看台 */
        ctx.fillStyle = 'rgba(10, 20, 32, .95)';
        ctx.fillRect(0, 118, W, 156);
        for (let row = 0; row < 8; row++) {
            for (let i = 0; i < 26; i++) {
                const seed = i * 31 + row * 17;
                const x = 6 + i * 18.6 + (row % 2) * 9 + (seed % 7) - 3;
                const y = 132 + row * 18 + ((seed * 5) % 5) - 2;
                const a = 0.07 + (seed % 9) * 0.013;
                ctx.fillStyle = 'rgba(' + (150 + (i * 37 + row * 11) % 90) + ',' +
                    (170 + (i * 23 + row * 7) % 70) + ',210,' + a.toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(x, y, 1.7 + (seed % 3) * 0.45, 0, TAU);
                ctx.fill();
            }
        }

        /* 场墙 */
        ctx.fillStyle = 'rgba(16, 34, 48, .98)';
        ctx.fillRect(0, 274, W, 20);
        ctx.fillStyle = 'rgba(255, 224, 138, .55)';
        ctx.fillRect(0, 274, W, 2.2);

        /* 草地 */
        const grass = ctx.createLinearGradient(0, 292, 0, H);
        grass.addColorStop(0, '#17402a');
        grass.addColorStop(0.55, '#0f3120');
        grass.addColorStop(1, '#081f14');
        ctx.fillStyle = grass;
        ctx.fillRect(0, 292, W, H - 292);

        /* 割草条纹（透视） */
        for (let i = -6; i <= 6; i += 2) {
            const xTop = 240 + i * 34;
            const xBot = 240 + i * 92;
            ctx.beginPath();
            ctx.moveTo(xTop - 16, 292);
            ctx.lineTo(xTop + 16, 292);
            ctx.lineTo(xBot + 46, H);
            ctx.lineTo(xBot - 46, H);
            ctx.closePath();
            ctx.fillStyle = 'rgba(120, 220, 160, .035)';
            ctx.fill();
        }

        /* 内野泥地 */
        ctx.beginPath();
        ctx.ellipse(168, 470, 104, 40, 0, 0, TAU);
        ctx.fillStyle = 'rgba(96, 66, 40, .55)';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(168, 470, 104, 40, 0, 0, TAU);
        ctx.strokeStyle = 'rgba(220, 200, 160, .18)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        /* 投手丘 */
        ctx.beginPath();
        ctx.ellipse(400, 452, 62, 20, 0, 0, TAU);
        ctx.fillStyle = 'rgba(110, 78, 48, .5)';
        ctx.fill();

        /* 本垒板 */
        ctx.fillStyle = 'rgba(240, 245, 250, .85)';
        ctx.beginPath();
        ctx.moveTo(BAT_X - 10, PLATE_Y + 42);
        ctx.lineTo(BAT_X + 10, PLATE_Y + 42);
        ctx.lineTo(BAT_X + 6, PLATE_Y + 52);
        ctx.lineTo(BAT_X - 6, PLATE_Y + 52);
        ctx.closePath();
        ctx.fill();
    }

    function drawPitcher() {
        const px = 404;
        const wind = state === 'windup' ? 1 - clamp(windupT / 0.7, 0, 1) : 0;
        ctx.strokeStyle = 'rgba(200, 226, 245, .9)';
        ctx.lineWidth = 3.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px - 6, 404);
        ctx.lineTo(px - 8, 428);
        ctx.moveTo(px + 6, 404);
        ctx.lineTo(px + 8, 428);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px, 404);
        ctx.lineTo(px, 372);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, 364, 7, 0, TAU);
        ctx.fillStyle = 'rgba(226, 240, 252, .95)';
        ctx.fill();

        /* 投球手臂 */
        const ang = -1.9 + wind * 2.4;
        ctx.beginPath();
        ctx.moveTo(px, 376);
        ctx.lineTo(px + Math.cos(ang) * 26, 376 + Math.sin(ang) * 26);
        ctx.strokeStyle = 'rgba(210, 232, 250, .95)';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (state === 'windup') {
            const rx = px + Math.cos(ang) * 26;
            const ry = 376 + Math.sin(ang) * 26;
            ctx.beginPath();
            ctx.arc(rx, ry, 4.4, 0, TAU);
            ctx.fillStyle = '#f5f9ff';
            ctx.fill();
        }
    }

    function drawBatter() {
        const bx = 214;
        const sway = state === 'pitch' ? Math.sin(t * 6) * 1.4 : 0;

        /* 影子 */
        ctx.beginPath();
        ctx.ellipse(bx + 6, 462, 30, 8, 0, 0, TAU);
        ctx.fillStyle = 'rgba(0, 0, 0, .28)';
        ctx.fill();

        /* 腿 */
        ctx.strokeStyle = 'rgba(215, 236, 252, .9)';
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 2, 428);
        ctx.lineTo(bx - 12, 458);
        ctx.moveTo(bx + 4, 428);
        ctx.lineTo(bx + 14, 458);
        ctx.stroke();

        /* 躯干 */
        ctx.beginPath();
        ctx.moveTo(bx, 428);
        ctx.lineTo(bx + 2 + sway, 398);
        ctx.lineWidth = 9;
        ctx.strokeStyle = 'rgba(120, 205, 255, .35)';
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(232, 246, 255, .92)';
        ctx.stroke();

        /* 头 */
        ctx.beginPath();
        ctx.arc(bx + 2 + sway, 388, 8.5, 0, TAU);
        ctx.fillStyle = 'rgba(240, 249, 255, .96)';
        ctx.fill();
        /* 头盔 */
        ctx.beginPath();
        ctx.arc(bx + 2 + sway, 386, 9.4, Math.PI * 0.85, Math.PI * 2.1);
        ctx.strokeStyle = 'rgba(120, 190, 255, .85)';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        /* 球棒 */
        const pv = { x: bx - 4 + sway, y: 400 };
        ctx.save();
        ctx.translate(pv.x, pv.y);
        ctx.rotate(batAng);
        const bat = ctx.createLinearGradient(0, 0, 60, 0);
        bat.addColorStop(0, 'rgba(226, 236, 246, .95)');
        bat.addColorStop(0.25, 'rgba(198, 150, 96, .95)');
        bat.addColorStop(1, 'rgba(246, 224, 190, .98)');
        ctx.fillStyle = bat;
        roundRectPath(ctx, 0, -3.6, 58, 7.2, 3.6);
        ctx.fill();
        ctx.fillStyle = 'rgba(60, 40, 24, .8)';
        roundRectPath(ctx, 0, -2.6, 12, 5.2, 2.4);
        ctx.fill();
        ctx.restore();

        /* 挥棒残影 */
        if (swingT > 0.05) {
            ctx.beginPath();
            ctx.arc(pv.x, pv.y, 52, -2.9, batAng, false);
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (swingT / 0.26 * 0.28).toFixed(3) + ')';
            ctx.lineWidth = 8;
            ctx.stroke();
        }

        /* 手臂 */
        ctx.beginPath();
        ctx.moveTo(bx + 2, 402);
        ctx.lineTo(pv.x, pv.y);
        ctx.strokeStyle = 'rgba(225, 242, 255, .9)';
        ctx.lineWidth = 3.4;
        ctx.stroke();
    }

    function drawBall() {
        for (let i = 0; i < trail.length; i++) {
            const q = trail[i];
            ctx.beginPath();
            ctx.arc(q.x, q.y, BALL_R * (0.4 + 0.5 * i / trail.length), 0, TAU);
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.10 + 0.22 * i / trail.length).toFixed(3) + ')';
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R + 3.5, 0, TAU);
        ctx.fillStyle = 'rgba(255, 255, 255, .12)';
        ctx.fill();

        const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2.4, 1, ball.x, ball.y, BALL_R + 1);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.75, '#eef4fb');
        g.addColorStop(1, '#b9c8d8');
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 90, 90, .75)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(ball.x - 1.5, ball.y, BALL_R - 1.4, -0.9, 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ball.x + 1.5, ball.y, BALL_R - 1.4, Math.PI - 0.9, Math.PI + 0.9);
        ctx.stroke();
    }

    function drawParts() {
        for (let i = 0; i < parts.length; i++) {
            const q = parts[i];
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = q.col;
            ctx.beginPath();
            ctx.arc(q.x, q.y, 1.8 * a + 0.7, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eaf6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('全垒打', 24, 32);

        ctx.fillStyle = 'rgba(150, 200, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('球飞到本垒板时挥棒 · 空格或点击', 24, 54);

        const bw = 96;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(255, 224, 138, .12)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 224, 138, .35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe08a';
        ctx.font = '700 12px ' + MONO;
        ctx.fillText('BALL ' + Math.min(pitchNo + 1, TOTAL) + '/' + TOTAL, bx + bw / 2, 38);
        ctx.textAlign = 'left';
    }

    function drawBanner() {
        if (bannerT <= 0) return;
        const a = clamp(bannerT, 0, 1);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 24px ' + FONT;
        ctx.fillStyle = bannerCol;
        ctx.fillText(banner, W / 2, 246);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(150, 195, 215, .68)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('空格 / 点击画面挥棒', 24, 578);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 224, 138, .7)';
        ctx.fillText('得分 ' + score + ' · 连击 ' + combo, W - 24, 578);
    }

    function render() {
        ctx.save();
        if (shakeT > 0) {
            const k = shakeT / 0.2;
            ctx.translate((Math.random() - 0.5) * 8 * k, (Math.random() - 0.5) * 8 * k);
        }
        drawStadium();
        drawPitcher();
        drawBatter();
        drawBall();
        drawParts();
        ctx.restore();

        if (flashT > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (flashT / 0.4 * 0.16).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
        }

        drawHeader();
        drawBanner();
        drawFooter();
    }

    /* ---------- 交互 ---------- */

    function onDown(e) {
        if (e) e.preventDefault();
        swing();
    }

    canvas.addEventListener('pointerdown', function (e) {
        onDown(e);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
            e.preventDefault();
            swing();
        } else if (e.code === 'KeyR') {
            startGame();
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        t += dt;
        if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
        if (flashT > 0) flashT = Math.max(0, flashT - dt);
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

        if (swingT > 0) {
            swingT = Math.max(0, swingT - dt);
            const k = 1 - swingT / 0.26;
            batAng = -2.6 + k * 3.5;
        } else if (state === 'pitch' || state === 'windup') {
            batAng = -2.6 + Math.sin(t * 3) * 0.05;
        }

        if (state === 'windup') {
            windupT -= dt;
            if (windupT <= 0) launch();
        } else if (state === 'pitch') {
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            trail.push({ x: ball.x, y: ball.y });
            if (trail.length > 12) trail.shift();
            if (ball.x < BAT_X - 42) finishSwing('ball');
        } else if (state === 'result') {
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            if (lastKind === 'homer' || lastKind === 'hit' || lastKind === 'foul') {
                ball.vy += 460 * dt;
                trail.push({ x: ball.x, y: ball.y });
                if (trail.length > 12) trail.shift();
            }
            resultT -= dt;
            if (resultT <= 0) nextPitch(false);
        }

        for (let i = parts.length - 1; i >= 0; i--) {
            const q = parts[i];
            q.life -= dt;
            if (q.life <= 0) {
                parts.splice(i, 1);
                continue;
            }
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.vy += 320 * dt;
        }
        for (let i = flyers.length - 1; i >= 0; i--) {
            flyers[i].life -= dt;
            if (flyers[i].life <= 0) flyers.splice(i, 1);
        }

        render();
        requestAnimationFrame(frame);
    }

    best = Number(localStorage.getItem('webgames.homerun.best') || 0);
    updateHud();
    requestAnimationFrame(frame);
})();
