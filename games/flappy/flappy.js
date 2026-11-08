/* ==========================================================
   像素鸟 Flappy Bird
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 620;
    const TAU = Math.PI * 2;
    const BEST_KEY = 'webgames.flappy.best';

    const GROUND = 556;
    const BIRD_X = 148;
    const BIRD_R = 15;
    const GRAVITY = 2000;
    const FLAP_V = -555;
    const MAX_FALL = 900;

    const PIPE_W = 66;
    const PIPE_GAP_X = 248;
    const BASE_SPEED = 200;
    const BASE_GAP = 184;

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

    function roundRect(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.lineTo(x + w - rr, y);
        c.quadraticCurveTo(x + w, y, x + w, y + rr);
        c.lineTo(x + w, y + h - rr);
        c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        c.lineTo(x + rr, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - rr);
        c.lineTo(x, y + rr);
        c.quadraticCurveTo(x, y, x + rr, y);
        c.closePath();
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        pipes: document.getElementById('pipes'),
        speed: document.getElementById('speed'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let bird = { y: H * 0.42, vy: 0, rot: 0, wing: 0 };
    let pipes = [];
    let clouds = [];
    let stars = [];
    let buildings = [];

    let score = 0;
    let passed = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let elapsed = 0;
    let groundScroll = 0;
    let state = 'ready';           // ready | playing | paused | dying | over
    let flash = 0;
    let hudCache = '';
    let dieAt = 0;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND);
    skyGrad.addColorStop(0, '#0b1526');
    skyGrad.addColorStop(0.45, '#152a44');
    skyGrad.addColorStop(0.78, '#274867');
    skyGrad.addColorStop(1, '#3d6785');

    /* ---------- 场景 ---------- */
    function initScene() {
        clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: rand(0, W),
                y: rand(60, 300),
                w: rand(60, 120),
                h: rand(16, 26),
                sp: rand(6, 16)
            });
        }

        stars = [];
        for (let i = 0; i < 46; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * (GROUND * 0.6),
                r: rand(0.6, 1.6),
                a: rand(0.18, 0.7),
                tw: rand(0.6, 2.4)
            });
        }

        buildings = [];
        let bx = -20;
        while (bx < W + 40) {
            const bw = rand(26, 52);
            buildings.push({
                x: bx,
                w: bw,
                h: rand(40, 108),
                units: Math.floor(rand(2, 5))
            });
            bx += bw + rand(4, 14);
        }
    }

    function currentGap() {
        return BASE_GAP - Math.min(48, score * 2.2);
    }

    function currentSpeed() {
        return BASE_SPEED + Math.min(90, score * 4);
    }

    function spawnPipe() {
        const gap = currentGap();
        const top = rand(70, GROUND - gap - 96);
        pipes.push({ x: W + 40, top: top, gap: gap, scored: false });
    }

    /* ---------- 流程 ---------- */
    function reset() {
        initScene();
        bird = { y: H * 0.42, vy: 0, rot: 0, wing: 0 };
        pipes = [];
        score = 0;
        passed = 0;
        elapsed = 0;
        groundScroll = 0;
        flash = 0;
        dieAt = 0;
        hudCache = '';
        for (let i = 0; i < 2; i++) {
            pipes.push({
                x: W + 90 + i * PIPE_GAP_X,
                top: rand(90, GROUND - BASE_GAP - 110),
                gap: BASE_GAP,
                scored: false
            });
        }
        updateHud();
    }

    function begin() {
        reset();
        state = 'playing';
        flap();
        hideOverlay();
    }

    function flap() {
        if (state === 'ready') {
            begin();
            return;
        }
        if (state !== 'playing') return;
        bird.vy = FLAP_V;
        bird.wing = 1;
    }

    function die() {
        if (state !== 'playing') return;
        state = 'dying';
        dieAt = performance.now();
        flash = 0.6;
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();
    }

    function gameOver() {
        state = 'over';
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

    /* ---------- HUD ---------- */
    function updateHud() {
        const spd = (currentSpeed() / BASE_SPEED).toFixed(1);
        const key = score + '|' + best + '|' + passed + '|' + spd + '|' + state;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.pipes.textContent = String(passed);
        els.speed.textContent = spd + '×';
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '像素鸟';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '点击或按空格拍动翅膀，穿过管道缝隙。每穿过一根管道得一分，撞到管道或落地就结束。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始飞行';
            els.ovRestart.hidden = true;
        } else if (kind === 'paused') {
            els.ovTitle.textContent = '已暂停';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按 P 或 Esc 继续飞行。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '继续';
            els.ovRestart.hidden = false;
        } else if (kind === 'over') {
            els.ovTitle.textContent = score >= 20 ? '飞得漂亮' : '撞上了';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '穿过 ' + passed + ' 根管道，得分 ' + score + '。' +
                (score >= best && score > 0 ? '刷新了最高分！' : '再试一次，注意管道的节奏。');
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '再来一次';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 更新 ---------- */
    function hitPipe(p) {
        if (BIRD_X + BIRD_R < p.x || BIRD_X - BIRD_R > p.x + PIPE_W) return false;
        return bird.y - BIRD_R < p.top || bird.y + BIRD_R > p.top + p.gap;
    }

    function update(dt) {
        elapsed += dt;
        if (flash > 0) flash = Math.max(0, flash - dt);

        const spd = currentSpeed();
        bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt);
        bird.y += bird.vy * dt;
        bird.wing = Math.max(0, bird.wing - dt * 4.2);
        bird.rot += (clamp(bird.vy / 780, -0.55, 1.25) - bird.rot) * Math.min(1, dt * 11);

        if (bird.y - BIRD_R < 0) {
            bird.y = BIRD_R;
            bird.vy = Math.max(0, bird.vy);
        }

        for (let i = pipes.length - 1; i >= 0; i--) {
            const p = pipes[i];
            p.x -= spd * dt;
            p.gap += (currentGap() - p.gap) * Math.min(1, dt * 1.2);

            if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
                p.scored = true;
                score += 1;
                passed += 1;
                updateHud();
            }
            if (p.x + PIPE_W < -10) pipes.splice(i, 1);
        }

        const last = pipes[pipes.length - 1];
        if (!last || last.x < W - PIPE_GAP_X) spawnPipe();

        for (let i = 0; i < clouds.length; i++) {
            const c = clouds[i];
            c.x -= c.sp * dt;
            if (c.x + c.w < 0) {
                c.x = W + rand(10, 90);
                c.y = rand(50, 300);
            }
        }

        groundScroll = (groundScroll + spd * dt) % 48;

        for (let i = 0; i < pipes.length; i++) {
            if (hitPipe(pipes[i])) {
                die();
                return;
            }
        }

        if (bird.y + BIRD_R >= GROUND) {
            bird.y = GROUND - BIRD_R;
            die();
            return;
        }

        updateHud();
    }

    function updateDying(dt) {
        bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt);
        bird.y += bird.vy * dt;
        bird.rot = clamp(bird.vy / 700, 0, 1.5);
        if (bird.y + BIRD_R >= GROUND) {
            bird.y = GROUND - BIRD_R;
            if (performance.now() - dieAt > 420) gameOver();
        }
        if (flash > 0) flash = Math.max(0, flash - dt);
        if (performance.now() - dieAt > 1400) gameOver();
    }

    /* ---------- 绘制 ---------- */
    function drawSky() {
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, GROUND);

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const a = s.a * (0.6 + 0.4 * Math.sin(elapsed * s.tw + i));
            ctx.fillStyle = 'rgba(226, 240, 255, ' + a.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, TAU);
            ctx.fill();
        }

        for (let i = 0; i < clouds.length; i++) {
            const c = clouds[i];
            ctx.fillStyle = 'rgba(180, 210, 240, .09)';
            roundRect(ctx, c.x, c.y, c.w, c.h, c.h / 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(180, 210, 240, .07)';
            roundRect(ctx, c.x + c.w * 0.18, c.y - c.h * 0.55, c.w * 0.56, c.h, c.h / 2);
            ctx.fill();
        }
    }

    function drawCity() {
        ctx.fillStyle = 'rgba(9, 18, 30, .86)';
        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            const y = GROUND - b.h;
            ctx.fillRect(b.x, y, b.w, b.h);
        }

        ctx.fillStyle = 'rgba(120, 190, 255, .28)';
        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            const y = GROUND - b.h;
            for (let u = 0; u < b.units; u++) {
                for (let v = 0; v < 2; v++) {
                    if ((i + u * 3 + v * 5) % 3 === 0) continue;
                    ctx.fillRect(b.x + 6 + v * (b.w - 14), y + 10 + u * 18, 4, 6);
                }
            }
        }
    }

    function drawPipeBody(x, y, w, h, isTop) {
        if (h <= 0) return;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#1f9c6b');
        g.addColorStop(0.32, '#48e2a4');
        g.addColorStop(0.62, '#2cc889');
        g.addColorStop(1, '#146b47');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = 'rgba(255, 255, 255, .16)';
        ctx.fillRect(x + 9, y, 6, h);

        ctx.strokeStyle = 'rgba(6, 36, 24, .55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        const capH = 26;
        const capX = x - 5;
        const capW = w + 10;
        const capY = isTop ? y + h - capH : y;
        const cg = ctx.createLinearGradient(capX, 0, capX + capW, 0);
        cg.addColorStop(0, '#22a873');
        cg.addColorStop(0.32, '#55ecb0');
        cg.addColorStop(1, '#177a52');
        ctx.fillStyle = cg;
        roundRect(ctx, capX, capY, capW, capH, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(6, 36, 24, .6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawPipes() {
        for (let i = 0; i < pipes.length; i++) {
            const p = pipes[i];
            drawPipeBody(p.x, 0, PIPE_W, p.top, true);
            drawPipeBody(p.x, p.top + p.gap, PIPE_W, GROUND - (p.top + p.gap), false);
        }
    }

    function drawGround() {
        const g = ctx.createLinearGradient(0, GROUND, 0, H);
        g.addColorStop(0, '#1f3f2d');
        g.addColorStop(0.18, '#152c20');
        g.addColorStop(1, '#0a1610');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND, W, H - GROUND);

        ctx.fillStyle = 'rgba(47, 212, 139, .35)';
        ctx.fillRect(0, GROUND - 3, W, 3);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, GROUND, W, H - GROUND);
        ctx.clip();

        ctx.strokeStyle = 'rgba(47, 212, 139, .08)';
        ctx.lineWidth = 8;
        for (let x = -60 - groundScroll; x < W + 60; x += 48) {
            ctx.beginPath();
            ctx.moveTo(x, GROUND + 6);
            ctx.lineTo(x + 26, H);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, .03)';
        for (let x = -40 - groundScroll * 0.6; x < W + 40; x += 32) {
            ctx.fillRect(x, GROUND + 22, 14, 3);
            ctx.fillRect(x + 8, GROUND + 40, 10, 2);
        }
        ctx.restore();
    }

    function drawBird() {
        ctx.save();
        ctx.translate(BIRD_X, bird.y);
        ctx.rotate(bird.rot);

        const flap = Math.sin(elapsed * 22) * 0.5 + (bird.wing > 0 ? -0.7 : 0);
        const wingY = Math.sin(flap * Math.PI) * 5;

        const g = ctx.createLinearGradient(0, -BIRD_R, 0, BIRD_R);
        g.addColorStop(0, '#ffe08a');
        g.addColorStop(1, '#f2a93b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, BIRD_R + 1, BIRD_R, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, .3)';
        ctx.beginPath();
        ctx.ellipse(-1, 5.5, 9, 6.4, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.ellipse(-3.6, wingY + 1.2, 8.6, 5.4, -0.26, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 100, 20, .35)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(6, -5, 5.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#16202f';
        ctx.beginPath();
        ctx.arc(7.4, -5, 2.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, .9)';
        ctx.beginPath();
        ctx.arc(8.4, -6.2, 0.9, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#ff9f43';
        ctx.beginPath();
        ctx.moveTo(13, -1);
        ctx.lineTo(24, 2.4);
        ctx.lineTo(13, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 80, 10, .4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
    }

    function drawScore() {
        if (state === 'ready') return;
        const txt = String(score);
        ctx.font = '800 46px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(6, 12, 22, .7)';
        ctx.strokeText(txt, W / 2, 72);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(txt, W / 2, 72);
    }

    function drawReadyHint() {
        if (state !== 'ready') return;
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(elapsed * 3) * 0.25;
        ctx.fillStyle = '#dbe9ff';
        ctx.font = '700 15px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('点击画面或按空格开始', W / 2, GROUND - 70);
        ctx.restore();
    }

    function render() {
        drawSky();
        drawCity();
        drawPipes();
        drawGround();
        drawBird();
        drawReadyHint();
        drawScore();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(255, 92, 108, ' + (flash * 0.22).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;

        if (state === 'playing') update(dt);
        else if (state === 'dying') updateDying(dt);
        else if (state === 'ready') {
            elapsed += dt;
            bird.y = H * 0.42 + Math.sin(elapsed * 2.6) * 9;
            bird.rot = Math.sin(elapsed * 2.6) * 0.12;
        }

        render();
        requestAnimationFrame(frame);
    }

    /* ---------- 输入 ---------- */
    window.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (state === 'over') begin();
            else if (state === 'paused') togglePause();
            else flap();
            e.preventDefault();
            return;
        }
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            togglePause();
            e.preventDefault();
        }
    });

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state === 'over') begin();
        else flap();
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') togglePause();
        else begin();
    });

    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    /* ---------- 启动 ---------- */
    reset();
    showOverlay('ready');
    requestAnimationFrame(frame);
})();
