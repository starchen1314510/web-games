/* ==========================================================
   登月舱 Lunar Lander
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const HUD_TOP = 78;
    const BTN_Y = 544;
    const BTN_R = 26;

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
        level: document.getElementById('level'),
        left: document.getElementById('left'),
        lives: document.getElementById('lives'),
        alt: document.getElementById('alt'),
        vy: document.getElementById('vy'),
        vx: document.getElementById('vx'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';       // ready | play | landed | crash | over
    let level = 1;
    let score = 0;
    let lives = 3;
    let fuel = 100;
    let terrain = [];
    let pads = [];
    let stars = [];
    let lander = { x: W / 2, y: 96, vx: 0, vy: 0, ang: 0 };
    let parts = [];
    let flyers = [];
    let shakeT = 0;
    let pauseT = 0;
    let thrusting = false;
    let keys = { left: false, right: false, up: false };
    let touchBtn = -1;
    let t = 0;
    let hudT = 0;
    let hudCache = '';
    let banner = '';
    let bannerT = 0;
    let best = 0;

    function gravity() {
        return 44 + (level - 1) * 5.5;
    }

    function thrustPower() {
        return 116 + level * 4;
    }

    /* ---------- 地形 ---------- */

    /* ---TERRAIN-START--- */
    function buildTerrain() {
        const cols = 20;
        const arr = [];
        let prev = 372;
        for (let i = 0; i < cols; i++) {
            prev = clamp(prev + (Math.random() - 0.5) * 150, 288 - level * 4, 466 + level * 3);
            arr.push({ x: i * (W / (cols - 1)), y: prev });
        }
        for (let pass = 0; pass < 1; pass++) {
            for (let i = 1; i < arr.length - 1; i++) {
                arr[i].y = (arr[i - 1].y + arr[i].y * 2 + arr[i + 1].y) / 4;
            }
        }

        pads = [];
        const count = level >= 3 ? 3 : 2;
        const w = level >= 4 ? 2 : 3;
        const used = [];
        for (let p = 0; p < count; p++) {
            let idx = 0;
            let tries = 0;
            do {
                idx = 2 + Math.floor(Math.random() * (arr.length - w - 4));
                tries++;
            } while (tries < 40 && used.some(function (u) {
                return Math.abs(u - idx) < w + 3;
            }));
            used.push(idx);
            const y = arr[idx].y;
            for (let k = 0; k <= w; k++) arr[idx + k].y = y;
            pads.push({
                x0: arr[idx].x,
                x1: arr[idx + w].x,
                y: y,
                mult: 1 + p
            });
        }
        terrain = arr;
    }
    /* ---TERRAIN-END--- */

    function terrainY(x) {
        for (let i = 1; i < terrain.length; i++) {
            if (x <= terrain[i].x) {
                const a = terrain[i - 1];
                const b = terrain[i];
                const k = (x - a.x) / (b.x - a.x || 1);
                return a.y + (b.y - a.y) * clamp(k, 0, 1);
            }
        }
        return terrain[terrain.length - 1].y;
    }

    function padAt(x) {
        for (let i = 0; i < pads.length; i++) {
            if (x >= pads[i].x0 + 2 && x <= pads[i].x1 - 2) return pads[i];
        }
        return null;
    }

    /* ---RESET-START--- */
    function resetLander() {
        lander.x = 90 + Math.random() * (W - 180);
        lander.y = 96;
        lander.vx = (Math.random() - 0.5) * 34;
        lander.vy = 4;
        lander.ang = (Math.random() - 0.5) * 0.5;
        fuel = 100;
        parts = [];
        flyers = [];
        thrusting = false;
        keys.left = false;
        keys.right = false;
        keys.up = false;
        touchBtn = -1;
        hudCache = '';
        updateHud();
    }
    /* ---RESET-END--- */

    function startLevel() {
        buildTerrain();
        resetLander();
        state = 'play';
        banner = '第 ' + level + ' 关 · 寻找发光平台';
        bannerT = 2.2;
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
    }

    function startGame() {
        level = 1;
        score = 0;
        lives = 3;
        shakeT = 0;
        pauseT = 0;
        startLevel();
    }

    /* ---------- 判定 ---------- */

    function angleNorm(a) {
        let x = a % TAU;
        if (x > Math.PI) x -= TAU;
        if (x < -Math.PI) x += TAU;
        return x;
    }

    function landSuccess(pad) {
        const spd = Math.hypot(lander.vx, lander.vy);
        const gain = 180 * pad.mult + Math.round(fuel) * 3 +
            Math.max(0, Math.round((52 - spd) * 5));
        score += gain;
        if (score > best) {
            best = score;
            localStorage.setItem('webgames.lunar.best', String(best));
        }
        state = 'landed';
        pauseT = 1.5;
        banner = '稳稳着陆 +' + gain;
        bannerT = 1.6;
        flyers.push({
            x: lander.x, y: lander.y - 26, txt: '+' + gain,
            life: 1.3, max: 1.3, col: '#7dffc8'
        });
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 30 + Math.random() * 90;
            parts.push({
                x: lander.x, y: lander.y + 12,
                vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp * 0.7,
                life: 0.5 + Math.random() * 0.4, max: 0.9, col: '#7dffc8'
            });
        }
        hudCache = '';
        updateHud();
    }

    function crash(why) {
        state = 'crash';
        pauseT = 1.6;
        lives--;
        shakeT = 0.5;
        banner = why;
        bannerT = 1.5;
        for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 50 + Math.random() * 210;
            parts.push({
                x: lander.x, y: lander.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
                life: 0.5 + Math.random() * 0.7, max: 1.2,
                col: i % 3 === 0 ? '#ffd166' : (i % 3 === 1 ? '#ff7b39' : '#ff5c6c')
            });
        }
        hudCache = '';
        updateHud();
    }

    function gameOver() {
        state = 'over';
        els.ovTitle.textContent = '任务结束';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '三段燃料全部耗尽，止步第 ' + level + ' 关，总分 ' + score +
            '。最佳成绩 ' + best + ' 分。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 物理 ---------- */

    function stepLander(dt) {
        if (keys.left) lander.ang -= 2.7 * dt;
        if (keys.right) lander.ang += 2.7 * dt;

        thrusting = keys.up && fuel > 0;
        if (thrusting) {
            const a = thrustPower();
            lander.vx += Math.sin(lander.ang) * a * dt;
            lander.vy -= Math.cos(lander.ang) * a * dt;
            fuel = Math.max(0, fuel - 15 * dt);
            if (Math.random() < 0.7) {
                const bx = lander.x - Math.sin(lander.ang) * 16;
                const by = lander.y + Math.cos(lander.ang) * 16;
                parts.push({
                    x: bx + (Math.random() - 0.5) * 5,
                    y: by + (Math.random() - 0.5) * 5,
                    vx: -Math.sin(lander.ang) * 90 + (Math.random() - 0.5) * 40,
                    vy: Math.cos(lander.ang) * 90 + (Math.random() - 0.5) * 40,
                    life: 0.22 + Math.random() * 0.18, max: 0.4,
                    col: Math.random() < 0.5 ? '#ffd166' : '#7fd8ff'
                });
            }
        }

        lander.vy += gravity() * dt;
        lander.vx *= 1 - 0.16 * dt;
        lander.x += lander.vx * dt;
        lander.y += lander.vy * dt;

        if (lander.x < 14) {
            lander.x = 14;
            lander.vx = Math.abs(lander.vx) * 0.4;
        } else if (lander.x > W - 14) {
            lander.x = W - 14;
            lander.vx = -Math.abs(lander.vx) * 0.4;
        }
        if (lander.y < HUD_TOP + 12) {
            lander.y = HUD_TOP + 12;
            lander.vy = Math.max(0, lander.vy);
        }

        const gy = terrainY(lander.x);
        if (lander.y + 15 >= gy) {
            lander.y = gy - 15;
            const pad = padAt(lander.x);
            const ang = Math.abs(angleNorm(lander.ang));
            if (!pad) {
                crash('撞上岩石了');
            } else if (lander.vy > 52) {
                crash('落地速度太快');
            } else if (Math.abs(lander.vx) > 34) {
                crash('下落时还在横移');
            } else if (ang > 0.32) {
                crash('机身没摆正');
            } else {
                lander.vx = 0;
                lander.vy = 0;
                landSuccess(pad);
            }
        }
    }

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '任务结束';
        if (state === 'landed') return '着陆成功';
        if (state === 'crash') return '坠毁';
        return thrusting ? '推进中' : '降落中';
    }

    function updateHud() {
        const alt = Math.max(0, Math.round(terrainY(lander.x) - lander.y - 15));
        const key = state + '|' + score + '|' + level + '|' + lives + '|' + Math.round(fuel) +
            '|' + alt + '|' + Math.round(lander.vy) + '|' + Math.round(lander.vx);
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.score.textContent = String(score);
        els.level.textContent = String(level);
        els.left.textContent = Math.round(fuel) + '%';
        els.lives.textContent = String(lives);
        els.alt.textContent = alt + ' m';
        els.vy.textContent = String(Math.round(lander.vy));
        els.vx.textContent = String(Math.round(lander.vx));
        els.restartBtn.textContent = state === 'ready' ? '开始降落' : '重新开始';
    }

    /* ---------- 绘制 ---------- */

    function initStars() {
        stars = [];
        for (let i = 0; i < 90; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * 420,
                r: 0.5 + Math.random() * 1.3,
                p: Math.random() * TAU,
                sp: 0.6 + Math.random() * 1.6
            });
        }
    }

    function drawSpace() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05070f');
        g.addColorStop(0.55, '#080d1a');
        g.addColorStop(1, '#0b1420');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const a = 0.35 + Math.sin(t * s.sp + s.p) * 0.3;
            ctx.globalAlpha = clamp(a, 0.08, 0.9);
            ctx.fillStyle = '#dff2ff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        /* 远处行星 */
        const px = 392;
        const py = 132;
        const pg = ctx.createRadialGradient(px - 16, py - 18, 4, px, py, 62);
        pg.addColorStop(0, 'rgba(140, 210, 255, .55)');
        pg.addColorStop(0.55, 'rgba(60, 120, 190, .28)');
        pg.addColorStop(1, 'rgba(20, 40, 70, .05)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, 62, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = 'rgba(160, 210, 255, .22)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(px, py, 86, 20, -0.34, 0, TAU);
        ctx.stroke();
    }

    function drawTerrain() {
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(terrain[0].x, terrain[0].y);
        for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i].x, terrain[i].y);
        ctx.lineTo(W, H);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, 280, 0, H);
        g.addColorStop(0, '#1b2b3c');
        g.addColorStop(0.5, '#121d29');
        g.addColorStop(1, '#0a121b');
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(terrain[0].x, terrain[0].y);
        for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i].x, terrain[i].y);
        ctx.strokeStyle = 'rgba(140, 200, 235, .55)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        /* 岩层 */
        for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            for (let i = 0; i < terrain.length; i++) {
                const x = terrain[i].x;
                const y = terrain[i].y + 16 + k * 22;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(110, 160, 195, ' + (0.10 - k * 0.014).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        /* 平台 */
        for (let i = 0; i < pads.length; i++) {
            const p = pads[i];
            const pulse = 0.55 + Math.sin(t * 3 + i) * 0.2;
            ctx.save();
            ctx.shadowColor = 'rgba(122, 255, 200, .75)';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = 'rgba(122, 255, 200, ' + pulse.toFixed(2) + ')';
            ctx.lineWidth = 3.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x0 + 2, p.y - 1);
            ctx.lineTo(p.x1 - 2, p.y - 1);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = 'rgba(122, 255, 200, .85)';
            ctx.font = '700 10px ' + MONO;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('×' + p.mult, (p.x0 + p.x1) / 2, p.y - 7);
        }
    }

    function drawLander() {
        if (state === 'crash') return;
        ctx.save();
        ctx.translate(lander.x, lander.y);
        ctx.rotate(lander.ang);

        /* 火焰 */
        if (thrusting) {
            const fl = 14 + Math.random() * 12;
            const g = ctx.createLinearGradient(0, 14, 0, 14 + fl);
            g.addColorStop(0, 'rgba(255, 240, 180, .95)');
            g.addColorStop(0.45, 'rgba(255, 170, 70, .8)');
            g.addColorStop(1, 'rgba(255, 90, 40, 0)');
            ctx.beginPath();
            ctx.moveTo(-6, 14);
            ctx.quadraticCurveTo(0, 16 + fl, 6, 14);
            ctx.closePath();
            ctx.fillStyle = g;
            ctx.fill();
        }

        /* 支架 */
        ctx.strokeStyle = 'rgba(190, 215, 235, .9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 4);
        ctx.lineTo(-13, 15);
        ctx.moveTo(8, 4);
        ctx.lineTo(13, 15);
        ctx.moveTo(-13, 15);
        ctx.lineTo(-17, 15);
        ctx.moveTo(13, 15);
        ctx.lineTo(17, 15);
        ctx.stroke();

        /* 机身 */
        const body = ctx.createLinearGradient(-12, -12, 12, 14);
        body.addColorStop(0, '#dfeaf4');
        body.addColorStop(0.5, '#9fb4c8');
        body.addColorStop(1, '#5c7290');
        roundRectPath(ctx, -11, -12, 22, 26, 7);
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = 'rgba(230, 244, 255, .85)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        /* 舷窗 */
        ctx.beginPath();
        ctx.arc(0, -3, 4.6, 0, TAU);
        ctx.fillStyle = 'rgba(90, 210, 255, .95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(240, 252, 255, .8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        /* 天线 */
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(0, -18);
        ctx.strokeStyle = 'rgba(200, 225, 245, .85)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -19, 1.8, 0, TAU);
        ctx.fillStyle = '#ff7b6b';
        ctx.fill();

        ctx.restore();

        /* 高度线 */
        const gy = terrainY(lander.x);
        if (state === 'play') {
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = 'rgba(140, 220, 255, .22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lander.x, lander.y + 16);
            ctx.lineTo(lander.x, gy);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function drawParts(dt) {
        for (let i = 0; i < parts.length; i++) {
            const q = parts[i];
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = q.col;
            ctx.beginPath();
            ctx.arc(q.x, q.y, 1.6 * a + 0.7, 0, TAU);
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
            ctx.font = '800 18px ' + FONT;
            ctx.fillText(f.txt, f.x, f.y - (1 - a) * 34);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function drawHud() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('登月舱', 24, 32);

        ctx.fillStyle = 'rgba(150, 195, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('垂直速度 < 52 · 横移 < 34 · 机身摆正', 24, 54);

        /* 燃料条 */
        const fw = 150;
        const fx = W - 24 - fw;
        roundRectPath(ctx, fx, 22, fw, 10, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, .1)';
        ctx.fill();
        if (fuel > 0) {
            roundRectPath(ctx, fx, 22, fw * (fuel / 100), 10, 5);
            const fg = ctx.createLinearGradient(fx, 0, fx + fw, 0);
            fg.addColorStop(0, fuel < 25 ? '#ff7b6b' : '#7dffc8');
            fg.addColorStop(1, fuel < 25 ? '#ffd166' : '#5fd8ff');
            ctx.fillStyle = fg;
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(160, 200, 225, .8)';
        ctx.font = '700 10px ' + MONO;
        ctx.textAlign = 'right';
        ctx.fillText('FUEL ' + Math.round(fuel) + '%', fx + fw, 44);

        /* 生命 */
        ctx.textAlign = 'left';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(fx + i * 14, 50, 4.2, 0, TAU);
            ctx.fillStyle = i < lives ? 'rgba(255, 130, 150, .95)' : 'rgba(255, 255, 255, .16)';
            ctx.fill();
        }
    }

    function drawButtons() {
        const btns = [
            { x: 76, label: '◀', on: keys.left || touchBtn === 0, key: 0 },
            { x: 240, label: '▲', on: keys.up || touchBtn === 1, key: 1 },
            { x: 404, label: '▶', on: keys.right || touchBtn === 2, key: 2 }
        ];
        for (let i = 0; i < btns.length; i++) {
            const b = btns[i];
            ctx.beginPath();
            ctx.arc(b.x, BTN_Y, BTN_R, 0, TAU);
            ctx.fillStyle = b.on ? 'rgba(95, 216, 255, .26)' : 'rgba(255, 255, 255, .06)';
            ctx.fill();
            ctx.strokeStyle = b.on ? 'rgba(95, 216, 255, .8)' : 'rgba(160, 200, 225, .28)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.fillStyle = b.on ? '#cdf4ff' : 'rgba(200, 225, 240, .7)';
            ctx.font = '700 16px ' + FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.label, b.x, BTN_Y + 0.5);
        }

        ctx.fillStyle = 'rgba(140, 180, 205, .6)';
        ctx.font = '600 11px ' + FONT;
        ctx.textAlign = 'left';
        ctx.fillText('← → 转向 · ↑ 推进', 24, 584);
        ctx.textAlign = 'right';
        ctx.fillText('得分 ' + score + ' · 第 ' + level + ' 关', W - 24, 584);
    }

    function drawBanner() {
        if (bannerT <= 0) return;
        const a = clamp(bannerT, 0, 1);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 18px ' + FONT;
        ctx.fillStyle = state === 'crash' ? '#ff9aa5' : '#c8fff0';
        ctx.fillText(banner, W / 2, 118);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    function render() {
        ctx.save();
        if (shakeT > 0) {
            const k = shakeT / 0.5;
            ctx.translate((Math.random() - 0.5) * 10 * k, (Math.random() - 0.5) * 10 * k);
        }
        drawSpace();
        drawTerrain();
        drawLander();
        drawParts();
        ctx.restore();

        drawHud();
        drawBanner();
        drawButtons();
    }

    /* ---------- 交互 ---------- */

    function hitButton(p) {
        const list = [76, 240, 404];
        for (let i = 0; i < list.length; i++) {
            if (Math.hypot(p.x - list[i], p.y - BTN_Y) <= BTN_R + 6) return i;
        }
        return -1;
    }

    function toCanvas(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'play') return;
        const i = hitButton(toCanvas(e));
        if (i < 0) return;
        touchBtn = i;
        keys.left = i === 0;
        keys.right = i === 2;
        keys.up = i === 1;
    });

    canvas.addEventListener('pointerup', function (e) {
        if (touchBtn < 0) return;
        e.preventDefault();
        touchBtn = -1;
        keys.left = false;
        keys.right = false;
        keys.up = false;
    });

    canvas.addEventListener('pointercancel', function () {
        touchBtn = -1;
        keys.left = false;
        keys.right = false;
        keys.up = false;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            keys.left = true;
            e.preventDefault();
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            keys.right = true;
            e.preventDefault();
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
            keys.up = true;
            e.preventDefault();
        } else if (e.code === 'KeyR') {
            startGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
        else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = false;
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
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
        if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);

        if (state !== 'play') thrusting = false;

        if (state === 'play') {
            stepLander(dt);
        } else if (state === 'landed') {
            pauseT -= dt;
            if (pauseT <= 0) {
                level++;
                startLevel();
            }
        } else if (state === 'crash') {
            pauseT -= dt;
            if (pauseT <= 0) {
                if (lives <= 0) {
                    gameOver();
                } else {
                    resetLander();
                    state = 'play';
                }
            }
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
            q.vy += 120 * dt;
            q.vx *= 0.98;
            q.vy *= 0.98;
        }
        for (let i = flyers.length - 1; i >= 0; i--) {
            flyers[i].life -= dt;
            if (flyers[i].life <= 0) flyers.splice(i, 1);
        }

        hudT += dt;
        if (hudT > 0.1) {
            hudT = 0;
            updateHud();
        }

        render();
        requestAnimationFrame(frame);
    }

    best = Number(localStorage.getItem('webgames.lunar.best') || 0);
    initStars();
    buildTerrain();
    resetLander();
    updateHud();
    requestAnimationFrame(frame);
})();
