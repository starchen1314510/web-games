/* ==========================================================
   数桥 Hashi
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const LAT = 5;
    const SP = 96;
    const OX = 48;
    const OY = 92;
    const ISL_R = 17;

    const ISL_N = { easy: 11, normal: 16, hard: 21 };
    const DIFF_NAME = { easy: '11 岛', normal: '16 岛', hard: '21 岛' };

    const COL_OK = '#5ef2b0';
    const COL_BAD = '#ff7b8a';
    const COL_IDLE = '#8fb6d6';

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function roundRectPath(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.lineTo(x + w - rr, y);
        c.arcTo(x + w, y, x + w, y + rr, rr);
        c.lineTo(x + w, y + h - rr);
        c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
        c.lineTo(x + rr, y + h);
        c.arcTo(x, y + h, x, y + h - rr, rr);
        c.lineTo(x, y + rr);
        c.arcTo(x, y, x + rr, y, rr);
        c.closePath();
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        done: document.getElementById('done'),
        moves: document.getElementById('moves'),
        time: document.getElementById('time'),
        best: document.getElementById('best-time'),
        level: document.getElementById('level'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let islands = [];
    let nbrs = [];
    let bridges = {};
    let sel = -1;
    let state = 'ready';       // ready | play | over
    let diff = 'normal';
    let elapsed = 0;
    let timeShown = -1;
    let msg = '';
    let msgT = 0;
    let pulse = 0;
    let hudCache = '';
    let bestTime = -1;
    let resultText = '';

    function keyOf(a, b) {
        return a < b ? a + '|' + b : b + '|' + a;
    }

    function sumOf(idx) {
        const list = nbrs[idx];
        let s = 0;
        for (let i = 0; i < list.length; i++) s += bridges[keyOf(idx, list[i])] || 0;
        return s;
    }

    function totalBridges() {
        let n = 0;
        const keys = Object.keys(bridges);
        for (let i = 0; i < keys.length; i++) n += bridges[keys[i]];
        return n;
    }

    function okCount() {
        let n = 0;
        for (let i = 0; i < islands.length; i++) {
            if (sumOf(i) === islands[i].num) n++;
        }
        return n;
    }

    /* ---GEN-START--- */
    /* 先在 5×5 点阵上取一棵随机生成树，再剪掉若干叶子，最后给每条边分配 1~2 条桥 */
    function generate(target) {
        const total = LAT * LAT;
        const visited = [];
        const mark = new Array(total).fill(false);
        const edges = [];
        const start = Math.floor(Math.random() * total);
        mark[start] = true;
        visited.push(start);

        const frontier = [];
        function pushFrontier(id) {
            const i = id % LAT;
            const j = Math.floor(id / LAT);
            const d = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (let k = 0; k < 4; k++) {
                const ni = i + d[k][0];
                const nj = j + d[k][1];
                if (ni < 0 || ni >= LAT || nj < 0 || nj >= LAT) continue;
                const nid = nj * LAT + ni;
                if (mark[nid]) continue;
                frontier.push({ a: id, b: nid });
            }
        }
        pushFrontier(start);

        while (frontier.length) {
            const idx = Math.floor(Math.random() * frontier.length);
            const e = frontier.splice(idx, 1)[0];
            if (mark[e.b]) continue;
            mark[e.b] = true;
            visited.push(e.b);
            edges.push({ a: e.a, b: e.b, m: 1 });
            pushFrontier(e.b);
        }

        /* 剪叶子（叶子不会断开连通性） */
        function degree(id) {
            let d = 0;
            for (let i = 0; i < edges.length; i++) {
                if (edges[i].a === id || edges[i].b === id) d++;
            }
            return d;
        }
        while (visited.length > target) {
            const leaves = [];
            for (let i = 0; i < visited.length; i++) {
                if (degree(visited[i]) <= 1) leaves.push(visited[i]);
            }
            if (!leaves.length) break;
            const id = leaves[Math.floor(Math.random() * leaves.length)];
            for (let i = edges.length - 1; i >= 0; i--) {
                if (edges[i].a === id || edges[i].b === id) edges.splice(i, 1);
            }
            const vi = visited.indexOf(id);
            if (vi >= 0) visited.splice(vi, 1);
        }

        /* 每条边 1 或 2 条桥，单岛桥数不超过 6 */
        const deg = {};
        for (let i = 0; i < visited.length; i++) deg[visited[i]] = 0;
        for (let i = 0; i < edges.length; i++) {
            deg[edges[i].a]++;
            deg[edges[i].b]++;
        }
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            if (deg[e.a] < 6 && deg[e.b] < 6 && Math.random() < 0.45) {
                e.m = 2;
                deg[e.a]++;
                deg[e.b]++;
            }
        }

        const order = visited.slice();
        const list = [];
        for (let i = 0; i < order.length; i++) {
            const id = order[i];
            list.push({
                i: id % LAT,
                j: Math.floor(id / LAT),
                x: OX + (id % LAT) * SP,
                y: OY + Math.floor(id / LAT) * SP,
                num: deg[id]
            });
        }
        islands = list;
    }
    /* ---GEN-END--- */

    function buildNeighbors() {
        nbrs = islands.map(function () {
            return [];
        });
        for (let a = 0; a < islands.length; a++) {
            for (let b = a + 1; b < islands.length; b++) {
                const da = Math.abs(islands[a].i - islands[b].i);
                const db = Math.abs(islands[a].j - islands[b].j);
                if (da + db === 1) {
                    nbrs[a].push(b);
                    nbrs[b].push(a);
                }
            }
        }
    }

    function newPuzzle() {
        generate(ISL_N[diff]);
        buildNeighbors();
        bridges = {};
        sel = -1;
        elapsed = 0;
        timeShown = -1;
        msg = '';
        msgT = 0;
        resultText = '';
        bestTime = localStorage.getItem('webgames.bridges.best.' + diff) === null
            ? -1 : Number(localStorage.getItem('webgames.bridges.best.' + diff));
        hudCache = '';
        updateHud();
    }

    function startGame() {
        newPuzzle();
        state = 'play';
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        hudCache = '';
        updateHud();
    }

    /* ---------- 判定 ---------- */

    function connected() {
        if (!islands.length) return false;
        const seen = new Array(islands.length).fill(false);
        const queue = [0];
        seen[0] = true;
        let n = 1;
        while (queue.length) {
            const cur = queue.shift();
            const list = nbrs[cur];
            for (let i = 0; i < list.length; i++) {
                const nx = list[i];
                if (seen[nx]) continue;
                if (!(bridges[keyOf(cur, nx)] > 0)) continue;
                seen[nx] = true;
                n++;
                queue.push(nx);
            }
        }
        return n === islands.length;
    }

    function checkWin() {
        if (okCount() !== islands.length) return false;
        return connected();
    }

    function finish() {
        state = 'over';
        resultText = '解开了';
        const sec = Math.floor(elapsed);
        let extra = '';
        if (bestTime < 0 || sec < bestTime) {
            bestTime = sec;
            localStorage.setItem('webgames.bridges.best.' + diff, String(sec));
            extra = ' 刷新了最快纪录！';
        }
        els.ovTitle.textContent = '全部连通';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = islands.length + ' 座岛用了 ' + totalBridges() +
            ' 条桥全部接上，耗时 ' + fmt(elapsed) + '。' + extra;
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = fmt(elapsed);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    function fmt(sec) {
        const s = Math.floor(sec);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '已完成 · ' + fmt(elapsed);
        if (sel >= 0) return '点邻岛加桥';
        return '解谜中';
    }

    function updateHud() {
        const key = state + '|' + okCount() + '|' + totalBridges() + '|' + Math.floor(elapsed) +
            '|' + sel + '|' + diff + '|' + bestTime;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.done.textContent = okCount() + ' / ' + islands.length;
        els.moves.textContent = String(totalBridges());
        els.time.textContent = fmt(elapsed);
        els.best.textContent = bestTime >= 0 ? fmt(bestTime) : '--';
        els.level.textContent = DIFF_NAME[diff];
        els.restartBtn.textContent = state === 'ready' ? '开始解谜' : '换一道题';
    }

    /* ---------- 绘制 ---------- */

    function drawBackdrop() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1a24');
        g.addColorStop(0.55, '#0a1620');
        g.addColorStop(1, '#07101a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, 280, 30, W / 2, 280, 330);
        glow.addColorStop(0, 'rgba(70, 190, 220, .13)');
        glow.addColorStop(1, 'rgba(6, 18, 26, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        /* 点阵背景 */
        ctx.fillStyle = 'rgba(110, 170, 200, .08)';
        for (let j = 0; j < LAT; j++) {
            for (let i = 0; i < LAT; i++) {
                ctx.beginPath();
                ctx.arc(OX + i * SP, OY + j * SP, 1.1, 0, TAU);
                ctx.fill();
            }
        }
    }

    function drawBridges() {
        for (let a = 0; a < islands.length; a++) {
            const list = nbrs[a];
            for (let k = 0; k < list.length; k++) {
                const b = list[k];
                if (b < a) continue;
                const n = bridges[keyOf(a, b)] || 0;
                if (!n) continue;
                drawBridge(islands[a], islands[b], n);
            }
        }
    }

    function drawBridge(A, B, n) {
        const horiz = A.j === B.j;
        const trim = ISL_R + 3;
        let ax = A.x;
        let ay = A.y;
        let bx = B.x;
        let by = B.y;
        if (horiz) {
            ax += A.x < B.x ? trim : -trim;
            bx += A.x < B.x ? -trim : trim;
        } else {
            ay += A.y < B.y ? trim : -trim;
            by += A.y < B.y ? -trim : trim;
        }
        const offs = n === 1 ? [0] : [-3.6, 3.6];

        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < offs.length; i++) {
            const o = offs[i];
            const x1 = horiz ? ax : ax + o;
            const y1 = horiz ? ay + o : ay;
            const x2 = horiz ? bx : bx + o;
            const y2 = horiz ? by + o : by;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = 'rgba(96, 220, 255, .16)';
            ctx.lineWidth = 8;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = 'rgba(206, 246, 255, .92)';
            ctx.lineWidth = 2.4;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawIslands() {
        for (let i = 0; i < islands.length; i++) {
            const o = islands[i];
            const sum = sumOf(i);
            const done = sum === o.num;
            const over = sum > o.num;
            const col = done ? COL_OK : (over ? COL_BAD : COL_IDLE);

            /* 选中的岛高亮 */
            if (sel === i) {
                const p = 0.5 + Math.sin(pulse * 4) * 0.5;
                ctx.beginPath();
                ctx.arc(o.x, o.y, ISL_R + 9 + p * 2, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 236, 150, ' + (0.4 + p * 0.45).toFixed(2) + ')';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            const g = ctx.createRadialGradient(o.x - 5, o.y - 7, 2, o.x, o.y, ISL_R + 4);
            g.addColorStop(0, 'rgba(48, 86, 112, .95)');
            g.addColorStop(1, 'rgba(16, 34, 48, .98)');
            ctx.beginPath();
            ctx.arc(o.x, o.y, ISL_R, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = col;
            ctx.stroke();

            if (done) {
                ctx.beginPath();
                ctx.arc(o.x, o.y, ISL_R + 4.5, 0, TAU);
                ctx.strokeStyle = 'rgba(94, 242, 176, .22)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            ctx.fillStyle = done ? '#c8ffe8' : (over ? '#ffd4d9' : '#dff2ff');
            ctx.font = '800 16px ' + MONO;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(o.num), o.x, o.y + 0.5);
        }
    }

    function drawHints() {
        if (sel < 0) return;
        const list = nbrs[sel];
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            const mx = (islands[sel].x + islands[b].x) / 2;
            const my = (islands[sel].y + islands[b].y) / 2;
            const n = bridges[keyOf(sel, b)] || 0;
            ctx.beginPath();
            ctx.arc(mx, my, 3.4, 0, TAU);
            ctx.fillStyle = n ? 'rgba(255, 236, 150, .85)' : 'rgba(160, 220, 255, .45)';
            ctx.fill();
        }
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6f9ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('数桥', 24, 32);

        ctx.fillStyle = 'rgba(150, 200, 215, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('数字＝桥数 · 全部连成一片即胜', 24, 54);

        const bw = 108;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(94, 242, 176, .12)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(94, 242, 176, .3)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9df7cd';
        ctx.font = '700 12px ' + MONO;
        ctx.fillText(okCount() + ' / ' + islands.length + ' OK', bx + bw / 2, 38);
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px ' + FONT;
        if (msgT > 0) {
            ctx.fillStyle = 'rgba(255, 210, 130, ' + clamp(msgT, 0, 1).toFixed(2) + ')';
            ctx.fillText(msg, 24, OY + LAT * SP - SP + 40);
        } else {
            ctx.fillStyle = 'rgba(140, 185, 205, .68)';
            ctx.fillText('先点一座岛，再点相邻岛循环 0 / 1 / 2 条桥', 24, 538);
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(120, 165, 190, .55)';
        ctx.fillText('桥与桥不能交叉 · 可连接任意多座岛', W - 24, 538);
    }

    function render() {
        drawBackdrop();
        drawBridges();
        drawHints();
        drawIslands();
        drawHeader();
        drawFooter();
    }

    /* ---------- 交互 ---------- */

    function hitIsland(x, y) {
        for (let i = 0; i < islands.length; i++) {
            const dx = x - islands[i].x;
            const dy = y - islands[i].y;
            if (dx * dx + dy * dy <= 24 * 24) return i;
        }
        return -1;
    }

    function onDown(e) {
        if (state !== 'play') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const idx = hitIsland(x, y);
        if (idx < 0) {
            sel = -1;
            hudCache = '';
            updateHud();
            return;
        }
        if (sel < 0) {
            sel = idx;
            hudCache = '';
            updateHud();
            return;
        }
        if (sel === idx) {
            sel = -1;
            hudCache = '';
            updateHud();
            return;
        }
        if (nbrs[sel].indexOf(idx) < 0) {
            msg = '只能连接相邻的岛';
            msgT = 1.4;
            sel = idx;
            hudCache = '';
            updateHud();
            return;
        }
        const k = keyOf(sel, idx);
        bridges[k] = ((bridges[k] || 0) + 1) % 3;
        if (!bridges[k]) delete bridges[k];
        sel = -1;
        hudCache = '';
        updateHud();
        if (checkWin()) finish();
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        onDown(e);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') startGame();
        else if (e.code === 'Escape') {
            sel = -1;
            hudCache = '';
            updateHud();
        }
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
        newPuzzle();
    });

    els.ovBtn.addEventListener('click', startGame);
    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        pulse += dt;
        if (msgT > 0) msgT = Math.max(0, msgT - dt);
        if (state === 'play') {
            elapsed += dt;
            const sec = Math.floor(elapsed);
            if (sec !== timeShown) {
                timeShown = sec;
                hudCache = '';
                updateHud();
            }
        }

        render();
        requestAnimationFrame(frame);
    }

    newPuzzle();
    requestAnimationFrame(frame);
})();
