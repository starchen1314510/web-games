/* ==========================================================
   车接人 Taxi Rush
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 620;
    const TAU = Math.PI * 2;
    const BEST_KEY = 'webgames.taxi.best';

    const CAR_Y = 552;
    const CAR_W = 74;
    const CAR_H = 42;
    const CAR_MAX = 4;
    const CAR_SPEED = 380;

    const ROAD_TOP = 420;
    const STATION_Y = 446;
    const SPAWN_Y = 452;

    const STATIONS = [
        { key: 'A', x: 96, color: '#4f8cff' },
        { key: 'B', x: 240, color: '#ff9f43' },
        { key: 'C', x: 384, color: '#2fd48b' }
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

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        delivered: document.getElementById('delivered'),
        combo: document.getElementById('combo'),
        hearts: document.getElementById('hearts'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn'),
        touchPad: document.getElementById('touch-pad')
    };

    /* ---------- 状态 ---------- */
    const car = { x: W / 2, riders: [] };
    let passengers = [];
    let particles = [];
    let floaters = [];
    let buildings = [];

    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let hearts = 3;
    let delivered = 0;
    let combo = 0;
    let comboTimer = 0;
    let state = 'ready';        // ready | playing | paused | over
    let elapsed = 0;
    let spawnCd = 1.6;
    let dropCd = 0;
    let roadOffset = 0;
    let hurtFlash = 0;
    let hudCache = '';
    let dragX = null;

    const keys = { left: false, right: false, padLeft: false, padRight: false };

    const skyGrad = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    skyGrad.addColorStop(0, '#080d16');
    skyGrad.addColorStop(0.6, '#0e1828');
    skyGrad.addColorStop(1, '#16243a');

    /* ---------- 城市远景 ---------- */
    function initBuildings() {
        buildings = [];
        let x = -18;
        while (x < W + 20) {
            const w = rand(34, 62);
            const h = rand(70, 210);
            buildings.push({
                x: x,
                w: w,
                h: h,
                color: pick(['#101a2a', '#131f31', '#0d1624', '#152235']),
                win: Math.random() < 0.45
            });
            x += w + rand(4, 12);
        }
    }

    /* ---------- 乘客 ---------- */
    function spawnPassenger() {
        let alive = 0;
        for (let i = 0; i < passengers.length; i++) {
            if (!passengers[i].dead) alive++;
        }
        if (alive >= 5) return;

        // 避开已有乘客的位置，避免叠在一起看不清
        let px = rand(58, W - 58);
        for (let i = 0; i < 10; i++) {
            let clash = false;
            for (let j = 0; j < passengers.length; j++) {
                if (!passengers[j].dead && Math.abs(passengers[j].x - px) < 48) {
                    clash = true;
                    break;
                }
            }
            if (!clash) break;
            px = rand(58, W - 58);
        }

        passengers.push({
            x: px,
            y: SPAWN_Y,
            targetY: rand(506, 540),
            dest: pick(STATIONS),
            speed: rand(46, 64),
            patience: 0,
            maxPatience: clamp(14 - elapsed * 0.12, 8, 14),
            state: 'walk',
            alpha: 1,
            bob: rand(0, TAU),
            dead: false
        });
    }

    function pickup(p) {
        if (car.riders.length >= CAR_MAX) return false;
        if (Math.abs(car.x - p.x) > CAR_W / 2 + 9) return false;
        if (Math.abs(CAR_Y - p.y) > CAR_H / 2 + 13) return false;

        car.riders.push({ dest: p.dest });
        p.dead = true;
        burst(p.x, p.y, p.dest.color, 9);
        return true;
    }

    function updatePassengers(dt) {
        for (let i = passengers.length - 1; i >= 0; i--) {
            const p = passengers[i];

            if (p.state === 'walk') {
                p.y += p.speed * dt;
                if (p.y >= p.targetY) {
                    p.y = p.targetY;
                    p.state = 'wait';
                    p.patience = p.maxPatience;
                }
                pickup(p);
            } else if (p.state === 'wait') {
                p.patience -= dt;
                if (p.patience <= 0) {
                    p.state = 'angry';
                    p.patience = 0;
                    loseHeart();
                } else {
                    pickup(p);
                }
            } else if (p.state === 'angry') {
                p.y -= 46 * dt;
                p.alpha -= 1.1 * dt;
                if (p.alpha <= 0) p.dead = true;
            }

            if (p.dead) passengers.splice(i, 1);
        }
    }

    /* ---------- 送客 ---------- */
    function alight(dt) {
        if (dropCd > 0) {
            dropCd -= dt;
            return;
        }
        if (!car.riders.length) return;

        let station = null;
        for (let i = 0; i < STATIONS.length; i++) {
            if (Math.abs(car.x - STATIONS[i].x) < 46) {
                station = STATIONS[i];
                break;
            }
        }
        if (!station) return;

        let idx = -1;
        for (let i = 0; i < car.riders.length; i++) {
            if (car.riders[i].dest.key === station.key) {
                idx = i;
                break;
            }
        }
        if (idx < 0) return;

        car.riders.splice(idx, 1);
        combo += 1;
        comboTimer = 3.2;
        const gain = 10 + Math.min(combo - 1, 4) * 5;
        score += gain;
        delivered += 1;
        dropCd = 0.13;

        burst(station.x, STATION_Y + 14, station.color, 11);
        floaters.push({
            x: station.x,
            y: STATION_Y - 6,
            text: '+' + gain,
            life: 1,
            color: station.color
        });
    }

    function loseHeart() {
        hearts -= 1;
        combo = 0;
        hurtFlash = 0.55;
        if (hearts <= 0) {
            hearts = 0;
            gameOver();
        }
    }

    /* ---------- 粒子与飘字 ---------- */
    function burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = rand(0, TAU);
            const sp = rand(40, 130);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 30,
                life: rand(0.35, 0.7),
                max: 0.7,
                color: color
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 160 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function updateFloaters(dt) {
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.y -= 42 * dt;
            f.life -= dt * 1.1;
            if (f.life <= 0) floaters.splice(i, 1);
        }
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        const heartsText = '♥'.repeat(Math.max(0, hearts)) || '—';
        const key = score + '|' + best + '|' + delivered + '|' + combo + '|' + heartsText;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.delivered.textContent = String(delivered);
        els.combo.textContent = String(combo);
        els.hearts.textContent = heartsText;
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '车接人';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '开车接上路边招手的乘客，送到头顶同色站点就能收车费。连续送达有加成，乘客等太久会生气离开。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始接单';
            els.ovRestart.hidden = true;
        } else if (kind === 'paused') {
            els.ovTitle.textContent = '暂停接单';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按 P 或 Esc 继续行驶。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '继续行驶';
            els.ovRestart.hidden = false;
        } else if (kind === 'over') {
            els.ovTitle.textContent = '今日收工';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '累计送达 ' + delivered + ' 位乘客，路上还有人在等你。';
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
        car.x = W / 2;
        car.riders = [];
        passengers = [];
        particles = [];
        floaters = [];
        score = 0;
        hearts = 3;
        delivered = 0;
        combo = 0;
        comboTimer = 0;
        elapsed = 0;
        spawnCd = 1.4;
        dropCd = 0;
        hurtFlash = 0;
        hudCache = '';
        dragX = null;
        initBuildings();
        updateHud();
    }

    function begin() {
        reset();
        state = 'playing';
        hideOverlay();
    }

    function gameOver() {
        state = 'over';
        dragX = null;
        updateHud();
        showOverlay('over');
    }

    function togglePause() {
        if (state === 'playing') {
            state = 'paused';
            dragX = null;
            showOverlay('paused');
        } else if (state === 'paused') {
            state = 'playing';
            hideOverlay();
        }
    }

    /* ---------- 绘制工具 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /* ---------- 场景 ---------- */
    function drawCity() {
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, ROAD_TOP);

        ctx.fillStyle = 'rgba(201, 216, 238, .5)';
        ctx.beginPath();
        ctx.arc(392, 92, 22, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(10, 16, 26, .92)';
        ctx.beginPath();
        ctx.arc(402, 84, 20, 0, TAU);
        ctx.fill();

        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            const top = ROAD_TOP - b.h;
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, top, b.w, b.h);

            if (b.win) {
                ctx.fillStyle = 'rgba(255, 214, 140, .16)';
                const cols = Math.max(1, Math.floor(b.w / 16));
                const rows = Math.floor(b.h / 26);
                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        if ((c + r) % 3 === 0) {
                            ctx.fillRect(b.x + 6 + c * 16, top + 12 + r * 26, 6, 9);
                        }
                    }
                }
            }
        }

        const glow = ctx.createLinearGradient(0, ROAD_TOP - 60, 0, ROAD_TOP);
        glow.addColorStop(0, 'rgba(79, 140, 255, 0)');
        glow.addColorStop(1, 'rgba(79, 140, 255, .14)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, ROAD_TOP - 60, W, 60);
    }

    function drawRoad() {
        ctx.fillStyle = '#0a0f18';
        ctx.fillRect(0, ROAD_TOP, W, H - ROAD_TOP);
        ctx.fillStyle = 'rgba(255, 255, 255, .06)';
        ctx.fillRect(0, ROAD_TOP, W, 2);

        for (let x = -roadOffset; x < W; x += 46) {
            ctx.fillStyle = 'rgba(232, 238, 248, .13)';
            ctx.fillRect(x, 480, 26, 4);
        }

        ctx.fillStyle = '#0e1520';
        ctx.fillRect(0, 596, W, 24);
        ctx.fillStyle = 'rgba(255, 255, 255, .05)';
        ctx.fillRect(0, 596, W, 2);
    }

    function drawLamps() {
        const xs = [24, 168, 312, 456];
        for (let i = 0; i < xs.length; i++) {
            const lx = xs[i];
            const glow = ctx.createRadialGradient(lx, 404, 4, lx, 404, 56);
            glow.addColorStop(0, 'rgba(255, 214, 140, .16)');
            glow.addColorStop(1, 'rgba(255, 214, 140, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(lx, 404, 56, 0, TAU);
            ctx.fill();

            ctx.strokeStyle = 'rgba(147, 163, 186, .28)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(lx, 406);
            ctx.lineTo(lx, ROAD_TOP);
            ctx.stroke();

            ctx.fillStyle = '#ffd68c';
            ctx.beginPath();
            ctx.arc(lx, 404, 3.6, 0, TAU);
            ctx.fill();
        }
    }

    function drawStations() {
        for (let i = 0; i < STATIONS.length; i++) {
            const s = STATIONS[i];
            const near = Math.abs(car.x - s.x) < 46 && car.riders.some(function (r) {
                return r.dest.key === s.key;
            });

            const beam = ctx.createLinearGradient(0, STATION_Y + 16, 0, 520);
            beam.addColorStop(0, near ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)');
            beam.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = beam;
            ctx.fillRect(s.x - 34, STATION_Y + 16, 68, 104);

            ctx.fillStyle = 'rgba(11, 17, 27, .92)';
            roundRect(s.x - 38, STATION_Y - 17, 76, 34, 11);
            ctx.fill();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = near ? 2.6 : 1.6;
            ctx.stroke();

            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x - 20, STATION_Y, 6, 0, TAU);
            ctx.fill();

            if (near) {
                ctx.shadowColor = s.color;
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = '#e8eef8';
            ctx.font = '700 13px -apple-system, "PingFang SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('站点 ' + s.key, s.x + 8, STATION_Y + 1);
        }
    }

    function drawPassenger(p) {
        const color = p.dest.color;
        const bob = p.state === 'wait' ? Math.sin(elapsed * 4 + p.bob) * 1.4 : 0;
        const baseY = p.y + bob;

        ctx.save();
        ctx.globalAlpha = clamp(p.alpha, 0, 1);

        ctx.fillStyle = 'rgba(0, 0, 0, .42)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 16, 10, 4, 0, 0, TAU);
        ctx.fill();

        if (p.state === 'wait') {
            const ratio = clamp(p.patience / p.maxPatience, 0, 1);
            ctx.fillStyle = 'rgba(8, 12, 18, .85)';
            roundRect(p.x - 11, baseY - 35, 22, 4, 2);
            ctx.fill();
            ctx.fillStyle = ratio > 0.5 ? '#2fd48b' : (ratio > 0.26 ? '#ffc548' : '#ff5c6c');
            roundRect(p.x - 11, baseY - 35, Math.max(2, 22 * ratio), 4, 2);
            ctx.fill();
        }

        ctx.fillStyle = p.state === 'angry' ? '#8f9bb0' : '#f3d7bb';
        ctx.beginPath();
        ctx.arc(p.x, baseY - 18, 7.4, 0, TAU);
        ctx.fill();

        ctx.fillStyle = p.state === 'angry' ? '#5d6c82' : color;
        roundRect(p.x - 8, baseY - 9, 16, 22, 6);
        ctx.fill();

        ctx.fillStyle = 'rgba(8, 12, 18, .85)';
        ctx.font = '700 8px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.dest.key, p.x, baseY + 1.5);

        if (p.state === 'wait') {
            const wave = Math.sin(elapsed * 6 + p.bob) * 3;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x + 7, baseY - 4);
            ctx.lineTo(p.x + 13 + wave, baseY - 11);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawCar() {
        const x = car.x;
        const y = CAR_Y;

        const halo = ctx.createRadialGradient(x, y, 8, x, y, 76);
        halo.addColorStop(0, 'rgba(255, 226, 150, .18)');
        halo.addColorStop(1, 'rgba(255, 226, 150, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.ellipse(x, y, 76, 42, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = 'rgba(0, 0, 0, .45)';
        ctx.beginPath();
        ctx.ellipse(x, y + 24, 42, 7, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#0b1018';
        roundRect(x - 28, y - 27, 18, 8, 4);
        ctx.fill();
        roundRect(x + 10, y - 27, 18, 8, 4);
        ctx.fill();
        roundRect(x - 28, y + 19, 18, 8, 4);
        ctx.fill();
        roundRect(x + 10, y + 19, 18, 8, 4);
        ctx.fill();

        const body = ctx.createLinearGradient(0, y - 22, 0, y + 22);
        body.addColorStop(0, '#ffd873');
        body.addColorStop(1, '#e79c1c');
        ctx.fillStyle = body;
        roundRect(x - 42, y - 22, 84, 44, 14);
        ctx.fill();

        ctx.fillStyle = '#16202f';
        roundRect(x - 34, y - 15, 20, 30, 7);
        ctx.fill();
        roundRect(x + 14, y - 15, 20, 30, 7);
        ctx.fill();

        ctx.fillStyle = '#fff4c9';
        roundRect(x - 11, y - 7, 22, 14, 5);
        ctx.fill();
        ctx.fillStyle = '#1b2436';
        ctx.font = '700 7px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAXI', x, y + 0.5);

        ctx.fillStyle = 'rgba(255, 244, 201, .92)';
        roundRect(x + 34, y - 16, 8, 7, 3);
        ctx.fill();
        roundRect(x + 34, y + 9, 8, 7, 3);
        ctx.fill();

        ctx.fillStyle = '#ff5c6c';
        roundRect(x - 42, y - 16, 8, 7, 3);
        ctx.fill();
        roundRect(x - 42, y + 9, 8, 7, 3);
        ctx.fill();

        const count = car.riders.length;
        for (let i = 0; i < count; i++) {
            const rx = x - (count - 1) * 7.5 + i * 15;
            const ry = y - 34;
            ctx.fillStyle = car.riders[i].dest.color;
            ctx.beginPath();
            ctx.arc(rx, ry, 5.8, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#0b1018';
            ctx.font = '700 7.5px -apple-system, sans-serif';
            ctx.fillText(car.riders[i].dest.key, rx, ry + 0.5);
        }
    }

    function drawParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.6, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloaters() {
        ctx.font = '800 15px -apple-system, "PingFang SC", sans-serif';
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
        drawCity();
        drawRoad();
        drawLamps();
        drawStations();

        for (let i = 0; i < passengers.length; i++) {
            drawPassenger(passengers[i]);
        }

        drawCar();
        drawParticles();
        drawFloaters();

        if (hurtFlash > 0) {
            ctx.fillStyle = 'rgba(255, 70, 90, ' + (hurtFlash * 0.32) + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ---------- 主循环 ---------- */
    function update(dt) {
        elapsed += dt;
        roadOffset = (roadOffset + 70 * dt) % 46;
        if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - dt);

        let dir = 0;
        if (keys.left || keys.padLeft) dir -= 1;
        if (keys.right || keys.padRight) dir += 1;

        if (dir !== 0) {
            car.x += dir * CAR_SPEED * dt;
        } else if (dragX !== null) {
            car.x += (dragX - car.x) * Math.min(1, dt * 15);
        }
        car.x = clamp(car.x, 44, W - 44);

        spawnCd -= dt;
        if (spawnCd <= 0) {
            spawnPassenger();
            spawnCd = clamp(1.9 - elapsed * 0.035, 0.85, 2);
        }

        updatePassengers(dt);
        alight(dt);
        updateParticles(dt);
        updateFloaters(dt);

        if (combo > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) combo = 0;
        }

        updateHud();
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
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
            keys.left = true;
            e.preventDefault();
        } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
            keys.right = true;
            e.preventDefault();
        } else if (k === 'p' || k === 'P' || k === 'Escape') {
            togglePause();
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', function (e) {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    });

    function canvasX(clientX) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return W / 2;
        return (clientX - rect.left) * (W / rect.width);
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        dragX = canvasX(e.clientX);
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', function (e) {
        if (dragX === null) return;
        dragX = canvasX(e.clientX);
    });

    function endDrag() {
        dragX = null;
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    if (els.touchPad) {
        els.touchPad.addEventListener('pointerdown', function (e) {
            const btn = e.target.closest('[data-dir]');
            if (!btn) return;
            e.preventDefault();
            const dir = btn.getAttribute('data-dir');
            if (dir === 'pause') {
                togglePause();
            } else if (dir === 'left') {
                keys.padLeft = true;
            } else if (dir === 'right') {
                keys.padRight = true;
            }
        });

        const clearPad = function () {
            keys.padLeft = false;
            keys.padRight = false;
        };
        els.touchPad.addEventListener('pointerup', clearPad);
        els.touchPad.addEventListener('pointercancel', clearPad);
        els.touchPad.addEventListener('pointerleave', clearPad);
    }

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
    initBuildings();
    updateHud();
    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }
    requestAnimationFrame(frame);
})();
