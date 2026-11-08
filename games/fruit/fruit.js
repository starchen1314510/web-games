/* ==========================================================
   切水果 Fruit Slice
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 620;
    const TAU = Math.PI * 2;

    const GRAVITY = 1500;
    const MAX_LIVES = 3;
    const BEST_KEY = 'webgames.fruit.best';

    const FRUITS = [
        { name: '西瓜', skin: '#2f9e58', dark: '#1c6c3b', flesh: '#ff5470', juice: '#ff5470', stripe: true },
        { name: '橙子', skin: '#f08a24', dark: '#b65f0c', flesh: '#ffcf7a', juice: '#ffb454' },
        { name: '柠檬', skin: '#e6c41c', dark: '#b1920a', flesh: '#fff0a0', juice: '#ffe873' },
        { name: '苹果', skin: '#c62b3c', dark: '#8a1524', flesh: '#fff0e0', juice: '#ff8a95' },
        { name: '葡萄', skin: '#7b3fd4', dark: '#4f2191', flesh: '#dcc2ff', juice: '#a97bff' }
    ];

    const DIFFS = {
        easy: { gap: 1.26, speed: 0.9, label: '轻松' },
        normal: { gap: 0.98, speed: 1, label: '普通' },
        hard: { gap: 0.74, speed: 1.1, label: '疯狂' }
    };

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

    function rand(a, b) {
        return a + Math.random() * (b - a);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        lives: document.getElementById('lives'),
        combo: document.getElementById('combo'),
        cut: document.getElementById('cut'),
        best: document.getElementById('best'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let items = [];
    let halves = [];
    let bits = [];
    let texts = [];
    let blade = [];

    let score = 0;
    let lives = MAX_LIVES;
    let cutCount = 0;
    let combo = 0;
    let comboTimer = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);

    let state = 'ready';          // ready | playing | dying | over
    let diff = 'normal';
    let elapsed = 0;
    let spawnTimer = 0.6;
    let dyingTimer = 0;
    let overReason = '';
    let shake = 0;
    let flash = 0;
    let hudCache = '';

    let slicing = false;
    let lastPoint = null;

    /* ---------- HUD ---------- */
    function hearts(v) {
        let s = '';
        for (let i = 0; i < MAX_LIVES; i++) {
            s += i < v ? '♥' : '♡';
            if (i < MAX_LIVES - 1) s += ' ';
        }
        return s;
    }

    function updateHud() {
        const key = score + '|' + lives + '|' + combo + '|' + cutCount + '|' + best;
        if (key === hudCache) return;
        hudCache = key;

        els.score.textContent = String(score);
        els.lives.textContent = hearts(lives);
        els.combo.textContent = combo >= 2 ? ('×' + combo) : '--';
        els.cut.textContent = String(cutCount);
        els.best.textContent = String(best);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '切水果';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按住并划过水果把它切开，漏掉水果会损失一颗心。' +
                '别切到炸弹，那会直接结束。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始切水果';
        } else {
            els.ovTitle.textContent = overReason === 'bomb' ? '切到炸弹了' : '水果掉光了';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = overReason === 'bomb'
                ? '一共切开 ' + cutCount + ' 个水果，得分 ' + score + '。炸弹是黑色的，看清再下刀。'
                : '三颗心用完了，切开 ' + cutCount + ' 个水果，得分 ' + score + '。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '再来一次';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 流程 ---------- */
    function reset() {
        items = [];
        halves = [];
        bits = [];
        texts = [];
        blade = [];
        score = 0;
        lives = MAX_LIVES;
        cutCount = 0;
        combo = 0;
        comboTimer = 0;
        elapsed = 0;
        spawnTimer = 0.65;
        dyingTimer = 0;
        overReason = '';
        shake = 0;
        flash = 0;
        hudCache = '';
    }

    function begin() {
        reset();
        state = 'playing';
        hideOverlay();
        updateHud();
    }

    function endGame(reason) {
        if (state !== 'playing') return;
        state = 'dying';
        dyingTimer = 0.85;
        overReason = reason;
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();
    }

    function loseLife() {
        lives -= 1;
        flash = 0.55;
        shake = Math.max(shake, 0.28);
        updateHud();
        if (lives <= 0) endGame('lives');
    }

    /* ---------- 生成 ---------- */
    function currentGap() {
        const base = DIFFS[diff].gap;
        return Math.max(0.42, base - elapsed * 0.012);
    }

    function spawnOne(forceBomb) {
        const cfg = DIFFS[diff];
        const bomb = forceBomb === true;
        const kind = Math.floor(Math.random() * FRUITS.length);
        const r = bomb ? 21 : rand(24, 31);
        const x = rand(56, W - 56);
        const vy = -rand(1040, 1200) * cfg.speed;
        const vx = (W / 2 - x) / 1.5 + rand(-90, 90);

        items.push({
            bomb: bomb,
            kind: kind,
            x: x,
            y: H + 50,
            vx: vx,
            vy: vy,
            r: r,
            rot: rand(0, TAU),
            vrot: rand(-3.4, 3.4),
            sliced: false,
            missed: false
        });
    }

    function spawnGroup() {
        const count = 1 + Math.floor(Math.random() * 2) + (elapsed > 24 ? 1 : 0);
        for (let i = 0; i < count; i++) {
            const bombChance = elapsed < 8 ? 0 : 0.13;
            spawnOne(Math.random() < bombChance);
        }
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, color, n, spread) {
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU);
            const sp = rand(50, spread);
            bits.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                r: rand(1.6, 4.4),
                life: rand(0.35, 0.85),
                max: 0.85,
                color: color
            });
        }
    }

    function floatText(x, y, txt, color) {
        texts.push({ x: x, y: y, text: txt, color: color, life: 0.9, max: 0.9 });
    }

    /* ---------- 切割 ---------- */
    function segCircle(x1, y1, x2, y2, cx, cy, r) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 < 0.0001) {
            const ddx = cx - x1;
            const ddy = cy - y1;
            return ddx * ddx + ddy * ddy <= r * r;
        }
        let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
        t = clamp(t, 0, 1);
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const ex = px - cx;
        const ey = py - cy;
        return ex * ex + ey * ey <= r * r;
    }

    function sliceFruit(it, angle) {
        it.sliced = true;
        const f = FRUITS[it.kind];

        combo += 1;
        comboTimer = 0.5;
        cutCount += 1;

        let gain = 10;
        if (combo >= 3) gain += (combo - 2) * 5;
        score += gain;

        burst(it.x, it.y, f.juice, 16, 300);

        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        for (let s = -1; s <= 1; s += 2) {
            halves.push({
                kind: it.kind,
                x: it.x + nx * s * it.r * 0.28,
                y: it.y + ny * s * it.r * 0.28,
                vx: it.vx + nx * s * 190,
                vy: it.vy + ny * s * 190 - 70,
                r: it.r,
                rot: angle + (s > 0 ? 0 : Math.PI),
                vrot: rand(-3, 3),
                life: 1.6
            });
        }

        floatText(it.x, it.y - it.r - 6, '+' + gain, 'rgba(255, 236, 170, .95)');
        updateHud();
    }

    function sliceBomb(it) {
        it.sliced = true;
        shake = 1;
        flash = 0.9;
        burst(it.x, it.y, 'rgba(255, 170, 90, .95)', 34, 460);
        burst(it.x, it.y, 'rgba(255, 92, 60, .9)', 22, 300);
        endGame('bomb');
    }

    function trySlice(x1, y1, x2, y2) {
        if (state !== 'playing') return;
        return sliceSegment(x1, y1, x2, y2);
    }

    function sliceSegment(x1, y1, x2, y2) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        let hit = false;

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.sliced) continue;
            if (!segCircle(x1, y1, x2, y2, it.x, it.y, it.r)) continue;
            if (it.bomb) sliceBomb(it);
            else sliceFruit(it, angle);
            hit = true;
            if (state !== 'playing') break;
        }

        if (hit && combo >= 3 && state === 'playing') {
            floatText(W / 2, 132, '连击 ×' + combo, 'rgba(255, 197, 72, .95)');
        }
        return hit;
    }

    /* ---------- 更新 ---------- */
    function updateItems(dt) {
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            it.vy += GRAVITY * dt;
            it.x += it.vx * dt;
            it.y += it.vy * dt;
            it.rot += it.vrot * dt;

            if (it.x < it.r * 0.4) { it.x = it.r * 0.4; it.vx = Math.abs(it.vx) * 0.7; }
            if (it.x > W - it.r * 0.4) { it.x = W - it.r * 0.4; it.vx = -Math.abs(it.vx) * 0.7; }

            if (!it.bomb && !it.sliced && !it.missed && it.y - it.r > H + 6) {
                it.missed = true;
                loseLife();
            }

            if (it.y - it.r > H + 90) items.splice(i, 1);
        }
    }

    function updateHalves(dt) {
        for (let i = halves.length - 1; i >= 0; i--) {
            const h = halves[i];
            h.vy += GRAVITY * dt;
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            h.rot += h.vrot * dt;
            h.life -= dt;
            if (h.life <= 0 || h.y - h.r > H + 130) halves.splice(i, 1);
        }
    }

    function updateBits(dt) {
        for (let i = bits.length - 1; i >= 0; i--) {
            const b = bits[i];
            b.vy += GRAVITY * 0.55 * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) bits.splice(i, 1);
        }
    }

    function updateTexts(dt) {
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 42 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }
    }

    function updateBlade() {
        const now = performance.now();
        while (blade.length && now - blade[0].t > 160) blade.shift();
    }

    function update(dt) {
        elapsed += dt;

        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                combo = 0;
                updateHud();
            }
        }

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnGroup();
            spawnTimer = currentGap();
        }

        updateItems(dt);
        updateHalves(dt);
        updateBits(dt);
        updateTexts(dt);
        updateBlade();

        if (shake > 0) shake = Math.max(0, shake - dt * 3.2);
        if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
    }

    /* ---------- 绘制 ---------- */
    function drawBackground() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1420');
        g.addColorStop(0.55, '#0d1c2b');
        g.addColorStop(1, '#132b3a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, H + 60, 20, W / 2, H + 60, 340);
        glow.addColorStop(0, 'rgba(90, 210, 255, .12)');
        glow.addColorStop(1, 'rgba(90, 210, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(255, 255, 255, .014)';
        for (let i = 0; i < 26; i++) {
            const x = (i * 97) % W;
            const y = (i * 173) % H;
            ctx.beginPath();
            ctx.arc(x, y, 1.4, 0, TAU);
            ctx.fill();
        }
    }

    function drawWhole(it) {
        const f = FRUITS[it.kind];
        const r = it.r;

        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);

        if (it.bomb) {
            const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
            bg.addColorStop(0, '#5a6472');
            bg.addColorStop(0.6, '#23293a');
            bg.addColorStop(1, '#0b0f16');
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TAU);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 92, 108, .55)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, r - 2, 0, TAU);
            ctx.stroke();

            ctx.strokeStyle = '#8a6231';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(r * 0.2, -r * 0.86);
            ctx.quadraticCurveTo(r * 0.72, -r * 1.22, r * 0.98, -r * 0.86);
            ctx.stroke();

            const spark = 0.5 + Math.sin(elapsed * 18) * 0.5;
            ctx.shadowColor = 'rgba(255, 190, 90, .95)';
            ctx.shadowBlur = 10 + spark * 12;
            ctx.fillStyle = 'rgba(255, 220, 140, .95)';
            ctx.beginPath();
            ctx.arc(r * 0.98, -r * 0.86, 2.6 + spark * 1.6, 0, TAU);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255, 255, 255, .18)';
            ctx.beginPath();
            ctx.ellipse(-r * 0.34, -r * 0.4, r * 0.24, r * 0.14, -0.6, 0, TAU);
            ctx.fill();
            ctx.restore();
            return;
        }

        const g = ctx.createRadialGradient(-r * 0.36, -r * 0.42, r * 0.1, 0, 0, r);
        g.addColorStop(0, f.skin);
        g.addColorStop(1, f.dark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();

        if (f.stripe) {
            ctx.strokeStyle = 'rgba(12, 60, 32, .55)';
            ctx.lineWidth = r * 0.14;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.ellipse(0, 0, r * 0.94, r * 0.94, 0, -0.45 + i * 0.62, 0.18 + i * 0.62);
                ctx.stroke();
            }
        }

        ctx.fillStyle = 'rgba(255, 255, 255, .42)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.3, r * 0.18, -0.62, 0, TAU);
        ctx.fill();

        ctx.fillStyle = 'rgba(58, 122, 52, .9)';
        ctx.beginPath();
        ctx.ellipse(r * 0.16, -r * 0.94, r * 0.26, r * 0.12, -0.5, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    function drawHalf(h) {
        const f = FRUITS[h.kind];
        const r = h.r;
        const alpha = clamp(h.life / 0.6, 0, 1);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot);

        const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, f.flesh);
        g.addColorStop(1, f.flesh);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        const skinW = Math.max(2.4, r * 0.17);
        ctx.strokeStyle = f.skin;
        ctx.lineWidth = skinW;
        ctx.beginPath();
        ctx.arc(0, 0, r - skinW / 2, 0.04, Math.PI - 0.04);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, .55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r + skinW * 0.6, 0);
        ctx.lineTo(r - skinW * 0.6, 0);
        ctx.stroke();

        ctx.restore();
    }

    function drawBits() {
        for (let i = 0; i < bits.length; i++) {
            const b = bits[i];
            ctx.globalAlpha = clamp(b.life / b.max, 0, 1);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = t.color;
            ctx.font = '800 22px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawBlade() {
        if (blade.length < 2) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < blade.length; i++) {
            const a = i / blade.length;
            ctx.strokeStyle = 'rgba(190, 240, 255, ' + (a * 0.85).toFixed(3) + ')';
            ctx.lineWidth = 2 + a * 8;
            ctx.shadowColor = 'rgba(120, 220, 255, .8)';
            ctx.shadowBlur = 12 * a;
            ctx.beginPath();
            ctx.moveTo(blade[i - 1].x, blade[i - 1].y);
            ctx.lineTo(blade[i].x, blade[i].y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawHud() {
        ctx.save();
        ctx.font = '800 42px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(6, 12, 22, .65)';
        ctx.strokeText(String(score), 20, 18);
        ctx.fillStyle = '#eaf4ff';
        ctx.fillText(String(score), 20, 18);

        ctx.font = '700 20px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i < MAX_LIVES; i++) {
            ctx.fillStyle = i < lives ? 'rgba(255, 92, 108, .95)' : 'rgba(255, 255, 255, .16)';
            ctx.fillText(i < lives ? '♥' : '♡', W - 20 - i * 24, 26);
        }
        ctx.restore();
    }

    function drawReadyHint() {
        if (state !== 'ready') return;
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(elapsed * 3) * 0.25;
        ctx.fillStyle = '#d6e9ff';
        ctx.font = '700 16px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('按住鼠标并在画面上划动', W / 2, H - 64);
        ctx.restore();
    }

    function render() {
        ctx.save();
        if (shake > 0) {
            ctx.translate(rand(-1, 1) * shake * 12, rand(-1, 1) * shake * 12);
        }

        drawBackground();

        for (let i = 0; i < halves.length; i++) drawHalf(halves[i]);
        for (let i = 0; i < items.length; i++) {
            if (!items[i].sliced) drawWhole(items[i]);
        }

        drawBits();
        drawTexts();
        drawBlade();
        drawReadyHint();
        drawHud();

        ctx.restore();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(255, 92, 108, ' + (flash * 0.24).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ---------- 交互 ---------- */
    function pos(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        slicing = true;
        lastPoint = pos(e);
        blade = [{ x: lastPoint.x, y: lastPoint.y, t: performance.now() }];
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!slicing || state !== 'playing') return;
        const p = pos(e);
        if (lastPoint) trySlice(lastPoint.x, lastPoint.y, p.x, p.y);
        lastPoint = p;
        blade.push({ x: p.x, y: p.y, t: performance.now() });
        if (blade.length > 24) blade.shift();
    });

    function stopSlice() {
        slicing = false;
        lastPoint = null;
        blade = [];
    }

    window.addEventListener('pointerup', stopSlice);
    window.addEventListener('pointercancel', stopSlice);

    window.addEventListener('keydown', function (e) {
        if (e.key === 'r' || e.key === 'R') {
            begin();
            e.preventDefault();
        }
    });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        els.diffGroup.querySelectorAll('[data-diff]').forEach(function (b) {
            b.classList.toggle('active', b === btn);
        });
    });

    /* ---------- 启动 ---------- */
    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;

        if (state === 'playing') {
            update(dt);
        } else if (state === 'dying') {
            elapsed += dt;
            updateHalves(dt);
            updateBits(dt);
            updateTexts(dt);
            updateBlade();
            if (shake > 0) shake = Math.max(0, shake - dt * 3.2);
            if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
            dyingTimer -= dt;
            if (dyingTimer <= 0) {
                state = 'over';
                showOverlay('over');
            }
        } else {
            elapsed += dt;
            updateBits(dt);
            updateTexts(dt);
            if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
        }

        render();
        requestAnimationFrame(frame);
    }

    updateHud();
    showOverlay('ready');
    requestAnimationFrame(frame);
})();
