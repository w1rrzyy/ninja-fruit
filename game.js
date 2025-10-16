const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Элементы UI и Меню ---
const uiContainer = document.getElementById('ui-container');
const coinDisplay = document.getElementById('coin-display');
const lifeDisplay = document.getElementById('life-display');
const shopButton = document.getElementById('shop-button');
const mainMenu = document.getElementById('main-menu');
const startButton = document.getElementById('start-button');
const menuShopButton = document.getElementById('menu-shop-button');
const shopModal = document.getElementById('shop-modal');
const shopItemsContainer = document.getElementById('shop-items');
const closeButton = document.querySelector('.close-button');

// Элементы Паузы и Рекорда
const pauseModal = document.getElementById('pause-modal');
const resumeButton = document.getElementById('resume-button');
const menuFromPauseButton = document.getElementById('menu-from-pause-button');
const highScoreDisplay = document.getElementById('high-score-display'); 

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FPS = 60;
const GRAVITY = 0.5; // КОНСТАНТА ГРАВИТАЦИИ

// --- Состояние ИГРЫ ---
let gameActive = false;
let isPaused = false; 
let score = 0;
let coins = 0; 
let lives = 3; 
let objects = []; 
let slicedParts = []; 
let bladePath = []; 
let lastSpawnTime = 0;
const spawnInterval = 1000; 
let animationFrameId = null;

// РЕКОРД (Загружаем из localStorage)
let highScore = parseInt(localStorage.getItem('highScore')) || 0; 

// Динамическая сложность
let difficultyLevel = 1.0; 
const maxSpeedMultiplier = 2.5; 
const speedIncreaseRate = 0.01; 

// Эмодзи для графики
const FRUIT_TYPES = [
    { name: 'Apple', symbol: '🍎', score: 10, coin: 2, leftSlice: '🍏', rightSlice: '🍎' },
    { name: 'Banana', symbol: '🍌', score: 15, coin: 3, leftSlice: '🍌', rightSlice: '🌟' },
    { name: 'Orange', symbol: '🍊', score: 12, coin: 2, leftSlice: '🍋', rightSlice: '🍊' },
];
const BOMB_TYPE = { name: 'Bomb', symbol: '💣', score: -50 };

let gameSettings = {
    bladeColor: '#FFFF00', 
    coinMultiplier: 1,     
    spawnChanceBomb: 0.15, 
    trailLength: 10,
};

const shopItems = [
    { id: 'color_blue', name: 'Синее Лезвие', cost: 50, property: 'bladeColor', value: '#00BFFF', bought: false },
    { id: 'mult_x2', name: 'Множитель Монет x2', cost: 150, property: 'coinMultiplier', value: 2, bought: false },
    { id: 'safer_cut', name: 'Снизить шанс Бомб', cost: 100, property: 'spawnChanceBomb', value: 0.05, bought: false },
    { id: 'color_red', name: 'Красное Лезвие', cost: 200, property: 'bladeColor', value: '#FF0000', bought: false },
];

// --- Класс GameObject ---
class GameObject {
    constructor(startX, startY, vx, vy) {
        this.isBomb = Math.random() < gameSettings.spawnChanceBomb;
        this.typeData = this.isBomb ? BOMB_TYPE : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
        this.size = 60;
        this.x = startX;
        this.y = startY;
        this.vx = vx; 
        this.vy = vy; 
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 5;
        this.cut = false;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy; 
        this.rotation += this.rotationSpeed;
    }
    draw() {
        if (this.cut) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.typeData.symbol, 0, 0);
        ctx.restore();
    }
}

// --- Класс SlicedPart (С гравитацией) ---
class SlicedPart {
    constructor(x, y, vxBase, vyBase, rotationSpeed, isBomb, symbol, direction) {
        this.x = x;
        this.y = y;
        
        // Уменьшенный импульс для более плавного разлета
        const sideImpulse = direction === 'left' ? -5 : 5; 
        this.vx = vxBase * 1.5 + sideImpulse; // Меньший множитель для унаследованной скорости
        this.vy = vyBase * 1.5 + (Math.random() - 0.5) * 3; 
        
        this.rotationSpeed = rotationSpeed * 2 * (direction === 'left' ? -1 : 1);
        this.rotation = Math.random() * 360;
        this.size = 30;
        this.isBomb = isBomb;
        this.symbol = symbol;
        this.color = isBomb ? 'orange' : 'white';
    }
    update() {
        this.x += this.vx;
        this.vy += GRAVITY; // <-- Гравитация: части падают
        this.y += this.vy; 
        this.rotation += this.rotationSpeed;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.color;
        ctx.fillText(this.symbol, 0, 0);
        ctx.restore();
    }
}

// --- Логика Спавна (Без изменений) ---
function spawnObject() {
    const spawnSide = Math.floor(Math.random() * 4); 
    let startX, startY;
    let baseSpeed = Math.random() * 2 + 1; 
    let speed = baseSpeed * difficultyLevel; 
    let vx, vy;
    const drift = (Math.random() - 0.5) * 1; 

    if (spawnSide === 0) { // Сверху
        startX = Math.random() * WIDTH;
        startY = -60;
        vx = drift;
        vy = speed; 
    } else if (spawnSide === 1) { // Снизу
        startX = Math.random() * WIDTH;
        startY = HEIGHT + 60;
        vx = drift;
        vy = -speed; 
    } else if (spawnSide === 2) { // Слева
        startX = -60;
        startY = Math.random() * HEIGHT;
        vx = speed; 
        vy = drift;
    } else { // Справа
        startX = WIDTH + 60;
        startY = Math.random() * HEIGHT;
        vx = -speed; 
        vy = drift;
    }
    objects.push(new GameObject(startX, startY, vx, vy));
}

// --- Функции Паузы и Меню ---
function togglePause() {
    if (!gameActive) return;
    isPaused = !isPaused;
    if (isPaused) {
        cancelAnimationFrame(animationFrameId);
        pauseModal.style.display = 'block';
    } else {
        pauseModal.style.display = 'none';
        gameLoop(); 
    }
}

function returnToMenu() {
    isPaused = false;
    gameActive = false;
    pauseModal.style.display = 'none';
    checkAndUpdateHighScore(); 
    drawGame(); 
}

// --- Логика Рекорда ---
function checkAndUpdateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', score); 
    }
}

// --- Обновление Игры (Без изменений) ---
function updateGame() {
    if (!gameActive) return; 
    if (difficultyLevel < maxSpeedMultiplier) {
        difficultyLevel += speedIncreaseRate / FPS; 
    }
    
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        obj.update();
        
        const isFarOutside = 
            obj.y > HEIGHT + obj.size * 2 ||
            obj.y < -obj.size * 2 ||
            obj.x > WIDTH + obj.size * 2 ||
            obj.x < -obj.size * 2;
        
        if (isFarOutside) {
            objects.splice(i, 1);
        }
    }
    
    for (let i = slicedParts.length - 1; i >= 0; i--) {
        const part = slicedParts[i];
        part.update();
        if (part.y > HEIGHT + 50 || part.y < -50 || part.x < -50 || part.x > WIDTH + 50) {
            slicedParts.splice(i, 1);
        }
    }

    const now = Date.now();
    if (now - lastSpawnTime > spawnInterval) {
        spawnObject();
        lastSpawnTime = now;
    }
    
    while (bladePath.length > gameSettings.trailLength) {
        bladePath.shift();
    }
}

// --- Логика Разрезания (ИСПРАВЛЕН Game Over) ---
function checkCut() {
    if (bladePath.length < 2) return;
    
    const lastPoint = bladePath[bladePath.length - 1];
    let partsToAdd = [];

    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.cut) continue;

        const distToCenter = Math.hypot(obj.x - lastPoint.x, obj.y - lastPoint.y);
        
        if (distToCenter < obj.size / 2) {
            obj.cut = true;
            
            if (obj.isBomb) {
                lives--; 
                
                if (lives <= 0) {
                     gameActive = false;
                     checkAndUpdateHighScore();
                     
                     // Немедленная остановка цикла и обновление экрана
                     cancelAnimationFrame(animationFrameId);
                     drawGame(); 
                     return; 
                }
                
                for(let k = 0; k < 8; k++) {
                    partsToAdd.push(new SlicedPart(obj.x, obj.y, obj.vx, obj.vy, obj.rotationSpeed, true, '💥', k % 2 === 0 ? 'left' : 'right'));
                }
                objects.splice(i, 1); 
                break;
            } else {
                const fruitData = obj.typeData;
                
                partsToAdd.push(new SlicedPart(obj.x, obj.y, obj.vx, obj.vy, obj.rotationSpeed, false, fruitData.leftSlice, 'left'));
                partsToAdd.push(new SlicedPart(obj.x, obj.y, obj.vx, obj.vy, obj.rotationSpeed, false, fruitData.rightSlice, 'right'));
                
                score += obj.typeData.score;
                coins += obj.typeData.coin * gameSettings.coinMultiplier;
            }

            objects.splice(i, 1);
        }
    }
    
    if (partsToAdd.length > 0) {
        slicedParts.push(...partsToAdd);
        // Увеличиваем время жизни разлета до 300мс
        setTimeout(() => {
            slicedParts = slicedParts.filter(p => !partsToAdd.includes(p));
        }, 300); 
    }
}

// --- Главный Цикл ---
function gameLoop() {
    if (!gameActive || isPaused) return; 

    updateGame();
    drawGame();
    checkCut();
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Рисование и UI (ИСПРАВЛЕНО лезвие) ---
function drawGame() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    objects.forEach(obj => obj.draw());
    slicedParts.forEach(part => part.draw());

    if (bladePath.length > 1) {
        ctx.strokeStyle = gameSettings.bladeColor;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = gameSettings.bladeColor;
        
        ctx.beginPath();
        for (let i = 0; i < bladePath.length - 1; i++) {
            ctx.globalAlpha = i / bladePath.length;
            ctx.moveTo(bladePath[i].x, bladePath[i].y);
            // ИСПРАВЛЕНИЕ: Правильная Y координата
            ctx.lineTo(bladePath[i + 1].x, bladePath[i + 1].y); 
        }
        ctx.stroke();
        
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }
    
    coinDisplay.textContent = `💰 Монеты: ${coins}`;
    lifeDisplay.textContent = `❤️ Жизни: ${lives}`;
    
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`СЧЕТ: ${score}`, WIDTH / 2, 40);
    
    if (!gameActive) {
        highScoreDisplay.textContent = `Рекорд: ${highScore}`;

        canvas.style.display = 'none'; 
        uiContainer.style.display = 'none'; 
        pauseModal.style.display = 'none'; 
        mainMenu.style.display = 'flex';
        
        if (score > 0 || lives < 3) {
            startButton.textContent = `▶ Рестарт (Счет: ${score})`; 
        } else {
            startButton.textContent = '▶ Начать Игру'; 
        }
    } else {
        canvas.style.display = 'block'; 
        uiContainer.style.display = 'flex'; 
        mainMenu.style.display = 'none';
    }
}

// --- Запуск Игры (Без изменений) ---
function startNewGame() {
    score = 0;
    lives = 3; 
    objects = [];
    slicedParts = [];
    bladePath = [];
    lastSpawnTime = Date.now();
    difficultyLevel = 1.0; 
    isPaused = false;
    
    gameActive = true;
    mainMenu.style.display = 'none';
    canvas.style.display = 'block';
    gameLoop();
}

// --- Функции Магазина (Без изменений) ---
function renderShop() {
    shopItemsContainer.innerHTML = '';
    shopItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        
        const status = item.bought ? ' (Куплено)' : ` (${item.cost} 💰)`;
        div.innerHTML = `
            <span>${item.name}</span>
            <button class="buy-button" data-id="${item.id}" ${item.bought ? 'disabled' : ''}>
                ${item.bought ? 'Куплено' : 'Купить' + status}
            </button>
        `;
        shopItemsContainer.appendChild(div);
    });

    document.querySelectorAll('.buy-button').forEach(button => {
        if (!button.disabled) {
            button.onclick = handleBuy;
        }
    });
}

function handleBuy(event) {
    const itemId = event.target.dataset.id;
    const item = shopItems.find(i => i.id === itemId);

    if (item && coins >= item.cost && !item.bought) {
        coins -= item.cost;
        item.bought = true;
        
        gameSettings[item.property] = item.value;
        
        renderShop();
        coinDisplay.textContent = `💰 Монеты: ${coins}`;
        alert(`Поздравляем! Вы купили: ${item.name}.`);
    } else if (item.bought) {
        alert('Этот предмет уже куплен.');
    } else {
        alert('Недостаточно монет! Продолжайте рубить фрукты.');
    }
}

// --- Обработчики Мыши (ИСПРАВЛЕНО лезвие) ---
let isCutting = false;

function handleMouseDown(e) {
    if (!gameActive || isPaused) return; 
    isCutting = true;
    bladePath = [];
    handleMouseMove(e);
}

function handleMouseUp() {
    isCutting = false;
    bladePath = []; // Гарантируем очистку
}

function handleMouseLeave() {
    isCutting = false;
    bladePath = []; // Гарантируем очистку
}

function handleMouseMove(e) {
    if (!isCutting || !gameActive || isPaused) { 
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    bladePath.push({ x, y });
}

// --- Инициализация (Без изменений) ---
function init() {
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave); 
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            togglePause();
        }
    });

    startButton.onclick = startNewGame;
    resumeButton.onclick = togglePause;
    menuFromPauseButton.onclick = returnToMenu;
    
    const openShop = () => {
        if (shopModal.style.display === 'block') return; 
        renderShop();
        shopModal.style.display = 'block';
    };
    
    menuShopButton.onclick = openShop;
    shopButton.onclick = openShop;

    closeButton.onclick = () => {
        shopModal.style.display = 'none';
    };
    window.onclick = (event) => {
        if (event.target === shopModal) {
            shopModal.style.display = 'none';
        }
    };
    
    drawGame(); 
}

init();