/* ==========================================================
   密码破译 Mastermind
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const SLOT_N = 4;
    const MAX_TRIES = 8;

    const PEG_X0 = 132;
    const PEG_DX = 54;
    const ROW_Y0 = 172;
    const ROW_DY = 40;
    const FB_X = 348;
    const PAL_Y = 506;
    const PAL_X0 = 125;
    const PAL_DX = 46;
    const SECRET_Y = 112;

    const BEST_KEY = 'webgames.mastermind.best';

    const COLORS = [
        { name: '赤', a: '#ff9188', b: '#a81f1f', glow: 'rgba(255, 110, 110, .5)' },
        { name: '橙', a: '#ffd274', b: '#b0730b', glow: 'rgba(255, 190, 90, .5)' },
        { name: '绿', a: '#82f0aa', b: '#18854a', glow: 'rgba(110, 230, 150, .5)' },
        { name: '青', a: '#7ee7f8', b: '#0f7488', glow: 'rgba(110, 220, 240, .5)' },
        { name: '蓝', a: '#a2bbff', b: '#2840a2', glow: 'rgba(130, 170, 255, .5)' },
        { name: '紫', a: '#d9a9ff', b: '#64269f', glow: 'rgba(190, 140, 255, .5)' }
    ];

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
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + w, y, x + w, y + h, rr);
        c.arcTo(x + w, y + h, x, y + h, rr);
        c.arcTo(x, y + h, x, y, rr);
        c.arcTo(x, y, x + w, y, rr);
        c.closePath();
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        left: document.getElementById('left'),
        used: document.getElementById('used'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovBtn: document.getElementById('ov-btn'),
        clearBtn: document.getElementById('clear-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let secret = [0, 0, 0, 0];
    let rows = [];
    let state = 'ready';
    let picked = 0;
    let now = 0;
    let banner = null;
    let toastText = '';
    let toastT = 0;
    let revealT = 0;
    let hudCache = '';
    let pulse = 0;
    let popAt = 0;
    let popRow = -1;

    function slotX(i) {
        return PEG_X0 + i * PEG_DX;
    }

    function rowY(i) {
        return ROW_Y0 + i * ROW_DY;
    }

    function palX(i) {
        return PAL_X0 + i * PAL_DX;
    }

    /* ---------- 规则 ---------- */
    function scoreOf(guess, answer) {
        const g = guess.slice();
        const s = answer.slice();
        let black = 0;
        for (let i = 0; i < SLOT_N; i++) {
            if (g[i] === s[i]) {
                black++;
                g[i] = -1;
                s[i] = -1;
            }
        }
        let white = 0;
        for (let i = 0; i < SLOT_N; i++) {
            if (g[i] < 0) continue;
            const j = s.indexOf(g[i]);
            if (j >= 0) {
                white++;
                s[j] = -1;
            }
        }
        return { black: black, white: white };
    }

    function curRow() {
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i].fb) return i;
        }
        return -1;
    }

    function usedCount() {
        let n = 0;
        for (let i = 0; i < rows.length; i++) if (rows[i].fb) n++;
        return n;
    }

    /* ---------- 流程 ---------- */
    function deal() {
        secret = [];
        for (let i = 0; i < SLOT_N; i++) secret.push(Math.floor(Math.random() * COLORS.length));
        rows = [];
        for (let i = 0; i < MAX_TRIES; i++) {
            rows.push({ pegs: [-1, -1, -1, -1], fb: null });
        }
        picked = -1;
        banner = null;
        revealT = 0;
        popAt = 0;
        popRow = -1;
        toastText = '';
        toastT = 0;
        hudCache = '';
    }

    function startGame() {
        deal();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function updateHud() {
        const used = usedCount();
        const key = [used, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.left.textContent = String(Math.max(0, MAX_TRIES - used));
        els.used.textContent = String(used);
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        els.best.textContent = best ? best + ' 次' : '--';
    }

    function toast(text) {
        toastText = text;
        toastT = 1.3;
    }

    function pickColor(idx) {
        if (state !== 'playing') return;
        const r = curRow();
        if (r < 0) return;
        const pegs = rows[r].pegs;
        for (let i = 0; i < SLOT_N; i++) {
            if (pegs[i] < 0) {
                pegs[i] = idx;
                picked = idx;
                hudCache = '';
                return;
            }
        }
        toast('本行已填满，按 Enter 提交');
    }

    function clearRow() {
        if (state !== 'playing') return;
        const r = curRow();
        if (r < 0) return;
        rows[r].pegs = [-1, -1, -1, -1];
        hudCache = '';
    }

    function submit() {
        if (state !== 'playing') return;
        const r = curRow();
        if (r < 0) return;
        const pegs = rows[r].pegs;
        for (let i = 0; i < SLOT_N; i++) {
            if (pegs[i] < 0) {
                toast('还有空位没上色');
                return;
            }
        }
        const fb = scoreOf(pegs, secret);
        rows[r].fb = fb;
        popRow = r;
        popAt = 0.34;
        hudCache = '';
        updateHud();

        if (fb.black === SLOT_N) {
            win(r + 1);
            return;
        }
        if (r + 1 >= MAX_TRIES) {
            lose();
            return;
        }
    }

    function win(tries) {
        state = 'won';
        revealT = 0.45;
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (!best || tries < best) localStorage.setItem(BEST_KEY, String(tries));
        banner = {
            t: 0,
            title: '密码已破译',
            sub: '第 ' + tries + ' 次尝试成功 · 密码 ' + secretText(),
            note: !best ? '记录已保存' : (tries < best ? '刷新最少次数' : '最少次数 ' + best + ' 次')
        };
        hudCache = '';
        updateHud();
    }

    function lose() {
        state = 'lost';
        revealT = 0.45;
        banner = {
            t: 0,
            title: '八次用尽',
            sub: '密码是 ' + secretText(),
            note: '按 R 换一组密码'
        };
    }

    function secretText() {
        const names = [];
        for (let i = 0; i < SLOT_N; i++) names.push(COLORS[secret[i]].name);
        return names.join('');
    }

    /* ---------- 输入 ---------- */
    function localPoint(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (W / r.width),
            y: (e.clientY - r.top) * (H / r.height)
        };
    }

    function hitPalette(px, py) {
        for (let i = 0; i < COLORS.length; i++) {
            const dx = px - palX(i);
            const dy = py - PAL_Y;
            if (dx * dx + dy * dy < 24 * 24) return i;
        }
        return -1;
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        const p = localPoint(e);

        const ci = hitPalette(p.x, p.y);
        if (ci >= 0) {
            pickColor(ci);
            return;
        }

        const r = curRow();
        if (r < 0) return;
        for (let i = 0; i < SLOT_N; i++) {
            const dx = p.x - slotX(i);
            const dy = p.y - rowY(r);
            if (dx * dx + dy * dy < 21 * 21) {
                rows[r].pegs[i] = -1;
                hudCache = '';
                return;
            }
        }
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
            return;
        }
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            submit();
            return;
        }
        if (e.code === 'Backspace') {
            e.preventDefault();
            if (state !== 'playing') return;
            const r = curRow();
            if (r < 0) return;
            const pegs = rows[r].pegs;
            for (let i = SLOT_N - 1; i >= 0; i--) {
                if (pegs[i] >= 0) {
                    pegs[i] = -1;
                    break;
                }
            }
            hudCache = '';
            return;
        }
        const m = /^Digit([1-6])$/.exec(e.code);
        if (m) {
            e.preventDefault();
            pickColor(Number(m[1]) - 1);
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);
    els.clearBtn.addEventListener('click', clearRow);

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#151a2c');
        g.addColorStop(0.45, '#0b0e1a');
        g.addColorStop(1, '#05060d');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 340);
        halo.addColorStop(0, 'rgba(120, 150, 255, .10)');
        halo.addColorStop(1, 'rgba(120, 150, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        const vg = ctx.createRadialGradient(W / 2, H / 2, 190, W / 2, H / 2, 430);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(160, 180, 240, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('MASTERMIND', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf0ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('密码破译', W / 2, 49);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(168, 182, 214, .55)';
        ctx.fillText('金色实点 = 颜色位置都对 · 空心圈 = 颜色对位置错', W / 2, 74);
        ctx.restore();
    }

    function peg(x, y, r, ci, glowOn) {
        const c = COLORS[ci];
        ctx.save();
        if (glowOn) {
            ctx.shadowColor = c.glow;
            ctx.shadowBlur = 14;
        }
        const g = ctx.createRadialGradient(x - r * 0.36, y - r * 0.42, r * 0.12, x, y, r * 1.06);
        g.addColorStop(0, c.a);
        g.addColorStop(0.55, c.b);
        g.addColorStop(1, 'rgba(0, 0, 0, .55)');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, .22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, .5)';
        ctx.fill();
    }

    function emptySlot(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, .045)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, .13)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }

    function drawSecret() {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(168, 182, 214, .5)';
        ctx.fillText('密码', 84, SECRET_Y);
        ctx.restore();

        const show = state === 'won' || state === 'lost';
        for (let i = 0; i < SLOT_N; i++) {
            const x = slotX(i);
            if (show) {
                const k = revealT > 0 ? 1 - revealT / 0.45 : 1;
                peg(x, SECRET_Y, 15 * (0.7 + 0.3 * k), secret[i], true);
            } else {
                emptySlot(x, SECRET_Y, 15);
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '800 15px ' + FONT;
                ctx.fillStyle = 'rgba(150, 170, 210, .45)';
                ctx.fillText('?', x, SECRET_Y + 1);
                ctx.restore();
            }
        }
    }

    function drawFeedback(x, y, fb, alpha) {
        const ex = fb.black;
        const wi = fb.white;
        let idx = 0;
        ctx.save();
        ctx.globalAlpha = alpha;
        for (let k = 0; k < SLOT_N; k++) {
            const ox = (k % 2) * 20 - 10;
            const oy = Math.floor(k / 2) * 20 - 10;
            const px = x + ox;
            const py = y + oy;
            if (idx < ex) {
                ctx.beginPath();
                ctx.arc(px, py, 5.4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffd166';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 236, 180, .55)';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (idx < ex + wi) {
                ctx.beginPath();
                ctx.arc(px, py, 4.6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(150, 205, 255, .95)';
                ctx.lineWidth = 1.9;
                ctx.stroke();
            }
            idx++;
        }
        ctx.restore();
    }

    function drawRows() {
        const cur = state === 'playing' ? curRow() : -1;

        for (let i = 0; i < MAX_TRIES; i++) {
            const y = rowY(i);
            const row = rows[i];
            const isCur = i === cur;

            if (isCur) {
                const p = 0.5 + 0.5 * Math.sin(pulse * 3.4);
                roundRectPath(ctx, 96, y - 18, 288, 36, 12);
                ctx.fillStyle = 'rgba(255, 255, 255, .035)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 209, 102, ' + (0.28 + 0.28 * p) + ')';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '700 11px ' + FONT;
            ctx.fillStyle = isCur ? 'rgba(255, 209, 102, .8)' : 'rgba(160, 175, 205, .48)';
            ctx.fillText(String(i + 1), 112, y);
            ctx.restore();

            const popK = (popRow === i && popAt > 0) ? (1 - popAt / 0.34) : 1;
            const scale = popRow === i && popAt > 0 ? 0.55 + 0.45 * Math.min(1, popK * 1.6) : 1;

            for (let j = 0; j < SLOT_N; j++) {
                const x = slotX(j);
                const ci = row.pegs[j];
                if (ci < 0) {
                    emptySlot(x, y, 13);
                } else {
                    peg(x, y, 13, ci, isCur);
                }
            }

            if (row.fb) {
                drawFeedback(FB_X, y, row.fb, 0.4 + 0.6 * scale);
            } else if (isCur) {
                ctx.save();
                ctx.setLineDash([3, 5]);
                roundRectPath(ctx, FB_X - 19, y - 15, 38, 30, 8);
                ctx.strokeStyle = 'rgba(255, 255, 255, .09)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    function drawPalette() {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(168, 182, 214, .5)';
        ctx.fillText('选色', 84, PAL_Y);
        ctx.restore();

        for (let i = 0; i < COLORS.length; i++) {
            const x = palX(i);
            const on = state === 'playing' && picked === i;
            if (on) {
                ctx.beginPath();
                ctx.arc(x, PAL_Y, 21, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 209, 102, .85)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            peg(x, PAL_Y, 16, i, on);

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '700 9px ' + FONT;
            ctx.fillStyle = 'rgba(190, 202, 226, .45)';
            ctx.fillText(String(i + 1), x, PAL_Y + 28);
            ctx.restore();
        }
    }

    function drawBanner() {
        if (!banner) return;
        const k = Math.min(1, banner.t / 0.28);
        const ease = 1 - Math.pow(1 - k, 3);
        const bw = 310;
        const bh = 116;
        const x = (W - bw) / 2;
        const y = 252 + (1 - ease) * 18;

        ctx.save();
        ctx.globalAlpha = ease;
        ctx.shadowColor = 'rgba(0, 0, 0, .6)';
        ctx.shadowBlur = 24;
        roundRectPath(ctx, x, y, bw, bh, 16);
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, 'rgba(30, 38, 62, .98)');
        g.addColorStop(1, 'rgba(10, 13, 24, .98)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;

        roundRectPath(ctx, x, y, bw, bh, 16);
        ctx.strokeStyle = 'rgba(255, 209, 102, .4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = state === 'won' ? '#ffd166' : '#ff9d8a';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, y + 38);

        ctx.fillStyle = 'rgba(226, 234, 252, .84)';
        ctx.font = '700 13px ' + FONT;
        ctx.fillText(banner.sub, W / 2, y + 66);

        ctx.fillStyle = 'rgba(190, 202, 226, .6)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText(banner.note, W / 2, y + 90);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(170, 184, 212, .46)';
        ctx.fillText('点色块填珠 · 点彩珠清除 · Enter 提交 · R 重开', W / 2, 574);
        ctx.restore();
    }

    function drawToast() {
        if (toastT <= 0) return;
        const a = Math.min(1, toastT * 2.4);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '700 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(toastText).width + 30;
        roundRectPath(ctx, (W - w) / 2, 536, w, 28, 14);
        ctx.fillStyle = 'rgba(14, 18, 30, .92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 209, 102, .28)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#e8eefc';
        ctx.fillText(toastText, W / 2, 551);
        ctx.restore();
    }

    function draw(dt) {
        drawBg();
        drawSecret();
        drawRows();
        drawPalette();
        drawHeader();
        drawFooter();
        drawToast();
        drawBanner();
    }

    /* ---------- 主循环 ---------- */
    let last = 0;

    function loop(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;
        now = ts;

        pulse += dt;
        if (toastT > 0) toastT -= dt;
        if (revealT > 0) revealT -= dt;
        if (popAt > 0) popAt -= dt;
        if (banner) banner.t += dt;

        draw(dt);
        requestAnimationFrame(loop);
    }

    deal();
    state = 'ready';
    updateHud();
    requestAnimationFrame(loop);
})();
