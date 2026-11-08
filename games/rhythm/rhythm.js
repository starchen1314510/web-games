/* ==========================================================
   节奏 Rhythm
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const LANE_X = 88;
    const LANE_W = 76;
    const LANE_COUNT = 4;
    const JUDGE_Y = 476;
    const LANE_TOP = 104;

    const BPM = 128;
    const BEAT = 60 / BPM;
    const LEAD = 2.4;
    const BARS = 24;
    const LOOK = 1.5;

    const PERFECT_W = 0.045;
    const GREAT_W = 0.09;
    const GOOD_W = 0.14;

    const LANE_COLOR = ['#5fd8ff', '#a988ff', '#ff7ab0', '#ffd166'];
    const LANE_DARK = ['#1b4a5e', '#3a2b63', '#5e2743', '#5e4a1b'];
    const FREQ = [523.25, 659.25, 783.99, 1046.5];

    const JUDGES = {
        perfect: { name: 'PERFECT', score: 100, acc: 1, color: '#ffe08a' },
        great: { name: 'GREAT', score: 65, acc: 0.65, color: '#7fe6ff' },
        good: { name: 'GOOD', score: 35, acc: 0.35, color: '#c9d8ee' },
        miss: { name: 'MISS', score: 0, acc: 0, color: '#ff7a8a' }
    };

    const BEST_KEY = 'webgames.rhythm.best';

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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        combo: document.getElementById('combo'),
        maxCombo: document.getElementById('max-combo'),
        acc: document.getElementById('acc'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 音频（合成音，无外部资源） ---------- */
    let actx = null;

    function initAudio() {
        if (actx) {
            if (actx.state === 'suspended') {
                try { actx.resume(); } catch (e) { /* 忽略 */ }
            }
            return;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) actx = new AC();
        } catch (e) {
            actx = null;
        }
    }

    function tone(freq, dur, type, vol) {
        if (!actx) return;
        try {
            const t0 = actx.currentTime;
            const o = actx.createOscillator();
            const g = actx.createGain();
            o.type = type || 'triangle';
            o.frequency.setValueAtTime(freq, t0);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g);
            g.connect(actx.destination);
            o.start(t0);
            o.stop(t0 + dur + 0.03);
        } catch (e) { /* 音频失败不影响游戏 */ }
    }

    /* ---------- 谱面 ---------- */
    const RIFF = [0, 2, 1, 3, 2, 0, 3, 1];

    function buildChart() {
        const notes = [];
        let seed = 20261107;
        function rnd() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        }
        for (let bar = 0; bar < BARS; bar++) {
            for (let b = 0; b < 4; b++) {
                const idx = bar * 4 + b;
                const t = LEAD + idx * BEAT;
                const lane = RIFF[idx % RIFF.length];
                notes.push({ time: t, lane: lane, judged: false });

                if (bar >= 3 && rnd() < 0.38) {
                    const l2 = (lane + 1 + Math.floor(rnd() * 3)) % 4;
                    notes.push({ time: t + BEAT / 2, lane: l2, judged: false });
                }
                if (bar > 0 && bar % 8 === 0 && b === 0) {
                    const l3 = (lane + 2) % 4;
                    notes.push({ time: t, lane: l3, judged: false });
                }
            }
        }
        notes.sort(function (a, b) { return a.time - b.time; });
        return notes;
    }

    /* ---------- 状态 ---------- */
    let state = 'ready';          // ready | playing | over
    let notes = [];
    let songT = 0;
    let chartEnd = 0;
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let accSum = 0;
    let judgedCount = 0;
    let missCount = 0;
    let best = loadNum(BEST_KEY);
    let keys = [0, 0, 0, 0];
    let fx = [];
    let texts = [];
    let lastBeat = -999;
    let clock = 0;
    let hudCache = '';

    function startGame() {
        initAudio();
        notes = buildChart();
        chartEnd = notes.length ? notes[notes.length - 1].time : LEAD + 10;
        songT = 0;
        score = 0;
        combo = 0;
        maxCombo = 0;
        accSum = 0;
        judgedCount = 0;
        missCount = 0;
        keys = [0, 0, 0, 0];
        fx.length = 0;
        texts.length = 0;
        lastBeat = -999;
        state = 'playing';
        hudCache = '';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function finish() {
        state = 'over';
        const total = notes.length;
        const acc = total ? accSum / total : 0;
        const rank = acc >= 0.96 ? 'S' : (acc >= 0.88 ? 'A' : (acc >= 0.72 ? 'B' : 'C'));
        if (score > best) {
            best = score;
            saveNum(BEST_KEY, best);
        }
        els.ovTitle.textContent = '演奏结束';
        els.ovDesc.textContent = '评级 ' + rank + ' · 最大连击 ' + maxCombo +
            ' · 漏掉 ' + missCount + ' 个音符';
        els.ovScore.innerHTML = '得分 <b>' + score + '</b><br>准确率 ' +
            (acc * 100).toFixed(1) + '% · 最佳得分 ' + best;
        els.ovBtn.textContent = '再来一次';
        els.overlay.classList.add('show');
        updateHud();
    }

    function judge(kind, lane) {
        const j = JUDGES[kind];
        judgedCount++;
        accSum += j.acc;

        if (kind === 'miss') {
            combo = 0;
            missCount++;
            tone(118, 0.16, 'sawtooth', 0.05);
        } else {
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            const gain = Math.round(j.score + Math.min(combo, 40) * 2);
            score += gain;
            tone(FREQ[lane % 4], 0.12, 'triangle', 0.085);
            fx.push({ kind: 'ring', lane: lane, t: 0, max: 0.3, color: j.color });
        }

        texts.length = 0;
        texts.push({
            text: j.name,
            color: j.color,
            t: 0,
            max: 0.62,
            y: 414,
            lane: lane
        });
        updateHud();
    }

    function press(lane) {
        if (state !== 'playing') return;
        keys[lane] = 0.13;

        let pick = null;
        let pickDt = 999;
        for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (n.judged || n.lane !== lane) continue;
            const dt = Math.abs(n.time - songT);
            if (dt <= GOOD_W && dt < pickDt) {
                pickDt = dt;
                pick = n;
            }
        }
        if (!pick) return;
        pick.judged = true;
        const kind = pickDt <= PERFECT_W ? 'perfect' : (pickDt <= GREAT_W ? 'great' : 'good');
        judge(kind, lane);
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;

        for (let i = 0; i < 4; i++) {
            if (keys[i] > 0) keys[i] = Math.max(0, keys[i] - dt);
        }

        for (let i = fx.length - 1; i >= 0; i--) {
            fx[i].t += dt;
            if (fx[i].t > fx[i].max) fx.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            texts[i].t += dt;
            texts[i].y -= dt * 26;
            if (texts[i].t > texts[i].max) texts.splice(i, 1);
        }

        if (state !== 'playing') return;

        songT += dt;

        if (songT >= LEAD - 0.001) {
            const bi = Math.floor((songT - LEAD) / BEAT);
            if (bi !== lastBeat) {
                lastBeat = bi;
                tone(96, 0.09, 'sine', 0.045);
            }
        }

        for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (n.judged) continue;
            if (songT > n.time + GOOD_W) {
                n.judged = true;
                judge('miss', n.lane);
            }
        }

        if (songT > chartEnd + 1.6) finish();
    }

    function updateHud() {
        const acc = judgedCount ? accSum / judgedCount : 0;
        const key = [score, combo, maxCombo, judgedCount, Math.round(acc * 1000), best, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.combo.textContent = String(combo);
        els.maxCombo.textContent = String(maxCombo);
        els.acc.textContent = judgedCount ? (acc * 100).toFixed(1) + '%' : '--';
        els.best.textContent = String(best);
    }

    /* ---------- 绘制 ---------- */
    function beatPulse() {
        if (state !== 'playing' || songT < LEAD) return 0;
        const phase = ((songT - LEAD) / BEAT) % 1;
        return Math.max(0, 1 - phase * 3.2);
    }

    function drawBg(pulse) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a0718');
        g.addColorStop(0.48, '#12092a');
        g.addColorStop(1, '#06050f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        if (pulse > 0) {
            const lg = ctx.createLinearGradient(0, 300, 0, 520);
            lg.addColorStop(0, 'rgba(140, 90, 255, 0)');
            lg.addColorStop(0.7, 'rgba(150, 100, 255, ' + (pulse * 0.12) + ')');
            lg.addColorStop(1, 'rgba(90, 220, 255, 0)');
            ctx.fillStyle = lg;
            ctx.fillRect(0, 300, W, 220);
        }

        const halo = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 300);
        halo.addColorStop(0, 'rgba(120, 96, 255, .1)');
        halo.addColorStop(1, 'rgba(60, 40, 140, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 60, W, 440);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(176, 158, 214, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('RHYTHM', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#f0eaff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('节奏', W / 2, 49);

        const bx = 96;
        const bw = W - 192;
        const by = 66;
        const bh = 4;
        const k = chartEnd > 0 ? clamp(songT / chartEnd, 0, 1) : 0;
        roundRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.fillStyle = 'rgba(140, 120, 190, .22)';
        ctx.fill();
        if (k > 0) {
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            g.addColorStop(0, 'rgba(120, 210, 255, .9)');
            g.addColorStop(0.5, 'rgba(180, 130, 255, .95)');
            g.addColorStop(1, 'rgba(255, 130, 180, .95)');
            roundRectPath(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(178, 164, 208, .64)';
        ctx.fillText('得分 ' + score + ' · 连击 ' + combo + ' · 最大 ' + maxCombo, W / 2, 88);
        ctx.restore();
    }

    function drawLanes(pulse) {
        ctx.save();
        for (let i = 0; i < LANE_COUNT; i++) {
            const x = LANE_X + i * LANE_W;

            const g = ctx.createLinearGradient(0, LANE_TOP, 0, JUDGE_Y + 22);
            g.addColorStop(0, 'rgba(255, 255, 255, 0)');
            g.addColorStop(0.35, 'rgba(255, 255, 255, .022)');
            g.addColorStop(1, 'rgba(255, 255, 255, .05)');
            ctx.fillStyle = g;
            ctx.fillRect(x + 7, LANE_TOP, LANE_W - 14, JUDGE_Y + 22 - LANE_TOP + 6);

            ctx.strokeStyle = 'rgba(160, 150, 210, .12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 7, LANE_TOP);
            ctx.lineTo(x + 7, JUDGE_Y + 28);
            ctx.moveTo(x + LANE_W - 7, LANE_TOP);
            ctx.lineTo(x + LANE_W - 7, JUDGE_Y + 28);
            ctx.stroke();

            const lit = keys[i] / 0.13;
            if (lit > 0) {
                const lg = ctx.createLinearGradient(0, JUDGE_Y - 120, 0, JUDGE_Y + 20);
                lg.addColorStop(0, 'rgba(255, 255, 255, 0)');
                lg.addColorStop(1, hexA(LANE_COLOR[i], 0.28 * lit));
                ctx.fillStyle = lg;
                ctx.fillRect(x + 8, JUDGE_Y - 120, LANE_W - 16, 142);
            }
        }

        if (pulse > 0) {
            ctx.fillStyle = 'rgba(190, 160, 255, ' + (pulse * 0.05) + ')';
            ctx.fillRect(LANE_X, LANE_TOP, LANE_W * LANE_COUNT, JUDGE_Y + 22 - LANE_TOP);
        }
        ctx.restore();
    }

    function hexA(hex, a) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function drawJudgeLine() {
        ctx.save();
        const g = ctx.createLinearGradient(LANE_X, 0, LANE_X + LANE_W * LANE_COUNT, 0);
        g.addColorStop(0, 'rgba(110, 216, 255, .25)');
        g.addColorStop(0.5, 'rgba(220, 240, 255, .95)');
        g.addColorStop(1, 'rgba(255, 122, 176, .25)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3.2;
        ctx.shadowColor = 'rgba(150, 210, 255, .7)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(LANE_X, JUDGE_Y);
        ctx.lineTo(LANE_X + LANE_W * LANE_COUNT, JUDGE_Y);
        ctx.stroke();
        ctx.restore();

        // 判定线两侧的小箭头
        ctx.save();
        ctx.fillStyle = 'rgba(196, 226, 255, .5)';
        for (let i = 0; i < LANE_COUNT; i++) {
            const cx = LANE_X + i * LANE_W + LANE_W / 2;
            ctx.beginPath();
            ctx.moveTo(cx, JUDGE_Y + 14);
            ctx.lineTo(cx - 5, JUDGE_Y + 22);
            ctx.lineTo(cx + 5, JUDGE_Y + 22);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    function drawNotes() {
        ctx.save();
        ctx.beginPath();
        ctx.rect(LANE_X - 2, LANE_TOP, LANE_W * LANE_COUNT + 4, JUDGE_Y + 32 - LANE_TOP);
        ctx.clip();

        for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (n.judged) continue;
            const y = JUDGE_Y - ((n.time - songT) / LOOK) * (JUDGE_Y + 60);
            if (y < -40 || y > JUDGE_Y + 26) continue;

            const x = LANE_X + n.lane * LANE_W + 7;
            const w = LANE_W - 14;
            const near = 1 - clamp(Math.abs(y - JUDGE_Y) / 90, 0, 1);

            ctx.save();
            if (near > 0.2) {
                ctx.shadowColor = hexA(LANE_COLOR[n.lane], 0.55 * near);
                ctx.shadowBlur = 14 * near;
            }
            roundRectPath(ctx, x, y - 8, w, 16, 8);
            const g = ctx.createLinearGradient(x, y - 8, x, y + 8);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.28, LANE_COLOR[n.lane]);
            g.addColorStop(1, LANE_DARK[n.lane]);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = hexA(LANE_COLOR[n.lane], 0.85);
            ctx.lineWidth = 1;
            ctx.stroke();

            // 顶部高光
            ctx.beginPath();
            ctx.moveTo(x + 8, y - 4.6);
            ctx.lineTo(x + w - 8, y - 4.6);
            ctx.strokeStyle = 'rgba(255, 255, 255, .5)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    function drawTopFade() {
        const g = ctx.createLinearGradient(0, LANE_TOP - 2, 0, LANE_TOP + 38);
        g.addColorStop(0, 'rgba(11, 7, 24, 1)');
        g.addColorStop(0.5, 'rgba(11, 7, 24, .72)');
        g.addColorStop(1, 'rgba(11, 7, 24, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(LANE_X - 6, LANE_TOP - 2, LANE_W * LANE_COUNT + 12, 40);
    }

    function drawKeyPads() {
        ctx.save();
        for (let i = 0; i < LANE_COUNT; i++) {
            const x = LANE_X + i * LANE_W + 12;
            const w = LANE_W - 24;
            const y = 512;
            const lit = keys[i] / 0.13;

            roundRectPath(ctx, x, y, w, 34, 9);
            ctx.fillStyle = lit > 0
                ? hexA(LANE_COLOR[i], 0.28 + lit * 0.4)
                : 'rgba(255, 255, 255, .05)';
            ctx.fill();
            ctx.strokeStyle = hexA(LANE_COLOR[i], lit > 0 ? 0.9 : 0.32);
            ctx.lineWidth = 1.4;
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 13px ' + FONT;
            ctx.fillStyle = lit > 0 ? '#ffffff' : hexA(LANE_COLOR[i], 0.72);
            ctx.fillText(['D', 'F', 'J', 'K'][i], x + w / 2, y + 18);
        }
        ctx.restore();
    }

    function drawFx() {
        ctx.save();
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const a = 1 - p.t / p.max;
            const cx = LANE_X + p.lane * LANE_W + LANE_W / 2;
            const r = 10 + (1 - a) * 30;
            ctx.beginPath();
            ctx.arc(cx, JUDGE_Y, r, 0, TAU);
            ctx.strokeStyle = hexA(p.color, a * 0.85);
            ctx.lineWidth = 2.4 * a + 0.6;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const p = texts[i];
            const a = 1 - p.t / p.max;
            const k = p.t < 0.08 ? 1.18 - p.t * 2.2 : 1;
            ctx.save();
            ctx.globalAlpha = Math.min(1, a * 1.6);
            ctx.translate(W / 2, p.y);
            ctx.scale(k, k);
            ctx.font = '800 20px ' + FONT;
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    function drawCombo() {
        if (state !== 'playing' || combo < 3) return;
        const s = Math.min(46, 22 + combo * 0.55);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.92;
        ctx.font = '800 ' + s + 'px ' + FONT;
        const g = ctx.createLinearGradient(0, 280, 0, 346);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, 'rgba(190, 160, 255, .8)');
        ctx.fillStyle = g;
        ctx.fillText(String(combo), W / 2, 306);
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(190, 170, 230, .78)';
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('COMBO', W / 2, 336);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11.5px ' + FONT;
        ctx.fillStyle = 'rgba(160, 148, 190, .55)';
        ctx.fillText('D F J K 或点击轨道 · R 重开', W / 2, 574);
        ctx.restore();
    }

    function draw() {
        const pulse = beatPulse();
        drawBg(pulse);
        drawLanes(pulse);
        drawNotes();
        drawTopFade();
        drawJudgeLine();
        drawKeyPads();
        drawFx();
        drawTexts();
        drawCombo();
        drawHeader();
        drawFooter();
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
        if (p.y < LANE_TOP - 10) return;
        const lane = clamp(Math.floor((p.x - LANE_X) / LANE_W), 0, LANE_COUNT - 1);
        press(lane);
    });

    const KEY_MAP = {
        KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
        Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3
    };

    window.addEventListener('keydown', function (e) {
        if (KEY_MAP[e.code] !== undefined) {
            e.preventDefault();
            if (e.repeat) return;
            press(KEY_MAP[e.code]);
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
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

    notes = buildChart();
    chartEnd = notes.length ? notes[notes.length - 1].time : 0;
    updateHud();
    requestAnimationFrame(loop);
})();
