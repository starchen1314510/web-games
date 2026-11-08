/* ==========================================================
   太空射击 Space Shooter
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 620;
    const BEST_KEY = 'webgames.shooter.best';

    const PLAYER_R = 15;
    const PLAYER_SPEED = 340;
    const BULLET_SPEED = 660;
    const FIRE_INTERVAL = 0.155;
    const MAX_DOUBLE_MS = 10000;

    const ENEMY_TYPES = {
        small: { r: 14, hp: 1, speed: 138, score: 10, fire: 0, color: '#5ad2ff', glow: 'rgba(90,210,255,.6)' },
        medium: { r: 19, hp: 2, speed: 100, score: 25, fire: 2.1, color: '#ff9f43', glow: 'rgba(255,159,67,.6)' },
        heavy: { r: 27, hp: 5, speed: 64, score: 60, fire: 1.6, color: '#ff5c6c', glow: 'rgba(255,92,108,.6)' }
    };

    /* ---------- 画布 ---------- */
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

    function rand(a, b) {
        return a + Math.random() * (b - a);
    }

    const canvas = document.getElementById('stage');
    const ctx = initCanvas(canvas, W, H);

    const els = {
        score: document.getElementById('score'),
        best: document.getElementById('best'),
        level: document.getElementById('level'),
        lives: document.getElementById('lives'),
        buff: document.getElementById('buff'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn'),
        touchPad: document.getElementById('touch-pad')
    };

    /* ---------- 状态 ---------- */
    const player = {
        x: W / 2,
        y: H - 68,
        lives: 3,
        shield: false,
        invuln: 0,
        doubleUntil: 0,
        fireCd: 0
    };

    let bullets = [];
    let enemies = [];
    let eBullets = [];
    let particles = [];
    let drops = [];
    let stars = [];

    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);
    let killed = 0;
    let level = 1;
    let state = 'ready';       // ready | playing | paused | over
    let elapsed = 0;
    let spawnCd = 1;
    let levelBanner = 0;
    let hudCache = '';
    let dragX = null;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#060a12');
    bgGrad.addColorStop(0.55, '#0a1220');
    bgGrad.addColorStop(1, '#0d1828');

    /* ---------- 星空 ---------- */
    function initStars() {
        stars = [];
        for (let i = 0; i < 90; i++) {
            const layer = i < 40 ? 0 : (i < 72 ? 1 : 2);
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: layer === 0 ? 1 : (layer === 1 ? 1.6 : 2.2),
                speed: layer === 0 ? 18 : (layer === 1 ? 36 : 62),
                alpha: layer === 0 ? 0.28 : (layer === 1 ? 0.5 : 0.8)
            });
        }
    }

    function updateStars(dt) {
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            s.y += s.speed * dt;
            if (s.y > H) {
                s.y = -4;
                s.x = Math.random() * W;
            }
        }
    }

    /* ---------- HUD ---------- */
    function buffText() {
        const parts = [];
        if (elapsed < player.doubleUntil) {
            parts.push('双发 ' + Math.ceil(player.doubleUntil - elapsed) + 's');
        }
        if (player.shield) parts.push('护盾');
        return parts.length ? parts.join(' / ') : '常规';
    }

    function updateHud() {
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        const lives = '♥'.repeat(Math.max(0, player.lives));
        const buff = buffText();
        const key = score + '|' + level + '|' + lives + '|' + buff + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.best.textContent = String(best);
        els.level.textContent = String(level);
        els.lives.textContent = lives;
        els.buff.textContent = buff;
    }

    /* ---------- 覆盖层 ---------- */
    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '太空射击';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '飞船自动开火，左右移动躲开敌机与弹幕。击落足够多的敌机即可升级，小心别被撞到。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始游戏';
            els.ovRestart.hidden = true;
        } else if (kind === 'paused') {
            els.ovTitle.textContent = '已暂停';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按 P 或 Esc 继续游戏。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '继续游戏';
            els.ovRestart.hidden = false;
        } else if (kind === 'over') {
            els.ovTitle.textContent = '飞船坠毁';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '坚持到了第 ' + level + ' 级，击落 ' + killed + ' 架敌机。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '再来一局';
            els.ovRestart.hidden = true;
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 重置 ---------- */
    function reset() {
        bullets = [];
        enemies = [];
        eBullets = [];
        particles = [];
        drops = [];
        player.x = W / 2;
        player.lives = 3;
        player.shield = false;
        player.invuln = 0;
        player.doubleUntil = 0;
        player.fireCd = 0;
        score = 0;
        killed = 0;
        level = 1;
        elapsed = 0;
        spawnCd = 1;
        levelBanner = 0;
        hudCache = '';
        updateHud();
    }

    function begin() {
        reset();
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

    function gameOver() {
        state = 'over';
        updateHud();
        showOverlay('over');
    }

    /* ---------- 玩家 ---------- */
    function fire() {
        const double = elapsed < player.doubleUntil;
        if (double) {
            bullets.push({ x: player.x - 10, y: player.y - 16, r: 4, vy: -BULLET_SPEED });
            bullets.push({ x: player.x + 10, y: player.y - 16, r: 4, vy: -BULLET_SPEED });
        } else {
            bullets.push({ x: player.x, y: player.y - 20, r: 4, vy: -BULLET_SPEED });
        }
    }

    function hurtPlayer() {
        if (player.invuln > 0) return;
        if (player.shield) {
            player.shield = false;
            player.invuln = 0.9;
            spawnBurst(player.x, player.y, '#5ad2ff', 18);
            updateHud();
            return;
        }
        player.lives--;
        player.invuln = 1.6;
        spawnBurst(player.x, player.y, '#ff5c6c', 30);
        updateHud();
        if (player.lives <= 0) gameOver();
    }

    /* ---------- 粒子 ---------- */
    function spawnBurst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = rand(50, 250);
            const life = rand(0.3, 0.8);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: life,
                maxLife: life,
                size: rand(1.4, 3.6),
                color: color
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    /* ---------- 敌机 ---------- */
    function spawnEnemy() {
        const r = Math.random();
        const heavyChance = Math.min(0.22, 0.04 + (level - 1) * 0.03);
        let type = 'small';
        if (r > 1 - heavyChance) type = 'heavy';
        else if (r > 1 - heavyChance - 0.28) type = 'medium';

        const t = ENEMY_TYPES[type];
        const radius = t.r;
        const x = rand(radius + 14, W - radius - 14);
        enemies.push({
            type: type,
            x: x,
            baseX: x,
            y: -radius - 6,
            r: radius,
            hp: t.hp,
            maxHp: t.hp,
            speed: t.speed * (1 + (level - 1) * 0.11),
            score: t.score,
            color: t.color,
            glow: t.glow,
            fire: t.fire,
            fireCd: t.fire ? rand(0.8, 2) : 0,
            swayAmp: type === 'heavy' ? rand(10, 30) : rand(16, 48),
            swayFreq: rand(0.6, 1.5),
            phase: Math.random() * Math.PI * 2,
            flash: 0
        });
    }

    function hitEnemy(e, index) {
        e.hp -= 1;
        e.flash = 0.12;
        if (e.hp > 0) {
            score += 2;
            updateHud();
            return;
        }
        enemies.splice(index, 1);
        score += e.score;
        killed++;
        updateHud();
        spawnBurst(e.x, e.y, e.color, e.r > 20 ? 26 : 15);
        maybeDrop(e);

        const nextLevel = 1 + Math.floor(killed / 12);
        if (nextLevel > level) {
            level = nextLevel;
            levelBanner = 1.6;
            updateHud();
        }
    }

    function maybeDrop(e) {
        const chance = e.type === 'heavy' ? 0.38 : 0.09;
        if (Math.random() > chance) return;
        drops.push({
            x: e.x,
            y: e.y,
            r: 12,
            kind: Math.random() < 0.55 ? 'double' : 'shield',
            vy: 88,
            phase: Math.random() * Math.PI * 2
        });
    }

    function updateEnemies(dt) {
        spawnCd -= dt;
        if (spawnCd <= 0) {
            spawnEnemy();
            const base = Math.max(0.45, 1.15 - (level - 1) * 0.075);
            spawnCd = base * rand(0.72, 1.25);
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.y += e.speed * dt;
            e.x = clamp(e.baseX + Math.sin(elapsed * e.swayFreq + e.phase) * e.swayAmp,
                e.r + 6, W - e.r - 6);

            if (e.flash > 0) e.flash -= dt;

            if (e.fire && e.y > 30 && e.y < H * 0.72) {
                e.fireCd -= dt;
                if (e.fireCd <= 0) {
                    e.fireCd = e.fire * rand(0.8, 1.4);
                    eBullets.push({
                        x: e.x,
                        y: e.y + e.r * 0.7,
                        r: 5,
                        vy: 215 + level * 12
                    });
                }
            }

            if (e.y > H + e.r + 10) {
                enemies.splice(i, 1);
                continue;
            }

            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const rr = e.r + PLAYER_R - 4;
            if (dx * dx + dy * dy < rr * rr) {
                spawnBurst(e.x, e.y, '#ff5c6c', 22);
                enemies.splice(i, 1);
                hurtPlayer();
                if (state !== 'playing') return;
            }
        }
    }

    function updateBullets(dt) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.y += b.vy * dt;
            if (b.y < -20) {
                bullets.splice(i, 1);
                continue;
            }
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const dx = b.x - e.x;
                const dy = b.y - e.y;
                const rr = e.r + b.r;
                if (dx * dx + dy * dy <= rr * rr) {
                    bullets.splice(i, 1);
                    hitEnemy(e, j);
                    break;
                }
            }
        }
    }

    function updateEBullets(dt) {
        for (let i = eBullets.length - 1; i >= 0; i--) {
            const b = eBullets[i];
            b.y += b.vy * dt;
            if (b.y > H + 20) {
                eBullets.splice(i, 1);
                continue;
            }
            const dx = b.x - player.x;
            const dy = b.y - player.y;
            const rr = b.r + PLAYER_R - 4;
            if (dx * dx + dy * dy < rr * rr) {
                eBullets.splice(i, 1);
                hurtPlayer();
                if (state !== 'playing') return;
            }
        }
    }

    function updateDrops(dt) {
        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            d.y += d.vy * dt;
            d.x += Math.cos(elapsed * 2 + d.phase) * 18 * dt;
            if (d.y > H + 20) {
                drops.splice(i, 1);
                continue;
            }
            const dx = d.x - player.x;
            const dy = d.y - player.y;
            if (dx * dx + dy * dy < 30 * 30) {
                drops.splice(i, 1);
                if (d.kind === 'double') {
                    player.doubleUntil = elapsed + MAX_DOUBLE_MS / 1000;
                } else {
                    player.shield = true;
                }
                spawnBurst(d.x, d.y, d.kind === 'double' ? '#ffc548' : '#5ad2ff', 14);
                updateHud();
            }
        }
    }

    /* ---------- 主更新 ---------- */
    function update(dt) {
        elapsed += dt;

        let vx = 0;
        if (dragX !== null) {
            player.x += (dragX - player.x) * Math.min(1, dt * 18);
        } else {
            if (keys.left || keys.touchLeft) vx -= 1;
            if (keys.right || keys.touchRight) vx += 1;
            player.x += vx * PLAYER_SPEED * dt;
        }
        player.x = clamp(player.x, PLAYER_R + 4, W - PLAYER_R - 4);

        if (player.invuln > 0) player.invuln -= dt;
        if (levelBanner > 0) levelBanner -= dt;

        player.fireCd -= dt;
        if (player.fireCd <= 0) {
            player.fireCd = FIRE_INTERVAL;
            fire();
        }

        updateBullets(dt);
        updateEnemies(dt);
        if (state !== 'playing') return;
        updateEBullets(dt);
        updateDrops(dt);
        updateParticles(dt);
        updateStars(dt);
    }

    /* ---------- 绘制 ---------- */
    function drawStars() {
        ctx.fillStyle = '#dce9ff';
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            ctx.globalAlpha = s.alpha;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        if (player.invuln > 0 && Math.floor(elapsed * 14) % 2 === 0) return;

        const x = player.x;
        const y = player.y;

        // 引擎火焰
        const flick = 6 + Math.random() * 9;
        const flame = ctx.createLinearGradient(0, y + 8, 0, y + 24 + flick);
        flame.addColorStop(0, 'rgba(255,214,120,.95)');
        flame.addColorStop(1, 'rgba(255,92,108,0)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(x - 7, y + 8);
        ctx.lineTo(x, y + 22 + flick);
        ctx.lineTo(x + 7, y + 8);
        ctx.closePath();
        ctx.fill();

        // 机身
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.lineTo(x + 9, y - 4);
        ctx.lineTo(x + 17, y + 12);
        ctx.lineTo(x + 6, y + 9);
        ctx.lineTo(x - 6, y + 9);
        ctx.lineTo(x - 17, y + 12);
        ctx.lineTo(x - 9, y - 4);
        ctx.closePath();
        const body = ctx.createLinearGradient(x, y - 22, x, y + 14);
        body.addColorStop(0, '#eaf6ff');
        body.addColorStop(0.45, '#8fc2ff');
        body.addColorStop(1, '#3963b8');
        ctx.fillStyle = body;
        ctx.shadowColor = 'rgba(79,140,255,.7)';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;

        // 驾驶舱
        ctx.beginPath();
        ctx.ellipse(x, y - 7, 4.5, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#9ff0ff';
        ctx.fill();

        // 护盾
        if (player.shield) {
            ctx.beginPath();
            ctx.arc(x, y, 27, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(90,210,255,.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.lineDashOffset = -elapsed * 40;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function drawEnemy(e) {
        const r = e.r;
        ctx.save();
        ctx.translate(e.x, e.y);

        ctx.shadowColor = e.glow;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(r * 0.92, r * 0.15);
        ctx.lineTo(r * 0.55, -r * 0.85);
        ctx.lineTo(-r * 0.55, -r * 0.85);
        ctx.lineTo(-r * 0.92, r * 0.15);
        ctx.closePath();

        if (e.flash > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            const g = ctx.createLinearGradient(0, -r, 0, r);
            g.addColorStop(0, '#1b2638');
            g.addColorStop(1, e.color);
            ctx.fillStyle = g;
        }
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = e.color;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 核心
        ctx.beginPath();
        ctx.arc(0, r * 0.08, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = e.flash > 0 ? '#ff5c6c' : 'rgba(255,255,255,.88)';
        ctx.fill();

        // 重型机血条
        if (e.maxHp > 2 && e.hp < e.maxHp) {
            const w = r * 1.6;
            ctx.fillStyle = 'rgba(0,0,0,.5)';
            ctx.fillRect(-w / 2, -r - 9, w, 3.5);
            ctx.fillStyle = e.color;
            ctx.fillRect(-w / 2, -r - 9, w * (e.hp / e.maxHp), 3.5);
        }
        ctx.restore();
    }

    function drawBullets() {
        ctx.shadowColor = '#4f8cff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#b7f0ff';
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            ctx.fillRect(b.x - 2, b.y - 9, 4, 15);
        }
        ctx.shadowColor = '#ff5c6c';
        ctx.fillStyle = '#ffb3b3';
        for (let i = 0; i < eBullets.length; i++) {
            const b = eBullets[i];
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    function drawDrops() {
        for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            const color = d.kind === 'double' ? '#ffc548' : '#5ad2ff';
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(Math.sin(elapsed * 2 + d.phase) * 0.2);
            ctx.beginPath();
            ctx.arc(0, 0, d.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(10,18,30,.85)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = '700 ' + (d.kind === 'double' ? 11 : 12) + 'px ui-monospace, Menlo, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.kind === 'double' ? '×2' : '盾', 0, 0.5);
            ctx.restore();
        }
    }

    function drawParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const a = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawLevelBanner() {
        if (levelBanner <= 0) return;
        const a = Math.min(1, levelBanner / 0.5);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(159,240,255,.95)';
        ctx.shadowColor = 'rgba(79,140,255,.9)';
        ctx.shadowBlur = 18;
        ctx.font = '800 34px ui-monospace, Menlo, monospace';
        ctx.fillText('LEVEL ' + level, W / 2, H * 0.42);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    function render() {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        drawStars();
        drawDrops();

        for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
        drawBullets();
        drawPlayer();
        drawParticles();
        drawLevelBanner();
    }

    /* ---------- 输入 ---------- */
    const keys = { left: false, right: false, touchLeft: false, touchRight: false };

    window.addEventListener('keydown', function (e) {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
            keys.left = true;
            e.preventDefault();
        } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
            keys.right = true;
            e.preventDefault();
        } else if (k === 'p' || k === 'P' || k === 'Escape') {
            togglePause();
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', function (e) {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    });

    // 触屏拖动飞船
    function canvasX(clientX) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return W / 2;
        return (clientX - rect.left) * (W / rect.width);
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        dragX = canvasX(e.clientX);
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', function (e) {
        if (dragX === null) return;
        dragX = canvasX(e.clientX);
    });

    function endDrag() {
        dragX = null;
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    const pad = els.touchPad;
    if (pad) {
        pad.addEventListener('pointerdown', function (e) {
            const btn = e.target.closest('[data-dir]');
            if (!btn) return;
            e.preventDefault();
            const dir = btn.getAttribute('data-dir');
            if (dir === 'pause') {
                togglePause();
            } else if (dir === 'left') {
                keys.touchLeft = true;
            } else if (dir === 'right') {
                keys.touchRight = true;
            }
        });
        const clearPad = function () {
            keys.touchLeft = false;
            keys.touchRight = false;
        };
        pad.addEventListener('pointerup', clearPad);
        pad.addEventListener('pointercancel', clearPad);
        pad.addEventListener('pointerleave', clearPad);
    }

    // 触屏方向按钮（与键盘状态合并）

    els.ovBtn.addEventListener('click', function () {
        if (state === 'paused') {
            togglePause();
        } else {
            begin();
        }
    });

    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    /* ---------- 主循环 ---------- */
    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;
        if (state === 'playing') update(dt);
        render();
        requestAnimationFrame(frame);
    }

    /* ---------- 启动 ---------- */
    initStars();
    updateHud();
    if (window.matchMedia('(hover: none)').matches) {
        els.touchPad.classList.add('show');
    }
    requestAnimationFrame(frame);
})();
