/* ==========================================================
   街头投篮 Street Hoops
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const G = 1500;
    const BALL_R = 12;
    const FLOOR = 524;
    const RIM_Y0 = 262;
    const RIM_X0 = 348;
    const RIM_X1 = 430;
    const RIM_R = 4.5;
    const BOARD_X = 434;
    const BOARD_TOP = 172;
    const BOARD_H = 118;
    const START_Y = 448;
    const DURATION = 60;
    const KICK = 7.4;
    const MAX_SPEED = 1360;

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
        time: document.getElementById('time'),
        combo: document.getElementById('combo'),
        shots: document.getElementById('shots'),
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

    let state = 'ready';        // ready | idle | aim | fly | settle | over
    let ball = { x: 150, y: START_Y, vx: 0, vy: 0, spin: 0 };
    let startX = 150;
    let aim = null;
    let score = 0;
    let shots = 0;
    let made = 0;
    let combo = 0;
    let timeLeft = DURATION;
    let settleT = 0;
    let rimY = RIM_Y0;
    let t = 0;
    let trail = [];
    let parts = [];
    let flyers = [];
    let scored = false;
    let touchedRim = false;
    let missed = false;
    let flashT = 0;
    let best = 0;
    let hudCache = '';
    let resultText = '';
    let timeShown = -1;

    function moving() {
        return shots >= 3;
    }

    function newBall() {
        startX = 104 + Math.random() * 96;
        ball.x = startX;
        ball.y = START_Y;
        ball.vx = 0;
        ball.vy = 0;
        ball.spin = 0;
        aim = null;
        trail = [];
        scored = false;
        touchedRim = false;
        missed = false;
        state = 'idle';
        hudCache = '';
        updateHud();
    }

    function startGame() {
        score = 0;
        shots = 0;
        made = 0;
        combo = 0;
        timeLeft = DURATION;
        t = 0;
        parts = [];
        flyers = [];
        flashT = 0;
        resultText = '';
        rimY = RIM_Y0;
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        newBall();
    }

    /* ---------- 投篮 ---------- */

    function shoot() {
        if (!aim) return;
        let dx = aim.x - ball.x;
        let dy = aim.y - ball.y;
        let d = Math.hypot(dx, dy);
        if (d < 12) {
            aim = null;
            state = 'idle';
            return;
        }
        let sp = Math.min(d * KICK, MAX_SPEED);
        ball.vx = dx / d * sp;
        ball.vy = dy / d * sp;
        ball.spin = ball.vx * 0.02;
        shots++;
        state = 'fly';
        aim = null;
        hudCache = '';
        updateHud();
    }

    function basket() {
        scored = true;
        made++;
        combo++;
        const swish = !touchedRim;
        const pts = (swish ? 3 : 2) + (combo >= 2 ? 1 : 0);
        score += pts;
        if (score > best) {
            best = score;
            localStorage.setItem('webgames.basketball.best', String(best));
        }
        flashT = 0.4;
        flyers.push({
            x: (RIM_X0 + RIM_X1) / 2,
            y: rimY - 6,
            txt: '+' + pts + (swish ? ' 空心' : ''),
            life: 1.1,
            max: 1.1,
            col: swish ? '#7dffc8' : '#ffd166'
        });
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 150;
            parts.push({
                x: (RIM_X0 + RIM_X1) / 2,
                y: rimY,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0.5 + Math.random() * 0.35,
                max: 0.85,
                col: swish ? '#7dffc8' : '#ffb454'
            });
        }
        hudCache = '';
        updateHud();
    }

    function settle(delay) {
        state = 'settle';
        settleT = delay;
    }

    /* ---------- 物理 ---------- */

    function stepBall(dt) {
        const sub = 3;
        const h = dt / sub;
        for (let s = 0; s < sub; s++) {
            const py = ball.y;
            ball.vy += G * h;
            ball.x += ball.vx * h;
            ball.y += ball.vy * h;
            ball.spin += ball.vx * h * 0.03;

            /* 入筐判定 */
            if (!scored && py < rimY && ball.y >= rimY && ball.vy > 0 &&
                ball.x > RIM_X0 + 7 && ball.x < RIM_X1 - 7) {
                basket();
            }

            /* 篮板 */
            if (ball.x + BALL_R > BOARD_X && ball.x < BOARD_X + 12 &&
                ball.y > BOARD_TOP && ball.y < BOARD_TOP + BOARD_H) {
                ball.x = BOARD_X - BALL_R;
                ball.vx = -Math.abs(ball.vx) * 0.62;
                touchedRim = true;
            }

            /* 篮圈两端 */
            const rims = [[RIM_X0, rimY], [RIM_X1, rimY]];
            for (let i = 0; i < 2; i++) {
                const dx = ball.x - rims[i][0];
                const dy = ball.y - rims[i][1];
                const d = Math.hypot(dx, dy);
                const min = BALL_R + RIM_R;
                if (d < min && d > 0.001) {
                    const nx = dx / d;
                    const ny = dy / d;
                    ball.x = rims[i][0] + nx * (min + 0.4);
                    ball.y = rims[i][1] + ny * (min + 0.4);
                    const vn = ball.vx * nx + ball.vy * ny;
                    if (vn < 0) {
                        ball.vx -= (1 + 0.58) * vn * nx;
                        ball.vy -= (1 + 0.58) * vn * ny;
                        ball.vx *= 0.92;
                        ball.vy *= 0.92;
                    }
                    touchedRim = true;
                }
            }

            /* 顶棚与侧墙 */
            if (ball.y - BALL_R < 84) {
                ball.y = 84 + BALL_R;
                ball.vy = Math.abs(ball.vy) * 0.5;
            }
            if (ball.x - BALL_R < 0) {
                ball.x = BALL_R;
                ball.vx = Math.abs(ball.vx) * 0.6;
            }

            /* 地面 */
            if (ball.y + BALL_R > FLOOR) {
                ball.y = FLOOR - BALL_R;
                ball.vy = -Math.abs(ball.vy) * 0.5;
                ball.vx *= 0.84;
                if (!scored && !missed) {
                    missed = true;
                    combo = 0;
                    flyers.push({
                        x: ball.x, y: FLOOR - 60, txt: '没进', life: 0.9, max: 0.9, col: 'rgba(255, 140, 150, .9)'
                    });
                    hudCache = '';
                    updateHud();
                }
                if (state === 'fly') settle(0.55);
            }
        }
    }

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return resultText;
        if (state === 'aim') return '松手出手';
        if (state === 'fly') return '球在飞…';
        if (state === 'settle') return '准备下一球';
        return combo >= 2 ? '手感火热 · 连中 ' + combo : '该你出手';
    }

    function updateHud() {
        const key = state + '|' + score + '|' + Math.ceil(timeLeft) + '|' + combo + '|' + shots + '|' + made + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.score.textContent = String(score);
        els.time.textContent = Math.max(0, Math.ceil(timeLeft)) + 's';
        els.combo.textContent = String(combo);
        els.shots.textContent = shots + ' / ' + made;
        els.best.textContent = String(best);
        els.restartBtn.textContent = state === 'ready' ? '开始投篮' : '重新开始';
    }

    function gameOver() {
        state = 'over';
        resultText = '时间到';
        const pct = shots ? Math.round(made / shots * 100) : 0;
        els.ovTitle.textContent = '时间到';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '六十秒里投进 ' + made + ' 球、出手 ' + shots + ' 次，命中率 ' + pct +
            '%，共得 ' + score + ' 分。最佳成绩 ' + best + ' 分。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 绘制 ---------- */

    function drawBackdrop() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#080f1a');
        g.addColorStop(0.45, '#0d1a26');
        g.addColorStop(1, '#0a141d');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        /* 顶灯 */
        for (let i = 0; i < 3; i++) {
            const lx = 120 + i * 140;
            const cone = ctx.createLinearGradient(lx, 60, lx, 460);
            cone.addColorStop(0, 'rgba(180, 220, 255, .10)');
            cone.addColorStop(1, 'rgba(180, 220, 255, 0)');
            ctx.beginPath();
            ctx.moveTo(lx - 16, 70);
            ctx.lineTo(lx + 16, 70);
            ctx.lineTo(lx + 120, 470);
            ctx.lineTo(lx - 120, 470);
            ctx.closePath();
            ctx.fillStyle = cone;
            ctx.fill();
        }

        /* 地板 */
        const fl = ctx.createLinearGradient(0, FLOOR - 40, 0, H);
        fl.addColorStop(0, 'rgba(60, 40, 26, .0)');
        fl.addColorStop(0.25, 'rgba(96, 62, 34, .55)');
        fl.addColorStop(1, 'rgba(38, 24, 14, .9)');
        ctx.fillStyle = fl;
        ctx.fillRect(0, FLOOR - 40, W, H - FLOOR + 40);

        ctx.strokeStyle = 'rgba(255, 200, 140, .35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, FLOOR);
        ctx.lineTo(W, FLOOR);
        ctx.stroke();

        /* 记分线 */
        ctx.strokeStyle = 'rgba(255, 190, 120, .12)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(0, FLOOR + 12 + i * 12);
            ctx.lineTo(W, FLOOR + 12 + i * 12);
            ctx.stroke();
        }
    }

    function drawHoop() {
        /* 支杆 */
        ctx.strokeStyle = 'rgba(120, 150, 176, .45)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(BOARD_X + 12, BOARD_TOP + BOARD_H * 0.55);
        ctx.lineTo(BOARD_X + 30, BOARD_TOP + BOARD_H * 0.55);
        ctx.lineTo(BOARD_X + 30, FLOOR - 4);
        ctx.stroke();

        /* 篮板（侧视，玻璃板） */
        roundRectPath(ctx, BOARD_X, BOARD_TOP, 12, BOARD_H, 5);
        const bd = ctx.createLinearGradient(BOARD_X, BOARD_TOP, BOARD_X + 12, BOARD_TOP + BOARD_H);
        bd.addColorStop(0, 'rgba(190, 232, 255, .30)');
        bd.addColorStop(0.5, 'rgba(214, 245, 255, .16)');
        bd.addColorStop(1, 'rgba(150, 200, 235, .26)');
        ctx.fillStyle = bd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(220, 245, 255, .8)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        /* 篮板上的方框提示 */
        ctx.strokeStyle = 'rgba(230, 250, 255, .45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(BOARD_X + 1, rimY - 44);
        ctx.lineTo(BOARD_X + 11, rimY - 40);
        ctx.moveTo(BOARD_X + 1, rimY - 44);
        ctx.lineTo(BOARD_X + 1, rimY + 6);
        ctx.stroke();

        /* 篮网 */
        const netBottom = rimY + 40;
        ctx.strokeStyle = 'rgba(235, 245, 255, .38)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const x1 = RIM_X0 + (RIM_X1 - RIM_X0) * i / 5;
            const x2 = RIM_X0 + 12 + (RIM_X1 - RIM_X0 - 24) * i / 5;
            ctx.beginPath();
            ctx.moveTo(x1, rimY);
            ctx.lineTo(x2, netBottom);
            ctx.stroke();
        }
        for (let i = 1; i <= 3; i++) {
            const k = i / 3.4;
            const yy = rimY + 40 * k;
            const xa = RIM_X0 + 12 * k;
            const xb = RIM_X1 - 12 * k;
            ctx.beginPath();
            ctx.moveTo(xa, yy);
            ctx.quadraticCurveTo((xa + xb) / 2, yy + 5, xb, yy);
            ctx.stroke();
        }

        /* 篮圈 */
        ctx.save();
        ctx.shadowColor = 'rgba(255, 140, 60, .75)';
        ctx.shadowBlur = flashT > 0 ? 24 : 12;
        ctx.strokeStyle = '#ff7b39';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(RIM_X0, rimY);
        ctx.lineTo(RIM_X1, rimY);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(255, 190, 140, .9)';
        ctx.beginPath();
        ctx.arc(RIM_X0, rimY, RIM_R, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(RIM_X1, rimY, RIM_R, 0, TAU);
        ctx.fill();
    }

    function drawBall() {
        /* 轨迹 */
        for (let i = 0; i < trail.length; i++) {
            const q = trail[i];
            const a = (i / trail.length) * 0.28;
            ctx.beginPath();
            ctx.arc(q.x, q.y, BALL_R * (0.35 + 0.5 * i / trail.length), 0, TAU);
            ctx.fillStyle = 'rgba(255, 168, 92, ' + a.toFixed(3) + ')';
            ctx.fill();
        }

        ctx.save();
        ctx.translate(ball.x, ball.y);
        /* 影子 */
        ctx.save();
        ctx.translate(0, FLOOR - ball.y);
        ctx.beginPath();
        ctx.ellipse(0, 0, BALL_R * 1.2, BALL_R * 0.42, 0, 0, TAU);
        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        ctx.fill();
        ctx.restore();

        ctx.rotate(ball.spin);
        const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, BALL_R + 2);
        g.addColorStop(0, '#ffb066');
        g.addColorStop(0.6, '#f07a22');
        g.addColorStop(1, '#a8450c');
        ctx.beginPath();
        ctx.arc(0, 0, BALL_R, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 24, 8, .8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        /* 球纹 */
        ctx.strokeStyle = 'rgba(70, 28, 10, .75)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-BALL_R, 0);
        ctx.lineTo(BALL_R, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, BALL_R, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, BALL_R, Math.PI * 0.58, Math.PI * 1.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -BALL_R);
        ctx.lineTo(0, BALL_R);
        ctx.stroke();

        if (state === 'idle') {
            const p = 0.5 + Math.sin(t * 3) * 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, BALL_R + 6 + p * 3, 0, TAU);
            ctx.strokeStyle = 'rgba(255, 200, 140, ' + (0.25 + p * 0.25).toFixed(2) + ')';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAim() {
        if (!aim) return;
        let dx = aim.x - ball.x;
        let dy = aim.y - ball.y;
        let d = Math.hypot(dx, dy);
        if (d < 4) return;
        const sp = Math.min(d * KICK, MAX_SPEED);
        const vx = dx / d * sp;
        const vy = dy / d * sp;

        /* 抛物线预览 */
        for (let i = 1; i <= 16; i++) {
            const tt = i * 0.055;
            const px = ball.x + vx * tt;
            const py = ball.y + vy * tt + 0.5 * G * tt * tt;
            if (py > FLOOR) break;
            ctx.beginPath();
            ctx.arc(px, py, 3.6 - i * 0.13, 0, TAU);
            ctx.fillStyle = 'rgba(255, 224, 168, ' + (0.72 - i * 0.032).toFixed(3) + ')';
            ctx.fill();
        }

        /* 力度环 */
        const p = clamp(d / 160, 0, 1);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R + 16, -Math.PI / 2, -Math.PI / 2 + TAU * p);
        ctx.strokeStyle = p > 0.86 ? 'rgba(255, 120, 120, .9)' : 'rgba(255, 210, 130, .85)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    function drawFx(dt) {
        for (let i = 0; i < parts.length; i++) {
            const q = parts[i];
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = q.col;
            ctx.beginPath();
            ctx.arc(q.x, q.y, 2.2 * a + 0.8, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < flyers.length; i++) {
            const f = flyers[i];
            const a = clamp(f.life / f.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = f.col;
            ctx.font = '800 20px ' + FONT;
            ctx.fillText(f.txt, f.x, f.y - (1 - a) * 38);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eaf6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('街头投篮', 24, 32);

        ctx.fillStyle = 'rgba(160, 200, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText(moving() ? '篮筐会上下移动 · 空心三分' : '六十秒 · 空心三分 · 擦框两分', 24, 54);

        const bw = 92;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(255, 160, 90, .14)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 160, 90, .4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffbf8a';
        ctx.font = '700 13px ' + MONO;
        ctx.fillText(score + ' PTS', bx + bw / 2, 38);
        ctx.textAlign = 'left';

        /* 时间条 */
        const frac = clamp(timeLeft / DURATION, 0, 1);
        const barW = W - 48;
        roundRectPath(ctx, 24, 72, barW, 5, 2.5);
        ctx.fillStyle = 'rgba(255, 255, 255, .1)';
        ctx.fill();
        if (frac > 0) {
            roundRectPath(ctx, 24, 72, barW * frac, 5, 2.5);
            ctx.fillStyle = frac < 0.2 ? 'rgba(255, 110, 120, .9)' : 'rgba(255, 176, 96, .85)';
            ctx.fill();
        }
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(150, 190, 210, .68)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('按住球体朝篮筐方向拖动，松手出手', 24, 566);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 176, 96, .7)';
        ctx.fillText('连中 ' + combo + ' · 出手 ' + shots, W - 24, 566);
    }

    function render() {
        drawBackdrop();
        drawHoop();
        drawAim();
        drawBall();
        drawFx();
        drawHeader();
        drawFooter();
    }

    /* ---------- 交互 ---------- */

    function toCanvas(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'idle') return;
        const p = toCanvas(e);
        if (Math.hypot(p.x - ball.x, p.y - ball.y) > 110) return;
        aim = { x: p.x, y: p.y };
        state = 'aim';
        hudCache = '';
        updateHud();
    });

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'aim') return;
        e.preventDefault();
        const p = toCanvas(e);
        aim.x = p.x;
        aim.y = p.y;
    });

    canvas.addEventListener('pointerup', function (e) {
        if (state !== 'aim') return;
        e.preventDefault();
        const p = toCanvas(e);
        aim.x = p.x;
        aim.y = p.y;
        shoot();
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') startGame();
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
        if (flashT > 0) flashT = Math.max(0, flashT - dt);
        rimY = RIM_Y0 + (moving() ? Math.sin(t * 1.15) * 24 : 0);

        if (state === 'idle' || state === 'aim' || state === 'fly' || state === 'settle') {
            timeLeft -= dt;
            if (timeLeft <= 0) {
                timeLeft = 0;
                gameOver();
            }
        }

        if (state === 'fly') {
            stepBall(dt);
            trail.push({ x: ball.x, y: ball.y });
            if (trail.length > 14) trail.shift();
        } else if (state === 'settle') {
            stepBall(dt);
            settleT -= dt;
            if (settleT <= 0) newBall();
        } else if (state === 'idle') {
            ball.y = START_Y + Math.sin(t * 2.4) * 2.5;
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
            q.vy += 420 * dt;
            q.vx *= 0.97;
        }
        for (let i = flyers.length - 1; i >= 0; i--) {
            flyers[i].life -= dt;
            if (flyers[i].life <= 0) flyers.splice(i, 1);
        }

        if (state !== 'ready' && state !== 'over') {
            const c = Math.ceil(timeLeft);
            if (c !== timeShown) {
                timeShown = c;
                hudCache = '';
                updateHud();
            }
        }

        render();
        requestAnimationFrame(frame);
    }

    best = Number(localStorage.getItem('webgames.basketball.best') || 0);
    timeShown = Math.ceil(timeLeft);
    updateHud();
    requestAnimationFrame(frame);
})();
