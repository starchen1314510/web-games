/* ==========================================================
   二十四点 Make 24
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const CARD_W = 96;
    const CARD_H = 124;
    const CARD_GAP = 12;
    const CARD_Y = 122;

    const OP_R = 27;
    const OP_Y = 356;
    const OP_X = [120, 200, 280, 360];
    const OPS = ['+', '−', '×', '÷'];

    const ROUND_TIME = 90;
    const BEST_KEY = 'webgames.num24.best';

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

    /* ---------- 分数运算（保精度，避免 1/3 误差） ---------- */
    function gcd(a, b) {
        while (b) {
            const t = a % b;
            a = b;
            b = t;
        }
        return a || 1;
    }

    function frac(n, d) {
        if (d < 0) {
            n = -n;
            d = -d;
        }
        const g = gcd(Math.abs(n), Math.abs(d)) || 1;
        return { n: n / g, d: d / g };
    }

    function compute(a, b, op) {
        if (op === 0) return frac(a.n * b.d + b.n * a.d, a.d * b.d);
        if (op === 1) return frac(a.n * b.d - b.n * a.d, a.d * b.d);
        if (op === 2) return frac(a.n * b.n, a.d * b.d);
        if (b.n === 0) return null;
        return frac(a.n * b.d, a.d * b.n);
    }

    function cardText(c) {
        return c.d === 1 ? String(c.n) : c.n + '/' + c.d;
    }

    /* ---------- 出题：暴力求解器 ---------- */
    function trimParen(s) {
        let out = s;
        for (;;) {
            if (out.charAt(0) !== '(') return out;
            let depth = 0;
            let whole = false;
            for (let i = 0; i < out.length; i++) {
                if (out.charAt(i) === '(') depth++;
                else if (out.charAt(i) === ')') {
                    depth--;
                    if (depth === 0) {
                        whole = i === out.length - 1;
                        break;
                    }
                }
            }
            if (!whole) return out;
            out = out.slice(1, -1);
        }
    }

    function solve(list) {
        if (list.length === 1) {
            return Math.abs(list[0].v - 24) < 1e-6 ? list[0].expr : null;
        }
        for (let i = 0; i < list.length; i++) {
            for (let j = 0; j < list.length; j++) {
                if (i === j) continue;
                const a = list[i];
                const b = list[j];
                const rest = [];
                for (let k = 0; k < list.length; k++) {
                    if (k !== i && k !== j) rest.push(list[k]);
                }
                const cands = [
                    { v: a.v + b.v, expr: '(' + a.expr + ' + ' + b.expr + ')' },
                    { v: a.v - b.v, expr: '(' + a.expr + ' − ' + b.expr + ')' },
                    { v: a.v * b.v, expr: '(' + a.expr + ' × ' + b.expr + ')' }
                ];
                if (Math.abs(b.v) > 1e-9) {
                    cands.push({ v: a.v / b.v, expr: '(' + a.expr + ' ÷ ' + b.expr + ')' });
                }
                for (let c = 0; c < cands.length; c++) {
                    const found = solve(rest.concat([cands[c]]));
                    if (found) return found;
                }
            }
        }
        return null;
    }

    let lastKey = '';

    function genPuzzle(lv) {
        const maxN = lv <= 3 ? 9 : (lv <= 6 ? 10 : 13);
        for (let attempt = 0; attempt < 400; attempt++) {
            const nums = [];
            for (let i = 0; i < 4; i++) {
                const v = 1 + Math.floor(Math.random() * maxN);
                nums.push({ v: v, expr: String(v) });
            }
            const key = nums.map(function (o) { return o.v; }).sort(function (a, b) {
                return a - b;
            }).join(',');
            if (key === lastKey) continue;
            const expr = solve(nums);
            if (!expr) continue;
            lastKey = key;
            return { nums: nums.map(function (o) { return o.v; }), sol: trimParen(expr) };
        }
        return { nums: [4, 6, 8, 10], sol: '4 + 6 + 8 + 10' };
    }

    /* ---------- 画布与元素 ---------- */
    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        level: document.getElementById('level'),
        combo: document.getElementById('combo'),
        best: document.getElementById('best'),
        hint: document.getElementById('hint'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 状态 ---------- */
    let state = 'ready';          // ready | playing | over
    let level = 1;
    let score = 0;
    let combo = 0;
    let best = loadNum(BEST_KEY);
    let cards = [];
    let sel = [];
    let history = [];
    let hintUsed = false;
    let hintText = '';
    let left = ROUND_TIME;
    let lastExpr = '';
    let lastVal = '';
    let msg = '';
    let msgT = 0;
    let shake = 0;
    let clock = 0;
    let pending = 0;
    let passCount = 0;
    let banner = null;
    let hudCache = '';
    let hoverOp = -1;
    let pointer = { x: -99, y: -99 };

    /* ---------- 关卡流程 ---------- */
    function makeCards(nums) {
        cards = nums.map(function (v) {
            return { n: v, d: 1, expr: String(v), born: clock, lift: 0 };
        });
        sel = [];
    }

    function loadPuzzle() {
        const p = genPuzzle(level);
        makeCards(p.nums);
        hintText = p.sol;
        hintUsed = false;
        history = [];
        lastExpr = '';
        lastVal = '';
        left = ROUND_TIME;
        msg = '';
        msgT = 0;
        pending = 0;
        banner = null;
        sel = [];
        hudCache = '';
        updateHud();
    }

    function startGame() {
        state = 'playing';
        level = 1;
        score = 0;
        combo = 0;
        passCount = 0;
        lastKey = '';
        shake = 0;
        clock = 0;
        loadPuzzle();
        els.overlay.classList.remove('show');
    }

    function gameOver() {
        state = 'over';
        combo = 0;
        if (score > best) {
            best = score;
            saveNum(BEST_KEY, best);
        }
        els.ovTitle.textContent = '时间到';
        els.ovDesc.textContent = '这一局过了 ' + passCount + ' 题。算式凑不出 24 时可以先撤销，或者点提示看一种解法。';
        els.ovScore.innerHTML = '得分 <b>' + score + '</b><br>最佳得分 ' + best;
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    function nextPuzzle() {
        level++;
        loadPuzzle();
    }

    function win() {
        const c = cards[0];
        lastExpr = trimParen(c.expr);
        lastVal = '24';
        combo++;
        passCount++;
        const bonus = Math.min(combo - 1, 9) * 20;
        const gain = Math.max(10, 100 + bonus - (hintUsed ? 30 : 0));
        score += gain;
        if (score > best) {
            best = score;
            saveNum(BEST_KEY, best);
        }
        banner = {
            title: '凑出 24',
            sub: '+' + gain + ' 分 · 连击 ' + combo,
            t: 0,
            max: 1.6
        };
        pending = 1.5;
        hintUsed = false;
        sel = [];
        updateHud();
    }

    function fail() {
        combo = 0;
        shake = 1;
        msg = '结果不是 24 · 按 Z 撤销';
        msgT = 2.4;
        updateHud();
    }

    /* ---------- 操作 ---------- */
    function toast(text, sec) {
        msg = text;
        msgT = sec || 1.6;
    }

    function snapshot() {
        history.push({
            cards: cards.map(function (c) {
                return { n: c.n, d: c.d, expr: c.expr, born: c.born, lift: c.lift };
            }),
            sel: sel.slice(),
            lastExpr: lastExpr,
            lastVal: lastVal
        });
        if (history.length > 60) history.shift();
    }

    function undo() {
        if (!history.length) {
            toast('没有可以撤销的步骤');
            return;
        }
        const h = history.pop();
        cards = h.cards;
        sel = h.sel;
        lastExpr = h.lastExpr;
        lastVal = h.lastVal;
        msg = '';
        msgT = 0;
        updateHud();
    }

    function toggleSel(i) {
        if (pending > 0) return;
        const at = sel.indexOf(i);
        if (at >= 0) {
            sel.splice(at, 1);
            return;
        }
        if (sel.length >= 2) sel = [i];
        else sel.push(i);
        if (sel.length === 2) {
            msg = '选一个运算符合并这两张牌';
            msgT = 1.1;
        }
    }

    function applyOp(op) {
        if (pending > 0) return;
        if (sel.length !== 2) {
            toast('先选两张牌，再选运算符');
            return;
        }
        const ia = sel[0];
        const ib = sel[1];
        const a = cards[ia];
        const b = cards[ib];
        const res = compute(a, b, op);
        if (!res) {
            shake = 1;
            toast('不能除以 0');
            return;
        }
        snapshot();
        const expr = '(' + a.expr + ' ' + OPS[op] + ' ' + b.expr + ')';
        const rest = [];
        for (let i = 0; i < cards.length; i++) {
            if (i !== ia && i !== ib) rest.push(cards[i]);
        }
        rest.splice(Math.min(ia, ib), 0, {
            n: res.n, d: res.d, expr: expr, born: clock, lift: -9
        });
        cards = rest;
        sel = [];
        lastExpr = trimParen(expr);
        lastVal = cardText(res);
        msg = '';
        msgT = 0;

        if (cards.length === 1) {
            if (cards[0].d === 1 && cards[0].n === 24) win();
            else fail();
        }
        updateHud();
    }

    function useHint() {
        if (state !== 'playing' || pending > 0) return;
        if (hintUsed) {
            toast('本题的提示已经用掉了');
            return;
        }
        hintUsed = true;
        msg = '一种解法：' + hintText;
        msgT = 6;
        updateHud();
    }

    function cardX(i) {
        const n = cards.length;
        const total = n * CARD_W + (n - 1) * CARD_GAP;
        return (W - total) / 2 + i * (CARD_W + CARD_GAP);
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (msgT > 0) msgT -= dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 3);

        if (banner) {
            banner.t += dt;
            if (banner.t > banner.max) banner = null;
        }

        for (let i = 0; i < cards.length; i++) {
            const c = cards[i];
            const target = sel.indexOf(i) >= 0 ? -9 : 0;
            c.lift += (target - c.lift) * Math.min(1, dt * 15);
        }

        if (state !== 'playing') return;

        if (pending > 0) {
            pending -= dt;
            if (pending <= 0) nextPuzzle();
            return;
        }

        left -= dt;
        if (left <= 0) {
            left = 0;
            gameOver();
        }
    }

    function updateHud() {
        const key = [score, level, combo, best, left | 0, hintUsed, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.level.textContent = String(level);
        els.combo.textContent = String(combo);
        els.best.textContent = String(best);
        els.hint.textContent = hintUsed ? '已用' : '1';
    }

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1224');
        g.addColorStop(0.52, '#0e1a33');
        g.addColorStop(1, '#060a12');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 210, 40, W / 2, 210, 280);
        halo.addColorStop(0, 'rgba(90, 150, 255, .13)');
        halo.addColorStop(1, 'rgba(40, 70, 130, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 60, W, 380);

        // 细格底纹
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 160, 210, .05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 100);
            ctx.lineTo(x, 500);
            ctx.stroke();
        }
        for (let y = 100; y <= 500; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(146, 184, 214, .48)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('MAKE 24', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('二十四点', W / 2, 49);

        // 剩余牌数的进度点
        for (let i = 0; i < 4; i++) {
            const on = i < cards.length;
            ctx.beginPath();
            ctx.arc(W / 2 - 21 + i * 14, 70, 3.4, 0, TAU);
            ctx.fillStyle = on ? 'rgba(120, 200, 255, .9)' : 'rgba(110, 140, 175, .24)';
            ctx.fill();
        }

        const stateText = pending > 0
            ? '过关 · 准备下一题'
            : '第 ' + level + ' 题 · 剩余 ' + Math.ceil(left) + ' 秒';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = left < 15 && pending <= 0
            ? 'rgba(255, 150, 140, .9)'
            : 'rgba(150, 182, 208, .64)';
        ctx.fillText(stateText, W / 2, 90);
        ctx.restore();
    }

    function drawCard(c, i) {
        const x = cardX(i);
        const y = CARD_Y + c.lift;
        const selected = sel.indexOf(i) >= 0;

        const age = clock - c.born;
        let k = 1;
        if (age < 0.26) k = 0.84 + 0.16 * (age / 0.26);
        if (age < 0.02) k = 0.84;

        ctx.save();
        ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
        ctx.scale(k, k);
        ctx.translate(-CARD_W / 2, -CARD_H / 2);

        // 阴影
        ctx.save();
        ctx.shadowColor = 'rgba(2, 6, 14, .6)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 7;
        roundRectPath(ctx, 0, 0, CARD_W, CARD_H, 14);
        ctx.fillStyle = 'rgba(10, 18, 32, .9)';
        ctx.fill();
        ctx.restore();

        // 卡面
        const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
        g.addColorStop(0, '#fbfdff');
        g.addColorStop(0.62, '#eaf1fa');
        g.addColorStop(1, '#d8e3f2');
        roundRectPath(ctx, 0, 0, CARD_W, CARD_H, 14);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.strokeStyle = selected ? 'rgba(255, 197, 72, .95)' : 'rgba(120, 150, 190, .5)';
        ctx.lineWidth = selected ? 2.6 : 1.4;
        if (selected) {
            ctx.shadowColor = 'rgba(255, 197, 72, .75)';
            ctx.shadowBlur = 16;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 顶部装饰线
        ctx.beginPath();
        ctx.moveTo(12, 15);
        ctx.lineTo(CARD_W - 12, 15);
        ctx.strokeStyle = 'rgba(70, 105, 150, .22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 数字
        const txt = cardText(c);
        const size = txt.length >= 5 ? 26 : (txt.length === 4 ? 30 : (txt.length === 3 ? 34 : 44));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 ' + size + 'px ' + FONT;
        ctx.fillStyle = c.d === 1 && c.n === 24 ? '#c07800' : '#1a2740';
        ctx.fillText(txt, CARD_W / 2, CARD_H / 2 + 12);

        // 角标
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = 'rgba(70, 105, 150, .42)';
        ctx.textAlign = 'left';
        ctx.fillText('#' + (i + 1), 8, 27);

        ctx.restore();
    }

    function drawOps() {
        const ready = sel.length === 2;
        for (let i = 0; i < 4; i++) {
            const cx = OP_X[i];
            const hot = ready && hoverOp === i;

            ctx.beginPath();
            ctx.arc(cx, OP_Y, OP_R, 0, TAU);
            if (ready) {
                const g = ctx.createLinearGradient(cx - OP_R, OP_Y - OP_R, cx + OP_R, OP_Y + OP_R);
                g.addColorStop(0, hot ? 'rgba(96, 168, 255, .5)' : 'rgba(78, 140, 255, .28)');
                g.addColorStop(1, hot ? 'rgba(160, 112, 255, .5)' : 'rgba(140, 96, 255, .2)');
                ctx.fillStyle = g;
                ctx.fill();
                ctx.strokeStyle = hot ? 'rgba(190, 225, 255, .95)' : 'rgba(130, 190, 255, .8)';
                ctx.lineWidth = 2.2;
                ctx.shadowColor = 'rgba(96, 168, 255, .6)';
                ctx.shadowBlur = hot ? 18 : 10;
            } else {
                ctx.fillStyle = 'rgba(120, 152, 190, .06)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(120, 152, 190, .26)';
                ctx.lineWidth = 1.6;
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '700 26px ' + FONT;
            ctx.fillStyle = ready ? '#eaf6ff' : 'rgba(150, 178, 208, .42)';
            ctx.fillText(OPS[i], cx, OP_Y + 1);
        }
    }

    function drawExpr() {
        const bx = 34;
        const by = 402;
        const bw = W - 68;
        const bh = 62;

        roundRectPath(ctx, bx, by, bw, bh, 12);
        ctx.fillStyle = 'rgba(10, 20, 36, .62)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(110, 150, 195, .22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (lastExpr) {
            const done = lastVal === '24';
            ctx.font = '700 17px ' + FONT;
            ctx.fillStyle = done ? 'rgba(255, 214, 126, .96)' : 'rgba(214, 232, 248, .9)';
            ctx.fillText(fitText(lastExpr, 380, '700 17px ' + FONT), W / 2, by + 24);

            ctx.font = '700 13px ' + FONT;
            ctx.fillStyle = done ? 'rgba(255, 214, 126, .78)' : 'rgba(150, 182, 208, .7)';
            ctx.fillText('= ' + lastVal, W / 2, by + 46);
        } else {
            ctx.font = '700 14px ' + FONT;
            ctx.fillStyle = 'rgba(140, 172, 202, .55)';
            ctx.fillText('点两张牌，再用运算符合并', W / 2, by + 32);
        }
    }

    function fitText(text, maxW, font) {
        ctx.font = font;
        if (ctx.measureText(text).width <= maxW) return text;
        let out = text;
        while (out.length > 4 && ctx.measureText(out + '…').width > maxW) {
            out = out.slice(0, out.length - 1);
        }
        return out + '…';
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (msg && msgT > 0) {
            ctx.font = '700 12.5px ' + FONT;
            ctx.fillStyle = hintUsed && msg.indexOf('解法') === 0
                ? 'rgba(140, 230, 200, .95)'
                : 'rgba(255, 202, 152, .95)';
            ctx.fillText(fitText(msg, 430, '700 12.5px ' + FONT), W / 2, 500);
        } else {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(158, 196, 216, .6)';
            ctx.fillText('先选的牌在算式左边 · 90 秒内凑出 24', W / 2, 500);
        }

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(130, 160, 190, .46)';
        ctx.fillText('Z 撤销 · H 提示 · R 重开', W / 2, 574);
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const fade = Math.min(1, (banner.max - banner.t) * 5);
        const a = banner.t < 0.3 ? banner.t / 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = a * fade;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cy = 288;
        const g = ctx.createLinearGradient(56, 0, W - 56, 0);
        g.addColorStop(0, 'rgba(8, 18, 30, 0)');
        g.addColorStop(0.5, 'rgba(8, 18, 30, .92)');
        g.addColorStop(1, 'rgba(8, 18, 30, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(46, cy - 40, W - 92, 80);

        ctx.fillStyle = '#ffe4a3';
        ctx.font = '800 23px ' + FONT;
        ctx.fillText(banner.title, W / 2, cy - 10);

        ctx.fillStyle = 'rgba(190, 220, 240, .82)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, cy + 16);
        ctx.restore();
    }

    function draw() {
        drawBg();

        ctx.save();
        if (shake > 0) ctx.translate(Math.sin(clock * 62) * shake * 3.4, 0);
        for (let i = 0; i < cards.length; i++) drawCard(cards[i], i);
        ctx.restore();

        drawOps();
        drawExpr();
        drawHeader();
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
        if (state !== 'playing' || pending > 0) return;

        for (let i = 0; i < 4; i++) {
            if (Math.hypot(p.x - OP_X[i], p.y - OP_Y) <= OP_R + 8) {
                applyOp(i);
                return;
            }
        }

        for (let i = 0; i < cards.length; i++) {
            const x = cardX(i);
            const y = CARD_Y + cards[i].lift;
            if (p.x >= x && p.x <= x + CARD_W && p.y >= y && p.y <= y + CARD_H) {
                toggleSel(i);
                return;
            }
        }
    });

    canvas.addEventListener('pointermove', function (e) {
        const p = toLocal(e);
        pointer.x = p.x;
        pointer.y = p.y;
        hoverOp = -1;
        for (let i = 0; i < 4; i++) {
            if (Math.hypot(p.x - OP_X[i], p.y - OP_Y) <= OP_R + 8) hoverOp = i;
        }
    });

    canvas.addEventListener('pointerleave', function () {
        hoverOp = -1;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyZ') {
            e.preventDefault();
            if (state === 'playing' && pending <= 0) undo();
        } else if (e.code === 'KeyH') {
            e.preventDefault();
            useHint();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        } else if (e.code === 'Digit1' || e.code === 'Digit2' ||
            e.code === 'Digit3' || e.code === 'Digit4') {
            e.preventDefault();
            applyOp(Number(e.code.slice(5)) - 1);
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

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

    // 开始页先摆一组示意牌，避免画布空着
    makeCards([3, 3, 8, 8]);
    left = ROUND_TIME;
    updateHud();
    requestAnimationFrame(loop);
})();
