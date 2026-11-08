/* ==========================================================
   叠塔 Stacker
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const SLAB_H = 32;
    const BASE_Y = 536;
    const START_W = 320;
    const MIN_OVERLAP = 6;
    const BASE_SPEED = 260;
    const SPEED_STEP = 15;
    const TOP_MARGIN = 176;

    const BEST_KEY = 'webgames.stacker.best';
    const RUN_KEY = 'webgames.stacker.runs';

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        height: document.getElementById('height'),
        width: document.getElementById('width'),
        speed: document.getElementById('speed'),
        best: document.getElementById('best'),
        runs: document.getElementById('runs'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let layers = [];
    let mv = null;
    let camera = 0;
    let shards = [];
    let state = 'ready';
    let clock = 0;
    let msg = '';
    let msgTone = 'normal';
    let msgTimer = 0;
    let hudCache = '';

    function hueOf(n) {
        return (198 + n * 11) % 360;
    }

    function height() {
        return Math.max(0, layers.length - 1);
    }

    /* ---------- 流程 ---------- */
    function startGame() {
        layers = [{ cx: W / 2, gw: START_W, hue: hueOf(0) }];
        shards = [];
        mv = null;
        camera = 0;
        msg = '';
        msgTimer = 0;
        state = 'playing';
        hudCache = '';
        spawnMoving();
        els.overlay.classList.remove('show');
        updateHud();
    }

    function spawnMoving() {
        const gw = layers[layers.length - 1].gw;
        const fromLeft = Math.random() < 0.5;
        mv = {
            gw: gw,
            cx: fromLeft ? gw / 2 : W - gw / 2,
            dir: fromLeft ? 1 : -1,
            speed: BASE_SPEED + layers.length * SPEED_STEP
        };
    }

    function updateHud() {
        const key = [height(), layers.length ? layers[layers.length - 1].gw : 0, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        const gw = layers.length ? layers[layers.length - 1].gw : START_W;
        els.height.textContent = String(height());
        els.width.textContent = String(Math.round(gw));
        const spd = state === 'playing' && mv ? mv.speed : BASE_SPEED;
        els.speed.textContent = (spd / BASE_SPEED).toFixed(1) + '×';
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
        els.runs.textContent = String(Number(localStorage.getItem(RUN_KEY) || 0));
    }

    function spawnShard(x0, x1, y, hue) {
        const w = Math.abs(x1 - x0);
        if (w < 8) return;
        const dir = (x0 + x1) / 2 < W / 2 ? -1 : 1;
        shards.push({
            x: (x0 + x1) / 2,
            y: y,
            w: w,
            h: SLAB_H - 1,
            vx: dir * (20 + Math.random() * 40),
            vy: -30 - Math.random() * 30,
            rot: 0,
            vr: dir * (0.8 + Math.random() * 1.6),
            hue: hue,
            life: 1.5,
            max: 1.5
        });
    }

    function drop() {
        if (state !== 'playing' || !mv) return;

        const base = layers[layers.length - 1];
        const mL = mv.cx - mv.gw / 2;
        const mR = mv.cx + mv.gw / 2;
        const bL = base.cx - base.gw / 2;
        const bR = base.cx + base.gw / 2;
        const lo = Math.max(mL, bL);
        const hi = Math.min(mR, bR);
        const ov = hi - lo;

        const y = BASE_Y - layers.length * SLAB_H - camera;

        if (ov < MIN_OVERLAP) {
            spawnShard(mL, mR, y, hueOf(layers.length));
            fail();
            return;
        }

        if (mL < lo - 0.5) spawnShard(mL, lo, y, hueOf(layers.length));
        if (mR > hi + 0.5) spawnShard(hi, mR, y, hueOf(layers.length));

        const perfect = mv.gw - ov < 0.8;
        layers.push({ cx: (lo + hi) / 2, gw: ov, hue: hueOf(layers.length) });

        if (perfect) {
            msg = '完美对齐';
            msgTone = 'good';
            msgTimer = 1;
        } else if (mv.gw - ov < 14) {
            msg = '差一点就齐了';
            msgTone = 'hint';
            msgTimer = 1;
        }

        spawnMoving();
        hudCache = '';
        updateHud();
    }

    function fail() {
        state = 'over';
        mv = null;

        const h = height();
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (h > best) localStorage.setItem(BEST_KEY, String(h));
        const runs = Number(localStorage.getItem(RUN_KEY) || 0) + 1;
        localStorage.setItem(RUN_KEY, String(runs));

        els.ovTitle.textContent = '塔倒了';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '方块彻底错开，这一摞从顶上塌了下来。';
        els.ovScore.innerHTML = '叠到第 <b>' + h + '</b> 层 · 最高 <b>' +
            Math.max(h, best) + '</b> 层';
        els.ovBtn.textContent = '再来一次';
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        if (msgTimer > 0) msgTimer -= dt;

        const n = layers.length;
        const camTarget = Math.max(0, TOP_MARGIN - (BASE_Y - (n - 1) * SLAB_H));
        camera += (camTarget - camera) * Math.min(1, dt * 9);

        if (state === 'playing' && mv) {
            mv.cx += mv.dir * mv.speed * dt;
            const half = mv.gw / 2;
            if (mv.cx - half <= 2) {
                mv.cx = 2 + half;
                mv.dir = 1;
            } else if (mv.cx + half >= W - 2) {
                mv.cx = W - 2 - half;
                mv.dir = -1;
            }
        }

        for (let i = shards.length - 1; i >= 0; i--) {
            const s = shards[i];
            s.life -= dt;
            if (s.life <= 0) {
                shards.splice(i, 1);
                continue;
            }
            s.vy += 900 * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.rot += s.vr * dt;
        }
    }

    /* ---------- 绘制 ---------- */
    function slabY(i) {
        return BASE_Y - i * SLAB_H - camera;
    }

    function drawSlab(cx, y, gw, hue, live) {
        const x = cx - gw / 2;
        const g = ctx.createLinearGradient(0, y, 0, y + SLAB_H);
        g.addColorStop(0, 'hsl(' + hue + ', 62%, 62%)');
        g.addColorStop(0.56, 'hsl(' + hue + ', 56%, 47%)');
        g.addColorStop(1, 'hsl(' + hue + ', 50%, 34%)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y + 0.5, gw, SLAB_H - 1);

        ctx.fillStyle = 'rgba(255, 255, 255, .28)';
        ctx.fillRect(x, y + 0.5, gw, 4.6);

        ctx.fillStyle = 'rgba(3, 8, 16, .3)';
        ctx.fillRect(x, y + SLAB_H - 3.5, gw, 3);

        ctx.fillStyle = 'rgba(255, 255, 255, .13)';
        ctx.fillRect(x, y + 0.5, 1.4, SLAB_H - 1);
        ctx.fillRect(x + gw - 1.4, y + 0.5, 1.4, SLAB_H - 1);

        if (live) {
            ctx.strokeStyle = 'rgba(255, 255, 255, .58)';
            ctx.lineWidth = 1.3;
            ctx.strokeRect(x + 0.7, y + 1.2, gw - 1.4, SLAB_H - 2.4);
        }
    }

    function drawTower() {
        for (let i = 0; i < layers.length; i++) {
            const y = slabY(i);
            if (y > H + 40 || y < -40) continue;
            drawSlab(layers[i].cx, y, layers[i].gw, layers[i].hue, false);
        }

        if (state === 'playing' && mv) {
            const y = slabY(layers.length);
            drawSlab(mv.cx, y, mv.gw, hueOf(layers.length), true);

            // 落点投影
            const base = layers[layers.length - 1];
            const lo = Math.max(mv.cx - mv.gw / 2, base.cx - base.gw / 2);
            const hi = Math.min(mv.cx + mv.gw / 2, base.cx + base.gw / 2);
            if (hi > lo) {
                ctx.fillStyle = 'rgba(255, 255, 255, .2)';
                ctx.fillRect(lo, y + SLAB_H - 2, hi - lo, 2);
            }
        }
    }

    function drawBase() {
        const y = BASE_Y + SLAB_H - camera;
        if (y > H + 20) return;
        const gw = layers.length ? layers[0].gw : START_W;
        const rad = gw / 2 + 42;

        // 椭圆径向光晕，四周自然淡出，不做硬边矩形
        ctx.save();
        ctx.translate(W / 2, y);
        ctx.scale(1, 0.24);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
        g.addColorStop(0, 'rgba(104, 146, 208, .2)');
        g.addColorStop(0.5, 'rgba(104, 146, 208, .08)');
        g.addColorStop(1, 'rgba(104, 146, 208, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawShards() {
        ctx.save();
        for (let i = 0; i < shards.length; i++) {
            const s = shards[i];
            const k = Math.max(0, s.life / s.max);
            ctx.save();
            ctx.globalAlpha = Math.min(1, k * 1.6);
            ctx.translate(s.x, s.y + s.h / 2);
            ctx.rotate(s.rot);
            const g = ctx.createLinearGradient(0, -s.h / 2, 0, s.h / 2);
            g.addColorStop(0, 'hsl(' + s.hue + ', 58%, 56%)');
            g.addColorStop(1, 'hsl(' + s.hue + ', 50%, 36%)');
            ctx.fillStyle = g;
            ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
            ctx.restore();
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
        ctx.fillText('STACKER', W / 2, 26);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('叠塔', W / 2, 52);

        const g = ctx.createLinearGradient(150, 0, W - 150, 0);
        g.addColorStop(0, 'rgba(110, 152, 200, 0)');
        g.addColorStop(0.5, 'rgba(120, 165, 220, .3)');
        g.addColorStop(1, 'rgba(110, 152, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(150, 76, W - 300, 1);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 12px ' + FONT;

        if (msgTimer > 0 && msg) {
            ctx.fillStyle = msgTone === 'good' ? 'rgba(140, 240, 180, .95)'
                : (msgTone === 'hint' ? 'rgba(255, 214, 130, .95)' : 'rgba(190, 212, 240, .85)');
            ctx.fillText(msg, W / 2, 584);
        } else if (state === 'playing') {
            ctx.fillStyle = 'rgba(140, 166, 196, .34)';
            ctx.font = '600 10px ' + FONT;
            ctx.fillText('错开的部分会掉落，只保留重叠的一段', W / 2, 584);
        }
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#080c1a');
        g.addColorStop(0.5, '#0b1024');
        g.addColorStop(1, '#080a16');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 470, 30, W / 2, 470, 340);
        halo.addColorStop(0, 'rgba(80, 120, 200, .14)');
        halo.addColorStop(1, 'rgba(80, 120, 200, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 120, W, H - 120);

        drawBase();
        drawTower();
        drawShards();
        drawHeader();
        drawFooter();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        drop();
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'playing') drop();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
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

    startGame();
    state = 'ready';
    els.overlay.classList.add('show');
    updateHud();
    requestAnimationFrame(loop);
})();
