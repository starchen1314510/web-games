/* ==========================================================
   极速赛车 Racer
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 620;
    const TAU = Math.PI * 2;

    const HORIZON = 176;
    const ROAD_H = H - HORIZON + 60;
    const PLAYER_Y = H - 96;
    const PLAYER_T = Math.sqrt((PLAYER_Y - HORIZON) / ROAD_H);
    const LANES = 3;
    const MAX_LIVES = 3;
    const WORLD = 5000;
    const BEST_KEY = 'webgames.racer.best';

    const ENEMY_COLORS = [
        { main: '#4f8cff', dark: '#1e4a9c' },
        { main: '#2fd48b', dark: '#15805a' },
        { main: '#ffc548', dark: '#a8790f' },
        { main: '#9d5bff', dark: '#5a2aa8' },
        { main: '#e8eef8', dark: '#8d9cb5' },
        { main: '#ff8a5c', dark: '#a8471d' }
    ];

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

    function roadY(t) {
        return HORIZON + ROAD_H * t * t;
    }

    function halfWidth(t) {
        return 26 + 196 * t * t;
    }

    function laneSpan(t) {
        return 16 + 128 * t * t;
    }

    function laneX(t, lane) {
        return W / 2 + (lane - 1) * laneSpan(t);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        speed: document.getElementById('speed'),
        distance: document.getElementById('distance'),
        lives: document.getElementById('lives'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let cars = [];
    let bits = [];
    let texts = [];
    let state = 'ready';
    let score = 0;
    let distance = 0;
    let speed = 900;
    let world = 0;
    let lives = MAX_LIVES;
    let invuln = 0;
    let spawnTimer = 1.1;
    let playerLane = 1;
    let targetLane = 1;
    let tilt = 0;
    let sway = 0;
    let shake = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let hudCache = '';
    let dodged = 0;
    let hudTimer = 0;

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
        const kmh = Math.round(70 + (speed - 900) * 0.075);
        const key = score + '|' + distance + '|' + lives + '|' + kmh + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.speed.textContent = kmh + ' km/h';
        els.distance.textContent = Math.floor(distance) + ' m';
        els.lives.textContent = hearts(lives);
        els.best.textContent = String(best);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '极速赛车';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '自动加速，左右变道躲避车流。每躲过一辆车加 40 分，撞车损失一颗心，三颗心用完结束。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始吧';
        } else {
            els.ovTitle.textContent = '车辆报废';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '跑了 ' + Math.floor(distance) + ' 米，躲过 ' + dodged +
                ' 辆车，得分 ' + score + '。';
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
    function begin() {
        cars = [];
        bits = [];
        texts = [];
        score = 0;
        distance = 0;
        speed = 900;
        world = 0;
        lives = MAX_LIVES;
        invuln = 0;
        spawnTimer = 1.2;
        playerLane = 1;
        targetLane = 1;
        tilt = 0;
        sway = 0;
        shake = 0;
        dodged = 0;
        hudCache = '';
        state = 'playing';
        hideOverlay();
        updateHud();
    }

    function endGame() {
        if (state !== 'playing') return;
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();
        showOverlay('over');
    }

    function crash(car) {
        lives -= 1;
        invuln = 1.5;
        shake = 1;
        burst(car.x, car.y, 'rgba(255, 170, 90, .95)', 26, 320);
        burst(car.x, car.y, 'rgba(255, 92, 108, .9)', 18, 220);
        texts.push({ x: W / 2, y: H / 2 - 40, text: '撞车了', life: 1, max: 1, size: 24 });
        updateHud();
        if (lives <= 0) endGame();
    }

    /* ---------- 车流 ---------- */
    function spawnCar() {
        const lane = Math.floor(Math.random() * LANES);
        let block = false;
        for (let i = 0; i < cars.length; i++) {
            const c = cars[i];
            if (c.lane === lane && c.t < 0.28) block = true;
        }
        if (block) return;
        const tint = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
        cars.push({
            lane: lane,
            t: -0.04,
            x: 0,
            y: 0,
            scale: 0.2,
            main: tint.main,
            dark: tint.dark,
            passed: false,
            wobble: rand(0, TAU)
        });
    }

    function burst(x, y, color, n, spread) {
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU);
            const sp = rand(40, spread);
            bits.push({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: rand(1.6, 4.2),
                life: rand(0.3, 0.7),
                max: 0.7,
                color: color
            });
        }
    }

    function updateCars(dt) {
        const grow = speed * dt / WORLD;
        for (let i = cars.length - 1; i >= 0; i--) {
            const c = cars[i];
            c.t += grow;
            c.y = roadY(c.t);
            c.x = laneX(c.t, c.lane) + Math.sin(world * 0.001 + c.wobble) * c.t * 6;
            c.scale = 0.26 + c.t * 1.24;

            if (!c.passed && c.y > PLAYER_Y + 6) {
                c.passed = true;
                dodged += 1;
                score += 40;
                updateHud();
            }
            if (c.t > 1.16 || c.y > H + 140) {
                cars.splice(i, 1);
                continue;
            }
            if (invuln <= 0 && Math.abs(c.y - PLAYER_Y) < 40 * ((c.scale + 1) / 2) &&
                Math.abs(laneX(PLAYER_T, c.lane) - laneX(PLAYER_T, playerLane)) < 52) {
                crash(c);
                cars.splice(i, 1);
            }
        }
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        world += speed * dt;
        distance += speed * dt / 34;
        speed = 900 + Math.min(1300, distance * 0.55);

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnCar();
            spawnTimer = clamp(1.5 - distance * 0.0012, 0.42, 1.5) + rand(-0.1, 0.25);
        }

        playerLane += (targetLane - playerLane) * Math.min(1, dt * 9);
        tilt += ((targetLane - playerLane) * 0.32 - tilt) * Math.min(1, dt * 8);

        sway = Math.sin(world * 0.00022) * 10;
        hudTimer -= dt;
        if (hudTimer <= 0) {
            hudTimer = 0.2;
            updateHud();
        }
        if (invuln > 0) invuln = Math.max(0, invuln - dt);
        if (shake > 0) shake = Math.max(0, shake - dt * 2.6);

        updateCars(dt);

        for (let i = bits.length - 1; i >= 0; i--) {
            const b = bits[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) bits.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 40 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }
    }

    /* ---------- 绘制 ---------- */
    function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
        g.addColorStop(0, '#0d1a2c');
        g.addColorStop(0.6, '#132234');
        g.addColorStop(1, '#182a3d');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, HORIZON);

        const gg = ctx.createLinearGradient(0, HORIZON, 0, H);
        gg.addColorStop(0, '#141c28');
        gg.addColorStop(0.55, '#0d141d');
        gg.addColorStop(1, '#070a11');
        ctx.fillStyle = gg;
        ctx.fillRect(0, HORIZON, W, H - HORIZON);

        const glow = ctx.createRadialGradient(W / 2, HORIZON, 10, W / 2, HORIZON, 260);
        glow.addColorStop(0, 'rgba(255, 168, 96, .30)');
        glow.addColorStop(1, 'rgba(255, 168, 96, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, HORIZON - 220, W, 220);

        ctx.fillStyle = 'rgba(10, 20, 34, .85)';
        for (let i = 0; i < 26; i++) {
            const bw = 12 + (i * 37) % 26;
            const bh = 14 + (i * 53) % 54;
            const bx = (i * 41 - world * 0.012) % (W + 60) - 30;
            ctx.fillRect(bx, HORIZON - bh, bw, bh);
        }

        ctx.fillStyle = 'rgba(255, 214, 140, .55)';
        for (let i = 0; i < 60; i++) {
            const bx = (i * 61 - world * 0.012) % (W + 60) - 30;
            const by = HORIZON - 4 - (i * 17) % 10;
            ctx.fillRect(bx, by, 2, 2);
        }
    }

    function drawRoad() {
        ctx.save();
        const steps = 48;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const y = roadY(t);
            const x = W / 2 - halfWidth(t) + sway * t * t;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const y = roadY(t);
            const x = W / 2 + halfWidth(t) + sway * t * t;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        const g = ctx.createLinearGradient(0, HORIZON, 0, H);
        g.addColorStop(0, '#26313f');
        g.addColorStop(0.5, '#1b2531');
        g.addColorStop(1, '#141c26');
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        ctx.clip();

        const phase = (world * 0.0016) % 1;
        for (let band = -1; band < 26; band++) {
            const t0 = (band + phase) / 26;
            const t1 = t0 + 0.55 / 26;
            if (t1 <= 0 || t0 >= 1) continue;
            const a = clamp(t0, 0, 1);
            const b = clamp(t1, 0, 1);
            for (let k = 0; k < 2; k++) {
                const lane = 0.5 + k;
                const x0 = W / 2 + (lane - 1) * laneSpan(a) + sway * a * a;
                const x1 = W / 2 + (lane - 1) * laneSpan(b) + sway * b * b;
                const w0 = 1 + 5 * a * a;
                const w1 = 1 + 5 * b * b;
                ctx.beginPath();
                ctx.moveTo(x0 - w0, roadY(a));
                ctx.lineTo(x0 + w0, roadY(a));
                ctx.lineTo(x1 + w1, roadY(b));
                ctx.lineTo(x1 - w1, roadY(b));
                ctx.closePath();
                ctx.fillStyle = 'rgba(232, 244, 255, ' + (0.18 + 0.5 * a).toFixed(3) + ')';
                ctx.fill();
            }
        }

        const edgePhase = (world * 0.0022) % 1;
        for (let band = -1; band < 30; band++) {
            const t = (band + edgePhase) / 30;
            if (t <= 0 || t >= 1) continue;
            const y = roadY(t);
            const w = 1.5 + 4 * t * t;
            const off = halfWidth(t) - 6 * t * t;
            ctx.fillStyle = 'rgba(255, 214, 140, ' + (0.22 + 0.5 * t).toFixed(3) + ')';
            ctx.fillRect(W / 2 - off + sway * t * t - w / 2, y, w, 3 + 10 * t);
            ctx.fillRect(W / 2 + off + sway * t * t - w / 2, y, w, 3 + 10 * t);
        }
        ctx.restore();
        ctx.restore();
    }

    function drawScenery() {
        for (let i = 0; i < 14; i++) {
            const t = (i / 14 + (world * 0.00009) % 1) % 1;
            if (t < 0.03) continue;
            const y = roadY(t);
            const off = halfWidth(t) + 22 + 44 * t * t;
            const h = 12 + 52 * t * t;
            const w = 1 + 1.8 * t * t;
            for (let k = -1; k <= 1; k += 2) {
                const x = W / 2 + k * off + sway * t * t;
                ctx.fillStyle = 'rgba(26, 38, 55, ' + (0.55 + 0.35 * t).toFixed(3) + ')';
                ctx.fillRect(x - w, y - h, w * 2, h);
                ctx.fillStyle = 'rgba(255, 214, 140, ' + (0.16 + 0.55 * t).toFixed(3) + ')';
                ctx.fillRect(x - w, y - h, w * 2, 2 + 3 * t);
            }
        }
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawCar(x, y, s, main, dark, isPlayer) {
        const w = 58 * s;
        const h = 86 * s;
        const left = x - w / 2;
        const top = y - h / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, .40)';
        ctx.beginPath();
        ctx.ellipse(x, y + h * 0.46, w * 0.56, h * 0.14, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#0a1018';
        roundRect(left - w * 0.06, top + h * 0.16, w * 0.14, h * 0.3, 3 * s);
        ctx.fill();
        roundRect(left + w * 0.92, top + h * 0.16, w * 0.14, h * 0.3, 3 * s);
        ctx.fill();
        roundRect(left - w * 0.06, top + h * 0.6, w * 0.14, h * 0.26, 3 * s);
        ctx.fill();
        roundRect(left + w * 0.92, top + h * 0.6, w * 0.14, h * 0.26, 3 * s);
        ctx.fill();

        const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, dark);
        g.addColorStop(0.42, main);
        g.addColorStop(0.6, main);
        g.addColorStop(1, dark);
        ctx.fillStyle = g;
        roundRect(left, top, w, h, 9 * s);
        ctx.fill();

        ctx.fillStyle = 'rgba(16, 26, 40, .92)';
        roundRect(left + w * 0.14, top + h * 0.20, w * 0.72, h * 0.28, 6 * s);
        ctx.fill();

        ctx.fillStyle = 'rgba(160, 210, 255, .20)';
        roundRect(left + w * 0.18, top + h * 0.23, w * 0.64, h * 0.1, 4 * s);
        ctx.fill();

        ctx.fillStyle = 'rgba(16, 26, 40, .75)';
        roundRect(left + w * 0.12, top + h * 0.56, w * 0.76, h * 0.2, 5 * s);
        ctx.fill();

        const lightY = top + h * 0.82;
        ctx.fillStyle = isPlayer ? 'rgba(255, 92, 108, .95)' : 'rgba(255, 92, 108, .82)';
        roundRect(left + w * 0.1, lightY, w * 0.24, h * 0.09, 3 * s);
        ctx.fill();
        roundRect(left + w * 0.66, lightY, w * 0.24, h * 0.09, 3 * s);
        ctx.fill();

        if (isPlayer) {
            ctx.save();
            ctx.shadowColor = 'rgba(255, 92, 108, .85)';
            ctx.shadowBlur = 16;
            ctx.fillStyle = 'rgba(255, 120, 130, .95)';
            roundRect(left + w * 0.1, lightY, w * 0.24, h * 0.09, 3 * s);
            ctx.fill();
            roundRect(left + w * 0.66, lightY, w * 0.24, h * 0.09, 3 * s);
            ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, .16)';
        roundRect(left + w * 0.08, top + h * 0.08, w * 0.84, h * 0.045, 2 * s);
        ctx.fill();
    }

    function drawPlayer() {
        const x = laneX(PLAYER_T, playerLane);
        const bobY = Math.sin(world * 0.02) * 1.2;
        ctx.save();
        if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45;
        ctx.translate(x, PLAYER_Y + bobY);
        ctx.rotate(tilt * 0.5);
        drawCar(0, 0, 1.14, '#ff5c6c', '#a32533', true);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.5;
        const g = ctx.createLinearGradient(0, PLAYER_Y - 10, 0, PLAYER_Y + 70);
        g.addColorStop(0, 'rgba(255, 92, 108, .30)');
        g.addColorStop(1, 'rgba(255, 92, 108, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 34, PLAYER_Y - 10, 68, 90);
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
            ctx.fillStyle = 'rgba(255, 210, 150, .95)';
            ctx.font = '800 ' + t.size + 'px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawHud() {
        ctx.save();
        ctx.font = '800 40px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(6, 12, 22, .6)';
        ctx.strokeText(String(score), 20, 16);
        ctx.fillStyle = '#eaf4ff';
        ctx.fillText(String(score), 20, 16);

        ctx.font = '700 15px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(200, 224, 255, .8)';
        ctx.fillText(Math.floor(distance) + ' m', W - 20, 76);

        ctx.textAlign = 'right';
        for (let i = 0; i < MAX_LIVES; i++) {
            ctx.fillStyle = i < lives ? 'rgba(255, 92, 108, .95)' : 'rgba(255, 255, 255, .18)';
            ctx.fillText(i < lives ? '♥' : '♡', W - 20 - i * 20, 20);
        }
        ctx.restore();
    }

    function render() {
        ctx.save();
        if (shake > 0) {
            ctx.translate(rand(-1, 1) * shake * 9, rand(-1, 1) * shake * 9);
        }
        drawSky();
        drawRoad();
        drawScenery();

        const sorted = cars.slice().sort(function (a, b) { return a.t - b.t; });
        for (let i = 0; i < sorted.length; i++) {
            const c = sorted[i];
            if (c.t > PLAYER_T) break;
            drawCar(c.x, c.y, c.scale * 0.92, c.main, c.dark, false);
        }

        drawPlayer();

        for (let i = 0; i < sorted.length; i++) {
            const c = sorted[i];
            if (c.t <= PLAYER_T) continue;
            drawCar(c.x, c.y, c.scale * 0.92, c.main, c.dark, false);
        }
        drawBits();
        drawTexts();
        drawHud();
        ctx.restore();
    }

    /* ---------- 循环 ---------- */
    let last = performance.now();

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (state === 'playing') update(dt);
        else {
            for (let i = bits.length - 1; i >= 0; i--) {
                const b = bits[i];
                b.life -= dt;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                if (b.life <= 0) bits.splice(i, 1);
            }
        }
        render();
        window.requestAnimationFrame(loop);
    }

    /* ---------- 交互 ---------- */
    function steer(dir) {
        if (state !== 'playing') return;
        targetLane = clamp(targetLane + dir, 0, LANES - 1);
    }

    window.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            steer(-1);
            e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            steer(1);
            e.preventDefault();
        } else if (e.key === 'r' || e.key === 'R') {
            begin();
            e.preventDefault();
        }
    });

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        steer(x < W / 2 ? -1 : 1);
    });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    updateHud();
    showOverlay('ready');
    window.requestAnimationFrame(loop);
})();
