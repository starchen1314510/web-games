/* ==========================================================
   打字狂潮 Typing
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const PLAY_TOP = 86;
    const DANGER_Y = 500;
    const DOCK_Y = 516;
    const DOCK_H = 38;
    const PILL_H = 32;
    const PILL_PAD = 13;

    const BEST_KEY = 'webgames.typing.best';

    const WORDS = [
        'code', 'game', 'pixel', 'light', 'cloud', 'rocket', 'planet', 'shadow',
        'silver', 'garden', 'window', 'summer', 'winter', 'orange', 'purple', 'puzzle',
        'tunnel', 'engine', 'signal', 'random', 'memory', 'forest', 'island', 'python',
        'script', 'vector', 'matrix', 'galaxy', 'dragon', 'castle', 'bridge', 'candle',
        'desert', 'feather', 'guitar', 'hammer', 'jacket', 'kettle', 'ladder', 'magnet',
        'needle', 'object', 'pocket', 'quarter', 'ribbon', 'saddle', 'temple', 'umbrella',
        'valley', 'wallet', 'yellow', 'zipper', 'anchor', 'basket', 'camera', 'dolphin',
        'eagle', 'falcon', 'glacier', 'harbor', 'insect', 'jungle', 'keyboard', 'lantern',
        'mirror', 'napkin', 'oasis', 'pepper', 'quartz', 'rabbit', 'salmon', 'timber'
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
        score: document.getElementById('score'),
        combo: document.getElementById('combo'),
        lives: document.getElementById('lives'),
        best: document.getElementById('best'),
        cleared: document.getElementById('cleared'),
        overlay: document.getElementById('overlay'),
        ovBtn: document.getElementById('ov-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    let words = [];
    let typed = '';
    let locked = null;
    let score = 0;
    let combo = 0;
    let bestCombo = 0;
    let lives = 3;
    let cleared = 0;
    let level = 1;
    let spawnT = 0;
    let state = 'ready';
    let shake = 0;
    let missFlash = 0;
    let caret = 0;
    let banner = null;
    let fx = [];
    let hudCache = '';
    let lastSpawnX = -999;

    /* ---------- 数据 ---------- */
    function reset() {
        words = [];
        typed = '';
        locked = null;
        score = 0;
        combo = 0;
        bestCombo = 0;
        lives = 3;
        cleared = 0;
        level = 1;
        spawnT = 0.2;
        shake = 0;
        missFlash = 0;
        banner = null;
        fx = [];
        lastSpawnX = -999;
        hudCache = '';
    }

    function startGame() {
        reset();
        state = 'playing';
        els.overlay.classList.remove('show');
        updateHud();
    }

    function updateHud() {
        const key = [score, combo, lives, cleared, state].join('|');
        if (key === hudCache) return;
        hudCache = key;
        els.score.textContent = String(score);
        els.combo.textContent = 'x' + combo;
        els.lives.textContent = String(lives);
        els.cleared.textContent = String(cleared);
        els.best.textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
    }

    function wordWidth(text) {
        ctx.font = '700 19px ' + MONO;
        return ctx.measureText(text).width + PILL_PAD * 2;
    }

    function pickWord() {
        for (let i = 0; i < 12; i++) {
            const w = WORDS[Math.floor(Math.random() * WORDS.length)];
            if (!isWordOnScreen(w)) return w;
        }
        return WORDS[Math.floor(Math.random() * WORDS.length)];
    }

    function isWordOnScreen(text) {
        for (let i = 0; i < words.length; i++) {
            if (words[i].text === text) return true;
        }
        return false;
    }

    function spawn() {
        const text = pickWord();
        const w = wordWidth(text);
        const lo = 18;
        const hi = W - 18 - w;
        let x = lo + Math.random() * Math.max(1, hi - lo);
        // 尽量避免刚生成的两个词横向重叠
        for (let k = 0; k < 6; k++) {
            let bad = false;
            for (let i = 0; i < words.length; i++) {
                const o = words[i];
                if (o.y > 150) continue;
                if (x < o.x + o.w + 8 && x + w + 8 > o.x) {
                    bad = true;
                    break;
                }
            }
            if (!bad) break;
            x = lo + Math.random() * Math.max(1, hi - lo);
        }
        if (Math.abs(x - lastSpawnX) < 40) x = clamp(x + 60, lo, hi);
        lastSpawnX = x;

        words.push({
            text: text,
            x: x,
            y: PLAY_TOP - 34,
            vy: 46 + level * 5 + Math.random() * 8,
            w: w,
            hit: false
        });
    }

    /* ---------- 规则 ---------- */
    function burst(x, y, color) {
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 30 + Math.random() * 90;
            fx.push({
                x: x, y: y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 20,
                life: 0.5,
                max: 0.5,
                color: color
            });
        }
    }

    function destroy(w) {
        const idx = words.indexOf(w);
        if (idx >= 0) words.splice(idx, 1);
        if (locked === w) locked = null;

        const mult = Math.min(3, 1 + combo * 0.1);
        score += Math.round((30 + w.text.length * 10) * mult);
        combo++;
        if (combo > bestCombo) bestCombo = combo;
        cleared++;
        typed = '';
        burst(w.x + w.w / 2, w.y, '#8dffc4');

        const nextLevel = 1 + Math.floor(cleared / 8);
        if (nextLevel !== level) {
            level = nextLevel;
            burst(W / 2, 300, '#ffd166');
        }
        hudCache = '';
        updateHud();
    }

    function miss(w) {
        const idx = words.indexOf(w);
        if (idx >= 0) words.splice(idx, 1);
        if (locked === w) {
            locked = null;
            typed = '';
        }
        lives--;
        combo = 0;
        shake = 0.36;
        missFlash = 0.4;
        burst(w.x + w.w / 2, DANGER_Y, '#ff7a7a');
        hudCache = '';
        updateHud();
        if (lives <= 0) gameOver();
    }

    function gameOver() {
        state = 'over';
        words = [];
        typed = '';
        locked = null;
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        banner = {
            t: 0,
            title: '打字结束',
            sub: '得分 ' + score + ' · 打掉 ' + cleared + ' 个 · 最高连击 x' + bestCombo,
            note: score > best ? '新纪录' : '最高分 ' + best + ' · 按 R 再来一局'
        };
        hudCache = '';
        updateHud();
    }

    /* ---------- 输入 ---------- */
    function press(ch) {
        if (state !== 'playing') return;
        const next = typed + ch;

        let cand = null;
        if (locked && locked.text.indexOf(next) === 0) cand = locked;
        if (!cand) {
            locked = null;
            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                if (w.text.indexOf(next) === 0) {
                    if (!cand || w.y > cand.y) cand = w;
                }
            }
        }

        if (!cand) {
            // 打错字符：清空输入；若本在拼一个词则连击中断
            if (typed.length > 0) combo = 0;
            typed = '';
            locked = null;
            shake = 0.18;
            missFlash = 0.3;
            hudCache = '';
            return;
        }

        typed = next;
        locked = cand;
        cand.hit = true;
        if (typed === cand.text) destroy(cand);
    }

    window.addEventListener('keydown', function (e) {
        if (e.code === 'KeyR') {
            e.preventDefault();
            startGame();
            return;
        }
        if (state === 'ready') {
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                startGame();
            }
            return;
        }
        if (state === 'over') {
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                startGame();
            }
            return;
        }
        if (e.code === 'Backspace') {
            e.preventDefault();
            typed = '';
            locked = null;
            return;
        }
        if (e.code === 'Escape') {
            e.preventDefault();
            typed = '';
            locked = null;
            return;
        }
        if (e.key && /^[a-zA-Z]$/.test(e.key)) {
            e.preventDefault();
            press(e.key.toLowerCase());
        }
    });

    els.ovBtn.addEventListener('click', startGame);
    els.restartBtn.addEventListener('click', startGame);

    /* ---------- 逻辑 ---------- */
    function step(dt) {
        if (state !== 'playing') {
            for (let i = fx.length - 1; i >= 0; i--) {
                const p = fx[i];
                p.life -= dt;
                if (p.life <= 0) fx.splice(i, 1);
                else {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.vy += 220 * dt;
                }
            }
            if (banner) banner.t += dt;
            return;
        }

        spawnT -= dt;
        if (spawnT <= 0) {
            spawn();
            spawnT = Math.max(0.8, 1.65 - level * 0.08);
        }

        for (let i = words.length - 1; i >= 0; i--) {
            const w = words[i];
            w.y += w.vy * dt;
            if (w.y >= DANGER_Y) {
                miss(w);
                if (state !== 'playing') break;
            }
        }

        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= dt;
            if (p.life <= 0) fx.splice(i, 1);
            else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 220 * dt;
            }
        }

        if (shake > 0) shake -= dt;
        if (missFlash > 0) missFlash -= dt;
        if (banner) banner.t += dt;
        if (state === 'playing') updateHud();
    }

    /* ---------- 绘制 ---------- */
    function drawBg() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#08131c');
        g.addColorStop(0.55, '#050c13');
        g.addColorStop(1, '#02060a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.strokeStyle = 'rgba(90, 210, 255, .05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, PLAY_TOP);
            ctx.lineTo(x, DANGER_Y);
            ctx.stroke();
        }
        for (let y = PLAY_TOP; y <= DANGER_Y; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        ctx.restore();

        const halo = ctx.createRadialGradient(W / 2, DANGER_Y, 20, W / 2, DANGER_Y, 300);
        halo.addColorStop(0, 'rgba(90, 220, 255, .10)');
        halo.addColorStop(1, 'rgba(90, 220, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        const vg = ctx.createRadialGradient(W / 2, H / 2, 190, W / 2, H / 2, 430);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, .55)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawHeader() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(110, 220, 255, .5)';
        ctx.font = '700 10px ' + FONT;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('TYPING', W / 2, 22);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 21px ' + FONT;
        ctx.fillText('打字狂潮', W / 2, 46);

        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(150, 200, 225, .55)';
        ctx.fillText('等级 ' + level + ' · 已打掉 ' + cleared + ' 个 · 连击 x' + combo, W / 2, 70);
        ctx.restore();
    }

    function drawWord(w) {
        const x = w.x;
        const y = w.y - PILL_H / 2;
        const isLock = w === locked;
        const danger = w.y > DANGER_Y - 90;

        ctx.save();
        if (isLock) {
            ctx.shadowColor = 'rgba(255, 209, 102, .55)';
            ctx.shadowBlur = 16;
        } else if (danger) {
            ctx.shadowColor = 'rgba(255, 110, 110, .45)';
            ctx.shadowBlur = 12;
        } else {
            ctx.shadowColor = 'rgba(0, 0, 0, .45)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;
        }
        roundRectPath(ctx, x, y, w.w, PILL_H, PILL_H / 2);
        ctx.fillStyle = isLock ? 'rgba(46, 38, 18, .92)' : 'rgba(11, 30, 42, .92)';
        ctx.fill();
        ctx.restore();

        roundRectPath(ctx, x + 0.5, y + 0.5, w.w - 1, PILL_H - 1, PILL_H / 2);
        ctx.strokeStyle = isLock ? 'rgba(255, 209, 102, .92)'
            : (danger ? 'rgba(255, 120, 120, .6)' : 'rgba(96, 206, 245, .34)');
        ctx.lineWidth = isLock ? 1.8 : 1.1;
        ctx.stroke();

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = '700 19px ' + MONO;
        const tx = x + PILL_PAD;
        const ty = w.y + 1;

        if (isLock && typed.length) {
            const pre = w.text.slice(0, typed.length);
            const rest = w.text.slice(typed.length);
            const pw = ctx.measureText(pre).width;
            ctx.fillStyle = '#8dffc4';
            ctx.fillText(pre, tx, ty);
            ctx.fillStyle = '#ffd166';
            ctx.fillText(rest, tx + pw, ty);
        } else {
            ctx.fillStyle = danger ? '#ffb8b8' : '#dcf1ff';
            ctx.fillText(w.text, tx, ty);
        }
        ctx.restore();

        if (isLock) {
            const k = typed.length / w.text.length;
            const bw = (w.w - PILL_PAD * 2) * k;
            ctx.beginPath();
            ctx.moveTo(x + PILL_PAD, y + PILL_H + 4);
            ctx.lineTo(x + PILL_PAD + Math.max(2, bw), y + PILL_H + 4);
            ctx.strokeStyle = 'rgba(141, 255, 196, .75)';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    function drawDangerLine() {
        ctx.save();
        const flash = Math.max(0, missFlash);
        ctx.setLineDash([7, 7]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = flash > 0
            ? 'rgba(255, 110, 110, .9)'
            : 'rgba(255, 110, 110, .34)';
        ctx.beginPath();
        ctx.moveTo(16, DANGER_Y);
        ctx.lineTo(W - 16, DANGER_Y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = flash > 0 ? 'rgba(255, 130, 130, .95)' : 'rgba(255, 120, 120, .4)';
        ctx.fillText('警戒线', W - 18, DANGER_Y - 5);
        ctx.restore();
    }

    function drawDock() {
        const x = 24;
        const w = W - 48;
        const y = DOCK_Y;

        roundRectPath(ctx, x, y, w, DOCK_H, DOCK_H / 2);
        ctx.fillStyle = 'rgba(8, 20, 28, .92)';
        ctx.fill();
        ctx.strokeStyle = missFlash > 0.15 ? 'rgba(255, 120, 120, .8)' : 'rgba(96, 206, 245, .28)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '700 18px ' + MONO;
        const cy = y + DOCK_H / 2 + 1;
        if (typed) {
            ctx.fillStyle = '#8dffc4';
            ctx.fillText(typed, x + 18, cy);
        } else {
            ctx.fillStyle = 'rgba(140, 175, 195, .38)';
            ctx.font = '700 12px ' + FONT;
            ctx.fillText('键入下落的单词…', x + 18, cy);
        }
        ctx.restore();

        // 光标
        const caretOn = Math.floor(caret * 2) % 2 === 0;
        if (caretOn) {
            ctx.save();
            ctx.font = '700 18px ' + MONO;
            const tw = typed ? ctx.measureText(typed).width : 0;
            const cx = x + 18 + tw + 2;
            ctx.strokeStyle = 'rgba(141, 255, 196, .85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 9);
            ctx.lineTo(cx, cy + 9);
            ctx.stroke();
            ctx.restore();
        }

        // 右侧剩余生命
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const px = x + w - 22 - i * 18;
            ctx.beginPath();
            ctx.arc(px, y + DOCK_H / 2, 5, 0, Math.PI * 2);
            if (i < lives) {
                ctx.fillStyle = '#ff7a7a';
                ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(255, 122, 122, .3)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function drawFx() {
        for (let i = 0; i < fx.length; i++) {
            const p = fx[i];
            const k = p.life / p.max;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.6 * k + 0.7, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.35 + 0.55 * k;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function drawBanner() {
        if (!banner) return;
        const k = Math.min(1, banner.t / 0.28);
        const ease = 1 - Math.pow(1 - k, 3);
        const bw = 320;
        const bh = 118;
        const x = (W - bw) / 2;
        const y = 236 + (1 - ease) * 18;

        ctx.save();
        ctx.globalAlpha = ease;
        ctx.shadowColor = 'rgba(0, 0, 0, .6)';
        ctx.shadowBlur = 24;
        roundRectPath(ctx, x, y, bw, bh, 16);
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, 'rgba(20, 40, 54, .98)');
        g.addColorStop(1, 'rgba(6, 14, 20, .98)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;

        roundRectPath(ctx, x, y, bw, bh, 16);
        ctx.strokeStyle = 'rgba(96, 206, 245, .4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#8dffc4';
        ctx.font = '800 22px ' + FONT;
        ctx.fillText(banner.title, W / 2, y + 38);

        ctx.fillStyle = 'rgba(224, 244, 255, .84)';
        ctx.font = '700 13px ' + FONT;
        ctx.fillText(banner.sub, W / 2, y + 67);

        ctx.fillStyle = 'rgba(150, 200, 225, .6)';
        ctx.font = '700 11px ' + FONT;
        ctx.fillText(banner.note, W / 2, y + 92);
        ctx.restore();
    }

    function drawFooter() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 11px ' + FONT;
        ctx.fillStyle = 'rgba(140, 175, 195, .45)';
        ctx.fillText('直接敲键盘拼出单词 · Backspace 清空输入', W / 2, 578);
        ctx.restore();
    }

    function draw() {
        drawBg();
        drawHeader();

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, PLAY_TOP, W, DANGER_Y - PLAY_TOP + 4);
        ctx.clip();
        for (let i = 0; i < words.length; i++) drawWord(words[i]);

        // 顶部渐隐，让单词从标题下方淡入
        const fade = ctx.createLinearGradient(0, PLAY_TOP, 0, PLAY_TOP + 48);
        fade.addColorStop(0, 'rgba(7, 17, 25, 1)');
        fade.addColorStop(0.55, 'rgba(7, 17, 25, .62)');
        fade.addColorStop(1, 'rgba(7, 17, 25, 0)');
        ctx.fillStyle = fade;
        ctx.fillRect(0, PLAY_TOP, W, 48);
        ctx.restore();

        drawDangerLine();
        drawDock();
        drawFx();
        drawFooter();
        drawBanner();
    }

    /* ---------- 主循环 ---------- */
    let last = 0;

    function loop(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;

        caret += dt;
        step(dt);

        if (shake > 0) {
            const k = shake * 14;
            ctx.save();
            ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
            draw();
            ctx.restore();
        } else {
            draw();
        }
        requestAnimationFrame(loop);
    }

    reset();
    updateHud();
    requestAnimationFrame(loop);
})();
