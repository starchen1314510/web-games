/* ==========================================================
   保龄球 Bowling
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    /* ---------- 球道（伪透视） ---------- */
    const LANE_TOP_Y = 214;
    const LANE_BOT_Y = 552;
    const HALF_TOP = 100;
    const HALF_BOT = 214;
    const DECK_FRONT = 336;        // 瓶台前沿
    const FOUL_Y = 532;
    const BALL_Y0 = 548;
    const BALL_R = 9;

    /* ---------- 球瓶 ---------- */
    const PIN_R = 6.5;
    const PIN_H = 38;
    const SP = 38;                 // 横向瓶距
    const ROW_DY = 26;             // 纵向排距
    const HEAD_Y = 242;

    const PIN_HOME = [];
    (function () {
        // 从远到近排：远排 4 瓶，头瓶离投球手最近
        const rows = [4, 3, 2, 1];
        for (let r = 0; r < rows.length; r++) {
            for (let i = 0; i < rows[r]; i++) {
                PIN_HOME.push({
                    x: 240 + (i - (rows[r] - 1) / 2) * SP,
                    y: HEAD_Y + r * ROW_DY
                });
            }
        }
    })();

    const GAME_FRAMES = 10;
    const CHARGE_FULL = 1.05;

    const BEST_KEY = 'webgames.bowling.best';
    const STRIKE_KEY = 'webgames.bowling.strikes';

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function halfAt(y) {
        const k = clamp((y - LANE_TOP_Y) / (LANE_BOT_Y - LANE_TOP_Y), 0, 1);
        return HALF_TOP + (HALF_BOT - HALF_TOP) * k;
    }

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

    function loadNum(key) {
        try {
            return parseInt(window.localStorage.getItem(key), 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveNum(key, v) {
        try {
            window.localStorage.setItem(key, String(v));
        } catch (e) { /* 忽略隐私模式限制 */ }
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        frame: document.getElementById('frame'),
        roll: document.getElementById('roll'),
        pins: document.getElementById('pins'),
        total: document.getElementById('total'),
        best: document.getElementById('best'),
        strikes: document.getElementById('strikes'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 状态 ---------- */
    let state = 'ready';           // ready | aim | roll | settle | over
    let frame = 1;
    let ballNo = 1;
    let pins = [];
    let frames = [];
    let rolls = [];
    let ball = null;
    let aimX = 0;                  // -1..1
    let charging = false;
    let chargeT = 0;
    let hook = 0;
    let settleT = 0;
    let lastKnock = 0;
    let clock = 0;
    let hudCache = '';
    let msg = '';
    let msgT = 0;
    let banner = null;
    const fx = [];

    let best = loadNum(BEST_KEY);
    let strikes = loadNum(STRIKE_KEY);

    /* ---------- 球瓶 ---------- */
    function freshPins(list) {
        pins = [];
        const src = list || PIN_HOME;
        for (let i = 0; i < src.length; i++) {
            pins.push({
                hx: src[i].x,
                hy: src[i].y,
                x: src[i].x,
                y: src[i].y,
                vx: 0,
                vy: 0,
                down: false,
                ang: (Math.random() - 0.5) * 0.5,
                spin: 0,
                fallT: 0
            });
        }
    }

    function standingCount() {
        let n = 0;
        for (let i = 0; i < pins.length; i++) {
            if (!pins[i].down) n++;
        }
        return n;
    }

    function resetFrame() {
        frame = 1;
        ballNo = 1;
        frames = [];
        rolls = [];
        for (let i = 0; i < GAME_FRAMES; i++) frames.push([]);
        freshPins();
        ball = null;
        aimX = 0;
        hook = 0;
        msg = '';
        msgT = 0;
        banner = null;
        fx.length = 0;
        state = 'aim';
        hudCache = '';
        updateHud();
    }

    function startGame() {
        resetFrame();
        els.overlay.classList.remove('show');
    }

    function gameOver() {
        state = 'over';
        const total = totalScore();
        if (total > best) {
            best = total;
            saveNum(BEST_KEY, best);
        }
        els.ovTitle.textContent = '十局结束';
        els.ovDesc.textContent = '本局共击倒 ' + sumRolls() + ' 个球瓶，其中全中 ' +
            countStrikes() + ' 次。再来一局挑战更高的分数。';
        els.ovScore.innerHTML = '总分 <b>' + total + '</b> · 最高分 ' + best;
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    function sumRolls() {
        let s = 0;
        for (let i = 0; i < rolls.length; i++) s += rolls[i];
        return s;
    }

    function countStrikes() {
        let n = 0;
        for (let i = 0; i < frames.length; i++) {
            if (frames[i].length && frames[i][0] === 10) n++;
        }
        return n;
    }

    /* ---------- 计分（标准十局，最多两投） ---------- */
    function frameTotals() {
        const out = [];
        let i = 0;
        let total = 0;
        for (let f = 0; f < GAME_FRAMES; f++) {
            if (i >= rolls.length) break;
            if (rolls[i] === 10) {
                if (i + 2 >= rolls.length) break;
                total += 10 + rolls[i + 1] + rolls[i + 2];
                i += 1;
            } else {
                if (i + 1 >= rolls.length) break;
                const s = rolls[i] + rolls[i + 1];
                if (s === 10) {
                    if (i + 2 >= rolls.length) break;
                    total += 10 + rolls[i + 2];
                } else {
                    total += s;
                }
                i += 2;
            }
            out.push(total);
        }
        return out;
    }

    function totalScore() {
        const t = frameTotals();
        return t.length ? t[t.length - 1] : 0;
    }

    /* ---------- 投球 ---------- */
    function powerNow() {
        return clamp(chargeT / CHARGE_FULL, 0, 1);
    }

    function doThrow() {
        const p = powerNow();
        const sp = 246 + 268 * p;
        ball = {
            x: 240 + aimX * 96,
            y: BALL_Y0,
            vx: 0,
            vy: -sp,
            live: true,
            guttered: false,
            t: 0
        };
        hook = 0;
        charging = false;
        chargeT = 0;
        settleT = 0;
        lastKnock = 0;
        state = 'roll';
        fx.push({ type: 'ring', x: ball.x, y: ball.y, t: 0, max: 0.34, r: 10 });
    }

    /* ---------- 物理 ---------- */
    function stepBall(h) {
        if (!ball || !ball.live) return false;

        if (hook !== 0) {
            ball.vx = clamp(ball.vx + hook * 250 * h, -190, 190);
        }
        ball.x += ball.vx * h;
        ball.y += ball.vy * h;
        ball.t += h;

        // 掉沟
        const half = halfAt(ball.y) - BALL_R * 0.6;
        if (!ball.guttered && Math.abs(ball.x - 240) > half) {
            ball.guttered = true;
            ball.x = 240 + (ball.x > 240 ? half : -half);
            msg = '掉沟了';
            msgT = 1.4;
        }

        if (!ball.guttered) {
            for (let i = 0; i < pins.length; i++) {
                const p = pins[i];
                const dx = p.x - ball.x;
                const dy = p.y - ball.y;
                const d2 = dx * dx + dy * dy;
                const lim = BALL_R + PIN_R;
                if (d2 > lim * lim || d2 < 1e-6) continue;

                const d = Math.sqrt(d2);
                const nx = dx / d;
                const ny = dy / d;
                const overlap = lim - d;
                p.x += nx * overlap;
                p.y += ny * overlap;

                const vn = (p.vx - ball.vx) * nx + (p.vy - ball.vy) * ny;
                if (vn < 0) {
                    const j = -(1 + 0.42) * vn / (1 / 6 + 1);
                    ball.vx -= (j / 6) * nx;
                    ball.vy -= (j / 6) * ny;
                    p.vx += j * nx;
                    p.vy += j * ny;
                    knockPin(p, 1);
                }
            }
        }

        if (ball.y < 186 || ball.t > 3.2) {
            ball.live = false;
            return false;
        }
        return true;
    }

    function knockPin(p, force) {
        if (!p.down) {
            p.down = true;
            p.spin = (Math.random() - 0.5) * 9 * force;
            lastKnock++;
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 40) {
            p.vx += (Math.random() - 0.5) * 40;
            p.vy += (Math.random() - 0.5) * 30 - 22;
        }
    }

    function stepPins(h) {
        for (let i = 0; i < pins.length; i++) {
            const p = pins[i];
            p.x += p.vx * h;
            p.y += p.vy * h;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > 1) {
                const ns = Math.max(0, sp - 720 * h);
                p.vx *= ns / sp;
                p.vy *= ns / sp;
            } else {
                p.vx = 0;
                p.vy = 0;
            }
            if (p.down) {
                p.fallT = Math.min(1, p.fallT + h * 3.4);
                p.ang += p.spin * h;
            }
        }

        // 瓶与瓶碰撞（连锁）
        for (let i = 0; i < pins.length; i++) {
            const a = pins[i];
            for (let j = i + 1; j < pins.length; j++) {
                const b = pins[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                const lim = PIN_R * 2;
                if (d2 > lim * lim || d2 < 1e-6) continue;
                const d = Math.sqrt(d2);
                const nx = dx / d;
                const ny = dy / d;
                const overlap = (lim - d) * 0.5;
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                b.x += nx * overlap;
                b.y += ny * overlap;

                const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (vn < -12) {
                    const j2 = -(1 + 0.4) * vn * 0.5;
                    a.vx -= j2 * nx;
                    a.vy -= j2 * ny;
                    b.vx += j2 * nx;
                    b.vy += j2 * ny;
                    if (vn < -34) {
                        knockPin(b, 0.8);
                        knockPin(a, 0.6);
                    }
                }
            }
        }
    }

    /* ---------- 结算 ---------- */
    function settleRoll() {
        const left = standingCount();
        const knocked = pins.length - left;
        rolls.push(knocked);
        frames[frame - 1].push(knocked);
        lastKnock = knocked;

        if (knocked === 0) {
            msg = ballNo === 1 ? '空杆' : '没倒';
            msgT = 1.6;
        } else if (knocked === pins.length) {
            msg = ballNo === 1 ? '全中 STRIKE' : '补中 SPARE';
            msgT = 1.8;
            if (ballNo === 1) {
                strikes = countStrikes();
                saveNum(STRIKE_KEY, strikes);
                banner = { title: 'STRIKE', sub: '十瓶全倒', t: 0, max: 1.8 };
            } else {
                banner = { title: 'SPARE', sub: '补中', t: 0, max: 1.6 };
            }
        }

        const allDown = left === 0;
        if (allDown || ballNo === 2) {
            nextFrame();
        } else {
            // 第二次投球：把还站着的瓶重新摆回原位
            const alive = [];
            for (let i = 0; i < pins.length; i++) {
                if (!pins[i].down) alive.push({ x: pins[i].hx, y: pins[i].hy });
            }
            freshPins(alive);
            ballNo = 2;
            ball = null;
            state = 'aim';
        }
        updateHud();
    }

    function nextFrame() {
        ball = null;
        if (frame >= GAME_FRAMES) {
            gameOver();
            return;
        }
        frame++;
        ballNo = 1;
        freshPins();
        state = 'aim';
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = fx.length - 1; i >= 0; i--) {
            fx[i].t += dt;
            if (fx[i].t > fx[i].max) fx.splice(i, 1);
        }
        if (msgT > 0) msgT -= dt;
        if (banner) {
            banner.t += dt;
            if (banner.t > banner.max) banner = null;
        }

        if (state === 'aim' && charging) chargeT += dt;

        if (state === 'roll') {
            const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
            const h = dt / steps;
            for (let s = 0; s < steps; s++) {
                stepBall(h);
                stepPins(h);
            }
            if (!ball || !ball.live) {
                state = 'settle';
                settleT = 0;
            }
        } else if (state === 'settle') {
            stepPins(dt * 0.6);
            settleT += dt;
            if (settleT > 0.75) settleRoll();
        }
    }

    /* ---------- 绘制 ---------- */
    function laneQuad(y0, y1) {
        ctx.beginPath();
        ctx.moveTo(240 - halfAt(y0), y0);
        ctx.lineTo(240 + halfAt(y0), y0);
        ctx.lineTo(240 + halfAt(y1), y1);
        ctx.lineTo(240 - halfAt(y1), y1);
        ctx.closePath();
    }

    function drawLane() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070c14');
        g.addColorStop(0.5, '#0a1220');
        g.addColorStop(1, '#05080e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(240, 300, 40, 240, 300, 320);
        halo.addColorStop(0, 'rgba(240, 190, 120, .1)');
        halo.addColorStop(1, 'rgba(240, 190, 120, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 140, W, 460);

        // 后墙与落瓶坑
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(240 - HALF_TOP - 16, LANE_TOP_Y);
        ctx.lineTo(240 + HALF_TOP + 16, LANE_TOP_Y);
        ctx.lineTo(240 + halfAt(DECK_FRONT), DECK_FRONT);
        ctx.lineTo(240 - halfAt(DECK_FRONT), DECK_FRONT);
        ctx.closePath();
        const pit = ctx.createLinearGradient(0, LANE_TOP_Y, 0, DECK_FRONT);
        pit.addColorStop(0, '#0a0f18');
        pit.addColorStop(0.72, '#141a24');
        pit.addColorStop(1, '#1d2430');
        ctx.fillStyle = pit;
        ctx.fill();
        ctx.restore();

        // 瓶台上方的顶灯
        ctx.save();
        const wall = ctx.createRadialGradient(240, LANE_TOP_Y + 6, 8, 240, LANE_TOP_Y + 6, 150);
        wall.addColorStop(0, 'rgba(150, 186, 232, .22)');
        wall.addColorStop(0.5, 'rgba(90, 120, 170, .1)');
        wall.addColorStop(1, 'rgba(20, 30, 50, 0)');
        ctx.fillStyle = wall;
        ctx.fillRect(60, LANE_TOP_Y - 40, W - 120, 120);
        ctx.restore();

        // 瓶台
        ctx.save();
        laneQuad(LANE_TOP_Y, DECK_FRONT);
        const deck = ctx.createLinearGradient(0, LANE_TOP_Y, 0, DECK_FRONT);
        deck.addColorStop(0, '#7a5227');
        deck.addColorStop(0.5, '#a8743a');
        deck.addColorStop(1, '#c08a49');
        ctx.fillStyle = deck;
        ctx.fill();

        // 瓶台聚光
        const spot = ctx.createRadialGradient(240, 262, 10, 240, 262, 120);
        spot.addColorStop(0, 'rgba(255, 244, 214, .3)');
        spot.addColorStop(1, 'rgba(255, 244, 214, 0)');
        ctx.fillStyle = spot;
        ctx.fillRect(120, 190, 240, 150);
        ctx.restore();

        // 球道
        ctx.save();
        laneQuad(DECK_FRONT, LANE_BOT_Y);
        const wood = ctx.createLinearGradient(0, DECK_FRONT, 0, LANE_BOT_Y);
        wood.addColorStop(0, '#b57e42');
        wood.addColorStop(0.35, '#c98f4d');
        wood.addColorStop(0.78, '#d99a55');
        wood.addColorStop(1, '#c78b49');
        ctx.fillStyle = wood;
        ctx.fill();
        ctx.clip();

        // 木板缝
        for (let i = -7; i <= 7; i++) {
            const xb = 240 + i * 30;
            const xt = 240 + i * 15.2;
            ctx.beginPath();
            ctx.moveTo(xt, DECK_FRONT);
            ctx.lineTo(xb, LANE_BOT_Y);
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(96, 58, 22, .28)' : 'rgba(255, 230, 190, .12)';
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }

        // 球道纵向高光
        const sheen = ctx.createLinearGradient(0, DECK_FRONT, 0, LANE_BOT_Y);
        sheen.addColorStop(0, 'rgba(255, 240, 210, .14)');
        sheen.addColorStop(0.5, 'rgba(255, 240, 210, .02)');
        sheen.addColorStop(1, 'rgba(255, 240, 210, .1)');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, DECK_FRONT, W, LANE_BOT_Y - DECK_FRONT);

        // 中间油面反光
        const oil = ctx.createLinearGradient(150, 0, 330, 0);
        oil.addColorStop(0, 'rgba(255, 250, 230, 0)');
        oil.addColorStop(0.5, 'rgba(255, 250, 230, .1)');
        oil.addColorStop(1, 'rgba(255, 250, 230, 0)');
        ctx.fillStyle = oil;
        ctx.fillRect(110, DECK_FRONT, 260, LANE_BOT_Y - DECK_FRONT);
        ctx.restore();

        // 两侧沟槽
        for (let s = -1; s <= 1; s += 2) {
            ctx.beginPath();
            const inner = halfAt(DECK_FRONT);
            const outer = inner + 20;
            const innerB = halfAt(LANE_BOT_Y);
            const outerB = innerB + 30;
            ctx.moveTo(240 + s * inner, DECK_FRONT);
            ctx.lineTo(240 + s * outer, DECK_FRONT);
            ctx.lineTo(240 + s * outerB, LANE_BOT_Y);
            ctx.lineTo(240 + s * innerB, LANE_BOT_Y);
            ctx.closePath();
            const gut = ctx.createLinearGradient(240 + s * inner, 0, 240 + s * outerB, 0);
            gut.addColorStop(0, 'rgba(30, 22, 14, .92)');
            gut.addColorStop(1, 'rgba(14, 12, 10, .96)');
            ctx.fillStyle = gut;
            ctx.fill();
        }

        // 球道箭头
        ctx.save();
        ctx.fillStyle = 'rgba(84, 48, 18, .5)';
        for (let i = -3; i <= 3; i++) {
            const x = 240 + i * 30;
            const y = 462 + Math.abs(i) * 3;
            ctx.beginPath();
            ctx.moveTo(x, y - 7);
            ctx.lineTo(x + 5, y + 2);
            ctx.lineTo(x - 5, y + 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // 犯规线
        ctx.save();
        ctx.strokeStyle = 'rgba(70, 40, 14, .55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(240 - halfAt(FOUL_Y), FOUL_Y);
        ctx.lineTo(240 + halfAt(FOUL_Y), FOUL_Y);
        ctx.stroke();
        ctx.restore();
    }

    function drawPin(p) {
        const t = p.down ? p.fallT : 0;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.down) {
            ctx.globalAlpha = 1 - 0.45 * t;
            ctx.rotate(p.ang);
            ctx.scale(1, 1 - 0.5 * t);
        }
        const sc = 0.86 + (p.y - HEAD_Y) * 0.006;
        ctx.scale(sc, sc);

        // 落地影子
        if (!p.down) {
            ctx.beginPath();
            ctx.ellipse(0, 1.5, 7, 3, 0, 0, TAU);
            ctx.fillStyle = 'rgba(30, 18, 6, .34)';
            ctx.fill();
        }

        // 瓶身
        ctx.beginPath();
        ctx.moveTo(0, -PIN_H + 3.4);
        ctx.bezierCurveTo(3.6, -PIN_H + 3.4, 3.2, -PIN_H + 8, 2.1, -PIN_H + 12);
        ctx.bezierCurveTo(1.2, -PIN_H + 15, 4.6, -PIN_H + 19, 5.4, -8);
        ctx.bezierCurveTo(5.9, -3.6, 5.4, 0, 5.4, 0);
        ctx.lineTo(-5.4, 0);
        ctx.bezierCurveTo(-5.4, 0, -5.9, -3.6, -5.4, -8);
        ctx.bezierCurveTo(-4.6, -PIN_H + 19, -1.2, -PIN_H + 15, -2.1, -PIN_H + 12);
        ctx.bezierCurveTo(-3.2, -PIN_H + 8, -3.6, -PIN_H + 3.4, 0, -PIN_H + 3.4);

        const body = ctx.createLinearGradient(-6, 0, 6, 0);
        body.addColorStop(0, '#c8ccd4');
        body.addColorStop(0.35, '#fdfdff');
        body.addColorStop(0.72, '#f2f4f8');
        body.addColorStop(1, '#b9bec8');
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = 'rgba(46, 52, 62, .55)';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // 红色瓶颈环
        ctx.save();
        ctx.beginPath();
        ctx.rect(-5, -PIN_H + 9, 10, 6.5);
        ctx.clip();
        ctx.fillStyle = 'rgba(214, 62, 58, .92)';
        ctx.fillRect(-5, -PIN_H + 9, 10, 2.6);
        ctx.fillRect(-5, -PIN_H + 13.4, 10, 2.2);
        ctx.restore();

        // 高光
        ctx.beginPath();
        ctx.ellipse(-1.6, -PIN_H + 18, 1.1, 5, 0.08, 0, TAU);
        ctx.fillStyle = 'rgba(255, 255, 255, .8)';
        ctx.fill();
        ctx.restore();
    }

    function drawPins() {
        const order = pins.slice().sort(function (a, b) {
            return a.y - b.y;
        });
        for (let i = 0; i < order.length; i++) drawPin(order[i]);
    }

    function drawBall() {
        if (!ball || !ball.live) return;
        const k = clamp((ball.y - LANE_TOP_Y) / (LANE_BOT_Y - LANE_TOP_Y), 0, 1);
        const r = BALL_R * (0.74 + 0.26 * k);

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ball.x, ball.y + r * 0.5, r * 0.9, r * 0.42, 0, 0, TAU);
        ctx.fillStyle = 'rgba(30, 16, 4, .3)';
        ctx.fill();

        const g = ctx.createRadialGradient(
            ball.x - r * 0.35, ball.y - r * 0.4, r * 0.15,
            ball.x, ball.y, r * 1.05
        );
        g.addColorStop(0, '#7fa4ff');
        g.addColorStop(0.4, '#2c4fa8');
        g.addColorStop(0.82, '#132a5e');
        g.addColorStop(1, '#08142c');
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();

        // 指孔
        ctx.fillStyle = 'rgba(6, 12, 26, .78)';
        const holes = [[-0.4, -0.32], [-0.18, -0.5], [-0.06, -0.2]];
        for (let i = 0; i < holes.length; i++) {
            ctx.beginPath();
            ctx.arc(ball.x + holes[i][0] * r, ball.y + holes[i][1] * r, r * 0.12, 0, TAU);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.ellipse(ball.x - r * 0.36, ball.y - r * 0.42, r * 0.28, r * 0.17, -0.7, 0, TAU);
        ctx.fillStyle = 'rgba(255, 255, 255, .55)';
        ctx.fill();
        ctx.restore();
    }

    function drawAim() {
        if (state !== 'aim') return;
        const x = 240 + aimX * 96;
        const p = powerNow();

        // 瞄准虚线
        ctx.save();
        ctx.setLineDash([7, 9]);
        ctx.lineDashOffset = -clock * 34;
        ctx.strokeStyle = 'rgba(180, 226, 255, .5)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, BALL_Y0 - 14);
        ctx.lineTo(x, DECK_FRONT - 4);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(x, DECK_FRONT - 4, 7, 0, TAU);
        ctx.strokeStyle = 'rgba(180, 226, 255, .42)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();

        // 待发的球
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, BALL_Y0 + 6, 9, 3.6, 0, 0, TAU);
        ctx.fillStyle = 'rgba(30, 16, 4, .32)';
        ctx.fill();
        const g = ctx.createRadialGradient(x - 4, BALL_Y0 - 4, 2, x, BALL_Y0, 12);
        g.addColorStop(0, '#7fa4ff');
        g.addColorStop(0.42, '#2c4fa8');
        g.addColorStop(1, '#08142c');
        ctx.beginPath();
        ctx.arc(x, BALL_Y0, 10, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = 'rgba(6, 12, 26, .8)';
        const holes = [[-3.4, -3.4], [-1.5, -5], [-0.6, -2.3]];
        for (let i = 0; i < holes.length; i++) {
            ctx.beginPath();
            ctx.arc(x + holes[i][0], BALL_Y0 + holes[i][1], 1.2, 0, TAU);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(x - 3.6, BALL_Y0 - 4.2, 2.8, 1.7, -0.7, 0, TAU);
        ctx.fillStyle = 'rgba(255, 255, 255, .55)';
        ctx.fill();
        ctx.restore();

        // 蓄力箭头
        if (p > 0.02) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 214, 130, ' + (0.3 + p * 0.5) + ')';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(x, BALL_Y0 - 18 - p * 26);
            ctx.lineTo(x, BALL_Y0 - 18);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, BALL_Y0 - 20 - p * 26);
            ctx.lineTo(x - 5, BALL_Y0 - 12 - p * 26);
            ctx.lineTo(x + 5, BALL_Y0 - 12 - p * 26);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 214, 130, ' + (0.35 + p * 0.5) + ')';
            ctx.fill();
            ctx.restore();
        }
    }

    function drawFx() {
        for (let i = 0; i < fx.length; i++) {
            const e = fx[i];
            const k = clamp(e.t / e.max, 0, 1);
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r + k * 24, 0, TAU);
            ctx.strokeStyle = 'rgba(255, 236, 190, ' + (0.5 * (1 - k)) + ')';
            ctx.lineWidth = 2 * (1 - k) + 0.4;
            ctx.stroke();
        }
    }

    function drawScoreBox() {
        const bw = 38;
        const gap = 5;
        const x0 = (W - (bw * GAME_FRAMES + gap * (GAME_FRAMES - 1))) / 2;
        const y = 60;
        const bh = 56;
        const totals = frameTotals();

        ctx.save();
        for (let i = 0; i < GAME_FRAMES; i++) {
            const x = x0 + i * (bw + gap);
            const cur = i === frame - 1 && state !== 'over';

            roundRectPath(ctx, x, y, bw, bh, 5);
            ctx.fillStyle = cur ? 'rgba(72, 110, 176, .24)' : 'rgba(20, 30, 48, .68)';
            ctx.fill();
            ctx.strokeStyle = cur ? 'rgba(150, 206, 255, .78)' : 'rgba(90, 122, 165, .3)';
            ctx.lineWidth = cur ? 1.5 : 1;
            ctx.stroke();

            // 局号
            ctx.fillStyle = 'rgba(140, 172, 210, .5)';
            ctx.font = '700 7.5px ' + FONT;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(String(i + 1), x + 4, y + 4);

            // 两次投球标记
            const f = frames[i] || [];
            ctx.textAlign = 'right';
            ctx.font = '700 8.5px ' + FONT;
            for (let r = 0; r < f.length; r++) {
                let mark;
                if (r === 1 && f[0] + f[1] === 10) mark = '/';
                else if (r === 0 && f[0] === 10) mark = 'X';
                else mark = f[r] === 0 ? '-' : String(f[r]);
                ctx.fillStyle = mark === 'X' || mark === '/' ? 'rgba(255, 208, 132, .95)' : 'rgba(178, 202, 228, .78)';
                ctx.fillText(mark, x + bw - 4 - (1 - r) * 8.5, y + 4);
            }

            // 累计分
            if (totals[i] !== undefined) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#eaf2ff';
                ctx.font = '800 15px ' + FONT;
                ctx.fillText(String(totals[i]), x + bw / 2, y + bh - 20);
            }
        }
        ctx.restore();
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .46)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('BOWLING', W / 2, 20);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('保龄球', W / 2, 40);
        ctx.restore();

        drawScoreBox();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(160, 192, 226, .58)';
        if (frame > GAME_FRAMES) {
            ctx.fillText('十局结束 · 总分 ' + totalScore(), W / 2, 136);
        } else {
            ctx.fillText('第 ' + frame + ' 局 · 第 ' + ballNo + ' 投 · 剩余 ' +
                standingCount() + ' 瓶', W / 2, 136);
        }
        ctx.restore();
    }

    function drawPower() {
        const x = 60;
        const y = 566;
        const w = W - 120;
        const h = 11;
        const p = powerNow();

        roundRectPath(ctx, x, y, w, h, 5.5);
        ctx.fillStyle = 'rgba(8, 16, 26, .78)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 180, 210, .2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (p > 0.004) {
            ctx.save();
            roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 4);
            ctx.clip();
            const g = ctx.createLinearGradient(x, 0, x + w, 0);
            g.addColorStop(0, 'rgba(110, 200, 240, .95)');
            g.addColorStop(0.6, 'rgba(255, 214, 130, .95)');
            g.addColorStop(1, 'rgba(255, 120, 96, .98)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, w * p, h);
            ctx.restore();
        }

        ctx.save();
        ctx.font = '700 10px ' + FONT;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(160, 190, 218, .5)';
        ctx.fillText('力度', x, y - 10);
        ctx.textAlign = 'right';
        ctx.fillStyle = p > 0.02 ? 'rgba(255, 226, 170, .9)' : 'rgba(160, 190, 218, .42)';
        ctx.fillText(Math.round(p * 100) + '%', x + w, y - 10);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;

        if (msgT > 0 && msg) {
            ctx.fillStyle = 'rgba(255, 214, 150, .95)';
            ctx.fillText(msg, W / 2, 594);
        } else {
            let tip;
            if (state === 'roll') {
                tip = '按住 ← → 给球加旋转';
            } else if (state === 'settle') {
                tip = '倒了 ' + lastKnock + ' 个瓶';
            } else if (charging) {
                tip = '松开投球 · 力度 ' + Math.round(powerNow() * 100) + '%';
            } else {
                tip = '移动鼠标选位 · 按住蓄力 · 松开投球';
            }
            ctx.fillStyle = 'rgba(150, 178, 208, .48)';
            ctx.fillText(tip, W / 2, 594);
        }
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const k = clamp(banner.t / banner.max, 0, 1);
        const alpha = k < 0.1 ? k / 0.1 : (k > 0.78 ? (1 - k) / 0.22 : 1);
        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const g = ctx.createLinearGradient(60, 0, W - 60, 0);
        g.addColorStop(0, 'rgba(8, 14, 24, 0)');
        g.addColorStop(0.5, 'rgba(8, 16, 26, .9)');
        g.addColorStop(1, 'rgba(8, 14, 24, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(50, 350, W - 100, 86);

        ctx.fillStyle = '#ffe0a0';
        ctx.font = '800 24px ' + FONT;
        ctx.fillText(banner.title, W / 2, 380);

        ctx.fillStyle = 'rgba(232, 214, 180, .8)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, 410);
        ctx.restore();
    }

    function draw() {
        drawLane();
        drawPins();
        drawAim();
        drawBall();
        drawFx();
        drawHeader();
        drawPower();
        drawFooter();
        drawBanner();
    }

    /* ---------- 面板 ---------- */
    function updateHud() {
        const key = [frame, ballNo, standingCount(), totalScore(), best, strikes, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.frame.textContent = Math.min(frame, GAME_FRAMES) + ' / ' + GAME_FRAMES;
        els.roll.textContent = ballNo;
        els.pins.textContent = standingCount();
        els.total.textContent = totalScore();
        els.best.textContent = best;
        els.strikes.textContent = countStrikes();
    }

    /* ---------- 输入 ---------- */
    function pointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    function moveAimTo(px) {
        aimX = clamp((px - 240) / 96, -1, 1);
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const p = pointerPos(e);
        if (state === 'aim') {
            moveAimTo(p.x);
            charging = true;
            chargeT = 0;
            try {
                if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
            } catch (err) { /* 某些环境不支持指针捕获 */ }
        } else if (state === 'roll') {
            hook = p.x < 240 ? -1 : 1;
        }
    });

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'aim') return;
        moveAimTo(pointerPos(e).x);
    });

    canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        if (state === 'aim' && charging) {
            doThrow();
        } else if (state === 'roll') {
            hook = 0;
        }
    });

    canvas.addEventListener('pointercancel', function () {
        charging = false;
        hook = 0;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            e.preventDefault();
            if (state === 'aim') aimX = clamp(aimX - 0.08, -1, 1);
            else if (state === 'roll') hook = -1;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            e.preventDefault();
            if (state === 'aim') aimX = clamp(aimX + 0.08, -1, 1);
            else if (state === 'roll') hook = 1;
        } else if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'aim' && !charging) {
                charging = true;
                chargeT = 0;
            }
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
            hook = 0;
        } else if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'aim' && charging) doThrow();
        }
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
        if (dt > 0) update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    freshPins();
    for (let i = 0; i < GAME_FRAMES; i++) frames.push([]);
    updateHud();
    requestAnimationFrame(loop);
})();
