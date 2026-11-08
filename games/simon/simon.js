/* ==========================================================
   记忆序列 Simon Says
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const BX = 60;
    const BY = 108;
    const PAD = 174;
    const GAP = 12;
    const CX = BX + PAD + GAP / 2;
    const CY = BY + PAD + GAP / 2;

    const PADS = [
        { col: '#4ade80', deep: '#12603c', tone: 329.63 },
        { col: '#ff6b6b', deep: '#6b1f2a', tone: 261.63 },
        { col: '#f5c451', deep: '#6b5116', tone: 392.00 },
        { col: '#5fd8ff', deep: '#12556e', tone: 196.00 }
    ];
    const KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function roundRectPath(c, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + rr, y);
        c.lineTo(x + w - rr, y);
        c.arcTo(x + w, y, x + w, y + rr, rr);
        c.lineTo(x + w, y + h - rr);
        c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
        c.lineTo(x + rr, y + h);
        c.arcTo(x, y + h, x, y + h - rr, rr);
        c.lineTo(x, y + rr);
        c.arcTo(x, y, x + rr, y, rr);
        c.closePath();
    }

    function hexA(hex, a) {
        const s = hex.replace('#', '');
        return 'rgba(' + parseInt(s.slice(0, 2), 16) + ',' +
            parseInt(s.slice(2, 4), 16) + ',' +
            parseInt(s.slice(4, 6), 16) + ',' + a + ')';
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        score: document.getElementById('score'),
        level: document.getElementById('level'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let state = 'ready';      // ready | show | input | pause | over
    let seq = [];
    let showIdx = -1;
    let showPhase = 'off';
    let showT = 0;
    let lit = -1;
    let pressT = 0;
    let pressPad = -1;
    let inputIdx = 0;
    let score = 0;
    let best = 0;
    let pauseT = 0;
    let shakeT = 0;
    let wrongPad = -1;
    let t = 0;
    let hudCache = '';
    let ac = null;

    function beep(i, dur) {
        try {
            if (!ac) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                ac = new AC();
            }
            if (ac.state === 'suspended') ac.resume();
            const o = ac.createOscillator();
            const g = ac.createGain();
            o.type = 'sine';
            o.frequency.value = PADS[i].tone;
            g.gain.setValueAtTime(0.0001, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + dur + 0.02);
        } catch (e) {
            /* 静音环境下忽略 */
        }
    }

    function onTime() {
        return Math.max(0.16, 0.46 - seq.length * 0.018);
    }

    function offTime() {
        return Math.max(0.07, 0.21 - seq.length * 0.008);
    }

    function nextPad() {
        return Math.floor(Math.random() * 4);
    }

    function startShow() {
        state = 'show';
        showIdx = -1;
        showPhase = 'off';
        showT = 0.62;
        lit = -1;
        inputIdx = 0;
        hudCache = '';
        updateHud();
    }

    function newGame() {
        seq = [];
        score = 0;
        inputIdx = 0;
        lit = -1;
        pressPad = -1;
        wrongPad = -1;
        pauseT = 0;
        shakeT = 0;
        state = 'ready';
        hudCache = '';
        updateHud();
    }

    function startGame() {
        newGame();
        seq.push(nextPad());
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        startShow();
    }

    function pushPad() {
        seq.push(nextPad());
        startShow();
    }

    function roundDone() {
        score += seq.length * 100;
        if (score > best) {
            best = score;
            localStorage.setItem('webgames.simon.best', String(best));
        }
        lit = -1;
        state = 'pause';
        pauseT = 0.55;
        hudCache = '';
        updateHud();
    }

    function press(i) {
        if (state !== 'input') return;
        pressPad = i;
        pressT = 0.22;
        beep(i, 0.16);
        if (seq[inputIdx] !== i) {
            wrongPad = i;
            shakeT = 0.32;
            state = 'over';
            hudCache = '';
            updateHud();
            showResult();
            return;
        }
        inputIdx++;
        hudCache = '';
        updateHud();
        if (inputIdx >= seq.length) roundDone();
    }

    function showResult() {
        const reach = seq.length;
        els.ovTitle.textContent = '记岔了';
        els.ovTitle.classList.add('danger');
        els.ovDesc.textContent = '在长度 ' + reach + ' 的序列上出错，本轮得分 ' + score +
            '。最佳成绩 ' + best + '，再试一次记住更长的序列吧。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
    }

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'show') return '记住序列…';
        if (state === 'input') return '该你了 · ' + inputIdx + '/' + seq.length;
        if (state === 'pause') return '答对！准备下一轮';
        return '按错了';
    }

    function updateHud() {
        const key = state + '|' + score + '|' + seq.length + '|' + inputIdx + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.score.textContent = String(score);
        els.level.textContent = String(seq.length);
        els.best.textContent = String(best);
        els.restartBtn.textContent = state === 'ready' ? '开始挑战' : '重新开始';
    }

    /* ---------- 绘制 ---------- */

    function padRect(i) {
        const x = BX + (i % 2) * (PAD + GAP);
        const y = BY + Math.floor(i / 2) * (PAD + GAP);
        return { x: x, y: y, w: PAD, h: PAD };
    }

    function drawBackdrop() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1018');
        g.addColorStop(0.5, '#0b1420');
        g.addColorStop(1, '#070c14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        if (lit >= 0) {
            const r = padRect(lit);
            const glow = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 20,
                r.x + r.w / 2, r.y + r.h / 2, 300);
            glow.addColorStop(0, hexA(PADS[lit].col, 0.14));
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, W, H);
        }
    }

    function drawPads() {
        ctx.save();
        if (shakeT > 0) {
            const k = shakeT / 0.32;
            ctx.translate((Math.random() - 0.5) * 8 * k, (Math.random() - 0.5) * 8 * k);
        }
        for (let i = 0; i < 4; i++) {
            const r = padRect(i);
            const on = lit === i;
            const pressed = pressPad === i && pressT > 0;
            const wrong = wrongPad === i && state === 'over';
            const p = PADS[i];

            ctx.save();
            if (on || pressed) {
                ctx.shadowColor = hexA(p.col, on ? 0.85 : 0.6);
                ctx.shadowBlur = on ? 34 : 22;
            }
            roundRectPath(ctx, r.x, r.y, r.w, r.h, 26);
            const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
            if (on || pressed) {
                g.addColorStop(0, hexA(p.col, 0.95));
                g.addColorStop(1, hexA(p.col, 0.55));
            } else if (wrong) {
                g.addColorStop(0, hexA('#ff3b52', 0.35));
                g.addColorStop(1, hexA('#5c1020', 0.95));
            } else {
                g.addColorStop(0, hexA(p.deep, 0.95));
                g.addColorStop(1, 'rgba(10, 18, 28, .96)');
            }
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();

            roundRectPath(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 25);
            ctx.strokeStyle = hexA(p.col, on || pressed ? 0.95 : 0.42);
            ctx.lineWidth = on ? 2.6 : 1.6;
            ctx.stroke();

            /* 键盘编号 */
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = hexA(p.col, on || pressed ? 0.85 : 0.45);
            ctx.font = '700 12px ' + MONO;
            ctx.fillText(String(i + 1), r.x + 18, r.y + 22);

            /* 内部纹样 */
            ctx.save();
            roundRectPath(ctx, r.x + 10, r.y + 10, r.w - 20, r.h - 20, 20);
            ctx.clip();
            ctx.globalAlpha = on || pressed ? 0.3 : 0.08;
            ctx.strokeStyle = hexA(p.col, 0.9);
            ctx.lineWidth = 1.2;
            for (let k = -r.h; k < r.w; k += 16) {
                ctx.beginPath();
                ctx.moveTo(r.x + k, r.y + r.h);
                ctx.lineTo(r.x + k + r.h, r.y);
                ctx.stroke();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        /* 中央圆盘 */
        ctx.beginPath();
        ctx.arc(CX, CY, 62, 0, TAU);
        ctx.fillStyle = 'rgba(8, 14, 22, .97)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 200, 225, .22)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        /* 输入进度环 */
        if (seq.length > 1 && state !== 'ready') {
            const p = inputIdx / seq.length;
            ctx.beginPath();
            ctx.arc(CX, CY, 54, -Math.PI / 2, -Math.PI / 2 + TAU * p);
            ctx.strokeStyle = 'rgba(120, 240, 200, .65)';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e8f8ff';
        ctx.font = '800 34px ' + MONO;
        ctx.fillText(seq.length ? String(seq.length) : '—', CX, CY - 6);

        ctx.fillStyle = 'rgba(150, 200, 220, .7)';
        ctx.font = '700 10px ' + MONO;
        ctx.fillText(state === 'input' ? 'YOUR TURN' : (state === 'show' ? 'LISTEN' : 'LEVEL'), CX, CY + 26);

        ctx.restore();
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e8f8ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('记忆序列', 24, 32);

        ctx.fillStyle = 'rgba(150, 200, 220, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('四块灯板 · 记住顺序依次点亮', 24, 54);

        const bw = 104;
        const bx = W - 24 - bw;
        ctx.fillStyle = 'rgba(255, 210, 120, .12)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 210, 120, .32)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd978';
        ctx.font = '700 12px ' + MONO;
        ctx.fillText('SCORE ' + score, bx + bw / 2, 38);
    }

    function drawFooter() {
        /* 本轮进度点 */
        if (seq.length > 0 && seq.length <= 16) {
            const gap = 15;
            const total = (seq.length - 1) * gap;
            const x0 = W / 2 - total / 2;
            for (let i = 0; i < seq.length; i++) {
                const cx = x0 + i * gap;
                ctx.beginPath();
                ctx.arc(cx, 496, i < inputIdx ? 4.4 : 3.5, 0, TAU);
                if (i < inputIdx) {
                    ctx.fillStyle = 'rgba(120, 240, 210, .85)';
                    ctx.fill();
                } else if (i === inputIdx && state === 'input') {
                    ctx.strokeStyle = 'rgba(255, 226, 150, .85)';
                    ctx.lineWidth = 1.6;
                    ctx.stroke();
                } else {
                    ctx.fillStyle = 'rgba(120, 165, 190, .3)';
                    ctx.fill();
                }
            }
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(140, 185, 205, .68)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('也可以按 1 / 2 / 3 / 4 依次点亮四块灯板', 24, 540);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(120, 165, 190, .55)';
        ctx.fillText('最佳 ' + best, W - 24, 540);
    }

    function render() {
        drawBackdrop();
        drawPads();
        drawHeader();
        drawFooter();
    }

    /* ---------- 交互 ---------- */

    function padAt(x, y) {
        for (let i = 0; i < 4; i++) {
            const r = padRect(i);
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
        }
        return -1;
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'input') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const i = padAt(x, y);
        if (i >= 0) press(i);
    });

    window.addEventListener('keydown', function (e) {
        if (state === 'input') {
            if (KEYS[e.code] !== undefined) press(KEYS[e.code]);
            return;
        }
        if (e.code === 'KeyR') startGame();
    });

    els.ovBtn.addEventListener('click', startGame);
    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        t += dt;
        if (pressT > 0) pressT = Math.max(0, pressT - dt);
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

        if (state === 'show') {
            showT -= dt;
            if (showT <= 0) {
                if (showPhase === 'on') {
                    lit = -1;
                    showPhase = 'off';
                    showT = offTime();
                } else {
                    showIdx++;
                    if (showIdx >= seq.length) {
                        lit = -1;
                        state = 'input';
                        inputIdx = 0;
                        hudCache = '';
                        updateHud();
                    } else {
                        lit = seq[showIdx];
                        showPhase = 'on';
                        showT = onTime();
                        beep(lit, onTime() * 0.9);
                    }
                }
            }
        } else if (state === 'pause') {
            pauseT -= dt;
            if (pauseT <= 0) {
                pushPad();
            }
        }

        render();
        requestAnimationFrame(frame);
    }

    best = Number(localStorage.getItem('webgames.simon.best') || 0);
    newGame();
    requestAnimationFrame(frame);
})();
