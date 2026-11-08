/* ==========================================================
   羊了个羊 Sheep Stack
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 580;
    const CARD_W = 60;
    const CARD_H = 72;
    const COLS = 5;
    const ROWS = 3;
    const PILE_X = 90;
    const PILE_Y = 92;
    const LAYER_X = 30;
    const LAYER_Y = 34;
    const SLOT_COUNT = 7;
    const SLOT_W = 60;
    const SLOT_GAP = 2;
    const SLOT_X = 24;
    const SLOT_Y = 420;
    const BLOCK_RATIO = 0.18;
    const BEST_PREFIX = 'webgames.sheep.best.';

    const LEVELS = {
        easy: { cards: 27, layers: 2, label: '轻松' },
        normal: { cards: 36, layers: 3, label: '标准' },
        hell: { cards: 45, layers: 3, label: '地狱' }
    };

    const SYMBOLS = [
        {
            id: 'sheep',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<circle cx="16" cy="21" r="9" fill="#eef4ff"/>' +
                '<circle cx="27" cy="16" r="10" fill="#eef4ff"/>' +
                '<circle cx="33" cy="25" r="8.6" fill="#eef4ff"/>' +
                '<circle cx="23" cy="27" r="9" fill="#eef4ff"/>' +
                '<ellipse cx="24" cy="26" rx="7" ry="6.4" fill="#3b4a63"/>' +
                '<circle cx="21.6" cy="24.6" r="1.5" fill="#fff"/>' +
                '<circle cx="26.4" cy="24.6" r="1.5" fill="#fff"/>' +
                '<ellipse cx="24" cy="29" rx="2" ry="1.4" fill="#8b9bb4"/>' +
                '</svg>'
        },
        {
            id: 'carrot',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M24 41L15.5 20h17z" fill="#ff9f43"/>' +
                '<path d="M19.5 26h9M21.5 31h5" stroke="#e07d1f" stroke-width="1.6" stroke-linecap="round"/>' +
                '<path d="M24 19c-2-5 1-8 4-9-1 4 .2 6 2 8-2 1-4 1-6 1z" fill="#2fd48b"/>' +
                '<path d="M23 19c-3-4-6-4-8-3 2 3 4 4 8 3z" fill="#27c07d"/>' +
                '</svg>'
        },
        {
            id: 'corn',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<ellipse cx="24" cy="25" rx="8" ry="14" fill="#ffc548"/>' +
                '<path d="M24 12v26M19 15v19M29 15v19" stroke="#e0a51d" stroke-width="1.4"/>' +
                '<path d="M18 14c-4 5-5 10-4 14 3-3 5-8 6-12z" fill="#2fd48b"/>' +
                '<path d="M30 14c4 5 5 10 4 14-3-3-5-8-6-12z" fill="#27c07d"/>' +
                '</svg>'
        },
        {
            id: 'bell',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M24 9c-5.5 0-9 4.6-9 10 0 5-1.6 7.6-4 9.4h26c-2.4-1.8-4-4.4-4-9.4 0-5.4-3.5-10-9-10z" fill="#ffd873"/>' +
                '<path d="M24 9c-5.5 0-9 4.6-9 10v1h18v-1c0-5.4-3.5-10-9-10z" fill="#ffe9a8"/>' +
                '<rect x="18" y="28.4" width="12" height="2.6" rx="1.3" fill="#c99a2e"/>' +
                '<circle cx="24" cy="35" r="3.2" fill="#ffd873" stroke="#c99a2e" stroke-width="1.3"/>' +
                '</svg>'
        },
        {
            id: 'leaf',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M37 11C22 11 11 20 11 33c0 1.8.4 3.4.4 3.4S16 37 20 37c13 0 17-13 17-26z" fill="#2fd48b"/>' +
                '<path d="M34 15C26 21 20 27 15 35" stroke="#1a8f62" stroke-width="1.8" stroke-linecap="round"/>' +
                '</svg>'
        },
        {
            id: 'star',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M24 8l4.7 9.9 10.8 1.4-7.9 7.5 2 10.7L24 32.4l-9.6 5.1 2-10.7-7.9-7.5 10.8-1.4z" fill="#5ad2ff"/>' +
                '</svg>'
        },
        {
            id: 'heart',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M24 39S11 31 11 22.6a7.2 7.2 0 0 1 13-4.1 7.2 7.2 0 0 1 13 4.1C37 31 24 39 24 39z" fill="#ff5c6c"/>' +
                '<path d="M17 19c-1.4 1-2 2.4-2 3.8" stroke="#ffb3ba" stroke-width="1.8" stroke-linecap="round"/>' +
                '</svg>'
        },
        {
            id: 'mushroom',
            svg: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M8 25c0-8 7.2-14 16-14s16 6 16 14z" fill="#ff5c6c"/>' +
                '<circle cx="17" cy="19" r="2.6" fill="#ffe3e6"/>' +
                '<circle cx="28" cy="16.5" r="2" fill="#ffe3e6"/>' +
                '<circle cx="24" cy="22" r="1.6" fill="#ffe3e6"/>' +
                '<rect x="19" y="25" width="10" height="13" rx="4" fill="#ffe9d6"/>' +
                '</svg>'
        }
    ];

    const stage = document.getElementById('stage');
    const viewport = document.getElementById('viewport');

    const els = {
        left: document.getElementById('left'),
        slotText: document.getElementById('slot-text'),
        cleared: document.getElementById('cleared'),
        moves: document.getElementById('moves'),
        best: document.getElementById('best'),
        shuffleBtn: document.getElementById('shuffle-btn'),
        undoBtn: document.getElementById('undo-btn'),
        restartBtn: document.getElementById('restart-btn'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart')
    };

    let cards = [];
    let slots = [];
    let pickStack = [];
    let diff = 'easy';
    let state = 'ready';       // ready | playing | over
    let moves = 0;
    let cleared = 0;
    let shuffleLeft = 1;
    let undoLeft = 1;
    let busy = false;
    let timers = [];
    let best = Number(localStorage.getItem(BEST_PREFIX + diff) || 0);

    /* ---------- 工具 ---------- */
    function shuffleArr(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }

    function later(fn, ms) {
        timers.push(setTimeout(fn, ms));
    }

    function clearTimers() {
        for (let i = 0; i < timers.length; i++) clearTimeout(timers[i]);
        timers = [];
    }

    /* ---------- 自适应缩放 ---------- */
    function fit() {
        const w = viewport.clientWidth || W;
        const s = Math.min(1, w / W);
        stage.style.transform = 'scale(' + s + ')';
        viewport.style.height = (H * s) + 'px';
    }

    /* ---------- 生成牌局 ---------- */
    function buildDeck(total) {
        const groups = Math.floor(total / 3);
        const deck = [];
        for (let i = 0; i < groups; i++) {
            const sym = SYMBOLS[i % SYMBOLS.length];
            deck.push(sym, sym, sym);
        }
        return shuffleArr(deck);
    }

    function buildPositions(count, layers) {
        const pool = [];
        for (let L = 0; L < layers; L++) {
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    pool.push({ L: L, r: r, c: c });
                }
            }
        }
        shuffleArr(pool);
        const result = pool.slice(0, count);
        result.sort(function (a, b) { return a.L - b.L; });
        return result;
    }

    function buildSlotBoxes() {
        const old = stage.querySelectorAll('.sheep-slot');
        for (let i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
        for (let i = 0; i < SLOT_COUNT; i++) {
            const box = document.createElement('div');
            box.className = 'sheep-slot';
            box.style.left = (SLOT_X + i * (SLOT_W + SLOT_GAP)) + 'px';
            box.style.top = SLOT_Y + 'px';
            stage.appendChild(box);
        }
    }

    function newGame() {
        clearTimers();
        for (let i = 0; i < cards.length; i++) {
            const el = cards[i].el;
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }

        cards = [];
        slots = [];
        pickStack = [];
        moves = 0;
        cleared = 0;
        shuffleLeft = 1;
        undoLeft = 1;
        busy = false;
        best = Number(localStorage.getItem(BEST_PREFIX + diff) || 0);

        buildSlotBoxes();

        const conf = LEVELS[diff];
        const deck = buildDeck(conf.cards);
        const positions = buildPositions(conf.cards, conf.layers);

        const mid = (conf.layers - 1) / 2;
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const off = pos.L - mid;
            const card = {
                sym: deck[i],
                L: pos.L,
                x: PILE_X + pos.c * CARD_W + off * LAYER_X,
                y: PILE_Y + pos.r * CARD_H + off * LAYER_Y,
                removed: false,
                inSlot: false,
                blocked: false,
                el: null,
                z: 0
            };
            card.z = pos.L * 100 + i;

            const el = document.createElement('div');
            el.className = 'sheep-card';
            el.innerHTML = card.sym.svg;
            el.style.left = card.x + 'px';
            el.style.top = card.y + 'px';
            el.style.zIndex = String(card.z);
            el.addEventListener('click', (function (c) {
                return function () { onPick(c); };
            })(card));

            stage.appendChild(el);
            card.el = el;
            cards.push(card);
        }

        state = 'playing';
        refreshBlocked();
        updateHud();
        hideOverlay();
    }

    /* ---------- 遮挡判定 ---------- */
    function isBlocked(card) {
        for (let i = 0; i < cards.length; i++) {
            const o = cards[i];
            if (o === card || o.removed || o.inSlot) continue;
            if (o.L <= card.L) continue;

            const dx = Math.min(card.x + CARD_W, o.x + CARD_W) - Math.max(card.x, o.x);
            if (dx <= 0) continue;
            const dy = Math.min(card.y + CARD_H, o.y + CARD_H) - Math.max(card.y, o.y);
            if (dy <= 0) continue;

            if (dx * dy >= BLOCK_RATIO * CARD_W * CARD_H) return true;
        }
        return false;
    }

    function refreshBlocked() {
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (card.removed || card.inSlot) continue;
            card.blocked = isBlocked(card);
            card.el.classList.toggle('blocked', card.blocked);
        }
    }

    /* ---------- 槽位 ---------- */
    function layoutSlots() {
        for (let i = 0; i < slots.length; i++) {
            const card = slots[i];
            card.el.style.left = (SLOT_X + i * (SLOT_W + SLOT_GAP)) + 'px';
            card.el.style.top = SLOT_Y + 'px';
            card.el.style.zIndex = String(900 + i);
        }
    }

    /* 牌堆中还没被拿走的牌（不含已进入槽位的牌） */
    function countLeft() {
        let n = 0;
        for (let i = 0; i < cards.length; i++) {
            if (!cards[i].removed && !cards[i].inSlot) n++;
        }
        return n;
    }

    function updateHud() {
        els.left.textContent = String(countLeft());
        els.slotText.textContent = slots.length + ' / ' + SLOT_COUNT;
        els.cleared.textContent = String(cleared);
        els.moves.textContent = String(moves);
        els.best.textContent = best ? String(best) : '--';
        els.shuffleBtn.textContent = '洗牌 ×' + shuffleLeft;
        els.undoBtn.textContent = '撤回 ×' + undoLeft;
        els.shuffleBtn.disabled = shuffleLeft <= 0 || state !== 'playing';
        els.undoBtn.disabled = undoLeft <= 0 || state !== 'playing';
    }

    /* ---------- 交互 ---------- */
    function nudge(card) {
        card.el.classList.remove('nudge');
        void card.el.offsetWidth;
        card.el.classList.add('nudge');
        later(function () { card.el.classList.remove('nudge'); }, 260);
    }

    function onPick(card) {
        if (state !== 'playing' || busy) return;
        if (card.removed || card.inSlot) return;

        if (card.blocked) {
            nudge(card);
            return;
        }
        if (slots.length >= SLOT_COUNT) return;

        card.inSlot = true;
        card.el.classList.remove('blocked');
        card.el.classList.add('picked');

        let at = slots.length;
        for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i].sym.id === card.sym.id) {
                at = i + 1;
                break;
            }
        }
        slots.splice(at, 0, card);
        pickStack.push(card);
        moves += 1;

        layoutSlots();
        refreshBlocked();
        updateHud();

        const same = [];
        for (let i = 0; i < slots.length; i++) {
            if (slots[i].sym.id === card.sym.id) same.push(slots[i]);
        }

        if (same.length >= 3) {
            busy = true;
            later(function () { clearTrio(same.slice(0, 3)); }, 150);
        } else if (slots.length >= SLOT_COUNT) {
            state = 'over';
            later(function () { showOverlay('over'); }, 240);
        }
    }

    function removeEl(el) {
        later(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 240);
    }

    function clearTrio(trio) {
        for (let i = 0; i < trio.length; i++) {
            const card = trio[i];
            card.removed = true;
            card.inSlot = false;
            const at = slots.indexOf(card);
            if (at >= 0) slots.splice(at, 1);
            card.el.classList.add('gone');
            removeEl(card.el);
        }

        cleared += 3;
        busy = false;
        layoutSlots();
        refreshBlocked();
        updateHud();

        if (countLeft() === 0 && slots.length === 0) {
            state = 'over';
            if (!best || moves < best) {
                best = moves;
                localStorage.setItem(BEST_PREFIX + diff, String(best));
            }
            updateHud();
            later(function () { showOverlay('win'); }, 200);
        }
    }

    function doShuffle() {
        if (state !== 'playing' || shuffleLeft <= 0) return;

        const rest = [];
        for (let i = 0; i < cards.length; i++) {
            const c = cards[i];
            if (!c.removed && !c.inSlot) rest.push(c);
        }
        if (rest.length < 2) return;

        shuffleLeft -= 1;
        const spots = rest.map(function (c) {
            return { L: c.L, x: c.x, y: c.y };
        });
        shuffleArr(spots);

        for (let i = 0; i < rest.length; i++) {
            const c = rest[i];
            c.L = spots[i].L;
            c.x = spots[i].x;
            c.y = spots[i].y;
            c.z = c.L * 100 + i;
            c.el.style.left = c.x + 'px';
            c.el.style.top = c.y + 'px';
            c.el.style.zIndex = String(c.z);
        }

        refreshBlocked();
        updateHud();
    }

    function doUndo() {
        if (state !== 'playing' || undoLeft <= 0) return;

        let card = null;
        while (pickStack.length) {
            const c = pickStack.pop();
            if (c.inSlot && !c.removed) {
                card = c;
                break;
            }
        }
        if (!card) return;

        undoLeft -= 1;
        card.inSlot = false;
        const at = slots.indexOf(card);
        if (at >= 0) slots.splice(at, 1);

        card.el.classList.remove('picked');
        card.el.style.left = card.x + 'px';
        card.el.style.top = card.y + 'px';
        card.el.style.zIndex = String(card.z);

        layoutSlots();
        refreshBlocked();
        updateHud();
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '羊了个羊';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '点击没有被压住的牌放进下方槽位，三张相同图案自动消除。槽位只有七格，塞满就输了。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始挑战';
            els.ovRestart.hidden = true;
        } else if (kind === 'over') {
            els.ovTitle.textContent = '槽位塞满了';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '再想一步或许就能过关。已消除 ' + cleared + ' 张，牌堆还剩 ' + countLeft() + ' 张。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(moves);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        } else if (kind === 'win') {
            els.ovTitle.textContent = '全消通关';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '共 ' + moves + ' 步清空牌堆，试试更高难度？';
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
    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        const next = btn.getAttribute('data-diff');
        if (!LEVELS[next] || next === diff) return;

        diff = next;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) {
            all[i].classList.toggle('active', all[i].getAttribute('data-diff') === diff);
        }

        newGame();
        state = 'ready';
        showOverlay('ready');
    });

    els.shuffleBtn.addEventListener('click', doShuffle);
    els.undoBtn.addEventListener('click', doUndo);
    els.ovBtn.addEventListener('click', newGame);
    els.ovRestart.addEventListener('click', newGame);
    els.restartBtn.addEventListener('click', newGame);

    window.addEventListener('resize', fit);

    /* ---------- 启动 ---------- */
    newGame();
    state = 'ready';
    fit();
    showOverlay('ready');
})();
