/* ==========================================================
   游戏大厅：数据与渲染
   ========================================================== */

/**
 * 新增游戏只需往这个数组里追加一项，
 * 大厅会自动生成卡片，无需改动 HTML。
 */
const GAMES = [
    {
        id: 'tetris',
        title: '俄罗斯方块',
        tag: '益智',
        category: '益智',
        desc: '旋转、堆叠、消行。随着等级提升方块下落越来越快，考验你的空间感与手速。',
        controls: '方向键 / 空格',
        url: 'games/tetris/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1b2e4d 0%, #0d1524 70%)',
        glow: 'rgba(79, 140, 255, .38)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="18" y="7" width="12" height="12" rx="3" fill="#4f8cff"/>
                <rect x="30" y="7" width="12" height="12" rx="3" fill="#6ea8ff"/>
                <rect x="18" y="19" width="12" height="12" rx="3" fill="#9d5bff"/>
                <rect x="7" y="31" width="12" height="12" rx="3" fill="#2fd48b"/>
                <rect x="19" y="31" width="12" height="12" rx="3" fill="#27c07d"/>
                <rect x="31" y="31" width="12" height="12" rx="3" fill="#ffc548"/>
                <rect x="43" y="31" width="12" height="12" rx="3" fill="#ff8a5c"/>
                <rect x="19" y="43" width="12" height="12" rx="3" fill="#ff5c6c"/>
            </svg>`
    },
    {
        id: 'tank',
        title: '坦克大战',
        tag: '街机',
        category: '街机',
        desc: '驾驶坦克守护基地，击毁所有来袭敌军。砖墙可被炸毁，钢墙需要绕行。',
        controls: '方向键移动 / 空格开火',
        url: 'games/tank/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #123b2c 0%, #0b1a16 70%)',
        glow: 'rgba(47, 212, 139, .34)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="39" width="44" height="15" rx="6" fill="#2fd48b"/>
                <rect x="10" y="39" width="7" height="15" rx="3.5" fill="#0b1a16"/>
                <rect x="42" y="39" width="7" height="15" rx="3.5" fill="#0b1a16"/>
                <rect x="17" y="27" width="30" height="14" rx="5" fill="#27c07d"/>
                <rect x="29" y="9" width="6" height="20" rx="3" fill="#9fe9c6"/>
                <circle cx="32" cy="34" r="5" fill="#0b1a16"/>
                <circle cx="32" cy="34" r="2" fill="#9fe9c6"/>
            </svg>`
    },
    {
        id: 'snake',
        title: '贪吃蛇',
        tag: '休闲',
        category: '休闲',
        desc: '控制小蛇吃掉果实不断变长，撞到自己或墙壁就结束。越吃越快，能有多长？',
        controls: '方向键 / WASD',
        url: 'games/snake/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #14392a 0%, #0b1712 70%)',
        glow: 'rgba(47, 212, 139, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
                <path d="M12 50h11a6 6 0 0 0 6-6v-9a6 6 0 0 1 6-6h4"
                      stroke="#2fd48b" stroke-width="9" stroke-linecap="round"/>
                <circle cx="45" cy="25" r="9" fill="#3ee89b"/>
                <circle cx="48" cy="22" r="2" fill="#0b1712"/>
                <circle cx="13" cy="17" r="5" fill="#ff5c6c"/>
                <path d="M13 12c2-3 5-3 6-1" stroke="#2fd48b" stroke-width="3" stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'game2048',
        title: '2048',
        tag: '益智',
        category: '益智',
        desc: '滑动方块，让相同数字合并成更大的数字。冷静规划每一步，向 2048 发起冲击。',
        controls: '方向键 / 滑动屏幕',
        url: 'games/game2048/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #3a2f1a 0%, #171208 70%)',
        glow: 'rgba(255, 197, 72, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="26" height="26" rx="6" fill="#2b3a52"/>
                <rect x="34" y="4" width="26" height="26" rx="6" fill="#3d5580"/>
                <rect x="4" y="34" width="26" height="26" rx="6" fill="#4f8cff"/>
                <rect x="34" y="34" width="26" height="26" rx="6" fill="#ffc548"/>
                <text x="17" y="23" font-size="16" font-weight="700" fill="#c9d8ee"
                      text-anchor="middle" font-family="Helvetica, Arial, sans-serif">2</text>
                <text x="47" y="23" font-size="16" font-weight="700" fill="#e8eef8"
                      text-anchor="middle" font-family="Helvetica, Arial, sans-serif">4</text>
                <text x="17" y="53" font-size="16" font-weight="700" fill="#ffffff"
                      text-anchor="middle" font-family="Helvetica, Arial, sans-serif">8</text>
                <text x="47" y="53" font-size="14" font-weight="700" fill="#20180a"
                      text-anchor="middle" font-family="Helvetica, Arial, sans-serif">16</text>
            </svg>`
    },
    {
        id: 'breakout',
        title: '打砖块',
        tag: '街机',
        category: '街机',
        desc: '用挡板反弹小球击碎所有砖块。接住掉落的道具，挑战更高关卡与更快球速。',
        controls: '左右键 / 鼠标',
        url: 'games/breakout/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a1b3d 0%, #150f22 70%)',
        glow: 'rgba(157, 91, 255, .34)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="15" height="8" rx="3" fill="#ff5c6c"/>
                <rect x="24" y="8" width="15" height="8" rx="3" fill="#ffc548"/>
                <rect x="42" y="8" width="15" height="8" rx="3" fill="#2fd48b"/>
                <rect x="6" y="20" width="15" height="8" rx="3" fill="#4f8cff"/>
                <rect x="24" y="20" width="15" height="8" rx="3" fill="#9d5bff"/>
                <rect x="42" y="20" width="15" height="8" rx="3" fill="#ff8a5c"/>
                <circle cx="43" cy="40" r="4.5" fill="#e8eef8"/>
                <rect x="18" y="50" width="28" height="7" rx="3.5" fill="#4f8cff"/>
            </svg>`
    },
    {
        id: 'minesweeper',
        title: '扫雷',
        tag: '益智',
        category: '益智',
        desc: '数字提示周围的地雷数量，翻开全部安全格即可通关。三档难度，考验推理与耐心。',
        controls: '左键翻开 / 右键插旗',
        url: 'games/minesweeper/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a2036 0%, #120e1c 70%)',
        glow: 'rgba(255, 92, 108, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
                <path d="M26 17v-7M26 56v-7M9 33H2M50 33h-7M14 21l-5-5M43 50l-5-5M38 21l5-5M9 50l5-5"
                      stroke="#ff5c6c" stroke-width="3" stroke-linecap="round"/>
                <circle cx="26" cy="33" r="12" fill="#3a4a64" stroke="#ff5c6c" stroke-width="2.5"/>
                <circle cx="22" cy="29" r="3.5" fill="#ff8a95" opacity=".8"/>
                <path d="M46 18v31" stroke="#c9d8ee" stroke-width="3" stroke-linecap="round"/>
                <path d="M47 19l12 5-12 5z" fill="#2fd48b"/>
            </svg>`
    },
    {
        id: 'memory',
        title: '记忆翻牌',
        tag: '休闲',
        category: '休闲',
        desc: '翻开两张卡片寻找相同图案，记住每个图案的位置，用最少的步数完成全部配对。',
        controls: '点击翻牌',
        url: 'games/memory/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2b1f42 0%, #130f20 70%)',
        glow: 'rgba(157, 91, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="14" width="24" height="35" rx="5" fill="#27364e"
                      stroke="#4f8cff" stroke-width="2" transform="rotate(-9 18 31)"/>
                <rect x="27" y="12" width="27" height="38" rx="5" fill="#1c2739"
                      stroke="#9d5bff" stroke-width="2"/>
                <path d="M40.5 41.5s-8.5-5.3-8.5-10.6a4.4 4.4 0 0 1 8.5-1.9 4.4 4.4 0 0 1 8.5 1.9c0 5.3-8.5 10.6-8.5 10.6z"
                      fill="#ff5c6c"/>
                <circle cx="18" cy="28" r="3.2" fill="#4f8cff" opacity=".75"/>
                <circle cx="18" cy="36" r="3.2" fill="#4f8cff" opacity=".4"/>
            </svg>`
    },
    {
        id: 'shooter',
        title: '太空射击',
        tag: '街机',
        category: '街机',
        desc: '飞船自动开火，左右移动躲开弹幕与敌机。拾取道具强化火力，看看能坚持到第几级。',
        controls: '左右键移动 / 自动开火',
        url: 'games/shooter/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #102840 0%, #071019 70%)',
        glow: 'rgba(90, 210, 255, .34)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 5l9 17 7 13-11-4h-10l-11 4 7-13z" fill="#4f8cff"/>
                <path d="M32 11l4 12v11h-8V23z" fill="#eaf6ff"/>
                <circle cx="32" cy="23" r="3" fill="#9ff0ff"/>
                <path d="M28 40h8l-4 13z" fill="#ff9f43"/>
                <circle cx="12" cy="12" r="2" fill="#dce9ff"/>
                <circle cx="53" cy="20" r="1.5" fill="#dce9ff" opacity=".8"/>
                <circle cx="48" cy="45" r="1.8" fill="#dce9ff" opacity=".6"/>
            </svg>`
    },
    {
        id: 'taxi',
        title: '车接人',
        tag: '街机',
        category: '街机',
        desc: '开车接上路边招手的乘客，送到头顶同色站点收车费。连续送达有加成，乘客等太久会生气走开。',
        controls: '左右键 / 拖动',
        url: 'games/taxi/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #3a2f14 0%, #171208 70%)',
        glow: 'rgba(255, 197, 72, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="30" width="52" height="20" rx="7" fill="#ffc548"/>
                <path d="M18 30l5-10h18l5 10z" fill="#ffd873"/>
                <rect x="22" y="23" width="9" height="7" rx="2" fill="#16202f"/>
                <rect x="34" y="23" width="9" height="7" rx="2" fill="#16202f"/>
                <rect x="27" y="16" width="10" height="5" rx="2" fill="#fff4c9"/>
                <circle cx="18" cy="52" r="5" fill="#16202f"/>
                <circle cx="46" cy="52" r="5" fill="#16202f"/>
                <rect x="8" y="38" width="6" height="4" rx="2" fill="#ffffff" opacity=".65"/>
                <rect x="50" y="38" width="6" height="4" rx="2" fill="#ff8a95"/>
            </svg>`
    },
    {
        id: 'sheep',
        title: '羊了个羊',
        tag: '休闲',
        category: '休闲',
        desc: '点击没有被压住的牌放进槽位，三张相同图案自动消除。层叠牌堆加上七格槽位，取舍之间就是胜负。',
        controls: '点击选牌',
        url: 'games/sheep/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1d3340 0%, #0c1519 70%)',
        glow: 'rgba(90, 210, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="7" y="18" width="24" height="32" rx="5" fill="#27364e"
                      stroke="#4f8cff" stroke-width="2" transform="rotate(-12 19 34)"/>
                <rect x="33" y="16" width="24" height="32" rx="5" fill="#2b3d55"
                      stroke="#5ad2ff" stroke-width="2" transform="rotate(11 45 32)"/>
                <circle cx="27" cy="28" r="7" fill="#eef4ff"/>
                <circle cx="37" cy="28" r="7" fill="#eef4ff"/>
                <circle cx="32" cy="24" r="7" fill="#eef4ff"/>
                <ellipse cx="32" cy="31" rx="7" ry="6" fill="#3b4a63"/>
                <circle cx="29.5" cy="29.6" r="1.4" fill="#ffffff"/>
                <circle cx="34.5" cy="29.6" r="1.4" fill="#ffffff"/>
            </svg>`
    },
    {
        id: 'sliding',
        title: '数字华容道',
        tag: '益智',
        category: '益智',
        desc: '滑动数字方块，把 1 到 N 按顺序还原，右下角留空。三档棋盘，用最少的步数完成排列。',
        controls: '方向键 / 点击',
        url: 'games/sliding/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #17303f 0%, #0a141c 70%)',
        glow: 'rgba(79, 140, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="9" fill="#132133"
                      stroke="#33455f" stroke-width="2"/>
                <rect x="11" y="11" width="13" height="13" rx="4" fill="#4f8cff"/>
                <rect x="26" y="11" width="13" height="13" rx="4" fill="#5ad2ff"/>
                <rect x="41" y="11" width="13" height="13" rx="4" fill="#2fd48b"/>
                <rect x="11" y="26" width="13" height="13" rx="4" fill="#3ad0e0"/>
                <rect x="26" y="26" width="13" height="13" rx="4" fill="#ffc548"/>
                <rect x="41" y="26" width="13" height="13" rx="4" fill="#ff9f43"/>
                <rect x="11" y="41" width="13" height="13" rx="4" fill="#9d5bff"/>
                <rect x="26" y="41" width="13" height="13" rx="4" fill="#ff5c6c"/>
            </svg>`
    },
    {
        id: 'whack',
        title: '打地鼠',
        tag: '休闲',
        category: '休闲',
        desc: '六十秒内敲中冒头的地鼠，连续命中提升倍率。小心带引线的炸弹鼠，敲错反而会扣分。',
        controls: '点击敲击',
        url: 'games/whack/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #14301f 0%, #0a1710 70%)',
        glow: 'rgba(47, 212, 139, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="32" cy="49" rx="25" ry="9" fill="#050a07"/>
                <ellipse cx="32" cy="49" rx="25" ry="9" fill="none" stroke="#2fd48b"
                         stroke-width="2" opacity=".38"/>
                <circle cx="20" cy="23" r="5" fill="#966f4b"/>
                <circle cx="44" cy="23" r="5" fill="#966f4b"/>
                <circle cx="32" cy="30" r="15" fill="#966f4b"/>
                <ellipse cx="32" cy="36" rx="9" ry="7" fill="#c19a71"/>
                <circle cx="27" cy="27" r="2.2" fill="#16202f"/>
                <circle cx="37" cy="27" r="2.2" fill="#16202f"/>
                <circle cx="32" cy="33" r="2" fill="#ff9fb0"/>
            </svg>`
    },
    {
        id: 'sokoban',
        title: '推箱子',
        tag: '益智',
        category: '益智',
        desc: '把木箱逐个推到圆点上，箱子只能推不能拉，推到墙角就再也动不了。六关递进，善用撤销寻找最优解。',
        controls: '方向键 / 滑动',
        url: 'games/sokoban/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a2418 0%, #141009 70%)',
        glow: 'rgba(201, 143, 87, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="9" fill="#1b2334"
                      stroke="#33455f" stroke-width="2"/>
                <circle cx="45" cy="45" r="7.5" fill="none" stroke="#ffc548" stroke-width="2.6"/>
                <circle cx="45" cy="45" r="2.4" fill="rgba(255,197,72,.5)"/>
                <rect x="13" y="13" width="26" height="26" rx="5" fill="#c98f57"/>
                <path d="M20 20l12 12M32 20L20 32" stroke="#6b4522" stroke-width="2.4"
                      stroke-linecap="round"/>
                <circle cx="22" cy="47" r="4.6" fill="#dbe9ff"/>
                <rect x="17" y="52" width="10" height="6" rx="3" fill="#4f8cff"/>
            </svg>`
    },
    {
        id: 'linkgame',
        title: '连连看',
        tag: '休闲',
        category: '休闲',
        desc: '点击两张相同图案，路径最多拐两个弯就能消除。八八六十四张牌，用最快的手速清空棋盘。',
        controls: '点击选牌',
        url: 'games/linkgame/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1f2a3d 0%, #0f1622 70%)',
        glow: 'rgba(90, 210, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="21" height="21" rx="6" fill="#ff5c6c"/>
                <rect x="37" y="6" width="21" height="21" rx="6" fill="#ffc548"/>
                <rect x="6" y="37" width="21" height="21" rx="6" fill="#2fd48b"/>
                <rect x="37" y="37" width="21" height="21" rx="6" fill="#4f8cff"/>
                <path d="M27 16h10M16 27v10M48 27v10M27 48h10" stroke="#5ad2ff"
                      stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".9"/>
            </svg>`
    },
    {
        id: 'flappy',
        title: '像素鸟',
        tag: '街机',
        category: '街机',
        desc: '点击拍动翅膀穿过管道，每过一根得一分。速度会越来越快，看你能飞多远。',
        controls: '点击 / 空格',
        url: 'games/flappy/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1a3348 0%, #0b1622 70%)',
        glow: 'rgba(47, 212, 139, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="44" y="4" width="13" height="26" rx="4" fill="#2fd48b"/>
                <rect x="42" y="26" width="17" height="7" rx="3" fill="#55ecb0"/>
                <rect x="44" y="45" width="13" height="15" rx="4" fill="#2fd48b"/>
                <rect x="42" y="45" width="17" height="7" rx="3" fill="#55ecb0"/>
                <circle cx="22" cy="30" r="12" fill="#ffd873"/>
                <ellipse cx="20" cy="35" rx="7" ry="5" fill="rgba(255,255,255,.4)"/>
                <ellipse cx="16" cy="27" rx="6.5" ry="4" fill="#ffe9a8"/>
                <circle cx="27" cy="25" r="4.6" fill="#ffffff"/>
                <circle cx="28.4" cy="25" r="2.1" fill="#16202f"/>
                <path d="M33 30l9 3-9 3z" fill="#ff9f43"/>
            </svg>`
    },
    {
        id: 'gomoku',
        title: '五子棋',
        tag: '益智',
        category: '益智',
        desc: '与电脑对弈，先连成五子获胜。三档难度可选，既能执黑先行，也能让电脑先开局。',
        controls: '点击落子',
        url: 'games/gomoku/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a2118 0%, #14100b 70%)',
        glow: 'rgba(214, 190, 150, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="56" height="56" rx="9" fill="#221a12"
                      stroke="#4a3a28" stroke-width="2"/>
                <path d="M18 6v52M32 6v52M46 6v52M6 18h52M6 32h52M6 46h52"
                      stroke="rgba(214,190,150,.26)" stroke-width="1.2"/>
                <circle cx="18" cy="18" r="6.6" fill="#0b0f15"/>
                <circle cx="32" cy="32" r="6.6" fill="#e7eff8"/>
                <circle cx="46" cy="46" r="6.6" fill="#0b0f15"/>
                <circle cx="46" cy="18" r="6.6" fill="#e7eff8" opacity=".55"/>
                <path d="M12 12l44 44" stroke="#5ad2ff" stroke-width="2"
                      stroke-linecap="round" opacity=".75"/>
            </svg>`
    },
    {
        id: 'match3',
        title: '三消宝石',
        tag: '休闲',
        category: '休闲',
        desc: '交换相邻的两颗宝石，凑齐三颗以上同色即可消除。连锁触发倍率加成，在步数耗尽前冲过目标分数。',
        controls: '点击 / 拖拽交换',
        url: 'games/match3/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1e2740 0%, #0d1220 70%)',
        glow: 'rgba(255, 92, 108, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="23" height="23" rx="7" fill="#ff5c6c"/>
                <rect x="35" y="6" width="23" height="23" rx="7" fill="#ffc548"/>
                <rect x="6" y="35" width="23" height="23" rx="7" fill="#4f8cff"/>
                <rect x="35" y="35" width="23" height="23" rx="7" fill="#2fd48b"/>
                <circle cx="17.5" cy="17.5" r="4.6" fill="rgba(255,255,255,.5)"/>
                <circle cx="46.5" cy="46.5" r="4.6" fill="rgba(255,255,255,.38)"/>
                <path d="M29 24h6M29 40h6" stroke="rgba(150,180,215,.45)" stroke-width="2"
                      stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'pong',
        title: '乒乓球',
        tag: '街机',
        category: '街机',
        desc: '左右挥拍接住来球，击球点决定反弹角度。球每回合都在加速，先拿到 7 分的一方获胜。',
        controls: '鼠标 / ↑ ↓',
        url: 'games/pong/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0d2b34 0%, #071219 70%)',
        glow: 'rgba(90, 210, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="19" width="7" height="26" rx="3.5" fill="#4f8cff"/>
                <rect x="52" y="19" width="7" height="26" rx="3.5" fill="#ff5c6c"/>
                <path d="M32 7v50" stroke="rgba(150,180,215,.32)" stroke-width="2"
                      stroke-dasharray="5 7"/>
                <circle cx="32" cy="32" r="7" fill="#eaf6ff"/>
                <circle cx="29.6" cy="29.6" r="2.4" fill="#9fe4ff"/>
            </svg>`
    },
    {
        id: 'maze',
        title: '迷宫逃亡',
        tag: '益智',
        category: '益智',
        desc: '从左上角走到右下角的出口，每局迷宫都会重新生成。善用路线提示，用最少的步数逃出去。',
        controls: '方向键 / 滑动',
        url: 'games/maze/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #16233d 0%, #0a1120 70%)',
        glow: 'rgba(79, 140, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
                <rect x="5" y="5" width="54" height="54" rx="9" fill="#101a2c"
                      stroke="#2a3d59" stroke-width="2"/>
                <path d="M17 9v20h15V17h15v16H32v11h15v8"
                      stroke="rgba(130,180,255,.72)" stroke-width="3" stroke-linecap="round"/>
                <circle cx="17" cy="41" r="4.6" fill="#5ad2ff"/>
                <circle cx="47" cy="52" r="4" fill="#2fd48b"/>
            </svg>`
    },
    {
        id: 'fruit',
        title: '切水果',
        tag: '街机',
        category: '街机',
        desc: '按住并划过抛起的水果把它切开，连续命中可以叠加连击。小心混在里面的炸弹，切中即结束。',
        controls: '按住滑动',
        url: 'games/fruit/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #102a24 0%, #08150f 70%)',
        glow: 'rgba(255, 138, 92, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 46a22 22 0 0 1 44 0z" fill="#2f9e58"/>
                <path d="M14 46a18 18 0 0 1 36 0z" fill="#ff5470"/>
                <circle cx="24" cy="40" r="2" fill="#3a1420" opacity="0.5"/>
                <circle cx="33" cy="35" r="2" fill="#3a1420" opacity="0.5"/>
                <circle cx="41" cy="41" r="2" fill="#3a1420" opacity="0.5"/>
                <path d="M9 14L55 50" stroke="#bff0ff" stroke-width="3"
                      stroke-linecap="round" opacity="0.85"/>
            </svg>`
    },
    {
        id: 'bubble',
        title: '泡泡龙',
        tag: '休闲',
        category: '休闲',
        desc: '瞄准发射，让三颗以上同色泡泡连成一片。打掉支撑后悬空的泡泡会整串掉落，别让泡泡压到红线。',
        controls: '鼠标 / 空格',
        url: 'games/bubble/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1a1f3d 0%, #0b0e1d 70%)',
        glow: 'rgba(157, 91, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="14" r="8" fill="#ff5c6c"/>
                <circle cx="32" cy="14" r="8" fill="#ffc548"/>
                <circle cx="48" cy="14" r="8" fill="#4f8cff"/>
                <circle cx="24" cy="29" r="8" fill="#ff5c6c"/>
                <circle cx="40" cy="29" r="8" fill="#2fd48b"/>
                <circle cx="16" cy="44" r="8" fill="#9d5bff"/>
                <circle cx="48" cy="44" r="8" fill="#ff5c6c"/>
                <path d="M32 62V52" stroke="#9dc4ff" stroke-width="4" stroke-linecap="round"/>
                <circle cx="32" cy="48" r="5" fill="#eaf6ff"/>
            </svg>`
    },
    {
        id: 'racer',
        title: '极速赛车',
        tag: '街机',
        category: '街机',
        desc: '自动加速的竞速跑道，左右变道躲避前方车流。每躲过一辆车加分，车速会随里程不断攀升。',
        controls: '← → / 点击半屏',
        url: 'games/racer/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a1620 0%, #110a10 70%)',
        glow: 'rgba(255, 92, 108, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 60L21 14h22l14 46z" fill="#1b2531" stroke="#2f3f52" stroke-width="1.4"/>
                <path d="M32 18v6M32 28v5" stroke="rgba(232,244,255,.40)"
                      stroke-width="2.8" stroke-linecap="round"/>
                <rect x="23" y="36" width="18" height="20" rx="4.5" fill="#ff5c6c"/>
                <rect x="26" y="39.5" width="12" height="5.5" rx="2" fill="#3a1c24" opacity=".6"/>
                <rect x="25.5" y="49" width="5" height="3.4" rx="1.4" fill="#ffd9dd" opacity=".85"/>
                <rect x="33.5" y="49" width="5" height="3.4" rx="1.4" fill="#ffd9dd" opacity=".85"/>
            </svg>`
    },
    {
        id: 'jump',
        title: '跳一跳',
        tag: '休闲',
        category: '休闲',
        desc: '按住蓄力、松开起跳，跳到下一个方块上。踩中中心触发连击加分，蓄力过头就直接跳空了。',
        controls: '按住 / 松开',
        url: 'games/jump/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #132a35 0%, #08161d 70%)',
        glow: 'rgba(47, 212, 139, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 34l12 6-12 6-12-6z" fill="#5f9dff"/>
                <path d="M8 40v8l12 6v-8z" fill="#2f4f80"/>
                <path d="M32 40v8l-12 6v-8z" fill="#3f6aad"/>
                <path d="M46 14l12 6-12 6-12-6z" fill="#2fd48b"/>
                <path d="M34 20v8l12 6v-8z" fill="#1c7a52"/>
                <path d="M58 20v8l-12 6v-8z" fill="#25a06c"/>
                <ellipse cx="20" cy="30" rx="6" ry="8" fill="#eaf6ff"/>
                <circle cx="20" cy="20" r="4.2" fill="#eaf6ff"/>
            </svg>`
    },
    {
        id: 'reversi',
        title: '黑白棋',
        tag: '益智',
        category: '益智',
        desc: '经典棋盘对弈，你执黑先行。夹住对方棋子就能把它翻成己方颜色，最后棋子多的一方获胜。',
        controls: '点击棋盘',
        url: 'games/reversi/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #17342a 0%, #08150f 70%)',
        glow: 'rgba(255, 197, 72, .26)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="52" height="52" rx="8" fill="#17553f"/>
                <path d="M6 32h52M32 6v52" stroke="rgba(6,20,16,.45)" stroke-width="1.5"/>
                <circle cx="19" cy="19" r="9" fill="#0a0f18"/>
                <circle cx="45" cy="19" r="9" fill="#eef4ff"/>
                <circle cx="19" cy="45" r="9" fill="#eef4ff"/>
                <circle cx="45" cy="45" r="9" fill="#0a0f18"/>
                <circle cx="41" cy="15" r="2.6" fill="#8fb7ff" opacity=".5"/>
            </svg>`
    },
    {
        id: 'sudoku',
        title: '数独',
        tag: '益智',
        category: '益智',
        desc: '每行每列每个九宫格里 1-9 各一次。题目唯一解，标出冲突与错误，卡住可以用提示。',
        controls: '点击 / 1-9',
        url: 'games/sudoku/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #12233a 0%, #08111c 70%)',
        glow: 'rgba(79, 140, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="52" height="52" rx="9" fill="#0d1726"/>
                <path d="M23.5 6v52M40.5 6v52M6 23.5h52M6 40.5h52"
                      stroke="rgba(120,170,235,.72)" stroke-width="2.2"/>
                <path d="M15 15h17M15 32h17M15 49h17M32 15v17M49 15v17"
                      stroke="rgba(120,170,235,.2)" stroke-width="1"/>
                <rect x="10" y="10" width="9" height="9" rx="2" fill="#5fa8ff" opacity=".9"/>
                <rect x="27" y="27" width="9" height="9" rx="2" fill="none"
                      stroke="#5fa8ff" stroke-width="2"/>
                <rect x="44" y="44" width="9" height="9" rx="2" fill="#5fa8ff" opacity=".9"/>
                <rect x="44" y="27" width="9" height="9" rx="2" fill="#ffc548" opacity=".72"/>
            </svg>`
    },
    {
        id: 'blackjack',
        title: '21 点',
        tag: '益智',
        category: '益智',
        desc: '抽牌让点数逼近 21 而不爆。A 可算 1 或 11，庄家到 17 必须停，还能加倍冲一把。',
        controls: 'H / S / D',
        url: 'games/blackjack/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0f2c24 0%, #07120e 70%)',
        glow: 'rgba(64, 200, 150, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <g transform="rotate(-10 26 32)">
                    <rect x="10" y="12" width="27" height="38" rx="5" fill="#1e3350"
                          stroke="#3f5b7e" stroke-width="1.4"/>
                    <path d="M15 19h17M15 43h17" stroke="rgba(150,190,240,.3)" stroke-width="1.2"/>
                    <path d="M23.5 24l4 6-4 6-4-6z" fill="rgba(150,190,240,.24)"/>
                </g>
                <g transform="rotate(9 40 32)">
                    <rect x="27" y="10" width="27" height="39" rx="5" fill="#f6faff"
                          stroke="#c9d8ea" stroke-width="1.2"/>
                    <text x="31" y="24" font-size="13" font-weight="800" fill="#d94a63"
                          font-family="-apple-system, sans-serif">A</text>
                    <path d="M40.5 36l5.5-7 5.5 7-5.5 6.5z" fill="#d94a63"/>
                </g>
                <ellipse cx="14" cy="53" rx="7" ry="4" fill="#5c8fd6"/>
                <ellipse cx="14" cy="49" rx="7" ry="4" fill="#7aa8e6"/>
            </svg>`
    },
    {
        id: 'golf',
        title: '迷你高尔夫',
        tag: '休闲',
        category: '休闲',
        desc: '按住球往后拉蓄力，松手击球。五个洞各有沙坑、水塘和墙，杆数越少越接近标准杆。',
        controls: '按住拖拽',
        url: 'games/golf/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #16382a 0%, #08150f 70%)',
        glow: 'rgba(126, 224, 169, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="32" cy="50" rx="26" ry="9" fill="#12402c"/>
                <ellipse cx="32" cy="49" rx="26" ry="8" fill="none"
                         stroke="rgba(160,235,190,.28)" stroke-width="1.4"/>
                <ellipse cx="38" cy="47" rx="8" ry="4.4" fill="#071009"/>
                <ellipse cx="38" cy="46" rx="8" ry="4.4" fill="none"
                         stroke="rgba(190,240,210,.35)" stroke-width="1.2"/>
                <path d="M38 46V12" stroke="#e4eefa" stroke-width="2.4" stroke-linecap="round"/>
                <path d="M39 13l15 5-15 5z" fill="#ff5c6c"/>
                <circle cx="17" cy="40" r="6" fill="#f4f9ff"/>
                <circle cx="15" cy="38" r="1.8" fill="#ffffff" opacity=".9"/>
            </svg>`
    },
    {
        id: 'frogger',
        title: '青蛙过河',
        tag: '街机',
        category: '街机',
        desc: '穿越车流，踩着木板和乌龟漂过河，把青蛙送进 5 个家。落水、被撞都掉一条命。',
        controls: '↑↓←→ / 滑动',
        url: 'games/frogger/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #102a3c 0%, #07131c 70%)',
        glow: 'rgba(94, 209, 126, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="6" width="58" height="19" rx="6" fill="#1b4d6b"/>
                <path d="M9 13q6-3 12 0t12 0 12 0" fill="none" stroke="rgba(180,225,255,.26)"
                      stroke-width="1.4"/>
                <rect x="8" y="9.5" width="20" height="12" rx="4" fill="#9a7245"/>
                <rect x="37" y="9.5" width="17" height="12" rx="4" fill="#8a6134"/>
                <rect x="3" y="29" width="58" height="17" rx="6" fill="#1d2430"/>
                <path d="M3 37.5h58" stroke="rgba(220,235,255,.16)" stroke-width="1.4"
                      stroke-dasharray="6 7"/>
                <rect x="9" y="31" width="16" height="11" rx="3" fill="#ff7a8a"/>
                <rect x="39" y="31" width="16" height="11" rx="3" fill="#ffd166"/>
                <ellipse cx="32" cy="54" rx="10.5" ry="6.5" fill="#5ed17e"/>
                <circle cx="26.5" cy="49" r="3.2" fill="#f6fcff"/>
                <circle cx="37.5" cy="49" r="3.2" fill="#f6fcff"/>
                <circle cx="26.5" cy="48.6" r="1.5" fill="#16261d"/>
                <circle cx="37.5" cy="48.6" r="1.5" fill="#16261d"/>
            </svg>`
    },
    {
        id: 'pacman',
        title: '吃豆人',
        tag: '街机',
        category: '街机',
        desc: '吃光迷宫里的所有豆子，躲开四只幽灵。吃到能量豆后可以反过来追着它们吃。',
        controls: '↑↓←→ / 滑动',
        url: 'games/pacman/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1a1d3a 0%, #080a16 70%)',
        glow: 'rgba(255, 211, 65, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 12h10M7 22h6M7 32h6M7 42h6M7 52h10" stroke="rgba(110,150,230,.42)"
                      stroke-width="2" stroke-linecap="round"/>
                <path d="M30 32L18 20A13.5 13.5 0 1 0 18 44Z" fill="#ffd341"/>
                <path d="M30 32L18 20A13.5 13.5 0 0 1 30 32Z" fill="#ffe888" opacity=".55"/>
                <circle cx="37" cy="32" r="2.1" fill="#ffe8b0"/>
                <circle cx="45" cy="32" r="2.1" fill="#ffe8b0"/>
                <path d="M47 27a7.6 7.6 0 0 1 13.6 2.4v11.8l-3.4-2.2-2.6 2.2-2.6-2.2-2.6 2.2-2.4-2.2z"
                      fill="#ff5f6d"/>
                <circle cx="51.4" cy="31.4" r="2.4" fill="#f7fbff"/>
                <circle cx="57" cy="31.4" r="2.4" fill="#f7fbff"/>
                <circle cx="52" cy="31.9" r="1.2" fill="#16203a"/>
                <circle cx="56.4" cy="31.9" r="1.2" fill="#16203a"/>
            </svg>`
    },
    {
        id: 'bomber',
        title: '炸弹人',
        tag: '街机',
        category: '街机',
        desc: '放下炸弹炸开砖墙，清光敌人后走进出口。火力与炸弹数会随道具提升，当心别炸到自己。',
        controls: '↑↓←→ + 空格',
        url: 'games/bomber/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a1a14 0%, #0b0806 70%)',
        glow: 'rgba(255, 138, 107, .26)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="23" height="23" rx="4" fill="#3b4552"/>
                <rect x="8.5" y="8.5" width="18" height="3.4" rx="1.6" fill="rgba(220,235,255,.16)"/>
                <rect x="6" y="35" width="23" height="23" rx="4" fill="#8a4a32"/>
                <path d="M6 43h23M6 51h23M14 35v23M22 35v23" stroke="rgba(50,22,12,.5)"
                      stroke-width="1.4"/>
                <circle cx="40" cy="34" r="12" fill="#232b36"/>
                <circle cx="35.6" cy="29.6" r="4.2" fill="rgba(255,255,255,.24)"/>
                <circle cx="40" cy="34" r="12" fill="none" stroke="rgba(12,18,26,.6)" stroke-width="1.2"/>
                <path d="M46.5 25q5.5-5.5 2.5-11" stroke="#8a6a42" stroke-width="2.2" fill="none" stroke-linecap="round"/>
                <circle cx="49" cy="13" r="3.2" fill="#ffd166"/>
                <circle cx="49" cy="13" r="1.5" fill="#fff6d8"/>
            </svg>`
    },
    {
        id: 'nonogram',
        title: '数织',
        tag: '益智',
        category: '益智',
        desc: '按行列边缘的数字提示涂黑格子，数字代表连续黑格的长度与顺序。全部提示变绿即过关。',
        controls: '点击 / 右键划线',
        url: 'games/nonogram/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #101f33 0%, #070d16 70%)',
        glow: 'rgba(95, 168, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M23 9v5M30 9v5M37 9v5M44 9v5" stroke="rgba(150,190,240,.55)" stroke-width="2"
                      stroke-linecap="round"/>
                <path d="M9 23h5M9 30h5M9 37h5M9 44h5" stroke="rgba(150,190,240,.4)" stroke-width="2"
                      stroke-linecap="round"/>
                <rect x="18" y="18" width="38" height="38" rx="4" fill="rgba(12,24,40,.9)"
                      stroke="rgba(120,168,232,.5)" stroke-width="1.2"/>
                <path d="M27.5 18v38M37 18v38M46.5 18v38M18 27.5h38M18 37h38M18 46.5h38"
                      stroke="rgba(110,145,190,.26)" stroke-width="1"/>
                <rect x="19.5" y="19.5" width="6.6" height="6.6" rx="1.6" fill="#5fa8ff"/>
                <rect x="29" y="19.5" width="6.6" height="6.6" rx="1.6" fill="#5fa8ff"/>
                <rect x="38.5" y="29" width="6.6" height="6.6" rx="1.6" fill="#5fa8ff"/>
                <rect x="19.5" y="38.5" width="6.6" height="6.6" rx="1.6" fill="#5fa8ff"/>
                <rect x="48" y="38.5" width="6.6" height="6.6" rx="1.6" fill="#5fa8ff"/>
                <rect x="38.5" y="48" width="6.6" height="6.6" rx="1.6" fill="#5fa8ff"/>
                <path d="M31 41l3 3 6-6" stroke="rgba(140,240,180,.9)" stroke-width="2" fill="none"
                      stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
    },
    {
        id: 'darts',
        title: '飞镖',
        tag: '休闲',
        category: '休闲',
        desc: '501 递减赛，三镖一轮。先定左右再定上下，最后一次必须落在双倍环或红心才算收镖。',
        controls: '两次点击定点',
        url: 'games/darts/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #14251a 0%, #080f0c 70%)',
        glow: 'rgba(216, 71, 79, .26)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="28" cy="34" r="21" fill="#e2e8ef"/>
                <circle cx="28" cy="34" r="21" fill="none" stroke="#d8474f" stroke-width="3.2"/>
                <circle cx="28" cy="34" r="12.6" fill="none" stroke="#2f9e68" stroke-width="2.8"/>
                <circle cx="28" cy="34" r="5" fill="#1f7a4f"/>
                <circle cx="28" cy="34" r="2.4" fill="#c22b3a"/>
                <path d="M28 13v42M7 34h42M13.5 19.5l29 29M42.5 19.5l-29 29"
                      stroke="rgba(8,14,22,.42)" stroke-width="1"/>
                <circle cx="28" cy="34" r="21" fill="none" stroke="rgba(8,14,22,.5)" stroke-width="1.4"/>
                <path d="M45 15l8-8" stroke="#cfdcea" stroke-width="2.4" stroke-linecap="round"/>
                <path d="M45 15l-1.6 4 4-1.6z" fill="#eef5ff"/>
                <path d="M49.5 8.5l5-2-1.5 5z" fill="#ff6b7a"/>
            </svg>`
    },
    {
        id: 'lightsout',
        title: '点灯',
        tag: '益智',
        category: '益智',
        desc: '点亮着的格子要全部熄灭，可每一次点击都会连带翻转上下左右。一次按错，整片灯阵重来。',
        controls: '点击 / 触摸',
        url: 'games/lightsout/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2c2010 0%, #0a0d14 70%)',
        glow: 'rgba(255, 199, 94, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="16" height="16" rx="5" fill="#ffc75e"/>
                <rect x="8" y="8" width="12" height="4" rx="2" fill="rgba(255,250,226,.5)"/>
                <rect x="24" y="6" width="16" height="16" rx="5" fill="#1d2e45"
                      stroke="rgba(96,134,182,.45)" stroke-width="1.2"/>
                <rect x="42" y="6" width="16" height="16" rx="5" fill="#1d2e45"
                      stroke="rgba(96,134,182,.45)" stroke-width="1.2"/>
                <rect x="6" y="24" width="16" height="16" rx="5" fill="#1d2e45"
                      stroke="rgba(96,134,182,.45)" stroke-width="1.2"/>
                <rect x="24" y="24" width="16" height="16" rx="5" fill="#ffc75e"/>
                <rect x="26" y="26" width="12" height="4" rx="2" fill="rgba(255,250,226,.5)"/>
                <rect x="42" y="24" width="16" height="16" rx="5" fill="#1d2e45"
                      stroke="rgba(96,134,182,.45)" stroke-width="1.2"/>
                <rect x="6" y="42" width="16" height="16" rx="5" fill="#ffc75e"/>
                <rect x="8" y="44" width="12" height="4" rx="2" fill="rgba(255,250,226,.5)"/>
                <rect x="24" y="42" width="16" height="16" rx="5" fill="#1d2e45"
                      stroke="rgba(96,134,182,.45)" stroke-width="1.2"/>
                <rect x="42" y="42" width="16" height="16" rx="5" fill="#1d2e45"
                      stroke="rgba(96,134,182,.45)" stroke-width="1.2"/>
            </svg>`
    },
    {
        id: 'battleship',
        title: '海战棋',
        tag: '益智',
        category: '益智',
        desc: '10 × 10 海域各藏五艘军舰，轮流开火直到一方全灭。命中后可继续追击，落空才换手。',
        controls: '点击方格开火',
        url: 'games/battleship/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0e2438 0%, #050b14 70%)',
        glow: 'rgba(96, 168, 236, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="11" width="54" height="42" rx="6" fill="rgba(10,24,42,.92)"
                      stroke="rgba(96,140,190,.55)" stroke-width="1.3"/>
                <path d="M16 11v42M26 11v42M36 11v42M46 11v42M5 25h54M5 39h54"
                      stroke="rgba(104,148,198,.2)" stroke-width="1"/>
                <rect x="7" y="13" width="8" height="11" fill="rgba(52,96,148,.8)"/>
                <rect x="17" y="13" width="8" height="11" fill="rgba(52,96,148,.8)"/>
                <rect x="27" y="13" width="8" height="11" fill="rgba(52,96,148,.8)"/>
                <rect x="37" y="27" width="8" height="11" fill="rgba(196,62,62,.85)"/>
                <rect x="47" y="27" width="8" height="11" fill="rgba(196,62,62,.85)"/>
                <path d="M39.5 29.5l3.2 3.2M42.7 29.5l-3.2 3.2M49.5 32.5l3.2 3.2M52.7 32.5l-3.2 3.2"
                      stroke="#fff2ec" stroke-width="1.7" stroke-linecap="round"/>
                <circle cx="11" cy="45" r="2.2" fill="rgba(150,195,240,.6)"/>
                <circle cx="31" cy="45" r="2.2" fill="rgba(150,195,240,.6)"/>
                <circle cx="51" cy="17" r="2.2" fill="rgba(150,195,240,.6)"/>
            </svg>`
    },
    {
        id: 'asteroid',
        title: '小行星',
        tag: '街机',
        category: '街机',
        desc: '飞船只有惯性和推进器，没有刹车。击碎大块岩石会裂成两块，越碎越快，也越难躲。',
        controls: '←→ 转向 / ↑ 推进 / 空格',
        url: 'games/asteroid/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #101a2e 0%, #04070d 70%)',
        glow: 'rgba(150, 190, 235, .26)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="1.2" fill="rgba(200,222,255,.7)"/>
                <circle cx="57" cy="15" r="1" fill="rgba(200,222,255,.5)"/>
                <circle cx="17" cy="53" r="1" fill="rgba(200,222,255,.45)"/>
                <circle cx="53" cy="51" r="1.3" fill="rgba(200,222,255,.55)"/>
                <path d="M40 9l11 4 5 11-4 11-11 5-10-3-6-10 3-11z"
                      fill="rgba(28,40,56,.92)" stroke="rgba(150,176,204,.9)"
                      stroke-width="1.6" stroke-linejoin="round"/>
                <path d="M43 20l6 4-2 7" stroke="rgba(120,146,176,.55)" stroke-width="1.2"
                      fill="none" stroke-linecap="round"/>
                <path d="M13 44l13 5-2 9-13 5-6-9z" fill="rgba(28,40,56,.92)"
                      stroke="rgba(150,176,204,.9)" stroke-width="1.6" stroke-linejoin="round"/>
                <path d="M22 33l6-10 6 10-6-3z" fill="rgba(18,30,46,.95)"
                      stroke="rgba(210,234,255,.95)"
                      stroke-width="1.6" stroke-linejoin="round"/>
            </svg>`
    },
    {
        id: 'stacker',
        title: '叠塔',
        tag: '休闲',
        category: '休闲',
        desc: '方块来回滑动，看准位置按下去。错开的部分会掉下去，只保留重叠的一段，越叠越窄。',
        controls: '点击 / 空格落定',
        url: 'games/stacker/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #141a33 0%, #070a16 70%)',
        glow: 'rgba(120, 150, 240, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="7" y="47" width="50" height="11" rx="2.5" fill="#3f6fae"/>
                <rect x="7" y="47" width="50" height="3.4" rx="1.7" fill="rgba(255,255,255,.26)"/>
                <rect x="11" y="35" width="42" height="11" rx="2.5" fill="#3d8aa6"/>
                <rect x="11" y="35" width="42" height="3.4" rx="1.7" fill="rgba(255,255,255,.26)"/>
                <rect x="16" y="23" width="32" height="11" rx="2.5" fill="#3fa38e"/>
                <rect x="16" y="23" width="32" height="3.4" rx="1.7" fill="rgba(255,255,255,.26)"/>
                <rect x="21" y="11" width="24" height="11" rx="2.5" fill="#63b071"/>
                <rect x="21" y="11" width="24" height="3.4" rx="1.7" fill="rgba(255,255,255,.26)"/>
                <rect x="21.7" y="11.7" width="22.6" height="9.6" rx="2.2"
                      fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>
            </svg>`
    },
    {
        id: 'plumber',
        title: '水管工',
        tag: '益智',
        category: '益智',
        desc: '点击旋转每一段管道，让水从左上角流遍整张管网，接通的地方会亮起来。',
        controls: '点击 / 轻点旋转',
        url: 'games/plumber/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0a2a38 0%, #05101a 70%)',
        glow: 'rgba(72, 200, 245, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 14 H30 Q34 14 34 18 V46 Q34 50 38 50 H54"
                      fill="none" stroke="#255a72" stroke-width="10" stroke-linecap="round"/>
                <path d="M10 14 H30 Q34 14 34 18 V46 Q34 50 38 50 H54"
                      fill="none" stroke="#5fd8f5" stroke-width="5.2" stroke-linecap="round"/>
                <path d="M46 16 H54" fill="none" stroke="#2f5f7a" stroke-width="10" stroke-linecap="round"/>
                <path d="M46 16 H54" fill="none" stroke="#4a7f9c" stroke-width="5.2" stroke-linecap="round"/>
                <path d="M10 32 H20" fill="none" stroke="#2f5f7a" stroke-width="10" stroke-linecap="round"/>
                <path d="M10 32 H20" fill="none" stroke="#4a7f9c" stroke-width="5.2" stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'hanoi',
        title: '汉诺塔',
        tag: '益智',
        category: '益智',
        desc: '把所有圆盘搬到最右侧的柱子，一次只能搬一个，大盘不能压在小盘上。',
        controls: '点击柱子 / 1 2 3',
        url: 'games/hanoi/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1b1c3a 0%, #080a16 70%)',
        glow: 'rgba(140, 150, 240, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="48" width="48" height="7" rx="3" fill="#3a4f72"/>
                <rect x="17.8" y="10" width="4.4" height="38" rx="2.2" fill="#8fb2d8"/>
                <rect x="29.8" y="10" width="4.4" height="38" rx="2.2" fill="#8fb2d8"/>
                <rect x="41.8" y="10" width="4.4" height="38" rx="2.2" fill="#8fb2d8"/>
                <rect x="11" y="41" width="18" height="7" rx="3.4" fill="#4f8cff"/>
                <rect x="15" y="34" width="10" height="7" rx="3.4" fill="#a86bff"/>
                <rect x="35" y="41" width="18" height="7" rx="3.4" fill="#2fd48b"/>
            </svg>`
    },
    {
        id: 'pinball',
        title: '弹球台',
        tag: '街机',
        category: '街机',
        desc: '左右挡板把钢球顶回去，撞击缓冲柱连击加分，三颗球用完即结束。',
        controls: '←→ / A D 挡板',
        url: 'games/pinball/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2c1a14 0%, #0a0710 70%)',
        glow: 'rgba(255, 150, 90, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="8" width="44" height="48" rx="11" fill="rgba(255,255,255,.03)"
                      stroke="#3d5a7c" stroke-width="3"/>
                <circle cx="32" cy="20" r="6.2" fill="none" stroke="#4fb6e8" stroke-width="2.6"/>
                <circle cx="19" cy="31" r="4.2" fill="none" stroke="#4fb6e8" stroke-width="2.2"/>
                <circle cx="45" cy="31" r="4.2" fill="none" stroke="#4fb6e8" stroke-width="2.2"/>
                <circle cx="32" cy="36" r="4.2" fill="#dceeff"/>
                <path d="M14 51 L25 44" stroke="#f2743a" stroke-width="4.4" stroke-linecap="round"/>
                <path d="M50 51 L39 44" stroke="#f2743a" stroke-width="4.4" stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'fishing',
        title: '钓鱼',
        tag: '休闲',
        category: '休闲',
        desc: '移动鱼钩去碰鱼，上钩后连续点击收线。越深的鱼越值钱，小心铁罐和电鳗。',
        controls: '移动鱼钩 / 点击收线',
        url: 'games/fishing/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0c2c3c 0%, #04101a 70%)',
        glow: 'rgba(96, 200, 210, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 10 H18 Q22 10 22 14 V30" fill="none" stroke="#cfe4f5"
                      stroke-width="2" stroke-linecap="round"/>
                <path d="M22 30 a4.6 4.6 0 1 1 -5.4 4.4" fill="none" stroke="#e6f6ff"
                      stroke-width="2.6" stroke-linecap="round"/>
                <path d="M53 30 l7 -6 v20 l-7 -6 z" fill="#3fa7b0"/>
                <ellipse cx="41" cy="38" rx="11.6" ry="8" fill="#5fd8c0"/>
                <ellipse cx="41" cy="38" rx="11.6" ry="8" fill="none"
                         stroke="rgba(10,40,50,.35)" stroke-width="1.2"/>
                <circle cx="45" cy="35.4" r="1.9" fill="#f6feff"/>
                <circle cx="45.4" cy="35.4" r="1" fill="#0a1a22"/>
                <path d="M32 34 l5 -6" stroke="rgba(10,40,50,.4)" stroke-width="1.6"
                      stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'billiards',
        title: '台球',
        tag: '休闲',
        category: '休闲',
        desc: '九球菱形摆开，瞄准后按住蓄力击球。把 1 到 9 号球全部打进袋，号码越大分越高，白球落袋会扣分。',
        controls: '移动鼠标瞄准 / 按住蓄力，松开击球',
        url: 'games/billiards/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0d3428 0%, #050d0b 70%)',
        glow: 'rgba(90, 220, 170, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="10" width="54" height="44" rx="9" fill="#0d3225"
                      stroke="#2f6b52" stroke-width="2.6"/>
                <circle cx="17.5" cy="17.5" r="3.4" fill="#08140f"/>
                <circle cx="46.5" cy="17.5" r="3.4" fill="#08140f"/>
                <circle cx="17.5" cy="46.5" r="3.4" fill="#08140f"/>
                <circle cx="46.5" cy="46.5" r="3.4" fill="#08140f"/>
                <circle cx="23" cy="36" r="7.2" fill="#f5f8fc"/>
                <circle cx="23" cy="36" r="7.2" fill="none" stroke="rgba(10,40,30,.28)"
                        stroke-width="1"/>
                <circle cx="41" cy="27" r="7.8" fill="#f0b429"/>
                <circle cx="41" cy="27" r="3.8" fill="#fffdf4"/>
                <circle cx="41" cy="27" r="1.5" fill="#2a1d05"/>
                <path d="M52 52 L36 38" stroke="#c98f4d" stroke-width="3.2"
                      stroke-linecap="round"/>
                <path d="M36.6 38.6 L34.6 36.6" stroke="#e9f7ff" stroke-width="3.2"
                      stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'bowling',
        title: '保龄球',
        tag: '休闲',
        category: '休闲',
        desc: '移动鼠标选择站位，按住蓄力投球，出手后还能加旋转。标准十局计分，全中与补中都有加成。',
        controls: '移动鼠标 / 按住投球 / ← → 加旋转',
        url: 'games/bowling/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1a2233 0%, #070a12 70%)',
        glow: 'rgba(120, 170, 255, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="38" r="13" fill="#24439a"
                        stroke="#6d90e8" stroke-width="2.4"/>
                <circle cx="20.4" cy="33.6" r="2.2" fill="#0a1430"/>
                <circle cx="24.6" cy="31.8" r="2.2" fill="#0a1430"/>
                <circle cx="26.6" cy="35.4" r="2.2" fill="#0a1430"/>
                <circle cx="20.6" cy="37.4" r="1.8" fill="rgba(255,255,255,.4)"/>
                <path d="M45 13 q4.6 0 4.6 5.4 q0 4 -2.2 6.8 q4.6 6 4.6 13.4
                         q0 10.4 -7 10.4 q-7 0 -7 -10.4 q0 -7.4 4.6 -13.4
                         q-2.2 -2.8 -2.2 -6.8 q0 -5.4 4.6 -5.4 z"
                      fill="#f6f9fd" stroke="rgba(40,60,90,.35)" stroke-width="1.2"/>
                <rect x="39.2" y="24.6" width="11.6" height="2.6" rx="1.3" fill="#d63e3a"/>
                <rect x="39.2" y="29.2" width="11.6" height="2.2" rx="1.1" fill="#d63e3a"/>
            </svg>`
    },
    {
        id: 'onestroke',
        title: '一笔画',
        tag: '益智',
        category: '益智',
        desc: '从奇点起步，按住拖动把每条边都画一遍。八个图形逐关加难，走进死路可以撤销或重开。',
        controls: '按住拖动连线 / Z 撤销 / R 重开',
        url: 'games/onestroke/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #0c2a2c 0%, #050d12 70%)',
        glow: 'rgba(90, 232, 200, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 18 H50 V46 H14 Z" fill="none" stroke="#4fe0bf"
                      stroke-width="3" stroke-linejoin="round"/>
                <path d="M14 18 L50 46" stroke="#4fe0bf" stroke-width="3"
                      stroke-linecap="round"/>
                <circle cx="14" cy="18" r="4.2" fill="#0d1726" stroke="#a6f7e3" stroke-width="2.4"/>
                <circle cx="50" cy="18" r="4.2" fill="#0d1726" stroke="#a6f7e3" stroke-width="2.4"/>
                <circle cx="50" cy="46" r="4.2" fill="#0d1726" stroke="#a6f7e3" stroke-width="2.4"/>
                <circle cx="14" cy="46" r="4.2" fill="#0d1726" stroke="#a6f7e3" stroke-width="2.4"/>
            </svg>`
    },
    {
        id: 'towerdefense',
        title: '塔防',
        tag: '街机',
        category: '街机',
        desc: '在空地上建箭塔、炮塔、冰塔，挡住十二波敌人。点击已有塔可以升级，漏怪会扣除生命。',
        controls: '1 2 3 选塔 / 点击建塔 / 空格开波',
        url: 'games/towerdefense/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #101f36 0%, #05080f 70%)',
        glow: 'rgba(96, 170, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 52 H24 V28 H46 V52" fill="none" stroke="#1e2a39"
                      stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>
                <path d="M4 52 H24 V28 H46 V52" fill="none" stroke="#8a7a5f"
                      stroke-width="7.4" stroke-linejoin="round" stroke-linecap="round"/>
                <path d="M4 52 H24 V28 H46 V52" fill="none" stroke="#c6b28c"
                      stroke-width="1.4" stroke-linejoin="round" stroke-dasharray="5 6"/>
                <circle cx="12" cy="52" r="3.6" fill="#ff6b6b"/>
                <circle cx="24" cy="41" r="3.6" fill="#ff6b6b"/>
                <circle cx="37" cy="28" r="3.6" fill="#ff6b6b"/>
                <rect x="7" y="30" width="15" height="15" rx="4" fill="#0f1c2b"
                      stroke="#ffb05a" stroke-width="2.2"/>
                <circle cx="14.5" cy="37.5" r="4" fill="#ffb05a"/>
                <path d="M14.5 33.4 V27.6" stroke="#ffb05a" stroke-width="2.6"
                      stroke-linecap="round"/>
                <rect x="33" y="6" width="15" height="15" rx="4" fill="#0f1c2b"
                      stroke="#5fd8ff" stroke-width="2.2"/>
                <circle cx="40.5" cy="13.5" r="4" fill="#5fd8ff"/>
                <path d="M44.5 13.5 H50.4" stroke="#5fd8ff" stroke-width="2.6"
                      stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'num24',
        title: '二十四点',
        tag: '益智',
        category: '益智',
        desc: '四张数字牌，用加减乘除凑出 24。每张牌只能用一次，表达式实时显示，每题还留一次提示。',
        controls: '点牌 / 点运算符',
        url: 'games/num24/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #173a52 0%, #07131c 70%)',
        glow: 'rgba(95, 216, 255, .34)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="15" width="23" height="33" rx="5" fill="#0f2233"
                      stroke="#5fd8ff" stroke-width="2"/>
                <text x="17.5" y="37" text-anchor="middle" font-family="Helvetica, Arial"
                      font-size="15" font-weight="800" fill="#9fe9ff">6</text>
                <rect x="18" y="8" width="23" height="33" rx="5" fill="#133248"
                      stroke="#5fd8ff" stroke-width="2"/>
                <text x="29.5" y="30" text-anchor="middle" font-family="Helvetica, Arial"
                      font-size="15" font-weight="800" fill="#9fe9ff">4</text>
                <text x="46" y="38" font-family="Helvetica, Arial" font-size="19"
                      font-weight="800" fill="#ffd166">24</text>
            </svg>`
    },
    {
        id: 'knife',
        title: '飞刀',
        tag: '街机',
        category: '街机',
        desc: '把飞刀投向旋转的木盘。插满一轮就换新盘，刀撞刀立刻结束，越往后转得越快。',
        controls: '点击 / 空格投掷',
        url: 'games/knife/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #3a2a16 0%, #140d07 70%)',
        glow: 'rgba(255, 176, 90, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="25" r="19" fill="#3a2a18" stroke="#8a6334"
                      stroke-width="4"/>
                <circle cx="32" cy="25" r="19" fill="none" stroke="#c79a5e"
                      stroke-width="1.4" stroke-dasharray="4 5"/>
                <circle cx="32" cy="25" r="11" fill="none" stroke="#6f5230"
                      stroke-width="1.4"/>
                <circle cx="32" cy="25" r="4" fill="#ffd166"/>
                <path d="M32 58 V35" stroke="#dfe9f5" stroke-width="4.2"
                      stroke-linecap="round"/>
                <path d="M32 33 l-3.6 5.6 h7.2 z" fill="#dfe9f5"/>
                <path d="M32 45 h-5.4" stroke="#ffb05a" stroke-width="3"
                      stroke-linecap="round"/>
                <path d="M20 15 v6" stroke="#dfe9f5" stroke-width="3"
                      stroke-linecap="round"/>
                <path d="M44 15 v6" stroke="#dfe9f5" stroke-width="3"
                      stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'rhythm',
        title: '节奏',
        tag: '街机',
        category: '街机',
        desc: '四条轨道落下音符，到判定线时按下对应按键。连续命中累积连击，一曲结束按准确率评级。',
        controls: 'D F J K',
        url: 'games/rhythm/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1c1445 0%, #07060f 70%)',
        glow: 'rgba(169, 136, 255, .36)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="11" height="52" rx="5.5" fill="#101a30"
                      stroke="#5fd8ff" stroke-width="1.4"/>
                <rect x="19" y="6" width="11" height="52" rx="5.5" fill="#101a30"
                      stroke="#a988ff" stroke-width="1.4"/>
                <rect x="32" y="6" width="11" height="52" rx="5.5" fill="#101a30"
                      stroke="#ff7ab0" stroke-width="1.4"/>
                <rect x="45" y="6" width="11" height="52" rx="5.5" fill="#101a30"
                      stroke="#ffd166" stroke-width="1.4"/>
                <rect x="7.6" y="22" width="7.8" height="5" rx="2.5" fill="#5fd8ff"/>
                <rect x="20.6" y="34" width="7.8" height="5" rx="2.5" fill="#a988ff"/>
                <rect x="33.6" y="16" width="7.8" height="5" rx="2.5" fill="#ff7ab0"/>
                <rect x="46.6" y="28" width="7.8" height="5" rx="2.5" fill="#ffd166"/>
                <path d="M4 46 h56" stroke="#dceaff" stroke-width="2.4"
                      stroke-linecap="round" opacity=".85"/>
            </svg>`
    },
    {
        id: 'solitaire',
        title: '接龙',
        tag: '休闲',
        category: '休闲',
        desc: '经典克朗代克纸牌接龙。七列牌按红黑降序接，四个基座按花色从 A 收到 K，支持随时撤销。',
        controls: '点击选牌 / 空格抽牌',
        url: 'games/solitaire/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #10352a 0%, #04120c 70%)',
        glow: 'rgba(110, 228, 175, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="16" width="24" height="34" rx="5" fill="#16233d"
                      stroke="#4c74b8" stroke-width="2"/>
                <rect x="22" y="10" width="24" height="34" rx="5" fill="#f3f6f2"
                      stroke="#b9c7bd" stroke-width="2"/>
                <path d="M34 15 C34 15 27 21.5 27 25.6 C27 28.8 30.2 30 32.2 28.2
                         C31.8 31.4 29.8 33.6 28.2 34.2 L39.8 34.2
                         C38.2 33.6 36.2 31.4 35.8 28.2
                         C37.8 30 41 28.8 41 25.6 C41 21.5 34 15 34 15 Z"
                      fill="#1c2533"/>
                <rect x="44" y="26" width="15" height="4.5" rx="2.2" fill="#6ee4af"/>
                <rect x="44" y="34" width="15" height="4.5" rx="2.2" fill="#ffd166"/>
                <rect x="44" y="42" width="15" height="4.5" rx="2.2" fill="#6ee4af"/>
                <rect x="9" y="54" width="50" height="5" rx="2.5" fill="#1d4d3c"/>
            </svg>`
    },
    {
        id: 'klotski',
        title: '华容道',
        tag: '益智',
        category: '益智',
        desc: '十个棋子挤在四乘五的木盘里，拖动腾出空位。把两格见方的曹操挪到底部出口，步数越少越见功夫。',
        controls: '拖拽 / 方向键逐格',
        url: 'games/klotski/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #3d2b17 0%, #150d06 70%)',
        glow: 'rgba(255, 190, 110, .3)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="4" width="48" height="56" rx="5" fill="#241a0f"
                      stroke="#8a6b3c" stroke-width="2"/>
                <rect x="10.5" y="6" width="10.5" height="21" rx="1.6" fill="#22415f"
                      stroke="#8fc6f0" stroke-width="1"/>
                <rect x="43" y="6" width="10.5" height="21" rx="1.6" fill="#22415f"
                      stroke="#8fc6f0" stroke-width="1"/>
                <rect x="21.5" y="6" width="21" height="21" rx="2" fill="#7c3030"
                      stroke="#f0b072" stroke-width="1.4"/>
                <path d="M29 16.5 h6 M32 13.5 v6" stroke="#ffd9a8" stroke-width="1.6"
                      stroke-linecap="round" opacity=".8"/>
                <rect x="10.5" y="27" width="10.5" height="21" rx="1.6" fill="#22415f"
                      stroke="#8fc6f0" stroke-width="1"/>
                <rect x="43" y="27" width="10.5" height="21" rx="1.6" fill="#22415f"
                      stroke="#8fc6f0" stroke-width="1"/>
                <rect x="21.5" y="27" width="21" height="10" rx="1.6" fill="#1f4c39"
                      stroke="#7fe0b0" stroke-width="1"/>
                <rect x="21.5" y="37.5" width="10" height="10" rx="1.6" fill="#323947"
                      stroke="#a2b3ca" stroke-width="1"/>
                <rect x="32" y="37.5" width="10.5" height="10" rx="1.6" fill="#323947"
                      stroke="#a2b3ca" stroke-width="1"/>
                <rect x="10.5" y="48" width="10.5" height="10" rx="1.6" fill="#323947"
                      stroke="#a2b3ca" stroke-width="1"/>
                <rect x="43" y="48" width="10.5" height="10" rx="1.6" fill="#323947"
                      stroke="#a2b3ca" stroke-width="1"/>
                <path d="M27.4 60 h9.2 l-4.6 4.2 z" fill="#ffd166"/>
            </svg>`
    },
    {
        id: 'mastermind',
        title: '密码破译',
        tag: '益智',
        category: '益智',
        desc: '四颗彩珠组成保险箱密码，颜色可以重复。每次提交只告诉你「位置对不对」与「颜色有没有」，八次之内拆开它。',
        controls: '点色块上色 / Enter 提交',
        url: 'games/mastermind/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1b2244 0%, #07080f 70%)',
        glow: 'rgba(130, 170, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 26 v-5 a12 12 0 0 1 24 0 v5" fill="none"
                      stroke="#9db8ff" stroke-width="3.6" stroke-linecap="round"/>
                <rect x="10" y="25" width="44" height="30" rx="8" fill="#131a2a"
                      stroke="#7aa2ff" stroke-width="2.2"/>
                <circle cx="20" cy="40" r="4.6" fill="#ff6b6b"/>
                <circle cx="30" cy="40" r="4.6" fill="#ffc857"/>
                <circle cx="40" cy="40" r="4.6" fill="#5ce08a"/>
                <circle cx="50" cy="40" r="4.6" fill="#58d8f0"/>
                <circle cx="20" cy="40" r="4.6" fill="none" stroke="rgba(255,255,255,.4)"
                        stroke-width="1"/>
                <circle cx="30" cy="40" r="4.6" fill="none" stroke="rgba(255,255,255,.4)"
                        stroke-width="1"/>
                <circle cx="40" cy="40" r="4.6" fill="none" stroke="rgba(255,255,255,.4)"
                        stroke-width="1"/>
                <circle cx="50" cy="40" r="4.6" fill="none" stroke="rgba(255,255,255,.4)"
                        stroke-width="1"/>
            </svg>`
    },
    {
        id: 'typing',
        title: '打字狂潮',
        tag: '街机',
        category: '街机',
        desc: '英文单词从上方不断落下，直接敲键盘把它们打掉。连击越高分越快，漏掉三个就结束，越往后掉得越急。',
        controls: '直接键入字母',
        url: 'games/typing/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #082636 0%, #02070c 70%)',
        glow: 'rgba(120, 230, 255, .34)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <text x="16" y="16" font-family="Helvetica, Arial" font-size="10"
                      font-weight="700" fill="rgba(140, 215, 245, .5)">T</text>
                <text x="29" y="12" font-family="Helvetica, Arial" font-size="10"
                      font-weight="700" fill="rgba(140, 215, 245, .38)">Y</text>
                <text x="43" y="17" font-family="Helvetica, Arial" font-size="10"
                      font-weight="700" fill="rgba(140, 215, 245, .28)">P</text>
                <rect x="13" y="26" width="38" height="30" rx="7" fill="#122634"
                      stroke="#5fd8ff" stroke-width="2.2"/>
                <rect x="19" y="32" width="26" height="17" rx="4" fill="#0a1822"
                      stroke="rgba(95, 216, 255, .5)" stroke-width="1.2"/>
                <text x="32" y="45" text-anchor="middle" font-family="Helvetica, Arial"
                      font-size="13" font-weight="800" fill="#8dffc4">A</text>
                <path d="M19 56 h6 M29 56 h6 M39 56 h6" stroke="rgba(95, 216, 255, .55)"
                      stroke-width="2.2" stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'archery',
        title: '射箭',
        tag: '休闲',
        category: '休闲',
        desc: '按住蓄力，松手出箭。重力和侧风都会把箭带偏，越靠靶心分越高，一轮八支箭比总分。',
        controls: '按住蓄力 / 松开射箭',
        url: 'games/archery/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a2438 0%, #0a0810 70%)',
        glow: 'rgba(255, 180, 110, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="39" cy="25" r="17" fill="#efe9db"/>
                <circle cx="39" cy="25" r="13.5" fill="#232b3a"/>
                <circle cx="39" cy="25" r="10" fill="#2f6fbf"/>
                <circle cx="39" cy="25" r="6.5" fill="#d2413f"/>
                <circle cx="39" cy="25" r="3" fill="#ffd166"/>
                <path d="M12 50 L37 26" stroke="#e6d3a8" stroke-width="2.6"
                      stroke-linecap="round"/>
                <path d="M12 50 l-3 5 M12 50 l5 -3" stroke="#7fd8ff" stroke-width="2.4"
                      stroke-linecap="round"/>
                <path d="M43 47 L39 43" stroke="#8a6334" stroke-width="3"
                      stroke-linecap="round"/>
                <path d="M33 56 L39 43 L45 56" fill="none" stroke="#8a6334"
                      stroke-width="3" stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'checkers',
        title: '跳棋',
        tag: '益智',
        category: '益智',
        desc: '黑白格上的斜向攻防。斜走一步，跳吃对方棋子，先吃光对手或把对方逼到无路可走就获胜。',
        controls: '点击 / 拖动',
        url: 'games/checkers/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2f1a28 0%, #0e0a12 70%)',
        glow: 'rgba(255, 92, 108, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="52" height="52" rx="9" fill="#121828"/>
                <rect x="10" y="10" width="12" height="12" rx="2" fill="#243352"/>
                <rect x="34" y="10" width="12" height="12" rx="2" fill="#243352"/>
                <rect x="22" y="22" width="12" height="12" rx="2" fill="#243352"/>
                <rect x="46" y="22" width="8" height="12" rx="2" fill="#243352"/>
                <rect x="10" y="34" width="12" height="12" rx="2" fill="#243352"/>
                <rect x="34" y="34" width="12" height="12" rx="2" fill="#243352"/>
                <circle cx="28" cy="28" r="7.5" fill="#ff5c6c"/>
                <circle cx="28" cy="28" r="3" fill="#ffd166"/>
                <circle cx="16" cy="40" r="7.5" fill="#ff5c6c"/>
                <circle cx="40" cy="40" r="7.5" fill="#4f8cff"/>
                <circle cx="40" cy="40" r="2.6" fill="#9fd4ff"/>
            </svg>`
    },
    {
        id: 'wordsearch',
        title: '单词寻宝',
        tag: '益智',
        category: '益智',
        desc: '字母方阵里藏着一批英文单词，横竖斜、正反都可能。拖动圈出完整单词，找齐全部即可通关。',
        controls: '拖动 / 点击首尾',
        url: 'games/wordsearch/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1d2a1c 0%, #0a0f0b 70%)',
        glow: 'rgba(255, 197, 72, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="44" height="48" rx="7" fill="#101a2c"/>
                <g fill="#2a3f5f">
                    <rect x="12" y="14" width="10" height="10" rx="2"/>
                    <rect x="24" y="14" width="10" height="10" rx="2"/>
                    <rect x="36" y="14" width="8" height="10" rx="2"/>
                    <rect x="12" y="38" width="10" height="10" rx="2"/>
                    <rect x="24" y="38" width="10" height="10" rx="2"/>
                    <rect x="36" y="38" width="8" height="10" rx="2"/>
                </g>
                <g fill="#ffc548">
                    <rect x="12" y="26" width="10" height="10" rx="2"/>
                    <rect x="24" y="26" width="10" height="10" rx="2"/>
                    <rect x="36" y="26" width="8" height="10" rx="2"/>
                </g>
                <circle cx="46" cy="44" r="9" fill="none" stroke="#7affc4" stroke-width="2.6"/>
                <path d="M52 51 L58 57" stroke="#7affc4" stroke-width="3.4"
                      stroke-linecap="round"/>
            </svg>`
    },
    {
        id: 'dodge',
        title: '星尘闪避',
        tag: '休闲',
        category: '休闲',
        desc: '拖动光球在弹幕里穿行，每多坚持一秒都算分。顺手捡起散落的星尘能加分，被击中三次就熄灭。',
        controls: '拖动 / WASD',
        url: 'games/dodge/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #142a3c 0%, #070d18 70%)',
        glow: 'rgba(95, 216, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="17" fill="none" stroke="rgba(95,216,255,.28)"
                        stroke-width="2"/>
                <circle cx="32" cy="32" r="8" fill="#7ff0ff"/>
                <circle cx="32" cy="32" r="4" fill="#ffffff"/>
                <circle cx="12" cy="18" r="3.2" fill="#ff8a5c"/>
                <circle cx="52" cy="16" r="2.6" fill="#c39bff"/>
                <circle cx="14" cy="46" r="2.8" fill="#ffd166"/>
                <circle cx="50" cy="48" r="3" fill="#ff5c6c"/>
                <circle cx="32" cy="8" r="2.4" fill="#9fd4ff"/>
                <circle cx="32" cy="56" r="2.4" fill="#9fd4ff"/>
            </svg>`
    },
    {
        id: 'platformer',
        title: '像素跳跃',
        tag: '街机',
        category: '街机',
        desc: '三关横版跑跳，踩扁紫色小怪、捡满金币、跑到终点的旗子。掉下深坑或撞到怪会丢一条命。',
        controls: '方向键 / 空格',
        url: 'games/platformer/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #16233f 0%, #080c16 70%)',
        glow: 'rgba(79, 140, 255, .34)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="12" width="24" height="5" rx="2.5" fill="#2b4566"/>
                <rect x="40" y="22" width="18" height="5" rx="2.5" fill="#2b4566"/>
                <rect x="14" y="34" width="36" height="5" rx="2.5" fill="#2b4566"/>
                <rect x="6" y="52" width="52" height="6" rx="3" fill="#1a2b41"/>
                <rect x="28" y="18" width="10" height="10" rx="2" fill="#cfe6ff"/>
                <rect x="29" y="28" width="8" height="8" rx="2" fill="#4a86e8"/>
                <rect x="29" y="36" width="3" height="5" rx="1" fill="#25476b"/>
                <rect x="34" y="36" width="3" height="5" rx="1" fill="#25476b"/>
                <circle cx="18" cy="46" r="5" fill="#ffd166"/>
                <circle cx="18" cy="46" r="2" fill="#fff3c4"/>
                <rect x="46" y="44" width="9" height="8" rx="2" fill="#7d55b8"/>
                <rect x="47" y="51" width="2.5" height="2" fill="#2a1a3d"/>
                <rect x="51" y="51" width="2.5" height="2" fill="#2a1a3d"/>
            </svg>`
    },
    {
        id: 'jigsaw',
        title: '拼图',
        tag: '益智',
        category: '益智',
        desc: '把打乱成 3×3 到 5×5 的风景拼回原样。每局随机生成一幅夜空山湖图，点两块拼图交换位置，步数越少越好。',
        controls: '点击两块拼图',
        url: 'games/jigsaw/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #1a2a46 0%, #080e1a 70%)',
        glow: 'rgba(122, 255, 196, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#0d1a2c"/>
                <rect x="12" y="12" width="18" height="18" rx="3" fill="#2b4f78"/>
                <rect x="34" y="12" width="18" height="18" rx="3" fill="#3aa8d0"/>
                <rect x="12" y="34" width="18" height="18" rx="3" fill="#27607c"/>
                <rect x="36" y="36" width="16" height="16" rx="3" fill="#7affc4"/>
                <rect x="34" y="12" width="18" height="18" rx="3" fill="none" stroke="#8ce8ff" stroke-width="1.6"/>
                <circle cx="43" cy="21" r="4" fill="#eafcff"/>
            </svg>`
    },
    {
        id: 'wordle',
        title: '猜词',
        tag: '益智',
        category: '益智',
        desc: '六次机会猜出五个字母的英文单词。绿色表示字母与位置都对，黄色表示字母在场但位置不对，连胜会一直累计。',
        controls: '字母键 / 点击键盘',
        url: 'games/wordle/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #142a26 0%, #080e14 70%)',
        glow: 'rgba(62, 207, 142, .28)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#0d1a2c"/>
                <rect x="9" y="13" width="12" height="12" rx="3" fill="#3ecf8e"/>
                <rect x="24" y="13" width="12" height="12" rx="3" fill="#26314a"/>
                <rect x="39" y="13" width="12" height="12" rx="3" fill="#e8b84b"/>
                <rect x="9" y="29" width="12" height="12" rx="3" fill="#26314a"/>
                <rect x="24" y="29" width="12" height="12" rx="3" fill="#3ecf8e"/>
                <rect x="39" y="29" width="12" height="12" rx="3" fill="#26314a"/>
                <rect x="9" y="45" width="12" height="12" rx="3" fill="none" stroke="#5fd8ff" stroke-width="1.6"/>
                <rect x="24" y="45" width="12" height="12" rx="3" fill="none" stroke="#2f4a6b" stroke-width="1.4"/>
            </svg>`
    },
    {
        id: 'tron',
        title: '光影摩托',
        tag: '街机',
        category: '街机',
        desc: '骑着光车在方格场里转向，身后留下撞不得的光墙。五局三胜对抗电脑，撞墙或撞到任意光墙即负。',
        controls: '方向键 / WASD',
        url: 'games/tron/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #16283f 0%, #070c15 70%)',
        glow: 'rgba(95, 216, 255, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#08111f"/>
                <path d="M12 45 H30 V22" fill="none" stroke="#5fd8ff" stroke-width="3.4"
                      stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="30" cy="22" r="3.6" fill="#eafcff"/>
                <path d="M52 19 H40 V40 H31" fill="none" stroke="#ff5c8a" stroke-width="3.4"
                      stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="31" cy="40" r="3.2" fill="#ffe4ef"/>
            </svg>`
    },
    {
        id: 'airhockey',
        title: '空气曲棍球',
        tag: '休闲',
        category: '休闲',
        desc: '拖动下方的光球击打冰球，把球送进上方球门。七分制对局，甩得越快抽射越狠，电脑会预判落点。',
        controls: '拖动 / 方向键',
        url: 'games/airhockey/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2a1622 0%, #0b0810 70%)',
        glow: 'rgba(255, 92, 138, .30)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="52" height="56" rx="10" fill="#0b1a2c"/>
                <rect x="11" y="9" width="42" height="46" rx="7" fill="none" stroke="#2a6a8f"
                      stroke-width="1.6"/>
                <line x1="11" y1="32" x2="53" y2="32" stroke="#ff5c8a" stroke-opacity=".45"
                      stroke-width="1.6"/>
                <rect x="26" y="6.5" width="12" height="3" rx="1.5" fill="#ff5c8a"/>
                <rect x="26" y="54.5" width="12" height="3" rx="1.5" fill="#5fd8ff"/>
                <circle cx="32" cy="18" r="6.5" fill="#ff5c8a"/>
                <circle cx="32" cy="46" r="6.5" fill="#5fd8ff"/>
                <circle cx="32" cy="32" r="3.6" fill="#d8f4ff"/>
            </svg>`
    },
    {
        id: 'jungle',
        title: '斗兽棋',
        tag: '益智',
        category: '益智',
        desc: '丛林棋盘上的八种野兽按战力吃子，老鼠能下水、狮子老虎可跃河，踩进陷阱战力归零。三档难度对抗电脑。',
        controls: '点击棋子 / 落点',
        url: 'games/jungle/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #123a2c 0%, #07140f 70%)',
        glow: 'rgba(47, 212, 139, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="56" height="56" rx="10" fill="#0a1a13"/>
                <rect x="8" y="8" width="48" height="48" rx="6" fill="#123024"/>
                <rect x="8" y="26" width="48" height="12" fill="#1c5b7a" fill-opacity=".8"/>
                <line x1="8" y1="32" x2="56" y2="32" stroke="#7fd8ff" stroke-opacity=".4"
                      stroke-width="1.2"/>
                <circle cx="19" cy="15" r="6.6" fill="#ffcf6b"/>
                <text x="19" y="18.4" font-size="8" font-weight="700" text-anchor="middle"
                      fill="#4a2f00" font-family="sans-serif">虎</text>
                <circle cx="45" cy="48" r="6.6" fill="#8fb6ff"/>
                <text x="45" y="51.4" font-size="8" font-weight="700" text-anchor="middle"
                      fill="#10203f" font-family="sans-serif">象</text>
                <circle cx="45" cy="15" r="5.6" fill="#ffcf6b" fill-opacity=".9"/>
                <circle cx="19" cy="48" r="5.6" fill="#8fb6ff" fill-opacity=".9"/>
            </svg>`
    },
    {
        id: 'bridges',
        title: '数桥',
        tag: '益智',
        category: '益智',
        desc: '按小岛上的数字连桥，两个相邻岛之间可以搭一座或两座。所有数字都满足、全图也连通，才算这座群岛完工。',
        controls: '点击两个岛',
        url: 'games/bridges/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #16273f 0%, #070d16 70%)',
        glow: 'rgba(95, 216, 255, .30)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#081320"/>
                <g stroke="#5fd8ff" stroke-width="2.4" stroke-linecap="round">
                    <line x1="21" y1="21" x2="21" y2="43"/>
                    <line x1="25" y1="21" x2="25" y2="43"/>
                    <line x1="21" y1="21" x2="43" y2="21"/>
                    <line x1="43" y1="21" x2="43" y2="43"/>
                </g>
                <g fill="#d8f4ff">
                    <circle cx="21" cy="21" r="5"/>
                    <circle cx="43" cy="21" r="5"/>
                    <circle cx="21" cy="43" r="5"/>
                    <circle cx="43" cy="43" r="5"/>
                </g>
                <circle cx="21" cy="21" r="2" fill="#0a2036"/>
                <circle cx="43" cy="43" r="2" fill="#0a2036"/>
            </svg>`
    },
    {
        id: 'simon',
        title: '记忆序列',
        tag: '休闲',
        category: '休闲',
        desc: '四块灯板依序亮起并发出不同音高，记住顺序再原样点回去。每过一轮序列加长，记岔一次就结束。',
        controls: '点击 / 数字键 1-4',
        url: 'games/simon/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2b1630 0%, #0b0710 70%)',
        glow: 'rgba(255, 92, 180, .30)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#0d0a14"/>
                <rect x="9" y="9" width="21" height="21" rx="6" fill="#7dffc8"/>
                <rect x="34" y="9" width="21" height="21" rx="6" fill="#ff6b8a"/>
                <rect x="9" y="34" width="21" height="21" rx="6" fill="#ffd166"/>
                <rect x="34" y="34" width="21" height="21" rx="6" fill="#5fd8ff"/>
                <rect x="24" y="24" width="16" height="16" rx="4" fill="#0d0a14"/>
                <circle cx="32" cy="32" r="3.4" fill="#ff6b8a"/>
            </svg>`
    },
    {
        id: 'basketball',
        title: '街头投篮',
        tag: '休闲',
        category: '休闲',
        desc: '六十秒街头投篮，拖动决定出手方向与力度。空心入网三分、擦框两分，连着命中还有额外加成。',
        controls: '拖动后松手',
        url: 'games/basketball/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #3a2010 0%, #140a06 70%)',
        glow: 'rgba(255, 138, 92, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#100c07"/>
                <rect x="36" y="8" width="19" height="13" rx="2" fill="none" stroke="#ffe0b0"
                      stroke-width="1.8"/>
                <path d="M31 22 H51" stroke="#ff8a5c" stroke-width="2.8" stroke-linecap="round"/>
                <g stroke="#ffd9c2" stroke-width="1.2" stroke-opacity=".75">
                    <path d="M33 23 L37 31"/>
                    <path d="M41 23 L42 31"/>
                    <path d="M49 23 L46 31"/>
                    <path d="M35 31 Q41 34 47 31"/>
                </g>
                <circle cx="23" cy="42" r="10" fill="#ff9a4d"/>
                <g stroke="#3a1e0a" stroke-width="1.6" fill="none">
                    <path d="M13 42 H33"/>
                    <path d="M23 32 V52"/>
                    <path d="M16 35 Q23 42 16 49"/>
                    <path d="M30 35 Q23 42 30 49"/>
                </g>
            </svg>`
    },
    {
        id: 'lunar',
        title: '登月舱',
        tag: '街机',
        category: '街机',
        desc: '控制登月舱的推力与姿态，在发光平台软着陆。三台登月舱，下落速度和机身角度都得压住。',
        controls: '← → 转向 / ↑ 推进',
        url: 'games/lunar/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #16233a 0%, #060a12 70%)',
        glow: 'rgba(160, 200, 255, .30)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#060c16"/>
                <circle cx="47" cy="13" r="2" fill="#cfe6ff" fill-opacity=".85"/>
                <circle cx="14" cy="18" r="1.3" fill="#cfe6ff" fill-opacity=".6"/>
                <circle cx="53" cy="25" r="1.1" fill="#cfe6ff" fill-opacity=".5"/>
                <path d="M7 45 Q16 37 25 43 Q33 49 41 41 Q49 34 57 39" fill="none"
                      stroke="#4f6f8f" stroke-width="2"/>
                <path d="M24 43 H38" stroke="#7dffc8" stroke-width="3" stroke-linecap="round"/>
                <path d="M28 18 H36 L38.5 30 H25.5 Z" fill="#dbe9f7"/>
                <path d="M30 13 H34" stroke="#9fb6c8" stroke-width="2" stroke-linecap="round"/>
                <path d="M26 30 L22 35 M38 30 L42 35" stroke="#9fb6c8" stroke-width="2"
                      stroke-linecap="round"/>
                <path d="M29 31 L27 36 M35 31 L37 36" stroke="#7fd8ff" stroke-width="2"
                      stroke-linecap="round" stroke-opacity=".8"/>
            </svg>`
    },
    {
        id: 'homerun',
        title: '全垒打',
        tag: '街机',
        category: '街机',
        desc: '十个球的对决，球飞到本垒板附近再挥棒。正中球心是全垒打，时机稍偏只能算安打，连击额外加分。',
        controls: '空格 / 点击',
        url: 'games/homerun/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #33280f 0%, #120d06 70%)',
        glow: 'rgba(255, 224, 138, .32)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#120e06"/>
                <path d="M20 47 L39 28" stroke="#e8c89a" stroke-width="5.4" stroke-linecap="round"/>
                <path d="M16 51 L22 45" stroke="#7a5a3a" stroke-width="6.4" stroke-linecap="round"/>
                <path d="M24 32 Q36 15 50 27" fill="none" stroke="#ffe08a" stroke-width="2"
                      stroke-dasharray="3 4" stroke-linecap="round"/>
                <circle cx="50" cy="27" r="4.6" fill="#f4f9ff"/>
                <path d="M46 31 Q50 34 54 31" fill="none" stroke="#c85a5a" stroke-width="1"
                      stroke-opacity=".7"/>
            </svg>`
    },
    {
        id: 'peg',
        title: '孔明棋',
        tag: '益智',
        category: '益智',
        desc: '英式十字棋盘，棋子隔子跳吃，被跳过的棋子会被吃掉。无法继续移动时结算，剩余棋子越少评级越高。',
        controls: '点击棋子 / 空格',
        url: 'games/peg/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #2d3a26 0%, #10160d 70%)',
        glow: 'rgba(125, 255, 200, .30)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#1a2416"/>
                <rect x="16" y="16" width="32" height="32" rx="4" fill="#c18e5a"/>
                <line x1="16" y1="24" x2="48" y2="24" stroke="#5a3d2b" stroke-width="1" opacity=".5"/>
                <line x1="16" y1="32" x2="48" y2="32" stroke="#5a3d2b" stroke-width="1" opacity=".5"/>
                <line x1="16" y1="40" x2="48" y2="40" stroke="#5a3d2b" stroke-width="1" opacity=".5"/>
                <line x1="24" y1="16" x2="24" y2="48" stroke="#5a3d2b" stroke-width="1" opacity=".5"/>
                <line x1="32" y1="16" x2="32" y2="48" stroke="#5a3d2b" stroke-width="1" opacity=".5"/>
                <line x1="40" y1="16" x2="40" y2="48" stroke="#5a3d2b" stroke-width="1" opacity=".5"/>
                <circle cx="32" cy="32" r="3.2" fill="#3a2a1a"/>
                <circle cx="32" cy="24" r="3.2" fill="#7dffc8"/>
                <circle cx="32" cy="40" r="3.2" fill="#7dffc8"/>
                <circle cx="24" cy="32" r="3.2" fill="#7dffc8"/>
                <circle cx="40" cy="32" r="3.2" fill="#7dffc8"/>
            </svg>`
    },
    {
        id: 'curling',
        title: '冰壶',
        tag: '休闲',
        category: '休闲',
        desc: '从冰道底端拖拽蓄力，把冰壶送进靶心。力度与角度都要恰到好处，三颗壶取最高一次得分。',
        controls: '拖拽后松手',
        url: 'games/curling/index.html',
        thumbBg: 'radial-gradient(120% 120% at 20% 0%, #162b38 0%, #070f14 70%)',
        glow: 'rgba(95, 216, 255, .30)',
        icon: `
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="54" height="54" rx="10" fill="#0c1820"/>
                <circle cx="32" cy="20" r="12" fill="none" stroke="#5fd8ff" stroke-width="1.5" opacity=".5"/>
                <circle cx="32" cy="20" r="7" fill="none" stroke="#ff6b8a" stroke-width="1.5" opacity=".5"/>
                <circle cx="32" cy="20" r="3" fill="#ff6b8a"/>
                <circle cx="32" cy="44" r="8" fill="#9dd0ff"/>
                <circle cx="32" cy="44" r="4" fill="#3a7fc4"/>
                <line x1="32" y1="32" x2="32" y2="36" stroke="#7fd8ff" stroke-width="1.5" stroke-dasharray="2 2"/>
            </svg>`
    }

];

const FILTERS = ['全部', '益智', '街机', '休闲'];

const gridEl = document.getElementById('game-grid');
const filterEl = document.getElementById('filter-bar');

let currentFilter = '全部';

/** 渲染分类筛选按钮 */
function renderFilters() {
    const counts = { '全部': GAMES.length };
    GAMES.forEach(function (g) {
        counts[g.category] = (counts[g.category] || 0) + 1;
    });

    filterEl.innerHTML = FILTERS.map(function (name) {
        if (!counts[name]) return '';
        const active = name === currentFilter ? ' active' : '';
        return '<button class="filter-btn' + active + '" data-filter="' + name + '">' +
            name + ' · ' + counts[name] + '</button>';
    }).join('');

    filterEl.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentFilter = btn.dataset.filter;
            renderFilters();
            renderGames();
        });
    });
}

/** 渲染游戏卡片 */
function renderGames() {
    const list = currentFilter === '全部'
        ? GAMES
        : GAMES.filter(function (g) { return g.category === currentFilter; });

    gridEl.innerHTML = list.map(function (g, i) {
        return '<a class="game-card" href="' + g.url + '" ' +
            'style="--glow:' + g.glow + ';--thumb-bg:' + g.thumbBg + ';animation-delay:' + (i * 60) + 'ms" ' +
            'aria-label="开始游戏 ' + g.title + '">' +
            '<div class="game-thumb">' + g.icon + '</div>' +
            '<h3>' + g.title + '<span class="game-tag">' + g.tag + '</span></h3>' +
            '<p class="game-desc">' + g.desc + '</p>' +
            '<div class="game-meta">' +
            '<span class="game-controls">' + g.controls + '</span>' +
            '<span class="game-play">开始挑战' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
            'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>' +
            '</span>' +
            '</div>' +
            '</a>';
    }).join('');
}

/** 顶部统计数字 */
function renderStats() {
    document.getElementById('stat-games').textContent = GAMES.length;
    const cats = new Set(GAMES.map(function (g) { return g.category; }));
    document.getElementById('stat-cats').textContent = cats.size;
}

renderStats();
renderFilters();
renderGames();
