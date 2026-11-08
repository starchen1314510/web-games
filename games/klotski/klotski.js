/* ==========================================================
   华容道 Klotski
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    const CELL = 80;
    const COLS = 4;
    const ROWS = 5;
    const BX = (W - COLS * CELL) / 2;
    const BY = 112;

    const BEST_KEY = 'webgames.klotski.best';

    /* ---------- 基础工具 ---------- */
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

    function fmtTime(sec) {
        const s = Math.max(0, Math.floor(sec));
        const m = Math.floor(s / 60);
        return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        moves: document.getElementById('moves'),
        time: document.getElementById('time'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        undoBtn: document.getElementById('undo-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 局面数据 ---------- */
    // 经典「横刀立马」布局：20 格 / 10 块 / 空 2 格
    const LAYOUT = [
        { id: 'cao', name: '曹操', x: 1, y: 0, w: 2, h: 2, kind: 'cao' },
        { id: 'zhang', name: '张飞', x: 0, y: 0, w: 1, h: 2, kind: 'gen' },
        { id: 'zhao', name: '赵云', x: 3, y: 0, w: 1, h: 2, kind: 'gen' },
        { id: 'ma', name: '马超', x: 0, y: 2, w: 1, h: 2, kind: 'gen' },
        { id: 'huang', name: '黄忠', x: 3, y: 2, w: 1, h: 2, kind: 'gen' },
        { id: 'guan', name: '关羽', x: 1, y: 2, w: 2, h: 1, kind: 'guan' },
        { id: 's1', name: '卒', x: 0, y: 4, w: 1, h: 1, kind: 'pawn' },
        { id: 's2', name: '卒', x: 3, y: 4, w: 1, h: 1, kind: 'pawn' },
        { id: 's3', name: '卒', x: 1, y: 3, w: 1, h: 1, kind: 'pawn' },
        { id: 's4', name: '卒', x: 2, y: 3, w: 1, h: 1, kind: 'pawn' }
    ];

    const SKIN = {
        cao: { a: '#7c3030', b: '#3a1313', line: '#f0b072', text: '#ffe4bb', glow: 'rgba(255, 148, 104, .55)' },
        guan: { a: '#1f4c39', b: '#0a2018', line: '#7fe0b0', text: '#c9ffe4', glow: 'rgba(110, 228, 175, .5)' },
        gen: { a: '#22415f', b: '#0a1a2b', line: '#8fc6f0', text: '#d8edff', glow: 'rgba(120, 180, 245, .5)' },
        pawn: { a: '#323947', b: '#141920', line: '#a2b3ca', text: '#dfe8f4', glow: 'rgba(170, 190, 215, .45)' }
    };

    let pieces = [];
    let moves = 0;
    let state = 'ready';
    let sel = null;
    let hover = null;
    let drag = null;
    let undoStack = [];
    let startAt = 0;
    let now = 0;
    let banner = null;
    let toastText = '';
    let toastT = 0;
    let hudCache = '';
    let sparks = [];

    function cloneLayout() {
        return LAYOUT.map(function (p) {
            return { id: p.id, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, kind: p.kind };
        });
    }

    function byId(id) {
        for (let i = 0; i < pieces.length; i++) {
            if (pieces[i].id === id) return pieces[i];
        }
        return null;
    }

    function cao() {
        return byId('cao');
    }

    /* ---------- 规则 ---------- */
    function canPlace(self, x, y) {
        if (x < 0 || y < 0) return false;
        if (x + self.w > COLS || y + self.h > ROWS) return false;
        for (let i = 0; i < pieces.length; i++) {
            const o = pieces[i];
            if (o === self) continue;
            if (x < o.x + o.w && x + self.w > o.x && y < o.y + o.h && y + self.h > o.y) return false;
        }
        return true;
    }

    function pushUndo(p) {
        undoStack.push({ id: p.id, x: p.x, y: p.y });
        if (undoStack.length > 400) undoStack.shift();
    }

    function shiftBy(p, dx, dy) {
        if (state !== 'playing') return false;
        if (!canPlace(p, p.x + dx, p.y + dy)) return false;
        pushUndo(p);
        p.x += dx;
        p.y += dy;
        moves++;
        hudCache = '';
        puff(BX + (p.x + p.w / 2) * CELL, BY + (p.y + p.h / 2) * CELL);
        updateHud();
        if (checkWin()) return true;
        return true;
    }

    function shiftAxis(p, axis, target) {
        let guard = 0;
        while (p[axis] !== target && guard++ < 8) {
            const d = Math.sign(target - p[axis]);
            if (axis === 'x') {
                if (!shiftBy(p, d, 0)) break;
            } else {
                if (!shiftBy(p, 0, d)) break;
            }
        }
    }

    function undo() {
        if (state !== 'playing' && state !== 'win') return;
        const last = undoStack.pop();
        if (!last) {
            toast('没有可撤销的步骤');
            return;
        }
        const p = byId(last.id);
        if (!p) return;
        p.x = last.x;
        p.y = last.y;
        if (state === 'win') state = 'playing';
        banner = null;
        moves = Math.max(0, moves - 1);
        hudCache = '';
        updateHud();
    }

    function checkWin() {
        const c = cao();
        if (c.x === 1 && c.y === 3) {
            finish();
            return true;
        }
        return false;
    }

    /* ---------- 流程 ---------- */
    function reset() {
        pieces = cloneLayout();
        moves = 0;
        sel = null;
        hover = null;
        drag = null;
        undoStack = [];
        banner = null;
        sparks = [];
        toastText = '';
        toastT = 0;
        hudCache = '';
    }

    function startGame() {
        reset();
        state = 'playing';
        startAt = now;
        els.overlay.classList.remove('show');
        updateHud();
    }

    function finish() {
        state = 'win';
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (!best || moves < best) localStorage.setItem(BEST_KEY, String(moves));
        const t = elapsed();
        banner = {
            t: 0,
            title: '曹操出关',
            sub: '共 ' + moves + ' 步 · 用时 ' + fmtTime(t),
            note: !best ? '记录已保存' : (moves < best ? '刷新最少步数' : '最少步数 ' + best + ' 步')
        };
        hudCache = '';
        updateHud();
    }

    function elapsed() {
        if (state === 'ready') return 0;
        return (now - startAt) / 1000;
    }

    function updateHud() {
        const key = [moves, state, Math.floor(elapsed())].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.moves.textContent = String(moves);
        els.time.textContent = fmtTime(elapsed());
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        els.best.textContent = best ? best + ' 步' : '--';
    }

    function toast(text) {
        toastText = text;
        toastT = 1.3;
    }

    function puff(x, y) {
        for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 12 + Math.random() * 26;
            sparks.push({
                x: x, y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 0.42,
                max: 0.42
            });
        }
    }

    /* ---------- 命中 ---------- */
    function pieceAt(px, py) {
        const cx = Math.floor((px - BX) / CELL);
        const cy = Math.floor((py - BY) / CELL);
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
        for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            if (cx >= p.x && cx < p.x + p.w && cy >= p.y && cy < p.y + p.h) return p;
        }
        return null;
    }

    /* ---------- 输入 ---------- */
    function localPoint(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (W / r.width),
            y: (e.clientY - r.top) * (H / r.height)
        };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state !== 'playing') return;
        const p = localPoint(e);
        const hit = pieceAt(p.x, p.y);
        sel = hit ? hit.id : null;
        drag = hit ? { id: hit.id, sx: p.x, sy: p.y, gx: hit.x, gy: hit.y } : null;
        if (canvas.setPointerCapture) {
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        updateHud();
    });

    canvas.addEventListener('pointermove', function (e) {
        const p = localPoint(e);
        if (state !== 'playing') return;
        if (!drag) {
            const h = pieceAt(p.x, p.y);
            const id = h ? h.id : null;
            if (id !== hover) hover = id;
            return;
        }
        const piece = byId(drag.id);
        if (!piece) return;

        const dcx = Math.round((p.x - drag.sx) / CELL);
        const dcy = Math.round((p.y - drag.sy) / CELL);
        if (dcx === 0 && dcy === 0) return;

        const tx = drag.gx + dcx;
        const ty = drag.gy + dcy;
        if (Math.abs(dcx) >= Math.abs(dcy)) {
            shiftAxis(piece, 'x', tx);
            shiftAxis(piece, 'y', ty);
        } else {
            shiftAxis(piece, 'y', ty);
            shiftAxis(piece, 'x', tx);
        }
    });

    function endDrag() {
        if (!drag) return;
        drag = null;
    }

    canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        endDrag();
        const p = localPoint(e);
        const h = pieceAt(p.x, p.y);
        hover = h ? h.id : null;
    });

    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', function () {
        if (!drag) hover = null;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
            return;
        }
        if (e.code === 'KeyZ') {
            e.preventDefault();
            undo();
            return;
        }
        if (state !== 'playing') return;
        const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const d = map[e.code];
        if (!d) return;
        e.preventDefault();
        const p = sel ? byId(sel) : null;
        if (!p) {
            toast('先点一块棋子');
            return;
        }
        shiftBy(p, d[0], d[1]);
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);
    els.undoBtn.addEventListener('click', undo);

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#151a23');
        g.addColorStop(0.45, '#0b0f16');
        g.addColorStop(1, '#05070b');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, BY + 170, 30, W / 2, BY + 170, 330);
        halo.addColorStop(0, 'rgba(255, 186, 110, .10)');
        halo.addColorStop(0.55, 'rgba(255, 160, 90, .04)');
        halo.addColorStop(1, 'rgba(255, 160, 90, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        const vg = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 420);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(226, 190, 130, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('KLOTSKI', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#f4ece0';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('华容道', W / 2, 49);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(206, 192, 170, .55)';
        ctx.fillText('步数 ' + moves + ' · 用时 ' + fmtTime(elapsed()) + ' · 把曹操挪到出口', W / 2, 74);
        ctx.restore();
    }

    function drawBoard() {
        const bw = COLS * CELL;
        const bh = ROWS * CELL;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        roundRectPath(ctx, BX - 14, BY - 14, bw + 28, bh + 28, 20);
        const fg = ctx.createLinearGradient(0, BY - 14, 0, BY + bh + 14);
        fg.addColorStop(0, '#3a2c1b');
        fg.addColorStop(0.5, '#261c11');
        fg.addColorStop(1, '#17100a');
        ctx.fillStyle = fg;
        ctx.fill();
        ctx.restore();

        roundRectPath(ctx, BX - 14, BY - 14, bw + 28, bh + 28, 20);
        ctx.strokeStyle = 'rgba(214, 176, 112, .34)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        roundRectPath(ctx, BX - 3, BY - 3, bw + 6, bh + 6, 12);
        ctx.strokeStyle = 'rgba(120, 96, 62, .45)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const ig = ctx.createLinearGradient(0, BY, 0, BY + bh);
        ig.addColorStop(0, '#0a0d12');
        ig.addColorStop(1, '#05070a');
        roundRectPath(ctx, BX, BY, bw, bh, 9);
        ctx.fillStyle = ig;
        ctx.fill();

        ctx.save();
        roundRectPath(ctx, BX, BY, bw, bh, 9);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 255, 255, .035)';
        ctx.lineWidth = 1;
        for (let i = 1; i < COLS; i++) {
            ctx.beginPath();
            ctx.moveTo(BX + i * CELL, BY);
            ctx.lineTo(BX + i * CELL, BY + bh);
            ctx.stroke();
        }
        for (let j = 1; j < ROWS; j++) {
            ctx.beginPath();
            ctx.moveTo(BX, BY + j * CELL);
            ctx.lineTo(BX + bw, BY + j * CELL);
            ctx.stroke();
        }
        ctx.restore();

        drawExit(bw, bh);
    }

    function drawExit(bw, bh) {
        const x0 = BX + CELL;
        const x1 = BX + 3 * CELL;
        const yb = BY + bh;

        ctx.save();
        // 出口缺口：把木框底部挖开一段
        ctx.fillStyle = '#0a0d12';
        ctx.fillRect(x0, yb + 1, x1 - x0, 13);

        ctx.strokeStyle = 'rgba(255, 209, 102, .55)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, yb - 2);
        ctx.lineTo(x0, yb + 12);
        ctx.moveTo(x1, yb - 2);
        ctx.lineTo(x1, yb + 12);
        ctx.stroke();

        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255, 209, 102, .3)';
        ctx.beginPath();
        ctx.moveTo(x0 + 8, yb + 10);
        ctx.lineTo(x1 - 8, yb + 10);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(255, 209, 102, .62)';
        ctx.fillText('出 关', (x0 + x1) / 2, yb + 26);
        ctx.restore();
    }

    function drawPiece(p) {
        const x = BX + p.x * CELL + 3;
        const y = BY + p.y * CELL + 3;
        const w = p.w * CELL - 6;
        const h = p.h * CELL - 6;
        const skin = SKIN[p.kind];
        const isSel = sel === p.id;
        const isHover = hover === p.id && !isSel;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .55)';
        ctx.shadowBlur = 9;
        ctx.shadowOffsetY = 4;
        roundRectPath(ctx, x, y, w, h, 12);
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, skin.a);
        g.addColorStop(1, skin.b);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        // 顶部内高光
        ctx.save();
        roundRectPath(ctx, x, y, w, h, 12);
        ctx.clip();
        const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
        hl.addColorStop(0, 'rgba(255, 255, 255, .14)');
        hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hl;
        ctx.fillRect(x, y, w, h * 0.5);
        // 底部内阴影
        const sh = ctx.createLinearGradient(0, y + h * 0.62, 0, y + h);
        sh.addColorStop(0, 'rgba(0, 0, 0, 0)');
        sh.addColorStop(1, 'rgba(0, 0, 0, .34)');
        ctx.fillStyle = sh;
        ctx.fillRect(x, y + h * 0.62, w, h * 0.38);
        ctx.restore();

        roundRectPath(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 12);
        ctx.strokeStyle = isSel ? 'rgba(255, 209, 102, .95)' : skin.line;
        ctx.globalAlpha = isSel ? 1 : (isHover ? 0.92 : 0.62);
        ctx.lineWidth = isSel ? 2.4 : 1.3;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (isSel) {
            ctx.save();
            ctx.shadowColor = 'rgba(255, 209, 102, .75)';
            ctx.shadowBlur = 16;
            roundRectPath(ctx, x, y, w, h, 12);
            ctx.strokeStyle = 'rgba(255, 214, 120, .9)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        // 名字：细长棋块竖排
        ctx.save();
        ctx.fillStyle = skin.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (p.kind === 'pawn') {
            ctx.font = '800 26px ' + FONT;
            ctx.globalAlpha = 0.92;
            ctx.fillText('卒', x + w / 2, y + h / 2 + 1);
        } else if (p.h > p.w) {
            ctx.font = '800 26px ' + FONT;
            ctx.globalAlpha = 0.94;
            ctx.fillText(p.name.charAt(0), x + w / 2, y + h / 2 - 17);
            ctx.fillText(p.name.charAt(1), x + w / 2, y + h / 2 + 17);
        } else if (p.kind === 'cao') {
            ctx.font = '800 34px ' + FONT;
            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '6px';
            ctx.fillText(p.name, x + w / 2 + 3, y + h / 2 + 1);
            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
            ctx.globalAlpha = 0.5;
            ctx.font = '700 10px ' + FONT;
            ctx.fillText('一代枭雄', x + w / 2, y + h / 2 + 32);
        } else {
            ctx.font = '800 26px ' + FONT;
            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';
            ctx.fillText(p.name, x + w / 2 + 2, y + h / 2 + 1);
            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        }
        ctx.restore();

        // 曹操的四角金饰
        if (p.kind === 'cao') {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 209, 102, .45)';
            ctx.lineWidth = 1.6;
            const d = 12;
            const corners = [
                [x + 7, y + 7, 1, 1],
                [x + w - 7, y + 7, -1, 1],
                [x + 7, y + h - 7, 1, -1],
                [x + w - 7, y + h - 7, -1, -1]
            ];
            for (let i = 0; i < corners.length; i++) {
                const c = corners[i];
                ctx.beginPath();
                ctx.moveTo(c[0] + c[2] * d, c[1]);
                ctx.lineTo(c[0], c[1]);
                ctx.lineTo(c[0], c[1] + c[3] * d);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    function drawSparks(dt) {
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.life -= dt;
            if (s.life <= 0) {
                sparks.splice(i, 1);
                continue;
            }
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vx *= 0.92;
            s.vy *= 0.92;
            const k = s.life / s.max;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2.4 * k + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 209, 102, ' + (0.55 * k) + ')';
            ctx.fill();
        }
    }

    function drawBanner() {
        if (!banner) return;
        const k = Math.min(1, banner.t / 0.28);
        const ease = 1 - Math.pow(1 - k, 3);
        const bw = 300;
        const bh = 116;
        const x = (W - bw) / 2;
        const y = 250 + (1 - ease) * 18;

        ctx.save();
        ctx.globalAlpha = ease;
        ctx.shadowColor = 'rgba(0, 0, 0, .6)';
        ctx.shadowBlur = 24;
        roundRectPath(ctx, x, y, bw, bh, 16);
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, 'rgba(46, 36, 24, .98)');
        g.addColorStop(1, 'rgba(18, 14, 10, .98)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;

        roundRectPath(ctx, x, y, bw, bh, 16);
        ctx.strokeStyle = 'rgba(255, 209, 102, .45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd166';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, y + 38);

        ctx.fillStyle = 'rgba(240, 230, 214, .82)';
        ctx.font = '700 13px ' + FONT;
        ctx.fillText(banner.sub, W / 2, y + 66);

        ctx.fillStyle = 'rgba(226, 196, 140, .62)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText(banner.note + ' · 按 R 再来一局', W / 2, y + 90);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(198, 190, 176, .5)';
        ctx.fillText('拖动棋子腾出空位 · 让曹操走到出关口', W / 2, 574);
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
        roundRectPath(ctx, (W - w) / 2, 534, w, 28, 14);
        ctx.fillStyle = 'rgba(20, 16, 12, .9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 209, 102, .3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#f0e2c8';
        ctx.fillText(toastText, W / 2, 549);
        ctx.restore();
    }

    function draw(dt) {
        drawBg();
        drawBoard();
        for (let i = 0; i < pieces.length; i++) drawPiece(pieces[i]);
        drawSparks(dt);
        drawHeader();
        drawFooter();
        drawToast();
        drawBanner();
    }

    /* ---------- 主循环 ---------- */
    function update(dt) {
        if (toastT > 0) toastT -= dt;
        if (banner) banner.t += dt;
        if (state === 'playing') updateHud();
    }

    let last = 0;

    function loop(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        // 计时统一走 rAF 时间戳，避免 performance.now 与测试注入时钟不一致
        now = ts;
        update(dt);
        draw(dt);
        requestAnimationFrame(loop);
    }

    reset();
    updateHud();
    requestAnimationFrame(loop);
})();
