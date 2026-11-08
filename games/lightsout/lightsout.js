/* ==========================================================
   点灯 Lights Out
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const N = 6;
    const TOTAL = N * N;
    const PITCH = 60;
    const CELL = 52;
    const GRID_W = N * PITCH;
    const GRID_X = (W - GRID_W) / 2;
    const GRID_Y = 116;
    const SPRITE_PAD = 14;
    const SPRITE = CELL + SPRITE_PAD * 2;

    const CLEAR_KEY = 'webgames.lightsout.clear';
    const TOTAL_KEY = 'webgames.lightsout.total';

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

    function randInt(n) {
        return Math.floor(Math.random() * n);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        lit: document.getElementById('lit'),
        moves: document.getElementById('moves'),
        level: document.getElementById('level'),
        cleared: document.getElementById('cleared'),
        totalmoves: document.getElementById('totalmoves'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let cells = new Array(TOTAL).fill(false);
    let level = 1;
    let moves = 0;
    let cleared = 0;
    let totalMoves = 0;
    let state = 'ready';
    let clock = 0;
    let ripples = [];
    let sparks = [];
    let banner = null;
    let hudCache = '';

    /* ---------- 格子精灵（预渲染，避免每帧建渐变） ---------- */
    const spriteLit = makeSprite(true);
    const spriteOff = makeSprite(false);

    function makeSprite(lit) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cv = document.createElement('canvas');
        cv.width = SPRITE * dpr;
        cv.height = SPRITE * dpr;
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const m = SPRITE / 2;
        const h = CELL / 2;

        if (lit) {
            const halo = c.createRadialGradient(m, m, h * 0.3, m, m, m);
            halo.addColorStop(0, 'rgba(255, 178, 52, .58)');
            halo.addColorStop(0.42, 'rgba(255, 146, 28, .22)');
            halo.addColorStop(1, 'rgba(255, 118, 8, 0)');
            c.fillStyle = halo;
            c.beginPath();
            c.arc(m, m, m, 0, TAU);
            c.fill();

            const bg = c.createLinearGradient(m, m - h, m, m + h);
            bg.addColorStop(0, '#ffe7a4');
            bg.addColorStop(0.4, '#ffbe3e');
            bg.addColorStop(1, '#e07a12');
            c.fillStyle = bg;
            roundRectPath(c, m - h, m - h, CELL, CELL, 11);
            c.fill();

            c.strokeStyle = 'rgba(255, 240, 198, .8)';
            c.lineWidth = 1.6;
            c.stroke();

            const core = c.createRadialGradient(m, m - h * 0.16, 1, m, m - h * 0.1, h * 0.92);
            core.addColorStop(0, 'rgba(255, 253, 234, .8)');
            core.addColorStop(0.45, 'rgba(255, 230, 160, .2)');
            core.addColorStop(1, 'rgba(255, 214, 120, 0)');
            c.fillStyle = core;
            roundRectPath(c, m - h, m - h, CELL, CELL, 11);
            c.fill();
        } else {
            const bg = c.createLinearGradient(m, m - h, m, m + h);
            bg.addColorStop(0, 'rgba(23, 37, 57, .96)');
            bg.addColorStop(1, 'rgba(9, 17, 29, .96)');
            c.fillStyle = bg;
            roundRectPath(c, m - h, m - h, CELL, CELL, 11);
            c.fill();

            c.strokeStyle = 'rgba(84, 120, 166, .24)';
            c.lineWidth = 1.3;
            c.stroke();

            c.fillStyle = 'rgba(120, 158, 205, .08)';
            roundRectPath(c, m - h + 7, m - h + 4.5, CELL - 14, 4, 2);
            c.fill();
        }
        return cv;
    }

    /* ---------- 逻辑 ---------- */
    function litCount() {
        let n = 0;
        for (let i = 0; i < TOTAL; i++) if (cells[i]) n++;
        return n;
    }

    function toggleAt(c, r) {
        const pts = [[c, r], [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];
        for (let i = 0; i < pts.length; i++) {
            const cc = pts[i][0];
            const rr = pts[i][1];
            if (cc < 0 || cc >= N || rr < 0 || rr >= N) continue;
            const k = rr * N + cc;
            cells[k] = !cells[k];
        }
    }

    function build(newLevel) {
        const taps = Math.min(22, 5 + newLevel * 2);
        let guard = 0;
        do {
            cells = new Array(TOTAL).fill(false);
            for (let i = 0; i < taps; i++) toggleAt(randInt(N), randInt(N));
            guard++;
        } while ((litCount() < 4 || litCount() > 15) && guard < 60);
    }

    function startGame() {
        level = 1;
        moves = 0;
        cleared = 0;
        totalMoves = 0;
        ripples = [];
        sparks = [];
        banner = null;
        state = 'playing';
        hudCache = '';
        build(level);
        els.overlay.classList.remove('show');
        updateHud();
    }

    function nextLevel() {
        level++;
        moves = 0;
        build(level);
        state = 'playing';
        hudCache = '';
        updateHud();
    }

    function clearLevel() {
        state = 'advance';
        cleared++;
        totalMoves += moves;
        localStorage.setItem(CLEAR_KEY, String(cleared));
        localStorage.setItem(TOTAL_KEY, String(totalMoves));
        banner = { t: 1.5, max: 1.5, title: '第 ' + level + ' 关 · 全灭', sub: '用了 ' + moves + ' 步' };
        bubbles(GRID_X + 30, GRID_Y + 30);
        hudCache = '';
        updateHud();
    }

    function bubbles(x, y) {
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 120;
            sparks.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 30,
                life: 0.6 + Math.random() * 0.5,
                max: 1.1,
                r: 1.4 + Math.random() * 2.2,
                hue: Math.random() < 0.5 ? '255, 206, 120' : '255, 168, 70'
            });
        }
    }

    function updateHud() {
        const key = [litCount(), moves, level, state, cleared, totalMoves].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.lit.textContent = String(litCount());
        els.moves.textContent = String(moves);
        els.level.textContent = String(level);
        els.cleared.textContent = String(Number(localStorage.getItem(CLEAR_KEY) || 0));
        els.totalmoves.textContent = String(Number(localStorage.getItem(TOTAL_KEY) || 0));
    }

    /* ---------- 命中 ---------- */
    function hitTest(x, y) {
        const c = Math.floor((x - GRID_X) / PITCH);
        const r = Math.floor((y - GRID_Y) / PITCH);
        if (c < 0 || c >= N || r < 0 || r >= N) return null;
        const cx = GRID_X + c * PITCH + PITCH / 2;
        const cy = GRID_Y + r * PITCH + PITCH / 2;
        if (Math.abs(x - cx) > CELL / 2 || Math.abs(y - cy) > CELL / 2) return null;
        return { c: c, r: r, x: cx, y: cy };
    }

    function onTap(x, y) {
        if (state !== 'playing') return;
        const hit = hitTest(x, y);
        if (!hit) return;

        toggleAt(hit.c, hit.r);
        moves++;

        ripples.push({ x: hit.x, y: hit.y, t: 0, max: 0.52 });
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * TAU;
            const sp = 30 + Math.random() * 90;
            sparks.push({
                x: hit.x,
                y: hit.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 20,
                life: 0.34 + Math.random() * 0.34,
                max: 0.68,
                r: 1.2 + Math.random() * 1.8,
                hue: '255, 210, 140'
            });
        }

        updateHud();
        if (litCount() === 0) clearLevel();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = ripples.length - 1; i >= 0; i--) {
            ripples[i].t += dt;
            if (ripples[i].t >= ripples[i].max) ripples.splice(i, 1);
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.life -= dt;
            if (s.life <= 0) {
                sparks.splice(i, 1);
                continue;
            }
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vy += 150 * dt;
            s.vx *= 0.97;
        }

        if (banner) {
            banner.t -= dt;
            if (banner.t <= 0) {
                banner = null;
                nextLevel();
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .48)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('LIGHTS OUT', W / 2, 26);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText('熄灭所有灯光', W / 2, 54);

        ctx.fillStyle = 'rgba(160, 190, 222, .56)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('第 ' + level + ' 关 · ' + N + ' × ' + N + ' 格', W / 2, 80);

        const g = ctx.createLinearGradient(140, 0, W - 140, 0);
        g.addColorStop(0, 'rgba(110, 152, 200, 0)');
        g.addColorStop(0.5, 'rgba(120, 165, 220, .34)');
        g.addColorStop(1, 'rgba(110, 152, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(140, 98, W - 280, 1);
        ctx.restore();
    }

    function drawGrid() {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cx = GRID_X + c * PITCH + PITCH / 2;
                const cy = GRID_Y + r * PITCH + PITCH / 2;
                const on = cells[r * N + c];

                if (on) {
                    ctx.save();
                    ctx.globalAlpha = 0.86 + Math.sin(clock * 2.4 + c * 0.5 + r * 0.4) * 0.14;
                    ctx.drawImage(spriteLit, cx - SPRITE / 2, cy - SPRITE / 2, SPRITE, SPRITE);
                    ctx.restore();
                } else {
                    ctx.drawImage(spriteOff, cx - SPRITE / 2, cy - SPRITE / 2, SPRITE, SPRITE);
                }
            }
        }
    }

    function drawRipples() {
        ctx.save();
        for (let i = 0; i < ripples.length; i++) {
            const p = ripples[i];
            const k = p.t / p.max;
            const rad = CELL * 0.3 + k * CELL * 0.78;
            ctx.strokeStyle = 'rgba(255, 214, 140, ' + ((1 - k) * 0.6).toFixed(3) + ')';
            ctx.lineWidth = 2.6 * (1 - k) + 0.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawSparks() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < sparks.length; i++) {
            const s = sparks[i];
            const a = Math.max(0, s.life / s.max);
            ctx.fillStyle = 'rgba(' + s.hue + ', ' + (a * 0.85).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * a + 0.4, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const k = banner.t / banner.max;
        const a = k > 0.72 ? (1 - k) / 0.28 : Math.min(1, k / 0.26);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, a));

        const bw = 246;
        const bh = 84;
        const bx = (W - bw) / 2;
        const by = GRID_Y + GRID_W / 2 - bh / 2;

        ctx.fillStyle = 'rgba(8, 16, 28, .82)';
        roundRectPath(ctx, bx, by, bw, bh, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 200, 120, .5)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd98e';
        ctx.font = '800 19px ' + FONT;
        ctx.fillText(banner.title, W / 2, by + 32);
        ctx.fillStyle = 'rgba(190, 214, 240, .78)';
        ctx.font = '600 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, by + 57);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px ' + FONT;

        if (state === 'playing' && litCount() <= 3) {
            ctx.fillStyle = 'rgba(255, 208, 120, .9)';
            ctx.fillText('只剩 ' + litCount() + ' 盏，别把别的灯点着了', W / 2, 508);
        } else if (state === 'playing') {
            ctx.fillStyle = 'rgba(160, 190, 220, .6)';
            ctx.fillText('点一格会连带翻转上下左右四格', W / 2, 508);
        }

        ctx.fillStyle = 'rgba(140, 166, 196, .38)';
        ctx.font = '600 10px ' + FONT;
        ctx.fillText('每关的初始灯阵都由倒序点击生成，必定有解', W / 2, 578);
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070d16');
        g.addColorStop(0.5, '#0a1523');
        g.addColorStop(1, '#08111c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        drawHeader();
        drawGrid();
        drawRipples();
        drawSparks();
        drawBanner();
        drawFooter();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        onTap(x, y);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
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

    build(1);
    updateHud();
    requestAnimationFrame(loop);
})();
