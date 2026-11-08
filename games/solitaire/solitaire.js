/* ==========================================================
   接龙 Solitaire
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const SUIT_FONT = '"Apple Symbols", "Segoe UI Symbol", "Arial Unicode MS", serif';

    /* ---------- 版面 ---------- */
    const CW = 54;              // 牌宽
    const CH = 76;              // 牌高
    const STEP = 59;            // 槽位间距
    const TAB_Y = 212;          // 牌列起始纵坐标
    const TAB_BOTTOM = 556;     // 牌列允许的最深底部
    const TOP_Y = 124;          // 牌堆 / 基座纵坐标
    const DECK_X = 36;
    const WASTE_X = 95;
    const FOUND_X0 = 213;
    const GAP_UP = 25;          // 正面牌叠放间距
    const GAP_DOWN = 9;         // 背面牌叠放间距

    const SUITS = ['\u2660', '\u2665', '\u2663', '\u2666'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const RED = '#d63e3a';
    const BLACK = '#1c2533';

    const BEST_MOVES_KEY = 'webgames.solitaire.best-moves';
    const BEST_TIME_KEY = 'webgames.solitaire.best-time';

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
            return parseInt(window.localStorage.getItem(key), 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveNum(key, v) {
        try {
            window.localStorage.setItem(key, String(v));
        } catch (e) { /* 忽略隐私模式限制 */ }
    }

    function fmtTime(sec) {
        const s = Math.max(0, Math.floor(sec));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        moves: document.getElementById('moves'),
        time: document.getElementById('time'),
        done: document.getElementById('done'),
        bestMoves: document.getElementById('best-moves'),
        bestTime: document.getElementById('best-time'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        undoBtn: document.getElementById('undo-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 牌组状态 ---------- */
    let deck = [];
    let waste = [];
    let found = [[], [], [], []];
    let tab = [[], [], [], [], [], [], []];
    let undoStack = [];

    let state = 'ready';        // ready | playing | won
    let sel = null;             // { from:'tab'|'waste'|'found', col, idx }
    let moves = 0;
    let startedAt = 0;
    let finalSecs = 0;
    let bestMoves = loadNum(BEST_MOVES_KEY);
    let bestTime = loadNum(BEST_TIME_KEY);

    let fx = [];
    let clock = 0;
    let toastText = '';
    let toastT = 0;
    let hudCache = '';

    function COL_X(c) { return DECK_X + c * STEP; }
    function FOUND_X(i) { return FOUND_X0 + i * STEP; }
    function isRed(card) { return card.s === 1 || card.s === 3; }
    function foundCount() {
        return found[0].length + found[1].length + found[2].length + found[3].length;
    }
    function elapsedSeconds() {
        if (state === 'ready') return 0;
        if (state === 'won') return finalSecs;
        return Math.floor((Date.now() - startedAt) / 1000);
    }

    function toast(msg) {
        toastText = msg;
        toastT = 1.5;
    }

    function popFx(x, y, color) {
        fx.push({ x: x, y: y, t: 0, max: 0.44, color: color || '#8ef0bd' });
    }

    /* ---------- 发牌 ---------- */
    function buildDeck() {
        const all = [];
        for (let s = 0; s < 4; s++) {
            for (let r = 1; r <= 13; r++) {
                all.push({ s: s, r: r, up: false });
            }
        }
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = all[i];
            all[i] = all[j];
            all[j] = t;
        }
        return all;
    }

    function startGame() {
        deck = buildDeck();
        waste = [];
        found = [[], [], [], []];
        tab = [[], [], [], [], [], [], []];
        undoStack = [];
        moves = 0;
        sel = null;
        fx = [];
        toastT = 0;
        finalSecs = 0;

        for (let c = 0; c < 7; c++) {
            for (let k = 0; k <= c; k++) {
                const card = deck.pop();
                card.up = (k === c);
                tab[c].push(card);
            }
        }

        state = 'playing';
        startedAt = Date.now();
        hudCache = '';
        els.overlay.classList.remove('show');
        updateHud();
    }

    /* ---------- 规则 ---------- */
    function canPlaceTab(card, top) {
        if (!top) return card.r === 13;
        return top.up && top.r === card.r + 1 && isRed(top) !== isRed(card);
    }

    function canPlaceFound(card, idx) {
        // 每个基座固定一种花色（槽位上有花色标记）
        if (idx !== card.s) return false;
        const pile = found[idx];
        if (!pile.length) return card.r === 1;
        const top = pile[pile.length - 1];
        return top.s === card.s && card.r === top.r + 1;
    }

    function isValidRun(col, idx) {
        const list = tab[col];
        if (idx < 0 || idx >= list.length) return false;
        for (let i = idx; i < list.length; i++) {
            if (!list[i].up) return false;
        }
        for (let i = idx; i < list.length - 1; i++) {
            if (list[i].r !== list[i + 1].r + 1) return false;
            if (isRed(list[i]) === isRed(list[i + 1])) return false;
        }
        return true;
    }

    function getSelectedCards() {
        if (!sel) return null;
        if (sel.from === 'waste') {
            return waste.length ? [waste[waste.length - 1]] : null;
        }
        if (sel.from === 'found') {
            const pile = found[sel.idx];
            return pile.length ? [pile[pile.length - 1]] : null;
        }
        const list = tab[sel.col];
        if (sel.idx < 0 || sel.idx >= list.length) return null;
        return list.slice(sel.idx);
    }

    /* ---------- 撤销 ---------- */
    function snapshot() {
        undoStack.push(JSON.stringify({ d: deck, w: waste, f: found, t: tab, m: moves }));
        if (undoStack.length > 240) undoStack.shift();
    }

    function undoMove() {
        if (state !== 'playing') return;
        if (!undoStack.length) {
            toast('没有可以撤销的步骤');
            return;
        }
        const s = JSON.parse(undoStack.pop());
        deck = s.d;
        waste = s.w;
        found = s.f;
        tab = s.t;
        moves = s.m;
        sel = null;
        hudCache = '';
        updateHud();
    }

    function flipTop(col) {
        const list = tab[col];
        if (list.length && !list[list.length - 1].up) {
            list[list.length - 1].up = true;
            popFx(COL_X(col) + CW / 2, TAB_Y + 20, '#ffe08a');
        }
    }

    /* ---------- 抽牌 ---------- */
    function drawFromDeck() {
        if (state !== 'playing') return;
        if (!deck.length) {
            if (!waste.length) {
                toast('牌堆和弃牌区都空了');
                return;
            }
            snapshot();
            deck = waste.reverse();
            for (let i = 0; i < deck.length; i++) deck[i].up = false;
            waste = [];
            moves++;
            sel = null;
            toast('弃牌翻回牌堆');
            hudCache = '';
            updateHud();
            return;
        }
        snapshot();
        const card = deck.pop();
        card.up = true;
        waste.push(card);
        moves++;
        sel = null;
        hudCache = '';
        updateHud();
    }

    /* ---------- 走子 ---------- */
    function takeCards() {
        if (sel.from === 'waste') {
            waste.pop();
        } else if (sel.from === 'found') {
            found[sel.idx].pop();
        } else {
            tab[sel.col].length = sel.idx;
            flipTop(sel.col);
        }
    }

    function tryMoveToTab(col) {
        const moving = getSelectedCards();
        if (!moving || !moving.length) return false;
        const dest = tab[col];
        const top = dest.length ? dest[dest.length - 1] : null;
        if (!canPlaceTab(moving[0], top)) return false;

        snapshot();
        takeCards();
        for (let i = 0; i < moving.length; i++) dest.push(moving[i]);
        moves++;
        sel = null;
        popFx(COL_X(col) + CW / 2, TAB_Y + 24, '#8ef0bd');
        hudCache = '';
        updateHud();
        return true;
    }

    function tryMoveToFound(idx) {
        const moving = getSelectedCards();
        if (!moving || moving.length !== 1) return false;
        if (!canPlaceFound(moving[0], idx)) return false;

        snapshot();
        takeCards();
        found[idx].push(moving[0]);
        moves++;
        sel = null;
        popFx(FOUND_X(idx) + CW / 2, TOP_Y + CH / 2, '#ffe08a');
        hudCache = '';
        updateHud();
        checkWin();
        return true;
    }

    function checkWin() {
        if (foundCount() < 52) return;
        state = 'won';
        finalSecs = Math.floor((Date.now() - startedAt) / 1000);
        if (!bestMoves || moves < bestMoves) {
            bestMoves = moves;
            saveNum(BEST_MOVES_KEY, bestMoves);
        }
        if (!bestTime || finalSecs < bestTime) {
            bestTime = finalSecs;
            saveNum(BEST_TIME_KEY, bestTime);
        }
        els.ovTitle.textContent = '接龙完成';
        els.ovDesc.textContent = '用 ' + moves + ' 步、' + fmtTime(finalSecs) + ' 把 52 张牌全部收进基座。';
        els.ovScore.innerHTML = '步数 <b>' + moves + '</b> · 用时 ' + fmtTime(finalSecs) +
            '<br>最少步数 ' + bestMoves + ' · 最快用时 ' + fmtTime(bestTime);
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 布局计算 ---------- */
    function cardYs(col) {
        const list = tab[col];
        const ys = [];
        if (!list.length) return ys;

        let base = 0;
        for (let i = 0; i < list.length - 1; i++) {
            base += list[i].up ? GAP_UP : GAP_DOWN;
        }
        const avail = TAB_BOTTOM - TAB_Y - CH;
        const k = base > avail ? avail / base : 1;

        let y = TAB_Y;
        for (let i = 0; i < list.length; i++) {
            ys.push(y);
            if (i < list.length - 1) y += (list[i].up ? GAP_UP : GAP_DOWN) * k;
        }
        return ys;
    }

    /* ---------- 命中判定 ---------- */
    function inRect(px, py, x, y, w, h) {
        return px >= x && px <= x + w && py >= y && py <= y + h;
    }

    function hitTest(px, py) {
        if (inRect(px, py, DECK_X, TOP_Y, CW, CH)) return { from: 'deck' };
        if (inRect(px, py, WASTE_X, TOP_Y, CW + 12, CH)) return { from: 'waste' };
        for (let i = 0; i < 4; i++) {
            if (inRect(px, py, FOUND_X(i), TOP_Y, CW, CH)) {
                return { from: found[i].length ? 'found' : 'foundEmpty', idx: i };
            }
        }
        for (let c = 0; c < 7; c++) {
            const x = COL_X(c);
            if (px < x || px > x + CW) continue;
            const list = tab[c];
            if (!list.length) {
                if (py >= TAB_Y && py <= TAB_Y + CH) return { from: 'tabEmpty', col: c };
                continue;
            }
            const ys = cardYs(c);
            for (let i = list.length - 1; i >= 0; i--) {
                const top = ys[i];
                const bot = (i === list.length - 1) ? top + CH : ys[i + 1] + 2;
                if (py >= top && py < bot) return { from: 'tab', col: c, idx: i };
            }
            if (py >= TAB_Y && py <= TAB_BOTTOM) {
                return { from: 'tab', col: c, idx: list.length - 1 };
            }
        }
        return null;
    }

    function selSame(hit) {
        if (!sel) return false;
        if (sel.from !== hit.from) return false;
        if (sel.from === 'tab') return sel.col === hit.col && sel.idx === hit.idx;
        if (sel.from === 'found') return sel.idx === hit.idx;
        return true;
    }

    function selectAt(hit) {
        if (hit.from === 'tab') {
            if (!isValidRun(hit.col, hit.idx)) {
                toast('只有连续降序、红黑交替的牌能一起搬');
                return;
            }
            sel = { from: 'tab', col: hit.col, idx: hit.idx };
            return;
        }
        if (hit.from === 'waste') {
            if (!waste.length) return;
            sel = { from: 'waste' };
            return;
        }
        if (hit.from === 'found') {
            if (!found[hit.idx].length) return;
            sel = { from: 'found', idx: hit.idx };
        }
    }

    function onClick(px, py) {
        if (state !== 'playing') return;
        const hit = hitTest(px, py);
        if (!hit) {
            sel = null;
            return;
        }
        if (hit.from === 'deck') {
            drawFromDeck();
            return;
        }

        if (sel) {
            if (selSame(hit)) {
                sel = null;
                return;
            }
            if (sel.from === 'tab' && hit.from === 'tab' && hit.col === sel.col) {
                if (isValidRun(hit.col, hit.idx)) {
                    sel = { from: 'tab', col: hit.col, idx: hit.idx };
                } else {
                    sel = null;
                }
                return;
            }
            if (hit.from === 'tab' || hit.from === 'tabEmpty') {
                if (tryMoveToTab(hit.col)) return;
            } else if (hit.from === 'found' || hit.from === 'foundEmpty') {
                if (tryMoveToFound(hit.idx)) return;
            }
            sel = null;
        }

        selectAt(hit);
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const n = foundCount();
        const secs = elapsedSeconds();
        const key = [moves, secs, n, bestMoves, bestTime, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.moves.textContent = String(moves);
        els.time.textContent = fmtTime(secs);
        els.done.textContent = n + ' / 52';
        els.bestMoves.textContent = bestMoves ? String(bestMoves) : '--';
        els.bestTime.textContent = bestTime ? fmtTime(bestTime) : '--';
    }

    /* ---------- 绘制：背景 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b2c21');
        g.addColorStop(0.46, '#0d3627');
        g.addColorStop(1, '#05170f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const rg = ctx.createRadialGradient(240, 350, 30, 240, 350, 360);
        rg.addColorStop(0, 'rgba(120, 225, 170, .12)');
        rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);

        const vg = ctx.createRadialGradient(240, 300, 150, 240, 300, 400);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .46)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    /* ---------- 绘制：槽位 ---------- */
    function slotBase(x, y, mark) {
        roundRectPath(ctx, x, y, CW, CH, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, .035)';
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(150, 230, 190, .22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);

        if (mark) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = mark === 'K' ? '800 15px ' + FONT : '20px ' + SUIT_FONT;
            ctx.fillStyle = 'rgba(170, 235, 200, .26)';
            ctx.fillText(mark, x + CW / 2, y + CH / 2);
            ctx.restore();
        }
    }

    /* ---------- 绘制：牌 ---------- */
    function drawBack(x, y) {
        roundRectPath(ctx, x, y, CW, CH, 6);
        const g = ctx.createLinearGradient(x, y, x + CW, y + CH);
        g.addColorStop(0, '#2b4272');
        g.addColorStop(1, '#152340');
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        roundRectPath(ctx, x, y, CW, CH, 6);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 255, 255, .085)';
        ctx.lineWidth = 1;
        for (let i = -CH; i < CW + CH; i += 7) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + CH, y + CH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + i, y + CH);
            ctx.lineTo(x + i + CH, y);
            ctx.stroke();
        }
        ctx.restore();

        roundRectPath(ctx, x + 3, y + 3, CW - 6, CH - 6, 4);
        ctx.strokeStyle = 'rgba(165, 205, 255, .26)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const cx = x + CW / 2;
        const cy = y + CH / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx + 6.5, cy);
        ctx.lineTo(cx, cy + 9);
        ctx.lineTo(cx - 6.5, cy);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(180, 215, 255, .42)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }

    function cornerMark(x, y, card, col) {
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '800 15px ' + FONT;
        ctx.fillText(RANKS[card.r - 1], x, y);
        ctx.font = '12px ' + SUIT_FONT;
        ctx.fillText(SUITS[card.s], x, y + 18);
    }

    function drawFace(x, y, card) {
        roundRectPath(ctx, x, y, CW, CH, 6);
        const g = ctx.createLinearGradient(x, y, x, y + CH);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#e6ebe7');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(16, 38, 30, .28)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const col = isRed(card) ? RED : BLACK;

        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '36px ' + SUIT_FONT;
        ctx.fillStyle = col;
        ctx.fillText(SUITS[card.s], x + CW / 2, y + CH / 2 + 2);
        ctx.restore();

        ctx.save();
        cornerMark(x + 6, y + 5, card, col);
        ctx.restore();

        ctx.save();
        ctx.translate(x + CW - 6, y + CH - 5);
        ctx.rotate(Math.PI);
        cornerMark(0, 0, card, col);
        ctx.restore();
    }

    function drawCard(x, y, card, isSel) {
        if (!card.up) {
            drawBack(x, y);
        } else {
            drawFace(x, y, card);
        }
        if (isSel) {
            ctx.save();
            ctx.shadowColor = 'rgba(255, 208, 96, .95)';
            ctx.shadowBlur = 11;
            roundRectPath(ctx, x - 0.5, y - 0.5, CW + 1, CH + 1, 6.5);
            ctx.strokeStyle = 'rgba(255, 214, 110, 1)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    }

    function hintBox(x, y) {
        ctx.save();
        roundRectPath(ctx, x - 2, y - 2, CW + 4, CH + 4, 8);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(120, 255, 190, .8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    /* ---------- 绘制：牌区 ---------- */
    function drawTopRow() {
        if (deck.length) {
            drawCard(DECK_X, TOP_Y, { s: 0, r: 1, up: false }, false);
            ctx.save();
            roundRectPath(ctx, DECK_X + CW - 34, TOP_Y + CH - 21, 32, 17, 8.5);
            ctx.fillStyle = 'rgba(6, 20, 15, .72)';
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '700 10.5px ' + FONT;
            ctx.fillStyle = 'rgba(186, 236, 210, .9)';
            ctx.fillText(String(deck.length), DECK_X + CW - 18, TOP_Y + CH - 12.5);
            ctx.restore();
        } else {
            slotBase(DECK_X, TOP_Y, '');
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '700 15px ' + FONT;
            ctx.fillStyle = 'rgba(170, 235, 200, .34)';
            ctx.fillText('\u21bb', DECK_X + CW / 2, TOP_Y + CH / 2);
            ctx.restore();
        }

        const n = waste.length;
        if (!n) {
            slotBase(WASTE_X, TOP_Y, '');
        } else {
            const from = Math.max(0, n - 3);
            for (let i = from; i < n; i++) {
                const off = (i - from) * 6;
                const isSel = !!(sel && sel.from === 'waste' && i === n - 1);
                drawCard(WASTE_X + off, TOP_Y - (isSel ? 3 : 0), waste[i], isSel);
            }
        }

        for (let i = 0; i < 4; i++) {
            const x = FOUND_X(i);
            const pile = found[i];
            if (!pile.length) {
                slotBase(x, TOP_Y, SUITS[i]);
                continue;
            }
            const isSel = !!(sel && sel.from === 'found' && sel.idx === i);
            drawCard(x, TOP_Y - (isSel ? 3 : 0), pile[pile.length - 1], isSel);
        }
    }

    function drawTableau() {
        for (let c = 0; c < 7; c++) {
            const x = COL_X(c);
            const list = tab[c];
            if (!list.length) {
                slotBase(x, TAB_Y, 'K');
                continue;
            }
            const ys = cardYs(c);
            for (let i = 0; i < list.length; i++) {
                const partOfRun = !!(sel && sel.from === 'tab' && sel.col === c && i >= sel.idx);
                drawCard(x, ys[i] - (partOfRun ? 3 : 0), list[i], partOfRun);
            }
        }
    }

    function drawHints() {
        if (!sel || state !== 'playing') return;
        const moving = getSelectedCards();
        if (!moving || !moving.length) return;
        const card = moving[0];

        if (moving.length === 1) {
            for (let i = 0; i < 4; i++) {
                if (canPlaceFound(card, i)) hintBox(FOUND_X(i), TOP_Y);
            }
        }
        for (let c = 0; c < 7; c++) {
            if (sel.from === 'tab' && sel.col === c) continue;
            const dest = tab[c];
            const top = dest.length ? dest[dest.length - 1] : null;
            if (!canPlaceTab(card, top)) continue;
            const ys = cardYs(c);
            const y = ys.length ? ys[ys.length - 1] : TAB_Y;
            hintBox(COL_X(c), y);
        }
    }

    function drawFx() {
        ctx.save();
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const a = 1 - p.t / p.max;
            const r = 10 + (1 - a) * 26;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, TAU);
            ctx.strokeStyle = 'rgba(142, 240, 189, ' + (a * 0.8) + ')';
            ctx.lineWidth = 2.2 * a + 0.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ---------- 绘制：界面 ---------- */
    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 214, 180, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('SOLITAIRE', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf6ee';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('接龙', W / 2, 49);

        const bx = 96;
        const bw = W - 192;
        const by = 66;
        const bh = 4;
        roundRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.fillStyle = 'rgba(160, 220, 185, .18)';
        ctx.fill();

        const k = foundCount() / 52;
        if (k > 0) {
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            g.addColorStop(0, 'rgba(110, 228, 175, .92)');
            g.addColorStop(1, 'rgba(255, 214, 120, .96)');
            roundRectPath(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(172, 214, 190, .64)';
        ctx.fillText('步数 ' + moves + ' · 用时 ' + fmtTime(elapsedSeconds()) +
            ' · 完成 ' + foundCount() + '/52', W / 2, 88);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(158, 204, 178, .52)';
        ctx.fillText('点牌选中 · 再点目标放下 · 空格抽牌 · Z 撤销', W / 2, 574);
        ctx.restore();
    }

    function drawToast() {
        if (toastT <= 0) return;
        const a = Math.min(1, toastT * 2.2);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '700 12px ' + FONT;
        const tw = ctx.measureText(toastText).width;
        const pw = tw + 30;
        const px = (W - pw) / 2;
        const py = 500;
        roundRectPath(ctx, px, py, pw, 26, 13);
        ctx.fillStyle = 'rgba(6, 24, 18, .88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(140, 240, 195, .38)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(216, 250, 233, .95)';
        ctx.fillText(toastText, W / 2, py + 13.5);
        ctx.restore();
    }

    function draw() {
        drawBg();
        drawTableau();
        drawTopRow();
        drawHints();
        drawFx();
        drawHeader();
        drawFooter();
        drawToast();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (toastT > 0) toastT = Math.max(0, toastT - dt);
        for (let i = fx.length - 1; i >= 0; i--) {
            fx[i].t += dt;
            if (fx[i].t >= fx[i].max) fx.splice(i, 1);
        }
        updateHud();
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
        onClick(p.x, p.y);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyZ') {
            e.preventDefault();
            undoMove();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        } else if (e.code === 'Space') {
            e.preventDefault();
            if (state === 'playing') drawFromDeck();
        } else if (e.code === 'Escape') {
            sel = null;
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);
    els.undoBtn.addEventListener('click', undoMove);

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

    updateHud();
    requestAnimationFrame(loop);
})();
