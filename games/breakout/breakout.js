/* ==========================================================
   打砖块
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const BEST_KEY = 'webgames.breakout.best';

    const ROW_COLORS = ['#ff5c6c', '#ff9f43', '#ffc548', '#2fd48b', '#4f8cff', '#9d5bff', '#5ad2ff', '#ff7ac6'];
    const DROP_COLORS = { wide: '#4f8cff', ball: '#ffc548', life: '#2fd48b' };
    const DROP_LABEL = { wide: 'W', ball: 'B', life: 'L' };

    const PADDLE_Y = H - 42;
    const BASE_PADDLE_W = 88;
    const PADDLE_H = 12;
    const BALL_R = 7;

    function initCanvas(cv, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = w + 'px';
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function roundRect(c, x, y, w, h, r) {
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
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        lives: document.getElementById('lives'),
        level: document.getElementById('level'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        touchPad: document.getElementById('touch-pad')
    };

    /* ---------- 状态 ---------- */
    const paddle = { x: W / 2 - BASE_PADDLE_W / 2, y: PADDLE_Y, w: BASE_PADDLE_W, h: PADDLE_H };
    let balls = [];
    let bricks = [];
    let drops = [];
    let particles = [];

    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let lives = 3;
    let levelIndex = 0;
    let ballSpeed = 340;
    let state = 'ready';    // ready | playing | paused | over | clear
    let lastTime = 0;
    let timeAcc = 0;

    let moveLeft = false;
    let moveRight = false;

    /* ---------- 构建 ---------- */
    function brickHp(row, lv) {
        if (lv === 0) return 1;
        if (lv === 1) return row === 0 ? 2 : 1;
        if (row === 0) return 3;
        if (row <= 2) return 2;
        return 1;
    }

    function buildLevel(lv) {
        bricks = [];
        const rows = 5 + Math.min(3, lv);
        const cols = 8;
        const bw = 52;
        const bh = 22;
        const gap = 5;
        const totalW = cols * bw + (cols - 1) * gap;
        const startX = (W - totalW) / 2;
        const startY = 64;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hp = brickHp(r, lv);
                bricks.push({
                    x: startX + c * (bw + gap),
                    y: startY + r * (bh + gap),
                    w: bw,
                    h: bh,
                    hp: hp,
                    maxHp: hp,
                    color: ROW_COLORS[r % ROW_COLORS.length],
                    points: 10 * (lv + 1),
                    alive: true
                });
            }
        }
        ballSpeed = 340 + lv * 28;
    }

    function makeBall() {
        return {
            x: paddle.x + paddle.w / 2,
            y: paddle.y - BALL_R - 2,
            r: BALL_R,
            vx: 0,
            vy: 0,
            stuck: true
        };
    }

    function resetBall() {
        balls = [makeBall()];
    }

    /* ---------- 碰撞 ---------- */
    function circleRect(b, r) {
        const nx = Math.max(r.x, Math.min(b.x, r.x + r.w));
        const ny = Math.max(r.y, Math.min(b.y, r.y + r.h));
        const dx = b.x - nx;
        const dy = b.y - ny;
        return dx * dx + dy * dy <= b.r * b.r;
    }

    function bounceOffPaddle(b) {
        const center = paddle.x + paddle.w / 2;
        const rel = Math.max(-1, Math.min(1, (b.x - center) / (paddle.w / 2)));
        const angle = rel * (Math.PI / 3);
        const speed = Math.hypot(b.vx, b.vy) || ballSpeed;

        b.vx = Math.sin(angle) * speed;
        b.vy = -Math.cos(angle) * speed;
        b.y = paddle.y - b.r - 0.6;
    }

    function spawnParticles(brick) {
        for (let i = 0; i < 6; i++) {
            particles.push({
                x: brick.x + brick.w / 2,
                y: brick.y + brick.h / 2,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.5) * 220 - 40,
                size: 2 + Math.random() * 3,
                life: 0.45,
                age: 0,
                color: brick.color
            });
        }
    }

    function spawnDrop(brick) {
        const types = ['wide', 'ball', 'life'];
        const type = types[Math.floor(Math.random() * types.length)];
        drops.push({
            x: brick.x + brick.w / 2,
            y: brick.y + brick.h / 2,
            r: 11,
            vy: 135,
            type: type
        });
    }

    function damageBrick(brick) {
        brick.hp--;
        spawnParticles(brick);

        if (brick.hp <= 0) {
            brick.alive = false;
            score += brick.points;
            if (Math.random() < 0.16) spawnDrop(brick);
        } else {
            score += 2;
        }
        updateHud();
    }

    function collideBricks(b) {
        for (let i = 0; i < bricks.length; i++) {
            const k = bricks[i];
            if (!k.alive || !circleRect(b, k)) continue;

            const cx = k.x + k.w / 2;
            const cy = k.y + k.h / 2;
            const ox = Math.abs(b.x - cx) / (k.w / 2 + b.r);
            const oy = Math.abs(b.y - cy) / (k.h / 2 + b.r);
            const dirX = b.x >= cx ? 1 : -1;
            const dirY = b.y >= cy ? 1 : -1;

            if (ox > oy) {
                b.vx = dirX * Math.abs(b.vx);
                b.x += dirX * 1.5;
            } else {
                b.vy = dirY * Math.abs(b.vy);
                b.y += dirY * 1.5;
            }

            damageBrick(k);
            return;
        }
    }

    /* ---------- 更新 ---------- */
    function updatePaddle(dt) {
        let dir = 0;
        if (moveLeft) dir -= 1;
        if (moveRight) dir += 1;

        if (dir !== 0) {
            paddle.x += dir * 470 * dt;
            paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
        }
    }

    function updateBalls(dt) {
        for (let i = balls.length - 1; i >= 0; i--) {
            const b = balls[i];

            if (b.stuck) {
                b.x = paddle.x + paddle.w / 2;
                b.y = paddle.y - b.r - 2;
                continue;
            }

            const speed = Math.hypot(b.vx, b.vy);
            const dist = speed * dt;
            const steps = Math.max(1, Math.ceil(dist / 4));

            for (let s = 0; s < steps; s++) {
                b.x += b.vx * dt / steps;
                b.y += b.vy * dt / steps;

                if (b.x - b.r < 0) {
                    b.x = b.r;
                    b.vx = Math.abs(b.vx);
                } else if (b.x + b.r > W) {
                    b.x = W - b.r;
                    b.vx = -Math.abs(b.vx);
                }

                if (b.y - b.r < 0) {
                    b.y = b.r;
                    b.vy = Math.abs(b.vy);
                }

                if (b.vy > 0 && circleRect(b, paddle)) {
                    bounceOffPaddle(b);
                }

                collideBricks(b);

                if (b.y - b.r > H) {
                    balls.splice(i, 1);
                    break;
                }
            }
        }

        if (state === 'playing' && balls.length === 0) {
            loseLife();
        }
    }

    function updateDrops(dt) {
        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            d.y += d.vy * dt;

            if (d.y - d.r > H) {
                drops.splice(i, 1);
                continue;
            }

            if (circleRect(d, paddle)) {
                applyDrop(d.type);
                drops.splice(i, 1);
            }
        }
    }

    function applyDrop(type) {
        if (type === 'wide') {
            paddle.w = Math.min(152, paddle.w + 26);
            paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
        } else if (type === 'life') {
            lives = Math.min(5, lives + 1);
            updateHud();
        } else if (type === 'ball') {
            const src = balls[0];
            if (src && !src.stuck) {
                for (let k = 0; k < 2; k++) {
                    const ang = Math.atan2(src.vy, src.vx) + (k === 0 ? 0.45 : -0.45);
                    const speed = Math.hypot(src.vx, src.vy) || ballSpeed;
                    balls.push({
                        x: src.x,
                        y: src.y,
                        r: src.r,
                        vx: Math.cos(ang) * speed,
                        vy: Math.sin(ang) * speed,
                        stuck: false
                    });
                }
            }
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.age += dt;
            if (p.age >= p.life) {
                particles.splice(i, 1);
                continue;
            }
            p.vy += 420 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    /* ---------- 流程 ---------- */
    function launch() {
        if (state !== 'playing') return;
        const b = balls[0];
        if (!b || !b.stuck) return;

        const angle = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
        b.vx = Math.cos(angle) * ballSpeed;
        b.vy = Math.sin(angle) * ballSpeed;
        b.stuck = false;
    }

    function loseLife() {
        lives--;
        updateHud();

        if (lives <= 0) {
            gameOver();
            return;
        }

        paddle.w = BASE_PADDLE_W;
        paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
        resetBall();
    }

    function gameOver() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();

        els.ovTitle.textContent = '游戏结束';
        els.ovTitle.className = 'overlay-title danger';
        els.ovDesc.textContent = '小球全部落下了。本局到达第 ' + (levelIndex + 1) + ' 关。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = score;
        els.ovBtn.textContent = '再来一局';
        showOverlay();
    }

    function levelClear() {
        state = 'clear';
        score += 200;
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();

        els.ovTitle.textContent = '过关';
        els.ovTitle.className = 'overlay-title';
        els.ovDesc.textContent = '第 ' + (levelIndex + 1) + ' 关清空，获得 200 分奖励。下一关球速会更快。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = score;
        els.ovBtn.textContent = '进入第 ' + (levelIndex + 2) + ' 关';
        showOverlay();
    }

    function startGame() {
        score = 0;
        lives = 3;
        levelIndex = 0;
        paddle.w = BASE_PADDLE_W;
        paddle.x = W / 2 - paddle.w / 2;
        drops = [];
        particles = [];
        buildLevel(0);
        resetBall();
        state = 'playing';
        updateHud();
        hideOverlay();
    }

    function nextLevel() {
        levelIndex++;
        paddle.w = BASE_PADDLE_W;
        paddle.x = W / 2 - paddle.w / 2;
        drops = [];
        particles = [];
        buildLevel(levelIndex);
        resetBall();
        state = 'playing';
        updateHud();
        hideOverlay();
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        moveLeft = false;
        moveRight = false;
        els.ovTitle.textContent = '已暂停';
        els.ovTitle.className = 'overlay-title';
        els.ovDesc.textContent = '按 P 或点击按钮继续游戏。';
        els.ovScore.hidden = true;
        els.ovBtn.textContent = '继续游戏';
        showOverlay();
    }

    function resume() {
        if (state !== 'paused') return;
        state = 'playing';
        lastTime = 0;
        hideOverlay();
    }

    function togglePause() {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
    }

    function showOverlay() { els.overlay.classList.add('show'); }
    function hideOverlay() { els.overlay.classList.remove('show'); }

    function updateHud() {
        if (score > best) best = score;
        els.score.textContent = score;
        els.best.textContent = best;
        els.lives.textContent = Math.max(0, lives);
        els.level.textContent = levelIndex + 1;
    }

    /* ---------- 主循环 ---------- */
    function update(dt) {
        timeAcc += dt;
        updatePaddle(dt);
        updateBalls(dt);
        updateDrops(dt);
        updateParticles(dt);

        if (state === 'playing' && bricks.every(function (k) { return !k.alive; })) {
            levelClear();
        }
    }

    function loop(t) {
        if (!lastTime) lastTime = t;
        const dt = Math.min(0.05, (t - lastTime) / 1000);
        lastTime = t;

        if (state === 'playing') update(dt);
        else timeAcc += dt;

        render();
        requestAnimationFrame(loop);
    }

    /* ---------- 渲染 ---------- */
    function render() {
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#080c14';
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(255, 255, 255, .025)';
        ctx.lineWidth = 1;
        for (let x = 40; x < W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x + .5, 0);
            ctx.lineTo(x + .5, H);
            ctx.stroke();
        }
        for (let y = 40; y < H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y + .5);
            ctx.lineTo(W, y + .5);
            ctx.stroke();
        }

        /* 砖块 */
        for (let i = 0; i < bricks.length; i++) {
            const k = bricks[i];
            if (!k.alive) continue;

            ctx.fillStyle = k.color;
            roundRect(ctx, k.x, k.y, k.w, k.h, 5);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, .28)';
            roundRect(ctx, k.x + 3, k.y + 3, k.w - 6, 5, 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(0, 0, 0, .22)';
            roundRect(ctx, k.x + 3, k.y + k.h - 7, k.w - 6, 4, 2);
            ctx.fill();

            if (k.hp > 1) {
                ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
                ctx.lineWidth = 2;
                roundRect(ctx, k.x + 1, k.y + 1, k.w - 2, k.h - 2, 5);
                ctx.stroke();

                if (k.hp > 2) {
                    ctx.fillStyle = 'rgba(255, 255, 255, .9)';
                    ctx.beginPath();
                    ctx.arc(k.x + k.w / 2, k.y + k.h / 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        /* 道具 */
        for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            ctx.save();
            ctx.shadowColor = DROP_COLORS[d.type];
            ctx.shadowBlur = 12;
            ctx.fillStyle = DROP_COLORS[d.type];
            roundRect(ctx, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2, 6);
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = '#0a0e17';
            ctx.font = '700 13px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(DROP_LABEL[d.type], d.x, d.y + 1);
        }

        /* 粒子 */
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        /* 挡板 */
        const grad = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
        grad.addColorStop(0, '#8dbcff');
        grad.addColorStop(1, '#3f6fe0');
        ctx.fillStyle = grad;
        roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, .35)';
        roundRect(ctx, paddle.x + 4, paddle.y + 2, paddle.w - 8, 3, 1.5);
        ctx.fill();

        /* 小球 */
        for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            ctx.save();
            ctx.shadowColor = '#9fc0ff';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#f2f7ff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        /* 待发射提示 */
        if (state === 'playing' && balls.length && balls[0].stuck) {
            ctx.fillStyle = 'rgba(232, 238, 248, .55)';
            ctx.font = '600 14px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('按空格或点击画布发射', W / 2, H - 96);
        }
    }

    /* ---------- 输入 ---------- */
    const KEY_LEFT = ['arrowleft', 'a'];
    const KEY_RIGHT = ['arrowright', 'd'];

    document.addEventListener('keydown', function (e) {
        const k = e.key.toLowerCase();

        if (KEY_LEFT.indexOf(k) !== -1) {
            e.preventDefault();
            moveLeft = true;
            if (state === 'playing') return;
        }
        if (KEY_RIGHT.indexOf(k) !== -1) {
            e.preventDefault();
            moveRight = true;
            if (state === 'playing') return;
        }

        if (k === 'p' || e.key === 'Escape') {
            togglePause();
            return;
        }

        if (k === ' ' || k === 'enter') {
            e.preventDefault();
            if (state === 'ready' || state === 'over') {
                startGame();
                launch();
            } else if (state === 'clear') {
                nextLevel();
                launch();
            } else if (state === 'paused') {
                resume();
            } else if (state === 'playing') {
                launch();
            }
        }
    });

    document.addEventListener('keyup', function (e) {
        const k = e.key.toLowerCase();
        if (KEY_LEFT.indexOf(k) !== -1) moveLeft = false;
        if (KEY_RIGHT.indexOf(k) !== -1) moveRight = false;
    });

    function setPaddleFromClientX(clientX) {
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (W / rect.width);
        paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
    }

    canvas.addEventListener('mousemove', function (e) {
        if (state === 'playing') setPaddleFromClientX(e.clientX);
    });

    canvas.addEventListener('mousedown', function (e) {
        if (state === 'playing') {
            setPaddleFromClientX(e.clientX);
            launch();
        }
    });

    canvas.addEventListener('touchstart', function (e) {
        if (state !== 'playing') return;
        e.preventDefault();
        if (e.touches.length) setPaddleFromClientX(e.touches[0].clientX);
        launch();
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
        if (state !== 'playing') return;
        e.preventDefault();
        if (e.touches.length) setPaddleFromClientX(e.touches[0].clientX);
    }, { passive: false });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') {
            resume();
        } else if (state === 'clear') {
            nextLevel();
            launch();
        } else {
            startGame();
        }
    });

    els.pauseBtn.addEventListener('click', togglePause);

    document.querySelectorAll('[data-pad]').forEach(function (btn) {
        const isLeft = btn.dataset.pad === 'left';

        function down(e) {
            e.preventDefault();
            if (isLeft) moveLeft = true;
            else moveRight = true;
        }

        function up(e) {
            if (e) e.preventDefault();
            if (isLeft) moveLeft = false;
            else moveRight = false;
        }

        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
    });

    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }

    window.addEventListener('blur', function () {
        if (state === 'playing') pause();
    });

    /* ---------- 启动 ---------- */
    buildLevel(0);
    resetBall();
    updateHud();
    render();
    requestAnimationFrame(loop);
})();
