/* ==========================================================
   数织 Nonogram
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 540;
    const HINT_W = 92;
    const HINT_H = 88;
    const PAD_TOP = 14;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const BEST_KEY = 'webgames.nonogram.best';

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

    function fmtTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        filled: document.getElementById('filled'),
        timer: document.getElementById('timer'),
        record: document.getElementById('record'),
        besttime: document.getElementById('besttime'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        hintBtn: document.getElementById('hint-btn'),
        checkBtn: document.getElementById('check-btn'),
        newBtn: document.getElementById('new-btn')
    };

    let size = 10;
    let CELL = 37;
    let GRID_X = HINT_W;
    let GRID_Y = PAD_TOP + HINT_H;
    let GRID_W = 370;

    let solution = [];
    let cells = [];
    let rowClues = [];
    let colClues = [];
    let filledTotal = 0;
    let state = 'ready';
    let elapsed = 0;
    let wrongTimer = 0;
    let wrongSet = [];
    let flashLine = null;
    let flashTimer = 0;
    let dragging = false;
    let dragMode = 1;
    let lastCell = null;
    let longPress = null;
    let hudCache = '';
    let clock = 0;

    /* ---------- 布局 ---------- */
    function layout() {
        CELL = Math.floor((W - HINT_W - 14) / size);
        GRID_W = CELL * size;
        GRID_X = HINT_W;
        GRID_Y = PAD_TOP + HINT_H;
    }

    /* ---------- 提示计算 ---------- */
    function lineClues(line) {
        const out = [];
        let run = 0;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === 1) {
                run += 1;
            } else if (run > 0) {
                out.push(run);
                run = 0;
            }
        }
        if (run > 0) out.push(run);
        if (!out.length) out.push(0);
        return out;
    }

    function sameClues(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
    }

    function currentRow(r) {
        const line = [];
        for (let c = 0; c < size; c++) line.push(cells[r][c] === 1 ? 1 : 0);
        return line;
    }

    function currentCol(c) {
        const line = [];
        for (let r = 0; r < size; r++) line.push(cells[r][c] === 1 ? 1 : 0);
        return line;
    }

    function rowDone(r) {
        return sameClues(lineClues(currentRow(r)), rowClues[r]);
    }

    function colDone(c) {
        return sameClues(lineClues(currentCol(c)), colClues[c]);
    }

    /* ---------- 生成题目 ---------- */
    function generate(n) {
        let sol = null;
        for (let attempt = 0; attempt < 60; attempt++) {
            const g = [];
            for (let r = 0; r < n; r++) {
                const row = [];
                for (let c = 0; c < n; c++) row.push(Math.random() < 0.55 ? 1 : 0);
                g.push(row);
            }
            // 补齐全空行 / 全空列
            for (let r = 0; r < n; r++) {
                let sum = 0;
                for (let c = 0; c < n; c++) sum += g[r][c];
                if (sum === 0) g[r][Math.floor(Math.random() * n)] = 1;
            }
            for (let c = 0; c < n; c++) {
                let sum = 0;
                for (let r = 0; r < n; r++) sum += g[r][c];
                if (sum === 0) g[Math.floor(Math.random() * n)][c] = 1;
            }
            let black = 0;
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) black += g[r][c];
            }
            const ratio = black / (n * n);
            if (ratio >= 0.34 && ratio <= 0.68) {
                sol = g;
                break;
            }
        }
        if (!sol) {
            sol = [];
            for (let r = 0; r < n; r++) {
                const row = [];
                for (let c = 0; c < n; c++) row.push((r * 7 + c * 5) % 3 === 0 ? 1 : 0);
                sol.push(row);
            }
        }
        return sol;
    }

    function newPuzzle(startNow) {
        layout();
        solution = generate(size);

        cells = [];
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) row.push(0);
            cells.push(row);
        }

        rowClues = [];
        colClues = [];
        filledTotal = 0;
        for (let r = 0; r < size; r++) {
            rowClues.push(lineClues(solution[r]));
            for (let c = 0; c < size; c++) if (solution[r][c]) filledTotal += 1;
        }
        for (let c = 0; c < size; c++) {
            const line = [];
            for (let r = 0; r < size; r++) line.push(solution[r][c]);
            colClues.push(lineClues(line));
        }

        elapsed = 0;
        wrongTimer = 0;
        wrongSet = [];
        flashLine = null;
        flashTimer = 0;
        dragging = false;
        lastCell = null;
        hudCache = '';
        state = startNow ? 'playing' : 'ready';
        if (startNow) hideOverlay();
        refreshStats();
        updateHud();
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 统计 ---------- */
    function bestKey() {
        return BEST_KEY + '.' + size;
    }

    function readBest() {
        return Number(localStorage.getItem(bestKey()) || 0);
    }

    function countKey() {
        return 'webgames.nonogram.count';
    }

    function refreshStats() {
        els.record.textContent = String(Number(localStorage.getItem(countKey()) || 0));
        const b = readBest();
        els.besttime.textContent = b > 0 ? fmtTime(b) : '--';
    }

    function filledNow() {
        let n = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) if (cells[r][c] === 1) n += 1;
        }
        return n;
    }

    function updateHud() {
        const key = filledNow() + '|' + Math.floor(elapsed) + '|' + state + '|' + size;
        if (key === hudCache) return;
        hudCache = key;
        els.filled.textContent = filledNow() + ' / ' + filledTotal;
        els.timer.textContent = fmtTime(elapsed);
    }

    /* ---------- 完成 ---------- */
    function checkAllDone() {
        for (let r = 0; r < size; r++) if (!rowDone(r)) return false;
        for (let c = 0; c < size; c++) if (!colDone(c)) return false;
        return true;
    }

    function finish() {
        state = 'done';
        const best = readBest();
        if (best === 0 || elapsed < best) {
            localStorage.setItem(bestKey(), String(Math.round(elapsed)));
        }
        const cnt = Number(localStorage.getItem(countKey()) || 0) + 1;
        localStorage.setItem(countKey(), String(cnt));
        refreshStats();

        els.ovTitle.textContent = '推演完成';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '这一题你用了 ' + fmtTime(elapsed) + '。';
        els.ovScore.innerHTML = '最快 <b>' + fmtTime(readBest()) + '</b> · 已完成 ' + cnt + ' 局';
        els.ovBtn.textContent = '再来一题';
        els.overlay.classList.add('show');
        updateHud();
    }

    /* ---------- 交互 ---------- */
    function cellAtEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - GRID_X) / CELL);
        const r = Math.floor((y - GRID_Y) / CELL);
        if (c < 0 || c >= size || r < 0 || r >= size) return null;
        return { c: c, r: r };
    }

    function apply(cell) {
        if (state !== 'playing') return;
        if (!cell) return;
        if (lastCell && lastCell.c === cell.c && lastCell.r === cell.r) return;
        lastCell = cell;
        if (cells[cell.r][cell.c] === dragMode) return;
        cells[cell.r][cell.c] = dragMode;
        hudCache = '';
        updateHud();
        if (checkAllDone()) finish();
    }

    canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    });

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'playing') return;
        const cell = cellAtEvent(e);
        if (!cell) return;
        e.preventDefault();
        dragging = true;
        lastCell = null;
        const cur = cells[cell.r][cell.c];

        if (e.button === 2) {
            dragMode = cur === 2 ? 0 : 2;
        } else {
            dragMode = cur === 1 ? 0 : 1;
        }

        apply(cell);

        if (longPress) clearTimeout(longPress);
        if (e.button !== 2) {
            longPress = setTimeout(function () {
                dragMode = 2;
                const cur2 = cells[cell.r][cell.c];
                if (cur2 !== 2) {
                    cells[cell.r][cell.c] = 2;
                    hudCache = '';
                    updateHud();
                }
                if (checkAllDone()) finish();
            }, 380);
        }
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!dragging || state !== 'playing') return;
        if (longPress) {
            clearTimeout(longPress);
            longPress = null;
        }
        apply(cellAtEvent(e));
    });

    function endDrag() {
        dragging = false;
        lastCell = null;
        if (longPress) {
            clearTimeout(longPress);
            longPress = null;
        }
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', endDrag);

    /* ---------- 按钮 ---------- */
    els.ovBtn.addEventListener('click', function () {
        if (state === 'done') {
            newPuzzle(true);
            return;
        }
        state = 'playing';
        hideOverlay();
        hudCache = '';
        updateHud();
    });

    els.newBtn.addEventListener('click', function () {
        newPuzzle(state === 'ready' ? false : true);
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-size]');
        if (!btn) return;
        const n = Number(btn.getAttribute('data-size'));
        if (n === size && state === 'playing') return;
        size = n;
        const all = els.diffGroup.querySelectorAll('[data-size]');
        for (let i = 0; i < all.length; i++) all[i].classList.remove('active');
        btn.classList.add('active');
        newPuzzle(state === 'ready' ? false : true);
    });

    els.hintBtn.addEventListener('click', function () {
        if (state !== 'playing') return;
        let pick = null;
        // 优先纠正错误
        for (let r = 0; r < size && !pick; r++) {
            for (let c = 0; c < size && !pick; c++) {
                if (cells[r][c] === 1 && solution[r][c] !== 1) pick = { c: c, r: r };
                if (cells[r][c] === 2 && solution[r][c] === 1) pick = { c: c, r: r };
            }
        }
        if (!pick) {
            const blanks = [];
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (solution[r][c] === 1 && cells[r][c] !== 1) blanks.push({ c: c, r: r });
                }
            }
            if (blanks.length) pick = blanks[Math.floor(Math.random() * blanks.length)];
        }
        if (!pick) return;
        cells[pick.r][pick.c] = solution[pick.r][pick.c] === 1 ? 1 : 2;
        flashLine = { c: pick.c, r: pick.r };
        flashTimer = 0.9;
        hudCache = '';
        updateHud();
        if (checkAllDone()) finish();
    });

    els.checkBtn.addEventListener('click', function () {
        if (state !== 'playing') return;
        wrongSet = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (cells[r][c] === 1 && solution[r][c] !== 1) {
                    wrongSet.push({ c: c, r: r });
                }
            }
        }
        wrongTimer = 1.5;
    });

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (state === 'playing') {
            elapsed += dt;
            updateHud();
        }
        if (wrongTimer > 0) wrongTimer -= dt;
        if (flashTimer > 0) flashTimer -= dt;
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawField() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#080e19');
        g.addColorStop(0.5, '#0a1220');
        g.addColorStop(1, '#0b1626');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // 行 / 列提示区底色
        ctx.fillStyle = 'rgba(24, 40, 64, .74)';
        roundRect(0, GRID_Y, HINT_W - 5, GRID_W, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(20, 34, 56, .86)';
        roundRect(GRID_X, PAD_TOP, GRID_W, HINT_H - 3, 4);
        ctx.fill();

        // 左上角的空白格
        ctx.fillStyle = 'rgba(16, 28, 46, .9)';
        roundRect(0, PAD_TOP, HINT_W - 5, HINT_H - 3, 4);
        ctx.fill();

        // 棋盘底
        ctx.fillStyle = '#0e1a2b';
        ctx.fillRect(GRID_X, GRID_Y, GRID_W, GRID_W);

        // 提示区与棋盘的分隔线
        ctx.strokeStyle = 'rgba(120, 160, 210, .3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(GRID_X - 2, GRID_Y);
        ctx.lineTo(GRID_X - 2, GRID_Y + GRID_W);
        ctx.moveTo(GRID_X, GRID_Y - 2);
        ctx.lineTo(GRID_X + GRID_W, GRID_Y - 2);
        ctx.stroke();
    }

    function drawCells() {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const v = cells[r][c];
                if (v === 0) continue;
                const x = GRID_X + c * CELL;
                const y = GRID_Y + r * CELL;

                if (v === 1) {
                    let wrong = false;
                    if (wrongTimer > 0) {
                        for (let i = 0; i < wrongSet.length; i++) {
                            if (wrongSet[i].c === c && wrongSet[i].r === r) wrong = true;
                        }
                    }
                    const g = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
                    if (wrong) {
                        g.addColorStop(0, '#ff7a86');
                        g.addColorStop(1, '#c8374a');
                    } else {
                        g.addColorStop(0, '#5fa8ff');
                        g.addColorStop(1, '#2f6bd0');
                    }
                    ctx.fillStyle = g;
                    roundRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, Math.max(2, CELL * 0.12));
                    ctx.fill();
                    ctx.fillStyle = 'rgba(255, 255, 255, .18)';
                    roundRect(x + 3, y + 3, CELL - 6, Math.max(2, CELL * 0.16), 1.5);
                    ctx.fill();
                } else {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(150, 182, 220, .42)';
                    ctx.lineWidth = 1.5;
                    const pad = CELL * 0.28;
                    ctx.beginPath();
                    ctx.moveTo(x + pad, y + pad);
                    ctx.lineTo(x + CELL - pad, y + CELL - pad);
                    ctx.moveTo(x + CELL - pad, y + pad);
                    ctx.lineTo(x + pad, y + CELL - pad);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
    }

    function drawGrid() {
        ctx.save();
        for (let i = 0; i <= size; i++) {
            const major = i === 0 || i === size || i % 5 === 0;
            ctx.strokeStyle = major ? 'rgba(158, 194, 238, .62)' : 'rgba(120, 156, 202, .34)';
            ctx.lineWidth = major ? 2 : 1;
            const x = GRID_X + i * CELL;
            const y = GRID_Y + i * CELL;
            ctx.beginPath();
            ctx.moveTo(x, GRID_Y);
            ctx.lineTo(x, GRID_Y + GRID_W);
            ctx.moveTo(GRID_X, y);
            ctx.lineTo(GRID_X + GRID_W, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawRowClues() {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let r = 0; r < size; r++) {
            const clues = rowClues[r];
            const done = rowDone(r);
            const y = GRID_Y + r * CELL + CELL / 2;
            const n = clues.length;
            const step = Math.min(16, (HINT_W - 8) / Math.max(n, 1));
            for (let i = 0; i < n; i++) {
                const x = GRID_X - 9 - (n - 1 - i) * step;
                ctx.font = '700 ' + Math.min(14, Math.round(CELL * 0.38)) + 'px ' + FONT;
                ctx.fillStyle = done ? 'rgba(140, 240, 180, .95)' : 'rgba(190, 214, 242, .82)';
                ctx.fillText(String(clues[i]), x, y);
            }
            if (done) {
                ctx.fillStyle = 'rgba(140, 240, 180, .1)';
                ctx.fillRect(GRID_X, GRID_Y + r * CELL, GRID_W, CELL);
            }
        }
        ctx.restore();
    }

    function drawColClues() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let c = 0; c < size; c++) {
            const clues = colClues[c];
            const done = colDone(c);
            const x = GRID_X + c * CELL + CELL / 2;
            const n = clues.length;
            const step = Math.min(14, (HINT_H - 14) / Math.max(n, 1));
            for (let i = 0; i < n; i++) {
                const y = GRID_Y - 9 - (n - 1 - i) * step;
                ctx.font = '700 ' + Math.min(13, Math.round(CELL * 0.36)) + 'px ' + FONT;
                ctx.fillStyle = done ? 'rgba(140, 240, 180, .95)' : 'rgba(190, 214, 242, .82)';
                ctx.fillText(String(clues[i]), x, y);
            }
            if (done) {
                ctx.fillStyle = 'rgba(140, 240, 180, .1)';
                ctx.fillRect(GRID_X + c * CELL, GRID_Y, CELL, GRID_W);
            }
        }
        ctx.restore();
    }

    function drawFlash() {
        if (!flashLine || flashTimer <= 0) return;
        const a = clamp(flashTimer / 0.9, 0, 1);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 226, 140, ' + (0.85 * a).toFixed(2) + ')';
        ctx.lineWidth = 2.4;
        const x = GRID_X + flashLine.c * CELL;
        const y = GRID_Y + flashLine.r * CELL;
        roundRect(x + 1, y + 1, CELL - 2, CELL - 2, 3);
        ctx.stroke();
        ctx.restore();
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '800 15px ' + FONT;
        ctx.fillStyle = 'rgba(226, 238, 255, .94)';
        ctx.fillText('数织', 14, 20);

        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 180, 215, .58)';
        ctx.fillText(size + ' × ' + size, 14, 38);

        ctx.textAlign = 'right';
        ctx.font = '700 12px ' + FONT;
        ctx.fillStyle = 'rgba(150, 180, 215, .62)';
        ctx.fillText(fmtTime(elapsed), W - 14, 20);

        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 180, 215, .48)';
        ctx.fillText('已填 ' + filledNow() + ' / ' + filledTotal, W - 14, 38);
        ctx.restore();
    }

    function drawBottomTip() {
        const y = GRID_Y + GRID_W + 22;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = 'rgba(150, 175, 205, .46)';
        ctx.fillText('点击拖动涂黑 · 右键 / 长按打叉 · 提示变绿即该行正确', W / 2, y);

        if (wrongTimer > 0 && wrongSet.length > 0) {
            ctx.fillStyle = 'rgba(255, 130, 145, .92)';
            ctx.font = '700 12px ' + FONT;
            ctx.fillText('有 ' + wrongSet.length + ' 个格子涂错了', W / 2, y + 20);
        } else if (state === 'playing' && filledNow() === filledTotal) {
            ctx.fillStyle = 'rgba(255, 226, 140, .88)';
            ctx.font = '700 12px ' + FONT;
            ctx.fillText('黑格数已对，注意排列顺序', W / 2, y + 20);
        }
        ctx.restore();
    }

    function draw() {
        drawField();
        drawRowClues();
        drawColClues();
        drawCells();
        drawGrid();
        drawFlash();
        drawHeader();
        drawBottomTip();
    }

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

    newPuzzle(false);
    refreshStats();
    requestAnimationFrame(loop);
})();
