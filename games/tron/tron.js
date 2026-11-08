/* ==========================================================
   光影摩托 Light Cycle
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const CELL = 12;
    const COLS = 40;
    const ROWS = 40;
    const AY = 76;
    const AH = ROWS * CELL;
    const WIN_SCORE = 3;
    const MAX_ROUND = 5;

    const PLAYER = {
        id: 1,
        core: '#e8fbff',
        mid: 'rgba(95, 216, 255, .62)',
        glow: 'rgba(95, 216, 255, .18)',
        head: '#5fd8ff'
    };
    const RIVAL = {
        id: 2,
        core: '#ffe4ef',
        mid: 'rgba(255, 92, 138, .58)',
        glow: 'rgba(255, 92, 138, .16)',
        head: '#ff5c8a'
    };
    const DIRS = {
        up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0]
    };

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
        you: document.getElementById('you-count'),
        cpu: document.getElementById('cpu-count'),
        level: document.getElementById('level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    const grid = new Uint8Array(COLS * ROWS);
    let state = 'ready';      // ready | countdown | running | roundover | over
    let round = 1;
    let youScore = 0;
    let cpuScore = 0;
    let you = null;
    let cpu = null;
    let stepAcc = 0;
    let interval = 0.095;
    let cdT = 0;
    let pauseT = 0;
    let roundMsg = '';
    let roundMsgT = 0;
    let particles = [];
    let shakeT = 0;
    let hudCache = '';

    function makeRacer(id, x, y, dirX, dirY) {
        return {
            id: id,
            x: x,
            y: y,
            dir: [dirX, dirY],
            cells: [{ x: x, y: y }],
            q: [],
            alive: true
        };
    }

    function mark(r) {
        grid[r.y * COLS + r.x] = r.id;
    }

    function blocked(x, y) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
        return grid[y * COLS + x] !== 0;
    }

    function resetRound() {
        grid.fill(0);
        you = makeRacer(PLAYER.id, 7, 20, 1, 0);
        cpu = makeRacer(RIVAL.id, 32, 20, -1, 0);
        mark(you);
        mark(cpu);
        stepAcc = 0;
        interval = 0.095;
        particles = [];
        shakeT = 0;
        roundMsg = '';
        roundMsgT = 0;
    }

    function startMatch() {
        youScore = 0;
        cpuScore = 0;
        round = 1;
        resetRound();
        state = 'countdown';
        cdT = 1.5;
        hudCache = '';
        updateHud();
        els.overlay.classList.remove('show');
    }

    function burst(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 170;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0.5 + Math.random() * 0.5,
                max: 1,
                col: color
            });
        }
    }

    function kill(r, col) {
        if (!r.alive) return;
        r.alive = false;
        burst((r.x + 0.5) * CELL, AY + (r.y + 0.5) * CELL, col);
    }

    function endRound() {
        state = 'roundover';
        pauseT = 1.8;
        shakeT = 0.28;
        if (you.alive && !cpu.alive) {
            youScore++;
            roundMsg = '你得分';
        } else if (cpu.alive && !you.alive) {
            cpuScore++;
            roundMsg = '电脑得分';
        } else {
            roundMsg = '撞在一起';
        }
        roundMsgT = 1.6;
        hudCache = '';
        updateHud();
    }

    function nextRound() {
        if (youScore >= WIN_SCORE || cpuScore >= WIN_SCORE || round >= MAX_ROUND) {
            state = 'over';
            hudCache = '';
            updateHud();
            showResult();
            return;
        }
        round++;
        resetRound();
        state = 'countdown';
        cdT = 1.5;
        hudCache = '';
        updateHud();
    }

    function showResult() {
        const win = youScore > cpuScore;
        const draw = youScore === cpuScore;
        els.ovTitle.textContent = draw ? '打成平手' : (win ? '你赢了' : '电脑赢了');
        els.ovTitle.classList.toggle('danger', !win && !draw);
        els.ovDesc.textContent = '五局三胜，最终比分 ' + youScore + ' : ' + cpuScore +
            '。光墙会一直留在场上，越到后面越窄。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = youScore + ' : ' + cpuScore;
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.ovRestart.textContent = '再来一局';
        els.overlay.classList.add('show');
    }

    /* ---------- 电脑转向 ---------- */

    function rayFree(x, y, dx, dy, max) {
        let n = 0;
        for (let i = 0; i < max; i++) {
            x += dx;
            y += dy;
            if (blocked(x, y)) break;
            n++;
        }
        return n;
    }

    function freeNeighbors(x, y) {
        let n = 0;
        const d = [DIRS.up, DIRS.right, DIRS.down, DIRS.left];
        for (let i = 0; i < 4; i++) {
            if (!blocked(x + d[i][0], y + d[i][1])) n++;
        }
        return n;
    }

    function aiTurn() {
        const opts = [];
        const dirs = [DIRS.up, DIRS.right, DIRS.down, DIRS.left];
        for (let i = 0; i < dirs.length; i++) {
            const d = dirs[i];
            if (d[0] === -cpu.dir[0] && d[1] === -cpu.dir[1]) continue;
            const nx = cpu.x + d[0];
            const ny = cpu.y + d[1];
            if (blocked(nx, ny)) continue;

            let sc = rayFree(nx, ny, d[0], d[1], 18) * 1.0;
            sc += freeNeighbors(nx, ny) * 1.4;
            const edge = Math.min(nx, ny, COLS - 1 - nx, ROWS - 1 - ny);
            sc += Math.min(edge, 7) * 0.7;
            sc += Math.random() * 2.4;
            opts.push({ d: d, sc: sc });
        }
        if (!opts.length) return;
        opts.sort(function (a, b) { return b.sc - a.sc; });
        cpu.dir = opts[0].d;
    }

    /* ---------- 逐格推进 ---------- */

    function gameStep() {
        if (you.q.length) you.dir = you.q.shift();
        aiTurn();

        const un = { x: you.x + you.dir[0], y: you.y + you.dir[1] };
        const cn = { x: cpu.x + cpu.dir[0], y: cpu.y + cpu.dir[1] };

        const uHit = blocked(un.x, un.y);
        const cHit = blocked(cn.x, cn.y);
        const headOn = !uHit && !cHit && un.x === cn.x && un.y === cn.y;

        if (!uHit && !headOn) {
            you.x = un.x;
            you.y = un.y;
            you.cells.push({ x: un.x, y: un.y });
            mark(you);
        }
        if (!cHit && !headOn) {
            cpu.x = cn.x;
            cpu.y = cn.y;
            cpu.cells.push({ x: cn.x, y: cn.y });
            mark(cpu);
        }

        if (uHit || headOn) kill(you, PLAYER.head);
        if (cHit || headOn) kill(cpu, RIVAL.head);

        interval = Math.max(0.058, interval - 0.00042);
        if (!you.alive || !cpu.alive) endRound();
    }

    /* ---------- 输入 ---------- */

    function queueDir(racer, d) {
        const base = racer.q.length ? racer.q[racer.q.length - 1] : racer.dir;
        if (d[0] === base[0] && d[1] === base[1]) return;
        if (d[0] === -base[0] && d[1] === -base[1]) return;
        if (racer.q.length >= 2) return;
        racer.q.push(d);
    }

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startMatch();
            return;
        }
        if (state === 'ready' || state === 'over') {
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                startMatch();
            }
            return;
        }
        let d = null;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') d = DIRS.up;
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') d = DIRS.down;
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') d = DIRS.left;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') d = DIRS.right;
        if (d) {
            e.preventDefault();
            if (you && state === 'running') queueDir(you, d);
        }
    });

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'running' || !you) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        e.preventDefault();
        const left = x < W / 2;
        const dl = [you.dir[1], -you.dir[0]];
        const dr = [-you.dir[1], you.dir[0]];
        queueDir(you, left ? dl : dr);
    });

    els.ovBtn.addEventListener('click', startMatch);
    els.ovRestart.addEventListener('click', startMatch);
    els.restartBtn.addEventListener('click', startMatch);

    /* ---------- 渲染 ---------- */

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'countdown') return '准备出发';
        if (state === 'running') return '竞速中';
        if (state === 'roundover') return '本局结束';
        return youScore > cpuScore ? '你赢了' : (youScore === cpuScore ? '打成平手' : '电脑赢了');
    }

    function updateHud() {
        const key = state + '|' + youScore + '|' + cpuScore + '|' + round;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.you.textContent = String(youScore);
        els.cpu.textContent = String(cpuScore);
        els.level.textContent = (state === 'ready' ? 0 : round) + ' / ' + MAX_ROUND;
        els.restartBtn.textContent = state === 'running' ? '重新开始' : '再来一局';
    }

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('光影摩托', 24, 34);

        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 190, 220, .8)';
        const sub = state === 'ready'
            ? '五局三胜 · 先到三分'
            : '你 ' + youScore + ' : ' + cpuScore + ' 电脑 · 第 ' + round + ' 局';
        ctx.fillText(sub, 24, 56);

        /* 比分条 */
        const bx = W - 24 - 132;
        ctx.fillStyle = 'rgba(95, 216, 255, .12)';
        roundRectPath(ctx, bx, 24, 132, 30, 15);
        ctx.fill();
        ctx.fillStyle = '#5fd8ff';
        ctx.font = '700 12px ' + MONO;
        ctx.textAlign = 'left';
        ctx.fillText('YOU', bx + 12, 39);
        ctx.fillStyle = 'rgba(190, 228, 250, .9)';
        ctx.textAlign = 'center';
        ctx.fillText(youScore + ' : ' + cpuScore, bx + 66, 39);
        ctx.fillStyle = '#ff5c8a';
        ctx.textAlign = 'right';
        ctx.fillText('CPU', bx + 120, 39);
    }

    function drawArena() {
        ctx.fillStyle = '#050a14';
        ctx.fillRect(0, AY, W, AH);

        const glow = ctx.createRadialGradient(W / 2, AY + AH / 2, 40, W / 2, AY + AH / 2, 330);
        glow.addColorStop(0, 'rgba(40, 90, 140, .22)');
        glow.addColorStop(1, 'rgba(10, 20, 34, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, AY, W, AH);

        ctx.lineWidth = 1;
        for (let i = 1; i < COLS; i++) {
            ctx.strokeStyle = i % 5 === 0 ? 'rgba(95, 216, 255, .12)' : 'rgba(95, 216, 255, .05)';
            ctx.beginPath();
            ctx.moveTo(i * CELL + 0.5, AY);
            ctx.lineTo(i * CELL + 0.5, AY + AH);
            ctx.stroke();
        }
        for (let j = 1; j < ROWS; j++) {
            ctx.strokeStyle = j % 5 === 0 ? 'rgba(95, 216, 255, .12)' : 'rgba(95, 216, 255, .05)';
            ctx.beginPath();
            ctx.moveTo(0, AY + j * CELL + 0.5);
            ctx.lineTo(W, AY + j * CELL + 0.5);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(95, 216, 255, .26)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0.75, AY + 0.75, W - 1.5, AH - 1.5);
    }

    function trailPath(r) {
        ctx.beginPath();
        const c0 = r.cells[0];
        ctx.moveTo(c0.x * CELL + CELL / 2, AY + c0.y * CELL + CELL / 2);
        for (let i = 1; i < r.cells.length; i++) {
            const c = r.cells[i];
            ctx.lineTo(c.x * CELL + CELL / 2, AY + c.y * CELL + CELL / 2);
        }
    }

    function drawRacer(r, style) {
        if (r.cells.length > 1) {
            trailPath(r);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = style.glow;
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.strokeStyle = style.mid;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.strokeStyle = style.core;
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }

        const hx = r.x * CELL + CELL / 2;
        const hy = AY + r.y * CELL + CELL / 2;
        if (!r.alive) {
            ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(hx, hy, 6, 0, TAU);
            ctx.stroke();
            return;
        }

        const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 11);
        g.addColorStop(0, style.core);
        g.addColorStop(0.35, style.head);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, 11, 0, TAU);
        ctx.fill();

        ctx.fillStyle = style.core;
        ctx.beginPath();
        ctx.arc(hx, hy, 3.4, 0, TAU);
        ctx.fill();
    }

    function drawParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
            ctx.fillStyle = p.col;
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;
    }

    function drawCenterText() {
        if (state === 'countdown') {
            const n = Math.ceil(cdT / 0.5);
            const frac = (cdT % 0.5) / 0.5;
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#dff3ff';
            ctx.font = '800 ' + Math.round(40 + 16 * frac) + 'px ' + MONO;
            ctx.fillText(n > 0 ? String(n) : 'GO', W / 2, AY + AH / 2);
            ctx.restore();
            return;
        }
        if (state === 'roundover' && roundMsg) {
            ctx.save();
            ctx.globalAlpha = clamp(roundMsgT / 1.2, 0, 1);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 26px ' + FONT;
            const tw = ctx.measureText(roundMsg).width + 56;
            ctx.fillStyle = 'rgba(6, 14, 26, .86)';
            roundRectPath(ctx, (W - tw) / 2, AY + AH / 2 - 30, tw, 60, 16);
            ctx.fill();
            ctx.strokeStyle = 'rgba(95, 216, 255, .35)';
            ctx.lineWidth = 1.2;
            roundRectPath(ctx, (W - tw) / 2, AY + AH / 2 - 30, tw, 60, 16);
            ctx.stroke();
            ctx.fillStyle = '#e9f7ff';
            ctx.fillText(roundMsg, W / 2, AY + AH / 2 + 1);
            ctx.restore();
        }
    }

    function drawFooter() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(150, 190, 220, .7)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('方向键 / WASD 转向 · 撞墙或光墙即负', 24, 578);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(120, 160, 200, .55)';
        ctx.fillText('点屏幕左右半区也能转向', W - 24, 578);
    }

    function render(dt) {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#070d1a');
        bg.addColorStop(0.5, '#050a13');
        bg.addColorStop(1, '#040810');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        if (shakeT > 0) {
            const k = shakeT / 0.28;
            ctx.translate(Math.sin(shakeT * 120) * 4 * k, Math.cos(shakeT * 96) * 3 * k);
        }
        drawArena();
        if (you && cpu) {
            drawRacer(you, PLAYER);
            drawRacer(cpu, RIVAL);
        }
        drawParticles(dt);
        drawCenterText();
        ctx.restore();

        drawHeader();
        drawFooter();
    }

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
        if (roundMsgT > 0) roundMsgT = Math.max(0, roundMsgT - dt);

        if (state === 'countdown') {
            cdT -= dt;
            if (cdT <= 0) {
                state = 'running';
                stepAcc = 0;
                hudCache = '';
                updateHud();
            }
        } else if (state === 'running') {
            stepAcc += dt;
            let guard = 0;
            while (stepAcc >= interval && state === 'running' && guard < 6) {
                stepAcc -= interval;
                gameStep();
                guard++;
            }
        } else if (state === 'roundover') {
            pauseT -= dt;
            if (pauseT <= 0) nextRound();
        }

        render(dt);
        requestAnimationFrame(frame);
    }

    resetRound();
    updateHud();
    requestAnimationFrame(frame);
})();
