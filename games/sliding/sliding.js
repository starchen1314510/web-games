/* ==========================================================
   数字华容道 Sliding Puzzle
   ========================================================== */
(function () {
    'use strict';

    const BEST_PREFIX = 'webgames.sliding.best.';
    const SIZES = { 3: '3 × 3', 4: '4 × 4', 5: '5 × 5' };

    const board = document.getElementById('board');
    const els = {
        moves: document.getElementById('moves'),
        time: document.getElementById('time'),
        best: document.getElementById('best'),
        size: document.getElementById('size'),
        diffGroup: document.getElementById('diff-group'),
        restartBtn: document.getElementById('restart-btn'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart')
    };

    let n = 4;
    let tiles = [];
    let empty = { row: n - 1, col: n - 1 };
    let moves = 0;
    let seconds = 0;
    let timerId = null;
    let state = 'ready';        // ready | playing | over
    let best = 0;

    /* ---------- 布局 ---------- */
    function place(tile) {
        tile.el.style.setProperty('--cx', String(tile.col));
        tile.el.style.setProperty('--cy', String(tile.row));
    }

    function placeAll() {
        for (let i = 0; i < tiles.length; i++) place(tiles[i]);
    }

    function build() {
        board.innerHTML = '';
        board.style.setProperty('--n', String(n));
        board.classList.remove('solved');

        tiles = [];
        let val = 1;
        const total = n * n - 1;

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (r === n - 1 && c === n - 1) continue;

                const tile = { val: val, row: r, col: c, el: null };
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'slide-tile';

                const span = document.createElement('span');
                span.textContent = String(val);
                const hue = Math.round(206 - (val / total) * 140);
                span.style.background = 'linear-gradient(158deg, hsl(' + hue + ', 72%, 47%), ' +
                    'hsl(' + hue + ', 74%, 31%))';

                el.appendChild(span);
                el.addEventListener('click', (function (t) {
                    return function () { moveFrom(t.row, t.col); };
                })(tile));

                board.appendChild(el);
                tile.el = el;
                tiles.push(tile);
                val++;
            }
        }

        empty.row = n - 1;
        empty.col = n - 1;
        placeAll();
    }

    /* ---------- 查询与移动 ---------- */
    function tileAt(row, col) {
        for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            if (t.row === row && t.col === col) return t;
        }
        return null;
    }

    function moveFrom(row, col) {
        if (state !== 'playing') return false;

        const t = tileAt(row, col);
        if (!t) return false;
        if (Math.abs(row - empty.row) + Math.abs(col - empty.col) !== 1) return false;

        const tr = t.row;
        const tc = t.col;
        t.row = empty.row;
        t.col = empty.col;
        empty.row = tr;
        empty.col = tc;

        place(t);
        moves += 1;
        updateHud();

        if (isSolved()) win();
        return true;
    }

    function isSolved() {
        for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            const target = t.val - 1;
            if (t.row !== Math.floor(target / n) || t.col !== target % n) return false;
        }
        return true;
    }

    /* ---------- 打乱 ---------- */
    function shuffleTiles() {
        board.classList.add('no-anim');

        let prevDr = 0;
        let prevDc = 0;
        const steps = n * n * 18;

        for (let i = 0; i < steps; i++) {
            const opts = [];
            if (empty.col > 0) opts.push([0, -1]);
            if (empty.col < n - 1) opts.push([0, 1]);
            if (empty.row > 0) opts.push([-1, 0]);
            if (empty.row < n - 1) opts.push([1, 0]);

            let mv = opts[Math.floor(Math.random() * opts.length)];
            if (opts.length > 1 && mv[0] === -prevDr && mv[1] === -prevDc) {
                mv = opts[(opts.indexOf(mv) + 1) % opts.length];
            }

            const t = tileAt(empty.row + mv[0], empty.col + mv[1]);
            if (t) {
                const tr = t.row;
                const tc = t.col;
                t.row = empty.row;
                t.col = empty.col;
                empty.row = tr;
                empty.col = tc;
                place(t);
            }
            prevDr = mv[0];
            prevDc = mv[1];
        }

        void board.offsetWidth;
        board.classList.remove('no-anim');
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        els.moves.textContent = String(moves);
        els.time.textContent = seconds + 's';
        els.best.textContent = best ? String(best) : '--';
        els.size.textContent = SIZES[n];
    }

    function loadBest() {
        best = Number(localStorage.getItem(BEST_PREFIX + n) || 0);
    }

    /* ---------- 计时 ---------- */
    function stopTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function startTimer() {
        stopTimer();
        timerId = setInterval(function () {
            if (state !== 'playing') return;
            seconds += 1;
            els.time.textContent = seconds + 's';
        }, 1000);
    }

    /* ---------- 流程 ---------- */
    function begin() {
        stopTimer();
        moves = 0;
        seconds = 0;
        loadBest();
        build();

        let guard = 0;
        do {
            shuffleTiles();
            guard += 1;
        } while (isSolved() && guard < 4);

        state = 'playing';
        updateHud();
        hideOverlay();
        startTimer();
    }

    function win() {
        state = 'over';
        stopTimer();
        board.classList.add('solved');

        if (!best || moves < best) {
            best = moves;
            localStorage.setItem(BEST_PREFIX + n, String(best));
        }
        updateHud();

        setTimeout(function () { showOverlay('win'); }, 260);
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '数字华容道';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '把打乱的数字按 1 到 N 的顺序排好，右下角留空。点击空格旁边的方块，或用方向键移动。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始挑战';
            els.ovRestart.hidden = true;
        } else if (kind === 'win') {
            els.ovTitle.textContent = '拼好了';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '用时 ' + seconds + ' 秒完成 ' + SIZES[n] + ' 的排列，换更大的棋盘试试？';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(moves);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 事件 ---------- */
    window.addEventListener('keydown', function (e) {
        const k = e.key;
        let row = -1;
        let col = -1;

        if (k === 'ArrowUp') {
            row = empty.row + 1;
            col = empty.col;
        } else if (k === 'ArrowDown') {
            row = empty.row - 1;
            col = empty.col;
        } else if (k === 'ArrowLeft') {
            row = empty.row;
            col = empty.col + 1;
        } else if (k === 'ArrowRight') {
            row = empty.row;
            col = empty.col - 1;
        } else {
            return;
        }

        e.preventDefault();
        if (state === 'playing') moveFrom(row, col);
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-n]');
        if (!btn) return;
        const next = Number(btn.getAttribute('data-n'));
        if (!SIZES[next] || next === n) return;

        n = next;
        const all = els.diffGroup.querySelectorAll('[data-n]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', Number(all[i].getAttribute('data-n')) === n);
        }

        state = 'playing';
        begin();
    });

    els.ovBtn.addEventListener('click', begin);
    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    /* ---------- 启动 ---------- */
    build();
    loadBest();
    updateHud();
    showOverlay('ready');
})();
