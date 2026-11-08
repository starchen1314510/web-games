/* ==========================================================
   贪吃蛇
   ========================================================== */
(function () {
    'use strict';

    const COLS = 20;
    const ROWS = 20;
    const CELL = 28;
    const W = COLS * CELL;
    const H = ROWS * CELL;
    const BASE_STEP = 150;
    const MIN_STEP = 85;
    const BEST_KEY = 'webgames.snake.best';

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
        length: document.getElementById('length'),
        speed: document.getElementById('speed'),
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
    let snake = [];
    let dir = { x: 1, y: 0 };
    let queue = [];
    let food = null;
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let stepMs = BASE_STEP;
    let acc = 0;
    let lastTime = 0;
    let timeAcc = 0;
    let state = 'ready';   // ready | playing | paused | over

    /* ---------- 逻辑 ---------- */
    function reset() {
        snake = [
            { x: 9, y: 10 },
            { x: 8, y: 10 },
            { x: 7, y: 10 }
        ];
        dir = { x: 1, y: 0 };
        queue = [];
        score = 0;
        stepMs = BASE_STEP;
        acc = 0;
        spawnFood();
        updateHud();
    }

    function spawnFood() {
        const occupied = {};
        snake.forEach(function (s) { occupied[s.x + ',' + s.y] = true; });

        const free = [];
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (!occupied[x + ',' + y]) free.push({ x: x, y: y });
            }
        }
        food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }

    function die() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();

        els.ovTitle.textContent = '游戏结束';
        els.ovTitle.className = 'overlay-title danger';
        els.ovDesc.textContent = '小蛇撞上去了。本局长度 ' + snake.length + '，再试一次吧。';
        els.ovScore.hidden = false;
        els.ovScoreVal.textContent = score;
        els.ovBtn.textContent = '再来一局';
        showOverlay();
    }

    function step() {
        if (queue.length) {
            const nd = queue.shift();
            if (nd.x !== -dir.x || nd.y !== -dir.y) dir = nd;
        }

        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
            die();
            return;
        }

        const willEat = food && head.x === food.x && head.y === food.y;
        const limit = willEat ? snake.length : snake.length - 1;
        for (let i = 0; i < limit; i++) {
            if (snake[i].x === head.x && snake[i].y === head.y) {
                die();
                return;
            }
        }

        snake.unshift(head);

        if (willEat) {
            score += 10;
            stepMs = Math.max(MIN_STEP, BASE_STEP - Math.floor(score / 50) * 10);
            spawnFood();
        } else {
            snake.pop();
        }

        updateHud();
    }

    function updateHud() {
        els.score.textContent = score;
        els.best.textContent = best;
        els.length.textContent = snake.length;
        els.speed.textContent = (BASE_STEP / stepMs).toFixed(1) + 'x';
    }

    /* ---------- 绘制 ---------- */
    function render() {
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#07110d';
        ctx.fillRect(0, 0, W, H);

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, .016)';
                    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
                }
            }
        }

        if (food) {
            const fx = food.x * CELL + CELL / 2;
            const fy = food.y * CELL + CELL / 2;
            const pulse = 1 + Math.sin(timeAcc * 6) * 0.08;

            ctx.save();
            ctx.shadowColor = '#ff5c6c';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#ff5c6c';
            ctx.beginPath();
            ctx.arc(fx, fy, CELL * 0.3 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = 'rgba(255, 255, 255, .6)';
            ctx.beginPath();
            ctx.arc(fx - CELL * 0.1, fy - CELL * 0.1, CELL * 0.08, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#2fd48b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fx, fy - CELL * 0.3 * pulse);
            ctx.quadraticCurveTo(fx + 6, fy - CELL * 0.5, fx + 10, fy - CELL * 0.36);
            ctx.stroke();
        }

        const dead = state === 'over';

        for (let i = snake.length - 1; i >= 0; i--) {
            const seg = snake[i];
            const t = snake.length > 1 ? i / (snake.length - 1) : 0;
            const size = CELL - 4 - t * 3;
            const inset = (CELL - size) / 2;
            const x = seg.x * CELL + inset;
            const y = seg.y * CELL + inset;

            if (dead) {
                ctx.fillStyle = i === 0 ? '#7c8a86' : 'rgba(110, 130, 122, ' + (1 - t * 0.45) + ')';
            } else if (i === 0) {
                ctx.fillStyle = '#6ef7b0';
            } else {
                ctx.fillStyle = 'hsl(155, 62%, ' + (58 - t * 16) + '%)';
            }

            roundRect(ctx, x, y, size, size, size * 0.3);
            ctx.fill();
        }

        /* 蛇头眼睛 */
        if (snake.length) {
            const head = snake[0];
            const cx = head.x * CELL + CELL / 2;
            const cy = head.y * CELL + CELL / 2;
            const perp = { x: -dir.y, y: dir.x };

            for (let s = -1; s <= 1; s += 2) {
                const ex = cx + dir.x * 4 + perp.x * s * 5;
                const ey = cy + dir.y * 4 + perp.y * s * 5;

                ctx.fillStyle = dead ? '#3c4644' : '#0a1f17';
                ctx.beginPath();
                ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
                ctx.fill();

                if (!dead) {
                    ctx.fillStyle = 'rgba(255, 255, 255, .75)';
                    ctx.beginPath();
                    ctx.arc(ex - 0.8, ey - 0.8, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        /* 是否吃到果实的循环提示 */
        if (state === 'ready') {
            ctx.fillStyle = 'rgba(232, 238, 248, .5)';
            ctx.font = '600 15px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('按方向键开始移动', W / 2, H / 2 + 78);
        }
    }

    /* ---------- 主循环 ---------- */
    function loop(t) {
        if (!lastTime) lastTime = t;
        const dt = Math.min(100, t - lastTime);
        lastTime = t;
        timeAcc += dt / 1000;

        if (state === 'playing') {
            acc += dt;
            let guard = 0;
            while (acc >= stepMs && state === 'playing' && guard < 4) {
                acc -= stepMs;
                step();
                guard++;
            }
        }

        render();
        requestAnimationFrame(loop);
    }

    /* ---------- 流程控制 ---------- */
    function startGame() {
        reset();
        state = 'playing';
        hideOverlay();
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        els.ovTitle.textContent = '已暂停';
        els.ovTitle.className = 'overlay-title';
        els.ovDesc.textContent = '小蛇正在休息，按 P 或点击按钮继续。';
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

    /* ---------- 输入 ---------- */
    function pushDir(nx, ny) {
        const last = queue.length ? queue[queue.length - 1] : dir;
        if (nx === -last.x && ny === -last.y) return;
        if (nx === last.x && ny === last.y) return;
        if (queue.length < 2) queue.push({ x: nx, y: ny });

        /* 首次按方向键即开始游戏 */
        if (state === 'ready') {
            state = 'playing';
            hideOverlay();
        }
    }

    const KEY_DIR = {
        arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
    };

    document.addEventListener('keydown', function (e) {
        const lower = e.key.toLowerCase();

        if (KEY_DIR[lower]) {
            e.preventDefault();
            if (state === 'playing' || state === 'ready') {
                const d = KEY_DIR[lower];
                pushDir(d[0], d[1]);
            }
            return;
        }

        if (lower === 'p' || e.key === 'Escape') {
            togglePause();
            return;
        }

        if ((state === 'ready' || state === 'over') && lower === 'enter') {
            startGame();
        }
    });

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') resume();
        else startGame();
    });

    els.pauseBtn.addEventListener('click', togglePause);

    document.querySelectorAll('[data-dir]').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[btn.dataset.dir];
            if (d && (state === 'playing' || state === 'ready')) pushDir(d[0], d[1]);
        });
    });

    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }

    window.addEventListener('blur', function () {
        if (state === 'playing') pause();
    });

    /* ---------- 启动 ---------- */
    reset();
    render();
    requestAnimationFrame(loop);
})();
