/* ==========================================================
   21 点 Blackjack
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 540;
    const CARD_W = 76;
    const CARD_H = 108;
    const CARD_STEP = 46;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const CHIP_KEY = 'webgames.blackjack.chips';
    const STAT_KEY = 'webgames.blackjack.stats';

    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const DECK_N = 6;

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        chips: document.getElementById('chips'),
        bet: document.getElementById('bet'),
        stats: document.getElementById('stats'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovBtn: document.getElementById('ov-btn'),
        dealBtn: document.getElementById('deal-btn'),
        hitBtn: document.getElementById('hit-btn'),
        standBtn: document.getElementById('stand-btn'),
        doubleBtn: document.getElementById('double-btn'),
        betMinus: document.getElementById('bet-minus'),
        betPlus: document.getElementById('bet-plus')
    };

    let shoe = [];
    let player = [];
    let dealer = [];
    let bet = 10;
    let chips = Number(localStorage.getItem(CHIP_KEY) || 500);
    let stats = loadStats();
    let phase = 'idle';
    let holeHidden = true;
    let stepTimer = 0;
    let settleTimer = 0;
    let queue = [];
    let msg = '';
    let msgLife = 0;
    let clock = 0;
    let texts = [];
    let hudCache = '';
    let doubled = false;
    let revealTimer = 0;

    function loadStats() {
        try {
            const raw = JSON.parse(localStorage.getItem(STAT_KEY) || '{}');
            return { w: Number(raw.w || 0), l: Number(raw.l || 0), d: Number(raw.d || 0) };
        } catch (e) {
            return { w: 0, l: 0, d: 0 };
        }
    }

    function saveStats() {
        localStorage.setItem(STAT_KEY, JSON.stringify(stats));
    }

    /* ---------- 牌堆 ---------- */
    function buildShoe() {
        const s = [];
        for (let d = 0; d < DECK_N; d++) {
            for (let i = 0; i < SUITS.length; i++) {
                for (let r = 0; r < RANKS.length; r++) {
                    s.push({ rank: RANKS[r], suit: i, born: -9 });
                }
            }
        }
        for (let i = s.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = s[i];
            s[i] = s[j];
            s[j] = t;
        }
        return s;
    }

    function draw() {
        if (shoe.length < 60) {
            shoe = buildShoe();
            texts.push({ x: W / 2, y: 232, text: '洗牌', life: 1, max: 1, size: 14 });
        }
        const c = shoe.pop();
        c.born = clock;
        return c;
    }

    function rankText(r) {
        if (r === 1) return 'A';
        if (r === 11) return 'J';
        if (r === 12) return 'Q';
        if (r === 13) return 'K';
        return String(r);
    }

    function isRed(suit) {
        return suit === 1 || suit === 2;
    }

    function handValue(cards) {
        let sum = 0;
        let aces = 0;
        for (let i = 0; i < cards.length; i++) {
            const r = cards[i].rank;
            if (r === 1) {
                aces += 1;
                sum += 11;
            } else {
                sum += r > 10 ? 10 : r;
            }
        }
        while (sum > 21 && aces > 0) {
            sum -= 10;
            aces -= 1;
        }
        return sum;
    }

    function isBlackjack(cards) {
        return cards.length === 2 && handValue(cards) === 21;
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const key = chips + '|' + bet + '|' + stats.w + '|' + stats.l + '|' + stats.d + '|' + phase;
        if (key === hudCache) return;
        hudCache = key;
        els.chips.textContent = String(chips);
        els.bet.textContent = String(bet);
        els.stats.textContent = stats.w + ' 胜 · ' + stats.l + ' 负 · ' + stats.d + ' 平';
        const canAct = phase === 'player';
        els.hitBtn.disabled = !canAct;
        els.standBtn.disabled = !canAct;
        els.doubleBtn.disabled = !(canAct && player.length === 2 && chips >= bet && !doubled);
        els.dealBtn.disabled = phase !== 'idle';
        els.betMinus.disabled = phase !== 'idle' || bet <= 10;
        els.betPlus.disabled = phase !== 'idle' || bet + 10 > chips;
    }

    /* ---------- 流程 ---------- */
    function setMsg(text, life) {
        msg = text;
        msgLife = life || 1.4;
    }

    function prepare() {
        player = [];
        dealer = [];
        holeHidden = true;
        doubled = false;
        queue = [];
        stepTimer = 0;
        settleTimer = 0;
        phase = chips >= 10 ? 'idle' : 'broke';
        if (phase === 'broke') {
            bet = 0;
            showOverlay('筹码用完了', '先领 200 枚筹码继续玩，下注会从筹码里扣。', '领取筹码');
        }
        setMsg('', 0);
        updateHud();
    }

    function showOverlay(title, desc, btn) {
        els.ovTitle.textContent = title;
        els.ovTitle.classList.toggle('danger', title.indexOf('用完') >= 0);
        els.ovDesc.textContent = desc;
        els.ovBtn.textContent = btn;
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    function startRound() {
        if (chips < 10) return;
        if (bet > chips) bet = chips;
        chips -= bet;
        holeHidden = true;
        player = [];
        dealer = [];
        doubled = false;
        queue = [
            { who: 'p', card: draw() },
            { who: 'd', card: draw() },
            { who: 'p', card: draw() },
            { who: 'd', card: draw() }
        ];
        phase = 'deal';
        stepTimer = 0.16;
        setMsg('发牌', 1);
        hideOverlay();
        updateHud();
    }

    function dealStep() {
        if (!queue.length) {
            phase = 'player';
            if (isBlackjack(player) || isBlackjack(dealer)) {
                resolve();
            } else {
                setMsg('你的回合', 1);
            }
            updateHud();
            return;
        }
        const item = queue.shift();
        if (item.who === 'p') player.push(item.card);
        else dealer.push(item.card);
        stepTimer = 0.26;
    }

    function hit() {
        if (phase !== 'player') return;
        player.push(draw());
        const v = handValue(player);
        if (v > 21) {
            setMsg('爆牌', 1.6);
            resolve(0.8);
        } else if (v === 21) {
            setMsg('21 点', 1.2);
            resolve(0.7);
        } else {
            updateHud();
        }
    }

    function stand() {
        if (phase !== 'player') return;
        phase = 'dealer';
        stepTimer = 0.35;
        holeHidden = false;
        setMsg('庄家行动', 1);
        updateHud();
    }

    function doubleDown() {
        if (phase !== 'player' || player.length !== 2 || chips < bet) return;
        chips -= bet;
        bet *= 2;
        doubled = true;
        player.push(draw());
        const v = handValue(player);
        if (v > 21) {
            setMsg('加倍后爆牌', 1.6);
            resolve(0.9);
        } else {
            setMsg('加倍下注', 1.2);
            phase = 'dealer';
            stepTimer = 0.5;
            holeHidden = false;
        }
        updateHud();
    }

    function resolve(delay) {
        phase = 'reveal';
        revealTimer = delay || 0.55;
        holeHidden = false;
        updateHud();
    }

    function settle() {
        const pv = handValue(player);
        const dv = handValue(dealer);
        const pBJ = isBlackjack(player);
        const dBJ = isBlackjack(dealer);
        let payout = 0;
        let text;
        if (pv > 21) {
            text = '你爆牌了';
            stats.l += 1;
        } else if (pBJ && !dBJ) {
            payout = Math.round(bet * 2.5);
            text = 'Blackjack！';
            stats.w += 1;
        } else if (dBJ && !pBJ) {
            text = '庄家 Blackjack';
            stats.l += 1;
        } else if (dv > 21) {
            payout = bet * 2;
            text = '庄家爆牌，你赢了';
            stats.w += 1;
        } else if (pv > dv) {
            payout = bet * 2;
            text = '你赢了 ' + pv + ' : ' + dv;
            stats.w += 1;
        } else if (pv === dv) {
            payout = bet;
            text = '平局，退回下注';
            stats.d += 1;
        } else {
            text = '庄家赢 ' + dv + ' : ' + pv;
            stats.l += 1;
        }
        chips += payout;
        localStorage.setItem(CHIP_KEY, String(chips));
        saveStats();
        phase = 'over';
        settleTimer = 1.9;
        setMsg(text, 2);
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (msgLife > 0) msgLife -= dt;

        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 22 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }

        if (phase === 'reveal') {
            revealTimer -= dt;
            if (revealTimer <= 0) settle();
            return;
        }

        if (phase === 'deal') {
            stepTimer -= dt;
            if (stepTimer <= 0) dealStep();
            return;
        }

        if (phase === 'dealer') {
            stepTimer -= dt;
            if (stepTimer <= 0) {
                const dv = handValue(dealer);
                if (dv < 17) {
                    dealer.push(draw());
                    stepTimer = 0.62;
                } else {
                    settle();
                }
            }
            return;
        }

        if (phase === 'over') {
            settleTimer -= dt;
            if (settleTimer <= 0) {
                if (chips < 10) {
                    phase = 'broke';
                    showOverlay('筹码用完了', '这局之后只剩 ' + chips + ' 枚筹码，领 200 枚继续。', '领取筹码');
                } else {
                    prepare();
                }
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawTable() {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#10251f');
        g.addColorStop(0.5, '#0b1a17');
        g.addColorStop(1, '#122a22');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, 268, 30, W / 2, 268, 280);
        glow.addColorStop(0, 'rgba(64, 200, 150, .12)');
        glow.addColorStop(1, 'rgba(64, 200, 150, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.strokeStyle = 'rgba(120, 200, 170, .16)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(28, 232);
        ctx.lineTo(W - 28, 232);
        ctx.stroke();
        ctx.restore();
    }

    function drawCardBack(x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, .28)';
        roundRect(x + 2, y + 3, w, h, 9);
        ctx.fill();

        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#25405f');
        g.addColorStop(1, '#16263c');
        ctx.fillStyle = g;
        roundRect(x, y, w, h, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 190, 240, .32)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        roundRect(x + 7, y + 7, w - 14, h - 14, 6);
        ctx.strokeStyle = 'rgba(150, 190, 240, .2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        roundRect(x + 7, y + 7, w - 14, h - 14, 6);
        ctx.clip();
        ctx.strokeStyle = 'rgba(150, 190, 240, .12)';
        ctx.lineWidth = 1;
        for (let i = -h; i < w + h; i += 11) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + h, y + h);
            ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
    }

    function drawCardFace(x, y, w, h, card, k) {
        const sx = 0.6 + k * 0.4;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(sx, sx);
        ctx.globalAlpha = clamp(k * 1.3, 0, 1);
        ctx.translate(-(x + w / 2), -(y + h / 2));

        ctx.fillStyle = 'rgba(0, 0, 0, .3)';
        roundRect(x + 2, y + 3, w, h, 9);
        ctx.fill();

        const g = ctx.createLinearGradient(x, y, x + w * 0.8, y + h);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#e6eefa');
        ctx.fillStyle = g;
        roundRect(x, y, w, h, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 200, 225, .9)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const red = isRed(card.suit);
        const col = red ? '#d94a63' : '#243447';
        const rt = rankText(card.rank);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = col;
        ctx.font = '700 ' + (rt.length > 1 ? 19 : 23) + 'px ' + FONT;
        ctx.fillText(rt, x + 15, y + 20);
        ctx.font = '600 15px ' + FONT;
        ctx.fillText(SUITS[card.suit], x + 15, y + 38);

        ctx.globalAlpha = clamp(k * 1.3, 0, 1) * 0.9;
        ctx.font = '400 38px ' + FONT;
        ctx.fillText(SUITS[card.suit], x + w / 2, y + h / 2 + 4);
        ctx.restore();
    }

    function drawHand(cards, y, hideIndex, label) {
        const step = cards.length > 1 ? Math.min(CARD_STEP, (W - 80 - CARD_W) / (cards.length - 1)) : 0;
        const startX = W / 2 - (CARD_W + step * Math.max(0, cards.length - 1)) / 2;
        for (let i = 0; i < cards.length; i++) {
            const x = startX + i * step;
            const k = clamp((clock - cards[i].born) / 0.2, 0, 1);
            if (hideIndex === i) drawCardBack(x, y, CARD_W, CARD_H);
            else drawCardFace(x, y, CARD_W, CARD_H, cards[i], k);
        }
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = 'rgba(150, 210, 190, .62)';
        ctx.fillText(label, W / 2, y - 14);
        ctx.restore();
    }

    function drawPoints() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const dvKnown = holeHidden && dealer.length > 1
            ? handValue(dealer.slice(0, 1)) : handValue(dealer);
        const dv = handValue(dealer);
        const pv = handValue(player);

        if (dealer.length) {
            ctx.font = '700 15px ' + FONT;
            ctx.fillStyle = 'rgba(214, 240, 232, .9)';
            ctx.fillText(holeHidden ? dvKnown + ' + ?' : String(dv), W / 2, 182);
        }
        if (player.length) {
            const bad = pv > 21;
            ctx.font = '700 15px ' + FONT;
            ctx.fillStyle = bad ? '#ff6f80' : 'rgba(214, 240, 232, .9)';
            ctx.fillText(bad ? pv + ' 爆' : String(pv), W / 2, 428);
        }
        ctx.restore();
    }

    function drawMsg() {
        if (!msg || msgLife <= 0) return;
        ctx.save();
        ctx.globalAlpha = clamp(msgLife / 0.6, 0, 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 16px ' + FONT;
        ctx.fillStyle = 'rgba(180, 235, 215, .95)';
        ctx.fillText(msg, W / 2, 248);
        ctx.restore();
    }

    function drawChips() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const baseY = 480;
        const n = clamp(Math.ceil(bet / 20) + 1, 3, 6);
        for (let i = 0; i < n; i++) {
            const cy = baseY - i * 7;
            ctx.fillStyle = 'rgba(0, 0, 0, .3)';
            ctx.beginPath();
            ctx.ellipse(W / 2 + 1, cy + 3, 20, 7, 0, 0, TAU);
            ctx.fill();
            const g = ctx.createLinearGradient(W / 2 - 20, cy, W / 2 + 20, cy);
            g.addColorStop(0, '#7bade0');
            g.addColorStop(0.55, '#5d90cf');
            g.addColorStop(1, '#3f6fa8');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(W / 2, cy, 20, 7, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 225, 255, .5)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#dbeaff';
            ctx.beginPath();
            ctx.ellipse(W / 2, cy, 12, 4, 0, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = 'rgba(190, 230, 215, .8)';
        ctx.font = '600 13px ' + FONT;
        ctx.fillText('下注 ' + bet, W / 2, baseY + 26);
        ctx.restore();
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = 'rgba(214, 240, 232, .95)';
            ctx.font = '700 ' + t.size + 'px ' + FONT;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function render() {
        drawTable();
        drawHand(dealer, 56, holeHidden ? 1 : -1, '庄家 DEALER');
        drawPoints();
        drawMsg();
        drawHand(player, 296, -1, '你 PLAYER');
        drawChips();
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
    els.ovBtn.addEventListener('click', function () {
        if (phase === 'broke') {
            chips += 200;
            localStorage.setItem(CHIP_KEY, String(chips));
            bet = 10;
            prepare();
            hideOverlay();
        } else {
            startRound();
        }
    });

    els.dealBtn.addEventListener('click', startRound);
    els.hitBtn.addEventListener('click', hit);
    els.standBtn.addEventListener('click', stand);
    els.doubleBtn.addEventListener('click', doubleDown);

    els.betMinus.addEventListener('click', function () {
        if (phase !== 'idle') return;
        bet = Math.max(10, bet - 10);
        updateHud();
    });

    els.betPlus.addEventListener('click', function () {
        if (phase !== 'idle') return;
        bet = Math.min(chips, bet + 10);
        updateHud();
    });

    window.addEventListener('keydown', function (e) {
        const k = e.key.toLowerCase();
        if (k === 'h' || k === ' ' || e.key === 'ArrowRight') {
            if (phase === 'player') { hit(); e.preventDefault(); }
        } else if (k === 's' || e.key === 'ArrowLeft') {
            if (phase === 'player') { stand(); e.preventDefault(); }
        } else if (k === 'd') {
            if (phase === 'player') { doubleDown(); e.preventDefault(); }
        } else if (k === 'n' || k === 'enter') {
            if (phase === 'idle') { startRound(); e.preventDefault(); }
        }
    });

    /* ---------- 启动 ---------- */
    shoe = buildShoe();
    prepare();
    showOverlay('21 点',
        '尽量让手牌点数接近 21 但不超过。A 算 1 或 11，J/Q/K 算 10，庄家到 17 点必须停牌。',
        '开始发牌');
    if (phase !== 'idle') hideOverlay();
    updateHud();
    window.requestAnimationFrame(loop);
})();
