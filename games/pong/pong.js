/* ==========================================================
   乒乓球 Pong
   ========================================================== */
(function () {
    'use strict';

    const W = 560;
    const H = 420;
    const TAU = Math.PI * 2;

    const WALL = 18;
    const PADDLE_W = 13;
    const PADDLE_H = 78;
    const PLAYER_X = 26;
    const AI_X = W - 26 - PADDLE_W;
    const BALL_R = 8;

    const WIN_SCORE = 7;
    const BASE_SPEED = 330;
    const MAX_SPEED = 780;
    const PLAYER_KEY_SPEED = 540;

    const AI_SPEED = { easy: 210, normal: 320, hard: 440 };
    const AI_JITTER = { easy: 46, normal: 20, hard: 6 };

    const BEST_KEY = 'webgames.pong.best';

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

    function roundRect(g, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + rr, y);
        g.lineTo(x + w - rr, y);
        g.quadraticCurveTo(x + w, y, x + w, y + rr);
        g.lineTo(x + w, y + h - rr);
        g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        g.lineTo(x + rr, y + h);
        g.quadraticCurveTo(x, y + h, x, y + h - rr);
        g.lineTo(x, y + rr);
        g.quadraticCurveTo(x, y, x + rr, y);
        g.closePath();
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        scoreline: document.getElementById('scoreline'),
        pScore: document.getElementById('p-score'),
        aScore: document.getElementById('a-score'),
        rally: document.getElementById('rally'),
        speed: document.getElementById('speed'),
        best: document.getElementById('best'),
        diffGroup: document.getElementById('diff-group'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let player = { y: (H - PADDLE_H) / 2 };
    let ai = { y: (H - PADDLE_H) / 2 };
    let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    let trail = [];

    let playerScore = 0;
    let aiScore = 0;
    let rally = 0;
    let bestRally = Number(localStorage.getItem(BEST_KEY) || 0);
    let state = 'ready';       // ready | playing | point | paused | over
    let diff = 'normal';
    let elapsed = 0;
    let pointTimer = 0;
    let hudCache = '';
    let keys = {};
    let flash = 0;

    /* ---------- 场地 ---------- */
    const courtGrad = ctx.createLinearGradient(0, 0, W, H);
    courtGrad.addColorStop(0, '#0b1a24');
    courtGrad.addColorStop(0.5, '#0d2230');
    courtGrad.addColorStop(1, '#08121b');

    /* ---------- 流程 ---------- */
    function reset() {
        player.y = (H - PADDLE_H) / 2;
        ai.y = (H - PADDLE_H) / 2;
        ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
        trail = [];
        playerScore = 0;
        aiScore = 0;
        rally = 0;
        elapsed = 0;
        flash = 0;
        pointTimer = 0;
        hudCache = '';
        updateHud();
    }

    function serve(dir) {
        const a = (Math.random() - 0.5) * 0.9;
        ball.x = W / 2;
        ball.y = H / 2 + (Math.random() - 0.5) * 60;
        ball.vx = Math.cos(a) * BASE_SPEED * dir;
        ball.vy = Math.sin(a) * BASE_SPEED;
        trail = [];
        rally = 0;
        updateHud();
    }

    function begin() {
        reset();
        serve(Math.random() < 0.5 ? 1 : -1);
        state = 'playing';
        hideOverlay();
    }

    function togglePause() {
        if (state === 'playing') {
            state = 'paused';
            showOverlay('paused');
        } else if (state === 'paused') {
            state = 'playing';
            hideOverlay();
        }
    }

    function point(who) {
        if (who === 'player') playerScore += 1;
        else aiScore += 1;

        if (rally > bestRally) {
            bestRally = rally;
            localStorage.setItem(BEST_KEY, String(bestRally));
        }

        flash = 0.5;
        updateHud();

        if (playerScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
            state = 'over';
            showOverlay('over');
            return;
        }

        state = 'point';
        pointTimer = 0.72;
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const spd = ball.vx || ball.vy ? Math.hypot(ball.vx, ball.vy) : 0;
        const ratio = (spd / BASE_SPEED).toFixed(1);
        const key = playerScore + '|' + aiScore + '|' + rally + '|' + ratio + '|' + bestRally;
        if (key === hudCache) return;
        hudCache = key;

        els.scoreline.textContent = playerScore + ' : ' + aiScore;
        els.pScore.textContent = String(playerScore);
        els.aScore.textContent = String(aiScore);
        els.rally.textContent = String(rally);
        els.speed.textContent = (spd ? ratio : '1.0') + '×';
        els.best.textContent = String(bestRally);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '乒乓球';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '移动左侧球拍接住来球，击球的位置决定反弹角度。' +
                '球每被击打一次就更快一点，先拿到 ' + WIN_SCORE + ' 分者获胜。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始比赛';
        } else if (kind === 'paused') {
            els.ovTitle.textContent = '已暂停';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按 P 或 Esc 继续比赛。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = playerScore + ' : ' + aiScore;
            els.ovBtn.textContent = '继续';
        } else {
            const win = playerScore >= WIN_SCORE;
            els.ovTitle.textContent = win ? '赢下这一局' : '电脑获胜';
            els.ovTitle.classList.toggle('danger', !win);
            els.ovDesc.textContent = win
                ? '最终比分 ' + playerScore + ' : ' + aiScore + '，最长回合 ' + bestRally +
                ' 拍。试试更快的难度？'
                : '最终比分 ' + playerScore + ' : ' + aiScore +
                '。注意球拍边缘能打出更大的角度。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = playerScore + ' : ' + aiScore;
            els.ovBtn.textContent = '再来一局';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 更新 ---------- */
    function predictY() {
        if (ball.vx <= 0) return H / 2;
        const t = (AI_X - ball.x) / ball.vx;
        if (t < 0) return H / 2;

        const lo = WALL + BALL_R;
        const hi = H - WALL - BALL_R;
        const span = hi - lo;

        let y = ball.y + ball.vy * t;
        y = y - lo;
        const period = 2 * span;
        y = ((y % period) + period) % period;
        if (y > span) y = period - y;
        return y + lo;
    }

    function moveAi(dt) {
        const target = predictY();
        const jitter = Math.sin(elapsed * 2.3) * AI_JITTER[diff];
        const want = clamp(target + jitter, WALL, H - WALL) - PADDLE_H / 2;
        const spd = AI_SPEED[diff] * dt;

        if (ai.y + 3 < want) ai.y = Math.min(want, ai.y + spd);
        else if (ai.y - 3 > want) ai.y = Math.max(want, ai.y - spd);

        ai.y = clamp(ai.y, WALL, H - WALL - PADDLE_H);
    }

    function movePlayer(dt) {
        const spd = PLAYER_KEY_SPEED * dt;
        if (keys['ArrowUp'] || keys['w'] || keys['W']) player.y -= spd;
        if (keys['ArrowDown'] || keys['s'] || keys['S']) player.y += spd;
        player.y = clamp(player.y, WALL, H - WALL - PADDLE_H);
    }

    function hitPaddle(px, py) {
        const nx = clamp(ball.x, px, px + PADDLE_W);
        const ny = clamp(ball.y, py, py + PADDLE_H);
        const dx = ball.x - nx;
        const dy = ball.y - ny;
        return dx * dx + dy * dy <= BALL_R * BALL_R;
    }

    function bounce(px, py) {
        const center = py + PADDLE_H / 2;
        const rel = clamp((ball.y - center) / (PADDLE_H / 2), -1, 1);
        const angle = rel * 0.92;
        const spd = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) * 1.05);
        const dir = px < W / 2 ? 1 : -1;

        ball.vx = Math.cos(angle) * spd * dir;
        ball.vy = Math.sin(angle) * spd;
        ball.x = dir > 0 ? px + PADDLE_W + BALL_R + 0.5 : px - BALL_R - 0.5;

        rally += 1;
        if (rally > bestRally) bestRally = rally;
        updateHud();
    }

    function update(dt) {
        elapsed += dt;
        if (flash > 0) flash = Math.max(0, flash - dt);
        movePlayer(dt);
        moveAi(dt);

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.y - BALL_R < WALL) {
            ball.y = WALL + BALL_R;
            ball.vy = Math.abs(ball.vy);
        } else if (ball.y + BALL_R > H - WALL) {
            ball.y = H - WALL - BALL_R;
            ball.vy = -Math.abs(ball.vy);
        }

        if (ball.vx < 0 && hitPaddle(PLAYER_X, player.y)) bounce(PLAYER_X, player.y);
        else if (ball.vx > 0 && hitPaddle(AI_X, ai.y)) bounce(AI_X, ai.y);

        if (ball.x < -BALL_R - 10) {
            point('ai');
            return;
        }
        if (ball.x > W + BALL_R + 10) {
            point('player');
            return;
        }

        trail.unshift({ x: ball.x, y: ball.y });
        if (trail.length > 14) trail.pop();
    }

    /* ---------- 绘制 ---------- */
    function drawCourt() {
        ctx.fillStyle = courtGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(47, 212, 139, .07)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 28) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, H);
            ctx.stroke();
        }
        for (let y = 0; y < H; y += 28) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(W, y + 0.5);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(90, 210, 255, .16)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, WALL);
        ctx.lineTo(W, WALL);
        ctx.moveTo(0, H - WALL);
        ctx.lineTo(W, H - WALL);
        ctx.stroke();

        ctx.save();
        ctx.setLineDash([12, 14]);
        ctx.strokeStyle = 'rgba(150, 180, 215, .26)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2, WALL);
        ctx.lineTo(W / 2, H - WALL);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = 'rgba(90, 210, 255, .38)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 54, 0, TAU);
        ctx.stroke();
    }

    function drawScoreBoard() {
        ctx.save();
        ctx.font = '800 52px "SF Mono", Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.3;

        ctx.fillStyle = '#9fe4ff';
        ctx.fillText(String(playerScore), W / 2 - 96, 52);

        ctx.fillStyle = '#ffb0b8';
        ctx.fillText(String(aiScore), W / 2 + 96, 52);
        ctx.restore();
    }

    function drawPaddle(x, y, color, glow) {
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 18;

        const g = ctx.createLinearGradient(x, y, x + PADDLE_W, y + PADDLE_H);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(255, 255, 255, .35)');
        ctx.fillStyle = g;
        roundRect(ctx, x, y, PADDLE_W, PADDLE_H, PADDLE_W / 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, .5)';
        roundRect(ctx, x + 2.5, y + 6, 2.4, PADDLE_H - 12, 1.2);
        ctx.fill();
        ctx.restore();
    }

    function drawBall() {
        for (let i = trail.length - 1; i >= 0; i--) {
            const p = trail[i];
            const a = (1 - i / trail.length) * 0.22;
            ctx.fillStyle = 'rgba(120, 230, 255, ' + a.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, BALL_R * (1 - i / trail.length * 0.7), 0, TAU);
            ctx.fill();
        }

        ctx.save();
        ctx.shadowColor = 'rgba(120, 230, 255, .95)';
        ctx.shadowBlur = 22;
        const g = ctx.createRadialGradient(
            ball.x - BALL_R * 0.35, ball.y - BALL_R * 0.4, BALL_R * 0.1,
            ball.x, ball.y, BALL_R
        );
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.6, '#c9f4ff');
        g.addColorStop(1, '#5ad2ff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawReadyHint() {
        if (state !== 'ready') return;
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(elapsed * 3) * 0.25;
        ctx.fillStyle = '#d6e9ff';
        ctx.font = '700 16px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('移动鼠标或按 ↑ ↓ 控制球拍', W / 2, H - 56);
        ctx.restore();
    }

    function drawServeHint() {
        if (state !== 'point') return;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(255, 197, 72, .9)';
        ctx.font = '800 17px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('准备发球…', W / 2, H / 2 + 86);
        ctx.restore();
    }

    function render() {
        drawCourt();
        drawScoreBoard();
        drawPaddle(PLAYER_X, player.y, '#4f8cff', 'rgba(79, 140, 255, .85)');
        drawPaddle(AI_X, ai.y, '#ff5c6c', 'rgba(255, 92, 108, .75)');
        drawBall();
        drawServeHint();
        drawReadyHint();

        if (flash > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (flash * 0.16).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ---------- 交互 ---------- */
    canvas.addEventListener('pointermove', function (e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.height) return;
        const y = (e.clientY - rect.top) * (H / rect.height);
        player.y = clamp(y - PADDLE_H / 2, WALL, H - WALL - PADDLE_H);
    });

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (state === 'ready') begin();
        else if (state === 'over') begin();
    });

    window.addEventListener('keydown', function (e) {
        keys[e.key] = true;

        if (e.key === ' ' || e.key === 'Spacebar') {
            if (state === 'ready' || state === 'over') begin();
            else togglePause();
            e.preventDefault();
            return;
        }
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            togglePause();
            e.preventDefault();
            return;
        }
        if (e.key.indexOf('Arrow') === 0) e.preventDefault();
    });

    window.addEventListener('keyup', function (e) {
        keys[e.key] = false;
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') togglePause();
        else begin();
    });

    els.restartBtn.addEventListener('click', begin);

    els.diffGroup.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-diff]');
        if (!btn) return;
        diff = btn.dataset.diff;
        els.diffGroup.querySelectorAll('[data-diff]').forEach(function (b) {
            b.classList.toggle('active', b === btn);
        });
    });

    /* ---------- 启动 ---------- */
    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;

        if (state === 'playing') {
            update(dt);
        } else if (state === 'point') {
            elapsed += dt;
            if (flash > 0) flash = Math.max(0, flash - dt);
            pointTimer -= dt;
            if (pointTimer <= 0) {
                state = 'playing';
                serve(aiScore > playerScore ? 1 : -1);
            }
        } else {
            elapsed += dt;
            if (flash > 0) flash = Math.max(0, flash - dt);
        }

        render();
        requestAnimationFrame(frame);
    }

    reset();
    showOverlay('ready');
    requestAnimationFrame(frame);
})();
