/* ==========================================================
   记忆翻牌 Memory Match
   ========================================================== */
(function () {
    'use strict';

    const LEVELS = {
        easy: { cols: 4, rows: 4, pairs: 8, label: '4×4', bestKey: 'webgames.memory.best.easy' },
        medium: { cols: 5, rows: 4, pairs: 10, label: '5×4', bestKey: 'webgames.memory.best.medium' },
        hard: { cols: 6, rows: 4, pairs: 12, label: '6×4', bestKey: 'webgames.memory.best.hard' }
    };

    const SYMBOLS = [
        {
            id: 'star', color: '#ffc548',
            svg: '<path d="M24 4.5l5.9 12.6 13.6 1.7-9.9 9.3 2.6 13.4L24 35.2 11.8 41.5l2.6-13.4-9.9-9.3 13.6-1.7z"/>'
        },
        {
            id: 'heart', color: '#ff5c6c',
            svg: '<path d="M24 41.5S5.8 30.6 5.8 18.9A9.9 9.9 0 0 1 24 12.6a9.9 9.9 0 0 1 18.2 6.3C42.2 30.6 24 41.5 24 41.5z"/>'
        },
        {
            id: 'ring', color: '#4f8cff',
            svg: '<circle cx="24" cy="24" r="14.5" fill="none" stroke="currentColor" stroke-width="6"/>'
        },
        {
            id: 'triangle', color: '#2fd48b',
            svg: '<path d="M24 6L43 39H5z"/>'
        },
        {
            id: 'diamond', color: '#9d5bff',
            svg: '<path d="M24 4l19 20-19 20L5 24z"/>'
        },
        {
            id: 'moon', color: '#5ad2ff',
            svg: '<path d="M31 5a19 19 0 1 0 11.6 32.4A15.5 15.5 0 0 1 31 5z"/>'
        },
        {
            id: 'bolt', color: '#ff9f43',
            svg: '<path d="M28 3L10 27h11l-4 18 19-25H24z"/>'
        },
        {
            id: 'hex', color: '#3ad0e0',
            svg: '<path d="M24 4l17.3 10v20L24 44 6.7 34V14z"/>'
        },
        {
            id: 'plus', color: '#ff6fbf',
            svg: '<path d="M19 5h10v14h14v10H29v14H19V29H5V19h14z"/>'
        },
        {
            id: 'drop', color: '#7ea7ff',
            svg: '<path d="M24 4c8.4 10.6 14 17.6 14 24.4A14 14 0 0 1 10 28.4C10 21.6 15.6 14.6 24 4z"/>'
        },
        {
            id: 'flower', color: '#f2a65a',
            svg: '<circle cx="24" cy="13" r="8"/><circle cx="24" cy="35" r="8"/><circle cx="13" cy="24" r="8"/>'
                + '<circle cx="35" cy="24" r="8"/><circle cx="24" cy="24" r="5" fill="#121a26"/>'
        },
        {
            id: 'target', color: '#4fd1a5',
            svg: '<circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="4"/>'
                + '<circle cx="24" cy="24" r="4.5"/>'
        }
    ];

    const BACK_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6">'
        + '<rect x="12" y="12" width="24" height="24" rx="4" transform="rotate(45 24 24)"/>'
        + '<circle cx="24" cy="24" r="3.4" fill="currentColor" stroke="none"/></svg>';

    const els = {
        board: document.getElementById('board'),
        moves: document.getElementById('moves'),
        time: document.getElementById('time'),
        pairs: document.getElementById('pairs'),
        best: document.getElementById('best'),
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

    /* ---------- 状态 ---------- */
    let difficulty = 'easy';
    let cols = 4;
    let pairs = 8;
    let state = 'ready';       // ready | playing | win
    let firstCard = null;
    let lock = false;
    let moves = 0;
    let matchedCount = 0;
    let startTime = 0;
    let elapsed = 0;
    let lastSec = -1;

    function fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        if (s < 60) return s + 's';
        const m = Math.floor(s / 60);
        return m + ':' + String(s % 60).padStart(2, '0');
    }

    function bestOf(lv) {
        return Number(localStorage.getItem(LEVELS[lv].bestKey) || 0);
    }

    function updateHud() {
        els.moves.textContent = String(moves);
        els.pairs.textContent = matchedCount + ' / ' + pairs;
        const b = bestOf(difficulty);
        els.best.textContent = b > 0 ? String(b) : '--';
        els.time.textContent = fmtTime(elapsed);
    }

    /* ---------- 布局 ---------- */
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }

    function buildBoard() {
        const lv = LEVELS[difficulty];
        cols = lv.cols;
        pairs = lv.pairs;

        const picked = SYMBOLS.slice(0, pairs);
        const deck = [];
        picked.forEach(function (s) {
            deck.push(s);
            deck.push(s);
        });
        shuffle(deck);

        els.board.style.setProperty('--cols', cols);
        els.board.innerHTML = '';

        const frag = document.createDocumentFragment();
        deck.forEach(function (sym) {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.dataset.sym = sym.id;
            card.style.setProperty('--card-color', sym.color);
            card.style.setProperty('--card-edge', sym.color + '66');
            card.innerHTML = '<div class="memory-card-inner">'
                + '<div class="memory-face memory-front">' + BACK_ICON + '</div>'
                + '<div class="memory-face memory-back">'
                + '<svg viewBox="0 0 48 48" fill="currentColor">' + sym.svg + '</svg>'
                + '</div></div>';
            card.addEventListener('click', function () {
                flip(card);
            });
            frag.appendChild(card);
        });
        els.board.appendChild(frag);
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        const lv = LEVELS[difficulty];
        if (kind === 'ready') {
            els.ovTitle.textContent = '记忆翻牌';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '每次翻开两张牌，图案相同即配对成功。用最少的步数找出全部配对。当前难度：'
                + lv.label + '，共 ' + lv.pairs + ' 对图案。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始游戏';
            els.ovRestart.hidden = true;
        } else if (kind === 'win') {
            const prev = bestOf(difficulty);
            const isRecord = prev === 0 || moves < prev;
            if (isRecord) localStorage.setItem(LEVELS[difficulty].bestKey, String(moves));

            els.ovTitle.textContent = isRecord ? '新纪录！' : '全部配对完成';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '共 ' + lv.pairs + ' 对图案，用了 ' + moves + ' 步、' + fmtTime(elapsed) + ' 完成。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(moves);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
            updateHud();
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 游戏流程 ---------- */
    function reset(showReady) {
        firstCard = null;
        lock = false;
        moves = 0;
        matchedCount = 0;
        startTime = 0;
        elapsed = 0;
        lastSec = -1;
        state = 'ready';
        buildBoard();
        updateHud();
        if (showReady) showOverlay('ready');
        else hideOverlay();
    }

    function begin() {
        reset(false);
        state = 'playing';
        hideOverlay();
    }

    function win() {
        state = 'win';
        if (startTime) elapsed = performance.now() - startTime;
        startTime = 0;
        updateHud();
        setTimeout(function () {
            showOverlay('win');
        }, 520);
    }

    function flip(card) {
        if (state !== 'playing' || lock) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

        card.classList.add('flipped');
        moves++;
        if (!startTime) startTime = performance.now();
        updateHud();

        if (!firstCard) {
            firstCard = card;
            return;
        }

        const a = firstCard;
        const b = card;
        firstCard = null;

        if (a.dataset.sym === b.dataset.sym) {
            setTimeout(function () {
                a.classList.add('matched');
                b.classList.add('matched');
                matchedCount++;
                updateHud();
                if (matchedCount === pairs) win();
            }, 240);
            return;
        }

        lock = true;
        a.classList.add('wrong');
        b.classList.add('wrong');
        setTimeout(function () {
            a.classList.remove('flipped', 'wrong');
            b.classList.remove('flipped', 'wrong');
            lock = false;
        }, 780);
    }

    /* ---------- 事件 ---------- */
    els.ovBtn.addEventListener('click', function () {
        if (state === 'ready') {
            state = 'playing';
            startTime = 0;
            hideOverlay();
        } else {
            begin();
        }
    });

    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        const next = btn.getAttribute('data-diff');
        if (!LEVELS[next] || next === difficulty) return;
        difficulty = next;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', all[i] === btn);
        }
        reset(true);
    });

    /* ---------- 计时 ---------- */
    function loop() {
        if (state === 'playing' && startTime) {
            elapsed = performance.now() - startTime;
            const sec = Math.floor(elapsed / 1000);
            if (sec !== lastSec) {
                lastSec = sec;
                els.time.textContent = fmtTime(elapsed);
            }
        }
        requestAnimationFrame(loop);
    }

    /* ---------- 启动 ---------- */
    reset(true);
    loop();
})();
