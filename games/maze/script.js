const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('status');
const timerText = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

const mazeWidth = 25; 
const mazeHeight = 25;
const cellSize = 18; 

canvas.width = mazeWidth * cellSize;
canvas.height = mazeHeight * cellSize;

let maze = [];
let player = { x: 1, y: 1 };
let goal = { x: mazeWidth - 2, y: mazeHeight - 2 };
let gameActive = false;
let timeRemaining = 60.0;
const maxTimeLimit = 60.0;
let gameInterval = null;
let solutionPath = [];

// Unified Backend Sync Webhook Configuration
const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbxHucKCCGnTlVtbDEAVQ0uoXVkOB4PE9Ax1a23RqoGaGKS3EL3TKGMlxzMuscolMiCi/exec";

function initMaze() {
    maze = [];
    for (let y = 0; y < mazeHeight; y++) {
        maze[y] = [];
        for (let x = 0; x < mazeWidth; x++) maze[y][x] = 1;
    }
}

function generateMaze() {
    initMaze();
    let stack = [];
    let current = { x: 1, y: 1 };
    maze[current.y][current.x] = 0;

    while (true) {
        let neighbors = [];
        let directions = [{ x: 0, y: -2 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 2, y: 0 }];

        directions.forEach(dir => {
            let nx = current.x + dir.x;
            let ny = current.y + dir.y;
            if (nx > 0 && nx < mazeWidth - 1 && ny > 0 && ny < mazeHeight - 1) {
                if (maze[ny][nx] === 1) neighbors.push({ x: nx, y: ny, dx: dir.x / 2, dy: dir.y / 2 });
            }
        });

        if (neighbors.length > 0) {
            let next = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[current.y + next.dy][current.x + next.dx] = 0;
            maze[next.y][next.x] = 0;
            stack.push(current);
            current = { x: next.x, y: next.y };
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break;
        }
    }
    findSolution();
}

function findSolution() {
    let queue = [[{x: 1, y: 1}]];
    let visited = Array(mazeHeight).fill().map(() => Array(mazeWidth).fill(false));
    visited[1][1] = true;

    while(queue.length > 0) {
        let path = queue.shift();
        let curr = path[path.length - 1];

        if(curr.x === goal.x && curr.y === goal.y) {
            solutionPath = path;
            return;
        }

        let dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        for(let d of dirs) {
            let nx = curr.x + d.x, ny = curr.y + d.y;
            if(maze[ny] && maze[ny][nx] === 0 && !visited[ny][nx]) {
                visited[ny][nx] = true;
                queue.push([...path, {x: nx, y: ny}]);
            }
        }
    }
}

function draw(showSolution = false) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < mazeHeight; y++) {
        for (let x = 0; x < mazeWidth; x++) {
            ctx.fillStyle = (maze[y][x] === 1) ? '#1f2937' : '#030712';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }
    if (showSolution) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        solutionPath.forEach(pt => ctx.fillRect(pt.x * cellSize + 1, pt.y * cellSize + 1, cellSize - 2, cellSize - 2));
    }
    ctx.fillStyle = '#10b981'; 
    ctx.fillRect(goal.x * cellSize + 1, goal.y * cellSize + 1, cellSize - 2, cellSize - 2);
    ctx.fillStyle = '#3b82f6'; 
    ctx.fillRect(player.x * cellSize + 2, player.y * cellSize + 2, cellSize - 4, cellSize - 4);
}

function movePlayer(dx, dy) {
    if (!gameActive) return;
    const targetX = player.x + dx;
    const targetY = player.y + dy;

    if (maze[targetY] && maze[targetY][targetX] === 0) {
        player.x = targetX;
        player.y = targetY;
        draw();
        if (player.x === goal.x && player.y === goal.y) gameOver(true);
    }
}

function startTimer() {
    clearInterval(gameInterval);
    timeRemaining = maxTimeLimit;
    gameInterval = setInterval(() => {
        timeRemaining -= 0.1;
        if (timeRemaining <= 0) {
            timeRemaining = 0;
            gameOver(false);
        }
        timerText.textContent = timeRemaining.toFixed(1) + "s";
        progressBar.style.width = (timeRemaining / maxTimeLimit * 100) + "%";
    }, 100);
}

async function gameOver(isWin) {
    gameActive = false;
    clearInterval(gameInterval);
    
    // 1. Calculate the prize based on remaining time thresholds
    let prizeWon = "Hard Luck";
    if (isWin) {
        if (timeRemaining > 35) prizeWon = "Free Main Dish";
        else if (timeRemaining > 15) prizeWon = "Free Appetizer";
        else prizeWon = "Free Soft Drink";
        
        statusText.textContent = "🏆 ESCAPED!";
        statusText.style.color = "#10b981";
    } else {
        statusText.textContent = "💥 TIME OUT!";
        statusText.style.color = "#ef4444";
        draw(true); // Reveals solution path
    }

    // 2. Fetch active session identifiers
    const couponCode = sessionStorage.getItem('active_coupon') || "TEST_MAZE";
    const phone = sessionStorage.getItem('customer_phone') || "GUEST";

    // 3. Construct the clean GET payload URL string
    const targetUrl = `${GOOGLE_URL}?action=recordWin&code=${encodeURIComponent(couponCode)}&prize=${encodeURIComponent(prizeWon)}&phone=${encodeURIComponent(phone)}`;

    try {
        console.log("Transmitting burn request to backend via GET...");
        // Use GET method with no-cors configuration to clear sheet data lines securely
        await fetch(targetUrl, { method: 'GET', mode: 'no-cors' });
        console.log("Maze coupon burn successfully transmitted.");
    } catch(err) { 
        console.error("Network communication error:", err); 
    }

    // 4. Wipe out session validation footprints
    sessionStorage.clear();

    // 5. Notify player and redirect to welcome hub page frame
    setTimeout(() => {
        alert(`Game Complete! Reward: ${prizeWon}`);
        window.location.href = "../../index.html";
    }, 500);
}

function resetGame() {
    player = { x: 1, y: 1 };
    statusText.textContent = "Find the green exit square!";
    statusText.style.color = "#e2e8f0";
    gameActive = true;
    generateMaze();
    draw();
    startTimer();
}

// Attach Inputs
window.addEventListener('keydown', e => {
    switch(e.key.toLowerCase()) {
        case 'arrowup': case 'w': movePlayer(0, -1); e.preventDefault(); break;
        case 'arrowdown': case 's': movePlayer(0, 1); e.preventDefault(); break;
        case 'arrowleft': case 'a': movePlayer(-1, 0); e.preventDefault(); break;
        case 'arrowright': case 'd': movePlayer(1, 0); e.preventDefault(); break;
    }
});

document.getElementById('up').addEventListener('touchstart', (e) => { movePlayer(0, -1); e.preventDefault(); });
document.getElementById('left').addEventListener('touchstart', (e) => { movePlayer(-1, 0); e.preventDefault(); });
document.getElementById('right').addEventListener('touchstart', (e) => { movePlayer(1, 0); e.preventDefault(); });
document.getElementById('down').addEventListener('touchstart', (e) => { movePlayer(0, 1); e.preventDefault(); });

document.getElementById('up').addEventListener('mousedown', () => movePlayer(0, -1));
document.getElementById('left').addEventListener('mousedown', () => movePlayer(-1, 0));
document.getElementById('right').addEventListener('mousedown', () => movePlayer(1, 0));
document.getElementById('down').addEventListener('mousedown', () => movePlayer(0, 1));

// Initialize On Entry
if (!sessionStorage.getItem('active_coupon')) {
    window.location.href = "../../index.html";
} else {
    resetGame();
}
