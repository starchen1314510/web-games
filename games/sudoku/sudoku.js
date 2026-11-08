/* ==========================================================
   数独 Sudoku
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 552;
    const M = 24;
    const CELL = 48;
    const BOARD = CELL * 9;
    const BOTTOM = M + BOARD;
    const PAD_Y = BOTTOM + 14;
    const PAD_H = 46;
    const PAD_N = 10;
    const PAD_GAP = 4;
    const PAD_W = (BOARD - PAD_GAP * (PAD_N - 1)) / PAD_N;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const SOLVED_KEY = 'webgames.sudoku.solved';
    const BEST_KEY = 'webgames.sudoku.best';

    const HOLES = { easy: 40, normal: 47, hard: 54 };

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

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        left: document.getElementById('left'),
        timer: document.getElementById('timer'),
        record: document.getElementById('record'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        overlayScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        hintBtn: document.getElementById('hint-btn'),
        checkBtn: document.getElementById('check-btn'),
        newBtn: document.getElementById('new-btn')
    };

    let solution = new Array(81).fill(0);
    let puzzle = new Array(81).fill(0);
    let cells = new Array(81).fill(0);
    let fixed = new Array(81).fill(false);
    let sel = -1;
    let conflicts = new Array(81).fill(false);
    let badFlash = [];
    let state = 'ready';
    let diff = 'normal';
    let elapsed = 0;
    let solved = Number(localStorage.getItem(SOLVED_KEY) || 0);
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let texts = [];
    let clock = 0;
    let hudCache = '';
    let padFlash = [-1, 0];
    let winPulse = 0;
    let badFlashTimer = 0;

    /* ---------- 生成 ---------- */
    function shuffled() {
        const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function canPlace(g, pos, v) {
        const r = Math.floor(pos / 9);
        const c = pos % 9;
        for (let k = 0; k < 9; k++) {
            if (g[r * 9 + k] === v) return false;
            if (g[k * 9 + c] === v) return false;
        }
        const br = r - r % 3;
        const bc = c - c % 3;
        for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 3; dc++) {
                if (g[(br + dr) * 9 + bc + dc] === v) return false;
            }
        }
        return true;
    }

    function fillGrid(g, pos) {
        if (pos === 81) return true;
        if (g[pos]) return fillGrid(g, pos + 1);
        const order = shuffled();
        for (let i = 0; i < 9; i++) {
            const v = order[i];
            if (!canPlace(g, pos, v)) continue;
            g[pos] = v;
            if (fillGrid(g, pos + 1)) return true;
            g[pos] = 0;
        }
        return false;
    }

    function countSolutions(g, limit) {
        let count = 0;
        function rec(pos) {
            if (count >= limit) return;
            while (pos < 81 && g[pos]) pos++;
            if (pos === 81) {
                count += 1;
                return;
            }
            for (let v = 1; v <= 9; v++) {
                if (!canPlace(g, pos, v)) continue;
                g[pos] = v;
                rec(pos + 1);
                g[pos] = 0;
                if (count >= limit) return;
            }
        }
        rec(0);
        return count;
    }

    function buildPuzzle(holes) {
        const sol = new Array(81).fill(0);
        fillGrid(sol, 0);
        const puz = sol.slice();
        const order = [];
        for (let i = 0; i < 81; i++) order.push(i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = order[i];
            order[i] = order[j];
            order[j] = t;
        }
        let removed = 0;
        for (let k = 0; k < order.length && removed < holes; k++) {
            const i = order[k];
            const keep = puz[i];
            puz[i] = 0;
            const probe = puz.slice();
            if (countSolutions(probe, 2) !== 1) {
                puz[i] = keep;
            } else {
                removed += 1;
            }
        }
        return { puzzle: puz, solution: sol };
    }

    /* ---------- 规则 ---------- */
    function computeConflicts() {
        conflicts = new Array(81).fill(false);
        for (let i = 0; i < 81; i++) {
            const v = cells[i];
            if (!v) continue;
            const r = Math.floor(i / 9);
            const c = i % 9;
            for (let k = 0; k < 9; k++) {
                const a = r * 9 + k;
                const b = k * 9 + c;
                if (a !== i && cells[a] === v) conflicts[i] = true;
                if (b !== i && cells[b] === v) conflicts[i] = true;
            }
            const br = r - r % 3;
            const bc = c - c % 3;
            for (let dr = 0; dr < 3; dr++) {
                for (let dc = 0; dc < 3; dc++) {
                    const p = (br + dr) * 9 + bc + dc;
                    if (p !== i && cells[p] === v) conflicts[i] = true;
                }
            }
        }
    }

    function emptyCount() {
        let n = 0;
        for (let i = 0; i < 81; i++) if (!cells[i]) n++;
        return n;
    }

    function isSolved() {
        for (let i = 0; i < 81; i++) if (cells[i] !== solution[i]) return false;
        return true;
    }

    /* ---------- 流程 ---------- */
    function newGame() {
        const built = buildPuzzle(HOLES[diff]);
        solution = built.solution;
        puzzle = built.puzzle;
        cells = puzzle.slice();
        fixed = puzzle.map(function (v) { return v > 0; });
        sel = -1;
        conflicts = new Array(81).fill(false);
        badFlash = [];
        texts = [];
        elapsed = 0;
        winPulse = 0;
        state = 'playing';
        hudCache = '';
        hideOverlay();
        updateHud();
    }

    function finish() {
        state = 'over';
        solved += 1;
        localStorage.setItem(SOLVED_KEY, String(solved));
        const t = Math.round(elapsed);
        if (!best || t < best) {
            best = t;
            localStorage.setItem(BEST_KEY, String(best));
        }
        els.ovTitle.textContent = '拼完了';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '这一局你用了 ' + formatTime(t) + '，' +
            (best === t ? '新纪录。' : '个人最快 ' + formatTime(best) + '。');
        els.overlayScore.innerHTML = '完成 <b>' + solved + '</b> 局';
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    function showReady() {
        els.ovTitle.textContent = '数独';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '每行、每列、每个九宫格里 1-9 各出现一次。' +
            '点格子后用下方数字键或键盘填数，红框表示冲突。';
        els.overlayScore.innerHTML = '';
        els.ovBtn.textContent = '开始解题';
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function formatTime(sec) {
        const s = Math.max(0, Math.floor(sec));
        return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
    }

    function updateHud() {
        const left = emptyCount();
        const key = left + '|' + Math.floor(elapsed) + '|' + solved + '|' + state;
        if (key === hudCache) return;
        hudCache = key;
        els.left.textContent = String(left);
        els.timer.textContent = formatTime(elapsed);
        els.record.textContent = solved + ' 局完成';
    }

    /* ---------- 操作 ---------- */
    function place(v) {
        if (state !== 'playing' || sel < 0) return;
        if (fixed[sel]) return;
        cells[sel] = v;
        computeConflicts();
        padFlash = [v, 0.16];
        if (isSolved()) {
            finish();
            return;
        }
        updateHud();
    }

    function erase() {
        if (state !== 'playing' || sel < 0 || fixed[sel]) return;
        cells[sel] = 0;
        computeConflicts();
        updateHud();
    }

    function check() {
        if (state !== 'playing') return;
        badFlash = [];
        let wrong = 0;
        for (let i = 0; i < 81; i++) {
            if (cells[i] && cells[i] !== solution[i]) {
                badFlash.push(i);
                wrong += 1;
            }
        }
        if (!wrong) {
            texts.push({ x: W / 2, y: PAD_Y - 22, text: '目前填的都对', life: 1.2, max: 1.2, size: 16 });
        } else {
            texts.push({ x: W / 2, y: PAD_Y - 22, text: '有 ' + wrong + ' 个数字不对', life: 1.4, max: 1.4, size: 16 });
        }
        badFlashTimer = 1.5;
    }

    function hint() {
        if (state !== 'playing') return;
        let target = sel;
        if (target < 0 || fixed[target] || cells[target] === solution[target]) {
            const pool = [];
            for (let i = 0; i < 81; i++) {
                if (!fixed[i] && cells[i] !== solution[i]) pool.push(i);
            }
            if (!pool.length) return;
            target = pool[Math.floor(Math.random() * pool.length)];
        }
        sel = target;
        cells[target] = solution[target];
        computeConflicts();
        texts.push({
            x: M + (target % 9 + 0.5) * CELL,
            y: M + (Math.floor(target / 9) + 0.5) * CELL - 22,
            text: '+' + solution[target],
            life: 0.9,
            max: 0.9,
            size: 15
        });
        if (isSolved()) finish();
        else updateHud();
    }

    function cellAt(x, y) {
        if (x < M || y < M || x > M + BOARD || y > M + BOARD) return -1;
        const c = clamp(Math.floor((x - M) / CELL), 0, 8);
        const r = clamp(Math.floor((y - M) / CELL), 0, 8);
        return r * 9 + c;
    }

    function padAt(x, y) {
        if (y < PAD_Y || y > PAD_Y + PAD_H) return -1;
        for (let i = 0; i < PAD_N; i++) {
            const px = M + i * (PAD_W + PAD_GAP);
            if (x >= px && x <= px + PAD_W) return i;
        }
        return -1;
    }

    function tap(x, y) {
        const i = cellAt(x, y);
        if (i >= 0) {
            sel = i;
            return;
        }
        const k = padAt(x, y);
        if (k >= 0) {
            if (k === 9) erase();
            else place(k + 1);
        }
    }

    function moveSel(dr, dc) {
        if (sel < 0) {
            sel = 0;
            return;
        }
        const r = clamp(Math.floor(sel / 9) + dr, 0, 8);
        const c = clamp(sel % 9 + dc, 0, 8);
        sel = r * 9 + c;
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (state === 'playing') {
            elapsed += dt;
            updateHud();
        }
        if (state === 'over') winPulse += dt;
        if (badFlashTimer > 0) {
            badFlashTimer -= dt;
            if (badFlashTimer <= 0) badFlash = [];
        }
        if (padFlash[1] > 0) padFlash[1] -= dt;
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 24 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#101a2c');
        g.addColorStop(0.55, '#0b1220');
        g.addColorStop(1, '#131f33');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W * 0.5, -60, 20, W * 0.5, -60, 300);
        glow.addColorStop(0, 'rgba(79, 140, 255, .16)');
        glow.addColorStop(1, 'rgba(79, 140, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, 320);
    }

    function drawHighlights() {
        if (sel < 0) return;
        const sr = Math.floor(sel / 9);
        const sc = sel % 9;
        const br = sr - sr % 3;
        const bc = sc - sc % 3;
        ctx.save();
        ctx.fillStyle = 'rgba(79, 140, 255, .085)';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const inRow = r === sr;
                const inCol = c === sc;
                const inBox = r >= br && r < br + 3 && c >= bc && c < bc + 3;
                if (!inRow && !inCol && !inBox) continue;
                ctx.fillRect(M + c * CELL, M + r * CELL, CELL, CELL);
            }
        }
        const v = cells[sel];
        if (v) {
            ctx.fillStyle = 'rgba(255, 197, 72, .13)';
            for (let i = 0; i < 81; i++) {
                if (i !== sel && cells[i] === v) {
                    ctx.fillRect(M + (i % 9) * CELL, M + (Math.floor(i / 9)) * CELL, CELL, CELL);
                }
            }
        }
        ctx.restore();
    }

    function drawGrid() {
        ctx.save();
        ctx.fillStyle = '#0c1524';
        roundRect(M - 7, M - 7, BOARD + 14, BOARD + 14, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 160, 220, .22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(120, 160, 220, .14)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 9; i++) {
            if (i % 3 === 0) continue;
            const p = M + i * CELL + 0.5;
            ctx.beginPath();
            ctx.moveTo(p, M);
            ctx.lineTo(p, BOTTOM);
            ctx.moveTo(M, p);
            ctx.lineTo(M + BOARD, p);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(126, 178, 255, .42)';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 9; i += 3) {
            const p = M + i * CELL;
            ctx.beginPath();
            ctx.moveTo(p, M);
            ctx.lineTo(p, BOTTOM);
            ctx.moveTo(M, p);
            ctx.lineTo(M + BOARD, p);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawNumbers() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 27px ' + FONT;
        for (let i = 0; i < 81; i++) {
            const v = cells[i];
            if (!v) continue;
            const x = M + (i % 9 + 0.5) * CELL;
            const y = M + (Math.floor(i / 9) + 0.5) * CELL + 1;
            let color = '#5fa8ff';
            if (fixed[i]) color = '#dbe7f7';
            else if (conflicts[i] || badFlash.indexOf(i) >= 0) color = '#ff6470';
            ctx.fillStyle = color;
            ctx.fillText(String(v), x, y);
        }
        ctx.restore();
    }

    function drawSel() {
        if (sel < 0) return;
        const c = sel % 9;
        const r = Math.floor(sel / 9);
        ctx.save();
        ctx.strokeStyle = '#4f8cff';
        ctx.lineWidth = 2.4;
        roundRect(M + c * CELL + 1.2, M + r * CELL + 1.2, CELL - 2.4, CELL - 2.4, 5);
        ctx.stroke();
        ctx.restore();
    }

    function drawPad() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const clockA = 0.5 + Math.sin(clock * 3) * 0.1;
        for (let i = 0; i < PAD_N; i++) {
            const x = M + i * (PAD_W + PAD_GAP);
            const active = padFlash[0] === (i === 9 ? 0 : i + 1) && padFlash[1] > 0;
            ctx.fillStyle = active ? 'rgba(79, 140, 255, .42)' : 'rgba(255, 255, 255, .065)';
            roundRect(x, PAD_Y, PAD_W, PAD_H, 11);
            ctx.fill();
            ctx.strokeStyle = active ? 'rgba(140, 190, 255, .8)' : 'rgba(120, 160, 220, .18)';
            ctx.lineWidth = 1;
            ctx.stroke();
            if (i === 9) {
                ctx.fillStyle = 'rgba(220, 232, 248, ' + clockA.toFixed(2) + ')';
                ctx.font = '600 17px ' + FONT;
                ctx.fillText('删除', x + PAD_W / 2, PAD_Y + PAD_H / 2 + 1);
            } else {
                ctx.fillStyle = '#dbe7f7';
                ctx.font = '700 23px ' + FONT;
                ctx.fillText(String(i + 1), x + PAD_W / 2, PAD_Y + PAD_H / 2 + 1);
            }
        }
        ctx.restore();
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = 'rgba(214, 236, 255, .96)';
            ctx.font = '700 ' + t.size + 'px ' + FONT;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawWinGlow() {
        if (state !== 'over') return;
        const a = 0.12 + Math.sin(winPulse * 3) * 0.05;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#7fe0a8';
        ctx.lineWidth = 3;
        roundRect(M - 7, M - 7, BOARD + 14, BOARD + 14, 12);
        ctx.stroke();
        ctx.restore();
    }

    function render() {
        drawBg();
        drawHighlights();
        drawGrid();
        drawNumbers();
        drawSel();
        drawWinGlow();
        drawPad();
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
    function pos(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const p = pos(e);
        tap(p.x, p.y);
    });

    window.addEventListener('keydown', function (e) {
        if (e.key >= '1' && e.key <= '9') {
            place(Number(e.key));
            e.preventDefault();
            return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            erase();
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowLeft') { moveSel(0, -1); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { moveSel(0, 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { moveSel(-1, 0); e.preventDefault(); }
        else if (e.key === 'ArrowDown') { moveSel(1, 0); e.preventDefault(); }
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        els.diffGroup.querySelectorAll('[data-diff]').forEach(function (b) {
            b.classList.toggle('active', b === btn);
        });
        if (state === 'playing' || state === 'over') newGame();
    });

    els.ovBtn.addEventListener('click', newGame);
    els.newBtn.addEventListener('click', newGame);
    els.hintBtn.addEventListener('click', hint);
    els.checkBtn.addEventListener('click', check);

    /* ---------- 启动 ---------- */
    const seed = buildPuzzle(HOLES[diff]);
    solution = seed.solution;
    puzzle = seed.puzzle;
    cells = puzzle.slice();
    fixed = puzzle.map(function (v) { return v > 0; });
    updateHud();
    showReady();
    window.requestAnimationFrame(loop);
})();
