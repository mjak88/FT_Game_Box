const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('scoreDisplay');
const timerDisplay = document.getElementById('timerDisplay');

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycby18DI4Y6ReQPlTVq0O5El5IHxXc3GP0sg0vxUTtcOnPMCSSOwxUZhk1nU_jVeTvtgWkQ/exec"; 

let score = 0, timeLeft = 30, gameActive = true, timerInterval, audioCtx = null, glowPulse = 0, stars = [];
let crystals = [], spawnTimer = 0, spawnRate = 25;

const character = { x: canvas.width - 100, y: canvas.height - 180, width: 60, height: 120, skinColor: '#F5CBA7', shirtColor: '#C0392B', pantsColor: '#2E86C1' };
const arm = { startX: character.x, startY: character.y + 40, currentX: character.x, targetX: 30, state: 'IDLE', speed: 45, hatWidth: 50, hatHeight: 25, baseColor: '#D35400', bandColor: '#C0392B' };

canvas.addEventListener('mousedown', triggerArm);
canvas.addEventListener('touchstart', e => { e.preventDefault(); triggerArm(); });
window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); triggerArm(); } });

function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function triggerArm() {
    initAudio();
    if (!gameActive) return;
    if (arm.state === 'IDLE') arm.state = 'EXTENDING';
}

function playCollectSound(isSmall) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (isSmall) {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else {
        osc.type = 'sine'; osc.frequency.setValueAtTime(500, now); osc.frequency.exponentialRampToValueAtTime(1000, now + 0.12);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

function generateStars() {
    stars = [];
    for (let i = 0; i < 200; i++) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2, opacity: Math.random() });
}

function spawnCrystal() {
    const isSmall = Math.random() < 0.35;
    let size = isSmall ? Math.random() * 5 + 15 : Math.random() * 8 + 28;
    let speed = isSmall ? Math.random() * 3 + 6 : Math.random() * 2 + 2.5;
    crystals.push({ x: Math.random() * (canvas.width - 250) + 100, y: -size, size, speed, points: isSmall ? 3 : 1, isSmall });
}

async function endClawGame() {
    gameActive = false;
    clearInterval(timerInterval);

    // 1. Calculate the prize won based on game performance score thresholds
    let prizeWon = "Hard Luck";
    if (score >= 45) prizeWon = "Free Dessert & Drink";
    else if (score >= 25) prizeWon = "Free Super Side";
    else if (score >= 10) prizeWon = "Free Fruit Juice";

    // 2. Pull the active coupon code out of tablet browser session storage
    const odooOrderId = sessionStorage.getItem('active_coupon') || "TEST_CLAW";
    const phone = sessionStorage.getItem('customer_phone') || "GUEST";

    // 3. Build a clean, synchronous GET payload URL to bypass CORS blocks completely
    const targetUrl = `${GOOGLE_URL}?action=recordWin&code=${encodeURIComponent(odooOrderId)}&prize=${encodeURIComponent(prizeWon)}&phone=${encodeURIComponent(phone)}`;

    try {
        console.log("Transmitting burn request...");
        // Use GET with no-cors to successfully punch through backend endpoints
        await fetch(targetUrl, { method: 'GET', mode: 'no-cors' });
        console.log("Coupon burn registered.");
    } catch(err) { 
        console.error("Network communication error:", err); 
    }

    // 4. Wipe out browser temporary state files to prevent page back-button exploits
    sessionStorage.clear();

    // 5. Notify the player and redirect back to the home screen carousel
    setTimeout(() => {
        alert(`Time's Up! Total Collected: ${score} pts.\nReward: ${prizeWon}`);
        window.location.href = "../../index.html";
    }, 500);
}

function update() {
    if (!gameActive) return;
    glowPulse += 0.15;

    if (arm.state === 'EXTENDING') {
        arm.currentX -= arm.speed;
        if (arm.currentX <= arm.targetX) { arm.currentX = arm.targetX; arm.state = 'RETRACTING'; }
    } else if (arm.state === 'RETRACTING') {
        arm.currentX += arm.speed;
        if (arm.currentX >= arm.startX) { arm.currentX = arm.startX; arm.state = 'IDLE'; }
    }

    spawnTimer++;
    if (spawnTimer >= spawnRate) { spawnCrystal(); spawnTimer = 0; }

    for (let i = crystals.length - 1; i >= 0; i--) {
        let c = crystals[i]; c.y += c.speed;
        let hatLeft = arm.currentX - arm.hatWidth / 2, hatRight = arm.currentX + arm.hatWidth / 2;
        let hatTop = arm.startY - arm.hatHeight / 2, hatBottom = arm.startY + arm.hatHeight / 2;

        if (c.x + c.size > hatLeft && c.x < hatRight && c.y + c.size > hatTop && c.y < hatBottom) {
            playCollectSound(c.isSmall); score += c.points;
            scoreDisplay.textContent = `Score: ${score}`; crystals.splice(i, 1); continue;
        }
        if (c.y > canvas.height) crystals.splice(i, 1);
    }

    stars.forEach(s => { s.opacity += (Math.random() - 0.5) * 0.1; if (s.opacity < 0) s.opacity = 0; if (s.opacity > 1) s.opacity = 1; });
    render();
    requestAnimationFrame(update);
}

function render() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/1.2);
    bgGrad.addColorStop(0, '#100030'); bgGrad.addColorStop(0.5, '#000010'); bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad; ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = '#fff';
    stars.forEach(s => { ctx.globalAlpha = s.opacity; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill(); });
    ctx.globalAlpha = 1;

    ctx.save(); ctx.translate(character.x, character.y);
    ctx.fillStyle = character.shirtColor; ctx.fillRect(0, 20, character.width, 60);
    ctx.fillStyle = character.pantsColor; ctx.fillRect(0, 80, character.width, 40);
    ctx.fillStyle = character.skinColor; ctx.beginPath(); ctx.arc(character.width/2, 0, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(character.width/2, -10, 25, 0, Math.PI, true); ctx.fill();
    ctx.restore();

    if (arm.state !== 'IDLE' || arm.currentX !== arm.startX) {
        ctx.strokeStyle = character.skinColor; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(arm.startX, arm.startY); ctx.lineTo(arm.currentX, arm.startY); ctx.stroke();
        ctx.save(); ctx.translate(arm.currentX, arm.startY);
        ctx.fillStyle = arm.baseColor; ctx.beginPath(); ctx.ellipse(0, 0, arm.hatWidth/2, arm.hatHeight/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = arm.bandColor; ctx.fillRect(-arm.hatWidth/2, -arm.hatHeight/4, arm.hatWidth, arm.hatHeight/2);
        ctx.restore();
    } else {
        ctx.save(); ctx.translate(character.x + character.width/2, character.y - 15);
        ctx.fillStyle = arm.baseColor; ctx.beginPath(); ctx.ellipse(0, 0, arm.hatWidth/2, arm.hatHeight/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = arm.bandColor; ctx.fillRect(-arm.hatWidth/2, -arm.hatHeight/4, arm.hatWidth, arm.hatHeight/2);
        ctx.restore();
    }

    let glowSize = 20 + Math.sin(glowPulse) * 8;
    crystals.forEach(c => {
        ctx.save(); ctx.shadowBlur = glowSize; ctx.shadowColor = '#ff0044';
        let rad = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, c.size);
        rad.addColorStop(0, '#000000'); rad.addColorStop(1, '#ff0033');
        ctx.fillStyle = rad; ctx.beginPath();
        ctx.moveTo(c.x, c.y - c.size/1.5); ctx.lineTo(c.x + c.size/2, c.y); ctx.lineTo(c.x, c.y + c.size/1.5); ctx.lineTo(c.x - c.size/2, c.y);
        ctx.closePath(); ctx.fill(); ctx.restore();
    });
}

function startTimer() {
    generateStars();
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time: ${timeLeft}s`;
        if (timeLeft <= 0) endClawGame();
    }, 1000);
}

if (!sessionStorage.getItem('active_coupon')) {
    window.location.href = "../../index.html";
} else {
    startTimer();
    update();
}
