/* ==========================================================
   台球 · 九球挑战 Billiards
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    /* ---------- 球台尺寸 ---------- */
    const FRAME = { x: 42, y: 128, w: 396, h: 418 };
    const FELT = { x: 64, y: 150, w: 352, h: 374 };
    const FX = FELT.x;
    const FY = FELT.y;
    const FR = FX + FELT.w;
    const FB = FY + FELT.h;

    const BR = 11;                 // 球半径
    const POCKET_R = 20;
    const POT_R = POCKET_R + 2;    // 落袋判定与袋口免碰库共用
    const POCKETS = [
        [FX, FY], [240, FY], [FR, FY],
        [FX, FB], [240, FB], [FR, FB]
    ];

    /* ---------- 物理 ---------- */
    const FRICTION = 420;          // 台呢摩擦（像素/秒²）
    const WALL_E = 0.86;
    const BALL_E = 0.94;
    const MAX_SPEED = 1500;
    const SUB = 1 / 240;

    const GAME_TIME = 80;
    const CHARGE_FULL = 0.95;

    const COLORS = [
        '#f4f8ff',
        '#f2c744', '#3f7bff', '#ff4d4d', '#a765ff',
        '#ff8b2e', '#2fbf71', '#b0392c', '#22262f', '#eec94e'
    ];

    const START = { x: 240, y: 194 };
    const RACK_TOP = 264;
    const RACK = [
        [0, 0],
        [-11.8, 20.4], [11.8, 20.4],
        [-23.6, 40.8], [0, 40.8], [23.6, 40.8],
        [-11.8, 61.2], [11.8, 61.2],
        [0, 81.6]
    ];

    const BEST_KEY = 'webgames.billiards.best';
    const BREAK_KEY = 'webgames.billiards.break';

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
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
        score: document.getElementById('score'),
        left: document.getElementById('left'),
        shots: document.getElementById('shots'),
        rack: document.getElementById('rack'),
        best: document.getElementById('best'),
        bestBreak: document.getElementById('best-break'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 状态 ---------- */
    let balls = [];
    let cue = null;
    let aim = Math.PI / 2;
    let charging = false;
    let chargeT = 0;
    let state = 'ready';           // ready | aim | rolling | over
    let score = 0;
    let shots = 0;
    let rackNo = 1;
    let timeLeft = GAME_TIME;
    let stable = 0;
    let clock = 0;
    let shotGain = 0;
    let shotPots = 0;
    let hudCache = '';
    let banner = null;
    const fx = [];
    const texts = [];

    let best = loadNum(BEST_KEY);
    let bestBreak = loadNum(BREAK_KEY);

    /* ---------- 摆球 ---------- */
    function rackBalls() {
        balls = [];
        const nums = [1, 2, 3, 4, 5, 6, 7, 8];
        for (let i = nums.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const t = nums[i];
            nums[i] = nums[j];
            nums[j] = t;
        }
        let k = 0;
        for (let i = 0; i < RACK.length; i++) {
            // 九号球固定放在菱形正中
            const num = i === 4 ? 9 : nums[k++];
            balls.push({
                x: 240 + RACK[i][0],
                y: RACK_TOP + RACK[i][1],
                vx: 0, vy: 0,
                num: num,
                alive: true
            });
        }
        cue = { x: START.x, y: START.y, vx: 0, vy: 0, num: 0, alive: true };
        balls.push(cue);
    }

    function aliveCount() {
        let n = 0;
        for (let i = 0; i < balls.length; i++) {
            if (balls[i].alive && balls[i].num > 0) n++;
        }
        return n;
    }

    function startGame() {
        score = 0;
        shots = 0;
        rackNo = 1;
        timeLeft = GAME_TIME;
        shotGain = 0;
        shotPots = 0;
        charging = false;
        chargeT = 0;
        stable = 0;
        banner = null;
        fx.length = 0;
        texts.length = 0;
        aim = Math.PI / 2;
        rackBalls();
        state = 'aim';
        hudCache = '';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function gameOver() {
        state = 'over';
        charging = false;
        if (score > best) {
            best = score;
            saveNum(BEST_KEY, best);
        }
        els.ovTitle.textContent = '时间到';
        els.ovDesc.textContent = '这一局打进了 ' + (9 * rackNo - aliveCount()) +
            ' 颗球。再开一局试试更高的分数。';
        els.ovScore.innerHTML = '本局得分 <b>' + score + '</b> · 最高分 ' + best;
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    /* ---------- 击球 ---------- */
    function powerNow() {
        return clamp(chargeT / CHARGE_FULL, 0, 1);
    }

    function shoot() {
        if (!cue || !cue.alive) return;
        const p = powerNow();
        const sp = Math.min(MAX_SPEED, 320 + 1180 * p);
        const dx = Math.cos(aim);
        const dy = Math.sin(aim);
        cue.vx = dx * sp;
        cue.vy = dy * sp;
        charging = false;
        chargeT = 0;
        shots++;
        shotGain = 0;
        shotPots = 0;
        stable = 0;
        state = 'rolling';
        fx.push({ type: 'ring', x: cue.x, y: cue.y, t: 0, max: 0.3, r: 8 + p * 10 });
        updateHud();
    }

    function respawnCue() {
        cue.x = START.x;
        cue.y = START.y;
        cue.vx = 0;
        cue.vy = 0;
        cue.alive = true;
        // 起点被占则往下错开
        let guard = 0;
        while (guard < 40) {
            let clear = true;
            for (let i = 0; i < balls.length; i++) {
                const b = balls[i];
                if (b === cue || !b.alive) continue;
                if (Math.hypot(b.x - cue.x, b.y - cue.y) < BR * 2.4) {
                    clear = false;
                    break;
                }
            }
            if (clear) break;
            cue.y += 6;
            guard++;
        }
        fx.push({ type: 'flash', x: cue.x, y: cue.y, t: 0, max: 0.5, r: 30 });
    }

    function pot(b) {
        b.alive = false;
        b.vx = 0;
        b.vy = 0;
        fx.push({ type: 'flash', x: b.x, y: b.y, t: 0, max: 0.55, r: 34 });
        if (b.num === 0) {
            score = Math.max(0, score - 20);
            texts.push({ x: b.x, y: b.y, t: 0, max: 1.1, text: '白球落袋 -20', color: 'rgba(255, 150, 142, .98)' });
        } else {
            const gain = b.num * 10;
            score += gain;
            shotGain += gain;
            shotPots++;
            texts.push({ x: b.x, y: b.y, t: 0, max: 1, text: '+' + gain, color: 'rgba(255, 226, 150, .98)' });
            if (shotPots >= 2) {
                texts.push({
                    x: b.x, y: b.y - 18, t: 0, max: 1.2,
                    text: shotPots + ' 球连进', color: 'rgba(150, 240, 210, .98)'
                });
            }
        }
        updateHud();
    }

    function endShot() {
        if (shotGain > bestBreak) {
            bestBreak = shotGain;
            saveNum(BREAK_KEY, bestBreak);
        }
        if (!cue.alive) respawnCue();

        if (aliveCount() === 0) {
            score += 100;
            rackNo++;
            rackBalls();
            banner = { title: '清 台 +100', sub: '第 ' + rackNo + ' 组球已摆好', t: 0, max: 1.9 };
            texts.push({ x: 240, y: 330, t: 0, max: 1.2, text: '清台 +100', color: 'rgba(170, 244, 220, .98)' });
            state = 'aim';
            updateHud();
            return;
        }

        state = timeLeft > 0 ? 'aim' : 'over';
        if (state === 'over') gameOver();
        updateHud();
    }

    /* ---------- 物理 ---------- */
    function collideBalls() {
        for (let i = 0; i < balls.length; i++) {
            const a = balls[i];
            if (!a.alive) continue;
            for (let j = i + 1; j < balls.length; j++) {
                const b = balls[j];
                if (!b.alive) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                const min = BR * 2;
                if (d2 >= min * min || d2 < 1e-6) continue;

                const d = Math.sqrt(d2);
                const nx = dx / d;
                const ny = dy / d;
                const push = (min - d) * 0.5;
                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;

                const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (vn > 0) continue;
                const imp = -(1 + BALL_E) * vn * 0.5;
                a.vx -= imp * nx;
                a.vy -= imp * ny;
                b.vx += imp * nx;
                b.vy += imp * ny;
            }
        }
    }

    // 袋口区域：既要免碰库，也要判落袋，两个半径必须一致，
    // 否则会有球停在袋口里既不掉也不弹
    function inMouth(x, y) {
        for (let p = 0; p < POCKETS.length; p++) {
            if (Math.hypot(x - POCKETS[p][0], y - POCKETS[p][1]) < POT_R) return true;
        }
        return false;
    }

    function collideWalls(b) {
        if (inMouth(b.x, b.y)) return;
        if (b.x - BR < FX) {
            b.x = FX + BR;
            if (b.vx < 0) b.vx = -b.vx * WALL_E;
        } else if (b.x + BR > FR) {
            b.x = FR - BR;
            if (b.vx > 0) b.vx = -b.vx * WALL_E;
        }
        if (b.y - BR < FY) {
            b.y = FY + BR;
            if (b.vy < 0) b.vy = -b.vy * WALL_E;
        } else if (b.y + BR > FB) {
            b.y = FB - BR;
            if (b.vy > 0) b.vy = -b.vy * WALL_E;
        }
    }

    function physics(dt) {
        const steps = Math.max(1, Math.ceil(dt / SUB));
        const h = dt / steps;
        for (let s = 0; s < steps; s++) {
            for (let i = 0; i < balls.length; i++) {
                const b = balls[i];
                if (!b.alive) continue;
                b.x += b.vx * h;
                b.y += b.vy * h;
                const sp = Math.hypot(b.vx, b.vy);
                if (sp > 1) {
                    const ns = Math.max(0, sp - FRICTION * h);
                    const k = ns / sp;
                    b.vx *= k;
                    b.vy *= k;
                } else {
                    b.vx = 0;
                    b.vy = 0;
                }
            }
            collideBalls();
            collideBalls();
            for (let i = 0; i < balls.length; i++) {
                const b = balls[i];
                if (!b.alive) continue;
                collideWalls(b);
                if (inMouth(b.x, b.y)) pot(b);
                // 袋口没有库边，极端情况飞出台面就直接判进
                if (b.alive && (b.x < FX - POCKET_R || b.x > FR + POCKET_R ||
                        b.y < FY - POCKET_R || b.y > FB + POCKET_R)) {
                    pot(b);
                }
            }
        }
    }

    function allStopped() {
        for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            if (!b.alive) continue;
            if (b.vx * b.vx + b.vy * b.vy > 36) return false;
        }
        return true;
    }

    /* ---------- 瞄准预测 ---------- */
    function aimInfo() {
        const dx = Math.cos(aim);
        const dy = Math.sin(aim);
        const px = cue.x;
        const py = cue.y;

        let tw = Infinity;
        if (dx > 0.0001) tw = Math.min(tw, (FR - BR - px) / dx);
        if (dx < -0.0001) tw = Math.min(tw, (FX + BR - px) / dx);
        if (dy > 0.0001) tw = Math.min(tw, (FB - BR - py) / dy);
        if (dy < -0.0001) tw = Math.min(tw, (FY + BR - py) / dy);
        if (!isFinite(tw) || tw < 0) tw = 0;

        let bestT = tw;
        let target = null;
        for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            if (b === cue || !b.alive) continue;
            const ex = b.x - px;
            const ey = b.y - py;
            const proj = ex * dx + ey * dy;
            if (proj <= 0) continue;
            const perp2 = ex * ex + ey * ey - proj * proj;
            const rr = (BR * 2) * (BR * 2);
            if (perp2 > rr) continue;
            const t = proj - Math.sqrt(rr - perp2);
            if (t < bestT) {
                bestT = t;
                target = b;
            }
        }

        return {
            x: px + dx * bestT,
            y: py + dy * bestT,
            target: target,
            dx: dx,
            dy: dy
        };
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = fx.length - 1; i >= 0; i--) {
            fx[i].t += dt;
            if (fx[i].t > fx[i].max) fx.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            texts[i].t += dt;
            if (texts[i].t > texts[i].max) texts.splice(i, 1);
        }
        if (banner) {
            banner.t += dt;
            if (banner.t > banner.max) banner = null;
        }

        if (state === 'aim' || state === 'rolling') {
            timeLeft -= dt;
            if (timeLeft <= 0) {
                timeLeft = 0;
                if (state === 'aim') {
                    gameOver();
                    return;
                }
            }
        }

        if (state === 'aim' && charging) {
            chargeT += dt;
        }

        if (state === 'rolling') {
            physics(dt);
            if (allStopped()) {
                stable += dt;
                if (stable > 0.26) {
                    stable = 0;
                    endShot();
                }
            } else {
                stable = 0;
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function drawTable() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070d16');
        g.addColorStop(0.5, '#0b1420');
        g.addColorStop(1, '#05090f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 330, 60, W / 2, 330, 320);
        halo.addColorStop(0, 'rgba(48, 140, 120, .16)');
        halo.addColorStop(1, 'rgba(48, 140, 120, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 120, W, 470);

        // 木质外框
        const wood = ctx.createLinearGradient(FRAME.x, FRAME.y, FRAME.x + FRAME.w, FRAME.y + FRAME.h);
        wood.addColorStop(0, '#6b4426');
        wood.addColorStop(0.28, '#8a5c33');
        wood.addColorStop(0.55, '#5d3a20');
        wood.addColorStop(1, '#422715');
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        roundRectPath(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, 18);
        ctx.fillStyle = wood;
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundRectPath(ctx, FRAME.x + 1.4, FRAME.y + 1.4, FRAME.w - 2.8, FRAME.h - 2.8, 17);
        ctx.strokeStyle = 'rgba(255, 214, 168, .26)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();

        // 台呢
        const felt = ctx.createRadialGradient(240, 320, 30, 240, 320, 280);
        felt.addColorStop(0, '#12705a');
        felt.addColorStop(0.62, '#0e5c4a');
        felt.addColorStop(1, '#083a2f');
        ctx.fillStyle = felt;
        ctx.fillRect(FX, FY, FELT.w, FELT.h);

        // 台呢绒面质感
        ctx.save();
        ctx.globalAlpha = 0.028;
        ctx.strokeStyle = '#d8fff2';
        ctx.lineWidth = 1;
        for (let y = FY + 5; y < FB; y += 6) {
            ctx.beginPath();
            ctx.moveTo(FX, y);
            ctx.lineTo(FR, y);
            ctx.stroke();
        }
        ctx.restore();

        // 内沿暗影
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, .38)';
        ctx.lineWidth = 8;
        ctx.strokeRect(FX + 4, FY + 4, FELT.w - 8, FELT.h - 8);
        ctx.restore();

        // 库边袋口
        for (let i = 0; i < POCKETS.length; i++) {
            const p = POCKETS[i];
            const pg = ctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], POCKET_R + 6);
            pg.addColorStop(0, '#010305');
            pg.addColorStop(0.72, '#06100f');
            pg.addColorStop(1, 'rgba(4, 12, 11, .12)');
            ctx.beginPath();
            ctx.arc(p[0], p[1], POCKET_R + 6, 0, TAU);
            ctx.fillStyle = pg;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p[0], p[1], POCKET_R, 0, TAU);
            ctx.strokeStyle = 'rgba(190, 246, 226, .16)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }

        // 库边钻石定位点
        ctx.save();
        ctx.fillStyle = 'rgba(246, 232, 208, .46)';
        for (let i = 1; i <= 3; i++) {
            const x = FX + (FELT.w * i) / 4;
            ctx.save();
            ctx.translate(x, FY - 12);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
            ctx.restore();
            ctx.save();
            ctx.translate(x, FB + 12);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
            ctx.restore();
        }
        for (let i = 1; i <= 3; i++) {
            const y = FY + (FELT.h * i) / 4;
            ctx.save();
            ctx.translate(FX - 12, y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
            ctx.restore();
            ctx.save();
            ctx.translate(FR + 12, y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
            ctx.restore();
        }
        ctx.restore();

        // 开球线
        ctx.save();
        ctx.strokeStyle = 'rgba(220, 255, 244, .12)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(FX + 8, START.y);
        ctx.lineTo(FR - 8, START.y);
        ctx.stroke();
        ctx.restore();
    }

    function drawAim() {
        if (state !== 'aim' || !cue || !cue.alive) return;
        const info = aimInfo();
        const p = powerNow();

        ctx.save();
        ctx.setLineDash([6, 7]);
        ctx.lineDashOffset = -clock * 42;
        ctx.strokeStyle = p > 0.02 ? 'rgba(255, 236, 180, .82)' : 'rgba(214, 248, 236, .52)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(info.x, info.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 幽灵球
        ctx.beginPath();
        ctx.arc(info.x, info.y, BR, 0, TAU);
        ctx.strokeStyle = 'rgba(236, 255, 250, .62)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        if (info.target) {
            const dx = info.target.x - info.x;
            const dy = info.target.y - info.y;
            const d = Math.hypot(dx, dy) || 1;
            ctx.beginPath();
            ctx.moveTo(info.target.x + (dx / d) * BR, info.target.y + (dy / d) * BR);
            ctx.lineTo(info.target.x + (dx / d) * 40, info.target.y + (dy / d) * 40);
            ctx.strokeStyle = 'rgba(255, 226, 150, .7)';
            ctx.lineWidth = 1.8;
            ctx.stroke();
        }
        ctx.restore();

        // 球杆
        const back = 20 + p * 30;
        const bx = cue.x - Math.cos(aim) * back;
        const by = cue.y - Math.sin(aim) * back;
        const ex = cue.x - Math.cos(aim) * (back + 132);
        const ey = cue.y - Math.sin(aim) * (back + 132);
        ctx.save();
        ctx.lineCap = 'round';
        const cg = ctx.createLinearGradient(bx, by, ex, ey);
        cg.addColorStop(0, '#f4ecd8');
        cg.addColorStop(0.08, '#c9a06a');
        cg.addColorStop(0.75, '#7d4f28');
        cg.addColorStop(1, '#2a1a10');
        ctx.strokeStyle = cg;
        ctx.lineWidth = 4.4;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(120, 200, 220, .95)';
        ctx.lineWidth = 4.6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(aim) * 5, by - Math.sin(aim) * 5);
        ctx.stroke();
        ctx.restore();
    }

    function drawBall(b) {
        const col = COLORS[b.num];
        ctx.save();

        // 落地阴影
        ctx.beginPath();
        ctx.ellipse(b.x + 2, b.y + 3.4, BR * 0.98, BR * 0.82, 0, 0, TAU);
        ctx.fillStyle = 'rgba(0, 12, 8, .38)';
        ctx.fill();

        const g = ctx.createRadialGradient(
            b.x - BR * 0.3, b.y - BR * 0.34, BR * 0.1,
            b.x, b.y, BR * 1.04
        );
        g.addColorStop(0, 'rgba(255, 255, 255, .88)');
        g.addColorStop(0.22, col);
        g.addColorStop(0.84, col);
        g.addColorStop(1, 'rgba(8, 14, 12, .66)');
        ctx.beginPath();
        ctx.arc(b.x, b.y, BR, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();

        // 镜面高光（先画，别盖住号码）
        ctx.beginPath();
        ctx.ellipse(b.x - BR * 0.44, b.y - BR * 0.48, BR * 0.24, BR * 0.15, -0.75, 0, TAU);
        ctx.fillStyle = 'rgba(255, 255, 255, .55)';
        ctx.fill();

        if (b.num > 0) {
            // 九号球加一道白带，跟一号球区分
            if (b.num === 9) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(b.x, b.y, BR - 0.6, 0, TAU);
                ctx.clip();
                ctx.fillStyle = 'rgba(250, 250, 244, .92)';
                ctx.fillRect(b.x - BR, b.y - BR * 0.36, BR * 2, BR * 0.72);
                ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(b.x, b.y, BR * 0.44, 0, TAU);
            ctx.fillStyle = 'rgba(252, 252, 248, .97)';
            ctx.fill();

            ctx.fillStyle = 'rgba(20, 24, 28, .94)';
            ctx.font = '700 7.5px ' + FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(b.num), b.x, b.y + 0.3);
        }
        ctx.restore();
    }

    function drawBalls() {
        for (let i = 0; i < balls.length; i++) {
            if (balls[i].alive) drawBall(balls[i]);
        }
    }

    function drawFx() {
        for (let i = 0; i < fx.length; i++) {
            const e = fx[i];
            const k = clamp(e.t / e.max, 0, 1);
            if (e.type === 'flash') {
                const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, e.r * (0.5 + k));
                g.addColorStop(0, 'rgba(255, 246, 214, ' + (0.6 * (1 - k)) + ')');
                g.addColorStop(1, 'rgba(255, 246, 214, 0)');
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r * (0.5 + k), 0, TAU);
                ctx.fillStyle = g;
                ctx.fill();
            } else if (e.type === 'ring') {
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r + k * 22, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 240, 200, ' + (0.55 * (1 - k)) + ')';
                ctx.lineWidth = 2 * (1 - k) + 0.4;
                ctx.stroke();
            }
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 14px ' + FONT;
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            const k = clamp(t.t / t.max, 0, 1);
            ctx.globalAlpha = 1 - k * k;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y - 26 - k * 24);
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
        ctx.fillText('BILLIARDS', W / 2, 22);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('台球 · 九球挑战', W / 2, 44);

        // 时间条
        const k = clamp(timeLeft / GAME_TIME, 0, 1);
        roundRectPath(ctx, 26, 66, W - 52, 4.4, 2.2);
        ctx.fillStyle = 'rgba(140, 180, 215, .14)';
        ctx.fill();
        if (k > 0.001) {
            const tg = ctx.createLinearGradient(26, 0, W - 26, 0);
            if (k < 0.25) {
                tg.addColorStop(0, 'rgba(255, 120, 110, .95)');
                tg.addColorStop(1, 'rgba(255, 168, 120, .95)');
            } else {
                tg.addColorStop(0, 'rgba(96, 214, 190, .9)');
                tg.addColorStop(1, 'rgba(120, 200, 255, .9)');
            }
            ctx.fillStyle = tg;
            roundRectPath(ctx, 26, 66, (W - 52) * k, 4.4, 2.2);
            ctx.fill();
        }

        ctx.textAlign = 'left';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(170, 200, 232, .55)';
        ctx.fillText('得分', 26, 94);
        ctx.fillStyle = '#ffe0a8';
        ctx.font = '800 14px ' + FONT;
        ctx.fillText(String(score), 56, 94);

        ctx.textAlign = 'right';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(170, 200, 232, .6)';
        const left = aliveCount();
        ctx.fillText('剩余 ' + left + ' 球 · 第 ' + rackNo + ' 组', W - 26, 94);
        ctx.restore();
    }

    function drawPower() {
        const x = FX;
        const y = 564;
        const w = FELT.w;
        const h = 11;
        const p = powerNow();

        roundRectPath(ctx, x, y, w, h, 6);
        ctx.fillStyle = 'rgba(8, 20, 28, .78)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 170, 190, .22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (p > 0.004) {
            ctx.save();
            roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 4.5);
            ctx.clip();
            const g = ctx.createLinearGradient(x, 0, x + w, 0);
            g.addColorStop(0, 'rgba(96, 220, 196, .95)');
            g.addColorStop(0.52, 'rgba(255, 214, 120, .95)');
            g.addColorStop(1, 'rgba(255, 106, 92, .98)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, w * p, h);
            ctx.restore();
        }

        ctx.save();
        ctx.font = '700 11px ' + FONT;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(160, 190, 218, .55)';
        ctx.fillText('力度', x, y - 10);
        ctx.textAlign = 'right';
        ctx.fillStyle = p > 0.02 ? 'rgba(255, 226, 170, .92)' : 'rgba(160, 190, 218, .45)';
        ctx.fillText(Math.round(p * 100) + '%', x + w, y - 10);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        let tip;
        if (state === 'rolling') {
            tip = '球还在滚动，等它停下来';
        } else if (charging) {
            tip = '松开击球 · 力度 ' + Math.round(powerNow() * 100) + '%';
        } else if (!cue || !cue.alive) {
            tip = '白球即将重新落位';
        } else {
            tip = '移动瞄准 · 按住蓄力 · 松开击球';
        }
        ctx.fillStyle = 'rgba(150, 178, 208, .5)';
        ctx.fillText(tip, W / 2, 592);
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const k = clamp(banner.t / banner.max, 0, 1);
        const alpha = k < 0.12 ? k / 0.12 : (k > 0.78 ? (1 - k) / 0.22 : 1);
        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const g = ctx.createLinearGradient(60, 0, W - 60, 0);
        g.addColorStop(0, 'rgba(6, 18, 22, 0)');
        g.addColorStop(0.5, 'rgba(6, 22, 24, .9)');
        g.addColorStop(1, 'rgba(6, 18, 22, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(50, 282, W - 100, 92);

        ctx.fillStyle = '#a8f0d8';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, 314);

        ctx.fillStyle = 'rgba(180, 226, 214, .78)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, 346);
        ctx.restore();
    }

    function draw() {
        drawTable();
        drawAim();
        drawBalls();
        drawFx();
        drawHeader();
        drawPower();
        drawFooter();
        drawBanner();
    }

    /* ---------- 面板 ---------- */
    function updateHud() {
        const key = score + '|' + aliveCount() + '|' + shots + '|' + rackNo + '|' + best + '|' + bestBreak;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = score;
        els.left.textContent = aliveCount();
        els.shots.textContent = shots;
        els.rack.textContent = rackNo;
        els.best.textContent = best;
        els.bestBreak.textContent = bestBreak;
    }

    /* ---------- 输入 ---------- */
    function pointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    function aimAt(p) {
        if (!cue || !cue.alive) return;
        const dx = p.x - cue.x;
        const dy = p.y - cue.y;
        if (Math.hypot(dx, dy) < 22) return;
        aim = Math.atan2(dy, dx);
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'aim' || !cue || !cue.alive) return;
        const p = pointerPos(e);
        aimAt(p);
        charging = true;
        chargeT = 0;
        try {
            if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        } catch (err) { /* 某些环境不支持指针捕获 */ }
    });

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'aim') return;
        aimAt(pointerPos(e));
    });

    canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        if (state !== 'aim' || !charging) return;
        shoot();
    });

    canvas.addEventListener('pointercancel', function () {
        charging = false;
        chargeT = 0;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            aim -= 0.045;
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            aim += 0.045;
        } else if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'aim' && cue && cue.alive && !charging) {
                charging = true;
                chargeT = 0;
            }
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'aim' && charging) shoot();
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

    rackBalls();
    updateHud();
    requestAnimationFrame(loop);
})();
