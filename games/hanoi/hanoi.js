/* ==========================================================
   汉诺塔 Tower of Hanoi
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const PEG_X = [92, 240, 388];
    const PEG_TOP = 214;
    const BASE_Y = 472;
    const BASE_H = 18;
    const MAX_W = 142;
    const MIN_W = 52;

    const BEST_KEY = 'webgames.hanoi.best';
    const WINS_KEY = 'webgames.hanoi.wins';

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        level: document.getElementById('level'),
        disks: document.getElementById('disks'),
        moves: document.getElementById('moves'),
        optimal: document.getElementById('optimal'),
        best: document.getElementById('best'),
        wins: document.getElementById('wins'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let level = 1;
    let n = 4;
    let diskH = 44;
    let towers = [[], [], []];
    let sel = -1;
    let moves = 0;
    let state = 'ready';
    let clock = 0;
    let anim = null;
    let banner = null;
    let msg = '';
    let msgTimer = 0;
    let shake = 0;
    let shakePeg = -1;
    let hudCache = '';

    function diskW(s) {
        if (n <= 1) return MAX_W;
        return MIN_W + (MAX_W - MIN_W) * (s - 1) / (n - 1);
    }

    function hueOf(s) {
        if (n <= 1) return 205;
        return 198 + ((s - 1) * 118) / (n - 1);
    }

    function diskY(index) {
        return BASE_Y - diskH * (index + 0.5);
    }

    function optimal() {
        return Math.pow(2, n) - 1;
    }

    /* ---------- 流程 ---------- */
    function build() {
        n = Math.min(3 + level, 7);
        // 盘数少时加高单个圆盘，让整摞高度保持稳定
        diskH = Math.round(Math.min(44, Math.max(26, 196 / n)));
        towers = [[], [], []];
        for (let s = n; s >= 1; s--) towers[0].push(s);
        sel = -1;
        moves = 0;
        anim = null;
        msg = '';
        msgTimer = 0;
        shake = 0;
        shakePeg = -1;
        hudCache = '';
    }

    function startGame() {
        level = 1;
        banner = null;
        build();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function nextLevel() {
        level++;
        build();
        state = 'playing';
        updateHud();
    }

    function updateHud() {
        const key = [level, n, moves, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.level.textContent = String(level);
        els.disks.textContent = String(n);
        els.moves.textContent = String(moves);
        els.optimal.textContent = String(optimal());
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
        els.wins.textContent = String(Number(localStorage.getItem(WINS_KEY) || 0));
    }

    function toast(text) {
        msg = text;
        msgTimer = 1.2;
    }

    function tapPeg(p) {
        if (state !== 'playing' || anim) return;

        if (sel === -1) {
            if (!towers[p].length) return;
            sel = p;
            return;
        }
        if (sel === p) {
            sel = -1;
            return;
        }

        const from = towers[sel];
        const to = towers[p];
        const size = from[from.length - 1];
        const topTo = to.length ? to[to.length - 1] : Infinity;

        if (size > topTo) {
            toast('大盘不能压在小盘上');
            shake = 1;
            shakePeg = sel;
            sel = -1;
            return;
        }

        const fromIdx = from.length - 1;
        const y0 = diskY(fromIdx);
        const x0 = PEG_X[sel];
        from.pop();
        to.push(size);
        const y1 = diskY(to.length - 1);
        const x1 = PEG_X[p];

        anim = { size: size, to: p, x0: x0, y0: y0, x1: x1, y1: y1, t: 0, dur: 0.2 };
        sel = -1;
        moves++;
        hudCache = '';
        updateHud();

        if (towers[2].length === n) finish();
    }

    function finish() {
        state = 'advance';
        const wins = Number(localStorage.getItem(WINS_KEY) || 0) + 1;
        localStorage.setItem(WINS_KEY, String(wins));
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (level > best) localStorage.setItem(BEST_KEY, String(level));

        const minMoves = optimal();
        const extra = moves - minMoves;
        banner = {
            t: 1.7,
            max: 1.7,
            title: '第 ' + level + ' 关 · 搬运完成',
            sub: extra <= 0 ? '步数 ' + moves + ' · 最优解！'
                : '步数 ' + moves + ' · 比最优多 ' + extra + ' 步'
        };
        updateHud();
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (msgTimer > 0) msgTimer -= dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 3.4);

        if (anim) {
            anim.t += dt;
            if (anim.t >= anim.dur) anim = null;
        }

        if (banner) {
            banner.t -= dt;
            if (banner.t <= 0) {
                banner = null;
                if (state === 'advance') nextLevel();
            }
        }
    }

    /* ---------- 绘制 ---------- */
    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 180, 215, .46)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('HANOI', W / 2, 26);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('汉诺塔', W / 2, 52);

        const g = ctx.createLinearGradient(120, 0, W - 120, 0);
        g.addColorStop(0, 'rgba(110, 152, 200, 0)');
        g.addColorStop(0.5, 'rgba(160, 170, 235, .34)');
        g.addColorStop(1, 'rgba(110, 152, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(120, 76, W - 240, 1);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 176, 212, .55)';
        ctx.fillText('第 ' + level + ' 关 · ' + n + ' 个圆盘 · 目标最右柱', W / 2, 102);
        ctx.restore();
    }

    function drawBase() {
        ctx.save();
        const g = ctx.createLinearGradient(0, BASE_Y, 0, BASE_Y + BASE_H);
        g.addColorStop(0, 'rgba(96, 126, 168, .95)');
        g.addColorStop(1, 'rgba(38, 56, 82, .95)');
        roundRectPath(ctx, 34, BASE_Y, 412, BASE_H, 6);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.fillStyle = 'rgba(190, 216, 245, .38)';
        roundRectPath(ctx, 34, BASE_Y, 412, 3, 1.6);
        ctx.fill();
        ctx.restore();
    }

    function drawPegs() {
        for (let p = 0; p < 3; p++) {
            const x = PEG_X[p];
            const active = p === sel;
            ctx.save();
            ctx.translate(x, 0);
            if (shake > 0 && shakePeg === p) {
                ctx.translate(Math.sin(clock * 46) * shake * 4, 0);
            }

            const g = ctx.createLinearGradient(-5, 0, 5, 0);
            g.addColorStop(0, 'rgba(64, 92, 130, .95)');
            g.addColorStop(0.4, 'rgba(140, 176, 214, .95)');
            g.addColorStop(1, 'rgba(58, 84, 120, .95)');
            roundRectPath(ctx, -4.5, PEG_TOP, 9, BASE_Y - PEG_TOP, 4.5);
            ctx.fillStyle = g;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(0, PEG_TOP + 3, 5.4, 0, TAU);
            ctx.fillStyle = 'rgba(168, 202, 236, .95)';
            ctx.fill();

            if (active) {
                ctx.beginPath();
                ctx.arc(0, PEG_TOP + 3, 9 + Math.sin(clock * 5) * 1.4, 0, TAU);
                ctx.strokeStyle = 'rgba(150, 220, 255, .55)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.restore();
        }

        // 目标柱提示光
        const tg = ctx.createRadialGradient(PEG_X[2], BASE_Y - 20, 6, PEG_X[2], BASE_Y - 20, 96);
        tg.addColorStop(0, 'rgba(120, 220, 180, .1)');
        tg.addColorStop(1, 'rgba(120, 220, 180, 0)');
        ctx.fillStyle = tg;
        ctx.fillRect(PEG_X[2] - 96, BASE_Y - 120, 192, 150);
    }

    function drawDisk(cx, cy, s, hot) {
        const w = diskW(s);
        const h = diskH - 2;
        const x = cx - w / 2;
        const y = cy - h / 2;
        const hue = hueOf(s);
        const rad = Math.min(9, h * 0.28);

        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'hsl(' + hue + ', 74%, 68%)');
        g.addColorStop(0.52, 'hsl(' + hue + ', 68%, 50%)');
        g.addColorStop(1, 'hsl(' + hue + ', 62%, 38%)');

        if (hot) {
            ctx.shadowColor = 'hsla(' + hue + ', 90%, 70%, .8)';
            ctx.shadowBlur = 14;
        }
        roundRectPath(ctx, x, y, w, h, rad);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, .3)';
        roundRectPath(ctx, x + 3, y + 2.4, w - 6, Math.max(3.4, h * 0.1), rad * 0.5);
        ctx.fill();

        ctx.fillStyle = 'rgba(4, 10, 20, .18)';
        roundRectPath(ctx, x + 3, y + h - 4.4, w - 6, 3, rad * 0.5);
        ctx.fill();

        if (hot) {
            roundRectPath(ctx, x + 0.8, y + 0.8, w - 1.6, h - 1.6, rad * 0.92);
            ctx.strokeStyle = 'rgba(226, 244, 255, .85)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }
    }

    function drawTowers() {
        for (let p = 0; p < 3; p++) {
            const list = towers[p];
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                const isTop = i === list.length - 1;
                // 飞行中的圆盘已落位于目标柱顶，单独绘制
                if (anim && isTop && p === anim.to && s === anim.size) continue;
                const hot = sel === p && isTop;
                const y = diskY(i) - (hot ? 20 : 0);
                drawDisk(PEG_X[p], y, s, hot);
            }
        }
    }

    function drawAnimDisk() {
        if (!anim) return;
        const k = Math.min(1, anim.t / anim.dur);
        const e = k * k * (3 - 2 * k);
        const x = anim.x0 + (anim.x1 - anim.x0) * e;
        const y = anim.y0 + (anim.y1 - anim.y0) * e - Math.sin(Math.PI * e) * 56;
        drawDisk(x, y, anim.size, true);
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (msgTimer > 0 && msg) {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(255, 180, 176, .95)';
            ctx.fillText(msg, W / 2, 526);
        } else {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(190, 214, 240, .82)';
            ctx.fillText('步数 ' + moves, W / 2 - 44, 526);
            ctx.fillStyle = 'rgba(140, 166, 196, .4)';
            ctx.fillText('·', W / 2, 526);
            ctx.fillStyle = 'rgba(160, 196, 226, .62)';
            ctx.fillText('最少 ' + optimal() + ' 步', W / 2 + 52, 526);
        }
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const k = Math.min(1, (banner.max - banner.t) * 6);
        const alpha = banner.t < 0.42 ? banner.t / 0.42 : 1;
        ctx.save();
        ctx.globalAlpha = alpha * k;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cy = 200;
        const g = ctx.createLinearGradient(60, 0, W - 60, 0);
        g.addColorStop(0, 'rgba(8, 18, 32, 0)');
        g.addColorStop(0.5, 'rgba(8, 18, 32, .9)');
        g.addColorStop(1, 'rgba(8, 18, 32, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(50, cy - 50, W - 100, 100);

        ctx.fillStyle = '#a8f0d0';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText(banner.title, W / 2, cy - 12);

        ctx.fillStyle = 'rgba(180, 222, 212, .8)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, cy + 20);
        ctx.restore();
    }

    function draw() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#080f1c');
        g.addColorStop(0.55, '#0a1425');
        g.addColorStop(1, '#060b14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 420, 40, W / 2, 420, 330);
        halo.addColorStop(0, 'rgba(70, 110, 190, .15)');
        halo.addColorStop(1, 'rgba(70, 110, 190, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 120, W, H - 120);

        drawPegs();
        drawBase();
        drawTowers();
        drawAnimDisk();

        drawHeader();
        drawFooter();
        drawBanner();
    }

    /* ---------- 输入 ---------- */
    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);

        let best = 0;
        let dist = Infinity;
        for (let p = 0; p < 3; p++) {
            const d = Math.abs(x - PEG_X[p]);
            if (d < dist) {
                dist = d;
                best = p;
            }
        }
        tapPeg(best);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Digit1') { e.preventDefault(); tapPeg(0); }
        else if (e.code === 'Digit2') { e.preventDefault(); tapPeg(1); }
        else if (e.code === 'Digit3') { e.preventDefault(); tapPeg(2); }
        else if (e.code === 'KeyR') { e.preventDefault(); startGame(); }
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
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    build();
    updateHud();
    requestAnimationFrame(loop);
})();
