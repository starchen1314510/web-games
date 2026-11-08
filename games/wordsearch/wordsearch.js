/* ==========================================================
   单词寻宝 Word Search
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const N = 10;
    const CELL = 40;
    const GS = CELL * N;
    const GX = (W - GS) / 2;
    const GY = 92;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const TOTAL = 8;
    const BEST_KEY = 'webgames.wordsearch.best';

    const DIRS = [
        [0, 1], [1, 0], [1, 1], [1, -1],
        [0, -1], [-1, 0], [-1, -1], [-1, 1]
    ];

    const COLORS = [
        '#5fd8ff', '#ffd166', '#8dffc4', '#ff9b7a',
        '#c39bff', '#ff8fc7', '#7ee0d0', '#bfe06a'
    ];

    const POOL = 'EEEEAAAIIIOOUUNNRRTTLLSSDDGGBBCMPPHFWVYK';

    const WORDS = [
        ['CODE', '代码'], ['GAME', '游戏'], ['PIXEL', '像素'], ['ROCKET', '火箭'],
        ['PLANET', '行星'], ['GARDEN', '花园'], ['SHADOW', '影子'], ['WINTER', '冬天'],
        ['SUMMER', '夏天'], ['ORANGE', '橙子'], ['PUZZLE', '谜题'], ['BRIDGE', '桥'],
        ['CASTLE', '城堡'], ['DRAGON', '龙'], ['ENGINE', '引擎'], ['FOREST', '森林'],
        ['GUITAR', '吉他'], ['ISLAND', '海岛'], ['JUNGLE', '丛林'], ['MAGNET', '磁铁'],
        ['NEEDLE', '针'], ['POCKET', '口袋'], ['RIBBON', '丝带'], ['SADDLE', '马鞍'],
        ['TEMPLE', '神殿'], ['VALLEY', '山谷'], ['WALLET', '钱包'], ['YELLOW', '黄色'],
        ['ANCHOR', '锚'], ['BASKET', '篮子'], ['CAMERA', '相机'], ['FALCON', '猎鹰'],
        ['HARBOR', '港湾'], ['INSECT', '昆虫'], ['KETTLE', '水壶'], ['MIRROR', '镜子'],
        ['OASIS', '绿洲'], ['PEPPER', '胡椒'], ['QUARTZ', '石英'], ['RABBIT', '兔子'],
        ['SALMON', '鲑鱼'], ['TIMBER', '木材'], ['BOTTLE', '瓶子'], ['CANDLE', '蜡烛']
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

    function clamp(v, a, b) {
        return v < a ? a : (v > b ? b : v);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        status: document.getElementById('status'),
        found: document.getElementById('found'),
        time: document.getElementById('time'),
        best: document.getElementById('best-time'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        hintBtn: document.getElementById('hint-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let grid = [];
    let words = [];
    let state = 'ready';           // ready | playing | over
    let elapsed = 0;
    let foundCount = 0;
    let press = null;              // {r, c}
    let dragEnd = null;
    let picked = null;
    let hover = null;
    let flash = null;
    let wrong = null;
    let hint = null;
    let fx = [];
    let hudCache = '';
    let hintUsed = 0;

    /* ---------- 出题 ---------- */

    function shuffle(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = list[i]; list[i] = list[j]; list[j] = t;
        }
        return list;
    }

    function buildPuzzle() {
        const pool = WORDS.filter(function (w) { return w[0].length <= 7; });
        for (let attempt = 0; attempt < 100; attempt++) {
            const cells = new Array(N * N).fill('');
            const picks = shuffle(pool.slice()).slice(0, TOTAL);
            const placed = [];
            let ok = true;

            for (let p = 0; p < picks.length; p++) {
                const text = picks[p][0];
                const len = text.length;
                let done = false;

                for (let t = 0; t < 400; t++) {
                    const d = DIRS[Math.floor(Math.random() * DIRS.length)];
                    const rMin = d[0] < 0 ? len - 1 : 0;
                    const rMax = d[0] > 0 ? N - len : N - 1;
                    const cMin = d[1] < 0 ? len - 1 : 0;
                    const cMax = d[1] > 0 ? N - len : N - 1;
                    if (rMax < rMin || cMax < cMin) continue;

                    const r0 = rMin + Math.floor(Math.random() * (rMax - rMin + 1));
                    const c0 = cMin + Math.floor(Math.random() * (cMax - cMin + 1));

                    let fits = true;
                    for (let i = 0; i < len; i++) {
                        const cur = cells[(r0 + d[0] * i) * N + (c0 + d[1] * i)];
                        if (cur && cur !== text[i]) { fits = false; break; }
                    }
                    if (!fits) continue;

                    const line = [];
                    for (let i = 0; i < len; i++) {
                        const rr = r0 + d[0] * i;
                        const cc = c0 + d[1] * i;
                        cells[rr * N + cc] = text[i];
                        line.push({ r: rr, c: cc });
                    }
                    placed.push({
                        text: text,
                        cn: picks[p][1],
                        cells: line,
                        found: false,
                        color: COLORS[placed.length % COLORS.length]
                    });
                    done = true;
                    break;
                }
                if (!done) { ok = false; break; }
            }

            if (ok) {
                for (let i = 0; i < N * N; i++) {
                    if (!cells[i]) cells[i] = POOL[Math.floor(Math.random() * POOL.length)];
                }
                return { grid: cells, words: placed };
            }
        }
        return null;
    }

    function deal() {
        let pz = buildPuzzle();
        while (!pz) pz = buildPuzzle();
        grid = pz.grid;
        words = pz.words;
        foundCount = 0;
        elapsed = 0;
        press = null;
        dragEnd = null;
        picked = null;
        hover = null;
        flash = null;
        wrong = null;
        hint = null;
        hintUsed = 0;
        fx = [];
        hudCache = '';
        shownSec = -1;
        els.time.textContent = '0:00';
    }

    function startGame() {
        deal();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    /* ---------- 规则 ---------- */

    function lineCells(a, b) {
        const dr = b.r - a.r;
        const dc = b.c - a.c;
        if (dr === 0 && dc === 0) return null;
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
        const n = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
        const sr = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
        const sc = dc === 0 ? 0 : (dc > 0 ? 1 : -1);
        const cells = [];
        for (let i = 0; i < n; i++) cells.push({ r: a.r + sr * i, c: a.c + sc * i });
        return cells;
    }

    function project(a, p) {
        const dr = p.r - a.r;
        const dc = p.c - a.c;
        if (dr === 0 && dc === 0) return null;
        const adr = Math.abs(dr);
        const adc = Math.abs(dc);
        if (adr === 0) return { r: a.r, c: p.c };
        if (adc === 0) return { r: p.r, c: a.c };
        if (adr >= adc * 2) return { r: p.r, c: a.c };
        if (adc >= adr * 2) return { r: a.r, c: p.c };
        const sr = dr > 0 ? 1 : -1;
        const sc = dc > 0 ? 1 : -1;
        const maxR = sr > 0 ? N - 1 - a.r : a.r;
        const maxC = sc > 0 ? N - 1 - a.c : a.c;
        const k = Math.min(Math.round((adr + adc) / 2), maxR, maxC);
        if (k < 1) return null;
        return { r: a.r + sr * k, c: a.c + sc * k };
    }

    function attempt(a, b) {
        const cells = lineCells(a, b);
        if (!cells || cells.length < 4) {
            wrong = { cells: cells || [{ r: a.r, c: a.c }], t: 0.32 };
            return;
        }
        let str = '';
        for (let i = 0; i < cells.length; i++) {
            str += grid[cells[i].r * N + cells[i].c];
        }
        const rev = str.split('').reverse().join('');

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (w.found) continue;
            if (str === w.text || rev === w.text) {
                w.found = true;
                foundCount++;
                flash = { cells: cells, t: 0.9, color: w.color };
                burst(cells[0], w.color);
                burst(cells[cells.length - 1], w.color);
                hudCache = '';
                updateHud();
                if (foundCount >= words.length) win();
                return;
            }
        }
        wrong = { cells: cells, t: 0.34 };
    }

    function win() {
        state = 'over';
        press = null;
        dragEnd = null;
        picked = null;
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        const secs = Math.floor(elapsed);
        let isBest = false;
        if (!best || secs < best) {
            localStorage.setItem(BEST_KEY, String(secs));
            isBest = true;
        }
        hudCache = '';
        updateHud();

        els.ovTitle.textContent = '全部找到';
        els.ovTitle.classList.remove('danger');
        els.ovDesc.textContent = '八个单词都揪出来了。时间 ' + fmt(secs) +
            (hintUsed ? '，用了 ' + hintUsed + ' 次提示。' : '，全靠自己。') +
            (isBest ? ' 新纪录！' : '');
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = fmt(secs);
        els.ovBtn.textContent = '再来一局';
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
        els.overlay.classList.add('show');
    }

    function useHint() {
        if (state !== 'playing') return;
        const rest = words.filter(function (w) { return !w.found; });
        if (!rest.length) return;
        const w = rest[Math.floor(Math.random() * rest.length)];
        hint = { cells: w.cells, t: 2.6, color: w.color };
        hintUsed++;
    }

    function burst(p, color) {
        const x = GX + p.c * CELL + CELL / 2;
        const y = GY + p.r * CELL + CELL / 2;
        for (let i = 0; i < 8; i++) {
            const a = Math.random() * TAU;
            const s = 40 + Math.random() * 120;
            fx.push({
                x: x, y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 0.5, max: 0.5,
                color: color
            });
        }
    }

    /* ---------- 渲染 ---------- */

    function fmt(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1420');
        g.addColorStop(0.55, '#060e17');
        g.addColorStop(1, '#02070c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(240, 280, 40, 240, 280, 380);
        halo.addColorStop(0, 'rgba(95, 216, 255, .09)');
        halo.addColorStop(1, 'rgba(95, 216, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        const vg = ctx.createRadialGradient(W / 2, H / 2, 210, W / 2, H / 2, 450);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(95, 216, 255, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('WORD SEARCH', W / 2, 26);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('单词寻宝', W / 2, 52);
        ctx.fillStyle = 'rgba(140, 185, 215, .6)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText('找出 ' + TOTAL + ' 个单词 · 已找到 ' + foundCount, W / 2, 74);
        ctx.restore();
    }

    function cellX(c) { return GX + c * CELL + CELL / 2; }
    function cellY(r) { return GY + r * CELL + CELL / 2; }

    function drawGrid() {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 6;
        roundRectPath(ctx, GX - 8, GY - 8, GS + 16, GS + 16, 14);
        ctx.fillStyle = 'rgba(9, 20, 32, .92)';
        ctx.fill();
        ctx.restore();

        roundRectPath(ctx, GX - 8, GY - 8, GS + 16, GS + 16, 14);
        ctx.strokeStyle = 'rgba(95, 216, 255, .2)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const x = GX + c * CELL;
                const y = GY + r * CELL;
                if ((r + c) % 2 === 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, .012)';
                    ctx.fillRect(x, y, CELL, CELL);
                }
            }
        }

        ctx.strokeStyle = 'rgba(120, 180, 240, .07)';
        ctx.lineWidth = 1;
        for (let i = 1; i < N; i++) {
            ctx.beginPath();
            ctx.moveTo(GX + i * CELL + 0.5, GY);
            ctx.lineTo(GX + i * CELL + 0.5, GY + GS);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(GX, GY + i * CELL + 0.5);
            ctx.lineTo(GX + GS, GY + i * CELL + 0.5);
            ctx.stroke();
        }
    }

    function drawBand(cells, color, width, alpha) {
        if (!cells || !cells.length) return;
        const a = cells[0];
        const b = cells[cells.length - 1];
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cellX(a.c), cellY(a.r));
        ctx.lineTo(cellX(b.c), cellY(b.r));
        ctx.stroke();
        ctx.restore();
    }

    function drawFound() {
        for (let i = 0; i < words.length; i++) {
            if (!words[i].found) continue;
            drawBand(words[i].cells, words[i].color, CELL * 0.74, 0.24);
        }
    }

    function drawLetters() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 19px ' + MONO;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const x = cellX(c);
                const y = cellY(r) + 1;
                let color = 'rgba(206, 226, 244, .82)';
                for (let i = 0; i < words.length; i++) {
                    const w = words[i];
                    if (!w.found) continue;
                    for (let k = 0; k < w.cells.length; k++) {
                        if (w.cells[k].r === r && w.cells[k].c === c) { color = '#ffffff'; }
                    }
                }
                if (hover && hover.r === r && hover.c === c && state === 'playing') {
                    color = '#ffd166';
                }
                ctx.fillStyle = color;
                ctx.fillText(grid[r * N + c], x, y);
            }
        }
        ctx.restore();
    }

    function drawSelection() {
        if (picked) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 209, 102, .85)';
            ctx.lineWidth = 2;
            roundRectPath(ctx, cellX(picked.c) - CELL / 2 + 3, cellY(picked.r) - CELL / 2 + 3,
                CELL - 6, CELL - 6, 6);
            ctx.stroke();
            ctx.restore();
        }

        if (press && dragEnd) {
            const cells = lineCells(press, dragEnd);
            if (cells) drawBand(cells, '#ffd166', CELL * 0.7, 0.28);
        }

        if (wrong) {
            drawBand(wrong.cells, '#ff7a7a', CELL * 0.7, Math.min(0.5, wrong.t * 1.4));
        }

        if (flash) {
            drawBand(flash.cells, flash.color, CELL * 0.78, Math.min(0.55, flash.t));
        }

        if (hint) {
            const a = 0.16 + Math.abs(Math.sin(hint.t * 5)) * 0.3;
            drawBand(hint.cells, hint.color, CELL * 0.78, a);
        }
    }

    function drawFx(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= dt;
            if (p.life <= 0) { fx.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt;
            const k = p.life / p.max;
            ctx.save();
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.6 * k + 0.8, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawWordList() {
        const top = GY + GS + 12;
        const rowH = 22;
        const colX = [26, 252];

        ctx.save();
        ctx.textBaseline = 'middle';

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = colX[col];
            const y = top + row * rowH + 10;

            ctx.beginPath();
            ctx.arc(x + 5, y, 3.4, 0, TAU);
            ctx.fillStyle = w.found ? w.color : 'rgba(120, 150, 180, .35)';
            ctx.fill();

            ctx.textAlign = 'left';
            ctx.font = '700 13px ' + MONO;
            ctx.fillStyle = w.found ? w.color : 'rgba(206, 226, 244, .78)';
            ctx.fillText(w.text, x + 15, y);
            const tw = ctx.measureText(w.text).width;

            if (w.found) {
                ctx.strokeStyle = w.color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(x + 15, y + 1);
                ctx.lineTo(x + 15 + tw, y + 1);
                ctx.stroke();
            }

            ctx.font = '700 10px ' + FONT;
            ctx.fillStyle = w.found ? 'rgba(160, 200, 220, .55)' : 'rgba(130, 160, 190, .5)';
            ctx.fillText(w.cn, x + 21 + tw, y + 1);
        }
        ctx.restore();
    }

    let shownSec = -1;

    function render(dt) {
        drawBg();
        drawHeader();
        drawGrid();
        drawFound();
        drawLetters();
        drawSelection();
        drawFx(dt);
        drawWordList();

        if (state === 'playing') {
            elapsed += dt;
            const sec = Math.floor(elapsed);
            if (sec !== shownSec) {
                shownSec = sec;
                els.time.textContent = fmt(sec);
            }
        }
        if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
        if (wrong) { wrong.t -= dt; if (wrong.t <= 0) wrong = null; }
        if (hint) { hint.t -= dt; if (hint.t <= 0) hint = null; }
    }

    /* ---------- HUD ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return '全部找到';
        return '寻找中';
    }

    function updateHud() {
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        const key = foundCount + '|' + state + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.found.textContent = foundCount + ' / ' + TOTAL;
        els.best.textContent = best ? fmt(best) : '--';
        els.hintBtn.disabled = state !== 'playing';
    }

    /* ---------- 输入 ---------- */

    function locate(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - GX) / CELL);
        const r = Math.floor((y - GY) / CELL);
        if (r < 0 || r >= N || c < 0 || c >= N) return null;
        return { r: r, c: c };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        const p = locate(e);
        if (!p) return;
        press = p;
        dragEnd = null;
    });

    canvas.addEventListener('pointermove', function (e) {
        const p = locate(e);
        hover = p;
        if (!press || state !== 'playing') return;
        if (!p) return;
        if (p.r === press.r && p.c === press.c) {
            dragEnd = null;
            return;
        }
        dragEnd = project(press, p);
    });

    canvas.addEventListener('pointerleave', function () {
        hover = null;
    });

    canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;

        if (press && dragEnd) {
            attempt(press, dragEnd);
            press = null;
            dragEnd = null;
            picked = null;
            return;
        }

        const p = locate(e);
        press = null;
        dragEnd = null;
        if (!p) return;

        if (!picked) {
            picked = p;
            return;
        }
        if (picked.r === p.r && picked.c === p.c) {
            picked = null;
            return;
        }
        const cells = lineCells(picked, p);
        if (cells && cells.length >= 4) {
            attempt(picked, p);
            picked = null;
        } else {
            picked = p;
        }
    });

    canvas.addEventListener('pointercancel', function () {
        press = null;
        dragEnd = null;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
        } else if (e.code === 'KeyH') {
            e.preventDefault();
            useHint();
        } else if (e.code === 'Escape') {
            picked = null;
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.ovRestart.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);
    els.hintBtn.addEventListener('click', useHint);

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;
        render(dt);
        requestAnimationFrame(frame);
    }

    deal();
    updateHud();
    requestAnimationFrame(frame);
})();
