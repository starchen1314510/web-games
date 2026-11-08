/* ==========================================================
   塔防 Tower Defense
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    /* ---------- 棋盘 ---------- */
    const CELL = 44;
    const GX = 64;
    const GY = 124;
    const COLS = 8;
    const ROWS = 8;

    /* ---------- 敌人行进路线（格子索引，-1 / 8 为画面外） ---------- */
    const PATH_CELLS = [
        [-1, 3], [0, 3], [0, 2], [0, 1], [1, 1], [2, 1], [3, 1],
        [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6],
        [6, 6], [6, 5], [6, 4], [6, 3], [7, 3], [8, 3]
    ];

    const TOTAL_WAVES = 12;
    const START_GOLD = 130;
    const START_LIVES = 20;

    const TOWERS = [
        {
            key: 'arrow', name: '箭塔', cost: 40, color: '#5fd8ff',
            range: [76, 88, 100], dmg: [9, 16, 26], rate: [1.7, 1.9, 2.1],
            speed: 360, splash: [0, 0, 0], slow: [0, 0, 0]
        },
        {
            key: 'cannon', name: '炮塔', cost: 70, color: '#ffb05a',
            range: [86, 96, 106], dmg: [24, 40, 60], rate: [0.62, 0.7, 0.78],
            speed: 240, splash: [32, 38, 44], slow: [0, 0, 0]
        },
        {
            key: 'frost', name: '冰塔', cost: 55, color: '#a8bcff',
            range: [78, 90, 102], dmg: [5, 9, 15], rate: [1.15, 1.3, 1.45],
            speed: 290, splash: [0, 0, 0], slow: [0.42, 0.5, 0.58]
        }
    ];

    const ENEMIES = {
        normal: { hp: 1, spd: 1, r: 8, reward: 6, color: '#ff7d90' },
        fast: { hp: 0.62, spd: 1.78, r: 6.5, reward: 7, color: '#ffd166' },
        tank: { hp: 2.4, spd: 0.72, r: 10, reward: 13, color: '#a08cff' },
        boss: { hp: 5.6, spd: 0.6, r: 13, reward: 40, color: '#ff5d5d' }
    };

    const BEST_WAVE_KEY = 'webgames.towerdefense.best-wave';
    const BEST_SCORE_KEY = 'webgames.towerdefense.best-score';

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

    /* ---------- 路线采样 ---------- */
    const PTS = [];
    const pathSet = {};
    for (let i = 0; i < PATH_CELLS.length; i++) {
        const c = PATH_CELLS[i][0];
        const r = PATH_CELLS[i][1];
        PTS.push({ x: GX + (c + 0.5) * CELL, y: GY + (r + 0.5) * CELL });
        pathSet[c + ',' + r] = true;
    }

    const SEGS = [];
    let TOTAL_LEN = 0;
    for (let i = 0; i < PTS.length - 1; i++) {
        const a = PTS[i];
        const b = PTS[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        SEGS.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len: len, from: TOTAL_LEN });
        TOTAL_LEN += len;
    }

    function posAt(d) {
        if (d <= 0) return { x: PTS[0].x, y: PTS[0].y };
        for (let i = 0; i < SEGS.length; i++) {
            const s = SEGS[i];
            if (d <= s.from + s.len) {
                const k = (d - s.from) / s.len;
                return { x: s.ax + (s.bx - s.ax) * k, y: s.ay + (s.by - s.ay) * k };
            }
        }
        const last = PTS[PTS.length - 1];
        return { x: last.x, y: last.y };
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        wave: document.getElementById('wave'),
        lives: document.getElementById('lives'),
        gold: document.getElementById('gold'),
        kills: document.getElementById('kills'),
        bestWave: document.getElementById('best-wave'),
        bestScore: document.getElementById('best-score'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 状态 ---------- */
    let state = 'ready';          // ready | playing | over
    let wave = 0;                 // 已开始的最大波次
    let lives = START_LIVES;
    let gold = START_GOLD;
    let kills = 0;
    let score = 0;
    let towers = [];
    let enemies = [];
    let bullets = [];
    let fx = [];
    let queue = [];
    let waveTime = 0;
    let running = false;
    let selType = 0;
    let hover = null;              // {c,r}
    let pointer = { x: -99, y: -99 };
    let msg = '';
    let msgT = 0;
    let shake = 0;
    let clock = 0;
    let hudCache = '';
    let banner = null;

    let bestWave = loadNum(BEST_WAVE_KEY);
    let bestScore = loadNum(BEST_SCORE_KEY);

    /* ---------- 波次数据 ---------- */
    function makeWave(n) {
        const baseHp = 20 * Math.pow(1.24, n - 1);
        const baseSpd = 50 + n * 3.0;
        const count = 6 + Math.floor(n * 1.3);
        const gap = Math.max(0.26, 0.82 - n * 0.04);
        const list = [];
        for (let i = 0; i < count; i++) {
            let t = 'normal';
            if (n >= 3 && i % 4 === 3) t = 'fast';
            if (n >= 5 && i % 5 === 4) t = 'tank';
            list.push({ type: t, at: 0.35 + i * gap, hp: baseHp, spd: baseSpd });
        }
        if (n % 4 === 0) {
            list.push({ type: 'boss', at: 0.35 + count * gap + 1.1, hp: baseHp, spd: baseSpd });
        }
        return list;
    }

    function spawnEnemy(type, hpBase, spdBase) {
        const d = ENEMIES[type];
        const hp = Math.round(hpBase * d.hp);
        const p = posAt(0);
        enemies.push({
            type: type,
            d: 0,
            x: p.x,
            y: p.y,
            hp: hp,
            max: hp,
            spd: spdBase * d.spd,
            r: d.r,
            reward: d.reward,
            color: d.color,
            slowT: 0,
            slowF: 0,
            hitT: 0,
            dead: false
        });
    }

    /* ---------- 开局 ---------- */
    function resetGame() {
        wave = 0;
        lives = START_LIVES;
        gold = START_GOLD;
        kills = 0;
        score = 0;
        towers = [];
        enemies = [];
        bullets = [];
        fx = [];
        queue = [];
        waveTime = 0;
        running = false;
        selType = 0;
        hover = null;
        msg = '';
        msgT = 0;
        shake = 0;
        banner = null;
        hudCache = '';
        state = 'playing';
        updateHud();
    }

    function startGame() {
        resetGame();
        els.overlay.classList.remove('show');
    }

    function startWave() {
        if (state !== 'playing' || running) return;
        if (wave >= TOTAL_WAVES) return;
        wave++;
        queue = makeWave(wave);
        waveTime = 0;
        running = true;
        banner = {
            title: '第 ' + wave + ' 波',
            sub: wave % 4 === 0 ? '首领来袭' : (queue.length + ' 个敌人'),
            t: 0,
            max: 1.2
        };
        updateHud();
    }

    function endGame(win) {
        state = 'over';
        running = false;
        if (wave > bestWave) {
            bestWave = wave;
            saveNum(BEST_WAVE_KEY, bestWave);
        }
        if (score > bestScore) {
            bestScore = score;
            saveNum(BEST_SCORE_KEY, bestScore);
        }
        els.ovTitle.textContent = win ? '守住了' : '防线失守';
        els.ovDesc.textContent = win
            ? '十二波敌人全部挡在门外，城堡安然无恙。'
            : '敌人冲破防线了。多建几座塔，或者把塔升到三级再试试。';
        els.ovScore.innerHTML = '坚守 <b>' + wave + '</b> 波 · 击杀 ' + kills +
            ' · 得分 ' + score + '<br>最高波次 ' + bestWave + ' · 最高分 ' + bestScore;
        els.ovBtn.textContent = '再来一局';
        els.overlay.classList.add('show');
        updateHud();
    }

    /* ---------- 建造 ---------- */
    function cellCenter(c, r) {
        return { x: GX + (c + 0.5) * CELL, y: GY + (r + 0.5) * CELL };
    }

    function cellAt(x, y) {
        const c = Math.floor((x - GX) / CELL);
        const r = Math.floor((y - GY) / CELL);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
        return { c: c, r: r };
    }

    function towerAt(c, r) {
        for (let i = 0; i < towers.length; i++) {
            if (towers[i].c === c && towers[i].r === r) return towers[i];
        }
        return null;
    }

    function upgradeCost(t) {
        return Math.round(TOWERS[t.type].cost * (0.9 + 0.55 * t.lvl));
    }

    function toast(text, sec) {
        msg = text;
        msgT = sec || 1.6;
    }

    function buildAt(c, r) {
        if (pathSet[c + ',' + r]) {
            toast('敌人行进的路线上不能建塔');
            return;
        }
        const exist = towerAt(c, r);
        if (exist) {
            if (exist.lvl >= 3) {
                toast('这座塔已经满级');
                return;
            }
            const cost = upgradeCost(exist);
            if (gold < cost) {
                toast('金币不足 · 升级需要 ' + cost);
                return;
            }
            gold -= cost;
            exist.lvl++;
            exist.flash = 0.25;
            burst(exist.x, exist.y, 10, 120, 0.5, '#ffe6a8');
            toast('升到 ' + exist.lvl + ' 级 · -' + cost + ' 金币', 1.2);
            updateHud();
            return;
        }

        const st = TOWERS[selType];
        if (gold < st.cost) {
            toast('金币不足 · ' + st.name + '需要 ' + st.cost);
            return;
        }
        const p = cellCenter(c, r);
        gold -= st.cost;
        towers.push({
            c: c, r: r, type: selType, lvl: 1,
            x: p.x, y: p.y, cd: 0, angle: -Math.PI / 2, flash: 0.2
        });
        burst(p.x, p.y, 10, 110, 0.5, st.color);
        updateHud();
    }

    /* ---------- 战斗 ---------- */
    function findTarget(t) {
        const st = TOWERS[t.type];
        const range = st.range[t.lvl - 1];
        let best = null;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.dead) continue;
            if (Math.hypot(e.x - t.x, e.y - t.y) > range) continue;
            if (!best || e.d > best.d) best = e;
        }
        return best;
    }

    function shoot(t, target) {
        const st = TOWERS[t.type];
        const lv = t.lvl - 1;
        t.cd = 1 / st.rate[lv];
        t.flash = 0.12;
        const a = Math.atan2(target.y - t.y, target.x - t.x);
        const mx = t.x + Math.cos(a) * 12;
        const my = t.y + Math.sin(a) * 12;
        bullets.push({
            x: mx,
            y: my,
            t: target,
            dmg: st.dmg[lv],
            speed: st.speed,
            splash: st.splash[lv],
            slow: st.slow[lv],
            color: st.color,
            kind: st.key,
            life: 2.2
        });
        fx.push({ kind: 'spark', x: mx, y: my, t: 0, max: 0.16, color: st.color });
    }

    function hurt(e, dmg, slowF) {
        if (!e || e.dead) return;
        e.hp -= dmg;
        e.hitT = 0.1;
        if (slowF > 0) {
            e.slowF = Math.max(e.slowF, slowF);
            e.slowT = Math.max(e.slowT, 1.1);
        }
        if (e.hp <= 0) killEnemy(e);
    }

    function killEnemy(e) {
        if (e.dead) return;
        e.dead = true;
        gold += e.reward;
        kills++;
        score += e.reward;
        burst(e.x, e.y, 8, 130, 0.5, e.color);
    }

    function leak(e) {
        e.dead = true;
        const cost = e.type === 'boss' ? 3 : 1;
        lives = Math.max(0, lives - cost);
        shake = 1;
        toast('漏进来一个 · 生命 -' + cost, 1.4);
        updateHud();
        if (lives <= 0) endGame(false);
    }

    function stepEnemies(dt) {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.dead) continue;
            if (e.hitT > 0) e.hitT -= dt;
            if (e.slowT > 0) e.slowT -= dt;
            const mul = e.slowT > 0 ? (1 - e.slowF) : 1;
            e.d += e.spd * mul * dt;
            if (e.d >= TOTAL_LEN) {
                leak(e);
                continue;
            }
            const p = posAt(e.d);
            e.x = p.x;
            e.y = p.y;
        }
    }

    function stepTowers(dt) {
        for (let i = 0; i < towers.length; i++) {
            const t = towers[i];
            if (t.flash > 0) t.flash -= dt;
            if (t.cd > 0) t.cd -= dt;
            if (t.cd > 0) continue;
            const target = findTarget(t);
            if (!target) continue;
            t.angle = Math.atan2(target.y - t.y, target.x - t.x);
            shoot(t, target);
        }
    }

    function hitBullet(b) {
        if (b.splash > 0) {
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (e.dead) continue;
                if (Math.hypot(e.x - b.x, e.y - b.y) <= b.splash + e.r) {
                    hurt(e, b.dmg, 0);
                }
            }
            fx.push({ kind: 'ring', x: b.x, y: b.y, t: 0, max: 0.34, r: b.splash, color: b.color });
            burst(b.x, b.y, 6, 90, 0.35, b.color);
        } else {
            hurt(b.t, b.dmg, b.slow);
            burst(b.x, b.y, 3, 60, 0.28, b.color);
        }
        b.dead = true;
    }

    function stepBullets(dt) {
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            if (b.dead) continue;
            b.life -= dt;
            if (b.life <= 0 || !b.t || b.t.dead) {
                b.dead = true;
                continue;
            }
            const dx = b.t.x - b.x;
            const dy = b.t.y - b.y;
            const dist = Math.hypot(dx, dy);
            const step = b.speed * dt;
            if (dist <= step + 3) {
                b.x = b.t.x;
                b.y = b.t.y;
                hitBullet(b);
                continue;
            }
            b.x += (dx / dist) * step;
            b.y += (dy / dist) * step;
            b.angle = Math.atan2(dy, dx);
        }
    }

    function burst(x, y, n, speed, life, color) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const s = speed * (0.35 + Math.random() * 0.8);
            fx.push({
                kind: 'dot', x: x, y: y,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                t: 0, max: life * (0.6 + Math.random() * 0.8),
                r: 1.2 + Math.random() * 1.8,
                color: color || '#9fe8ff'
            });
        }
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        clock += dt;
        if (msgT > 0) msgT -= dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 3.4);

        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.t += dt;
            if (p.kind === 'dot') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 0.94;
                p.vy *= 0.94;
            }
            if (p.t > p.max) fx.splice(i, 1);
        }

        if (banner) {
            banner.t += dt;
            if (banner.t > banner.max) banner = null;
        }

        if (state !== 'playing') return;

        if (running) {
            waveTime += dt;
            while (queue.length && queue[0].at <= waveTime) {
                const q = queue.shift();
                spawnEnemy(q.type, q.hp, q.spd);
            }
        }

        stepEnemies(dt);
        stepTowers(dt);
        stepBullets(dt);

        if (enemies.length && enemies.some(function (e) { return e.dead; })) {
            enemies = enemies.filter(function (e) { return !e.dead; });
        }
        if (bullets.length) {
            bullets = bullets.filter(function (b) { return !b.dead; });
        }

        if (running && !queue.length && !enemies.length) {
            running = false;
            const bonus = 24 + wave * 6;
            gold += bonus;
            toast('第 ' + wave + ' 波清空 · +' + bonus + ' 金币', 2.2);
            if (wave >= TOTAL_WAVES) {
                endGame(true);
            }
        }

        updateHud();
    }

    function updateHud() {
        const key = [wave, lives, gold, kills, score, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.wave.textContent = wave + ' / ' + TOTAL_WAVES;
        els.lives.textContent = String(lives);
        els.gold.textContent = String(gold);
        els.kills.textContent = String(kills);
        els.bestWave.textContent = String(bestWave);
        els.bestScore.textContent = String(bestScore);
    }

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070d18');
        g.addColorStop(0.5, '#091423');
        g.addColorStop(1, '#05090f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W / 2, 300, 50, W / 2, 300, 310);
        halo.addColorStop(0, 'rgba(70, 140, 210, .12)');
        halo.addColorStop(1, 'rgba(40, 70, 130, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 96, W, 420);
    }

    function drawGrid() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (pathSet[c + ',' + r]) continue;
                const x = GX + c * CELL;
                const y = GY + r * CELL;
                roundRectPath(ctx, x + 2.5, y + 2.5, CELL - 5, CELL - 5, 7);
                ctx.fillStyle = 'rgba(120, 164, 210, .045)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(120, 160, 200, .1)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    function drawPath() {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(PTS[0].x, PTS[0].y);
        for (let i = 1; i < PTS.length; i++) ctx.lineTo(PTS[i].x, PTS[i].y);

        ctx.strokeStyle = 'rgba(26, 38, 50, .95)';
        ctx.lineWidth = CELL - 2;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(96, 78, 58, .5)';
        ctx.lineWidth = CELL - 10;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(158, 128, 86, .18)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([9, 11]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 行进方向箭头
        ctx.save();
        ctx.fillStyle = 'rgba(226, 198, 150, .16)';
        for (let i = 0; i < SEGS.length; i++) {
            const s = SEGS[i];
            if (s.len < 30) continue;
            const a = Math.atan2(s.by - s.ay, s.bx - s.ax);
            for (let k = 0; k < s.len; k += 40) {
                const x = s.ax + Math.cos(a) * (k + 18);
                const y = s.ay + Math.sin(a) * (k + 18);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(5, 0);
                ctx.lineTo(-3, 4);
                ctx.lineTo(-3, -4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }
        ctx.restore();
    }

    function drawTower(t) {
        const st = TOWERS[t.type];
        ctx.save();
        ctx.translate(t.x, t.y);

        // 投影
        ctx.beginPath();
        ctx.ellipse(0, 15.5, 14, 4.6, 0, 0, TAU);
        ctx.fillStyle = 'rgba(4, 8, 14, .5)';
        ctx.fill();

        // 底座
        roundRectPath(ctx, -18, -18, 36, 36, 10);
        const base = ctx.createLinearGradient(0, -18, 0, 18);
        base.addColorStop(0, 'rgba(40, 58, 82, .98)');
        base.addColorStop(0.55, 'rgba(20, 32, 48, .98)');
        base.addColorStop(1, 'rgba(11, 19, 30, .98)');
        ctx.fillStyle = base;
        ctx.fill();
        ctx.strokeStyle = t.lvl >= 3 ? 'rgba(255, 210, 126, .85)' : 'rgba(126, 170, 214, .38)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // 等级点
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(-5 + i * 5, 13.6, 1.6, 0, TAU);
            ctx.fillStyle = i < t.lvl ? st.color : 'rgba(118, 148, 182, .32)';
            ctx.fill();
        }

        // 炮口方向
        ctx.save();
        ctx.rotate(t.angle);
        if (t.flash > 0) {
            ctx.shadowColor = st.color;
            ctx.shadowBlur = 14 * (t.flash / 0.25 + 0.4);
        }

        if (st.key === 'arrow') {
            roundRectPath(ctx, 4, -2.6, 14, 5.2, 2.6);
            ctx.fillStyle = 'rgba(12, 44, 60, .96)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(120, 230, 255, .8)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(22, 0);
            ctx.lineTo(15.5, 4.6);
            ctx.lineTo(15.5, -4.6);
            ctx.closePath();
            ctx.fillStyle = '#dffaff';
            ctx.fill();

            const g = ctx.createRadialGradient(-2, -2.6, 1, 0, 0, 8);
            g.addColorStop(0, '#eafdff');
            g.addColorStop(0.45, st.color);
            g.addColorStop(1, '#0e5068');
            ctx.beginPath();
            ctx.arc(0, 0, 7.8, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(196, 246, 255, .6)';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (st.key === 'cannon') {
            roundRectPath(ctx, 3, -5, 15, 10, 3.2);
            ctx.fillStyle = 'rgba(62, 40, 20, .96)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 190, 110, .85)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(18, 0, 4.6, 0, TAU);
            ctx.fillStyle = 'rgba(16, 10, 6, .96)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 200, 128, .8)';
            ctx.lineWidth = 1;
            ctx.stroke();

            const g = ctx.createRadialGradient(-2.4, -3, 1, 0, 0, 9);
            g.addColorStop(0, '#fff2da');
            g.addColorStop(0.45, st.color);
            g.addColorStop(1, '#6d3b12');
            ctx.beginPath();
            ctx.arc(0, 0, 8.6, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 216, 156, .55)';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            // 朝前的冰刺
            ctx.beginPath();
            ctx.moveTo(19, 0);
            ctx.lineTo(6, 4);
            ctx.lineTo(2, 0);
            ctx.lineTo(6, -4);
            ctx.closePath();
            ctx.fillStyle = 'rgba(214, 230, 255, .9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(240, 248, 255, .85)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // 六棱晶体
            const g = ctx.createLinearGradient(-8, -8, 8, 8);
            g.addColorStop(0, '#eaf1ff');
            g.addColorStop(0.45, st.color);
            g.addColorStop(1, '#2c3f8c');
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = i * TAU / 6 - Math.PI / 2;
                const x = Math.cos(a) * 9;
                const y = Math.sin(a) * 9;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(226, 240, 255, .8)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(2.6, 0);
            ctx.lineTo(0, 4);
            ctx.lineTo(-2.6, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, .92)';
            ctx.fill();
        }
        ctx.restore();

        if (t.lvl >= 3) {
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, TAU);
            ctx.strokeStyle = 'rgba(255, 214, 130, .28)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawEnemies() {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.dead) continue;
            const r = e.r;

            ctx.beginPath();
            ctx.ellipse(e.x, e.y + r * 0.55, r * 0.9, r * 0.4, 0, 0, TAU);
            ctx.fillStyle = 'rgba(4, 8, 14, .4)';
            ctx.fill();

            const g = ctx.createRadialGradient(e.x - r * 0.35, e.y - r * 0.4, r * 0.2, e.x, e.y, r);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.35, e.color);
            g.addColorStop(1, 'rgba(30, 10, 18, .95)');
            ctx.beginPath();
            ctx.arc(e.x, e.y, r, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(10, 8, 16, .55)';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (e.slowT > 0) {
                ctx.beginPath();
                ctx.arc(e.x, e.y, r + 3, 0, TAU);
                ctx.strokeStyle = 'rgba(150, 190, 255, .7)';
                ctx.lineWidth = 1.6;
                ctx.stroke();
            }

            if (e.hitT > 0) {
                ctx.beginPath();
                ctx.arc(e.x, e.y, r + 1.5, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }

            // 血条
            const bw = Math.max(14, r * 2);
            const k = clamp(e.hp / e.max, 0, 1);
            ctx.fillStyle = 'rgba(6, 10, 16, .62)';
            roundRectPath(ctx, e.x - bw / 2, e.y - r - 8, bw, 3, 1.5);
            ctx.fill();
            ctx.fillStyle = k > 0.5 ? 'rgba(120, 232, 150, .95)'
                : (k > 0.24 ? 'rgba(255, 208, 110, .95)' : 'rgba(255, 110, 110, .95)');
            roundRectPath(ctx, e.x - bw / 2, e.y - r - 8, Math.max(1.6, bw * k), 3, 1.5);
            ctx.fill();

            if (e.type === 'boss') {
                ctx.beginPath();
                ctx.arc(e.x, e.y, r + 4, 0, TAU);
                ctx.strokeStyle = 'rgba(255, 110, 110, .35)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
        }
    }

    function drawBullets() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            const r = b.kind === 'cannon' ? 4.4 : 3;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r * 2, 0, TAU);
            ctx.fillStyle = 'rgba(120, 220, 255, .12)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, TAU);
            ctx.fillStyle = b.color;
            ctx.fill();
        }
        ctx.restore();
    }

    function drawFx() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const k = 1 - p.t / p.max;
            if (p.kind === 'ring') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * (0.3 + p.t / p.max), 0, TAU);
                ctx.strokeStyle = 'rgba(255, 190, 120, ' + (k * 0.55).toFixed(3) + ')';
                ctx.lineWidth = 2.4;
                ctx.stroke();
            } else if (p.kind === 'spark') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.6 * k + 1, 0, TAU);
                ctx.fillStyle = 'rgba(230, 250, 255, ' + (k * 0.7).toFixed(3) + ')';
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * (0.35 + k * 0.9), 0, TAU);
                ctx.fillStyle = 'rgba(200, 240, 255, ' + (k * 0.5).toFixed(3) + ')';
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawRange() {
        let t = null;
        let range = 0;
        if (hover) {
            t = towerAt(hover.c, hover.r);
        }
        if (t) {
            range = TOWERS[t.type].range[t.lvl - 1];
        } else if (hover && !pathSet[hover.c + ',' + hover.r] && state === 'playing') {
            range = TOWERS[selType].range[0];
        }
        if (!range) return;

        const p = cellCenter(hover.c, hover.r);
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, range, 0, TAU);
        ctx.fillStyle = t ? 'rgba(120, 200, 255, .06)' : 'rgba(140, 220, 255, .05)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 210, 250, .3)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 6]);
        ctx.stroke();
        ctx.restore();

        // 空地上的半透明预览塔
        if (!t && state === 'playing') {
            ctx.save();
            ctx.globalAlpha = 0.4;
            drawTower({
                x: p.x, y: p.y, type: selType, lvl: 1,
                angle: -Math.PI / 2, flash: 0
            });
            ctx.restore();
        }
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(146, 184, 214, .48)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('TOWER DEFENSE', W / 2, 24);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#eaf2ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('塔防', W / 2, 49);

        const bx = 96;
        const bw = W - 192;
        const by = 66;
        const bh = 4;
        const k = wave / TOTAL_WAVES;
        roundRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.fillStyle = 'rgba(110, 150, 190, .2)';
        ctx.fill();
        if (k > 0) {
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            g.addColorStop(0, 'rgba(96, 170, 255, .85)');
            g.addColorStop(1, 'rgba(140, 240, 210, .95)');
            roundRectPath(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 182, 208, .64)';
        ctx.fillText('第 ' + wave + ' / ' + TOTAL_WAVES + ' 波 · 生命 ' + lives +
            ' · 金币 ' + gold, W / 2, 88);
        ctx.restore();
    }

    const CARD_X = 16;
    const CARD_Y = 486;
    const CARD_W = 104;
    const CARD_H = 66;

    function cardRect(i) {
        return { x: CARD_X + i * 112, y: CARD_Y, w: CARD_W, h: CARD_H };
    }

    function waveBtnRect() {
        return { x: 352, y: CARD_Y, w: 112, h: CARD_H };
    }

    function drawBottom() {
        ctx.save();
        ctx.strokeStyle = 'rgba(110, 150, 195, .16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, 476);
        ctx.lineTo(W - 20, 476);
        ctx.stroke();

        for (let i = 0; i < TOWERS.length; i++) {
            const st = TOWERS[i];
            const r = cardRect(i);
            const on = selType === i;
            roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
            ctx.fillStyle = on ? 'rgba(46, 96, 150, .34)' : 'rgba(20, 32, 48, .72)';
            ctx.fill();
            ctx.strokeStyle = on ? 'rgba(122, 208, 255, .75)' : 'rgba(110, 152, 200, .2)';
            ctx.lineWidth = on ? 1.6 : 1;
            ctx.stroke();

            // 图标
            const ix = r.x + 21;
            const iy = r.y + r.h / 2;
            ctx.save();
            ctx.translate(ix, iy);
            if (st.key === 'arrow') {
                ctx.beginPath();
                ctx.arc(0, 0, 8.6, 0, TAU);
                ctx.fillStyle = 'rgba(95, 216, 255, .25)';
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(7, 0);
                ctx.lineTo(-3, 5);
                ctx.lineTo(-3, -5);
                ctx.closePath();
                ctx.fillStyle = st.color;
                ctx.fill();
            } else if (st.key === 'cannon') {
                ctx.beginPath();
                ctx.arc(0, 0, 8.6, 0, TAU);
                ctx.fillStyle = 'rgba(255, 176, 90, .25)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(0, 0, 5.2, 0, TAU);
                ctx.fillStyle = st.color;
                ctx.fill();
                ctx.fillStyle = 'rgba(24, 16, 10, .9)';
                ctx.fillRect(-1.6, -1.6, 8.6, 3.2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, 8.6, 0, TAU);
                ctx.fillStyle = 'rgba(168, 188, 255, .24)';
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(0, -7.4);
                ctx.lineTo(4.4, 0);
                ctx.lineTo(0, 7.4);
                ctx.lineTo(-4.4, 0);
                ctx.closePath();
                ctx.fillStyle = st.color;
                ctx.fill();
            }
            ctx.restore();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = on ? '#f0f8ff' : 'rgba(214, 232, 248, .88)';
            ctx.font = '700 12px ' + FONT;
            ctx.fillText(st.name, r.x + 36, r.y + 24);

            ctx.fillStyle = gold >= st.cost ? 'rgba(255, 214, 132, .95)' : 'rgba(230, 120, 120, .9)';
            ctx.font = '700 11px ' + FONT;
            ctx.fillText(st.cost + ' 金', r.x + 36, r.y + 44);
        }

        // 开始波次按钮
        const r = waveBtnRect();
        const done = wave >= TOTAL_WAVES && !running;
        let label;
        let sub;
        if (done) {
            label = '已通关';
            sub = '击杀 ' + kills;
        } else if (running) {
            label = '第 ' + wave + ' 波';
            sub = '敌人 ' + enemies.length + ' 个';
        } else {
            label = '开始第 ' + (wave + 1) + ' 波';
            sub = wave === 0 ? '空格键' : '空格键 · 可继续建塔';
        }
        const hot = !running && !done && state === 'playing';

        roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
        if (hot) {
            const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
            g.addColorStop(0, 'rgba(66, 132, 236, .9)');
            g.addColorStop(1, 'rgba(86, 196, 208, .9)');
            ctx.fillStyle = g;
        } else {
            ctx.fillStyle = 'rgba(24, 38, 56, .8)';
        }
        ctx.fill();
        ctx.strokeStyle = hot ? 'rgba(150, 220, 255, .8)' : 'rgba(110, 152, 200, .22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = hot ? '#ffffff' : 'rgba(196, 220, 240, .8)';
        ctx.font = '800 12.5px ' + FONT;
        ctx.fillText(label, r.x + r.w / 2, r.y + 26);
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = hot ? 'rgba(232, 248, 255, .82)' : 'rgba(150, 180, 210, .6)';
        ctx.fillText(sub, r.x + r.w / 2, r.y + 45);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (msg && msgT > 0) {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(255, 202, 152, .95)';
            ctx.fillText(msg, W / 2, 574);
        } else {
            ctx.font = '700 12px ' + FONT;
            ctx.fillStyle = 'rgba(158, 196, 216, .64)';
            ctx.fillText('选塔建塔挡住敌人 · 点击已有塔升级', W / 2, 574);
        }
        ctx.restore();
    }

    function drawBanner() {
        if (!banner) return;
        const fade = Math.min(1, (banner.max - banner.t) * 5);
        const a = banner.t < 0.35 ? banner.t / 0.35 : 1;
        ctx.save();
        ctx.globalAlpha = a * fade;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cy = 300;
        const g = ctx.createLinearGradient(56, 0, W - 56, 0);
        g.addColorStop(0, 'rgba(6, 16, 26, 0)');
        g.addColorStop(0.5, 'rgba(6, 16, 26, .9)');
        g.addColorStop(1, 'rgba(6, 16, 26, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(46, cy - 46, W - 92, 92);

        ctx.fillStyle = '#bfe6ff';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, cy - 12);

        ctx.fillStyle = 'rgba(176, 212, 236, .8)';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText(banner.sub, W / 2, cy + 20);
        ctx.restore();
    }

    function draw() {
        drawBg();

        ctx.save();
        if (shake > 0) ctx.translate(Math.sin(clock * 70) * shake * 3, 0);
        drawGrid();
        drawPath();
        drawRange();
        for (let i = 0; i < towers.length; i++) drawTower(towers[i]);
        drawEnemies();
        drawBullets();
        drawFx();
        ctx.restore();

        drawHeader();
        drawBottom();
        drawFooter();
        drawBanner();
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
        pointer.x = p.x;
        pointer.y = p.y;
        if (state !== 'playing') return;

        // 底部选塔 / 开波
        if (p.y >= CARD_Y - 4 && p.y <= CARD_Y + CARD_H + 6) {
            for (let i = 0; i < TOWERS.length; i++) {
                const r = cardRect(i);
                if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
                    selType = i;
                    return;
                }
            }
            const wb = waveBtnRect();
            if (p.x >= wb.x && p.x <= wb.x + wb.w && p.y >= wb.y && p.y <= wb.y + wb.h) {
                startWave();
                return;
            }
            return;
        }

        const cell = cellAt(p.x, p.y);
        if (!cell) return;
        buildAt(cell.c, cell.r);
    });

    canvas.addEventListener('pointermove', function (e) {
        const p = toLocal(e);
        pointer.x = p.x;
        pointer.y = p.y;
        hover = cellAt(p.x, p.y);
    });

    canvas.addEventListener('pointerleave', function () {
        hover = null;
    });

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
            e.preventDefault();
            selType = Number(e.code.slice(5)) - 1;
        } else if (e.code === 'Space') {
            e.preventDefault();
            startWave();
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

    updateHud();
    requestAnimationFrame(loop);
})();
