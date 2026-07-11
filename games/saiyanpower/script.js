const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbxGLAXJpIhqPxxmMsoqhxD1aZHbIGslnuO4GSPRRKKylzdzEzs3ZeMaMVkoU1YyWNMBEw/exec";

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    
    if (type === 'shoot') { 
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime); 
    }
    else if (type === 'win') { 
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.08); 
        osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.16); 
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    }
    else if (type === 'draw') { 
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    }
    else if (type === 'lose') { 
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime); 
        osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime); 
    }
    else if (type === 'talk') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    }
    
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(); 
    osc.stop(audioCtx.currentTime + 0.4);
}

// Global States: 'intro', 'countdown', 'battle', 'ended'
let gameState = 'intro'; 
let score = 0;
let time = 60;
let enemies = []; 
let playerProj = null;
let particles = [];
let screenShake = 0;
let frameCount = 0;
let gameLoopActive = true;

// Intro Story Script Properties
const introLines = [
    "AI RIVAL: Hmph... So you are the one they call the Master of Elements?",
    "AI RIVAL: Don't make me laugh! Your power levels are completely pathetic.",
    "AI RIVAL: Let's see if those fragile magic spheres of yours can even scratch my armor!",
    "AI RIVAL: SHOW ME WHAT YOU'VE GOT, EARTHLING! HAAAAAA!!!"
];
let currentLineIdx = 0;
let displayedText = "";
let textCharIdx = 0;
let textTickerTimer = 0;

// Battle Countdown Properties
let battleCountdownVal = 3;
let countdownTimer = 0;

const colors = {'Fire': '#FF4500', 'Water': '#00FFFF', 'Grass': '#32CD32'};
const auraColors = {'Fire': 'rgba(255,69,0,0.35)', 'Water': 'rgba(0,255,255,0.35)', 'Grass': 'rgba(50,205,50,0.35)'};

const fighterAI = {
    x: 80, y: 220,
    width: 70, height: 110,
    auraColor: 'rgba(239, 68, 68, 0.25)',
    hairColor: '#3b82f6',
    suitColor: '#1e293b' 
};

const fighterPlayer = {
    x: canvas.width - 150, y: 220,
    width: 70, height: 110,
    auraColor: 'rgba(245, 158, 11, 0.25)',
    hairColor: '#f59e0b',
    suitColor: '#ea580c' 
};

function createParticles(x, y, color) {
    for (let i = 0; i < 25; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            radius: Math.random() * 5 + 2,
            life: 30,
            color
        });
    }
}

// Balanced AI Single Shot Logic Engine
function triggerRandomAIShot() {
    if (gameState !== 'battle') return;

    const elements = ['Fire', 'Water', 'Grass'];
    
    // Difficulty Level calculated cleanly for every 10 points
    let levelTier = Math.max(0, Math.floor(score / 10));
    
    // Base Shooting Delay dynamically scales down as points climb up
    let baseMinDelay = Math.max(450, 1200 - (levelTier * 180));
    let baseMaxDelay = Math.max(900, 2500 - (levelTier * 300));

    // Choose exactly ONE random elemental type (Fair Single Shot Mode)
    let chosenType = elements[Math.floor(Math.random() * elements.length)];
    let randomSpeed = 4.5 + Math.random() * 4.0 + (levelTier * 0.6); 

    enemies.push({
        x: fighterAI.x + fighterAI.width,
        y: fighterAI.y + 40,
        type: chosenType,
        speed: randomSpeed
    });

    playSound('shoot');

    // Recursively queue the next single attack frame interval
    const randomNextDelay = baseMinDelay + Math.random() * (baseMaxDelay - baseMinDelay);
    setTimeout(triggerRandomAIShot, randomNextDelay);
}

function handleInput(type) {
    if (gameState !== 'battle' || playerProj) return;
    
    playerProj = {
        x: fighterPlayer.x,
        y: fighterPlayer.y + 40,
        type: type,
        speed: 9.0
    };
    playSound('shoot');
}

function drawBackground() {
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#1e1b4b');
    skyGrad.addColorStop(0.4, '#311042');
    skyGrad.addColorStop(0.7, '#d97706');
    skyGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (Math.random() > 0.94) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, 0);
        ctx.lineTo(Math.random() * canvas.width, canvas.height * 0.7);
        ctx.stroke();
    }

    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.85);
    ctx.lineTo(120, canvas.height * 0.55);
    ctx.lineTo(280, canvas.height * 0.7);
    ctx.lineTo(450, canvas.height * 0.45);
    ctx.lineTo(620, canvas.height * 0.68);
    ctx.lineTo(780, canvas.height * 0.5);
    ctx.lineTo(canvas.width, canvas.height * 0.85);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.fill();

    ctx.fillStyle = '#292524';
    ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
    ctx.fillStyle = '#78716c';
    ctx.fillRect(0, canvas.height - 70, canvas.width, 6);
}

function drawFighter(f, isPlayer) {
    ctx.save();
    let auraPulse = 10 + Math.sin(frameCount * 0.15) * 4;
    ctx.shadowBlur = auraPulse;
    ctx.shadowColor = f.hairColor;
    
    ctx.fillStyle = f.auraColor;
    ctx.beginPath();
    ctx.arc(f.x + f.width/2, f.y + f.height/2, f.height * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = f.suitColor;
    ctx.fillRect(f.x, f.y + 35, f.width, f.height - 35);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(f.x - 2, f.y + 65, f.width + 4, 10);
    ctx.fillStyle = '#ffedd5';
    ctx.fillRect(f.x + 15, f.y, f.width - 30, 35);

    ctx.fillStyle = f.hairColor;
    ctx.beginPath();
    if (isPlayer) {
        ctx.moveTo(f.x + 15, f.y + 5);
        ctx.lineTo(f.x - 15, f.y - 15);
        ctx.lineTo(f.x + 25, f.y - 5);
        ctx.lineTo(f.x + 20, f.y - 30);
        ctx.lineTo(f.x + 45, f.y - 10);
        ctx.lineTo(f.x + 60, f.y - 25);
        ctx.lineTo(f.x + 55, f.y + 10);
    } else {
        ctx.moveTo(f.x + 55, f.y + 5);
        ctx.lineTo(f.x + 85, f.y - 15);
        ctx.lineTo(f.x + 45, f.y - 5);
        ctx.lineTo(f.x + 50, f.y - 30);
        ctx.lineTo(f.x + 25, f.y - 10);
        ctx.lineTo(f.x + 10, f.y - 25);
        ctx.lineTo(f.x + 15, f.y + 10);
    }
    ctx.closePath();
    ctx.fill();
}

function drawEnergyWave(wave, isPlayer) {
    ctx.save();
    let waveGlow = 15 + Math.sin(frameCount * 0.3) * 6;
    ctx.shadowBlur = waveGlow;
    ctx.shadowColor = colors[wave.type];
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = colors[wave.type];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    let trailLength = 60;
    let gradient = ctx.createLinearGradient(wave.x, wave.y, isPlayer ? wave.x + trailLength : wave.x - trailLength, wave.y);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, auraColors[wave.type]);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(isPlayer ? wave.x : wave.x - trailLength, wave.y - 8, trailLength, 16);
    ctx.restore();
}

function drawIntroCinematics() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, 50);
    ctx.fillRect(0, canvas.height - 90, canvas.width, 90);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, canvas.height - 80, canvas.width - 40, 70);
    ctx.fillStyle = 'rgba(15, 10, 25, 0.85)';
    ctx.fillRect(20, canvas.height - 80, canvas.width - 40, 70);

    let activeFullLine = introLines[currentLineIdx];
    if (textCharIdx < activeFullLine.length) {
        textTickerTimer++;
        if (textTickerTimer % 2 === 0) {
            textCharIdx++;
            displayedText = activeFullLine.substring(0, textCharIdx);
            playSound('talk');
        }
    }

    ctx.font = 'bold 1.15rem sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(displayedText, 40, canvas.height - 40);

    if (textCharIdx >= activeFullLine.length) {
        ctx.font = '0.85rem Arial';
        ctx.fillStyle = '#f43f5e';
        ctx.textAlign = 'right';
        ctx.fillText("TAP SCREEN TO ADVANCE >", canvas.width - 40, canvas.height - 20);
    }
}

function handleIntroTap() {
    if (gameState !== 'intro') return;
    
    let activeFullLine = introLines[currentLineIdx];
    if (textCharIdx < activeFullLine.length) {
        textCharIdx = activeFullLine.length;
        displayedText = activeFullLine;
    } else {
        currentLineIdx++;
        if (currentLineIdx < introLines.length) {
            textCharIdx = 0;
            displayedText = "";
        } else {
            gameState = 'countdown';
            countdownTimer = 0;
            battleCountdownVal = 3;
        }
    }
}

function update() {
    if (!gameLoopActive) return;
    frameCount++;

    ctx.save();
    if (screenShake > 0) {
        let dx = (Math.random() - 0.5) * screenShake;
        let dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        screenShake *= 0.9; 
    }

    drawBackground();
    drawFighter(fighterAI, false);
    drawFighter(fighterPlayer, true);

    if (gameState === 'intro') {
        drawIntroCinematics();
    } 
    else if (gameState === 'countdown') {
        countdownTimer++;
        if (countdownTimer % 50 === 0) {
            battleCountdownVal--;
        }

        if (battleCountdownVal > 0) {
            ctx.font = 'bold 6rem Impact';
            ctx.fillStyle = '#f59e0b';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 10;
            ctx.fillText(battleCountdownVal, canvas.width / 2, canvas.height / 2);
        } else {
            ctx.font = 'bold 7rem Impact';
            ctx.fillStyle = '#ff0055';
            ctx.textAlign = 'center';
            ctx.fillText("FIGHT!", canvas.width / 2, canvas.height / 2);
            
            if (countdownTimer > 180) {
                gameState = 'battle';
                startCombatTimerClock();
                setTimeout(triggerRandomAIShot, 800);
            }
        }
    } 
    else if (gameState === 'battle') {
        
        // Handle incoming AI projectiles safely
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemyWave = enemies[i];
            drawEnergyWave(enemyWave, false);
            enemyWave.x += enemyWave.speed;
            
            // AI wave breaks through player shield zone
            if (enemyWave.x > canvas.width - 120) {
                score--;
                screenShake = 14;
                createParticles(enemyWave.x, enemyWave.y, colors[enemyWave.type]);
                playSound('lose');
                enemies.splice(i, 1);
                document.getElementById('score-span').innerText = score;
                continue;
            }

            // Test intersection with the player's active counter-wave
            if (playerProj && Math.abs(enemyWave.x - playerProj.x) < 30) {
                const midPointX = (enemyWave.x + playerProj.x) / 2;
                const midPointY = (enemyWave.y + playerProj.y) / 2;
                
                createParticles(midPointX, midPointY, colors[playerProj.type]);
                createParticles(midPointX, midPointY, colors[enemyWave.type]);
                screenShake = 18;

                if ((playerProj.type === 'Water' && enemyWave.type === 'Fire') || 
                    (playerProj.type === 'Grass' && enemyWave.type === 'Water') || 
                    (playerProj.type === 'Fire' && enemyWave.type === 'Grass')) {
                    // Player element wins: destroys this wave, player shot survives!
                    enemies.splice(i, 1);
                } else if (playerProj.type === enemyWave.type) { 
                    // Equal elements perfectly neutralize each other
                    playSound('draw');
                    enemies.splice(i, 1);
                    playerProj = null;
                } else {
                    // AI element wins: player projectile breaks instantly
                    playerProj = null; 
                }
            }
        }

        // Handle player projectile updates
        if (playerProj) {
            drawEnergyWave(playerProj, true);
            playerProj.x -= playerProj.speed;
            
            // Player wave hits the AI successfully
            if (playerProj.x < 120) {
                score++;
                screenShake = 14;
                createParticles(playerProj.x, playerProj.y, colors[playerProj.type]);
                playSound('win');
                playerProj = null;
                document.getElementById('score-span').innerText = score;
            }
        }
    }

    // Process background animation particles
    particles.forEach((p, i) => {
        p.x += p.vx; 
        p.y += p.vy; 
        p.life--;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (p.life / 30), 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
    });

    ctx.restore();
    requestAnimationFrame(update);
}

function startCombatTimerClock() {
    const countdown = setInterval(() => {
        if (gameState !== 'battle') {
            clearInterval(countdown);
            return;
        }
        if (time > 0) {
            time--;
            document.getElementById('timer-span').innerText = time;
        } else {
            clearInterval(countdown);
            terminateMatrixGame();
        }
    }, 1000);
}

function terminateMatrixGame() {
    gameState = 'ended';
    gameLoopActive = false;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = 'bold 3.5rem Impact';
    ctx.fillStyle = '#ff4500';
    ctx.textAlign = 'center';
    ctx.fillText("BATTLE CONCLUDED", canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.font = '2rem Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Final Power Rating: ${score} Points`, canvas.width / 2, canvas.height / 2 + 35);
    
    if (typeof GOOGLE_URL !== 'undefined') {
        const activeCoupon = sessionStorage.getItem('active_coupon') || "BYPASS";
        const phone = sessionStorage.getItem('customer_phone') || "UNKNOWN";
        fetch(`${GOOGLE_URL}?action=recordWin&code=${encodeURIComponent(activeCoupon)}&phone=${encodeURIComponent(phone)}&prize=${encodeURIComponent(score + ' Points Battle')}`)
        .catch(err => console.log("Cloud Save Incomplete"));
    }
}

// Controls
document.getElementById('fire').addEventListener('click', () => handleInput('Fire'));
document.getElementById('water').addEventListener('click', () => handleInput('Water'));
document.getElementById('grass').addEventListener('click', () => handleInput('Grass'));

canvas.addEventListener('click', handleIntroTap);

update();
