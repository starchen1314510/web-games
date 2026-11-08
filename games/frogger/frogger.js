/* ==========================================================
   青蛙过河 Frogger
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const CELL = 40;
    const COLS = 12;
    const TOP = 44;
    const ROWS = 13;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const HOME_COLS = [1, 3, 5, 7, 9];
    const RIVER_ROWS = [1, 2, 3, 4, 5];
    const ROAD_ROWS = [7, 8, 9, 10, 11];
    const START_ROW = 12;

    const SCORE_KEY = 'webgames.frogger.best';

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

    const LANE_CONF = [
        { row: 1, kind: 'log', speed: 42, gap: 150, off: 0, units: 3 },
        { row: 2, kind: 'turtle', speed: -58, gap: 132, off: 220, units: 2 },
        { row: 3, kind: 'log', speed: 66, gap: 176, off: 90, units: 4 },
        { row: 4, kind: 'turtle', speed: -50, gap: 140, off: 320, units: 3 },
        { row: 5, kind: 'log', speed: 74, gap: 168, off: 40, units: 2 },
        { row: 7, kind: 'car', speed: -104, gap: 158, off: 60, units: 1, color: '#ff7a8a' },
        { row: 8, kind: 'car', speed: 128, gap: 172, off: 240, units: 1, color: '#ffd166' },
        { row: 9, kind: 'truck', speed: -78, gap: 208, off: 120, units: 2, color: '#8fa8c8' },
        { row: 10, kind: 'car', speed: 152, gap: 186, off: 330, units: 1, color: '#7ee0b8' },
        { row: 11, kind: 'car', speed: -116, gap: 164, off: 200, units: 1, color: '#c9a6ff' }
    ];

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        lives: document.getElementById('lives'),
        homes: document.getElementById('homes'),
        level: document.getElementById('level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let lanes = [];
    let homes = [];
    let frog = {
        x: 0, y: 0,
        hopping: false,
        hopT: 0,
        from: { x: 0, y: 0 },
        to: { x: 0, y: 0 },
        face: 0,
        blink: 0
    };
    let score = 0;
    let best = Number(localStorage.getItem(SCORE_KEY) || 0);
    let lives = 3;
    let level = 1;
    let state = 'ready';
    let deadTimer = 0;
    let deadCause = '';
    let hopCooldown = 0;
    let lastRow = START_ROW;
    let particles = [];
    let texts = [];
    let clock = 0;
    let hudCache = '';
    let carLight = 0;

    /* ---------- 初始化 ---------- */
    function cellX(col) {
        return (col + 0.5) * CELL;
    }

    function cellY(row) {
        return TOP + (row + 0.5) * CELL;
    }

    function rowOfY(y) {
        return clamp(Math.round((y - TOP) / CELL - 0.5), 0, ROWS - 1);
    }

    function colOfX(x) {
        return clamp(Math.round(x / CELL - 0.5), 0, COLS - 1);
    }

    function buildLanes() {
        lanes = [];
        for (let i = 0; i < LANE_CONF.length; i++) {
            const c = LANE_CONF[i];
            const items = [];
            const unitW = c.kind === 'log' ? CELL * c.units * 0.92
                : (c.kind === 'turtle' ? CELL * c.units * 0.78 : CELL * c.units * 0.9);
            let x = c.off;
            for (let k = 0; k < 4; k++) {
                items.push({ x: x, w: unitW, alive: true, seed: Math.random() * 10 });
                x += unitW + c.gap;
            }
            lanes.push({
                row: c.row,
                kind: c.kind,
                speed: c.speed * (1 + (level - 1) * 0.1),
                units: c.units,
                color: c.color || '#6fbf8a',
                items: items
            });
        }
    }

    function resetHomes() {
        homes = HOME_COLS.map(function (col) {
            return { col: col, filled: false };
        });
    }

    function resetFrog() {
        frog.x = cellX(Math.floor(COLS / 2));
        frog.y = cellY(START_ROW);
        frog.hopping = false;
        frog.hopT = 0;
        frog.face = 0;
        lastRow = START_ROW;
    }

    function startGame() {
        score = 0;
        lives = 3;
        level = 1;
        deadTimer = 0;
        particles = [];
        texts = [];
        resetHomes();
        buildLanes();
        resetFrog();
        state = 'playing';
        hudCache = '';
        hideOverlay();
        updateHud();
    }

    function levelUp() {
        level += 1;
        score += 200;
        texts.push({ x: W / 2, y: H / 2, text: '过关！第 ' + level + ' 关', life: 1.8, max: 1.8, size: 24 });
        resetHomes();
        buildLanes();
        resetFrog();
        state = 'playing';
        updateHud();
    }

    function gameOver() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(SCORE_KEY, String(best));
        }
        els.ovTitle.textContent = '青蛙阵亡';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '这一局你拿到 ' + score + ' 分，闯到第 ' + level + ' 关。';
        els.ovScore.innerHTML = '最高分 <b>' + best + '</b>';
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function updateHud() {
        const filled = homes.filter(function (h) { return h.filled; }).length;
        const key = score + '|' + lives + '|' + filled + '|' + level + '|' + state;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.lives.textContent = lives > 0 ? '♥'.repeat(lives) : '—';
        els.homes.textContent = filled + ' / ' + HOME_COLS.length;
        els.level.textContent = String(level);
    }

    /* ---------- 死亡 ---------- */
    function kill(cause) {
        if (deadTimer > 0) return;
        deadCause = cause;
        deadTimer = 0.95;
        lives -= 1;
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * TAU;
            const sp = rand(40, 140);
            particles.push({
                x: frog.x,
                y: frog.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                life: rand(0.4, 0.9),
                max: 0.9,
                r: rand(1.4, 3),
                color: cause === 'water' ? '#6fc8ff' : '#ff7a8a'
            });
        }
        texts.push({
            x: frog.x,
            y: frog.y - 20,
            text: cause === 'water' ? '落水' : (cause === 'car' ? '被撞' : '撞到边界'),
            life: 0.9,
            max: 0.9,
            size: 15
        });
        updateHud();
    }

    /* ---------- 跳跃 ---------- */
    function tryMove(dcol, drow) {
        if (state !== 'playing' || frog.hopping || deadTimer > 0 || hopCooldown > 0) return;
        const col = clamp(colOfX(frog.x) + dcol, 0, COLS - 1);
        const row = clamp(rowOfY(frog.y) + drow, 0, ROWS - 1);

        frog.hopping = true;
        frog.hopT = 0;
        frog.from = { x: frog.x, y: frog.y };
        frog.to = { x: cellX(col), y: cellY(row) };
        frog.face = drow < 0 ? 0 : (drow > 0 ? 2 : (dcol > 0 ? 1 : 3));
        hopCooldown = 0.06;
    }

    function arrive() {
        const row = rowOfY(frog.y);
        if (row > lastRow) {
            score += 2;
        } else if (row < lastRow) {
            score += 10;
        }
        lastRow = row;

        if (row === 0) {
            const col = colOfX(frog.x);
            const home = homes.filter(function (h) { return h.col === col; })[0];
            if (home && !home.filled) {
                home.filled = true;
                score += 60;
                texts.push({ x: frog.x, y: cellY(0) + 22, text: '+60', life: 0.9, max: 0.9, size: 16 });
                for (let i = 0; i < 14; i++) {
                    const a = Math.random() * TAU;
                    const sp = rand(50, 150);
                    particles.push({
                        x: frog.x, y: frog.y,
                        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                        life: rand(0.5, 1), max: 1, r: rand(1.4, 2.8), color: '#ffe08a'
                    });
                }
                if (homes.every(function (h) { return h.filled; })) {
                    levelUp();
                    return;
                }
                resetFrog();
            } else {
                kill('edge');
                return;
            }
        }
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function moveLanes(dt) {
        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            for (let k = 0; k < lane.items.length; k++) {
                const it = lane.items[k];
                it.x += lane.speed * dt;
                if (lane.speed > 0 && it.x > W + 80) {
                    it.x = -it.w - rand(10, 120);
                } else if (lane.speed < 0 && it.x + it.w < -80) {
                    it.x = W + rand(10, 120);
                }
            }
        }
    }

    function laneByRow(row) {
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i].row === row) return lanes[i];
        }
        return null;
    }

    function isRiver(row) {
        return RIVER_ROWS.indexOf(row) >= 0;
    }

    function isRoad(row) {
        return ROAD_ROWS.indexOf(row) >= 0;
    }

    function carrierAt(lane, x, y) {
        const halfW = CELL * 0.34;
        for (let i = 0; i < lane.items.length; i++) {
            const it = lane.items[i];
            const cx = clamp(x, it.x, it.x + it.w);
            if (Math.abs(cx - x) < halfW && Math.abs(y - cellY(lane.row)) < CELL * 0.42) {
                return it;
            }
        }
        return null;
    }

    function carAt(lane, x, y) {
        const halfW = CELL * 0.26;
        for (let i = 0; i < lane.items.length; i++) {
            const it = lane.items[i];
            if (x + halfW > it.x + 3 && x - halfW < it.x + it.w - 3 &&
                Math.abs(y - cellY(lane.row)) < CELL * 0.4) {
                return it;
            }
        }
        return null;
    }

    function update(dt) {
        clock += dt;
        carLight += dt * 3;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 160 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 26 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }

        if (state !== 'playing') {
            moveLanes(dt * 0.6);
            return;
        }

        moveLanes(dt);

        if (hopCooldown > 0) hopCooldown -= dt;

        if (deadTimer > 0) {
            deadTimer -= dt;
            if (deadTimer <= 0) {
                if (lives <= 0) {
                    gameOver();
                } else {
                    resetFrog();
                    frog.blink = 0.6;
                }
            }
            return;
        }

        if (frog.hopping) {
            frog.hopT += dt / 0.15;
            if (frog.hopT >= 1) {
                frog.hopT = 1;
                frog.hopping = false;
                frog.x = frog.to.x;
                frog.y = frog.to.y;
                arrive();
            } else {
                const k = frog.hopT;
                frog.x = frog.from.x + (frog.to.x - frog.from.x) * k;
                frog.y = frog.from.y + (frog.to.y - frog.from.y) * k;
            }
            return;
        }

        if (frog.blink > 0) frog.blink -= dt;

        const row = rowOfY(frog.y);
        if (isRiver(row)) {
            const lane = laneByRow(row);
            const carrier = lane ? carrierAt(lane, frog.x, frog.y) : null;
            if (!carrier) {
                kill('water');
                return;
            }
            frog.x += lane.speed * dt;
            if (frog.x < CELL * 0.45 || frog.x > W - CELL * 0.45) {
                kill('water');
            }
        } else if (isRoad(row)) {
            const lane = laneByRow(row);
            if (lane && carAt(lane, frog.x, frog.y)) {
                kill('car');
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawField() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0e2233');
        g.addColorStop(0.55, '#0a1a29');
        g.addColorStop(1, '#0d2432');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (let r = 0; r < ROWS; r++) {
            const y = TOP + r * CELL;
            if (r === 0) {
                ctx.fillStyle = '#12452c';
            } else if (isRiver(r)) {
                ctx.fillStyle = (r % 2 === 0) ? '#123a52' : '#0f3448';
            } else if (r === 6) {
                ctx.fillStyle = '#1a4a30';
            } else if (isRoad(r)) {
                ctx.fillStyle = (r % 2 === 0) ? '#1d2430' : '#191f2a';
            } else {
                ctx.fillStyle = '#143d27';
            }
            ctx.fillRect(0, y, W, CELL);
        }

        ctx.save();
        ctx.strokeStyle = 'rgba(190, 225, 255, .07)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= ROWS; r++) {
            const y = TOP + r * CELL + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(220, 235, 255, .16)';
        ctx.lineWidth = 2;
        ctx.setLineDash([16, 18]);
        for (let i = 0; i < ROAD_ROWS.length; i++) {
            const r = ROAD_ROWS[i];
            if (i === ROAD_ROWS.length - 1) break;
            const y = TOP + (r + 1) * CELL;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(150, 220, 180, .22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, TOP + CELL);
        ctx.lineTo(W, TOP + CELL);
        ctx.moveTo(0, TOP + 7 * CELL);
        ctx.lineTo(W, TOP + 7 * CELL);
        ctx.stroke();
        ctx.restore();
    }

    function drawHomes() {
        for (let i = 0; i < homes.length; i++) {
            const h = homes[i];
            const x = cellX(h.col);
            const y = cellY(0);
            ctx.save();
            ctx.fillStyle = h.filled ? 'rgba(126, 224, 184, .28)' : 'rgba(4, 22, 14, .62)';
            ctx.beginPath();
            ctx.arc(x, y, CELL * 0.38, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = h.filled ? 'rgba(126, 224, 184, .8)' : 'rgba(120, 190, 155, .32)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            if (h.filled) {
                drawFrog(x, y, 0.72, 0, false);
            }
            ctx.restore();
        }
    }

    function drawLogs(lane) {
        for (let i = 0; i < lane.items.length; i++) {
            const it = lane.items[i];
            const y = cellY(lane.row);
            const h = CELL * 0.62;
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, .28)';
            roundRect(it.x + 2, y - h / 2 + 3, it.w, h, 8);
            ctx.fill();
            const g = ctx.createLinearGradient(it.x, y - h / 2, it.x, y + h / 2);
            g.addColorStop(0, '#9c7346');
            g.addColorStop(0.5, '#845c34');
            g.addColorStop(1, '#63431f');
            ctx.fillStyle = g;
            roundRect(it.x, y - h / 2, it.w, h, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(230, 200, 150, .3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 0.22;
            ctx.strokeStyle = '#3a2410';
            for (let k = 1; k < lane.units * 2; k++) {
                const lx = it.x + it.w * k / (lane.units * 2);
                ctx.beginPath();
                ctx.moveTo(lx, y - h / 2 + 3);
                ctx.lineTo(lx, y + h / 2 - 3);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    function drawTurtles(lane) {
        for (let i = 0; i < lane.items.length; i++) {
            const it = lane.items[i];
            const y = cellY(lane.row);
            const n = lane.units;
            const step = it.w / n;
            for (let k = 0; k < n; k++) {
                const cx = it.x + step * (k + 0.5);
                const bob = Math.sin(clock * 2.2 + it.seed + k) * 1.2;
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, .25)';
                ctx.beginPath();
                ctx.ellipse(cx + 1, y + 3, step * 0.42, CELL * 0.24, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = k === 0 ? '#3f7d55' : '#4b9063';
                ctx.beginPath();
                ctx.ellipse(cx, y + bob, step * 0.42, CELL * 0.26, 0, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(180, 235, 195, .34)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = '#356b48';
                ctx.beginPath();
                ctx.ellipse(cx, y + bob, step * 0.18, CELL * 0.14, 0, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    function drawCars(lane) {
        for (let i = 0; i < lane.items.length; i++) {
            const it = lane.items[i];
            const y = cellY(lane.row);
            const h = CELL * 0.66;
            const truck = lane.kind === 'truck';
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, .32)';
            roundRect(it.x + 2, y - h / 2 + 3, it.w, h, 7);
            ctx.fill();

            const g = ctx.createLinearGradient(it.x, y - h / 2, it.x, y + h / 2);
            g.addColorStop(0, lane.color);
            g.addColorStop(1, 'rgba(0, 0, 0, .35)');
            ctx.fillStyle = g;
            roundRect(it.x, y - h / 2, it.w, h, 7);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, .22)';
            ctx.lineWidth = 1;
            ctx.stroke();

            const dir = lane.speed > 0 ? 1 : -1;
            const front = dir > 0 ? it.x + it.w - 12 : it.x + 4;
            ctx.fillStyle = 'rgba(14, 24, 34, .6)';
            roundRect(front, y - h / 3, 8, h / 1.5, 3);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 246, 200, ' + (0.6 + Math.sin(carLight + i) * 0.2).toFixed(2) + ')';
            ctx.beginPath();
            const lx = dir > 0 ? it.x + it.w - 3 : it.x + 3;
            ctx.arc(lx, y - h / 4, 1.8, 0, TAU);
            ctx.arc(lx, y + h / 4, 1.8, 0, TAU);
            ctx.fill();

            if (truck) {
                ctx.globalAlpha = 0.32;
                ctx.strokeStyle = '#0b1420';
                ctx.lineWidth = 1.4;
                for (let k = 1; k < 3; k++) {
                    const lx2 = it.x + it.w * k / 3;
                    ctx.beginPath();
                    ctx.moveTo(lx2, y - h / 2 + 2);
                    ctx.lineTo(lx2, y + h / 2 - 2);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }

    function drawFrog(x, y, scale, face, alive) {
        const s = scale || 1;
        const r = CELL * 0.32 * s;
        ctx.save();
        ctx.translate(x, y);
        if (!alive) ctx.globalAlpha = 0.5;

        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        ctx.beginPath();
        ctx.ellipse(1.5 * s, r * 0.72, r * 0.92, r * 0.44, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#5ed17e';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.92, r * 0.78, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 60, 35, .6)';
        ctx.lineWidth = 1.2 * s;
        ctx.stroke();

        ctx.fillStyle = '#4aba68';
        const legD = face === 0 ? 1 : (face === 2 ? -1 : 0);
        ctx.beginPath();
        ctx.ellipse(-r * 0.86, r * 0.42 * legD, r * 0.4, r * 0.24, -0.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.86, r * 0.42 * legD, r * 0.4, r * 0.24, 0.5, 0, TAU);
        ctx.fill();

        const ex = r * 0.42;
        const ey = face === 0 ? -r * 0.5 : (face === 2 ? r * 0.42 : -r * 0.26);
        ctx.fillStyle = '#f4fbff';
        ctx.beginPath();
        ctx.arc(-ex, ey, r * 0.3, 0, TAU);
        ctx.arc(ex, ey, r * 0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#15241c';
        ctx.beginPath();
        ctx.arc(-ex + (face === 1 ? r * 0.1 : 0), ey - (face === 0 ? r * 0.08 : 0), r * 0.15, 0, TAU);
        ctx.arc(ex + (face === 1 ? r * 0.1 : 0), ey - (face === 0 ? r * 0.08 : 0), r * 0.15, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawParticles() {
        ctx.save();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = 'rgba(232, 250, 238, .96)';
            ctx.font = '700 ' + t.size + 'px ' + FONT;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawTopBar() {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, TOP);
        g.addColorStop(0, 'rgba(9, 20, 30, .96)');
        g.addColorStop(1, 'rgba(9, 20, 30, .72)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, TOP);

        ctx.textBaseline = 'middle';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = 'rgba(190, 228, 214, .72)';
        ctx.textAlign = 'left';
        ctx.fillText('得分', 16, TOP / 2);
        ctx.fillStyle = '#e6f6ee';
        ctx.font = '800 18px ' + FONT;
        ctx.fillText(String(score), 52, TOP / 2 + 1);

        ctx.textAlign = 'center';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = 'rgba(255, 128, 140, .92)';
        ctx.fillText(lives > 0 ? '♥ '.repeat(lives).trim() : '—', W / 2, TOP / 2);

        ctx.textAlign = 'right';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = 'rgba(190, 228, 214, .72)';
        ctx.fillText('第 ' + level + ' 关', W - 16, TOP / 2);
        ctx.restore();
    }

    function drawBottomTip() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = 'rgba(150, 190, 175, .48)';
        ctx.fillText('方向键 / WASD 移动 · 触屏滑动', W / 2, TOP + ROWS * CELL + 18);
        ctx.restore();
    }

    function render() {
        drawField();
        drawHomes();
        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            if (lane.kind === 'log') drawLogs(lane);
            else if (lane.kind === 'turtle') drawTurtles(lane);
            else drawCars(lane);
        }

        const dead = deadTimer > 0;
        const blinkHide = frog.blink > 0 && Math.floor(frog.blink * 14) % 2 === 0;
        if (!blinkHide) {
            if (dead && deadCause === 'water') {
                ctx.save();
                ctx.globalAlpha = clamp(deadTimer / 0.95, 0, 1) * 0.8;
                ctx.strokeStyle = '#6fc8ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(frog.x, frog.y, (1 - deadTimer / 0.95) * 22 + 8, 0, TAU);
                ctx.stroke();
                ctx.restore();
            } else {
                drawFrog(frog.x, frog.y, 1, frog.face, !dead);
            }
        }

        drawParticles();
        drawTopBar();
        drawBottomTip();
        drawTexts();
    }

    /* ---------- 循环 ---------- */
    let last = performance.now();

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        render();
        window.requestAnimationFrame(loop);
    }

    /* ---------- 交互 ---------- */
    let swipe = null;

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        swipe = {
            x: (e.clientX - r.left) * (W / r.width),
            y: (e.clientY - r.top) * (H / r.height)
        };
    });

    canvas.addEventListener('pointerup', function (e) {
        if (!swipe) return;
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width);
        const y = (e.clientY - r.top) * (H / r.height);
        const dx = x - swipe.x;
        const dy = y - swipe.y;
        swipe = null;
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            tryMove(dx > 0 ? 1 : -1, 0);
        } else {
            tryMove(0, dy > 0 ? 1 : -1);
        }
    });

    canvas.addEventListener('pointercancel', function () {
        swipe = null;
    });

    window.addEventListener('keydown', function (e) {
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') { tryMove(-1, 0); e.preventDefault(); }
        else if (k === 'arrowright' || k === 'd') { tryMove(1, 0); e.preventDefault(); }
        else if (k === 'arrowup' || k === 'w') { tryMove(0, -1); e.preventDefault(); }
        else if (k === 'arrowdown' || k === 's') { tryMove(0, 1); e.preventDefault(); }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 启动 ---------- */
    resetHomes();
    buildLanes();
    resetFrog();
    updateHud();
    els.ovTitle.textContent = '青蛙过河';
    els.ovTitle.classList.remove('danger');
    els.ovDesc.textContent = '躲开车流，踩着木板和乌龟过河，把青蛙送进上方 5 个家。' +
        '方向键或滑动移动，落水、被撞都会掉一条命。';
    els.ovScore.innerHTML = '最高分 <b>' + best + '</b>';
    els.ovBtn.textContent = '开始过河';
    els.overlay.classList.add('show');
    window.requestAnimationFrame(loop);
})();
