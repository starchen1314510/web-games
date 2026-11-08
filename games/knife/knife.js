/* ==========================================================
   飞刀 Knife Hit
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const CX = 240;
    const CY = 330;
    const R = 112;
    const TIP_R = 100;
    const DROP_Y = CY + TIP_R;
    const TH_SLOT = Math.PI / 2;
    const HIT_GAP = 0.27;
    const FLY_SPEED = 880;
    const FLY_START = 618;

    const BEST_KEY = 'webgames.knife.best';
    const BEST_LEVEL_KEY = 'webgames.knife.best-level';

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function norm(a) {
        while (a > Math.PI) a -= TAU;
        while (a < -Math.PI) a += TAU;
        return a;
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
        level: document.getElementById('level'),
        hit: document.getElementById('hit'),
        best: document.getElementById('best'),
        bestLevel: document.getElementById('best-level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 木纹（开局固定，避免每帧抖动） ---------- */
    const GRAIN = [];
    for (let i = 0; i < 40; i++) {
        GRAIN.push({
            a: Math.random() * TAU,
            r: 24 + Math.random() * 82,
            len: 0.08 + Math.random() * 0.22,
            w: 0.8 + Math.random() * 1.4,
            dark: Math.random() < 0.6
        });
    }

    /* ---------- 状态 ---------- */
    let state = 'ready';          // ready | playing | dying | over
    let level = 1;
    let score = 0;
    let best = loadNum(BEST_KEY);
    let bestLevel = loadNum(BEST_LEVEL_KEY);
    let diskAngle = 0;
    let diskSpeed = 0.55;
    let dir = 1;
    let placed = [];
    let hit = 0;
    let need = 5;
    let flying = null;
    let combo = 0;
    let shards = [];
    let sparks = [];
    let dyingT = 0;
    let pendingNext = 0;
    let banner = null;
    let shake = 0;
    let clock = 0;
    let hudCache = '';
    let passCount = 0;

    /* ---------- 关卡 ---------- */
    function levelNeed(lv) {
        return Math.min(10, 4 + lv);
    }

    function levelSpeed(lv) {
        return Math.min(1.15, 0.5 + lv * 0.09);
    }

    function setupLevel() {
        need = levelNeed(level);
        diskSpeed = levelSpeed(level);
        dir = level <= 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
        diskAngle = Math.random() * TAU;
        placed = [];
        hit = 0;
        flying = null;
        pendingNext = 0;
        sparks.length = 0;
        banner = null;
        hudCache = '';
        updateHud();
    }

    function startGame() {
        state = 'playing';
        level = 1;
        score = 0;
        combo = 0;
        passCount = 0;
        shards.length = 0;
        sparks.length = 0;
        banner = null;
        shake = 0;
        dyingT = 0;
        clock = 0;
        setupLevel();
        els.overlay.classList.remove('show');
    }

    function gameOver() {
        state = 'over';
        if (score > best) {
            best = score;
            saveNum(BEST_KEY, best);
        }
        if (passCount > bestLevel) {
            bestLevel = passCount;
            saveNum(BEST_LEVEL_KEY, bestLevel);
        }
        els.ovTitle.textContent = '刀撞刀了';
        els.ovDesc.textContent = '盘面只容得下那么多刀。等盘转到空隙再出手，或者早一点、晚一点都行。';
        els.ovScore.innerHTML = '得分 <b>' + score + '</b><br>最高分 ' + best +
            ' · 最高关 ' + bestLevel;
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    /* ---------- 投掷 ---------- */
    function throwKnife() {
        if (state !== 'playing' || flying || pendingNext > 0) return;
        flying = { y: FLY_START };
    }

    function land() {
        const rel = norm(TH_SLOT - diskAngle);
        for (let i = 0; i < placed.length; i++) {
            if (Math.abs(norm(rel - placed[i].rel)) < HIT_GAP) {
                die();
                return;
            }
        }

        placed.push({ rel: rel, born: clock });
        hit++;
        combo++;
        const gain = 10 + Math.min(combo - 1, 9) * 2;
        score += gain;

        const tipX = CX + Math.cos(TH_SLOT) * TIP_R;
        const tipY = CY + Math.sin(TH_SLOT) * TIP_R;
        for (let i = 0; i < 7; i++) {
            const a = TH_SLOT + Math.PI + (Math.random() - 0.5) * 1.7;
            sparks.push({
                x: tipX + (Math.random() - 0.5) * 6,
                y: tipY + (Math.random() - 0.5) * 6,
                vx: Math.cos(a) * (60 + Math.random() * 110),
                vy: Math.sin(a) * (60 + Math.random() * 110),
                t: 0,
                max: 0.3 + Math.random() * 0.25,
                r: 1 + Math.random() * 1.6
            });
        }

        if (hit >= need) {
            const bonus = 20 + level * 5;
            score += bonus;
            passCount++;
            combo = 0;
            banner = {
                title: '第 ' + level + ' 关清空',
                sub: '过关 +' + bonus + ' 分 · 换新靶盘',
                t: 0,
                max: 1.3
            };
            pendingNext = 1.05;
            flying = null;
        }
        updateHud();
    }

    function die() {
        state = 'dying';
        dyingT = 0.9;
        shake = 1;
        flying = null;
        combo = 0;
        shards.length = 0;
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + Math.random() * 0.1;
            const sp = 130 + Math.random() * 190;
            shards.push({
                a: a,
                w: TAU / 12 + 0.06,
                r0: 40 + Math.random() * 36,
                r1: R - Math.random() * 4,
                x: 0,
                y: 0,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                spin: (Math.random() - 0.5) * 5,
                rot: 0,
                tint: Math.random()
            });
        }
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 1.8);

        for (let i = sparks.length - 1; i >= 0; i--) {
            const p = sparks[i];
            p.t += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            if (p.t > p.max) sparks.splice(i, 1);
        }

        if (state === 'dying') {
            for (let i = 0; i < shards.length; i++) {
                const s = shards[i];
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.vx *= 0.985;
                s.vy *= 0.985;
                s.rot += s.spin * dt;
            }
            dyingT -= dt;
            if (dyingT <= 0) gameOver();
            return;
        }

        if (state !== 'playing') return;

        if (banner) {
            banner.t += dt;
            if (banner.t > banner.max) banner = null;
        }

        diskAngle += diskSpeed * dir * dt;
        if (diskAngle > TAU) diskAngle -= TAU;
        if (diskAngle < 0) diskAngle += TAU;

        if (pendingNext > 0) {
            pendingNext -= dt;
            if (pendingNext <= 0) {
                level++;
                setupLevel();
            }
            return;
        }

        if (flying) {
            flying.y -= FLY_SPEED * dt;
            if (flying.y <= DROP_Y) {
                flying = null;
                land();
            }
        }
    }

    function updateHud() {
        const key = [score, level, hit, need, best, bestLevel, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.level.textContent = String(level);
        els.hit.textContent = hit + ' / ' + need;
        els.best.textContent = String(best);
        els.bestLevel.textContent = String(bestLevel);
    }

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#120d0b');
        g.addColorStop(0.52, '#1c1410');
        g.addColorStop(1, '#0a0706');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(CX, 300, 60, CX, 300, 300);
        halo.addColorStop(0, 'rgba(255, 160, 90, .13)');
        halo.addColorStop(1, 'rgba(120, 60, 20, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 80, W, 420);

        // 底部投掷线
        ctx.fillStyle = 'rgba(255, 190, 130, .05)';
        ctx.fillRect(150, 566, 180, 2);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(198, 166, 138, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('KNIFE HIT', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#f2e6d8';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('飞刀', W / 2, 49);

        const bx = 118;
        const bw = W - 236;
        const by = 66;
        const bh = 4;
        const k = need ? hit / need : 0;
        roundRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.fillStyle = 'rgba(170, 130, 96, .24)';
        ctx.fill();
        if (k > 0) {
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            g.addColorStop(0, 'rgba(255, 176, 96, .9)');
            g.addColorStop(1, 'rgba(255, 226, 150, .95)');
            roundRectPath(ctx, bx, by, Math.max(bh, bw * Math.min(1, k)), bh, bh / 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(202, 172, 146, .66)';
        ctx.fillText('第 ' + level + ' 关 · 插满 ' + need + ' 把 · 已插 ' + hit, W / 2, 88);
        ctx.restore();
    }

    function knifeBody(tip) {
        // 沿 +x 方向绘制一把刀，刀尖位于 tip
        const blade = ctx.createLinearGradient(0, -5, 0, 5);
        blade.addColorStop(0, '#f4f9ff');
        blade.addColorStop(0.5, '#c3d1e0');
        blade.addColorStop(1, '#8f9dad');

        ctx.beginPath();
        ctx.moveTo(tip, 0);
        ctx.lineTo(tip + 13, -4.6);
        ctx.lineTo(tip + 13, 4.6);
        ctx.closePath();
        ctx.fillStyle = '#e6eef8';
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 78, 96, .65)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tip + 12, -4.4);
        ctx.lineTo(tip + 33, -4.4);
        ctx.lineTo(tip + 33, 4.4);
        ctx.lineTo(tip + 12, 4.4);
        ctx.closePath();
        ctx.fillStyle = blade;
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 68, 86, .55)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 护手
        roundRectPath(ctx, tip + 33, -9, 3.6, 18, 1.4);
        ctx.fillStyle = '#7d8794';
        ctx.fill();

        // 刀柄
        roundRectPath(ctx, tip + 36.6, -6.4, 22, 12.8, 5);
        const hg = ctx.createLinearGradient(0, -6.4, 0, 6.4);
        hg.addColorStop(0, '#4a3626');
        hg.addColorStop(0.45, '#2d2018');
        hg.addColorStop(1, '#1a1310');
        ctx.fillStyle = hg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 112, 78, .55)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 柄尾金属
        roundRectPath(ctx, tip + 54, -5.4, 5, 10.8, 2.4);
        ctx.fillStyle = '#8d949e';
        ctx.fill();
    }

    function drawPlacedKnife(k) {
        const age = clock - k.born;
        let push = 0;
        if (age < 0.12) push = 8 * (1 - age / 0.12);
        ctx.save();
        ctx.rotate(k.rel);
        knifeBody(TIP_R + push);
        ctx.restore();
    }

    function drawBoard() {
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(diskAngle);

        // 外阴影
        ctx.beginPath();
        ctx.arc(0, 0, R + 6, 0, TAU);
        ctx.fillStyle = 'rgba(0, 0, 0, .55)';
        ctx.fill();

        // 木盘
        const g = ctx.createRadialGradient(-34, -42, 16, 0, 0, R * 1.06);
        g.addColorStop(0, '#d9a771');
        g.addColorStop(0.48, '#b47f4e');
        g.addColorStop(1, '#66401f');
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();

        // 扇区明暗，让旋转看得出来
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, i * TAU / 8, (i + 1) * TAU / 8);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? 'rgba(255, 232, 196, .05)' : 'rgba(48, 24, 8, .06)';
            ctx.fill();
        }

        // 木纹
        for (let i = 0; i < GRAIN.length; i++) {
            const w = GRAIN[i];
            ctx.beginPath();
            ctx.arc(0, 0, w.r, w.a, w.a + w.len);
            ctx.strokeStyle = w.dark ? 'rgba(74, 44, 20, .26)' : 'rgba(255, 224, 182, .1)';
            ctx.lineWidth = w.w;
            ctx.stroke();
        }

        // 同心刻线
        const rings = [96, 80, 64, 48, 32];
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, rings[i], 0, TAU);
            ctx.strokeStyle = 'rgba(58, 33, 14, .3)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        // 靶心
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, TAU);
        ctx.fillStyle = '#c8453c';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, TAU);
        ctx.fillStyle = '#f2e5cf';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.fillStyle = '#c8453c';
        ctx.fill();

        // 螺栓
        for (let i = 0; i < 4; i++) {
            const a = i * TAU / 4 + Math.PI / 4;
            const bx = Math.cos(a) * (R - 15);
            const by = Math.sin(a) * (R - 15);
            ctx.beginPath();
            ctx.arc(bx, by, 4.2, 0, TAU);
            ctx.fillStyle = '#5a4028';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bx - 1, by - 1, 1.7, 0, TAU);
            ctx.fillStyle = 'rgba(255, 228, 190, .5)';
            ctx.fill();
        }

        // 外圈
        ctx.beginPath();
        ctx.arc(0, 0, R - 1.2, 0, TAU);
        ctx.strokeStyle = 'rgba(255, 226, 182, .5)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 盘上的刀
        for (let i = 0; i < placed.length; i++) drawPlacedKnife(placed[i]);

        ctx.restore();
    }

    function drawFlying() {
        if (!flying) return;
        ctx.save();
        ctx.translate(CX, flying.y);
        ctx.rotate(-Math.PI / 2);
        knifeBody(0);
        ctx.restore();
    }

    function drawSparks() {
        for (let i = 0; i < sparks.length; i++) {
            const p = sparks[i];
            const a = 1 - p.t / p.max;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, TAU);
            ctx.fillStyle = 'rgba(255, 222, 160, ' + (a * 0.9) + ')';
            ctx.fill();
        }
    }

    function drawShards() {
        if (!shards.length) return;
        const k = Math.max(0, dyingT / 0.9);
        ctx.save();
        ctx.translate(CX, CY);
        ctx.globalAlpha = Math.min(1, k * 1.6);
        for (let i = 0; i < shards.length; i++) {
            const s = shards[i];
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot);
            ctx.beginPath();
            ctx.arc(0, 0, s.r1, s.a, s.a + s.w);
            ctx.arc(0, 0, s.r0, s.a + s.w, s.a, true);
            ctx.closePath();
            ctx.fillStyle = s.tint < 0.5 ? 'rgba(163, 114, 70, .97)' : 'rgba(122, 80, 44, .97)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(62, 36, 16, .55)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 12px ' + FONT;
        if (state === 'playing' && combo >= 3 && pendingNext <= 0) {
            ctx.fillStyle = 'rgba(255, 208, 140, .95)';
            ctx.fillText('连中 ' + combo + ' 把', W / 2, 528);
        } else {
            ctx.fillStyle = 'rgba(186, 158, 132, .6)';
            ctx.fillText('点击或按空格投掷 · 别撞到盘上的刀', W / 2, 528);
        }
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 124, 102, .46)';
        ctx.fillText('R 重开', W / 2, 574);
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const fade = Math.min(1, (banner.max - banner.t) * 5);
        const a = banner.t < 0.28 ? banner.t / 0.28 : 1;
        ctx.save();
        ctx.globalAlpha = a * fade;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cy = 492;
        ctx.fillStyle = '#ffe0a8';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText(banner.title, W / 2, cy - 12);

        ctx.fillStyle = 'rgba(200, 176, 150, .85)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, cy + 14);
        ctx.restore();
    }

    function draw() {
        drawBg();

        ctx.save();
        if (shake > 0) {
            ctx.translate(Math.sin(clock * 74) * shake * 6, Math.cos(clock * 61) * shake * 4);
        }
        if (state === 'dying') {
            drawShards();
        } else {
            drawBoard();
            drawFlying();
        }
        drawSparks();
        ctx.restore();

        drawHeader();
        drawFooter();
        drawBanner();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        throwKnife();
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            e.preventDefault();
            throwKnife();
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
        if (dt > 0) update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    updateHud();
    requestAnimationFrame(loop);
})();
