/* ==========================================================
   一笔画 One Stroke
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const NODE_R = 11;
    const HIT = 26;               // 节点命中半径（比视觉半径大，便于拖动）
    const CLEAR_DELAY = 1.4;      // 过关后停留时长

    /* ---------- 关卡：每条边的两端点索引 ---------- */
    const LEVELS = [
        {
            name: '方框',
            nodes: [[140, 250], [340, 250], [340, 430], [140, 430]],
            edges: [[0, 1], [1, 2], [2, 3], [3, 0]]
        },
        {
            name: '屋顶',
            nodes: [[130, 440], [350, 440], [350, 270], [130, 270], [240, 170]],
            edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 2]]
        },
        {
            name: '五角星',
            nodes: [[240, 175], [378, 275], [326, 445], [154, 445], [102, 275]],
            edges: [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]]
        },
        {
            name: '蝴蝶结',
            nodes: [[150, 210], [330, 210], [240, 320], [150, 430], [330, 430]],
            edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 2], [2, 3]]
        },
        {
            name: '六点格',
            nodes: [[140, 265], [240, 265], [340, 265], [140, 415], [240, 415], [340, 415]],
            edges: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]]
        },
        {
            name: '风车',
            nodes: [[120, 215], [360, 215], [360, 470], [120, 470], [240, 342]],
            edges: [[0, 1], [1, 2], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]]
        },
        {
            name: '双三角',
            nodes: [[240, 165], [140, 270], [340, 270], [140, 430], [340, 430], [240, 500]],
            edges: [[0, 1], [0, 2], [1, 2], [3, 4], [3, 5], [4, 5], [2, 4]]
        },
        {
            name: '井格',
            nodes: [[140, 215], [240, 215], [340, 215],
                    [140, 330], [240, 330], [340, 330],
                    [140, 445], [240, 445], [340, 445]],
            edges: [[0, 1], [1, 2], [2, 5], [5, 8], [8, 7],
                    [7, 6], [6, 3], [3, 0], [1, 4], [4, 7]]
        }
    ];

    const BEST_LEVEL_KEY = 'webgames.onestroke.best-level';
    const BEST_TIME_KEY = 'webgames.onestroke.best-time';

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
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
            return parseFloat(window.localStorage.getItem(key)) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveNum(key, v) {
        try {
            window.localStorage.setItem(key, String(v));
        } catch (e) { /* 忽略隐私模式限制 */ }
    }

    function fmt(sec) {
        return (Math.round(sec * 10) / 10).toFixed(1);
    }

    /* ---------- 图数据预处理：度数 / 奇点 ---------- */
    for (let i = 0; i < LEVELS.length; i++) {
        const L = LEVELS[i];
        const deg = [];
        for (let n = 0; n < L.nodes.length; n++) deg.push(0);
        for (let e = 0; e < L.edges.length; e++) {
            deg[L.edges[e][0]]++;
            deg[L.edges[e][1]]++;
        }
        L.deg = deg;
        L.odd = [];
        for (let n = 0; n < deg.length; n++) {
            if (deg[n] % 2 === 1) L.odd.push(n);
        }
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        level: document.getElementById('level'),
        edges: document.getElementById('edges'),
        drawn: document.getElementById('drawn'),
        time: document.getElementById('time'),
        bestLevel: document.getElementById('best-level'),
        bestTime: document.getElementById('best-time'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 状态 ---------- */
    let state = 'ready';          // ready | play | clear | over
    let level = 0;
    let used = [];
    let path = [];
    let cur = -1;                 // 当前笔尖所在节点，-1 表示还没落笔
    let drawCount = 0;
    let drag = false;
    let pointer = { x: 0, y: 0 };
    let elapsed = 0;
    let levelTime = 0;
    let clearT = 0;
    let clock = 0;
    let shake = 0;
    let msg = '';
    let msgT = 0;
    let banner = null;
    let hudCache = '';
    const fx = [];

    let bestLevel = Math.round(loadNum(BEST_LEVEL_KEY));
    let bestTime = loadNum(BEST_TIME_KEY);

    /* ---------- 关卡装载 ---------- */
    function buildLevel(i) {
        level = i;
        const L = LEVELS[i];
        used = [];
        for (let e = 0; e < L.edges.length; e++) used.push(false);
        path = [];
        cur = -1;
        drawCount = 0;
        drag = false;
        levelTime = 0;
        clearT = 0;
        shake = 0;
        msg = '';
        msgT = 0;
        banner = null;
        fx.length = 0;
        hudCache = '';
        updateHud();
    }

    function startGame() {
        elapsed = 0;
        buildLevel(0);
        state = 'play';
        els.overlay.classList.remove('show');
    }

    function restartLevel() {
        if (state !== 'play') {
            startGame();
            return;
        }
        buildLevel(level);
        state = 'play';
    }

    function gameOver() {
        state = 'over';
        if (bestTime === 0 || elapsed < bestTime) {
            bestTime = elapsed;
            saveNum(BEST_TIME_KEY, bestTime);
        }
        els.ovTitle.textContent = '全部通关';
        els.ovDesc.textContent = '八个图形全部一笔画完。试试用更少的重开次数、更短的时间再走一遍。';
        els.ovScore.innerHTML = '总用时 <b>' + fmt(elapsed) + '</b> 秒 · 最佳 ' + fmt(bestTime) + ' 秒';
        els.ovBtn.textContent = '再玩一次';
        els.overlay.classList.add('show');
        updateHud();
    }

    function levelClear() {
        state = 'clear';
        clearT = 0;
        const L = LEVELS[level];
        const lv = level + 1;
        if (lv > bestLevel) {
            bestLevel = lv;
            saveNum(BEST_LEVEL_KEY, bestLevel);
        }
        for (let n = 0; n < L.nodes.length; n++) {
            burst(L.nodes[n][0], L.nodes[n][1], 7, 150, 0.75);
        }
        banner = {
            title: '过关',
            sub: '第 ' + lv + ' 关 · ' + L.name + ' · ' + fmt(levelTime) + ' 秒',
            t: 0,
            max: CLEAR_DELAY
        };
        updateHud();
    }

    function advance() {
        if (level + 1 >= LEVELS.length) {
            gameOver();
            return;
        }
        buildLevel(level + 1);
        state = 'play';
    }

    /* ---------- 连边 ---------- */
    function nodeAt(x, y) {
        const L = LEVELS[level];
        let best = -1;
        let bestD = HIT;
        for (let i = 0; i < L.nodes.length; i++) {
            const d = Math.hypot(x - L.nodes[i][0], y - L.nodes[i][1]);
            if (d <= bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    function edgeIndex(a, b) {
        const L = LEVELS[level];
        for (let e = 0; e < L.edges.length; e++) {
            const edge = L.edges[e];
            if ((edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a)) return e;
        }
        return -1;
    }

    // 有奇点时只能从奇点起步，否则任意点都行（欧拉回路的性质）
    function canStart(n) {
        const L = LEVELS[level];
        if (!L.odd.length) return true;
        return L.odd.indexOf(n) >= 0;
    }

    function hasMove(n) {
        const L = LEVELS[level];
        for (let e = 0; e < L.edges.length; e++) {
            if (used[e]) continue;
            if (L.edges[e][0] === n || L.edges[e][1] === n) return true;
        }
        return false;
    }

    function tryLink(n, quiet) {
        if (n < 0 || n === cur) return;
        const e = edgeIndex(cur, n);
        if (e < 0) {
            if (!quiet) {
                msg = '这两个点之间没有线';
                msgT = 1.3;
                shake = 1;
            }
            return;
        }
        if (used[e]) {
            if (!quiet) {
                msg = '这条线已经画过了';
                msgT = 1.3;
                shake = 1;
            }
            return;
        }

        const L = LEVELS[level];
        used[e] = true;
        drawCount++;
        const a = L.nodes[cur];
        const b = L.nodes[n];
        burst((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 6, 120, 0.45);
        path.push(n);
        cur = n;
        msg = '';
        msgT = 0;

        if (drawCount === L.edges.length) {
            levelClear();
        } else if (!hasMove(cur)) {
            msg = '走进死路了 · Z 撤销 / R 重开';
            msgT = 999;
            shake = 1;
        }
        updateHud();
    }

    function undo() {
        if (state !== 'play' || path.length < 2) return;
        const last = path.pop();
        const prev = path[path.length - 1];
        const e = edgeIndex(prev, last);
        if (e >= 0 && used[e]) {
            used[e] = false;
            drawCount--;
        }
        cur = prev;
        msg = '';
        msgT = 0;
        updateHud();
    }

    /* ---------- 粒子 ---------- */
    function burst(x, y, n, speed, life) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const s = speed * (0.35 + Math.random() * 0.75);
            fx.push({
                x: x,
                y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                t: 0,
                max: life * (0.6 + Math.random() * 0.7),
                r: 1.2 + Math.random() * 1.8
            });
        }
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (state === 'play') {
            elapsed += dt;
            levelTime += dt;
        } else if (state === 'clear') {
            elapsed += dt;
            clearT += dt;
        }

        if (msgT > 0) msgT -= dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 3.6);

        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.t += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            if (p.t > p.max) fx.splice(i, 1);
        }

        if (banner) {
            banner.t += dt;
            if (banner.t > banner.max) banner = null;
        }

        if (state === 'clear' && clearT > CLEAR_DELAY) advance();

        updateHud();
    }

    function updateHud() {
        const key = [level, drawCount, state, Math.floor(elapsed * 10)].join('|');
        if (key === hudCache) return;
        hudCache = key;
        const L = LEVELS[level];
        els.level.textContent = (level + 1) + ' / ' + LEVELS.length;
        els.edges.textContent = String(L.edges.length);
        els.drawn.textContent = String(drawCount);
        els.time.textContent = fmt(elapsed) + ' 秒';
        els.bestLevel.textContent = String(bestLevel);
        els.bestTime.textContent = bestTime > 0 ? fmt(bestTime) + ' 秒' : '—';
    }

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#080e1a');
        g.addColorStop(0.55, '#0a1424');
        g.addColorStop(1, '#060a12');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 326, 40, W / 2, 326, 320);
        halo.addColorStop(0, 'rgba(52, 206, 184, .13)');
        halo.addColorStop(0.5, 'rgba(56, 126, 200, .07)');
        halo.addColorStop(1, 'rgba(20, 40, 70, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 96, W, H - 96);

        // 点阵底纹
        ctx.save();
        ctx.fillStyle = 'rgba(112, 160, 210, .07)';
        for (let x = 50; x <= 430; x += 28) {
            for (let y = 126; y <= 522; y += 28) {
                ctx.beginPath();
                ctx.arc(x, y, 1.1, 0, TAU);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawEdges() {
        const L = LEVELS[level];
        ctx.save();
        ctx.lineCap = 'round';

        // 未画：暗线
        for (let e = 0; e < L.edges.length; e++) {
            if (used[e]) continue;
            const a = L.nodes[L.edges[e][0]];
            const b = L.nodes[L.edges[e][1]];
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.strokeStyle = 'rgba(116, 150, 194, .22)';
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.strokeStyle = 'rgba(154, 196, 236, .09)';
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }

        // 已画：发光线
        ctx.shadowColor = 'rgba(84, 226, 196, .5)';
        ctx.shadowBlur = 13;
        for (let e = 0; e < L.edges.length; e++) {
            if (!used[e]) continue;
            const a = L.nodes[L.edges[e][0]];
            const b = L.nodes[L.edges[e][1]];
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.strokeStyle = 'rgba(80, 222, 190, .86)';
            ctx.lineWidth = 4.4;
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        for (let e = 0; e < L.edges.length; e++) {
            if (!used[e]) continue;
            const a = L.nodes[L.edges[e][0]];
            const b = L.nodes[L.edges[e][1]];
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.strokeStyle = 'rgba(228, 255, 249, .88)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawTrail() {
        if (!drag || cur < 0 || state !== 'play') return;
        const p = LEVELS[level].nodes[cur];
        const d = Math.hypot(pointer.x - p[0], pointer.y - p[1]);
        if (d < NODE_R + 3) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.strokeStyle = 'rgba(126, 240, 212, .3)';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.setLineDash([6, 7]);
        ctx.lineDashOffset = -clock * 26;
        ctx.stroke();
        ctx.restore();
    }

    function drawNodes() {
        const L = LEVELS[level];
        const hint = state === 'play' && cur < 0;
        const pulse = 0.5 + 0.5 * Math.sin(clock * 4);

        for (let n = 0; n < L.nodes.length; n++) {
            const p = L.nodes[n];
            const isCur = n === cur;
            const visited = path.indexOf(n) >= 0;

            // 起步点呼吸圈
            if (hint && canStart(n)) {
                ctx.beginPath();
                ctx.arc(p[0], p[1], NODE_R + 7 + pulse * 5, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 198, 108, ' + (0.18 + pulse * 0.32) + ')';
                ctx.lineWidth = 1.6;
                ctx.stroke();
            }

            if (isCur) {
                ctx.beginPath();
                ctx.arc(p[0], p[1], NODE_R + 8 + pulse * 3.4, 0, TAU);
                ctx.fillStyle = 'rgba(86, 232, 200, .15)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(p[0], p[1], NODE_R, 0, TAU);
            if (isCur) {
                const g = ctx.createRadialGradient(p[0] - 3.4, p[1] - 4, 1.5, p[0], p[1], NODE_R);
                g.addColorStop(0, '#e2fff8');
                g.addColorStop(0.5, '#4fe0bf');
                g.addColorStop(1, '#0f7d68');
                ctx.fillStyle = g;
            } else if (visited) {
                ctx.fillStyle = 'rgba(44, 138, 120, .92)';
            } else {
                ctx.fillStyle = '#0c1624';
            }
            ctx.fill();

            ctx.lineWidth = 2;
            if (isCur) {
                ctx.strokeStyle = 'rgba(196, 255, 242, .95)';
            } else if (visited) {
                ctx.strokeStyle = 'rgba(108, 226, 200, .6)';
            } else {
                ctx.strokeStyle = 'rgba(140, 176, 220, .44)';
            }
            ctx.stroke();

            // 奇点小标记
            if (L.odd.length && !isCur && !visited && L.odd.indexOf(n) >= 0) {
                ctx.beginPath();
                ctx.arc(p[0], p[1], 3, 0, TAU);
                ctx.fillStyle = 'rgba(255, 198, 108, .85)';
                ctx.fill();
            }
        }
    }

    function drawFx() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const k = 1 - p.t / p.max;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.9), 0, TAU);
            ctx.fillStyle = 'rgba(130, 244, 214, ' + (k * 0.6).toFixed(3) + ')';
            ctx.fill();
        }
        ctx.restore();
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(140, 190, 202, .48)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('ONE STROKE', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#e9f7f4';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('一笔画', W / 2, 49);

        // 进度条
        const L = LEVELS[level];
        const total = L.edges.length;
        const k = total ? drawCount / total : 0;
        const bx = 96;
        const bw = W - 192;
        const by = 66;
        const bh = 4;
        roundRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.fillStyle = 'rgba(110, 150, 190, .2)';
        ctx.fill();
        if (k > 0) {
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            g.addColorStop(0, 'rgba(66, 208, 188, .9)');
            g.addColorStop(1, 'rgba(154, 240, 190, .95)');
            roundRectPath(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(148, 180, 206, .62)';
        ctx.fillText('第 ' + (level + 1) + ' / ' + LEVELS.length + ' 关 · ' + L.name +
            ' · ' + drawCount + ' / ' + total + ' 条边', W / 2, 88);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (msg && msgT > 0) {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(255, 198, 150, .95)';
            ctx.fillText(msg, W / 2, 562);
        } else {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(158, 196, 216, .66)';
            ctx.fillText('按住拖动连线 · 每条线只能画一次', W / 2, 562);
        }
        ctx.restore();
    }

    function drawLevelDots() {
        const n = LEVELS.length;
        const gap = 18;
        const x0 = W / 2 - (n - 1) * gap / 2;
        const y = 524;
        for (let i = 0; i < n; i++) {
            const now = i === level;
            const done = i < level;
            ctx.beginPath();
            ctx.arc(x0 + i * gap, y, now ? 4 : 3, 0, TAU);
            if (now) {
                ctx.fillStyle = 'rgba(126, 244, 214, .95)';
                ctx.shadowColor = 'rgba(96, 232, 200, .8)';
                ctx.shadowBlur = 10;
            } else if (done) {
                ctx.fillStyle = 'rgba(72, 186, 164, .72)';
            } else {
                ctx.fillStyle = 'rgba(120, 152, 190, .28)';
            }
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function drawBanner() {
        if (!banner) return;
        const fade = Math.min(1, (banner.max - banner.t) * 6);
        const a = banner.t < 0.4 ? banner.t / 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = a * fade;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cy = 318;
        const g = ctx.createLinearGradient(56, 0, W - 56, 0);
        g.addColorStop(0, 'rgba(6, 16, 26, 0)');
        g.addColorStop(0.5, 'rgba(6, 16, 26, .92)');
        g.addColorStop(1, 'rgba(6, 16, 26, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(46, cy - 52, W - 92, 104);

        ctx.fillStyle = '#a6f4dc';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, cy - 13);

        ctx.fillStyle = 'rgba(178, 224, 214, .82)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, cy + 21);
        ctx.restore();
    }

    function draw() {
        drawBg();

        ctx.save();
        if (shake > 0) ctx.translate(Math.sin(clock * 72) * shake * 3, 0);
        drawEdges();
        drawTrail();
        drawNodes();
        drawFx();
        ctx.restore();

        drawHeader();
        drawLevelDots();
        drawFooter();
        drawBanner();
    }

    /* ---------- 输入 ---------- */
    function toLocal(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const p = toLocal(e);
        pointer.x = p.x;
        pointer.y = p.y;
        if (state !== 'play') return;
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (err) { /* headless 环境可能不支持 */ }

        const n = nodeAt(p.x, p.y);
        if (n < 0) return;

        if (cur < 0) {
            if (!canStart(n)) {
                msg = '从这里起步会走不通 · 选发光的点';
                msgT = 1.8;
                shake = 1;
                return;
            }
            cur = n;
            path = [n];
            drag = true;
            burst(p.x, p.y, 9, 140, 0.5);
            updateHud();
            return;
        }

        drag = true;
        tryLink(n, false);
    });

    canvas.addEventListener('pointermove', function (e) {
        const p = toLocal(e);
        pointer.x = p.x;
        pointer.y = p.y;
        if (state !== 'play' || !drag || cur < 0) return;
        const n = nodeAt(p.x, p.y);
        if (n >= 0) tryLink(n, true);
    });

    function endDrag() {
        drag = false;
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            restartLevel();
        } else if (e.code === 'KeyZ' || e.code === 'Backspace') {
            e.preventDefault();
            undo();
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', function () {
        startGame();
    });

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

    buildLevel(0);
    updateHud();
    requestAnimationFrame(loop);
})();
