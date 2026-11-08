/* ==========================================================
   钓鱼 Fishing
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const SURFACE = 200;
    const SAND_Y = 552;
    const ROD_TIP = { x: 326, y: 104 };

    const HOOK_X0 = 200;
    const HOOK_X1 = 452;
    const HOOK_Y0 = 214;
    const HOOK_Y1 = 542;
    const HOOK_R = 11;

    const GAME_TIME = 60;

    const BEST_KEY = 'webgames.fishing.best';
    const RUN_KEY = 'webgames.fishing.runs';

    const KINDS = [
        { id: 'sardine', name: '沙丁鱼', score: 10, r: 16, spd: 52, y0: 244, y1: 322, color: '#8fd3e8', need: 3, w: 30 },
        { id: 'bass', name: '鲈鱼', score: 25, r: 20, spd: 76, y0: 292, y1: 392, color: '#78c9a2', need: 5, w: 24 },
        { id: 'tuna', name: '金枪鱼', score: 50, r: 23, spd: 110, y0: 350, y1: 440, color: '#6fa8e8', need: 7, w: 16 },
        { id: 'lantern', name: '灯笼鱼', score: 80, r: 21, spd: 90, y0: 428, y1: 516, color: '#f0c464', need: 7, w: 10 },
        { id: 'puffer', name: '河豚', score: 120, r: 25, spd: 62, y0: 340, y1: 516, color: '#e892c8', need: 10, w: 6 },
        { id: 'can', name: '铁罐', score: 0, r: 16, spd: 44, y0: 272, y1: 520, color: '#8a8f98', need: 5, w: 12 },
        { id: 'eel', name: '电鳗', score: 0, r: 18, spd: 126, y0: 400, y1: 528, color: '#b48cf0', need: 6, w: 8 }
    ];

    const TOTAL_W = KINDS.reduce(function (a, k) { return a + k.w; }, 0);

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

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        time: document.getElementById('time'),
        combo: document.getElementById('combo'),
        caught: document.getElementById('caught'),
        best: document.getElementById('best'),
        runs: document.getElementById('runs'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';
    let clock = 0;
    let score = 0;
    let timeLeft = GAME_TIME;
    let combo = 0;
    let caught = 0;
    let fish = [];
    let bubbles = [];
    let spawnTimer = 0;
    let msg = '';
    let msgTimer = 0;
    let msgTone = 'normal';
    let hookPulse = 0;

    const hook = { x: 300, y: 300 };
    const target = { x: 300, y: 300 };
    const keys = { l: false, r: false, u: false, d: false };

    let hooked = null;
    let reel = { prog: 0, need: 0, timer: 0, max: 3.2 };
    let hudCache = '';

    /* ---------- 流程 ---------- */
    function reset() {
        score = 0;
        timeLeft = GAME_TIME;
        combo = 0;
        caught = 0;
        fish = [];
        bubbles = [];
        hooked = null;
        spawnTimer = 0.3;
        msg = '';
        msgTimer = 0;
        hook.x = target.x = 300;
        hook.y = target.y = 300;
        for (let i = 0; i < 16; i++) {
            bubbles.push({
                x: Math.random() * W,
                y: SURFACE + Math.random() * (SAND_Y - SURFACE),
                r: 1 + Math.random() * 3,
                spd: 12 + Math.random() * 26
            });
        }
        // 开局先撒一批鱼，从浅到深铺满水层
        for (let i = 0; i < 7; i++) {
            spawnFish(true, 244 + i * 42 + Math.random() * 16);
        }
        // 别让开局就贴到鱼钩上
        for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            if (Math.abs(f.x - 300) < 78 && Math.abs(f.y - 300) < 66) {
                f.x = f.x < W / 2 ? 56 + Math.random() * 128 : 320 + Math.random() * 104;
            }
        }
        hudCache = '';
    }

    function startGame() {
        reset();
        state = 'play';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function gameOver() {
        state = 'over';
        hooked = null;
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        const runs = Number(localStorage.getItem(RUN_KEY) || 0) + 1;
        localStorage.setItem(RUN_KEY, String(runs));

        els.ovTitle.textContent = '收竿了';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '时间到，船家把渔网收了回去。下次试试往深处找值钱的鱼。';
        els.ovScore.innerHTML = '本局得分 <b>' + score + '</b> · 上鱼 <b>' + caught +
            '</b> 条 · 最高 <b>' + Math.max(score, best) + '</b>';
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    function updateHud() {
        const key = [score, Math.ceil(timeLeft), combo, caught, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.time.textContent = Math.ceil(Math.max(0, timeLeft)) + 's';
        els.combo.textContent = String(combo);
        els.caught.textContent = String(caught);
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
        els.runs.textContent = String(Number(localStorage.getItem(RUN_KEY) || 0));
    }

    function toast(text, tone) {
        msg = text;
        msgTone = tone || 'normal';
        msgTimer = 1.6;
    }

    /* ---------- 鱼 ---------- */
    function pickKind() {
        let v = Math.random() * TOTAL_W;
        for (let i = 0; i < KINDS.length; i++) {
            v -= KINDS[i].w;
            if (v <= 0) return KINDS[i];
        }
        return KINDS[0];
    }

    function spawnFish(atRandomX, yOverride) {
        if (fish.length >= 12) return;
        const k = pickKind();
        const dir = Math.random() < 0.5 ? 1 : -1;
        fish.push({
            kind: k,
            x: atRandomX ? 46 + Math.random() * (W - 92) : (dir > 0 ? -56 : W + 56),
            y: yOverride !== undefined
                ? yOverride
                : clamp(k.y0 + Math.random() * (k.y1 - k.y0), HOOK_Y0 - 6, HOOK_Y1 - 8),
            dir: dir,
            spd: k.spd * (0.85 + Math.random() * 0.4),
            phase: Math.random() * 6,
            alive: true
        });
    }

    function hookFish(f) {
        hooked = f;
        state = 'reel';
        reel.prog = 0;
        reel.need = f.kind.need;
        reel.timer = reel.max;
        hookPulse = 1;
    }

    function press() {
        if (state !== 'reel' || !hooked) return;
        reel.prog++;
        hookPulse = 1;
        if (reel.prog >= reel.need) catchFish();
    }

    function catchFish() {
        const k = hooked.kind;
        fish.splice(fish.indexOf(hooked), 1);
        hooked = null;
        state = 'play';

        if (k.id === 'eel') {
            timeLeft = Math.max(0, timeLeft - 6);
            combo = 0;
            toast('被电鳗电到，时间 -6 秒', 'bad');
        } else if (k.score <= 0) {
            combo = 0;
            toast('捞上来一只' + k.name + '，白忙一场', 'bad');
        } else {
            caught++;
            combo++;
            const mult = Math.min(3, 1 + (combo - 1) * 0.15);
            const gain = Math.round(k.score * mult);
            score += gain;
            toast('钓到 ' + k.name + ' +' + gain + (combo > 1 ? ' · 连击 x' + combo : ''), 'good');
        }
        hudCache = '';
        updateHud();
    }

    function escapeFish() {
        if (!hooked) return;
        const f = hooked;
        f.spd *= 1.5;
        hooked = null;
        state = 'play';
        combo = 0;
        toast('鱼挣脱了', 'bad');
        hudCache = '';
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (msgTimer > 0) msgTimer -= dt;
        if (hookPulse > 0) hookPulse = Math.max(0, hookPulse - dt * 4);

        if (state === 'play' || state === 'reel') {
            timeLeft -= dt;
            if (timeLeft <= 0) {
                timeLeft = 0;
                gameOver();
                return;
            }
        }

        // 鱼群
        for (let i = fish.length - 1; i >= 0; i--) {
            const f = fish[i];
            f.phase += dt * (2.4 + f.spd / 34);
            if (f !== hooked) {
                f.x += f.dir * f.spd * dt;
                if (f.x < -80 || f.x > W + 80) fish.splice(i, 1);
            }
        }

        // 气泡
        for (let i = 0; i < bubbles.length; i++) {
            const b = bubbles[i];
            b.y -= b.spd * dt;
            b.x += Math.sin((clock + b.y) * 1.6) * 6 * dt;
            if (b.y < SURFACE + 4) {
                b.y = SAND_Y - 4;
                b.x = Math.random() * W;
            }
        }

        if (state !== 'play' && state !== 'reel') return;

        // 鱼钩目标
        if (state === 'play') {
            const sp = 330 * dt;
            if (keys.l) target.x -= sp;
            if (keys.r) target.x += sp;
            if (keys.u) target.y -= sp;
            if (keys.d) target.y += sp;
            target.x = clamp(target.x, HOOK_X0, HOOK_X1);
            target.y = clamp(target.y, HOOK_Y0, HOOK_Y1);

            hook.x += (target.x - hook.x) * Math.min(1, dt * 15);
            hook.y += (target.y - hook.y) * Math.min(1, dt * 15);

            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnFish();
                spawnTimer = 0.34 + Math.random() * 0.6;
            }

            for (let i = 0; i < fish.length; i++) {
                const f = fish[i];
                const dx = f.x - hook.x;
                const dy = f.y - hook.y;
                if (dx * dx + dy * dy < (f.kind.r + HOOK_R) * (f.kind.r + HOOK_R)) {
                    hookFish(f);
                    break;
                }
            }
        } else {
            // 收线：鱼被拖着，钩子缓慢下沉
            hook.y = Math.min(HOOK_Y1, hook.y + 24 * dt);
            reel.timer -= dt;
            if (hooked) {
                hooked.x = hook.x - hooked.dir * 12;
                hooked.y = hook.y + 4;
                hooked.phase += dt * 7;
            }
            if (reel.timer <= 0) escapeFish();
        }

        updateHud();
    }

    /* ---------- 绘制 ---------- */
    function drawSky() {
        const g = ctx.createLinearGradient(0, 60, 0, SURFACE);
        g.addColorStop(0, '#101c30');
        g.addColorStop(0.6, '#22344c');
        g.addColorStop(1, '#3d4f63');
        ctx.fillStyle = g;
        ctx.fillRect(0, 60, W, SURFACE - 60);

        const sun = ctx.createRadialGradient(372, 198, 4, 372, 198, 108);
        sun.addColorStop(0, 'rgba(255, 168, 96, .34)');
        sun.addColorStop(0.5, 'rgba(255, 140, 80, .12)');
        sun.addColorStop(1, 'rgba(255, 140, 80, 0)');
        ctx.fillStyle = sun;
        ctx.fillRect(240, 110, 240, 92);

        ctx.fillStyle = 'rgba(140, 168, 202, .1)';
        ctx.beginPath();
        ctx.ellipse(120, 118, 54, 12, 0, 0, TAU);
        ctx.ellipse(168, 112, 38, 10, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(390, 148, 42, 9, 0, 0, TAU);
        ctx.ellipse(354, 144, 28, 7, 0, 0, TAU);
        ctx.fill();
    }

    function drawWater() {
        const g = ctx.createLinearGradient(0, SURFACE, 0, H);
        g.addColorStop(0, '#164a68');
        g.addColorStop(0.45, '#0d3049');
        g.addColorStop(1, '#05121d');
        ctx.fillStyle = g;
        ctx.fillRect(0, SURFACE, W, H - SURFACE);

        // 光柱
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
            const x = 210 + i * 62 + Math.sin(clock * 0.6 + i) * 8;
            const lg = ctx.createLinearGradient(x, SURFACE, x - 26, 470);
            lg.addColorStop(0, 'rgba(150, 226, 255, .07)');
            lg.addColorStop(1, 'rgba(150, 226, 255, 0)');
            ctx.fillStyle = lg;
            ctx.beginPath();
            ctx.moveTo(x - 34, SURFACE);
            ctx.lineTo(x + 34, SURFACE);
            ctx.lineTo(x - 30, 480);
            ctx.lineTo(x - 96, 480);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // 水面波纹
        ctx.beginPath();
        ctx.moveTo(0, SURFACE);
        for (let x = 0; x <= W; x += 8) {
            ctx.lineTo(x, SURFACE + Math.sin(x * 0.055 + clock * 1.5) * 2.6);
        }
        ctx.strokeStyle = 'rgba(168, 228, 250, .5)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // 气泡
        for (let i = 0; i < bubbles.length; i++) {
            const b = bubbles[i];
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.strokeStyle = 'rgba(176, 226, 250, .18)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    function drawSand() {
        const g = ctx.createLinearGradient(0, SAND_Y, 0, H);
        g.addColorStop(0, '#1d3128');
        g.addColorStop(1, '#0a1410');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, SAND_Y + 6);
        for (let x = 0; x <= W; x += 24) {
            ctx.lineTo(x, SAND_Y + Math.sin(x * 0.03) * 7);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(120, 150, 120, .16)';
        const stones = [[52, 572, 7], [110, 584, 5], [188, 566, 6], [268, 580, 8], [352, 570, 5], [418, 586, 7]];
        for (let i = 0; i < stones.length; i++) {
            ctx.beginPath();
            ctx.ellipse(stones[i][0], stones[i][1], stones[i][2], stones[i][2] * 0.6, 0, 0, TAU);
            ctx.fill();
        }
    }

    function drawBoat() {
        ctx.save();

        // 船舱
        roundRectPath(ctx, 54, 126, 58, 30, 5);
        const cg = ctx.createLinearGradient(0, 126, 0, 156);
        cg.addColorStop(0, '#4d6d86');
        cg.addColorStop(1, '#2b4256');
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.fillStyle = 'rgba(150, 200, 232, .3)';
        roundRectPath(ctx, 61, 132, 20, 15, 2);
        ctx.fill();

        // 船身
        ctx.beginPath();
        ctx.moveTo(20, 156);
        ctx.lineTo(168, 156);
        ctx.quadraticCurveTo(152, 198, 96, 198);
        ctx.quadraticCurveTo(38, 198, 20, 156);
        const hg = ctx.createLinearGradient(0, 156, 0, 198);
        hg.addColorStop(0, '#7a4f34');
        hg.addColorStop(1, '#2e1c14');
        ctx.fillStyle = hg;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 210, 160, .2)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // 甲板
        ctx.fillStyle = '#8d6041';
        ctx.fillRect(22, 152, 146, 6);
        ctx.fillStyle = 'rgba(255, 226, 190, .24)';
        ctx.fillRect(22, 152, 146, 1.6);

        // 鱼竿
        ctx.beginPath();
        ctx.moveTo(152, 150);
        ctx.quadraticCurveTo(252, 88, ROD_TIP.x, ROD_TIP.y);
        ctx.strokeStyle = '#d7b47c';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();
    }

    function drawLine() {
        const mx = (ROD_TIP.x + hook.x) / 2;
        const my = (ROD_TIP.y + hook.y) / 2 + 6;

        ctx.beginPath();
        ctx.moveTo(ROD_TIP.x, ROD_TIP.y);
        ctx.quadraticCurveTo(mx, my, hook.x, hook.y);
        ctx.strokeStyle = 'rgba(206, 232, 250, .6)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // 浮标
        ctx.beginPath();
        ctx.arc(ROD_TIP.x, ROD_TIP.y + 2, 2.6, 0, TAU);
        ctx.fillStyle = 'rgba(255, 120, 96, .9)';
        ctx.fill();
    }

    function drawHook() {
        const pulse = hookPulse;
        ctx.save();
        ctx.translate(hook.x, hook.y);

        if (pulse > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, HOOK_R + 4 + (1 - pulse) * 12, 0, TAU);
            ctx.strokeStyle = 'rgba(160, 240, 255, ' + (pulse * 0.6) + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(0, 0, HOOK_R, 0, TAU);
        ctx.fillStyle = 'rgba(180, 235, 255, .14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 236, 255, .55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 4.4, -0.5, Math.PI * 1.15);
        ctx.strokeStyle = '#e6f6ff';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -2.2, 2, 0, TAU);
        ctx.fillStyle = 'rgba(255, 128, 96, .95)';
        ctx.fill();
        ctx.restore();
    }

    function drawFishBody(f) {
        const k = f.kind;
        const r = k.r;
        const wag = Math.sin(f.phase * 3.2) * 0.42;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.dir, 1);

        if (k.id === 'can') {
            const bw = r * 0.82;
            const g = ctx.createLinearGradient(-bw, 0, bw, 0);
            g.addColorStop(0, '#5b636e');
            g.addColorStop(0.32, '#c3cbd5');
            g.addColorStop(0.64, '#8b939e');
            g.addColorStop(1, '#454c56');
            roundRectPath(ctx, -bw, -r * 0.94, bw * 2, r * 1.88, 4);
            ctx.fillStyle = g;
            ctx.fill();

            // 红色标签带
            ctx.fillStyle = 'rgba(198, 82, 66, .88)';
            ctx.fillRect(-bw, -r * 0.2, bw * 2, r * 0.42);

            // 顶盖与底缘
            ctx.beginPath();
            ctx.ellipse(0, -r * 0.94, bw, r * 0.2, 0, 0, TAU);
            ctx.fillStyle = '#d7dee6';
            ctx.fill();
            ctx.strokeStyle = 'rgba(40, 48, 58, .5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.ellipse(0, r * 0.94, bw, r * 0.16, 0, 0, TAU);
            ctx.fillStyle = 'rgba(66, 74, 84, .85)';
            ctx.fill();

            ctx.strokeStyle = 'rgba(26, 32, 40, .55)';
            ctx.lineWidth = 1;
            roundRectPath(ctx, -bw, -r * 0.94, bw * 2, r * 1.88, 4);
            ctx.stroke();
        } else if (k.id === 'eel') {
            ctx.beginPath();
            ctx.moveTo(r * 1.3, 0);
            for (let i = 1; i <= 8; i++) {
                const t = i / 8;
                const x = r * 1.3 - t * r * 3;
                const y = Math.sin(t * 4 + f.phase * 2.4) * r * 0.5 * t;
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = k.color;
            ctx.lineWidth = r * 0.72;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.strokeStyle = 'rgba(226, 216, 255, .5)';
            ctx.lineWidth = r * 0.2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(r * 1.35, 0, r * 0.62, 0, TAU);
            ctx.fillStyle = k.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(r * 1.5, -r * 0.16, r * 0.14, 0, TAU);
            ctx.fillStyle = '#1b1430';
            ctx.fill();
        } else {
            // 尾鳍
            ctx.beginPath();
            ctx.moveTo(-r * 1.05, 0);
            ctx.lineTo(-r * 1.95, -r * 0.72 + wag * r * 0.5);
            ctx.lineTo(-r * 1.75, 0);
            ctx.lineTo(-r * 1.95, r * 0.72 + wag * r * 0.5);
            ctx.closePath();
            ctx.fillStyle = k.color;
            ctx.globalAlpha = 0.82;
            ctx.fill();
            ctx.globalAlpha = 1;

            // 背鳍
            ctx.beginPath();
            ctx.moveTo(-r * 0.3, -r * 0.78);
            ctx.quadraticCurveTo(r * 0.1, -r * 1.5, r * 0.62, -r * 0.62);
            ctx.closePath();
            ctx.fillStyle = k.color;
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;

            // 身体
            const g = ctx.createLinearGradient(0, -r, 0, r);
            g.addColorStop(0, 'rgba(255, 255, 255, .5)');
            g.addColorStop(0.35, k.color);
            g.addColorStop(1, 'rgba(0, 0, 0, .34)');
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 1.35, r * 0.86, 0, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();

            if (k.id === 'puffer') {
                ctx.strokeStyle = 'rgba(255, 240, 250, .55)';
                ctx.lineWidth = 1.4;
                for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * TAU;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.84);
                    ctx.lineTo(Math.cos(a) * r * 1.56, Math.sin(a) * r * 1.0);
                    ctx.stroke();
                }
            }

            // 眼
            ctx.beginPath();
            ctx.arc(r * 0.66, -r * 0.16, r * 0.24, 0, TAU);
            ctx.fillStyle = 'rgba(250, 254, 255, .95)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(r * 0.72, -r * 0.16, r * 0.12, 0, TAU);
            ctx.fillStyle = '#101a24';
            ctx.fill();

            if (k.id === 'lantern') {
                ctx.beginPath();
                ctx.arc(r * 1.1, -r * 1.0, r * 0.26, 0, TAU);
                ctx.fillStyle = 'rgba(255, 226, 140, .9)';
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(r * 0.8, -r * 0.72);
                ctx.lineTo(r * 1.0, -r * 0.94);
                ctx.strokeStyle = 'rgba(255, 226, 140, .5)';
                ctx.lineWidth = 1.6;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    function drawFish() {
        for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            if (f === hooked) continue;
            drawFishBody(f);
        }
        if (hooked) drawFishBody(hooked);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .46)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('FISHING', W / 2, 22);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('钓鱼', W / 2, 44);

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
                tg.addColorStop(0, 'rgba(96, 214, 230, .9)');
                tg.addColorStop(1, 'rgba(120, 200, 255, .9)');
            }
            ctx.fillStyle = tg;
            roundRectPath(ctx, 26, 66, (W - 52) * k, 4.4, 2.2);
            ctx.fill();
        }

        ctx.textAlign = 'left';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(170, 200, 232, .55)';
        ctx.fillText('得分', 26, 90);
        ctx.fillStyle = '#ffe0a8';
        ctx.font = '800 14px ' + FONT;
        ctx.fillText(String(score), 56, 90);

        ctx.textAlign = 'right';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = k < 0.25 ? 'rgba(255, 140, 130, .95)' : 'rgba(170, 200, 232, .6)';
        ctx.fillText(Math.ceil(Math.max(0, timeLeft)) + ' 秒', W - 26, 90);

        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (state === 'reel' && hooked) {
            const k = clamp(reel.prog / reel.need, 0, 1);
            const tk = clamp(reel.timer / reel.max, 0, 1);

            roundRectPath(ctx, 110, 512, 260, 13, 6.5);
            ctx.fillStyle = 'rgba(6, 20, 30, .72)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(126, 206, 226, .28)';
            ctx.lineWidth = 1;
            ctx.stroke();

            roundRectPath(ctx, 112, 514, 256 * k, 9, 4.5);
            const g = ctx.createLinearGradient(112, 0, 368, 0);
            g.addColorStop(0, 'rgba(120, 232, 200, .95)');
            g.addColorStop(1, 'rgba(96, 200, 255, .95)');
            ctx.fillStyle = g;
            ctx.fill();

            ctx.font = '700 11px ' + FONT;
            ctx.fillStyle = 'rgba(190, 226, 244, .82)';
            ctx.fillText('连续点击收线 · ' + Math.round(tk * 100) + '%', W / 2, 542);
            return;
        }

        if (msgTimer > 0 && msg) {
            ctx.font = '800 13px ' + FONT;
            ctx.fillStyle = msgTone === 'good' ? 'rgba(146, 240, 190, .96)'
                : (msgTone === 'bad' ? 'rgba(255, 168, 160, .96)' : 'rgba(214, 232, 248, .9)');
            ctx.fillText(msg, W / 2, 572);
        } else {
            ctx.font = '600 10px ' + FONT;
            ctx.fillStyle = 'rgba(140, 200, 200, .42)';
            ctx.fillText(state === 'play' ? '移动鱼钩去碰鱼，上钩后快速点击收线' : '', W / 2, 572);
        }
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1524');
        g.addColorStop(1, '#060c14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        drawSky();
        drawWater();
        drawSand();
        drawFish();
        drawLine();
        drawHook();
        drawBoat();

        drawHeader();
        drawFooter();
    }

    /* ---------- 输入 ---------- */
    function movePointer(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        target.x = clamp(x, HOOK_X0, HOOK_X1);
        target.y = clamp(y, HOOK_Y0, HOOK_Y1);
    }

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'play') return;
        e.preventDefault();
        movePointer(e);
    });

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state === 'reel') {
            press();
            return;
        }
        if (state !== 'play') return;
        movePointer(e);
        hook.x = target.x;
        hook.y = target.y;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.l = true; }
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.r = true; }
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); keys.u = true; }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); keys.d = true; }
        else if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'reel') press();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false;
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.u = false;
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.d = false;
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

    reset();
    updateHud();
    requestAnimationFrame(loop);
})();
