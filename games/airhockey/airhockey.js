/* ==========================================================
   空气曲棍球 Air Hockey
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const RX = 34;
    const RY = 84;
    const RW = 412;
    const RH = 474;
    const MID = RY + RH / 2;
    const PR = 26;      // 球拍半径
    const KR = 12;      // 冰球半径
    const GOAL_W = 150;
    const GOAL_X0 = W / 2 - GOAL_W / 2;
    const GOAL_X1 = W / 2 + GOAL_W / 2;
    const WIN_SCORE = 7;

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
        you: document.getElementById('you-count'),
        cpu: document.getElementById('cpu-count'),
        level: document.getElementById('level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';       // ready | serve | play | goal | over
    let youScore = 0;
    let cpuScore = 0;
    let puck = { x: W / 2, y: MID, vx: 0, vy: 0 };
    let pad = { x: W / 2, y: RY + RH - 90, vx: 0, vy: 0 };
    let bot = { x: W / 2, y: RY + 90, vx: 0, vy: 0 };
    let padTarget = { x: W / 2, y: RY + RH - 90 };
    let keyDir = { x: 0, y: 0 };
    let serving = 0;
    let pauseT = 0;
    let flash = 0;
    let flashColor = 'rgba(255, 255, 255, .5)';
    let goalText = '';
    let goalT = 0;
    let shakeT = 0;
    let trail = [];
    let idleT = 0;
    let hudCache = '';
    let botThink = 0;
    let botTarget = { x: W / 2, y: RY + 90 };

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'serve') return '开球';
        if (state === 'goal') return goalText === '你得分' ? '你得分' : '被进球';
        if (state === 'over') return youScore > cpuScore ? '你赢了' : '电脑赢了';
        return '比赛中';
    }

    function updateHud() {
        const key = state + '|' + youScore + '|' + cpuScore;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.you.textContent = String(youScore);
        els.cpu.textContent = String(cpuScore);
        els.level.textContent = WIN_SCORE + ' 分';
        els.restartBtn.textContent = state === 'play' ? '重新开始' : '再来一局';
    }

    function homePositions() {
        pad.x = W / 2;
        pad.y = RY + RH - 90;
        pad.vx = 0;
        pad.vy = 0;
        padTarget.x = pad.x;
        padTarget.y = pad.y;
        bot.x = W / 2;
        bot.y = RY + 90;
        bot.vx = 0;
        bot.vy = 0;
        botTarget.x = bot.x;
        botTarget.y = bot.y;
        puck.x = W / 2;
        puck.y = MID;
        puck.vx = 0;
        puck.vy = 0;
        trail = [];
        idleT = 0;
        botThink = 0;
    }

    function startMatch() {
        youScore = 0;
        cpuScore = 0;
        flash = 0;
        goalT = 0;
        shakeT = 0;
        homePositions();
        state = 'serve';
        serving = 0.9;
        hudCache = '';
        updateHud();
        els.overlay.classList.remove('show');
    }

    function serve() {
        homePositions();
        state = 'serve';
        serving = 0.75;
        hudCache = '';
        updateHud();
    }

    function scoreGoal(who) {
        const isYou = who === 'you';
        if (isYou) youScore++;
        else cpuScore++;

        goalText = isYou ? '你得分' : '被进球';
        goalT = 1.35;
        flash = 1;
        flashColor = isYou ? 'rgba(95, 216, 255, .34)' : 'rgba(255, 92, 138, .3)';
        shakeT = 0.3;
        state = 'goal';
        pauseT = 1.25;
        hudCache = '';
        updateHud();
    }

    function showResult() {
        const win = youScore > cpuScore;
        els.ovTitle.textContent = win ? '你赢了' : '电脑赢了';
        els.ovTitle.classList.toggle('danger', !win);
        els.ovDesc.textContent = '七分制结束，最终比分 ' + youScore + ' : ' + cpuScore +
            '。' + (win ? '抽射的手感不错。' : '试试先把球拍压到中路再发力。');
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = youScore + ' : ' + cpuScore;
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.ovRestart.textContent = '再来一局';
        els.overlay.classList.add('show');
    }

    /* ---------- 输入 ---------- */

    function pointerToPad(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        padTarget.x = clamp(x, RX + PR + 4, RX + RW - PR - 4);
        padTarget.y = clamp(y, MID + 8, RY + RH - PR - 2);
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'play' && state !== 'serve') return;
        e.preventDefault();
        pointerToPad(e);
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'play' && state !== 'serve') return;
        pointerToPad(e);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startMatch();
            return;
        }
        if ((state === 'ready' || state === 'over') && (e.code === 'Enter' || e.code === 'Space')) {
            e.preventDefault();
            startMatch();
            return;
        }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keyDir.x = -1; e.preventDefault(); }
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keyDir.x = 1; e.preventDefault(); }
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') { keyDir.y = -1; e.preventDefault(); }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { keyDir.y = 1; e.preventDefault(); }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyDir.x = 0;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') keyDir.x = 0;
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') keyDir.y = 0;
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDir.y = 0;
    });

    els.ovBtn.addEventListener('click', startMatch);
    els.ovRestart.addEventListener('click', startMatch);
    els.restartBtn.addEventListener('click', startMatch);

    /* ---------- 物理 ---------- */

    /* 预测冰球到达某条横线时的 x（带两侧反弹） */
    function predictX(targetY) {
        if (puck.vy >= -20) return puck.x;
        let x = puck.x;
        let y = puck.y;
        let vx = puck.vx;
        const vy = puck.vy;
        const h = 1 / 120;
        for (let t = 0; t < 1.4 && y > targetY; t += h) {
            x += vx * h;
            y += vy * h;
            if (x < RX + KR) {
                x = RX + KR;
                vx = Math.abs(vx);
            } else if (x > RX + RW - KR) {
                x = RX + RW - KR;
                vx = -Math.abs(vx);
            }
        }
        return x;
    }

    function movePaddles(dt) {
        /* 键盘也能推球拍 */
        if (keyDir.x || keyDir.y) {
            padTarget.x += keyDir.x * 620 * dt;
            padTarget.y += keyDir.y * 620 * dt;
        }
        padTarget.x = clamp(padTarget.x, RX + PR + 4, RX + RW - PR - 4);
        padTarget.y = clamp(padTarget.y, MID + 8, RY + RH - PR - 2);

        const px = pad.x;
        const py = pad.y;
        const dx = padTarget.x - pad.x;
        const dy = padTarget.y - pad.y;
        const d = Math.hypot(dx, dy);
        const maxMove = 1700 * dt;
        if (d > maxMove) {
            pad.x += dx / d * maxMove;
            pad.y += dy / d * maxMove;
        } else {
            pad.x = padTarget.x;
            pad.y = padTarget.y;
        }
        pad.vx = dt > 0 ? (pad.x - px) / dt : 0;
        pad.vy = dt > 0 ? (pad.y - py) / dt : 0;

        /* 电脑：预判球的落点，球回下半场就回中路待命 */
        botThink -= dt;
        if (botThink <= 0) {
            botThink = 0.05;
            const incoming = puck.vy < -30 || puck.y < MID - 40;
            if (incoming) {
                const px = predictX(RY + 88);
                botTarget.x = px;
                botTarget.y = clamp(Math.min(puck.y - 18, RY + 116), RY + PR + 4, MID - 12);
            } else {
                botTarget.x = W / 2 + (puck.x - W / 2) * 0.45;
                botTarget.y = RY + 96;
            }
            botTarget.x = clamp(botTarget.x, RX + PR + 4, RX + RW - PR - 4);
        }

        const bx = bot.x;
        const by = bot.y;
        const bdx = botTarget.x - bot.x;
        const bdy = botTarget.y - bot.y;
        const bd = Math.hypot(bdx, bdy);
        const bmax = 560 * dt;
        if (bd > bmax) {
            bot.x += bdx / bd * bmax;
            bot.y += bdy / bd * bmax;
        } else {
            bot.x = botTarget.x;
            bot.y = botTarget.y;
        }
        bot.x = clamp(bot.x, RX + PR + 4, RX + RW - PR - 4);
        bot.y = clamp(bot.y, RY + PR + 4, MID - 12);
        bot.vx = dt > 0 ? (bot.x - bx) / dt : 0;
        bot.vy = dt > 0 ? (bot.y - by) / dt : 0;
    }

    function bounceWalls() {
        if (puck.x < RX + KR) {
            puck.x = RX + KR;
            puck.vx = Math.abs(puck.vx) * 0.94;
        } else if (puck.x > RX + RW - KR) {
            puck.x = RX + RW - KR;
            puck.vx = -Math.abs(puck.vx) * 0.94;
        }

        const inGoal = puck.x > GOAL_X0 + 4 && puck.x < GOAL_X1 - 4;
        if (puck.y < RY + KR) {
            if (inGoal) {
                scoreGoal('you');
                return true;
            }
            puck.y = RY + KR;
            puck.vy = Math.abs(puck.vy) * 0.94;
        } else if (puck.y > RY + RH - KR) {
            if (inGoal) {
                scoreGoal('cpu');
                return true;
            }
            puck.y = RY + RH - KR;
            puck.vy = -Math.abs(puck.vy) * 0.94;
        }
        return false;
    }

    function hitPaddle(p) {
        const dx = puck.x - p.x;
        const dy = puck.y - p.y;
        const d = Math.hypot(dx, dy);
        const min = PR + KR;
        if (d >= min || d === 0) return;

        const nx = dx / d;
        const ny = dy / d;
        puck.x = p.x + nx * (min + 0.5);
        puck.y = p.y + ny * (min + 0.5);

        const padSpeed = Math.hypot(p.vx, p.vy);
        const speed = Math.min(1180, Math.max(300, Math.hypot(puck.vx, puck.vy) * 0.86 + 120 + padSpeed * 0.42));
        puck.vx = nx * speed + p.vx * 0.22;
        puck.vy = ny * speed + p.vy * 0.22;

        const sp = Math.hypot(puck.vx, puck.vy);
        if (sp > 1180) {
            puck.vx = puck.vx / sp * 1180;
            puck.vy = puck.vy / sp * 1180;
        }
        shakeT = Math.max(shakeT, 0.08);
    }

    function movePuck(dt) {
        puck.x += puck.vx * dt;
        puck.y += puck.vy * dt;

        /* 摩擦 */
        const damp = Math.pow(0.9955, dt * 60);
        puck.vx *= damp;
        puck.vy *= damp;

        if (bounceWalls()) return;

        hitPaddle(pad);
        hitPaddle(bot);

        /* 慢球卡住时把球吹向对面球门，避免干等 */
        const speed = Math.hypot(puck.vx, puck.vy);
        if (speed < 42) {
            idleT += dt;
            if (idleT > 2.2) {
                idleT = 0;
                const up = puck.y > MID;
                const aimX = GOAL_X0 + 24 + Math.random() * (GOAL_W - 48);
                const aimY = up ? RY + 26 : RY + RH - 26;
                const a = Math.atan2(aimY - puck.y, aimX - puck.x);
                puck.vx += Math.cos(a) * 240;
                puck.vy += Math.sin(a) * 240;
            }
        } else {
            idleT = 0;
        }
    }

    function step(dt) {
        const sub = 3;
        const h = dt / sub;
        for (let i = 0; i < sub && state === 'play'; i++) {
            movePaddles(h);
            movePuck(h);
        }
        trail.push({ x: puck.x, y: puck.y });
        if (trail.length > 9) trail.shift();
    }

    /* ---------- 渲染 ---------- */

    function drawRink() {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .6)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#060d18';
        roundRectPath(ctx, RX - 12, RY - 12, RW + 24, RH + 24, 30);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(95, 216, 255, .28)';
        ctx.lineWidth = 1.6;
        roundRectPath(ctx, RX - 12, RY - 12, RW + 24, RH + 24, 30);
        ctx.stroke();

        /* 冰面 */
        const ice = ctx.createLinearGradient(0, RY, 0, RY + RH);
        ice.addColorStop(0, '#163d5e');
        ice.addColorStop(0.3, '#0f2b46');
        ice.addColorStop(0.5, '#173f62');
        ice.addColorStop(0.72, '#0f2b46');
        ice.addColorStop(1, '#163d5e');
        ctx.fillStyle = ice;
        roundRectPath(ctx, RX, RY, RW, RH, 20);
        ctx.fill();

        ctx.save();
        roundRectPath(ctx, RX, RY, RW, RH, 20);
        ctx.clip();

        /* 两侧灯光沉在冰面下 */
        const pools = [[W / 2, RY + 20, 190, 'rgba(255, 92, 138, .16)'],
            [W / 2, RY + RH - 20, 190, 'rgba(95, 216, 255, .16)']];
        for (let i = 0; i < pools.length; i++) {
            const p = pools[i];
            const pg = ctx.createRadialGradient(p[0], p[1], 8, p[0], p[1], p[2]);
            pg.addColorStop(0, p[3]);
            pg.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = pg;
            ctx.fillRect(RX, RY, RW, RH);
        }

        /* 中线 */
        ctx.strokeStyle = 'rgba(255, 92, 138, .28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(RX, MID);
        ctx.lineTo(RX + RW, MID);
        ctx.stroke();

        /* 中圈 */
        ctx.strokeStyle = 'rgba(95, 216, 255, .22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(W / 2, MID, 62, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(95, 216, 255, .18)';
        ctx.beginPath();
        ctx.arc(W / 2, MID, 4, 0, TAU);
        ctx.fill();

        /* 两个半场的弧线 */
        ctx.strokeStyle = 'rgba(95, 216, 255, .13)';
        ctx.beginPath();
        ctx.arc(W / 2, RY, 96, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(W / 2, RY + RH, 96, Math.PI, TAU);
        ctx.stroke();

        /* 争球圈与蓝线 */
        const dots = [[W / 2 - 116, RY + 118], [W / 2 + 116, RY + 118],
            [W / 2 - 116, RY + RH - 118], [W / 2 + 116, RY + RH - 118]];
        for (let i = 0; i < dots.length; i++) {
            ctx.strokeStyle = 'rgba(95, 216, 255, .14)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(dots[i][0], dots[i][1], 34, 0, TAU);
            ctx.stroke();
            ctx.fillStyle = 'rgba(95, 216, 255, .22)';
            ctx.beginPath();
            ctx.arc(dots[i][0], dots[i][1], 3, 0, TAU);
            ctx.fill();
        }
        ctx.strokeStyle = 'rgba(95, 216, 255, .10)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(RX, RY + RH * 0.33);
        ctx.lineTo(RX + RW, RY + RH * 0.33);
        ctx.moveTo(RX, RY + RH * 0.67);
        ctx.lineTo(RX + RW, RY + RH * 0.67);
        ctx.stroke();

        /* 球门弧 */
        for (let s = 0; s < 2; s++) {
            const gy = s === 0 ? RY : RY + RH;
            ctx.fillStyle = s === 0 ? 'rgba(255, 92, 138, .12)' : 'rgba(95, 216, 255, .12)';
            ctx.beginPath();
            ctx.arc(W / 2, gy, 78, s === 0 ? 0 : Math.PI, s === 0 ? Math.PI : TAU);
            ctx.fill();
            ctx.strokeStyle = s === 0 ? 'rgba(255, 92, 138, .3)' : 'rgba(95, 216, 255, .3)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(W / 2, gy, 78, s === 0 ? 0 : Math.PI, s === 0 ? Math.PI : TAU);
            ctx.stroke();
        }

        /* 冰面反光 */
        const sheen = ctx.createLinearGradient(RX, RY, RX + RW, RY + RH);
        sheen.addColorStop(0, 'rgba(255, 255, 255, .05)');
        sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(RX, RY, RW, RH);
        ctx.restore();

        /* 球门口 */
        const topG = ctx.createLinearGradient(GOAL_X0, 0, GOAL_X1, 0);
        topG.addColorStop(0, 'rgba(255, 92, 138, .2)');
        topG.addColorStop(0.5, 'rgba(255, 92, 138, .9)');
        topG.addColorStop(1, 'rgba(255, 92, 138, .2)');
        ctx.fillStyle = topG;
        roundRectPath(ctx, GOAL_X0, RY - 5, GOAL_W, 10, 5);
        ctx.fill();

        const botG = ctx.createLinearGradient(GOAL_X0, 0, GOAL_X1, 0);
        botG.addColorStop(0, 'rgba(95, 216, 255, .2)');
        botG.addColorStop(0.5, 'rgba(95, 216, 255, .9)');
        botG.addColorStop(1, 'rgba(95, 216, 255, .2)');
        ctx.fillStyle = botG;
        roundRectPath(ctx, GOAL_X0, RY + RH - 5, GOAL_W, 10, 5);
        ctx.fill();
    }

    function drawPaddle(p, color, ring) {
        const g = ctx.createRadialGradient(p.x - 6, p.y - 8, 3, p.x, p.y, PR);
        g.addColorStop(0, 'rgba(255, 255, 255, .85)');
        g.addColorStop(0.35, color);
        g.addColorStop(1, 'rgba(6, 14, 26, .95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PR, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = ring;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PR - 1, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PR - 8, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, .75)';
        ctx.beginPath();
        ctx.arc(p.x - PR * 0.32, p.y - PR * 0.34, 3.4, 0, TAU);
        ctx.fill();
    }

    function drawPuck() {
        for (let i = 0; i < trail.length; i++) {
            const t = trail[i];
            const a = (i + 1) / trail.length * 0.28;
            ctx.fillStyle = 'rgba(150, 230, 255, ' + a.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(t.x, t.y, KR * (0.4 + (i / trail.length) * 0.8), 0, TAU);
            ctx.fill();
        }

        const g = ctx.createRadialGradient(puck.x - 3, puck.y - 4, 2, puck.x, puck.y, KR);
        g.addColorStop(0, '#f4feff');
        g.addColorStop(0.5, '#9ee6ff');
        g.addColorStop(1, '#2d7fa8');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, KR, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, .8)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, KR - 3.4, 0, TAU);
        ctx.stroke();
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('空气曲棍球', 24, 32);

        ctx.fillStyle = 'rgba(150, 190, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('拖动光球击球 · 先得 7 分', 24, 54);

        /* 记分牌 */
        const bw = 132;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(95, 216, 255, .10)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.font = '700 13px ' + MONO;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#5fd8ff';
        ctx.fillText('YOU', bx + 12, 38);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e8f7ff';
        ctx.fillText(youScore + ' : ' + cpuScore, bx + 66, 38);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ff5c8a';
        ctx.fillText('CPU', bx + 120, 38);
    }

    function drawOverlayBits() {
        if (goalT > 0) {
            const a = Math.min(1, goalT / 0.5);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 34px ' + FONT;
            ctx.fillStyle = goalText === '你得分' ? '#8ceaff' : '#ff9ab5';
            ctx.fillText(goalText, W / 2, MID);
            ctx.restore();
        }

        if (state === 'serve' && serving > 0) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '700 14px ' + FONT;
            ctx.fillStyle = 'rgba(220, 240, 255, .75)';
            ctx.fillText('准备开球', W / 2, MID + 70);
            ctx.restore();
        }

        if (flash > 0) {
            ctx.fillStyle = flashColor.replace(/[\d.]+\)$/, (flash * 0.8).toFixed(3) + ')');
            ctx.fillRect(0, 0, W, H);
        }
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(150, 190, 220, .7)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('按住拖动光球 · 方向键微调 · 快甩更容易抽射', 24, 578);
    }

    function render() {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#070f1c');
        bg.addColorStop(0.5, '#050b15');
        bg.addColorStop(1, '#040911');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        if (shakeT > 0) {
            const k = shakeT / 0.3;
            ctx.translate(Math.sin(shakeT * 150) * 5 * k, Math.cos(shakeT * 110) * 3 * k);
        }
        drawRink();
        drawPaddle(bot, '#ff5c8a', 'rgba(255, 92, 138, .75)');
        drawPuck();
        drawPaddle(pad, '#5fd8ff', 'rgba(95, 216, 255, .8)');
        drawOverlayBits();
        ctx.restore();

        drawHeader();
        drawFooter();
    }

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
        if (goalT > 0) goalT = Math.max(0, goalT - dt);
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

        if (state === 'serve') {
            serving -= dt;
            movePaddles(dt);
            if (serving <= 0) {
                state = 'play';
                const a = (Math.random() - 0.5) * 0.9;
                const side = Math.random() < 0.5 ? 1 : -1;
                puck.vx = Math.sin(a) * 300;
                puck.vy = side * 300;
                trail = [];
                hudCache = '';
                updateHud();
            }
        } else if (state === 'play') {
            step(dt);
        } else if (state === 'goal') {
            pauseT -= dt;
            if (pauseT <= 0) {
                if (youScore >= WIN_SCORE || cpuScore >= WIN_SCORE) {
                    state = 'over';
                    hudCache = '';
                    updateHud();
                    showResult();
                } else {
                    serve();
                }
            }
        }

        render();
        requestAnimationFrame(frame);
    }

    homePositions();
    updateHud();
    requestAnimationFrame(frame);
})();
