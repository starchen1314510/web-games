/* ==========================================================
   斗兽棋 Jungle Chess
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const COLS = 7;
    const ROWS = 9;
    const CELL = 48;
    const BW = COLS * CELL;
    const BH = ROWS * CELL;
    const BX = (W - BW) / 2;
    const BY = 96;
    const PR_R = 18.5;

    const DEN_RED = { c: 3, r: 8 };
    const DEN_BLUE = { c: 3, r: 0 };
    const TRAP_RED = [[2, 8], [4, 8], [3, 7]];
    const TRAP_BLUE = [[2, 0], [4, 0], [3, 1]];
    const NAMES = ['', '鼠', '猫', '狗', '狼', '豹', '虎', '狮', '象'];
    const RANK_W = [0, 26, 48, 78, 120, 176, 244, 322, 410];
    const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const DEPTH = { easy: 1, normal: 2, hard: 3 };
    const DIFF_NAME = { easy: '简单', normal: '普通', hard: '困难' };

    const COL_RED = '#ff6b6b';
    const COL_BLUE = '#5fd8ff';

    /* 初始摆放：红方在下（玩家）、蓝方在上（电脑） */
    const START = [
        { side: 'blue', rank: 8, c: 0, r: 0 },
        { side: 'blue', rank: 7, c: 6, r: 0 },
        { side: 'blue', rank: 6, c: 2, r: 0 },
        { side: 'blue', rank: 5, c: 4, r: 0 },
        { side: 'blue', rank: 4, c: 1, r: 1 },
        { side: 'blue', rank: 3, c: 5, r: 1 },
        { side: 'blue', rank: 2, c: 2, r: 2 },
        { side: 'blue', rank: 1, c: 4, r: 2 },
        { side: 'red', rank: 8, c: 0, r: 8 },
        { side: 'red', rank: 7, c: 6, r: 8 },
        { side: 'red', rank: 6, c: 2, r: 8 },
        { side: 'red', rank: 5, c: 4, r: 8 },
        { side: 'red', rank: 4, c: 1, r: 7 },
        { side: 'red', rank: 3, c: 5, r: 7 },
        { side: 'red', rank: 2, c: 2, r: 6 },
        { side: 'red', rank: 1, c: 4, r: 6 }
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
        steps: document.getElementById('steps'),
        you: document.getElementById('you-count'),
        cpu: document.getElementById('cpu-count'),
        level: document.getElementById('level'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    let pieces = [];
    let state = 'ready';      // ready | play | think | over
    let turn = 'red';
    let diff = 'normal';
    let steps = 0;
    let winYou = 0;
    let winCpu = 0;
    let selected = null;
    let legal = [];
    let lastMove = null;
    let anim = null;
    let parts = [];
    let wavePhase = 0;
    let thinkT = 0;
    let shakeT = 0;
    let hudCache = '';
    let resultText = '';

    function inBoard(c, r) {
        return c >= 0 && c < COLS && r >= 0 && r < ROWS;
    }

    function isWater(c, r) {
        return r >= 3 && r <= 5 && c >= 1 && c <= 5;
    }

    function trapList(side) {
        return side === 'red' ? TRAP_RED : TRAP_BLUE;
    }

    function denOf(side) {
        return side === 'red' ? DEN_RED : DEN_BLUE;
    }

    function inTrap(c, r, side) {
        const t = trapList(side);
        for (let i = 0; i < t.length; i++) {
            if (t[i][0] === c && t[i][1] === r) return true;
        }
        return false;
    }

    function at(c, r) {
        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            if (p.alive && p.c === c && p.r === r) return p;
        }
        return null;
    }

    function aliveCount(side) {
        let n = 0;
        for (let i = 0; i < pieces.length; i++) {
            if (pieces[i].alive && pieces[i].side === side) n++;
        }
        return n;
    }

    /* ---------- 规则 ---------- */

    /* 水陆之间不能互吃；陷阱中的棋子失去战力 */
    function canCapture(att, def, toC, toR) {
        if (!def || def.side === att.side) return false;
        if (isWater(att.c, att.r) !== isWater(toC, toR)) return false;
        const attLost = inTrap(att.c, att.r, def.side);
        const defLost = inTrap(toC, toR, att.side);
        const a = attLost ? 0 : att.rank;
        const d = defLost ? 0 : def.rank;
        if (att.rank === 1 && def.rank === 8 && !defLost) return true;
        if (att.rank === 8 && def.rank === 1 && !defLost) return false;
        return a >= d;
    }

    /* 狮子(7)/老虎(6) 可以跳过连续的水域，且水面上不能有老鼠 */
    function jumpTarget(p, dc, dr) {
        let c = p.c + dc;
        let r = p.r + dr;
        let water = 0;
        while (inBoard(c, r) && isWater(c, r)) {
            const o = at(c, r);
            if (o && o.rank === 1) return null;
            water++;
            c += dc;
            r += dr;
        }
        if (!water || !inBoard(c, r)) return null;
        return { c: c, r: r };
    }

    function pushMove(out, p, c, r) {
        if (!inBoard(c, r)) return;
        const den = denOf(p.side);
        if (c === den.c && r === den.r) return;
        const o = at(c, r);
        if (o && o.side === p.side) return;
        if (o && !canCapture(p, o, c, r)) return;
        if (!o && isWater(c, r) && p.rank !== 1) return;
        out.push({ piece: p, to: { c: c, r: r }, cap: o || null });
    }

    function movesOf(p) {
        const out = [];
        for (let i = 0; i < DIRS.length; i++) {
            const dc = DIRS[i][0];
            const dr = DIRS[i][1];
            const nc = p.c + dc;
            const nr = p.r + dr;
            if (isWater(nc, nr) && p.rank !== 1) {
                if (p.rank === 6 || p.rank === 7) {
                    const t = jumpTarget(p, dc, dr);
                    if (t) pushMove(out, p, t.c, t.r);
                }
                continue;
            }
            pushMove(out, p, nc, nr);
        }
        return out;
    }

    function legalMoves(side) {
        const out = [];
        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            if (!p.alive || p.side !== side) continue;
            const ms = movesOf(p);
            for (let k = 0; k < ms.length; k++) out.push(ms[k]);
        }
        return out;
    }

    function isDenEntry(m) {
        const den = denOf(m.piece.side === 'red' ? 'blue' : 'red');
        return m.to.c === den.c && m.to.r === den.r;
    }

    function applyMove(m) {
        const from = { c: m.piece.c, r: m.piece.r };
        const cap = m.cap;
        m.piece.c = m.to.c;
        m.piece.r = m.to.r;
        if (cap) cap.alive = false;
        return { from: from, cap: cap };
    }

    function undoMove(m, undo) {
        m.piece.c = undo.from.c;
        m.piece.r = undo.from.r;
        if (undo.cap) undo.cap.alive = true;
    }

    /* ---------- 电脑 ---------- */

    function evaluate() {
        let s = 0;
        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            if (!p.alive) continue;
            const blue = p.side === 'blue';
            const den = blue ? DEN_RED : DEN_BLUE;
            const d = Math.abs(p.c - den.c) + Math.abs(p.r - den.r);
            let v = RANK_W[p.rank] + (12 - d) * 3.4;
            if (inTrap(p.c, p.r, blue ? 'red' : 'blue')) v -= 110;
            s += blue ? v : -v;
        }
        return s;
    }

    function search(depth, alpha, beta, side) {
        const moves = legalMoves(side);
        if (!moves.length) return side === 'blue' ? -99999 : 99999;
        if (depth <= 0) return evaluate();

        const maxing = side === 'blue';
        for (let i = 1; i < moves.length; i++) {
            const m = moves[i];
            if (!m.cap) continue;
            let j = i - 1;
            while (j >= 0 && !moves[j].cap) {
                moves[j + 1] = moves[j];
                j--;
            }
            moves[j + 1] = m;
        }

        let best = maxing ? -Infinity : Infinity;
        for (let i = 0; i < moves.length; i++) {
            const m = moves[i];
            let sc;
            if (isDenEntry(m)) {
                sc = maxing ? 90000 + depth : -90000 - depth;
            } else {
                const undo = applyMove(m);
                sc = search(depth - 1, alpha, beta, maxing ? 'red' : 'blue');
                undoMove(m, undo);
            }
            if (maxing) {
                if (sc > best) best = sc;
                if (best > alpha) alpha = best;
            } else {
                if (sc < best) best = sc;
                if (best < beta) beta = best;
            }
            if (beta <= alpha) break;
        }
        return best;
    }

    function aiMove() {
        const moves = legalMoves('blue');
        if (!moves.length) {
            finish('red');
            return;
        }
        for (let i = 0; i < moves.length; i++) {
            if (isDenEntry(moves[i])) {
                doMove(moves[i]);
                return;
            }
        }
        const depth = DEPTH[diff];
        const noise = diff === 'easy' ? 150 : (diff === 'normal' ? 18 : 0);
        let best = -Infinity;
        let pick = [];
        for (let i = 0; i < moves.length; i++) {
            const m = moves[i];
            const undo = applyMove(m);
            const sc = search(depth - 1, -Infinity, Infinity, 'red') + Math.random() * noise;
            undoMove(m, undo);
            if (sc > best + 0.001) {
                best = sc;
                pick = [m];
            } else if (sc > best - 0.001) {
                pick.push(m);
            }
        }
        doMove(pick[Math.floor(Math.random() * pick.length)]);
    }

    /* ---------- 走子 ---------- */

    function spawnCapture(p) {
        const cx = BX + p.c * CELL + CELL / 2;
        const cy = BY + p.r * CELL + CELL / 2;
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 120;
            parts.push({
                x: cx, y: cy,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                life: 0.45 + Math.random() * 0.3,
                max: 0.75,
                col: p.side === 'red' ? COL_RED : COL_BLUE
            });
        }
        shakeT = 0.18;
    }

    function doMove(m) {
        const side = m.piece.side;
        const from = { c: m.piece.c, r: m.piece.r };
        const cap = m.cap;
        m.piece.c = m.to.c;
        m.piece.r = m.to.r;
        if (cap) {
            cap.alive = false;
            spawnCapture(cap);
        }
        anim = { piece: m.piece, fc: from.c, fr: from.r, t: 0, dur: 0.17 };
        lastMove = { fc: from.c, fr: from.r, tc: m.to.c, tr: m.to.r };
        steps++;
        selected = null;
        legal = [];
        hudCache = '';

        const den = denOf(side === 'red' ? 'blue' : 'red');
        if (m.to.c === den.c && m.to.r === den.r) {
            finish(side);
            return;
        }
        if (aliveCount(side === 'red' ? 'blue' : 'red') === 0) {
            finish(side);
            return;
        }
        turn = side === 'red' ? 'blue' : 'red';
        if (turn === 'blue') {
            state = 'think';
            thinkT = diff === 'easy' ? 0.5 : 0.4;
        } else {
            state = 'play';
        }
        updateHud();
    }

    function finish(winner) {
        state = 'over';
        anim = null;
        if (winner === 'red') winYou++;
        else winCpu++;
        hudCache = '';
        updateHud();
        showResult(winner === 'red');
    }

    /* ---------- 界面 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'over') return resultText;
        if (state === 'think') return '电脑思考中…';
        return '轮到你走棋';
    }

    function updateHud() {
        const key = state + '|' + steps + '|' + winYou + '|' + winCpu + '|' + diff + '|' + turn;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.steps.textContent = String(steps);
        els.you.textContent = String(winYou);
        els.cpu.textContent = String(winCpu);
        els.level.textContent = DIFF_NAME[diff];
        els.restartBtn.textContent = state === 'ready' ? '开始对局' : '重新开局';
    }

    function showResult(win) {
        resultText = win ? '你赢了' : '电脑赢了';
        els.ovTitle.textContent = resultText;
        els.ovTitle.classList.toggle('danger', !win);
        els.ovDesc.textContent = win
            ? '成功攻破对方兽穴，共走了 ' + steps + ' 步。当前局比分 ' + winYou + ' : ' + winCpu + '。'
            : '兽穴失守。对方还剩 ' + aliveCount('blue') + ' 只兽，试试守住陷阱、把老鼠留在河边。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = winYou + ' : ' + winCpu;
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
        els.ovBtn.hidden = false;
        els.ovRestart.hidden = true;
    }

    function resetBoard() {
        pieces = START.map(function (s) {
            return { side: s.side, rank: s.rank, c: s.c, r: s.r, alive: true };
        });
        steps = 0;
        selected = null;
        legal = [];
        lastMove = null;
        anim = null;
        parts = [];
        resultText = '';
        shakeT = 0;
        turn = 'red';
    }

    function startGame() {
        resetBoard();
        state = 'play';
        hideOverlay();
        hudCache = '';
        updateHud();
    }

    /* ---------- 绘制 ---------- */

    function cellX(c) {
        return BX + c * CELL + CELL / 2;
    }

    function cellY(r) {
        return BY + r * CELL + CELL / 2;
    }

    function drawBackdrop() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1522');
        g.addColorStop(0.5, '#0b1a26');
        g.addColorStop(1, '#071018');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, BY + BH * 0.5, 40, W / 2, BY + BH * 0.5, 340);
        glow.addColorStop(0, 'rgba(38, 120, 140, .16)');
        glow.addColorStop(1, 'rgba(8, 20, 30, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
    }

    function drawBoard() {
        ctx.save();
        if (shakeT > 0) {
            ctx.translate((Math.random() - 0.5) * 5 * (shakeT / 0.18), (Math.random() - 0.5) * 5 * (shakeT / 0.18));
        }

        roundRectPath(ctx, BX - 10, BY - 10, BW + 20, BH + 20, 18);
        const bg = ctx.createLinearGradient(BX, BY, BX + BW, BY + BH);
        bg.addColorStop(0, 'rgba(20, 46, 58, .95)');
        bg.addColorStop(0.5, 'rgba(16, 38, 48, .95)');
        bg.addColorStop(1, 'rgba(23, 52, 62, .95)');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(95, 216, 255, .22)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        /* 网格 */
        ctx.strokeStyle = 'rgba(120, 190, 210, .10)';
        ctx.lineWidth = 1;
        for (let c = 1; c < COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(BX + c * CELL, BY + 1);
            ctx.lineTo(BX + c * CELL, BY + BH - 1);
            ctx.stroke();
        }
        for (let r = 1; r < ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(BX + 1, BY + r * CELL);
            ctx.lineTo(BX + BW - 1, BY + r * CELL);
            ctx.stroke();
        }

        /* 河流 */
        const wx = BX + CELL;
        const wy = BY + 3 * CELL;
        const ww = 5 * CELL;
        const wh = 3 * CELL;
        roundRectPath(ctx, wx, wy, ww, wh, 12);
        const wg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        wg.addColorStop(0, 'rgba(24, 82, 136, .62)');
        wg.addColorStop(0.5, 'rgba(14, 54, 100, .72)');
        wg.addColorStop(1, 'rgba(24, 82, 136, .62)');
        ctx.fillStyle = wg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(95, 216, 255, .26)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        ctx.save();
        roundRectPath(ctx, wx, wy, ww, wh, 12);
        ctx.clip();
        for (let i = 0; i < 6; i++) {
            const yy = wy + 12 + i * 24;
            ctx.beginPath();
            for (let x = wx; x <= wx + ww; x += 6) {
                const y = yy + Math.sin((x - wx) / 28 + wavePhase + i * 0.7) * 2.4;
                if (x === wx) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(130, 220, 255, ' + (0.07 + i * 0.012).toFixed(3) + ')';
            ctx.lineWidth = 1.1;
            ctx.stroke();
        }
        ctx.restore();

        /* 陷阱 */
        const traps = [[TRAP_BLUE, COL_BLUE], [TRAP_RED, COL_RED]];
        for (let t = 0; t < traps.length; t++) {
            const list = traps[t][0];
            const col = traps[t][1];
            for (let i = 0; i < list.length; i++) {
                const x = BX + list[i][0] * CELL;
                const y = BY + list[i][1] * CELL;
                roundRectPath(ctx, x + 7, y + 7, CELL - 14, CELL - 14, 8);
                ctx.fillStyle = hexA(col, 0.09);
                ctx.fill();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = hexA(col, 0.5);
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.strokeStyle = hexA(col, 0.16);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 13, y + 13);
                ctx.lineTo(x + CELL - 13, y + CELL - 13);
                ctx.moveTo(x + CELL - 13, y + 13);
                ctx.lineTo(x + 13, y + CELL - 13);
                ctx.stroke();
            }
        }

        /* 兽穴 */
        drawDen(DEN_BLUE, COL_BLUE, '穴');
        drawDen(DEN_RED, COL_RED, '穴');

        /* 上一步 */
        if (lastMove) {
            const marks = [[lastMove.fc, lastMove.fr], [lastMove.tc, lastMove.tr]];
            for (let i = 0; i < 2; i++) {
                ctx.fillStyle = 'rgba(255, 232, 150, ' + (i ? 0.12 : 0.07) + ')';
                roundRectPath(ctx, BX + marks[i][0] * CELL + 3, BY + marks[i][1] * CELL + 3, CELL - 6, CELL - 6, 8);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function drawDen(den, col, label) {
        const cx = cellX(den.c);
        const cy = cellY(den.r);
        const pulse = 0.55 + Math.sin(wavePhase * 1.8) * 0.12;
        const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 26);
        g.addColorStop(0, hexA(col, 0.3));
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, TAU);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, TAU);
        ctx.strokeStyle = hexA(col, pulse);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 10.5, 0, TAU);
        ctx.strokeStyle = hexA(col, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = hexA(col, 0.9);
        ctx.font = '700 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy + 0.5);
    }

    function hexA(hex, a) {
        const s = hex.replace('#', '');
        const r = parseInt(s.slice(0, 2), 16);
        const g = parseInt(s.slice(2, 4), 16);
        const b = parseInt(s.slice(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function drawPieces() {
        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            if (!p.alive) continue;
            let cx = cellX(p.c);
            let cy = cellY(p.r);
            if (anim && anim.piece === p) {
                const k = clamp(anim.t / anim.dur, 0, 1);
                const e = 1 - Math.pow(1 - k, 2.2);
                const bx = BX + anim.fc * CELL + CELL / 2;
                const by = BY + anim.fr * CELL + CELL / 2;
                cx = bx + (cx - bx) * e;
                cy = by + (cy - by) * e;
            }
            drawPiece(p, cx, cy);
        }
    }

    function drawPiece(p, cx, cy) {
        const red = p.side === 'red';
        const col = red ? COL_RED : COL_BLUE;
        const lost = inTrap(p.c, p.r, red ? 'blue' : 'red');

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy + 2.5, PR_R, 0, TAU);
        ctx.fillStyle = 'rgba(0, 0, 0, .38)';
        ctx.fill();

        const g = ctx.createRadialGradient(cx - 5, cy - 7, 2, cx, cy, PR_R + 2);
        if (red) {
            g.addColorStop(0, lost ? '#7a4b55' : '#ff9b8f');
            g.addColorStop(1, lost ? '#3f2430' : '#c33b46');
        } else {
            g.addColorStop(0, lost ? '#3f6274' : '#b6ecff');
            g.addColorStop(1, lost ? '#1b3446' : '#1f7fa8');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, PR_R, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = hexA(col, lost ? 0.45 : 0.95);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, PR_R - 4.5, 0, TAU);
        ctx.strokeStyle = 'rgba(255, 255, 255, .22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = lost ? 'rgba(255, 255, 255, .55)' : '#ffffff';
        ctx.font = '800 17px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(NAMES[p.rank], cx, cy + 0.5);

        if (lost) {
            ctx.beginPath();
            ctx.arc(cx, cy, PR_R + 3.5, 0, TAU);
            ctx.strokeStyle = 'rgba(255, 120, 120, .55)';
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }

    function drawHints() {
        if (!selected) return;
        const pulse = 0.5 + Math.sin(wavePhase * 5) * 0.5;

        ctx.beginPath();
        ctx.arc(cellX(selected.c), cellY(selected.r), PR_R + 5 + pulse * 2, 0, TAU);
        ctx.strokeStyle = 'rgba(255, 236, 160, ' + (0.45 + pulse * 0.4).toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let i = 0; i < legal.length; i++) {
            const m = legal[i];
            const cx = cellX(m.to.c);
            const cy = cellY(m.to.r);
            if (m.cap) {
                ctx.beginPath();
                ctx.arc(cx, cy, PR_R + 3.5, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 210, 120, .85)';
                ctx.lineWidth = 1.8;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - PR_R + 2, cy - PR_R + 2);
                ctx.lineTo(cx + PR_R - 2, cy + PR_R - 2);
                ctx.moveTo(cx + PR_R - 2, cy - PR_R + 2);
                ctx.lineTo(cx - PR_R + 2, cy + PR_R - 2);
                ctx.strokeStyle = 'rgba(255, 210, 120, .35)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(cx, cy, 5.5, 0, TAU);
                ctx.fillStyle = 'rgba(255, 236, 160, ' + (0.55 + pulse * 0.3).toFixed(2) + ')';
                ctx.fill();
            }
        }
    }

    function drawParts() {
        for (let i = 0; i < parts.length; i++) {
            const q = parts[i];
            const a = clamp(q.life / q.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = hexA(q.col, 0.9);
            ctx.beginPath();
            ctx.arc(q.x, q.y, 2.4 * a + 0.8, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e7fbff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('斗兽棋', 24, 32);

        ctx.fillStyle = 'rgba(150, 200, 210, .78)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('红方是你 · 走进上方兽穴即胜', 24, 54);

        /* 回合标记 */
        const bw = 96;
        const bx = W - 24 - bw;
        const active = turn === 'red' && (state === 'play' || state === 'think');
        ctx.fillStyle = active ? 'rgba(255, 107, 107, .16)' : 'rgba(95, 216, 255, .14)';
        roundRectPath(ctx, bx, 22, bw, 30, 15);
        ctx.fill();
        ctx.strokeStyle = active ? 'rgba(255, 107, 107, .45)' : 'rgba(95, 216, 255, .4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = active ? '#ffb4ac' : '#8fe6ff';
        ctx.font = '700 12px ' + MONO;
        ctx.fillText(state === 'over' ? 'GAME OVER' : (active ? 'YOUR TURN' : 'CPU TURN'), bx + bw / 2, 38);
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(140, 180, 195, .7)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('点击自己的兽，再点亮的落点移动', 24, BY + BH + 26);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(120, 160, 178, .55)';
        ctx.fillText('象狮虎豹狼狗猫鼠', W - 24, BY + BH + 26);
    }

    function render() {
        drawBackdrop();
        drawBoard();
        drawHints();
        drawPieces();
        drawParts();
        drawHeader();
        drawFooter();
    }

    /* ---------- 交互 ---------- */

    function cellFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        const c = Math.floor((x - BX) / CELL);
        const r = Math.floor((y - BY) / CELL);
        if (!inBoard(c, r)) return null;
        return { c: c, r: r };
    }

    function pickAt(c, r) {
        for (let i = 0; i < legal.length; i++) {
            if (legal[i].to.c === c && legal[i].to.r === r) return legal[i];
        }
        return null;
    }

    function onDown(e) {
        if (state !== 'play') return;
        const cell = cellFromEvent(e);
        if (!cell) return;

        const m = pickAt(cell.c, cell.r);
        if (m) {
            doMove(m);
            return;
        }
        const p = at(cell.c, cell.r);
        if (p && p.side === 'red') {
            selected = p;
            legal = movesOf(p);
        } else {
            selected = null;
            legal = [];
        }
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        onDown(e);
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            startGame();
        } else if (e.code === 'Escape') {
            selected = null;
            legal = [];
        }
    });

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        const all = els.diffGroup.querySelectorAll('[data-diff]');
        for (let i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
        hudCache = '';
        updateHud();
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

        wavePhase += dt;
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

        if (anim) {
            anim.t += dt;
            if (anim.t >= anim.dur) anim = null;
        }

        for (let i = parts.length - 1; i >= 0; i--) {
            const q = parts[i];
            q.life -= dt;
            if (q.life <= 0) {
                parts.splice(i, 1);
                continue;
            }
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.vy += 320 * dt;
            q.vx *= 0.98;
        }

        if (state === 'think') {
            thinkT -= dt;
            if (thinkT <= 0) {
                state = 'play';
                aiMove();
            }
        }

        render();
        requestAnimationFrame(frame);
    }

    resetBoard();
    updateHud();
    requestAnimationFrame(frame);
})();
