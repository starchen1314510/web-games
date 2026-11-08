/* ==========================================================
   飞镖 Darts 501
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const CX = W / 2;
    const CY = 296;
    const R = 150;
    const R_DOUBLE_IN = R * 162 / 170;
    const R_TREBLE_OUT = R * 107 / 170;
    const R_TREBLE_IN = R * 99 / 170;
    const R_BULL_OUT = R * 15.9 / 170;
    const R_BULL_IN = R * 6.35 / 170;

    const SWING_X = 176;
    const SWING_Y = 176;

    const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    const BEST_KEY = 'webgames.darts.best';
    const COUNT_KEY = 'webgames.darts.count';
    const START_SCORE = 501;

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        left: document.getElementById('left'),
        roundscore: document.getElementById('roundscore'),
        darts: document.getElementById('darts'),
        best: document.getElementById('best'),
        record: document.getElementById('record'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let score = START_SCORE;
    let roundStart = START_SCORE;
    let roundDarts = [];
    let totalDarts = 0;
    let state = 'ready';
    let phase = 'x';
    let lockX = CX;
    let lockY = CY;
    let aimX = CX;
    let aimY = CY;
    let clock = 0;
    let flight = null;
    let stuck = [];
    let pops = [];
    let particles = [];
    let hudCache = '';
    let msg = '';
    let msgTone = 'normal';
    let msgTimer = 0;

    /* ---------- 计分 ---------- */
    function scoreOf(x, y) {
        const dx = x - CX;
        const dy = y - CY;
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r > R) return { pts: 0, label: '脱靶', ring: 'miss', sector: 0, mult: 0 };
        if (r <= R_BULL_IN) return { pts: 50, label: '红心 50', ring: 'bull', sector: 50, mult: 0 };
        if (r <= R_BULL_OUT) return { pts: 25, label: '外心 25', ring: 'outer', sector: 25, mult: 0 };

        let ang = Math.atan2(dx, -dy);
        if (ang < 0) ang += TAU;
        const span = TAU / 20;
        const idx = Math.floor((ang + span / 2) / span) % 20;
        const num = SECTORS[idx];

        let mult = 1;
        let ring = 'single';
        if (r >= R_DOUBLE_IN) {
            mult = 2;
            ring = 'double';
        } else if (r >= R_TREBLE_IN && r <= R_TREBLE_OUT) {
            mult = 3;
            ring = 'treble';
        }

        const pts = num * mult;
        const prefix = mult === 3 ? '三倍 ' : (mult === 2 ? '双倍 ' : '');
        return {
            pts: pts, label: prefix + num + ' → ' + pts, ring: ring, sector: num, mult: mult
        };
    }

    function isFinishDart(res) {
        return res.ring === 'double' || res.ring === 'bull';
    }

    /* ---------- 流程 ---------- */
    function startGame() {
        score = START_SCORE;
        roundStart = START_SCORE;
        roundDarts = [];
        totalDarts = 0;
        stuck = [];
        pops = [];
        particles = [];
        flight = null;
        phase = 'x';
        lockX = CX;
        lockY = CY;
        aimX = CX;
        aimY = CY;
        msg = '';
        msgTimer = 0;
        state = 'playing';
        hudCache = '';
        hideOverlay();
        updateHud();
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function gameOver(win) {
        state = 'over';
        if (win) {
            const best = Number(localStorage.getItem(BEST_KEY) || 0);
            if (best === 0 || totalDarts < best) {
                localStorage.setItem(BEST_KEY, String(totalDarts));
            }
            const cnt = Number(localStorage.getItem(COUNT_KEY) || 0) + 1;
            localStorage.setItem(COUNT_KEY, String(cnt));
            els.ovTitle.textContent = '收镖完成';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '你用 ' + totalDarts + ' 镖完成了 501。';
            els.ovScore.innerHTML = '最少镖数 <b>' + readBest() + '</b> · 完成 ' + cnt + ' 局';
            els.ovBtn.textContent = '再来一局';
        } else {
            els.ovTitle.textContent = '本局结束';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '剩余 ' + score + ' 分未收完。';
            els.ovScore.innerHTML = '最少镖数 <b>' + readBest() + '</b>';
            els.ovBtn.textContent = '重新开始';
        }
        els.overlay.classList.add('show');
        updateHud();
    }

    function readBest() {
        const b = Number(localStorage.getItem(BEST_KEY) || 0);
        return b > 0 ? b + ' 镖' : '--';
    }

    function updateHud() {
        const key = [score, roundStart, totalDarts, state, roundDarts.length].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.left.textContent = String(score);
        els.roundscore.textContent = String(roundStart - score);
        els.darts.textContent = String(totalDarts);
        els.best.textContent = readBest();
        els.record.textContent = String(Number(localStorage.getItem(COUNT_KEY) || 0));
    }

    /* ---------- 投掷 ---------- */
    function lockAndThrow() {
        if (state !== 'playing') return;
        if (phase === 'x') {
            lockX = aimX;
            phase = 'y';
            msg = '定住了左右，再定上下';
            msgTone = 'hint';
            msgTimer = 1.2;
            return;
        }
        if (phase !== 'y') return;
        lockY = aimY;
        phase = 'fly';
        const jx = (Math.random() - 0.5) * 12;
        const jy = (Math.random() - 0.5) * 12;
        flight = {
            from: { x: CX, y: 566 },
            to: { x: lockX + jx, y: lockY + jy },
            t: 0,
            dur: 0.32
        };
    }

    function land() {
        const lx = flight.to.x;
        const ly = flight.to.y;
        const res = scoreOf(lx, ly);
        stuck.push({ x: lx, y: ly, tilt: (Math.random() - 0.5) * 0.5 });
        flight = null;
        totalDarts += 1;
        roundDarts.push(res);
        phase = 'x';

        for (let i = 0; i < 8; i++) {
            const a = Math.random() * TAU;
            const sp = 30 + Math.random() * 90;
            particles.push({
                x: lx, y: ly,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.3 + Math.random() * 0.35, max: 0.65,
                r: 1.2 + Math.random() * 1.8, color: '#ffe08a'
            });
        }

        if (res.pts === 0) {
            msg = '脱靶，0 分';
            msgTone = 'bad';
            pops.push({ x: lx, y: ly, text: 'MISS', color: '#9fb4c8', life: 1.2 });
        } else {
            pops.push({
                x: lx, y: ly, text: '+' + res.pts,
                color: res.ring === 'treble' ? '#ffd166' : (res.ring === 'bull' ? '#ff8898' : '#9de8b4'),
                life: 1.2
            });
        }

        const remain = score - res.pts;
        if (res.pts > 0 && remain === 0 && isFinishDart(res)) {
            score = 0;
            msg = '收镖成功！';
            msgTone = 'good';
            updateHud();
            gameOver(true);
            return;
        }

        if (res.pts > 0 && remain === 0 && !isFinishDart(res)) {
            score = roundStart;
            roundDarts = roundDarts.slice(0, roundDarts.length - 1);
            msg = '必须双倍收镖，本轮作废';
            msgTone = 'bad';
            finishRound();
            return;
        }

        if (remain < 0 || remain === 1) {
            score = roundStart;
            roundDarts = roundDarts.slice(0, roundDarts.length - 1);
            msg = remain < 0 ? '爆分，本轮作废' : '剩 1 分无法收镖，本轮作废';
            msgTone = 'bad';
            finishRound();
            return;
        }

        score = remain;
        if (res.pts > 0 && remain <= 40 && remain % 2 === 0) {
            msg = '剩 ' + remain + ' 分，可以双倍 ' + (remain / 2) + ' 收镖';
            msgTone = 'hint';
        } else {
            msg = res.label;
            msgTone = 'normal';
        }
        msgTimer = 1.6;

        if (roundDarts.length >= 3) finishRound();
        updateHud();
    }

    function finishRound() {
        roundDarts = [];
        roundStart = score;
        stuck = [];
        phase = 'x';
        msgTimer = 2;
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (msgTimer > 0) msgTimer -= dt;

        aimX = CX + Math.sin(clock * 2.05) * SWING_X;
        aimY = CY + Math.sin(clock * 1.78 + 1.1) * SWING_Y;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 120 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = pops.length - 1; i >= 0; i--) {
            const p = pops[i];
            p.y -= 26 * dt;
            p.life -= dt;
            if (p.life <= 0) pops.splice(i, 1);
        }

        if (flight) {
            flight.t += dt / flight.dur;
            if (flight.t >= 1) {
                flight.t = 1;
                land();
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function sectorPath(r0, r1, a0, a1) {
        ctx.beginPath();
        ctx.arc(CX, CY, r1, a0, a1);
        ctx.arc(CX, CY, r0, a1, a0, true);
        ctx.closePath();
    }

    function drawBoard() {
        const span = TAU / 20;

        // 外圈底座
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, .4)';
        ctx.beginPath();
        ctx.arc(CX + 2, CY + 4, R + 12, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#0c1420';
        ctx.beginPath();
        ctx.arc(CX, CY, R + 11, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 178, 210, .34)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 单倍区
        for (let i = 0; i < 20; i++) {
            const a0 = -Math.PI / 2 + i * span - span / 2;
            const a1 = a0 + span;
            ctx.fillStyle = i % 2 === 0 ? '#1b2536' : '#e2e8ef';
            sectorPath(R_TREBLE_OUT, R_DOUBLE_IN, a0, a1);
            ctx.fill();
        }

        // 三倍环
        for (let i = 0; i < 20; i++) {
            const a0 = -Math.PI / 2 + i * span - span / 2;
            const a1 = a0 + span;
            ctx.fillStyle = i % 2 === 0 ? '#d8474f' : '#2f9e68';
            sectorPath(R_TREBLE_IN, R_TREBLE_OUT, a0, a1);
            ctx.fill();
            ctx.fillStyle = i % 2 === 0 ? '#1b2536' : '#e2e8ef';
            sectorPath(R_BULL_OUT, R_TREBLE_IN, a0, a1);
            ctx.fill();
            ctx.fillStyle = i % 2 === 0 ? '#d8474f' : '#2f9e68';
            sectorPath(R_DOUBLE_IN, R, a0, a1);
            ctx.fill();
        }

        // 分隔线
        ctx.strokeStyle = 'rgba(8, 14, 22, .55)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const a = -Math.PI / 2 + i * span - span / 2;
            ctx.beginPath();
            ctx.moveTo(CX + Math.cos(a) * R_BULL_OUT, CY + Math.sin(a) * R_BULL_OUT);
            ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
            ctx.stroke();
        }

        // 同心圆
        const rings = [R_DOUBLE_IN, R_TREBLE_IN, R_TREBLE_OUT, R_BULL_OUT, R];
        ctx.strokeStyle = 'rgba(10, 16, 24, .5)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(CX, CY, rings[i], 0, TAU);
            ctx.stroke();
        }

        // 靶心
        const bg = ctx.createRadialGradient(CX - 3, CY - 4, 2, CX, CY, R_BULL_OUT);
        bg.addColorStop(0, '#4fbf86');
        bg.addColorStop(1, '#1f7a4f');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(CX, CY, R_BULL_OUT, 0, TAU);
        ctx.fill();

        const rg = ctx.createRadialGradient(CX - 2, CY - 3, 1, CX, CY, R_BULL_IN);
        rg.addColorStop(0, '#ff8a92');
        rg.addColorStop(1, '#c22b3a');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(CX, CY, R_BULL_IN, 0, TAU);
        ctx.fill();

        // 外圈数字
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 12px ' + FONT;
        for (let i = 0; i < 20; i++) {
            const a = -Math.PI / 2 + i * span;
            const x = CX + Math.cos(a) * (R + 22);
            const y = CY + Math.sin(a) * (R + 22);
            ctx.fillStyle = i % 2 === 0 ? 'rgba(210, 228, 250, .78)' : 'rgba(150, 175, 205, .62)';
            ctx.fillText(String(SECTORS[i]), x, y);
        }
        ctx.restore();
    }

    function drawStuckDarts() {
        for (let i = 0; i < stuck.length; i++) {
            drawDart(stuck[i].x, stuck[i].y, stuck[i].tilt, 1.25);
        }
    }

    function drawDart(x, y, tilt, scale) {
        const s = scale || 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt || 0);
        ctx.shadowColor = 'rgba(2, 6, 12, .6)';
        ctx.shadowBlur = 4 * s;

        ctx.fillStyle = 'rgba(0, 0, 0, .34)';
        ctx.beginPath();
        ctx.ellipse(2 * s, 3 * s, 4 * s, 2 * s, 0, 0, TAU);
        ctx.fill();

        // 镖身（先描深色外框，浅色扇区上也能看清）
        ctx.strokeStyle = 'rgba(6, 12, 20, .6)';
        ctx.lineWidth = 3.8 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -20 * s);
        ctx.stroke();

        ctx.strokeStyle = '#cfdcea';
        ctx.lineWidth = 2.2 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -20 * s);
        ctx.stroke();

        // 镖尖
        ctx.fillStyle = '#eef5ff';
        ctx.beginPath();
        ctx.moveTo(0, 2 * s);
        ctx.lineTo(-2.4 * s, -3 * s);
        ctx.lineTo(2.4 * s, -3 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(6, 12, 20, .55)';
        ctx.lineWidth = 0.8 * s;
        ctx.stroke();

        // 镖翼
        ctx.fillStyle = '#ff6b7a';
        ctx.beginPath();
        ctx.moveTo(0, -16 * s);
        ctx.lineTo(-6 * s, -25 * s);
        ctx.lineTo(0, -21 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5fa8ff';
        ctx.beginPath();
        ctx.moveTo(0, -16 * s);
        ctx.lineTo(6 * s, -25 * s);
        ctx.lineTo(0, -21 * s);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawChevron(x, y, dir, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        if (dir === 'down') {
            ctx.moveTo(x, y + 7);
            ctx.lineTo(x - 5, y - 3);
            ctx.lineTo(x + 5, y - 3);
        } else if (dir === 'up') {
            ctx.moveTo(x, y - 7);
            ctx.lineTo(x - 5, y + 3);
            ctx.lineTo(x + 5, y + 3);
        } else if (dir === 'right') {
            ctx.moveTo(x + 7, y);
            ctx.lineTo(x - 3, y - 5);
            ctx.lineTo(x - 3, y + 5);
        } else {
            ctx.moveTo(x - 7, y);
            ctx.lineTo(x + 3, y - 5);
            ctx.lineTo(x + 3, y + 5);
        }
        ctx.closePath();
        ctx.fill();
    }

    function drawAim() {
        if (state !== 'playing') return;
        const top = CY - R + 9;
        const bot = CY + R - 9;
        const lft = CX - R + 9;
        const rgt = CX + R - 9;

        if (phase === 'x') {
            ctx.save();
            ctx.strokeStyle = 'rgba(110, 230, 170, .55)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([7, 6]);
            ctx.beginPath();
            ctx.moveTo(aimX, top);
            ctx.lineTo(aimX, bot);
            ctx.stroke();
            ctx.setLineDash([]);
            drawChevron(aimX, top, 'down', 'rgba(110, 230, 170, .95)');
            drawChevron(aimX, bot, 'up', 'rgba(110, 230, 170, .95)');
            ctx.restore();
        } else if (phase === 'y') {
            ctx.save();
            ctx.strokeStyle = 'rgba(130, 180, 240, .32)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([5, 7]);
            ctx.beginPath();
            ctx.moveTo(lockX, top);
            ctx.lineTo(lockX, bot);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 214, 120, .62)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(lft, aimY);
            ctx.lineTo(rgt, aimY);
            ctx.stroke();
            ctx.setLineDash([]);
            drawChevron(lft, aimY, 'right', 'rgba(255, 214, 120, .95)');
            drawChevron(rgt, aimY, 'left', 'rgba(255, 214, 120, .95)');

            // 十字交点
            const ix = clamp(lockX, CX - R, CX + R);
            const iy = clamp(aimY, CY - R, CY + R);
            ctx.strokeStyle = 'rgba(255, 235, 160, .9)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(ix, iy, 6, 0, TAU);
            ctx.moveTo(ix - 9, iy);
            ctx.lineTo(ix - 4, iy);
            ctx.moveTo(ix + 4, iy);
            ctx.lineTo(ix + 9, iy);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawFlight() {
        if (!flight) return;
        const t = clamp(flight.t, 0, 1);
        const ease = 1 - Math.pow(1 - t, 2);
        const x = flight.from.x + (flight.to.x - flight.from.x) * ease;
        const y = flight.from.y + (flight.to.y - flight.from.y) * ease;
        const arc = Math.sin(t * Math.PI) * 40;
        drawDart(x, y - arc, (flight.to.y - flight.from.y) * 0.0018, 1);
    }

    function drawPops() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < pops.length; i++) {
            const p = pops[i];
            ctx.globalAlpha = clamp(p.life / 1.2, 0, 1);
            ctx.fillStyle = p.color;
            ctx.font = '800 17px ' + FONT;
            ctx.fillText(p.text, p.x, p.y - 40);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawParticles() {
        ctx.save();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 178, 210, .58)';
        ctx.fillText('剩余分数', CX, 28);

        ctx.font = '800 44px ' + FONT;
        const g = ctx.createLinearGradient(0, 42, 0, 86);
        g.addColorStop(0, '#f2f8ff');
        g.addColorStop(1, '#9dbbdd');
        ctx.fillStyle = g;
        ctx.fillText(String(score), CX, 64);

        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(140, 230, 180, .8)';
        ctx.fillText('本轮 ' + (roundStart - score) + ' 分 | 已投 ' + totalDarts + ' 镖', CX, 100);
        ctx.restore();
    }

    function drawRoundDarts() {
        const y = 532;
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const x = 132 + i * 108;
            const d = roundDarts[i];
            ctx.fillStyle = 'rgba(14, 24, 36, .8)';
            ctx.beginPath();
            ctx.arc(x, y, 24, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = d ? 'rgba(120, 180, 245, .5)' : 'rgba(110, 140, 175, .26)';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (d) {
                ctx.fillStyle = d.pts === 0 ? '#8fa4b8'
                    : (d.ring === 'treble' ? '#ffd166' : (d.ring === 'bull' ? '#ff8a98' : '#a9ecd0'));
                ctx.font = '800 16px ' + FONT;
                ctx.fillText(String(d.pts), x, y - 2);
                ctx.font = '600 9px ' + FONT;
                ctx.fillStyle = 'rgba(160, 190, 220, .62)';
                const tag = d.ring === 'double' ? 'D' + d.sector
                    : (d.ring === 'treble' ? 'T' + d.sector
                        : (d.ring === 'bull' ? 'BULL' : (d.ring === 'outer' ? 'OUT' : (d.ring === 'miss' ? 'MISS' : String(d.sector)))));
                ctx.fillText(tag, x, y + 12);
            } else {
                ctx.fillStyle = 'rgba(120, 150, 185, .32)';
                ctx.font = '700 18px ' + FONT;
                ctx.fillText('·', x, y);
            }
        }
        ctx.restore();
    }

    function drawTip() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 12px ' + FONT;

        if (msgTimer > 0 && msg) {
            const c = msgTone === 'bad' ? 'rgba(255, 130, 145, .95)'
                : (msgTone === 'good' ? 'rgba(140, 240, 180, .95)'
                    : (msgTone === 'hint' ? 'rgba(255, 214, 130, .95)' : 'rgba(190, 212, 240, .85)'));
            ctx.fillStyle = c;
            ctx.fillText(msg, CX, 492);
        } else if (state === 'playing') {
            ctx.fillStyle = 'rgba(160, 190, 220, .6)';
            ctx.fillText(phase === 'x' ? '点击定左右' : (phase === 'y' ? '再次点击定上下' : '飞镖出手…'), CX, 492);
        }

        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 175, 205, .44)';
        ctx.fillText('501 递减赛 · 收镖必须落在双倍环或红心', CX, 578);
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070c15');
        g.addColorStop(0.55, '#0a1220');
        g.addColorStop(1, '#0b1826');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        drawHeader();
        drawBoard();
        drawStuckDarts();
        drawAim();
        drawFlight();
        drawParticles();
        drawPops();
        drawRoundDarts();
        drawTip();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        lockAndThrow();
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            e.preventDefault();
            lockAndThrow();
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
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    updateHud();
    requestAnimationFrame(loop);
})();
