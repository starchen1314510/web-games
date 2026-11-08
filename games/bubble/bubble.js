/* ==========================================================
   泡泡龙 Bubble Shooter
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 620;
    const TAU = Math.PI * 2;

    const R = 23;
    const D = R * 2;
    const ROW_H = D * 0.866;
    const COLS = 10;
    const MX = (W - COLS * D) / 2;
    const TOP = 16;
    const MAX_ROWS = 10;
    const DEATH_Y = 420;
    const SHOOTER = { x: W / 2, y: H - 56 };
    const SPEED = 980;
    const KINDS = 5;
    const BEST_KEY = 'webgames.bubble.best';

    const TINT = [
        { main: '#ff5c6c', light: '#ffa8b2', dark: '#a92636' },
        { main: '#4f8cff', light: '#a6c4ff', dark: '#234f9e' },
        { main: '#2fd48b', light: '#93f2c8', dark: '#178052' },
        { main: '#ffc548', light: '#ffe89f', dark: '#ab7c14' },
        { main: '#9d5bff', light: '#c9a6ff', dark: '#5e2cab' }
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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        level: document.getElementById('level'),
        left: document.getElementById('left'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let grid = [];
    let shot = null;
    let falling = [];
    let bits = [];
    let anims = [];
    let texts = [];

    let score = 0;
    let level = 1;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let state = 'ready';
    let overReason = '';
    let aim = -Math.PI / 2;
    let aiming = false;
    let current = 0;
    let next = 0;
    let bob = 0;
    let shake = 0;
    let hudCache = '';
    let cleared = 0;
    let clearTimer = 0;

    /* ---------- 网格 ---------- */
    function colsInRow(r) {
        return r % 2 === 0 ? COLS : COLS - 1;
    }

    function cellX(r, c) {
        return MX + R + c * D + (r % 2 ? R : 0);
    }

    function cellY(r) {
        return TOP + R + r * ROW_H;
    }

    function inGrid(r, c) {
        return r >= 0 && r < MAX_ROWS && c >= 0 && c < colsInRow(r);
    }

    function neighborsOf(r, c) {
        const odd = r % 2 === 1;
        const offs = odd
            ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
            : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
        const out = [];
        for (let i = 0; i < offs.length; i++) {
            const nr = r + offs[i][0];
            const nc = c + offs[i][1];
            if (inGrid(nr, nc)) out.push([nr, nc]);
        }
        return out;
    }

    function countBubbles() {
        let n = 0;
        for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                if (grid[r][c]) n++;
            }
        }
        return n;
    }

    function activeColors() {
        const set = [];
        for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                const b = grid[r][c];
                if (b && set.indexOf(b.color) < 0) set.push(b.color);
            }
        }
        return set;
    }

    function pickColor() {
        const pool = activeColors();
        if (!pool.length) return Math.floor(Math.random() * KINDS);
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function makeGrid(rows) {
        grid = [];
        for (let r = 0; r < MAX_ROWS; r++) {
            grid.push(new Array(colsInRow(r)).fill(null));
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                grid[r][c] = { color: Math.floor(Math.random() * KINDS), pop: 0 };
            }
        }
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const left = countBubbles();
        const key = score + '|' + level + '|' + left + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.level.textContent = String(level);
        els.left.textContent = String(left);
        els.best.textContent = String(best);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '泡泡龙';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '移动鼠标瞄准，点击发射。三颗以上同色泡泡相连就会爆开，' +
                '打掉支撑后脱离顶部的泡泡会整串掉落。泡泡压到红线就结束了。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始游戏';
        } else {
            els.ovTitle.textContent = '泡泡触底了';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '清掉了 ' + cleared + ' 颗泡泡，坚持到第 ' + level +
                ' 关，得分 ' + score + '。';
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
    function resetRun() {
        score = 0;
        level = 1;
        cleared = 0;
        best = Number(localStorage.getItem(BEST_KEY) || 0);
        startLevel(1);
    }

    function startLevel(lv) {
        level = lv;
        makeGrid(Math.min(MAX_ROWS - 2, 4 + lv));
        shot = null;
        falling = [];
        bits = [];
        anims = [];
        texts = [];
        shake = 0;
        current = pickColor();
        next = pickColor();
        aim = -Math.PI / 2;
        state = 'playing';
        hideOverlay();
        updateHud();
    }

    function begin() {
        resetRun();
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

    /* ---------- 发射 ---------- */
    function fire() {
        if (state !== 'playing' || shot) return;
        const b = {
            x: SHOOTER.x,
            y: SHOOTER.y - 6,
            vx: Math.cos(aim) * SPEED,
            vy: Math.sin(aim) * SPEED,
            color: current,
            r: R
        };
        shot = b;
        current = next;
        next = pickColor();
        updateHud();
    }

    function addScore(v) {
        score += v;
        updateHud();
    }

    /* ---------- 吸附 ---------- */
    function bestCell(x, y) {
        let bestR = -1;
        let bestC = -1;
        let bestD = Infinity;
        for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                if (grid[r][c]) continue;
                let attached = r === 0;
                if (!attached) {
                    const nb = neighborsOf(r, c);
                    for (let i = 0; i < nb.length; i++) {
                        if (grid[nb[i][0]][nb[i][1]]) { attached = true; break; }
                    }
                }
                if (!attached) continue;
                const dx = cellX(r, c) - x;
                const dy = cellY(r) - y;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; bestR = r; bestC = c; }
            }
        }
        return bestR < 0 ? null : { r: bestR, c: bestC };
    }

    function place(r, c, color) {
        grid[r][c] = { color: color, pop: 0 };
        anims.push({ r: r, c: c, t: 0, dur: 0.22 });
        updateHud();

        const group = sameGroup(r, c);
        if (group.length >= 3) {
            popGroup(group);
        }
        dropFloating();

        if (countBubbles() === 0) {
            addScore(150);
            texts.push({ x: W / 2, y: H / 2, text: '第 ' + level + ' 关通过', life: 1.6, max: 1.6, size: 26 });
            level += 1;
            clearTimer = 1.1;
            state = 'clearing';
            return;
        }
        checkDeath();
    }

    function sameGroup(r0, c0) {
        const color = grid[r0][c0].color;
        const seen = {};
        const out = [];
        const stack = [[r0, c0]];
        seen[r0 + ',' + c0] = true;
        while (stack.length) {
            const cur = stack.pop();
            out.push(cur);
            const nb = neighborsOf(cur[0], cur[1]);
            for (let i = 0; i < nb.length; i++) {
                const nr = nb[i][0];
                const nc = nb[i][1];
                const k = nr + ',' + nc;
                if (seen[k]) continue;
                const b = grid[nr][nc];
                if (!b || b.color !== color) continue;
                seen[k] = true;
                stack.push([nr, nc]);
            }
        }
        return out;
    }

    function popGroup(group) {
        const n = group.length;
        let gain = n * 8;
        if (n > 3) gain += (n - 3) * 6;
        if (n >= 5) {
            texts.push({ x: cellX(group[0][0], group[0][1]), y: cellY(group[0][0]) - 10, text: '连爆 ×' + n, life: 1.1, max: 1.1, size: 18 });
        }
        for (let i = 0; i < n; i++) {
            const r = group[i][0];
            const c = group[i][1];
            const b = grid[r][c];
            if (!b) continue;
            burst(cellX(r, c), cellY(r), b.color);
            grid[r][c] = null;
        }
        cleared += n;
        addScore(gain);
        shake = Math.min(1, 0.18 + n * 0.05);
    }

    function dropFloating() {
        const seen = {};
        const stack = [];
        for (let c = 0; c < colsInRow(0); c++) {
            if (grid[0][c]) {
                seen['0,' + c] = true;
                stack.push([0, c]);
            }
        }
        while (stack.length) {
            const cur = stack.pop();
            const nb = neighborsOf(cur[0], cur[1]);
            for (let i = 0; i < nb.length; i++) {
                const nr = nb[i][0];
                const nc = nb[i][1];
                const k = nr + ',' + nc;
                if (seen[k] || !grid[nr][nc]) continue;
                seen[k] = true;
                stack.push([nr, nc]);
            }
        }
        let dropCount = 0;
        for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                if (!grid[r][c] || seen[r + ',' + c]) continue;
                const b = grid[r][c];
                falling.push({
                    x: cellX(r, c),
                    y: cellY(r),
                    vx: rand(-60, 60),
                    vy: rand(-160, -40),
                    color: b.color,
                    r: R,
                    rot: rand(0, TAU),
                    vrot: rand(-4, 4),
                    life: 1.4
                });
                grid[r][c] = null;
                dropCount += 1;
            }
        }
        if (dropCount > 0) {
            cleared += dropCount;
            const gain = dropCount * 14;
            addScore(gain);
            texts.push({ x: W / 2, y: DEATH_Y - 60, text: '掉落 +' + gain, life: 1.2, max: 1.2, size: 20 });
            shake = Math.min(1, shake + 0.2);
        }
    }

    function checkDeath() {
        for (let r = MAX_ROWS - 1; r >= 0; r--) {
            for (let c = 0; c < colsInRow(r); c++) {
                if (grid[r][c] && cellY(r) + R > DEATH_Y) {
                    endGame();
                    return;
                }
            }
        }
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, color) {
        const t = TINT[color] || TINT[0];
        for (let i = 0; i < 8; i++) {
            const a = rand(0, TAU);
            const sp = rand(40, 220);
            bits.push({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 60,
                r: rand(1.8, 4.6),
                life: rand(0.3, 0.7),
                max: 0.7,
                color: Math.random() < 0.5 ? t.main : t.light
            });
        }
    }

    /* ---------- 更新 ---------- */
    function updateAim(x, y) {
        let a = Math.atan2(y - SHOOTER.y, x - SHOOTER.x);
        if (a > 0) a = a > Math.PI / 2 ? -Math.PI + 0.3 : -0.3;
        aim = clamp(a, -Math.PI + 0.3, -0.3);
    }

    function collideGrid(b) {
        for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                if (!grid[r][c]) continue;
                const dx = b.x - cellX(r, c);
                const dy = b.y - cellY(r);
                if (dx * dx + dy * dy < (D - 3) * (D - 3)) return true;
            }
        }
        return false;
    }

    function updateShot(dt) {
        if (!shot) return;
        const total = Math.hypot(shot.vx, shot.vy) * dt;
        const steps = Math.max(1, Math.ceil(total / 5));
        const sx = shot.vx * dt / steps;
        const sy = shot.vy * dt / steps;
        for (let i = 0; i < steps; i++) {
            shot.x += sx;
            shot.y += sy;
            if (shot.x - R < 1) { shot.x = 1 + R; shot.vx = Math.abs(shot.vx); }
            if (shot.x + R > W - 1) { shot.x = W - 1 - R; shot.vx = -Math.abs(shot.vx); }
            if (shot.y - R <= TOP) {
                shot.y = TOP + R;
                const cell = bestCell(shot.x, shot.y);
                const color = shot.color;
                shot = null;
                if (cell) place(cell.r, cell.c, color);
                return;
            }
            if (collideGrid(shot)) {
                const cell = bestCell(shot.x, shot.y);
                const color = shot.color;
                shot = null;
                if (cell) place(cell.r, cell.c, color);
                return;
            }
        }
    }

    function updateFalling(dt) {
        for (let i = falling.length - 1; i >= 0; i--) {
            const f = falling[i];
            f.vy += 1400 * dt;
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.rot += f.vrot * dt;
            f.life -= dt;
            if (f.y - f.r > H + 40 || f.life <= 0) falling.splice(i, 1);
        }
    }

    function updateBits(dt) {
        for (let i = bits.length - 1; i >= 0; i--) {
            const b = bits[i];
            b.vy += 900 * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) bits.splice(i, 1);
        }
    }

    function updateTexts(dt) {
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 34 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }
    }

    function updateAnims(dt) {
        for (let i = anims.length - 1; i >= 0; i--) {
            const a = anims[i];
            a.t += dt;
            if (a.t >= a.dur) anims.splice(i, 1);
        }
    }

    function update(dt) {
        bob += dt;
        if (state === 'clearing') {
            clearTimer -= dt;
            if (clearTimer <= 0) startLevel(level);
        }
        updateShot(dt);
        updateFalling(dt);
        updateBits(dt);
        updateTexts(dt);
        updateAnims(dt);
        if (shake > 0) shake = Math.max(0, shake - dt * 3);
    }

    /* ---------- 绘制 ---------- */
    function drawBubble(x, y, color, scale) {
        const t = TINT[color] || TINT[0];
        const rr = R * (scale || 1);
        const g = ctx.createRadialGradient(x - rr * 0.34, y - rr * 0.38, rr * 0.12, x, y, rr);
        g.addColorStop(0, t.light);
        g.addColorStop(0.55, t.main);
        g.addColorStop(1, t.dark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, .22)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, rr - 1, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, .55)';
        ctx.beginPath();
        ctx.ellipse(x - rr * 0.32, y - rr * 0.38, rr * 0.26, rr * 0.16, -0.6, 0, TAU);
        ctx.fill();
    }

    function drawBackground() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#101a2e');
        g.addColorStop(0.5, '#0c1322');
        g.addColorStop(1, '#131c2f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, -40, 30, W / 2, -40, 320);
        glow.addColorStop(0, 'rgba(79, 140, 255, .18)');
        glow.addColorStop(1, 'rgba(79, 140, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, 320);

        ctx.fillStyle = 'rgba(255, 255, 255, .03)';
        for (let i = 0; i < 22; i++) {
            const x = (i * 127) % W;
            const y = (i * 233) % H;
            ctx.beginPath();
            ctx.arc(x, y, 1.3, 0, TAU);
            ctx.fill();
        }
    }

    function drawGrid() {
        for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < colsInRow(r); c++) {
                const b = grid[r][c];
                if (!b) continue;
                let sc = 1;
                for (let i = 0; i < anims.length; i++) {
                    const a = anims[i];
                    if (a.r === r && a.c === c) {
                        const k = a.t / a.dur;
                        sc = 1 + Math.sin(k * Math.PI) * 0.16;
                    }
                }
                drawBubble(cellX(r, c), cellY(r), b.color, sc);
            }
        }
    }

    function drawDeathLine() {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 92, 108, .45)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(0, DEATH_Y);
        ctx.lineTo(W, DEATH_Y);
        ctx.stroke();
        ctx.restore();
    }

    function drawAim() {
        if (state !== 'playing' || shot) return;
        let x = SHOOTER.x;
        let y = SHOOTER.y - 6;
        let dx = Math.cos(aim);
        let dy = Math.sin(aim);
        let left = 4;
        ctx.save();
        ctx.strokeStyle = 'rgba(170, 210, 255, .55)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        let guard = 0;
        while (left > 0 && guard < 900) {
            guard += 1;
            const tx = dx > 0 ? (W - 1 - R - x) / dx : (1 + R - x) / dx;
            const ty = dy < 0 ? (TOP + R - y) / dy : 99999;
            const t = Math.min(tx > 0 ? tx : 99999, ty > 0 ? ty : 99999, 620);
            const nx = x + dx * t;
            const ny = y + dy * t;
            const hitBubble = (function () {
                for (let rr = 0; rr < MAX_ROWS; rr++) {
                    for (let cc = 0; cc < colsInRow(rr); cc++) {
                        if (!grid[rr][cc]) continue;
                        const ddx = nx - cellX(rr, cc);
                        const ddy = ny - cellY(rr);
                        if (ddx * ddx + ddy * ddy < D * D) return true;
                    }
                }
                return false;
            })();
            if (hitBubble) {
                ctx.lineTo(nx, ny);
                left = 0;
                break;
            }
            ctx.lineTo(nx, ny);
            x = nx;
            y = ny;
            if (ty <= tx && dy < 0) { left = 0; break; }
            dx = -dx;
            left -= 1;
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawShooter() {
        ctx.save();
        const baseY = SHOOTER.y + 8;
        ctx.fillStyle = 'rgba(255, 255, 255, .06)';
        ctx.beginPath();
        ctx.ellipse(SHOOTER.x, baseY + 14, 44, 12, 0, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = 'rgba(120, 170, 255, .30)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(SHOOTER.x, SHOOTER.y, R + 6, 0, TAU);
        ctx.stroke();

        if (!shot) {
            drawBubble(SHOOTER.x, SHOOTER.y + Math.sin(bob * 3) * 1.6, current, 1);
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.font = '600 11px -apple-system, "PingFang SC", sans-serif';
        ctx.fillStyle = 'rgba(147, 163, 186, .9)';
        ctx.textAlign = 'center';
        ctx.fillText('下一颗', W - 54, H - 70);
        drawBubble(W - 54, H - 44, next, 0.72);
        ctx.restore();
    }

    function drawFalling() {
        for (let i = 0; i < falling.length; i++) {
            const f = falling[i];
            ctx.save();
            ctx.globalAlpha = clamp(f.life / 0.6, 0, 1);
            drawBubble(f.x, f.y, f.color, 1);
            ctx.restore();
        }
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
            ctx.fillStyle = 'rgba(255, 232, 160, .95)';
            ctx.font = '800 ' + t.size + 'px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function render() {
        ctx.save();
        if (shake > 0) {
            ctx.translate(rand(-1, 1) * shake * 7, rand(-1, 1) * shake * 7);
        }
        drawBackground();
        drawDeathLine();
        drawGrid();
        drawFalling();
        drawAim();
        if (shot) drawBubble(shot.x, shot.y, shot.color, 1);
        drawShooter();
        drawBits();
        drawTexts();
        ctx.restore();
    }

    /* ---------- 循环 ---------- */
    let last = performance.now();

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (state === 'playing' || state === 'clearing') update(dt);
        else {
            bob += dt;
            updateBits(dt);
            updateTexts(dt);
        }
        render();
        window.requestAnimationFrame(loop);
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

    canvas.addEventListener('pointermove', function (e) {
        if (state !== 'playing') return;
        if (e.pointerType === 'mouse' || aiming) updateAim(pos(e).x, pos(e).y);
    });

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        aiming = true;
        updateAim(pos(e).x, pos(e).y);
    });

    function releaseAt(x, y) {
        if (state !== 'playing') { aiming = false; return; }
        if (aiming) {
            updateAim(x, y);
            fire();
        }
        aiming = false;
    }

    canvas.addEventListener('pointerup', function (e) {
        const p = pos(e);
        releaseAt(p.x, p.y);
    });

    window.addEventListener('pointercancel', function () {
        aiming = false;
    });

    window.addEventListener('keydown', function (e) {
        if (e.key === 'r' || e.key === 'R') {
            begin();
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            aim = clamp(aim - 0.06, -Math.PI + 0.3, -0.3);
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            aim = clamp(aim + 0.06, -Math.PI + 0.3, -0.3);
            e.preventDefault();
        } else if (e.key === ' ' || e.key === 'Enter') {
            fire();
            e.preventDefault();
        }
    });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    makeGrid(5);
    current = pickColor();
    next = pickColor();
    updateHud();
    showOverlay('ready');
    window.requestAnimationFrame(loop);
})();
