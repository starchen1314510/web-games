/* ==========================================================
   水管工 Pipes —— 旋转管道，把水引到每一个格子
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const FIELD = 384;
    const GRID_X = 48;
    const GRID_Y = 124;

    const WINS_KEY = 'webgames.plumber.wins';
    const TURNS_KEY = 'webgames.plumber.turns';

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
        level: document.getElementById('level'),
        moves: document.getElementById('moves'),
        filled: document.getElementById('filled'),
        wins: document.getElementById('wins'),
        turns: document.getElementById('turns'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* 方向位：1 北 / 2 东 / 4 南 / 8 西 */
    const BITS = [1, 2, 4, 8];
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const OPP = [4, 8, 1, 2];

    let level = 1;
    let n = 5;
    let cell = FIELD / n;
    let sol = [];
    let masks = [];
    let watered = [];
    let pulses = [];
    let state = 'ready';
    let clock = 0;
    let moves = 0;
    let filled = 0;
    let total = 25;
    let banner = null;
    let hudCache = '';

    /* ---------- 生成 ---------- */
    function rot(m, k) {
        for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15;
        return m;
    }

    /** 随机深度优先生成一张覆盖全部格子的连通图，每格即为该格的管道 */
    function genMaze(size) {
        const conn = new Array(size * size).fill(0);
        const seen = new Array(size * size).fill(false);
        const stack = [0];
        seen[0] = true;

        while (stack.length) {
            const cur = stack[stack.length - 1];
            const r = (cur / size) | 0;
            const c = cur % size;
            const opts = [];

            if (r > 0 && !seen[cur - size]) opts.push([cur - size, 1, 4]);
            if (c < size - 1 && !seen[cur + 1]) opts.push([cur + 1, 2, 8]);
            if (r < size - 1 && !seen[cur + size]) opts.push([cur + size, 4, 1]);
            if (c > 0 && !seen[cur - 1]) opts.push([cur - 1, 8, 2]);

            if (!opts.length) {
                stack.pop();
                continue;
            }
            const pick = opts[(Math.random() * opts.length) | 0];
            conn[cur] |= pick[1];
            conn[pick[0]] |= pick[2];
            seen[pick[0]] = true;
            stack.push(pick[0]);
        }
        return conn;
    }

    /** 从左上角注水，返回已接通的格子数 */
    function computeWater() {
        watered = new Array(n * n).fill(false);
        const stack = [0];
        watered[0] = true;
        let cnt = 1;

        while (stack.length) {
            const cur = stack.pop();
            const r = (cur / n) | 0;
            const c = cur % n;
            for (let d = 0; d < 4; d++) {
                if (!(masks[cur] & BITS[d])) continue;
                // DIRS 是屏幕坐标 [dx, dy]，换成行列增量
                const nr = r + DIRS[d][1];
                const nc = c + DIRS[d][0];
                if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
                const nb = nr * n + nc;
                if (watered[nb]) continue;
                if (!(masks[nb] & OPP[d])) continue;
                watered[nb] = true;
                cnt++;
                stack.push(nb);
            }
        }
        return cnt;
    }

    function build() {
        n = level <= 2 ? 5 : 6;
        cell = FIELD / n;
        total = n * n;

        sol = genMaze(n);
        masks = sol.slice();
        for (let i = 0; i < total; i++) {
            if (Math.random() < 0.62) masks[i] = rot(masks[i], 1 + ((Math.random() * 3) | 0));
        }

        ensureFlow(Math.max(4, Math.round(total * 0.3)));
        // 万一开局就已经全通，随机拧开一格，避免不点就过关
        let guard = 0;
        while (computeWater() >= total && guard < 20) {
            masks[(Math.random() * total) | 0] = rot(masks[(Math.random() * total) | 0], 1);
            guard++;
        }

        pulses = new Array(total).fill(0);
        moves = 0;
        filled = computeWater();
        hudCache = '';
    }

    /** 沿解路径逐步打通，保证开局就有一段水流 */
    function ensureFlow(target) {
        let guard = 0;
        while (computeWater() < target && guard < 90) {
            guard++;
            const cand = [];
            for (let i = 0; i < total; i++) {
                if (!watered[i]) continue;
                const r = (i / n) | 0;
                const c = i % n;
                for (let d = 0; d < 4; d++) {
                    if (!(sol[i] & BITS[d])) continue;
                    const nr = r + DIRS[d][1];
                    const nc = c + DIRS[d][0];
                    if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
                    const nb = nr * n + nc;
                    if (watered[nb]) continue;
                    cand.push([i, nb]);
                }
            }
            if (!cand.length) break;
            const pick = cand[(Math.random() * cand.length) | 0];
            masks[pick[0]] = sol[pick[0]];
            masks[pick[1]] = sol[pick[1]];
        }
    }

    function startGame() {
        level = 1;
        banner = null;
        state = 'playing';
        build();
        els.overlay.classList.remove('show');
        updateHud();
    }

    function nextLevel() {
        level++;
        build();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function updateHud() {
        const key = [level, moves, filled, total, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.level.textContent = String(level);
        els.moves.textContent = String(moves);
        els.filled.textContent = filled + ' / ' + total;
        els.wins.textContent = String(Number(localStorage.getItem(WINS_KEY) || 0));
        els.turns.textContent = String(Number(localStorage.getItem(TURNS_KEY) || 0));
    }

    /* ---------- 交互 ---------- */
    function tapCell(idx) {
        if (state !== 'playing') return;
        masks[idx] = rot(masks[idx], 1);
        pulses[idx] = 1;
        moves++;
        filled = computeWater();
        hudCache = '';

        if (filled >= total) {
            finish();
            return;
        }
        updateHud();
    }

    function finish() {
        state = 'advance';
        const wins = Number(localStorage.getItem(WINS_KEY) || 0) + 1;
        localStorage.setItem(WINS_KEY, String(wins));
        const turns = Number(localStorage.getItem(TURNS_KEY) || 0) + moves;
        localStorage.setItem(TURNS_KEY, String(turns));

        banner = {
            t: 1.5,
            max: 1.5,
            title: '第 ' + level + ' 关 · 全线贯通',
            sub: '转动 ' + moves + ' 次'
        };
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = 0; i < pulses.length; i++) {
            if (pulses[i] > 0) pulses[i] = Math.max(0, pulses[i] - dt * 5);
        }

        if (banner) {
            banner.t -= dt;
            if (banner.t <= 0) {
                banner = null;
                if (state === 'advance') nextLevel();
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .46)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('PIPES', W / 2, 26);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('水管工', W / 2, 52);

        const g = ctx.createLinearGradient(120, 0, W - 120, 0);
        g.addColorStop(0, 'rgba(110, 152, 200, 0)');
        g.addColorStop(0.5, 'rgba(110, 200, 235, .34)');
        g.addColorStop(1, 'rgba(110, 152, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(120, 76, W - 240, 1);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = filled >= total ? 'rgba(96, 228, 255, .95)' : 'rgba(140, 180, 215, .52)';
        ctx.fillText('第 ' + level + ' 关 · 已接通 ' + filled + ' / ' + total, W / 2, 100);
        ctx.restore();
    }

    function drawCell(idx) {
        const r = (idx / n) | 0;
        const c = idx % n;
        const x = GRID_X + c * cell;
        const y = GRID_Y + r * cell;
        const on = watered[idx];
        const m = masks[idx];
        const p = pulses[idx];
        const half = cell / 2;
        const lw = cell * 0.2;

        roundRectPath(ctx, x + 2, y + 2, cell - 4, cell - 4, 8);
        ctx.fillStyle = on ? 'rgba(15, 42, 62, .92)' : 'rgba(12, 23, 37, .92)';
        ctx.fill();
        ctx.strokeStyle = on ? 'rgba(72, 202, 246, .32)' : 'rgba(72, 106, 144, .2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        ctx.translate(x + half, y + half);
        if (p > 0) ctx.scale(1 + p * 0.07, 1 + p * 0.07);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 管壁底色
        ctx.strokeStyle = on ? 'rgba(3, 26, 40, .95)' : 'rgba(5, 12, 21, .95)';
        ctx.lineWidth = lw + 4.5;
        for (let d = 0; d < 4; d++) {
            if (!(m & BITS[d])) continue;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(DIRS[d][0] * half, DIRS[d][1] * half);
            ctx.stroke();
        }

        // 管身
        if (on) {
            ctx.shadowColor = 'rgba(72, 200, 245, .8)';
            ctx.shadowBlur = 11;
        }
        const pg = ctx.createLinearGradient(-half, -half, half, half);
        if (on) {
            pg.addColorStop(0, '#7ceaff');
            pg.addColorStop(1, '#2fb4e4');
        } else {
            pg.addColorStop(0, '#5c7c9c');
            pg.addColorStop(1, '#3f5a74');
        }
        ctx.strokeStyle = pg;
        ctx.lineWidth = lw;
        for (let d = 0; d < 4; d++) {
            if (!(m & BITS[d])) continue;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(DIRS[d][0] * half, DIRS[d][1] * half);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // 中央接头
        ctx.beginPath();
        ctx.arc(0, 0, lw * 0.62, 0, TAU);
        ctx.fillStyle = on ? '#8ef2ff' : '#4c6a88';
        ctx.fill();

        // 水流虚线
        if (on) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, .5)';
            ctx.lineWidth = Math.max(2, lw * 0.3);
            ctx.setLineDash([cell * 0.14, cell * 0.2]);
            ctx.lineDashOffset = -clock * 46;
            for (let d = 0; d < 4; d++) {
                if (!(m & BITS[d])) continue;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(DIRS[d][0] * half, DIRS[d][1] * half);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 水源标记
        if (idx === 0) {
            const k = 0.5 + 0.5 * Math.sin(clock * 3.2);
            ctx.beginPath();
            ctx.arc(0, 0, lw * 0.62 + 4 + k * 3, 0, TAU);
            ctx.strokeStyle = 'rgba(140, 240, 255, ' + (0.2 + k * 0.4) + ')';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 10px ' + FONT;
        ctx.fillStyle = 'rgba(138, 166, 198, .34)';
        ctx.fillText('点击管道旋转 90°，把水送到每一个格子', W / 2, 552);
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const k = Math.min(1, (banner.max - banner.t) * 6);
        const alpha = banner.t < 0.4 ? banner.t / 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = alpha * k;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cy = GRID_Y + FIELD / 2;
        const g = ctx.createLinearGradient(GRID_X, 0, GRID_X + FIELD, 0);
        g.addColorStop(0, 'rgba(6, 20, 32, 0)');
        g.addColorStop(0.5, 'rgba(6, 20, 32, .88)');
        g.addColorStop(1, 'rgba(6, 20, 32, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(GRID_X, cy - 52, FIELD, 104);

        ctx.fillStyle = '#9cf6ff';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, cy - 12);

        ctx.fillStyle = 'rgba(170, 214, 238, .78)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, cy + 20);
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#071019');
        g.addColorStop(0.5, '#081521');
        g.addColorStop(1, '#060e17');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 320);
        halo.addColorStop(0, 'rgba(36, 120, 170, .16)');
        halo.addColorStop(1, 'rgba(36, 120, 170, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 90, W, H - 90);

        for (let i = 0; i < total; i++) drawCell(i);

        drawHeader();
        drawFooter();
        drawBanner();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - GRID_X) / cell);
        const r = Math.floor((y - GRID_Y) / cell);
        if (c < 0 || c >= n || r < 0 || r >= n) return;
        tapCell(r * n + c);
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

    build();
    updateHud();
    requestAnimationFrame(loop);
})();
