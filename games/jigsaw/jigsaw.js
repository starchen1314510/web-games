/* ==========================================================
   拼图 Picture Puzzle
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const BOARD = 420;
    const BX = 30;
    const BY = 96;
    const BEST_KEY = 'webgames.jigsaw.best.';

    const DIFFS = {
        easy: { n: 3, label: '3 × 3' },
        normal: { n: 4, label: '4 × 4' },
        hard: { n: 5, label: '5 × 5' }
    };

    /* 每种配色一套「夜空 / 黄昏 / 深海 / 晨雾」的风景 */
    const THEMES = [
        {
            name: '极光雪岭',
            sky: ['#04121f', '#0b2740', '#16596b'],
            glow: 'rgba(120, 255, 214, .40)',
            orb: '#d9fff3',
            hills: ['#123c55', '#0c2a3d', '#071a26'],
            water: '#071b2b'
        },
        {
            name: '黄昏沙丘',
            sky: ['#2b1030', '#7b2b3e', '#e2763f'],
            glow: 'rgba(255, 198, 122, .45)',
            orb: '#ffeab4',
            hills: ['#5c2836', '#3d1a26', '#241019'],
            water: '#2b1522'
        },
        {
            name: '深海水母',
            sky: ['#011120', '#052b45', '#0b4f6b'],
            glow: 'rgba(120, 220, 255, .38)',
            orb: '#c3f1ff',
            hills: ['#0a3651', '#06233a', '#02101d'],
            water: '#031727'
        },
        {
            name: '薄荷晨雾',
            sky: ['#0d2130', '#24495c', '#69a8a0'],
            glow: 'rgba(220, 255, 240, .40)',
            orb: '#f2fff9',
            hills: ['#2b5661', '#1a3c48', '#0e2631'],
            water: '#12323d'
        }
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

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    function fmt(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
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

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        moves: document.getElementById('moves'),
        done: document.getElementById('done'),
        time: document.getElementById('time'),
        best: document.getElementById('best-moves'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn'),
        diffGroup: document.getElementById('diff-group')
    };

    let state = 'ready';        // ready | playing | win
    let diff = 'normal';
    let n = 4;
    let ps = BOARD / 4;
    let slots = [];             // slots[i] = 摆在 i 号格上的拼块编号
    let theme = THEMES[0];
    let scene = null;           // 420×420 的离屏原图
    let selected = -1;
    let moves = 0;
    let elapsed = 0;
    let score = 0;
    let previewHold = false;
    let flash = 0;
    let hudCache = '';
    let shownSec = -1;

    /* ---------- 原图 ---------- */

    function makeRng(seed) {
        let s = seed >>> 0 || 1;
        return function () {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function paintScene(g, S, th, rnd) {
        const sky = g.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, th.sky[0]);
        sky.addColorStop(0.55, th.sky[1]);
        sky.addColorStop(1, th.sky[2]);
        g.fillStyle = sky;
        g.fillRect(0, 0, S, S);

        /* 星点 */
        for (let i = 0; i < 110; i++) {
            const x = rnd() * S;
            const y = rnd() * S * 0.6;
            const r = 0.7 + rnd() * 1.5;
            g.fillStyle = 'rgba(232, 246, 255, ' + (0.12 + rnd() * 0.55).toFixed(3) + ')';
            g.fillRect(x, y, r, r);
        }

        /* 光球与光晕 */
        const cx = S * 0.66;
        const cy = S * 0.27;
        const R = S * 0.115;
        const halo = g.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 4.4);
        halo.addColorStop(0, th.glow);
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = halo;
        g.beginPath();
        g.arc(cx, cy, R * 4.4, 0, TAU);
        g.fill();

        const orb = g.createRadialGradient(cx - R * 0.32, cy - R * 0.3, R * 0.15, cx, cy, R);
        orb.addColorStop(0, '#ffffff');
        orb.addColorStop(0.65, th.orb);
        orb.addColorStop(1, th.sky[1]);
        g.fillStyle = orb;
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.fill();

        /* 三层山脊 */
        const ridge = [
            { y: 0.58, amp: 0.052, freq: 2.2 },
            { y: 0.69, amp: 0.062, freq: 3.2 },
            { y: 0.8, amp: 0.048, freq: 4.6 }
        ];
        for (let k = 0; k < ridge.length; k++) {
            const L = ridge[k];
            g.beginPath();
            g.moveTo(0, S);
            for (let x = 0; x <= S; x += 5) {
                const t = x / S;
                const y = S * L.y +
                    Math.sin(t * Math.PI * L.freq + k * 1.7) * S * L.amp +
                    Math.sin(t * Math.PI * L.freq * 2.3 + k * 0.8) * S * L.amp * 0.34;
                g.lineTo(x, y);
            }
            g.lineTo(S, S);
            g.closePath();
            g.fillStyle = th.hills[k];
            g.fill();
            g.strokeStyle = 'rgba(198, 244, 255, ' + (0.16 - k * 0.03).toFixed(3) + ')';
            g.lineWidth = 1.3;
            g.stroke();
        }

        /* 松树剪影 */
        const trees = [[0.1, 0.86], [0.17, 0.83], [0.24, 0.88], [0.86, 0.85], [0.93, 0.89]];
        g.fillStyle = 'rgba(3, 10, 16, .85)';
        for (let i = 0; i < trees.length; i++) {
            const tx = trees[i][0] * S;
            const ty = trees[i][1] * S;
            const hh = S * (0.1 + (i % 3) * 0.024);
            g.beginPath();
            g.moveTo(tx, ty - hh);
            g.lineTo(tx + hh * 0.34, ty);
            g.lineTo(tx - hh * 0.34, ty);
            g.closePath();
            g.fill();
        }

        /* 水面与倒影 */
        const wy = S * 0.84;
        const wg = g.createLinearGradient(0, wy, 0, S);
        wg.addColorStop(0, th.water);
        wg.addColorStop(1, 'rgba(1, 5, 9, .92)');
        g.fillStyle = wg;
        g.fillRect(0, wy, S, S - wy);

        for (let i = 0; i < 14; i++) {
            const yy = wy + 3 + (i + 1) * ((S - wy) / 15);
            const ww = S * (0.08 + rnd() * 0.34);
            const xx = cx - ww / 2 + (rnd() - 0.5) * S * 0.12;
            g.fillStyle = 'rgba(255, 255, 255, ' + (0.05 + rnd() * 0.1).toFixed(3) + ')';
            g.fillRect(xx, yy, ww, 1.4);
        }

        /* 暗角 */
        const vg = g.createRadialGradient(S * 0.5, S * 0.44, S * 0.22, S * 0.5, S * 0.52, S * 0.8);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .30)');
        g.fillStyle = vg;
        g.fillRect(0, 0, S, S);
    }

    function buildScene() {
        theme = THEMES[Math.floor(Math.random() * THEMES.length)];
        scene = document.createElement('canvas');
        scene.width = BOARD;
        scene.height = BOARD;
        paintScene(scene.getContext('2d'), BOARD, theme, makeRng((Math.random() * 1e9) | 0));
    }

    /* ---------- 局面 ---------- */

    function shuffleList(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = list[i];
            list[i] = list[j];
            list[j] = t;
        }
        return list;
    }

    function countCorrect() {
        let c = 0;
        for (let i = 0; i < slots.length; i++) if (slots[i] === i) c++;
        return c;
    }

    function bestOf(size) {
        return Number(localStorage.getItem(BEST_KEY + size) || 0);
    }

    function begin() {
        n = DIFFS[diff].n;
        ps = BOARD / n;
        buildScene();

        const total = n * n;
        slots = [];
        for (let i = 0; i < total; i++) slots.push(i);

        /* 打乱到「至少八成错位」，避免开局就快拼好 */
        let guard = 0;
        do {
            shuffleList(slots);
            guard++;
        } while (countCorrect() > total * 0.2 && guard < 40);

        selected = -1;
        moves = 0;
        elapsed = 0;
        score = 0;
        flash = 0;
        previewHold = false;
        state = 'playing';
        hudCache = '';
        shownSec = -1;
        updateHud();
        els.overlay.classList.remove('show');
    }

    function restartSame() {
        begin();
    }

    function win() {
        state = 'win';
        const size = n * n;
        const moveBonus = Math.max(0, 600 - moves * 12);
        const timeBonus = Math.max(0, 600 - Math.floor(elapsed) * 5);
        score = size * 20 + moveBonus + timeBonus;

        const prev = bestOf(n);
        const isBest = !prev || moves < prev;
        if (isBest) localStorage.setItem(BEST_KEY + n, String(moves));

        hudCache = '';
        updateHud();
        els.ovTitle.textContent = '拼好了';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = n + '×' + n + ' 全部归位，用了 ' + moves + ' 步、' + fmt(elapsed) +
            '。' + (isBest ? ' 新的最少步数！' : ' 最少步数 ' + prev + ' 步。');
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = String(score);
        els.ovBtn.textContent = '再来一局';
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        els.overlay.classList.add('show');
    }

    /* ---------- 输入 ---------- */

    function slotAt(x, y) {
        const col = Math.floor((x - BX) / ps);
        const row = Math.floor((y - BY) / ps);
        if (col < 0 || col >= n || row < 0 || row >= n) return -1;
        return row * n + col;
    }

    function trySwap(i) {
        if (selected === -1) {
            selected = i;
            return;
        }
        if (selected === i) {
            selected = -1;
            return;
        }
        const t = slots[selected];
        slots[selected] = slots[i];
        slots[i] = t;
        selected = -1;
        moves++;
        flash = 0.22;
        hudCache = '';
        updateHud();
        if (countCorrect() === slots.length) win();
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const i = slotAt(x, y);
        if (i < 0) return;
        e.preventDefault();
        trySwap(i);
    });

    canvas.addEventListener('pointermove', function (e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        canvas.style.cursor = (state === 'playing' && slotAt(x, y) >= 0) ? 'pointer' : 'default';
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            begin();
        } else if (e.code === 'KeyH') {
            previewHold = true;
        } else if (e.code === 'Enter' && state !== 'playing') {
            e.preventDefault();
            begin();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'KeyH') previewHold = false;
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        const list = els.diffGroup.querySelectorAll('button[data-diff]');
        for (let i = 0; i < list.length; i++) {
            list[i].classList.toggle('active', list[i] === btn);
        }
        begin();
    });

    els.ovBtn.addEventListener('click', begin);
    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', restartSame);

    /* ---------- 渲染 ---------- */

    function drawHeader() {
        ctx.fillStyle = '#e6f6ff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('拼图', BX, 36);

        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 190, 220, .75)';
        ctx.fillText(theme.name + ' · ' + DIFFS[diff].label, BX, 58);

        /* 右侧进度 */
        const total = slots.length || n * n;
        const ok = state === 'ready' ? 0 : countCorrect();
        const ratio = total ? ok / total : 0;
        const bw = 150;
        const bx = BX + BOARD - bw;
        ctx.fillStyle = 'rgba(120, 160, 200, .18)';
        roundRectPath(ctx, bx, 52, bw, 6, 3);
        ctx.fill();
        const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        grad.addColorStop(0, '#5fd8ff');
        grad.addColorStop(1, '#7affc4');
        ctx.fillStyle = grad;
        roundRectPath(ctx, bx, 52, Math.max(2, bw * ratio), 6, 3);
        ctx.fill();

        ctx.textAlign = 'right';
        ctx.font = '700 11px ' + MONO;
        ctx.fillStyle = 'rgba(190, 225, 250, .85)';
        ctx.fillText(ok + ' / ' + total, bx + bw, 38);
    }

    function drawBoardFrame() {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#0c1626';
        roundRectPath(ctx, BX - 8, BY - 8, BOARD + 16, BOARD + 16, 14);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(95, 216, 255, .22)';
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, BX - 8, BY - 8, BOARD + 16, BOARD + 16, 14);
        ctx.stroke();
    }

    function drawPieces() {
        ctx.save();
        roundRectPath(ctx, BX, BY, BOARD, BOARD, 8);
        ctx.clip();

        for (let i = 0; i < slots.length; i++) {
            const col = i % n;
            const row = (i / n) | 0;
            const dx = BX + col * ps;
            const dy = BY + row * ps;
            const id = slots[i];
            const sx = (id % n) * ps;
            const sy = ((id / n) | 0) * ps;

            ctx.drawImage(scene, sx, sy, ps, ps, dx + 1, dy + 1, ps - 2, ps - 2);

            /* 斜面：左上亮、右下暗 */
            ctx.fillStyle = 'rgba(255, 255, 255, .13)';
            ctx.fillRect(dx + 1, dy + 1, ps - 2, 1.4);
            ctx.fillRect(dx + 1, dy + 1, 1.4, ps - 2);
            ctx.fillStyle = 'rgba(0, 0, 0, .22)';
            ctx.fillRect(dx + 1, dy + ps - 2.4, ps - 2, 1.4);
            ctx.fillRect(dx + ps - 2.4, dy + 1, 1.4, ps - 2);

            ctx.strokeStyle = 'rgba(4, 10, 18, .55)';
            ctx.lineWidth = 1;
            ctx.strokeRect(dx + 0.5, dy + 0.5, ps - 1, ps - 1);
        }

        /* 选中框 */
        if (selected >= 0 && selected < slots.length) {
            const col = selected % n;
            const row = (selected / n) | 0;
            const dx = BX + col * ps;
            const dy = BY + row * ps;
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 3;
            ctx.strokeRect(dx + 2, dy + 2, ps - 4, ps - 4);
            ctx.strokeStyle = 'rgba(255, 209, 102, .35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(dx + 5.5, dy + 5.5, ps - 11, ps - 11);
        }

        ctx.restore();
    }

    function drawPreviewOverlay() {
        ctx.save();
        roundRectPath(ctx, BX, BY, BOARD, BOARD, 8);
        ctx.clip();
        ctx.drawImage(scene, BX, BY, BOARD, BOARD);
        ctx.fillStyle = 'rgba(6, 14, 24, .18)';
        ctx.fillRect(BX, BY, BOARD, BOARD);
        ctx.strokeStyle = 'rgba(255, 255, 255, .14)';
        ctx.lineWidth = 1;
        for (let i = 1; i < n; i++) {
            ctx.beginPath();
            ctx.moveTo(BX + i * ps, BY);
            ctx.lineTo(BX + i * ps, BY + BOARD);
            ctx.moveTo(BX, BY + i * ps);
            ctx.lineTo(BX + BOARD, BY + i * ps);
            ctx.stroke();
        }
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = 'rgba(6, 14, 24, .55)';
        roundRectPath(ctx, BX + BOARD / 2 - 52, BY + BOARD - 34, 104, 24, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(230, 246, 255, .92)';
        ctx.fillText('原图预览中', BX + BOARD / 2, BY + BOARD - 22);
    }

    function drawFooter() {
        const ty = 528;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(150, 190, 220, .78)';
        ctx.font = '600 12px ' + FONT;
        if (state === 'playing') {
            ctx.fillText(selected >= 0 ? '再点另一块交换位置' : '点两块拼图交换位置', BX, ty + 14);
            ctx.fillStyle = 'rgba(120, 160, 200, .55)';
            ctx.font = '600 11px ' + FONT;
            ctx.fillText('按住 H 可看原图 · R 重新打乱', BX, ty + 34);
        } else {
            ctx.fillText('点「开始拼图」打乱画面', BX, ty + 14);
            ctx.fillStyle = 'rgba(120, 160, 200, .55)';
            ctx.font = '600 11px ' + FONT;
            ctx.fillText('难度可在右侧切换', BX, ty + 34);
        }

        /* 原图缩略图 */
        const tw = 64;
        const tx = BX + BOARD - tw;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        roundRectPath(ctx, tx, ty, tw, tw, 8);
        ctx.fillStyle = 'rgba(10, 20, 32, .9)';
        ctx.fill();
        ctx.restore();
        ctx.save();
        roundRectPath(ctx, tx, ty, tw, tw, 8);
        ctx.clip();
        if (scene) ctx.drawImage(scene, 0, 0, BOARD, BOARD, tx, ty, tw, tw);
        ctx.restore();
        ctx.strokeStyle = 'rgba(95, 216, 255, .28)';
        ctx.lineWidth = 1.2;
        roundRectPath(ctx, tx, ty, tw, tw, 8);
        ctx.stroke();
    }

    function render() {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#070d1a');
        bg.addColorStop(0.6, '#0b1526');
        bg.addColorStop(1, '#070e1a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W * 0.5, BY + BOARD * 0.4, 40, W * 0.5, BY + BOARD * 0.4, 380);
        halo.addColorStop(0, 'rgba(95, 216, 255, .10)');
        halo.addColorStop(1, 'rgba(95, 216, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        drawHeader();
        drawBoardFrame();
        if (scene) drawPieces();
        if (previewHold && state === 'playing') drawPreviewOverlay();
        drawFooter();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (flash * 0.5).toFixed(3) + ')';
            ctx.fillRect(BX, BY, BOARD, BOARD);
        }
    }

    /* ---------- HUD ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'win') return '拼好了';
        return '拼图中';
    }

    function updateHud() {
        const key = state + '|' + moves + '|' + n + '|' + diff + '|' + Math.floor(elapsed);
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.moves.textContent = String(moves);
        const total = n * n;
        els.done.textContent = (state === 'ready' ? 0 : countCorrect()) + ' / ' + total;
        els.time.textContent = fmt(elapsed);
        const b = bestOf(n);
        els.best.textContent = b ? b + ' 步' : '--';
        els.restartBtn.textContent = state === 'playing' ? '重新打乱' : '换一局';
    }

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        if (flash > 0) flash = Math.max(0, flash - dt);
        if (state === 'playing') {
            elapsed += dt;
            const sec = Math.floor(elapsed);
            if (sec !== shownSec) {
                shownSec = sec;
                hudCache = '';
                updateHud();
            }
        }

        render();
        requestAnimationFrame(frame);
    }

    /* 初始摆设：ready 状态下也画一张图，避免开局空白 */
    n = DIFFS[diff].n;
    ps = BOARD / n;
    buildScene();
    slots = [];
    for (let i = 0; i < n * n; i++) slots.push(i);
    updateHud();
    requestAnimationFrame(frame);
})();
