const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycby18DI4Y6ReQPlTVq0O5El5IHxXc3GP0sg0vxUTtcOnPMCSSOwxUZhk1nU_jVeTvtgWkQ/exec"; 

function playSound(type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'shoot') { osc.frequency.value = 400; gain.gain.setValueAtTime(0.1, audioCtx.currentTime); }
    else if (type === 'win') { osc.frequency.setValueAtTime(600, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2); }
    else if (type === 'draw') { osc.frequency.value = 300; }
    else if (type === 'lose') { osc.frequency.value = 150; }
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

let score = 0, time = 60, enemy = null, playerProj = null, particles = [];
const colors = {'Fire': '#FF4500', 'Water': '#1E90FF', 'Grass': '#32CD32'};
let gameLoopActive = true;

function createParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 20, color });
    }
}

function spawnEnemy() {
    if (time <= 0 || !gameLoopActive) return;
    if (!enemy) enemy = { type: ['Fire', 'Water', 'Grass'][Math.floor(Math.random() * 3)], x: 0, y: 150, speed: Math.random() * 8 + 6 };
    setTimeout(spawnEnemy, 1000);
}

function handleInput(type) {
    if (!gameLoopActive) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!playerProj && enemy) {
        playerProj = { type: type, x: 750, y: 150 };
        playSound('shoot');
    }
}

async function terminateMatrixGame() {
    gameLoopActive = false;
    
    // 1. Calculate the prize based on the player's matrix hit points score
    let prizeWon = "Hard Luck";
    if (score >= 25) prizeWon = "Free Combo Meal";
    else if (score >= 15) prizeWon = "Free Sushi Roll";
    else if (score >= 7) prizeWon = "Free Soft Drink";

    // 2. Retrieve the matching storage validation credentials
    const odooOrderId = sessionStorage.getItem('active_coupon') || "TEST_ELEMENTS";
    const phone = sessionStorage.getItem('customer_phone') || "GUEST";

    // 3. Assemble the updated GET webhook URL structure
    const targetUrl = `${GOOGLE_URL}?action=recordWin&code=${encodeURIComponent(odooOrderId)}&prize=${encodeURIComponent(prizeWon)}&phone=${encodeURIComponent(phone)}`;

    try {
        console.log("Transmitting element score data via GET payload...");
        await fetch(targetUrl, { method: 'GET', mode: 'no-cors' });
        console.log("Elements entry cleared and tracking logged.");
    } catch(err) { 
        console.error("Network synchronization issue encountered:", err); 
    }

    // 4. Clean storage tokens to lock out re-runs
    sessionStorage.clear();

    // 5. Present the user alert and loop back smoothly
    setTimeout(() => {
        alert(`Game Over! Total Matrix Points: ${score}.\nReward: ${prizeWon}`);
        window.location.href = "../../index.html";
    }, 500);
}

function update() {
    if (!gameLoopActive) return;
    ctx.clearRect(0, 0, 800, 300);
    ctx.fillStyle = "#fff"; ctx.fillRect(770, 130, 20, 40);

    if (enemy) {
        ctx.fillStyle = colors[enemy.type];
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2); ctx.fill();
        enemy.x += enemy.speed;
        if (enemy.x >= 770) { score--; playSound('lose'); enemy = null; document.getElementById('score').innerText = score; }
    }

    if (playerProj) {
        ctx.fillStyle = colors[playerProj.type];
        ctx.beginPath(); ctx.arc(playerProj.x, playerProj.y, 10, 0, Math.PI * 2); ctx.fill();
        playerProj.x -= 10;
        if (enemy && Math.abs(enemy.x - playerProj.x) < 25) {
            createParticles(enemy.x, enemy.y, colors[enemy.type]);
            if ((playerProj.type === 'Water' && enemy.type === 'Fire') || (playerProj.type === 'Grass' && enemy.type === 'Water') || (playerProj.type === 'Fire' && enemy.type === 'Grass')) {
                score++; playSound('win');
            } else if (playerProj.type === enemy.type) {
                playSound('draw');
            } else {
                score--; playSound('lose');
            }
            enemy = null; playerProj = null;
            document.getElementById('score').innerText = score;
        } else if (playerProj.x < 0) playerProj = null;
    }

    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4);
        if (p.life <= 0) particles.splice(i, 1);
    });
    
    requestAnimationFrame(update);
}

const countdown = setInterval(() => {
    if (time > 0) {
        time--;
        document.getElementById('timer').innerText = time;
    } else {
        clearInterval(countdown);
        terminateMatrixGame();
    }
}, 1000);

// Attach Action Listeners Safely
document.getElementById('fire').addEventListener('click', () => handleInput('Fire'));
document.getElementById('water').addEventListener('click', () => handleInput('Water'));
document.getElementById('grass').addEventListener('click', () => handleInput('Grass'));

if (!sessionStorage.getItem('active_coupon')) {
    window.location.href = "../../index.html";
} else {
    spawnEnemy(); 
    update();
}
