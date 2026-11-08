/* ==========================================================
   猜词 Word Guess（五个字母 · 六次机会）
   ========================================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 600;
    const TAU = Math.PI * 2;
    const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const TS = 54;
    const GAP = 7;
    const BX = (W - (TS * 5 + GAP * 4)) / 2;
    const BY = 88;
    const ROWS = 6;
    const K_TOP = 458;
    const K_H = 34;
    const K_W = 40;
    const K_GAP = 4;

    const COL_HIT = '#3ecf8e';
    const COL_NEAR = '#e8b84b';
    const COL_MISS = '#26314a';

    const STREAK_KEY = 'webgames.wordle.streak';

    /* 答案词 + 中文释义 */
    const WORDS = [
        'apple|苹果', 'beach|海滩', 'brain|大脑', 'bread|面包', 'brick|砖块',
        'brush|刷子', 'candy|糖果', 'chair|椅子', 'chalk|粉笔', 'chess|国际象棋',
        'cloud|云朵', 'crane|起重机', 'cream|奶油', 'crown|王冠', 'dance|舞蹈',
        'dream|梦', 'dress|连衣裙', 'drink|饮料', 'eagle|鹰', 'earth|地球',
        'fence|栅栏', 'field|田野', 'flame|火焰', 'floor|地板', 'flute|长笛',
        'frost|霜', 'fruit|水果', 'ghost|幽灵', 'glass|玻璃杯', 'globe|地球仪',
        'grace|优雅', 'grape|葡萄', 'grass|草地', 'green|绿色', 'happy|快乐',
        'heart|心脏', 'honey|蜂蜜', 'horse|马', 'house|房子', 'ivory|象牙',
        'jelly|果冻', 'juice|果汁', 'knife|小刀', 'lemon|柠檬', 'light|光',
        'lucky|幸运', 'magic|魔法', 'maple|枫树', 'melon|甜瓜', 'money|钱',
        'month|月份', 'mouse|老鼠', 'music|音乐', 'night|夜晚', 'north|北方',
        'ocean|海洋', 'olive|橄榄', 'onion|洋葱', 'opera|歌剧', 'paint|颜料',
        'paper|纸', 'party|聚会', 'pasta|意面', 'peach|桃子', 'pearl|珍珠',
        'piano|钢琴', 'pilot|飞行员', 'pizza|披萨', 'plant|植物', 'plate|盘子',
        'point|分数', 'press|按下', 'pride|骄傲', 'prize|奖品', 'queen|女王',
        'quick|飞快', 'quiet|安静', 'radio|收音机', 'rainy|下雨的', 'rider|骑手',
        'river|河流', 'roast|烘烤', 'robot|机器人', 'rocky|多岩的', 'round|圆形',
        'royal|王室', 'salad|沙拉', 'scale|音阶', 'scarf|围巾', 'score|得分',
        'shark|鲨鱼', 'sheep|绵羊', 'shell|贝壳', 'shine|闪耀', 'shirt|衬衫',
        'shock|震惊', 'shore|海岸', 'skate|滑冰', 'skill|技能', 'skirt|裙子',
        'slope|斜坡', 'smile|微笑', 'smoke|烟', 'snake|蛇', 'solar|太阳的',
        'sound|声音', 'south|南方', 'spark|火花', 'spear|长矛', 'spice|香料',
        'spoon|勺子', 'sport|运动', 'spray|喷雾', 'stage|舞台', 'stamp|邮票',
        'start|开始', 'steam|蒸汽', 'steel|钢铁', 'stone|石头', 'storm|暴风雨',
        'story|故事', 'straw|吸管', 'sugar|糖', 'sushi|寿司', 'sweet|甜美的',
        'swing|秋千', 'sword|剑', 'table|桌子', 'tiger|老虎', 'toast|吐司',
        'tower|塔', 'track|跑道', 'train|火车', 'treat|款待', 'trend|潮流',
        'tribe|部落', 'tulip|郁金香', 'tutor|家教', 'twist|扭转', 'unity|团结',
        'urban|城市的', 'value|价值', 'vapor|蒸汽', 'vivid|生动', 'vocal|声乐',
        'voice|嗓音', 'waltz|华尔兹', 'water|水', 'whale|鲸鱼', 'wheat|小麦',
        'wheel|轮子', 'white|白色', 'world|世界', 'worth|值得', 'yacht|游艇',
        'young|年轻', 'zebra|斑马'
    ];

    /* 允许输入但不会作为答案的常用词 */
    const EXTRA = 'about above actor adapt adult after again agent agree ahead alarm album alert alike ' +
        'alive allow alone along alter among anger angle angry ankle apart apply arena argue arise armor ' +
        'aroma array arrow aside asset atlas audio audit avoid await awake award aware awful bacon badge ' +
        'baker basic basin batch beard beast begin being below bench berry birth black blade blame blank ' +
        'blast blaze bleed blend bless blind block blood bloom board boast bonus boost booth bound brake ' +
        'brand brass brave breed brief bring brisk broad broke brook brown build built bunch burst cabin ' +
        'cable camel canal canoe cargo carry carve catch cause chain charm chart chase cheap cheat check ' +
        'cheek cheer chest chief child chill choir chose chunk claim clash class clean clear clerk click ' +
        'cliff climb clock close cloth clown coach coast cocoa color comet comic coral couch cough count ' +
        'court cover crack craft crash crawl crazy creek crest crime crisp cross crowd crude cruel crush ' +
        'crust curve cycle daily dairy daisy dealt death debut decay delay delta dense depth devil diary ' +
        'dirty ditch dizzy dodge donor doubt dozen draft drain drama drank drawn dread drift drill drive ' +
        'drove drown drunk dryer dwarf eager early elbow elder elect elite email empty enemy enjoy enter ' +
        'entry equal error essay event every exact exist extra fable faint fairy faith false fancy fatal ' +
        'fault favor feast fiber fever fewer fifth fifty fight final first fixed fleet flesh float flock ' +
        'flood fluid flush focus foggy force forge forth forty forum found frame fraud fresh front frown ' +
        'froze fully funny giant given gland glare gleam glory glove going goods goose grade grain grand ' +
        'grant grasp grave great greed greet grief grill grind groan groom gross group grove grown guard ' +
        'guess guest guide harsh haste hatch haunt haven havoc heard heavy hedge hello hence hobby ' +
        'honor hotel hound humor hurry ideal image imply index inner input irony issue joint judge ' +
        'karma kneel knock known label labor large laser later laugh layer learn lease least leave legal ' +
        'level lever limit linen liver lobby local lodge logic loose lover lower loyal lunar lunch lying ' +
        'major maker mango march marsh match maybe mayor meant medal media mercy merge merit messy metal ' +
        'meter might minor minus mixed model moist moral motor mount mourn mouth movie muddy mummy mural ' +
        'naive nasty naval nerve never newly niche niece noble noise novel nurse oasis occur offer often ' +
        'onset orbit order organ other ought ounce outer owner oxide ozone panel panic patch pause peace ' +
        'pedal penny perch phase phone photo piece pitch pixel place plain plane plaza plead pluck polar ' +
        'porch pound power price prime print prior probe prone proof proud prove prune pulse punch pupil ' +
        'puppy purse query quest queue quilt quote radar raise rally ranch range rapid ratio reach react ' +
        'ready realm rebel refer reign relax relay renew repay reply reset resin retro ridge rifle right ' +
        'rigid rinse risky rival robin rogue roman rough route rugby ruler rumor rural rusty salon sandy ' +
        'sauce scene scent scope scout scrap screw scrub sedan seize sense serve setup seven shade shaft ' +
        'shake shall shape share sharp shave sheet shelf shift shiny shoot short shout shown shrug sight ' +
        'silly since siren sixth sixty slate slave sleep slice slide small smart smash smell snack sneak ' +
        'solid solve sorry space spare speak speed spell spend spent spike spill spine spite split spoke ' +
        'squad stack staff stake stall stare state steak steal steep steer stern stick stiff still sting ' +
        'stock stole stood stool store stove strap stray strip stuck study stuff stump style suite sunny ' +
        'super surge swamp swarm swear sweat sweep swift taken tally taste teach tempo tenor tense tenth ' +
        'thank theft their theme there these thick thief thigh thing think third thorn those three threw ' +
        'throw thumb tight timer tired title today token tooth topic torch total touch tough towel toxic ' +
        'trace trade trail trait trash tread trial trick tried troop trout truck truly trunk trust truth ' +
        'twice ultra uncle under union until upper upset usage usual utter vague valid valve vault venue ' +
        'verse video vigor villa vinyl viral virus visit vital voter wagon waist waste watch weary weave ' +
        'wedge weigh weird where which while whole whose widow width witch woman worry worse worst would ' +
        'wound wrist write wrong yield youth';

    const ANSWERS = WORDS.map(function (s) {
        const p = s.split('|');
        return { w: p[0], cn: p[1] };
    });

    const ALLOWED = {};
    ANSWERS.forEach(function (a) { ALLOWED[a.w] = true; });
    EXTRA.split(/\s+/).forEach(function (w) {
        if (/^[a-z]{5}$/.test(w)) ALLOWED[w] = true;
    });

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
        tries: document.getElementById('tries'),
        best: document.getElementById('best'),
        left: document.getElementById('left'),
        overlay: document.getElementById('overlay'),
        ovTitle: document.getElementById('ov-title'),
        ovDesc: document.getElementById('ov-desc'),
        ovScore: document.getElementById('ov-score'),
        ovScoreVal: document.getElementById('ov-score-val'),
        ovBtn: document.getElementById('ov-btn'),
        ovRestart: document.getElementById('ov-restart'),
        restartBtn: document.getElementById('restart-btn')
    };

    /* ---------- 键盘布局 ---------- */

    const KEY_ROWS = [
        { y: K_TOP, letters: 'QWERTYUIOP' },
        { y: K_TOP + K_H + 4, letters: 'ASDFGHJKL' }
    ];

    const keys = [];
    (function layoutKeys() {
        /* 第一、二排字母 */
        KEY_ROWS.forEach(function (row) {
            const n = row.letters.length;
            const total = n * K_W + (n - 1) * K_GAP;
            let x = (W - total) / 2;
            for (let i = 0; i < n; i++) {
                keys.push({ label: row.letters[i], x: x, y: row.y, w: K_W, h: K_H, kind: 'letter' });
                x += K_W + K_GAP;
            }
        });
        /* 第三排：回车 + ZXCVBNM + 退格 */
        const y3 = K_TOP + (K_H + 4) * 2;
        const wide = 62;
        const midW = 7 * K_W + 6 * K_GAP;
        let x3 = (W - (wide + K_GAP + midW + K_GAP + wide)) / 2;
        keys.push({ label: '回车', x: x3, y: y3, w: wide, h: K_H, kind: 'enter' });
        x3 += wide + K_GAP;
        const third = 'ZXCVBNM';
        for (let i = 0; i < third.length; i++) {
            keys.push({ label: third[i], x: x3, y: y3, w: K_W, h: K_H, kind: 'letter' });
            x3 += K_W + K_GAP;
        }
        keys.push({ label: '退格', x: x3, y: y3, w: wide, h: K_H, kind: 'back' });
    })();

    /* ---------- 状态 ---------- */

    let state = 'ready';     // ready | playing | won | lost
    let answer = ANSWERS[0];
    let guesses = [];        // [{ word, res:[0|1|2], at }]
    let current = '';
    let letters = {};        // 字母 → 0 / 1 / 2
    let streak = Number(localStorage.getItem(STREAK_KEY) || 0);
    let elapsed = 0;
    let shakeT = 0;
    let toast = null;
    let finishAt = -1;
    let hudCache = '';
    let shownSec = -1;

    function statusText() {
        if (state === 'ready') return '等待开始';
        if (state === 'won') return '猜中了';
        if (state === 'lost') return '没猜中';
        return '猜词中';
    }

    function updateHud() {
        const key = state + '|' + guesses.length + '|' + streak;
        if (key === hudCache) return;
        hudCache = key;
        els.status.textContent = statusText();
        els.tries.textContent = Math.min(guesses.length, ROWS) + ' / ' + ROWS;
        els.best.textContent = String(streak);
        els.left.textContent = Object.keys(ALLOWED).length + ' 词';
        els.restartBtn.textContent = state === 'playing' ? '换一个词' : '再来一题';
    }

    function pickAnswer() {
        let idx = Math.floor(Math.random() * ANSWERS.length);
        for (let guard = 0; guard < 12 && ANSWERS[idx].w === answer.w; guard++) {
            idx = Math.floor(Math.random() * ANSWERS.length);
        }
        answer = ANSWERS[idx];
    }

    function begin() {
        pickAnswer();
        guesses = [];
        current = '';
        letters = {};
        streak = Number(localStorage.getItem(STREAK_KEY) || 0);
        shakeT = 0;
        toast = null;
        finishAt = -1;
        state = 'playing';
        hudCache = '';
        updateHud();
        els.overlay.classList.remove('show');
    }

    /* ---------- 判定 ---------- */

    function evaluate(word) {
        const res = [0, 0, 0, 0, 0];
        const pool = {};
        for (let i = 0; i < 5; i++) {
            if (word[i] === answer.w[i]) res[i] = 2;
            else pool[answer.w[i]] = (pool[answer.w[i]] || 0) + 1;
        }
        for (let i = 0; i < 5; i++) {
            if (res[i] === 2) continue;
            const ch = word[i];
            if (pool[ch]) {
                res[i] = 1;
                pool[ch]--;
            }
        }
        return res;
    }

    function submit() {
        if (state !== 'playing') return;
        if (current.length < 5) {
            toast = { text: '还差 ' + (5 - current.length) + ' 个字母', t: 1.6 };
            shakeT = 0.32;
            return;
        }
        if (!ALLOWED[current]) {
            toast = { text: '词库里没有 ' + current.toUpperCase(), t: 1.8 };
            shakeT = 0.32;
            return;
        }

        const res = evaluate(current);
        guesses.push({ word: current, res: res, at: elapsed });

        for (let i = 0; i < 5; i++) {
            const ch = current[i];
            const prev = letters[ch];
            const st = res[i];
            if (prev === undefined || st > prev) letters[ch] = st;
        }

        const guessed = current;
        current = '';
        hudCache = '';
        updateHud();

        if (guessed === answer.w) {
            state = 'won';
            streak += 1;
            localStorage.setItem(STREAK_KEY, String(streak));
            finishAt = elapsed + 0.85;
        } else if (guesses.length >= ROWS) {
            state = 'lost';
            streak = 0;
            localStorage.setItem(STREAK_KEY, '0');
            finishAt = elapsed + 0.85;
        }
    }

    function showResult() {
        finishAt = -1;
        els.ovTitle.textContent = state === 'won' ? '猜中了' : '没猜中';
        els.ovTitle.classList.toggle('danger', state === 'lost');
        els.ovDesc.textContent = (state === 'won'
            ? '第 ' + guesses.length + ' 次就猜到了 '
            : '答案是 ') +
            answer.w.toUpperCase() + ' · ' + answer.cn +
            (state === 'won' ? '，当前连胜 ' + streak + ' 局。' : '，连胜已清零，再来一题？');
        els.ovScore.hidden = state !== 'won';
        els.ovScoreVal.textContent = String(streak);
        els.ovBtn.hidden = true;
        els.ovRestart.hidden = false;
        els.ovRestart.textContent = '再来一题';
        els.overlay.classList.add('show');
        hudCache = '';
        updateHud();
    }

    /* ---------- 输入 ---------- */

    function typeLetter(ch) {
        if (state !== 'playing') return;
        if (current.length >= 5) return;
        current += ch.toLowerCase();
    }

    function backspace() {
        if (state !== 'playing') return;
        current = current.slice(0, -1);
    }

    window.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            if (state === 'playing') submit();
            else if (state !== 'ready') begin();
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            backspace();
            return;
        }
        if (/^[a-zA-Z]$/.test(e.key)) {
            e.preventDefault();
            typeLetter(e.key);
        }
    });

    canvas.addEventListener('pointerdown', function (e) {
        if (state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) {
                e.preventDefault();
                if (k.kind === 'enter') submit();
                else if (k.kind === 'back') backspace();
                else typeLetter(k.label);
                return;
            }
        }
    });

    canvas.addEventListener('pointermove', function (e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        let over = false;
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) { over = true; break; }
        }
        canvas.style.cursor = (over && state === 'playing') ? 'pointer' : 'default';
    });

    els.ovBtn.addEventListener('click', begin);
    els.ovRestart.addEventListener('click', begin);
    els.restartBtn.addEventListener('click', begin);

    /* ---------- 渲染 ---------- */

    function drawHeader() {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6f6ff';
        ctx.font = '800 20px ' + FONT;
        ctx.fillText('猜词', 24, 36);

        ctx.fillStyle = 'rgba(150, 190, 220, .75)';
        ctx.font = '600 11px ' + FONT;
        ctx.fillText('五个字母 · 六次机会 · 猜中即胜', 24, 58);

        /* 右侧连胜 */
        const cw = 76;
        const cx = W - 24 - cw;
        ctx.fillStyle = 'rgba(255, 209, 102, .12)';
        roundRectPath(ctx, cx, 26, cw, 26, 13);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 209, 102, .35)';
        ctx.lineWidth = 1;
        roundRectPath(ctx, cx, 26, cw, 26, 13);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd166';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText('连胜 ' + streak, cx + cw / 2, 40);
    }

    const TILE_COL = ['#26314a', COL_NEAR, COL_HIT];

    function drawTile(x, y, ch, st, borderCol, scaleY) {
        const cx = x + TS / 2;
        const cy = y + TS / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, Math.max(0.04, scaleY));
        if (st >= 0) {
            ctx.fillStyle = TILE_COL[st];
            roundRectPath(ctx, -TS / 2, -TS / 2, TS, TS, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, .12)';
        } else {
            ctx.fillStyle = 'rgba(16, 26, 42, .72)';
            roundRectPath(ctx, -TS / 2, -TS / 2, TS, TS, 6);
            ctx.fill();
            ctx.strokeStyle = borderCol;
        }
        ctx.lineWidth = 1.6;
        roundRectPath(ctx, -TS / 2 + 0.8, -TS / 2 + 0.8, TS - 1.6, TS - 1.6, 6);
        ctx.stroke();

        if (ch) {
            ctx.fillStyle = st >= 0 ? '#07131f' : '#eaf6ff';
            ctx.font = '800 25px ' + MONO;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ch.toUpperCase(), 0, 1);
        }
        ctx.restore();
    }

    function drawBoard() {
        const shakeX = shakeT > 0 ? Math.sin(shakeT * 90) * 6 * (shakeT / 0.32) : 0;

        for (let r = 0; r < ROWS; r++) {
            const g = guesses[r];
            for (let i = 0; i < 5; i++) {
                const x = BX + i * (TS + GAP) + shakeX;
                const y = BY + r * (TS + GAP);
                if (g) {
                    const p = clamp((elapsed - g.at - i * 0.085) / 0.22, 0, 1);
                    const flip = Math.abs(Math.cos(Math.PI * p));
                    const st = p >= 0.5 ? g.res[i] : -1;
                    drawTile(x, y, g.word[i], st, 'rgba(255, 255, 255, .14)', flip);
                } else {
                    const isCur = r === guesses.length && state === 'playing';
                    const ch = isCur ? (current[i] || '') : '';
                    const border = isCur && ch
                        ? 'rgba(160, 220, 255, .55)'
                        : (isCur ? 'rgba(95, 216, 255, .28)' : 'rgba(120, 160, 200, .16)');
                    drawTile(x, y, ch, -1, border, 1);
                }
            }
        }

        if (toast) {
            const a = Math.min(1, toast.t * 2.2);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.font = '700 12px ' + FONT;
            const tw = ctx.measureText(toast.text).width + 30;
            const tx = (W - tw) / 2;
            const ty = BY + (TS + GAP) * 2.5 - 16;
            ctx.fillStyle = 'rgba(8, 16, 28, .92)';
            roundRectPath(ctx, tx, ty, tw, 30, 15);
            ctx.fill();
            ctx.strokeStyle = 'rgba(232, 184, 75, .45)';
            ctx.lineWidth = 1;
            roundRectPath(ctx, tx, ty, tw, 30, 15);
            ctx.stroke();
            ctx.fillStyle = '#ffe6a8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(toast.text, W / 2, ty + 15);
            ctx.restore();
        }
    }

    function keyFill(k) {
        if (k.kind !== 'letter') return 'rgba(58, 76, 106, .85)';
        const st = letters[k.label.toLowerCase()];
        if (st === 2) return COL_HIT;
        if (st === 1) return COL_NEAR;
        if (st === 0) return 'rgba(30, 40, 58, .9)';
        return 'rgba(58, 76, 106, .85)';
    }

    function drawKeyboard() {
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            ctx.fillStyle = keyFill(k);
            roundRectPath(ctx, k.x, k.y, k.w, k.h, 6);
            ctx.fill();

            if (k.kind === 'letter') {
                const st = letters[k.label.toLowerCase()];
                ctx.fillStyle = st >= 1 ? '#07131f' : '#dceaf7';
                ctx.font = '700 13px ' + FONT;
            } else {
                ctx.fillStyle = 'rgba(220, 234, 247, .9)';
                ctx.font = '700 11px ' + FONT;
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(k.label, k.x + k.w / 2, k.y + k.h / 2 + 0.5);
        }

        /* 图例：颜色含义 */
        const legend = [[COL_HIT, '位置对'], [COL_NEAR, '位置错'], [COL_MISS, '没这个字母']];
        let lx = 24;
        const ly = 74;
        for (let i = 0; i < legend.length; i++) {
            ctx.fillStyle = legend[i][0];
            roundRectPath(ctx, lx, ly - 4, 8, 8, 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(150, 190, 220, .8)';
            ctx.font = '600 10px ' + FONT;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(legend[i][1], lx + 12, ly);
            lx += 12 + ctx.measureText(legend[i][1]).width + 16;
        }
    }

    function render() {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#070d1a');
        bg.addColorStop(0.55, '#0b1424');
        bg.addColorStop(1, '#060c16');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const halo = ctx.createRadialGradient(W * 0.5, 250, 40, W * 0.5, 250, 340);
        halo.addColorStop(0, 'rgba(95, 216, 255, .09)');
        halo.addColorStop(1, 'rgba(95, 216, 255, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);

        drawHeader();
        drawBoard();
        drawKeyboard();
    }

    /* ---------- 主循环 ---------- */

    let last = 0;
    function frame(ts) {
        if (!last) last = ts;
        let dt = (ts - last) / 1000;
        last = ts;
        if (dt > 0.05) dt = 0.05;
        elapsed += dt;

        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
        if (toast) {
            toast.t -= dt;
            if (toast.t <= 0) toast = null;
        }
        if (finishAt > 0 && elapsed >= finishAt) showResult();

        const sec = Math.floor(elapsed);
        if (sec !== shownSec) {
            shownSec = sec;
            hudCache = '';
            updateHud();
        }

        render();
        requestAnimationFrame(frame);
    }

    answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    updateHud();
    requestAnimationFrame(frame);
})();
