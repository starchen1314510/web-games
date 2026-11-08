/* ==========================================================
   打地鼠 Whack a Mole
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 520;
    const TAU = Math.PI * 2;
    const BEST_KEY = 'webgames.whack.best';

    const HOLE_R = 56;
    const HOLE_RY = 24;
    const CELL = 140;
    const ORIGIN_X = 100;
    const ORIGIN_Y = 152;

    const TOTAL_TIME = 60;
    const MAX_ACTIVE = 4;
    const BOMB_CHANCE = 0.12;

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
        best: document.getElementById('best'),
        time: document.getElementById('time'),
        combo: document.getElementById('combo'),
        hits: document.getElementById('hits'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let holes = [];
    let particles = [];
    let floaters = [];
    let grass = [];

    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let hits = 0;
    let combo = 0;
    let timeLeft = TOTAL_TIME;
    let elapsed = 0;
    let spawnCd = 0.7;
    let state = 'ready';          // ready | playing | paused | over
    let flash = 0;
    let hudCache = '';

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0d1a15');
    bgGrad.addColorStop(1, '#08120e');

    /* ---------- 场景 ---------- */
    function initScene() {
        holes = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                holes.push({
                    x: ORIGIN_X + c * CELL,
                    y: ORIGIN_Y + r * CELL,
                    mole: null
                });
            }
        }

        grass = [];
        for (let i = 0; i < 70; i++) {
            grass.push({
                x: Math.random() * W,
                y: ORIGIN_Y - 60 + Math.random() * (H - ORIGIN_Y + 40),
                h: rand(7, 16),
                lean: rand(-4, 4)
            });
        }
    }

    function activeCount() {
        let n = 0;
        for (let i = 0; i < holes.length; i++) {
            if (holes[i].mole) n++;
        }
        return n;
    }

    /* ---------- 生成地鼠 ---------- */
    function spawn() {
        if (activeCount() >= MAX_ACTIVE) return;

        const free = [];
        for (let i = 0; i < holes.length; i++) {
            if (!holes[i].mole) free.push(holes[i]);
        }
        if (!free.length) return;

        const hole = free[Math.floor(Math.random() * free.length)];
        hole.mole = {
            rise: 0,
            phase: 'up',
            life: clamp(1.3 - elapsed * 0.01, 0.6, 1.3),
            bomb: Math.random() < BOMB_CHANCE,
            hit: false
        };
    }

    function updateMoles(dt) {
        for (let i = 0; i < holes.length; i++) {
            const m = holes[i].mole;
            if (!m) continue;

            if (m.phase === 'up') {
                m.rise = Math.min(1, m.rise + dt * 5.5);
                if (m.rise >= 1) {
                    m.life -= dt;
                    if (m.life <= 0) {
                        m.phase = 'down';
                        if (!m.hit && !m.bomb) combo = 0;
                    }
                }
            } else {
                m.rise -= dt * 4.5;
                if (m.rise <= 0) holes[i].mole = null;
            }
        }
    }

    /* ---------- 敲击 ---------- */
    function comboMult() {
        return 1 + Math.min(3, Math.floor(combo / 6));
    }

    function whack(x, y) {
        let target = null;
        let bestD = 1e9;

        for (let i = 0; i < holes.length; i++) {
            const h = holes[i];
            const dx = x - h.x;
            const dy = (y - h.y) * 1.9;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestD) {
                bestD = d;
                target = h;
            }
        }

        if (!target || bestD > HOLE_R) return;

        const m = target.mole;
        if (!m || m.phase !== 'up' || m.rise < 0.3) {
            combo = 0;
            updateHud();
            return;
        }

        m.hit = true;
        m.phase = 'down';

        if (m.bomb) {
            score = Math.max(0, score - 15);
            combo = 0;
            flash = 0.45;
            burst(target.x, target.y - 40, '#ff5c6c', 12);
            floaters.push({ x: target.x, y: target.y - 76, text: '-15', life: 1, color: '#ff5c6c' });
        } else {
            combo += 1;
            hits += 1;
            const mult = comboMult();
            const gain = 10 * mult;
            score += gain;
            burst(target.x, target.y - 44, '#ffc548', 10);
            floaters.push({
                x: target.x,
                y: target.y - 76,
                text: mult > 1 ? '+' + gain + ' ×' + mult : '+' + gain,
                life: 1,
                color: '#ffc548'
            });
        }

        updateHud();
    }

    /* ---------- 粒子与飘字 ---------- */
    function burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = rand(0, TAU);
            const sp = rand(60, 170);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                life: rand(0.3, 0.6),
                max: 0.6,
                color: color
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 280 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function updateFloaters(dt) {
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.y -= 46 * dt;
            f.life -= dt * 1.2;
            if (f.life <= 0) floaters.splice(i, 1);
        }
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        const mult = comboMult();
        const comboText = mult > 1 ? combo + ' ×' + mult : String(combo);
        const key = score + '|' + best + '|' + Math.ceil(timeLeft) + '|' + comboText + '|' + hits;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.time.textContent = Math.ceil(Math.max(0, timeLeft)) + 's';
        els.combo.textContent = comboText;
        els.hits.textContent = String(hits);
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '打地鼠';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '60 秒内敲中越多地鼠越好，连续命中会提高倍率。带引线的炸弹地鼠千万别碰，敲错会掉分。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始敲击';
            els.ovRestart.hidden = true;
        } else if (kind === 'paused') {
            els.ovTitle.textContent = '已暂停';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按 P 或 Esc 继续。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '继续';
            els.ovRestart.hidden = false;
        } else if (kind === 'over') {
            els.ovTitle.textContent = '时间到';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '敲中 ' + hits + ' 只地鼠，命中率决定了最终的得分。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 流程 ---------- */
    function reset() {
        initScene();
        particles = [];
        floaters = [];
        score = 0;
        hits = 0;
        combo = 0;
        timeLeft = TOTAL_TIME;
        elapsed = 0;
        spawnCd = 0.6;
        flash = 0;
        hudCache = '';
        updateHud();
    }

    function begin() {
        reset();
        state = 'playing';
        hideOverlay();
    }

    function gameOver() {
        state = 'over';
        updateHud();
        showOverlay('over');
    }

    function togglePause() {
        if (state === 'playing') {
            state = 'paused';
            showOverlay('paused');
        } else if (state === 'paused') {
            state = 'playing';
            hideOverlay();
        }
    }

    /* ---------- 绘制 ---------- */
    function drawScene() {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(47, 212, 139, .09)';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < grass.length; i++) {
            const g = grass[i];
            ctx.beginPath();
            ctx.moveTo(g.x, g.y);
            ctx.quadraticCurveTo(g.x + g.lean, g.y - g.h * 0.6, g.x + g.lean * 1.6, g.y - g.h);
            ctx.stroke();
        }

        for (let i = 0; i < holes.length; i++) {
            const h = holes[i];
            ctx.fillStyle = 'rgba(0, 0, 0, .55)';
            ctx.beginPath();
            ctx.ellipse(h.x, h.y + 4, HOLE_R + 6, HOLE_RY + 5, 0, 0, TAU);
            ctx.fill();

            const dirt = ctx.createLinearGradient(0, h.y - HOLE_RY, 0, h.y + HOLE_RY);
            dirt.addColorStop(0, '#0a1310');
            dirt.addColorStop(1, '#050a07');
            ctx.fillStyle = dirt;
            ctx.beginPath();
            ctx.ellipse(h.x, h.y, HOLE_R, HOLE_RY, 0, 0, TAU);
            ctx.fill();

            ctx.strokeStyle = 'rgba(120, 170, 140, .16)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    function drawMole(h, m) {
        const cx = h.x;
        const ty = h.y + 70 - m.rise * 80;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - 62, 0, 124, h.y + 24);
        ctx.clip();

        const base = m.bomb ? '#46505f' : '#966f4b';
        const belly = m.bomb ? '#5b6675' : '#c19a71';

        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(cx - 25, ty - 26, 9.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 25, ty - 26, 9.5, 0, TAU);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, ty, 34, 0, TAU);
        ctx.fill();

        ctx.fillStyle = belly;
        ctx.beginPath();
        ctx.ellipse(cx, ty + 13, 20, 16, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = m.bomb ? '#ff5c6c' : '#16202f';
        ctx.beginPath();
        ctx.arc(cx - 12, ty - 8, 4.6, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 12, ty - 8, 4.6, 0, TAU);
        ctx.fill();

        if (!m.bomb) {
            ctx.fillStyle = 'rgba(255, 255, 255, .85)';
            ctx.beginPath();
            ctx.arc(cx - 10.6, ty - 9.4, 1.5, 0, TAU);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 13.4, ty - 9.4, 1.5, 0, TAU);
            ctx.fill();
        }

        ctx.fillStyle = m.bomb ? '#ff8a95' : '#ff9fb0';
        ctx.beginPath();
        ctx.arc(cx, ty + 4, 4.4, 0, TAU);
        ctx.fill();

        if (m.bomb) {
            ctx.strokeStyle = '#c9d8ee';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, ty - 32);
            ctx.quadraticCurveTo(cx + 15, ty - 50, cx + 24, ty - 41);
            ctx.stroke();

            const spark = 0.65 + Math.sin(elapsed * 18) * 0.35;
            ctx.fillStyle = 'rgba(255, 197, 72, .35)';
            ctx.beginPath();
            ctx.arc(cx + 24, ty - 41, 9 * spark, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffc548';
            ctx.beginPath();
            ctx.arc(cx + 24, ty - 41, 4 * spark, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }

    function drawTimer() {
        const ratio = clamp(timeLeft / TOTAL_TIME, 0, 1);
        const x = 60;
        const y = 34;
        const w = W - 120;

        ctx.fillStyle = 'rgba(255, 255, 255, .08)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, w, 10, 5) : ctx.rect(x, y, w, 10);
        ctx.fill();

        ctx.fillStyle = ratio > 0.3 ? '#2fd48b' : '#ff5c6c';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, Math.max(2, w * ratio), 10, 5) : ctx.rect(x, y, Math.max(2, w * ratio), 10);
        ctx.fill();
    }

    function drawParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloaters() {
        ctx.font = '800 17px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < floaters.length; i++) {
            const f = floaters[i];
            ctx.globalAlpha = clamp(f.life, 0, 1);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    }

    function render() {
        drawScene();

        for (let i = 0; i < holes.length; i++) {
            if (holes[i].mole) drawMole(holes[i], holes[i].mole);
        }

        drawTimer();
        drawParticles();
        drawFloaters();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(255, 70, 90, ' + (flash * 0.3) + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ---------- 主循环 ---------- */
    function update(dt) {
        elapsed += dt;
        timeLeft -= dt;
        if (flash > 0) flash = Math.max(0, flash - dt);

        spawnCd -= dt;
        if (spawnCd <= 0) {
            spawn();
            spawnCd = clamp(0.9 - elapsed * 0.009, 0.34, 0.9);
        }

        updateMoles(dt);
        updateParticles(dt);
        updateFloaters(dt);
        updateHud();

        if (timeLeft <= 0) {
            timeLeft = 0;
            gameOver();
        }
    }

    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;
        if (state === 'playing') update(dt);
        render();
        requestAnimationFrame(frame);
    }

    /* ---------- 输入 ---------- */
    window.addEventListener('keydown', function (e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            togglePause();
            e.preventDefault();
        }
    });

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        whack(x, y);
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') {
            togglePause();
        } else {
            begin();
        }
    });

    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    /* ---------- 启动 ---------- */
    initScene();
    updateHud();
    requestAnimationFrame(frame);
})();
