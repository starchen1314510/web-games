/* ==========================================================
   三消宝石 Match 3
   ========================================================== */
(function () {
    'use strict';

    const N = 8;
    const W = 480;
    const H = 480;
    const PAD = 12;
    const CELL = (W - PAD * 2) / N;      // 57
    const TAU = Math.PI * 2;

    const KINDS = 6;
    const GEMS = [
        { a: '#ff8f9f', b: '#c22a3c', line: '#ff5c6c' },
        { a: '#ffdc8a', b: '#c48a10', line: '#ffc548' },
        { a: '#7bf0b8', b: '#189258', line: '#2fd48b' },
        { a: '#8fb7ff', b: '#2559c9', line: '#4f8cff' },
        { a: '#c9a5ff', b: '#6a2ecf', line: '#9d5bff' },
        { a: '#a5e9ff', b: '#1d93c4', line: '#5ad2ff' }
    ];

    const BEST_KEY = 'webgames.match3.best';
    const LEVEL_KEY = 'webgames.match3.level';

    const BASE_MOVES = 30;

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function roundRect(x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        level: document.getElementById('level'),
        target: document.getElementById('target'),
        moves: document.getElementById('moves'),
        chain: document.getElementById('chain'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let cells = [];
    let state = 'ready';          // ready | playing | over
    let busy = false;
    let score = 0;
    let level = 1;
    let goal = 0;
    let movesLeft = BASE_MOVES;
    let chainNow = 0;
    let levelStartScore = 0;
    let sel = null;
    let drag = null;
    let hint = 0;
    let overKind = '';
    let hudCache = '';

    /* ---------- 关卡 ---------- */
    function goalFor(lv) {
        let t = 0;
        for (let i = 1; i <= lv; i++) t += 1000 + (i - 1) * 450;
        return t;
    }

    function prevGoal(lv) {
        return lv <= 1 ? 0 : goalFor(lv - 1);
    }

    /* ---------- 棋盘 ---------- */
    function pickKind(r, c) {
        for (let guard = 0; guard < 30; guard++) {
            const k = Math.floor(Math.random() * KINDS);
            if (c >= 2 && cells[r][c - 1].kind === k && cells[r][c - 2].kind === k) continue;
            if (r >= 2 && cells[r - 1][c].kind === k && cells[r - 2][c].kind === k) continue;
            return k;
        }
        return Math.floor(Math.random() * KINDS);
    }

    function buildBoard() {
        cells = [];
        for (let r = 0; r < N; r++) {
            const row = [];
            for (let c = 0; c < N; c++) {
                row.push({ kind: 0, ox: 0, oy: 0, sc: 1, dead: false });
            }
            cells.push(row);
        }
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                cells[r][c].kind = pickKind(r, c);
            }
        }
    }

    function newBoard() {
        let tries = 0;
        do {
            buildBoard();
            tries++;
        } while ((findMatches().size > 0 || !hasMove()) && tries < 40);
    }

    function swapKind(a, b) {
        const t = cells[a.r][a.c].kind;
        cells[a.r][a.c].kind = cells[b.r][b.c].kind;
        cells[b.r][b.c].kind = t;
    }

    function swapVisual(a, b) {
        const ca = cells[a.r][a.c];
        const cb = cells[b.r][b.c];
        cells[a.r][a.c] = cb;
        cells[b.r][b.c] = ca;
        cb.ox += (b.c - a.c) * CELL;
        cb.oy += (b.r - a.r) * CELL;
        ca.ox += (a.c - b.c) * CELL;
        ca.oy += (a.r - b.r) * CELL;
    }

    function findMatches() {
        const hit = new Set();

        for (let r = 0; r < N; r++) {
            let run = 1;
            for (let c = 1; c <= N; c++) {
                const cur = c < N ? cells[r][c] : null;
                const prev = cells[r][c - 1];
                if (cur && prev && !cur.dead && !prev.dead && cur.kind === prev.kind) {
                    run++;
                } else {
                    if (run >= 3) {
                        for (let k = c - run; k < c; k++) hit.add(r * N + k);
                    }
                    run = 1;
                }
            }
        }

        for (let c = 0; c < N; c++) {
            let run = 1;
            for (let r = 1; r <= N; r++) {
                const cur = r < N ? cells[r][c] : null;
                const prev = cells[r - 1][c];
                if (cur && prev && !cur.dead && !prev.dead && cur.kind === prev.kind) {
                    run++;
                } else {
                    if (run >= 3) {
                        for (let k = r - run; k < r; k++) hit.add(k * N + c);
                    }
                    run = 1;
                }
            }
        }

        return hit;
    }

    function hasMove() {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (!cells[r][c]) continue;
                if (c + 1 < N && cells[r][c + 1]) {
                    const a = { r: r, c: c };
                    const b = { r: r, c: c + 1 };
                    swapKind(a, b);
                    const ok = findMatches().size > 0;
                    swapKind(a, b);
                    if (ok) return true;
                }
                if (r + 1 < N && cells[r + 1][c]) {
                    const a = { r: r, c: c };
                    const b = { r: r + 1, c: c };
                    swapKind(a, b);
                    const ok = findMatches().size > 0;
                    swapKind(a, b);
                    if (ok) return true;
                }
            }
        }
        return false;
    }

    function collapse() {
        for (let c = 0; c < N; c++) {
            let w = N - 1;
            for (let r = N - 1; r >= 0; r--) {
                const cell = cells[r][c];
                if (!cell || cell.dead) {
                    cells[r][c] = null;
                    continue;
                }
                if (r !== w) {
                    cells[w][c] = cell;
                    cells[r][c] = null;
                    cell.oy += (r - w) * CELL;
                }
                w--;
            }
            const count = w + 1;
            for (let r = w; r >= 0; r--) {
                cells[r][c] = {
                    kind: Math.floor(Math.random() * KINDS),
                    ox: 0,
                    oy: -(count - r) * CELL,
                    sc: 1,
                    dead: false
                };
            }
        }
    }

    function shuffleBoard() {
        const pool = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) pool.push(cells[r][c].kind);
        }

        let tries = 0;
        do {
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = pool[i];
                pool[i] = pool[j];
                pool[j] = t;
            }
            let i = 0;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) cells[r][c].kind = pool[i++];
            }
            tries++;
        } while ((findMatches().size > 0 || !hasMove()) && tries < 60);

        hint = 1.6;
    }

    /* ---------- HUD ---------- */
    function statusKey() {
        return score + '|' + level + '|' + goal + '|' + movesLeft + '|' + chainNow + '|' + state;
    }

    function updateHud() {
        const key = statusKey();
        if (key === hudCache) return;
        hudCache = key;

        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        els.score.textContent = String(score);
        els.level.textContent = String(level);
        els.target.textContent = String(goal);
        els.moves.textContent = String(movesLeft);
        els.chain.textContent = chainNow > 1 ? ('×' + chainNow) : '--';
        els.best.textContent = String(best);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '三消宝石';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '交换相邻的两颗宝石，让三颗以上同色宝石连成一线。' +
                '连锁消除有倍率加成，在步数用完前达成目标分数。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始游戏';
        } else if (kind === 'pass') {
            els.ovTitle.textContent = '第 ' + (level - 1) + ' 关完成';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '累计 ' + score + ' 分，超过目标 ' + prevGoal(level) +
                '。下一关目标 ' + goal + ' 分，步数重新计满。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '进入第 ' + level + ' 关';
        } else {
            els.ovTitle.textContent = '步数用完了';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '本关只拿到 ' + score + ' 分，距离 ' + goal +
                ' 分还差 ' + (goal - score) + '。多找能触发连锁的位置。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '重试本关';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function saveBest() {
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        const bestLv = Number(localStorage.getItem(LEVEL_KEY) || 0);
        if (level > bestLv) localStorage.setItem(LEVEL_KEY, String(level));
    }

    /* ---------- 流程 ---------- */
    function applyLevel(lv, baseScore) {
        level = lv;
        goal = goalFor(lv);
        score = baseScore;
        levelStartScore = baseScore;
        movesLeft = BASE_MOVES;
        chainNow = 0;
        sel = null;
        busy = false;
        overKind = '';
        newBoard();
        state = 'playing';
        hudCache = '';
        hideOverlay();
        updateHud();
    }

    function startNew() {
        applyLevel(1, 0);
    }

    function passLevel() {
        saveBest();
        level += 1;
        goal = goalFor(level);
        state = 'over';
        overKind = 'pass';
        updateHud();
        showOverlay('pass');
    }

    function failLevel() {
        saveBest();
        state = 'over';
        overKind = 'fail';
        showOverlay('fail');
    }

    function begin() {
        if (state === 'ready') {
            startNew();
        } else if (state === 'over') {
            if (overKind === 'pass') applyLevel(level, score);
            else applyLevel(level, levelStartScore);
        }
    }

    function restart() {
        if (state === 'ready') startNew();
        else applyLevel(level, levelStartScore);
    }

    /* ---------- 交互 ---------- */
    function locate(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - PAD) / CELL);
        const r = Math.floor((y - PAD) / CELL);
        if (r < 0 || r >= N || c < 0 || c >= N) return null;
        return { r: r, c: c };
    }

    function adjacent(a, b) {
        return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
    }

    function trySwap(a, b) {
        if (busy || state !== 'playing' || !adjacent(a, b)) return;
        busy = true;
        sel = null;
        chainNow = 0;
        swapVisual(a, b);
        updateHud();

        window.setTimeout(function () {
            if (findMatches().size > 0) {
                movesLeft = Math.max(0, movesLeft - 1);
                chainNow = 1;
                updateHud();
                resolve(1);
            } else {
                swapVisual(a, b);
                window.setTimeout(function () {
                    busy = false;
                    updateHud();
                }, 210);
            }
        }, 200);
    }

    function resolve(chain) {
        const hits = findMatches();

        if (!hits.size) {
            chainNow = 0;
            busy = false;
            updateHud();

            if (score >= goal) { passLevel(); return; }
            if (movesLeft <= 0) { failLevel(); return; }
            if (!hasMove()) {
                shuffleBoard();
                updateHud();
            }
            return;
        }

        score += hits.size * 10 * chain;
        chainNow = chain;
        updateHud();

        hits.forEach(function (key) {
            const r = Math.floor(key / N);
            const c = key % N;
            if (cells[r][c]) cells[r][c].dead = true;
        });

        window.setTimeout(function () {
            collapse();
            window.setTimeout(function () { resolve(chain + 1); }, 210);
        }, 170);
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing' || busy) return;
        const p = locate(e);
        if (!p) return;
        drag = { r: p.r, c: p.c, x: e.clientX, y: e.clientY, moved: false };
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!drag || drag.moved || state !== 'playing' || busy) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const limit = rect.width / W * CELL * 0.45;
        if (Math.abs(dx) < limit && Math.abs(dy) < limit) return;

        drag.moved = true;
        let t;
        if (Math.abs(dx) > Math.abs(dy)) {
            t = { r: drag.r, c: drag.c + (dx > 0 ? 1 : -1) };
        } else {
            t = { r: drag.r + (dy > 0 ? 1 : -1), c: drag.c };
        }
        if (t.r < 0 || t.r >= N || t.c < 0 || t.c >= N) return;
        trySwap({ r: drag.r, c: drag.c }, t);
    });

    window.addEventListener('pointerup', function () {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (d.moved || state !== 'playing' || busy) return;

        if (sel && adjacent(sel, d)) {
            trySwap(sel, d);
        } else if (sel && sel.r === d.r && sel.c === d.c) {
            sel = null;
        } else {
            sel = { r: d.r, c: d.c };
        }
    });

    canvas.addEventListener('pointercancel', function () { drag = null; });

    window.addEventListener('keydown', function (e) {
        if (e.key === 'r' || e.key === 'R') {
            restart();
            e.preventDefault();
        }
    });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', restart);

    /* ---------- 绘制 ---------- */
    function shapePath(kind, r) {
        ctx.beginPath();
        if (kind === 0) {
            ctx.arc(0, 0, r * 0.94, 0, TAU);
        } else if (kind === 1) {
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 1.02, 0);
            ctx.lineTo(0, r);
            ctx.lineTo(-r * 1.02, 0);
            ctx.closePath();
        } else if (kind === 2) {
            roundRect(-r * 0.86, -r * 0.86, r * 1.72, r * 1.72, r * 0.32);
        } else if (kind === 3) {
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 0.96, r * 0.72);
            ctx.lineTo(-r * 0.96, r * 0.72);
            ctx.closePath();
        } else if (kind === 4) {
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI / 2 + i * TAU / 6;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
        } else {
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + i * TAU / 10;
                const rr = i % 2 === 0 ? r : r * 0.46;
                const px = Math.cos(a) * rr;
                const py = Math.sin(a) * rr;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }
    }

    function drawBackdrop() {
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0d1524');
        bg.addColorStop(1, '#080c14');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(37, 50, 72, .55)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= N; i++) {
            const p = Math.round(PAD + i * CELL) + 0.5;
            ctx.beginPath();
            ctx.moveTo(p, PAD);
            ctx.lineTo(p, H - PAD);
            ctx.moveTo(PAD, p);
            ctx.lineTo(W - PAD, p);
            ctx.stroke();
        }

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if ((r + c) % 2 === 0) continue;
                ctx.fillStyle = 'rgba(255, 255, 255, .012)';
                ctx.fillRect(PAD + c * CELL, PAD + r * CELL, CELL, CELL);
            }
        }

        ctx.strokeStyle = 'rgba(79, 140, 255, .18)';
        ctx.lineWidth = 2;
        roundRect(PAD - 6, PAD - 6, W - PAD * 2 + 12, H - PAD * 2 + 12, 16);
        ctx.stroke();
    }

    function drawGem(kind, cx, cy, size, scale) {
        const g = GEMS[kind];
        const s = size * scale;
        if (s < 2) return;

        ctx.save();
        ctx.translate(cx, cy);

        ctx.fillStyle = 'rgba(9, 15, 26, .85)';
        roundRect(-s * 0.5, -s * 0.5, s, s, s * 0.26);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, .065)';
        ctx.lineWidth = 1;
        roundRect(-s * 0.5 + 0.5, -s * 0.5 + 0.5, s - 1, s - 1, s * 0.26);
        ctx.stroke();

        const r = s * 0.29;
        const grad = ctx.createLinearGradient(-r, -r, r, r);
        grad.addColorStop(0, g.a);
        grad.addColorStop(1, g.b);
        ctx.fillStyle = grad;
        ctx.strokeStyle = g.line;
        ctx.lineWidth = Math.max(1, s * 0.045);
        ctx.shadowColor = g.line;
        ctx.shadowBlur = s * 0.2;

        shapePath(kind, r);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.28, r * 0.16, -0.6, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    function drawSelection() {
        if (!sel) return;
        const x = PAD + sel.c * CELL + 1.5;
        const y = PAD + sel.r * CELL + 1.5;
        const s = CELL - 3;

        ctx.strokeStyle = 'rgba(120, 190, 255, .95)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(90, 170, 255, .8)';
        ctx.shadowBlur = 14;
        roundRect(x, y, s, s, 12);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawHintText() {
        if (hint <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, hint);
        ctx.fillStyle = 'rgba(255, 197, 72, .92)';
        ctx.font = '800 16px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('没有可消的组合，已自动洗牌', W / 2, PAD + 18);
        ctx.restore();
    }

    function drawReadyHint() {
        if (state !== 'ready') return;
        ctx.save();
        ctx.fillStyle = 'rgba(150, 175, 210, .72)';
        ctx.font = '700 16px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('点击「开始游戏」交换宝石', W / 2, H / 2);
        ctx.restore();
    }

    function updateTween(dt) {
        const k = Math.min(1, dt * 22);
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cell = cells[r][c];
                if (!cell) continue;
                cell.ox += (0 - cell.ox) * k;
                cell.oy += (0 - cell.oy) * k;
                if (Math.abs(cell.ox) < 0.4) cell.ox = 0;
                if (Math.abs(cell.oy) < 0.4) cell.oy = 0;

                if (cell.dead) {
                    cell.sc += (0 - cell.sc) * Math.min(1, dt * 26);
                } else if (cell.sc !== 1) {
                    cell.sc += (1 - cell.sc) * k;
                }
            }
        }
        if (hint > 0) hint = Math.max(0, hint - dt);
    }

    function render() {
        drawBackdrop();

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cell = cells[r][c];
                if (!cell) continue;
                if (cell.dead && cell.sc < 0.04) continue;
                const cx = PAD + c * CELL + CELL / 2 + cell.ox;
                const cy = PAD + r * CELL + CELL / 2 + cell.oy;
                drawGem(cell.kind, cx, cy, CELL - 6, cell.sc);
            }
        }

        drawSelection();
        drawHintText();
        drawReadyHint();
    }

    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;

        updateTween(dt);
        render();
        requestAnimationFrame(frame);
    }

    /* ---------- 启动 ---------- */
    newBoard();
    goal = goalFor(1);
    updateHud();
    showOverlay('ready');
    requestAnimationFrame(frame);
})();
