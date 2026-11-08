/* ==========================================================
   连连看 Link Game
   ========================================================== */
(function () {
    'use strict';

    const BOARD = 432;
    const BEST_PREFIX = 'webgames.link.best.';

    const DIFFS = {
        easy: { n: 6, kinds: 6, label: '轻松' },
        normal: { n: 8, kinds: 8, label: '标准' },
        hard: { n: 10, kinds: 10, label: '困难' }
    };

    const SYMBOLS = [
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="18.5" r="9.5" fill="#ff5c6c"/><path d="M16.5 9.2c-.5-2.7.7-4.8 3-5.4.3 2.5-1 4.6-3 5.4z" fill="#2fd48b"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 4l3.6 7.6 8.4 1.1-6.1 5.8 1.5 8.3L16 22.9l-7.4 3.9 1.5-8.3L4 12.7l8.4-1.1z" fill="#ffc548"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 27s-10-6.2-10-12.4A5.6 5.6 0 0 1 16 11a5.6 5.6 0 0 1 10 3.6C26 20.8 16 27 16 27z" fill="#ff7ba8"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 3L7 18h6.5L12 29l12-15.5h-7z" fill="#4f8cff"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 4c6.2 8.4 9 11.6 9 15.2a9 9 0 1 1-18 0C7 15.6 9.8 12.4 16 4z" fill="#9d5bff"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="9.4" r="5.4" fill="#5ad2ff"/><circle cx="16" cy="22.6" r="5.4" fill="#5ad2ff"/><circle cx="9.4" cy="16" r="5.4" fill="#5ad2ff"/><circle cx="22.6" cy="16" r="5.4" fill="#5ad2ff"/><circle cx="16" cy="16" r="4" fill="#0f2740"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 4l10.4 6v12L16 28 5.6 22V10z" fill="#2fd48b"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 3l12 13-12 13L4 16z" fill="#ff9f43"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 5l12 21H4z" fill="#3ad0e0"/></svg>',
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="24" height="24" rx="7" fill="#e8eef8"/><rect x="11" y="11" width="10" height="10" rx="3" fill="#22303f"/></svg>'
    ];

    const boardEl = document.getElementById('board');
    const pathEl = document.getElementById('path');

    const els = {
        left: document.getElementById('left'),
        time: document.getElementById('time'),
        best: document.getElementById('best'),
        combo: document.getElementById('combo'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        diffGroup: document.getElementById('diff-group'),
        hintBtn: document.getElementById('hint-btn'),
        shuffleBtn: document.getElementById('shuffle-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let diffKey = 'normal';
    let conf = DIFFS.normal;
    let n = 8;
    let board = [];
    let cards = new Map();
    let selected = null;
    let state = 'ready';           // ready | playing | over
    let busy = false;
    let leftPairs = 32;
    let combo = 0;
    let hintLeft = 3;
    let shuffleLeft = 3;
    let startAt = 0;
    let elapsed = 0;
    let hudCache = '';

    function shuffleArr(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }

    /* ---------- 棋盘 ---------- */
    function buildBoard() {
        conf = DIFFS[diffKey];
        n = conf.n;

        boardEl.style.width = BOARD + 'px';

        board = [];
        for (let r = 0; r < n + 2; r++) {
            const row = [];
            for (let c = 0; c < n + 2; c++) row.push(0);
            board.push(row);
        }

        const per = (n * n) / conf.kinds;
        const pool = [];
        for (let k = 0; k < conf.kinds; k++) {
            for (let i = 0; i < per; i++) pool.push(k);
        }
        shuffleArr(pool);

        const old = boardEl.querySelectorAll('.link-card');
        for (let i = 0; i < old.length; i++) old[i].remove();
        cards.clear();
        selected = null;
        pathEl.innerHTML = '';
        pathEl.setAttribute('viewBox', '0 0 ' + n + ' ' + n);

        let idx = 0;
        for (let r = 1; r <= n; r++) {
            for (let c = 1; c <= n; c++) {
                const sym = pool[idx++];
                board[r][c] = sym + 1;

                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'link-card';
                el.dataset.r = r;
                el.dataset.c = c;
                el.style.left = ((c - 1) * 100 / n) + '%';
                el.style.top = ((r - 1) * 100 / n) + '%';
                el.style.width = (100 / n) + '%';
                el.style.height = (100 / n) + '%';
                el.innerHTML = '<span class="link-face">' + SYMBOLS[sym] + '</span>';
                boardEl.appendChild(el);

                cards.set(r + ',' + c, { r: r, c: c, sym: sym, el: el });
            }
        }

        leftPairs = n * n / 2;
        combo = 0;
        hintLeft = 3;
        shuffleLeft = 3;
        elapsed = 0;
        hudCache = '';

        for (let i = 0; i < 40; i++) {
            if (findAnyPair()) break;
            reshuffleSymbols();
        }

        updateHud();
    }

    /* ---------- 路径判定 ---------- */
    function cellFree(r, c) {
        if (r < 0 || r > n + 1 || c < 0 || c > n + 1) return false;
        return board[r][c] === 0;
    }

    function lineClear(r1, c1, r2, c2) {
        if (r1 === r2) {
            const from = Math.min(c1, c2) + 1;
            const to = Math.max(c1, c2);
            for (let c = from; c < to; c++) {
                if (!cellFree(r1, c)) return false;
            }
            return true;
        }
        if (c1 === c2) {
            const from = Math.min(r1, r2) + 1;
            const to = Math.max(r1, r2);
            for (let r = from; r < to; r++) {
                if (!cellFree(r, c1)) return false;
            }
            return true;
        }
        return false;
    }

    function oneFold(r1, c1, r2, c2) {
        if (cellFree(r1, c2) && lineClear(r1, c1, r1, c2) && lineClear(r1, c2, r2, c2)) {
            return [{ r: r1, c: c2 }];
        }
        if (cellFree(r2, c1) && lineClear(r1, c1, r2, c1) && lineClear(r2, c1, r2, c2)) {
            return [{ r: r2, c: c1 }];
        }
        return null;
    }

    function findPath(a, b) {
        if ((a.r === b.r || a.c === b.c) && lineClear(a.r, a.c, b.r, b.c)) return [];

        const one = oneFold(a.r, a.c, b.r, b.c);
        if (one) return one;

        for (let c = 0; c <= n + 1; c++) {
            if (c === a.c) continue;
            if (!cellFree(a.r, c)) continue;
            if (!lineClear(a.r, a.c, a.r, c)) continue;
            if (lineClear(a.r, c, b.r, b.c)) return [{ r: a.r, c: c }];
            const sub = oneFold(a.r, c, b.r, b.c);
            if (sub) return [{ r: a.r, c: c }].concat(sub);
        }

        for (let r = 0; r <= n + 1; r++) {
            if (r === a.r) continue;
            if (!cellFree(r, a.c)) continue;
            if (!lineClear(a.r, a.c, r, a.c)) continue;
            if (lineClear(r, a.c, b.r, b.c)) return [{ r: r, c: a.c }];
            const sub = oneFold(r, a.c, b.r, b.c);
            if (sub) return [{ r: r, c: a.c }].concat(sub);
        }

        return null;
    }

    function findAnyPair() {
        const list = [];
        cards.forEach(function (c) { list.push(c); });

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                if (list[i].sym !== list[j].sym) continue;
                const p = findPath(list[i], list[j]);
                if (p) return [list[i], list[j], p];
            }
        }
        return null;
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const best = Number(localStorage.getItem(BEST_PREFIX + diffKey) || 0);
        const sec = Math.round(elapsed / 1000);
        const key = leftPairs + '|' + sec + '|' + combo + '|' + hintLeft + '|' + shuffleLeft + '|' + best + '|' + state;
        if (key === hudCache) return;
        hudCache = key;

        els.left.textContent = String(leftPairs);
        els.time.textContent = sec + 's';
        els.best.textContent = best ? best + 's' : '--';
        els.combo.textContent = String(combo);
        els.hintBtn.textContent = '提示 × ' + hintLeft;
        els.shuffleBtn.textContent = '洗牌 × ' + shuffleLeft;
        els.hintBtn.disabled = state !== 'playing' || hintLeft <= 0;
        els.shuffleBtn.disabled = state !== 'playing' || shuffleLeft <= 0;
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '连连看';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '点击两张相同的图案，路径最多拐两个弯就能消除。' +
                conf.label + '难度共 ' + (n * n / 2) + ' 对图案，全部消完即过关。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始挑战';
            els.ovRestart.hidden = true;
        } else if (kind === 'win') {
            els.ovTitle.textContent = '全部消除';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '用时 ' + Math.round(elapsed / 1000) + ' 秒清空棋盘，' +
                '一共消掉 ' + (n * n / 2) + ' 对图案。试试用更短的时间完成？';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = Math.round(elapsed / 1000) + 's';
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 交互 ---------- */
    function clearSelection() {
        if (selected) selected.el.classList.remove('picked');
        selected = null;
    }

    function nudge(card) {
        card.el.classList.remove('nudge');
        void card.el.offsetWidth;
        card.el.classList.add('nudge');
        window.setTimeout(function () { card.el.classList.remove('nudge'); }, 280);
    }

    function xOf(c) {
        return c - 0.5;
    }

    function yOf(r) {
        return r - 0.5;
    }

    function drawPath(a, b, folds) {
        const pts = [{ r: a.r, c: a.c }].concat(folds, [{ r: b.r, c: b.c }]);
        let str = '';
        for (let i = 0; i < pts.length; i++) {
            str += (i ? ' ' : '') + xOf(pts[i].c) + ',' + yOf(pts[i].r);
        }
        pathEl.innerHTML =
            '<polyline points="' + str + '" fill="none" stroke="rgba(90, 210, 255, .92)" ' +
            'stroke-width="' + (0.45 / n + 0.02).toFixed(3) + '" stroke-linecap="round" ' +
            'stroke-linejoin="round"/>';
    }

    function onPick(card) {
        if (state !== 'playing' || busy) return;

        if (selected && selected.r === card.r && selected.c === card.c) {
            clearSelection();
            return;
        }

        if (!selected) {
            selected = card;
            card.el.classList.add('picked');
            return;
        }

        if (selected.sym !== card.sym) {
            clearSelection();
            selected = card;
            card.el.classList.add('picked');
            return;
        }

        const path = findPath({ r: selected.r, c: selected.c }, { r: card.r, c: card.c });
        if (!path) {
            nudge(selected);
            nudge(card);
            clearSelection();
            selected = card;
            card.el.classList.add('picked');
            return;
        }

        const a = selected;
        clearSelection();
        connect(a, card, path);
    }

    function connect(a, b, path) {
        busy = true;
        drawPath(a, b, path);

        board[a.r][a.c] = 0;
        board[b.r][b.c] = 0;
        cards.delete(a.r + ',' + a.c);
        cards.delete(b.r + ',' + b.c);

        a.el.classList.add('gone');
        b.el.classList.add('gone');

        leftPairs -= 1;
        combo += 1;
        updateHud();

        window.setTimeout(function () {
            a.el.remove();
            b.el.remove();
            pathEl.innerHTML = '';
            busy = false;

            if (leftPairs === 0) {
                state = 'over';
                const sec = Math.round(elapsed / 1000);
                const best = Number(localStorage.getItem(BEST_PREFIX + diffKey) || 0);
                if (!best || sec < best) {
                    localStorage.setItem(BEST_PREFIX + diffKey, String(sec));
                }
                updateHud();
                showOverlay('win');
            } else if (!findAnyPair()) {
                reshuffleSymbols();
                shuffleUntilPlayable();
                combo = 0;
                updateHud();
            }
        }, 240);
    }

    /* ---------- 洗牌 ---------- */
    function reshuffleSymbols() {
        const rest = [];
        cards.forEach(function (c) { rest.push(c); });
        if (rest.length < 2) return;

        const pool = rest.map(function (c) { return c.sym; });
        shuffleArr(pool);

        for (let i = 0; i < rest.length; i++) {
            const card = rest[i];
            card.sym = pool[i];
            card.el.innerHTML = '<span class="link-face">' + SYMBOLS[card.sym] + '</span>';
        }
        clearSelection();
    }

    function shuffleUntilPlayable() {
        for (let i = 0; i < 40; i++) {
            if (findAnyPair()) return;
            reshuffleSymbols();
        }
    }

    function doShuffle() {
        if (state !== 'playing' || shuffleLeft <= 0 || busy) return;
        shuffleLeft -= 1;
        reshuffleSymbols();
        shuffleUntilPlayable();
        combo = 0;
        updateHud();
    }

    function doHint() {
        if (state !== 'playing' || hintLeft <= 0 || busy) return;
        const pair = findAnyPair();
        if (!pair) {
            doShuffle();
            return;
        }

        hintLeft -= 1;
        updateHud();

        const a = pair[0];
        const b = pair[1];
        a.el.classList.add('hint');
        b.el.classList.add('hint');
        window.setTimeout(function () {
            a.el.classList.remove('hint');
            b.el.classList.remove('hint');
        }, 1200);
    }

    /* ---------- 流程 ---------- */
    function newGame() {
        buildBoard();
        state = 'ready';
        showOverlay('ready');
    }

    function begin() {
        hideOverlay();
        state = 'playing';
        startAt = performance.now();
        elapsed = 0;
        updateHud();
    }

    /* ---------- 事件 ---------- */
    boardEl.addEventListener('click', function (e) {
        const el = e.target.closest('.link-card');
        if (!el) return;
        const card = cards.get(el.dataset.r + ',' + el.dataset.c);
        if (card) onPick(card);
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'over') {
            newGame();
            begin();
        } else {
            begin();
        }
    });

    els.ovRestart.addEventListener('click', function () {
        newGame();
        begin();
    });
    els.restartBtn.addEventListener('click', function () {
        newGame();
        begin();
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        const next = btn.getAttribute('data-diff');
        if (!DIFFS[next] || next === diffKey) return;

        diffKey = next;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', all[i].getAttribute('data-diff') === diffKey);
        }
        newGame();
    });

    els.hintBtn.addEventListener('click', doHint);
    els.shuffleBtn.addEventListener('click', doShuffle);

    window.setInterval(function () {
        if (state !== 'playing') return;
        elapsed = performance.now() - startAt;
        updateHud();
    }, 200);

    /* ---------- 启动 ---------- */
    newGame();
})();
