/* ==========================================================
   跳一跳 Jump
   ========================================================== */
(function () {
    'use strict';

    const W = 460;
    const H = 620;
    const TAU = Math.PI * 2;

    const S = 42;
    const DT = 21;
    const BODY = 30;
    const ANCHOR_Y = H * 0.70;
    const MAX_DIST = 250;
    const CHARGE_TIME = 0.9;
    const GRAVITY = 1900;
    const BEST_KEY = 'webgames.jump.best';

    const UA = { x: 0.876, y: -0.482 };
    const UB = { x: -0.876, y: -0.482 };

    const HUES = [212, 268, 152, 44, 330, 190];

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
        combo: document.getElementById('combo'),
        jumps: document.getElementById('jumps'),
        best: document.getElementById('best'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let blocks = [];
    let cur = 0;
    let score = 0;
    let jumps = 0;
    let combo = 0;
    let best = Number(localStorage.getItem(BEST_KEY) || 0);

    let state = 'ready';     // ready | idle | charging | flying | falling | over
    let power = 0;
    let camX = 0;
    let camY = 0;
    let player = { x: 0, y: 0, z: 0, rot: 0, squash: 0 };
    let jump = null;
    let fallTimer = 0;
    let bits = [];
    let texts = [];
    let hudCache = '';
    let clock = 0;
    let fallV = 0;

    /* ---------- 关卡生成 ---------- */
    function newBlock(prev) {
        const dir = Math.random() < 0.5 ? UA : UB;
        const dist = rand(96, 205);
        return {
            x: prev.x + dir.x * dist,
            y: prev.y + dir.y * dist,
            h: rand(26, 52),
            hue: HUES[Math.floor(Math.random() * HUES.length)],
            born: 0
        };
    }

    function ensureBlocks() {
        while (blocks.length < cur + 7) {
            blocks.push(newBlock(blocks[blocks.length - 1]));
        }
    }

    function placePlayer(i) {
        player.x = blocks[i].x;
        player.y = blocks[i].y;
        player.z = 0;
        player.rot = 0;
        player.squash = 0;
    }

    function camTarget() {
        return {
            x: blocks[cur].x - W / 2,
            y: blocks[cur].y - ANCHOR_Y
        };
    }

    function snapCamera() {
        const t = camTarget();
        camX = t.x;
        camY = t.y;
    }

    /* ---------- HUD ---------- */
    function updateHud() {
        const key = score + '|' + combo + '|' + jumps + '|' + best;
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.combo.textContent = combo >= 2 ? ('×' + combo) : '--';
        els.jumps.textContent = String(jumps);
        els.best.textContent = String(best);
    }

    function showOverlay(kind) {
        if (kind === 'ready') {
            els.ovTitle.textContent = '跳一跳';
            els.ovTitle.classList.remove('danger');
            els.ovDesc.textContent = '按住蓄力，松开起跳，跳到下一个方块上。连续踩中中心会有连击加分，掉下去就结束了。';
            els.ovScore.hidden = true;
            els.ovBtn.textContent = '开始游戏';
        } else {
            els.ovTitle.textContent = '掉下去了';
            els.ovTitle.classList.add('danger');
            els.ovDesc.textContent = '跳了 ' + jumps + ' 步，得分 ' + score + '，最高连击 ×' + Math.max(combo, 1) + '。';
            els.ovScore.hidden = false;
            els.ovScoreVal.textContent = String(score);
            els.ovBtn.textContent = '再来一次';
        }
        els.overlay.classList.add('show');
    }

    function hideOverlay() {
        els.overlay.classList.remove('show');
    }

    /* ---------- 流程 ---------- */
    function begin() {
        blocks = [{ x: W / 2, y: H * 0.5, h: 34, hue: 212, born: 0 }];
        cur = 0;
        score = 0;
        jumps = 0;
        combo = 0;
        power = 0;
        bits = [];
        texts = [];
        jump = null;
        fallTimer = 0;
        fallV = 0;
        hudCache = '';
        ensureBlocks();
        placePlayer(0);
        snapCamera();
        state = 'idle';
        hideOverlay();
        updateHud();
    }

    function endGame() {
        state = 'over';
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
        }
        updateHud();
        showOverlay('over');
    }

    /* ---------- 跳跃 ---------- */
    function startCharge() {
        if (state !== 'idle') return;
        state = 'charging';
        power = 0;
    }

    function release() {
        if (state !== 'charging') return;
        const dist = 30 + power * MAX_DIST;
        const dir = blocks[cur + 1].x > blocks[cur].x ? UA : UB;
        const from = { x: blocks[cur].x, y: blocks[cur].y };
        const to = { x: from.x + dir.x * dist, y: from.y + dir.y * dist };
        const dur = 0.30 + dist / 900;
        jump = {
            from: from,
            to: to,
            t: 0,
            dur: dur,
            arc: 52 + dist * 0.34,
            dist: dist
        };
        state = 'flying';
        power = 0;
    }

    function land() {
        const target = blocks[cur + 1];
        const dx = jump.to.x - target.x;
        const dy = jump.to.y - target.y;
        const onTop = Math.abs(dx) / S + Math.abs(dy) / DT <= 1;

        if (!onTop) {
            state = 'falling';
            fallTimer = 0;
            fallV = 0;
            player.x = jump.to.x;
            player.y = jump.to.y;
            player.z = 0;
            jump = null;
            return;
        }

        const off = Math.hypot(dx, dy);
        const perfect = off < 12;

        cur += 1;
        jumps += 1;
        ensureBlocks();
        placePlayer(cur);

        if (perfect) {
            combo += 1;
            const gain = 2 + Math.min(combo, 6);
            score += gain;
            texts.push({ x: target.x, y: target.y - 56, text: '完美 +' + gain, life: 1.1, max: 1.1, size: 20 });
            burst(target.x, target.y, 'rgba(255, 214, 120, .95)');
        } else {
            combo = 0;
            score += 1;
        }

        state = 'idle';
        jump = null;
        updateHud();
    }

    function burst(x, y, color) {
        for (let i = 0; i < 14; i++) {
            const a = rand(0, TAU);
            const sp = rand(40, 170);
            bits.push({
                x: x, y: y,
                vx: Math.cos(a) * sp * 0.5,
                vy: Math.sin(a) * sp * 0.28 - 40,
                r: rand(1.4, 3.4),
                life: rand(0.3, 0.7),
                max: 0.7,
                color: color
            });
        }
    }

    /* ---------- 更新 ---------- */
    function update(dt) {
        if (state === 'charging') {
            power = Math.min(1, power + dt / CHARGE_TIME);
            player.squash = power * 0.55;
        } else {
            player.squash += (0 - player.squash) * Math.min(1, dt * 10);
        }

        if (state === 'flying' && jump) {
            jump.t += dt;
            const k = clamp(jump.t / jump.dur, 0, 1);
            player.x = jump.from.x + (jump.to.x - jump.from.x) * k;
            player.y = jump.from.y + (jump.to.y - jump.from.y) * k;
            player.z = Math.sin(k * Math.PI) * jump.arc;
            player.rot = Math.sin(k * Math.PI) * 0.35 * (jump.to.x > jump.from.x ? 1 : -1);
            if (k >= 1) land();
        }

        if (state === 'falling') {
            fallTimer += dt;
            fallV += GRAVITY * dt;
            player.z -= fallV * dt;
            player.rot += dt * 6;
            if (fallTimer > 0.95) endGame();
        }

        if (state !== 'flying') {
            const t = camTarget();
            camX += (t.x - camX) * Math.min(1, dt * 7);
            camY += (t.y - camY) * Math.min(1, dt * 7);
        }

        for (let i = bits.length - 1; i >= 0; i--) {
            const b = bits[i];
            b.vy += 700 * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) bits.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            t.y -= 38 * dt;
            t.life -= dt;
            if (t.life <= 0) texts.splice(i, 1);
        }
    }

    /* ---------- 绘制 ---------- */
    function drawBackground() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1220');
        g.addColorStop(0.55, '#101a2c');
        g.addColorStop(1, '#16233a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, H * 0.15, 20, W / 2, H * 0.15, 340);
        glow.addColorStop(0, 'rgba(79, 140, 255, .16)');
        glow.addColorStop(1, 'rgba(79, 140, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(255, 255, 255, .05)';
        for (let i = 0; i < 40; i++) {
            const x = (i * 137) % W;
            const y = (i * 211) % H;
            ctx.beginPath();
            ctx.arc(x, y, i % 5 === 0 ? 1.6 : 1, 0, TAU);
            ctx.fill();
        }
    }

    function blockColor(hue, dl) {
        return 'hsl(' + hue + ', 44%, ' + dl + '%)';
    }

    function drawBlock(b, idx) {
        const x = b.x;
        const y = b.y;
        const h = b.h;

        ctx.fillStyle = 'rgba(0, 0, 0, .28)';
        ctx.beginPath();
        ctx.moveTo(x, y + DT + h * 0.2);
        ctx.lineTo(x + S * 0.9, y + h * 0.2);
        ctx.lineTo(x, y + DT + h * 0.62);
        ctx.lineTo(x - S * 0.9, y + h * 0.2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = blockColor(b.hue, 26);
        ctx.beginPath();
        ctx.moveTo(x - S, y);
        ctx.lineTo(x, y + DT);
        ctx.lineTo(x, y + DT + h);
        ctx.lineTo(x - S, y + h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = blockColor(b.hue, 20);
        ctx.beginPath();
        ctx.moveTo(x + S, y);
        ctx.lineTo(x, y + DT);
        ctx.lineTo(x, y + DT + h);
        ctx.lineTo(x + S, y + h);
        ctx.closePath();
        ctx.fill();

        const g = ctx.createLinearGradient(x - S, y - DT, x + S, y + DT);
        g.addColorStop(0, blockColor(b.hue, 60));
        g.addColorStop(1, blockColor(b.hue, 46));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y - DT);
        ctx.lineTo(x + S, y);
        ctx.lineTo(x, y + DT);
        ctx.lineTo(x - S, y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, .22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, .10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - S, y);
        ctx.lineTo(x - S, y + h);
        ctx.moveTo(x + S, y);
        ctx.lineTo(x + S, y + h);
        ctx.moveTo(x - S, y + h);
        ctx.lineTo(x, y + DT + h);
        ctx.lineTo(x + S, y + h);
        ctx.stroke();

        if (idx === cur + 1 && (state === 'idle' || state === 'charging')) {
            const pulse = 0.5 + Math.sin(clock * 3.2) * 0.5;
            ctx.fillStyle = 'rgba(255, 232, 160, ' + (0.35 + pulse * 0.45).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(x, y, 3.4 + pulse * 1.6, 0, TAU);
            ctx.fill();
        }
    }

    function drawPlayer() {
        const x = player.x;
        const y = player.y;
        const z = player.z;
        const sq = player.squash;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 15 + sq * 5, 7 + sq * 2.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(x, y - z);
        ctx.rotate(player.rot);

        const bodyH = (30 - sq * 16) * (z > 8 ? 1.1 : 1);
        const bodyW = 15 + sq * 5;

        const g = ctx.createLinearGradient(-bodyW, 0, bodyW, 0);
        g.addColorStop(0, '#2a3f66');
        g.addColorStop(0.45, '#5f9dff');
        g.addColorStop(1, '#2a3f66');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, -bodyH, bodyW, bodyW * 0.7, 0, Math.PI, TAU);
        ctx.lineTo(bodyW, -bodyH * 0.25);
        ctx.quadraticCurveTo(bodyW, 0, 0, 0);
        ctx.quadraticCurveTo(-bodyW, 0, -bodyW, -bodyH * 0.25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, .32)';
        ctx.beginPath();
        ctx.ellipse(-bodyW * 0.34, -bodyH * 0.92, bodyW * 0.28, bodyW * 0.18, -0.5, 0, TAU);
        ctx.fill();

        ctx.fillStyle = 'rgba(12, 20, 34, .55)';
        ctx.beginPath();
        ctx.ellipse(0, -bodyH * 0.42, bodyW * 0.96, bodyW * 0.34, 0, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    function drawBits() {
        for (let i = 0; i < bits.length; i++) {
            const b = bits[i];
            ctx.globalAlpha = clamp(b.life / b.max, 0, 1);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawTexts() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
            ctx.fillStyle = 'rgba(255, 224, 150, .95)';
            ctx.font = '800 ' + t.size + 'px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawChargeBar() {
        if (state !== 'charging') return;
        const w = 14;
        const h = 150;
        const x = 26;
        const y = H - 190;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, .08)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, w, h, 7) : ctx.rect(x, y, w, h);
        ctx.fill();

        const g = ctx.createLinearGradient(0, y + h, 0, y);
        g.addColorStop(0, 'rgba(47, 212, 139, .95)');
        g.addColorStop(0.55, 'rgba(255, 197, 72, .95)');
        g.addColorStop(1, 'rgba(255, 92, 108, .95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        const ph = h * power;
        if (ctx.roundRect) ctx.roundRect(x, y + h - ph, w, ph, 7);
        else ctx.rect(x, y + h - ph, w, ph);
        ctx.fill();
        ctx.restore();
    }

    function render() {
        drawBackground();

        ctx.save();
        ctx.translate(-camX, -camY);

        const ordered = blocks.map(function (b, i) { return { b: b, i: i }; })
            .filter(function (o) {
                return o.b.y > camY - 120 && o.b.y < camY + H + 220;
            })
            .sort(function (a, b) { return a.b.y - b.b.y; });

        for (let i = 0; i < ordered.length; i++) {
            drawBlock(ordered[i].b, ordered[i].i);
        }

        drawPlayer();
        drawBits();
        drawTexts();
        ctx.restore();

        drawChargeBar();

        ctx.save();
        ctx.font = '800 40px -apple-system, "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(4, 10, 20, .6)';
        ctx.strokeText(String(score), 22, 18);
        ctx.fillStyle = '#eaf4ff';
        ctx.fillText(String(score), 22, 18);

        if (combo >= 2) {
            ctx.font = '800 16px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = 'rgba(255, 210, 120, .95)';
            ctx.fillText('连击 ×' + combo, 24, 66);
        }
        ctx.restore();
    }

    /* ---------- 循环 ---------- */
    let last = performance.now();

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        clock += dt;
        if (state !== 'ready' && state !== 'over') update(dt);
        else {
            for (let i = bits.length - 1; i >= 0; i--) {
                const b = bits[i];
                b.life -= dt;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                if (b.life <= 0) bits.splice(i, 1);
            }
        }
        render();
        window.requestAnimationFrame(loop);
    }

    /* ---------- 交互 ---------- */
    function down(e) {
        e.preventDefault();
        if (state === 'ready' || state === 'over') return;
        startCharge();
    }

    function up() {
        release();
    }

    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    window.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
            if (state === 'idle') startCharge();
            e.preventDefault();
        } else if (e.key === 'r' || e.key === 'R') {
            begin();
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
            release();
            e.preventDefault();
        }
    });

    els.ovBtn.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    blocks = [{ x: W / 2, y: H * 0.5, h: 34, hue: 212, born: 0 }];
    ensureBlocks();
    placePlayer(0);
    snapCamera();
    updateHud();
    showOverlay('ready');
    window.requestAnimationFrame(loop);
})();
