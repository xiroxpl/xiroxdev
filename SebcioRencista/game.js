const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const GAME_W = 400;
const GAME_H = 600;

canvas.width  = GAME_W;
canvas.height = GAME_H;

function scaleCanvas() {
  const maxH = window.innerHeight - 100;
  const maxW = window.innerWidth  - 20;
  const scale = Math.min(maxW / GAME_W, maxH / GAME_H, 1.4);
  canvas.style.width  = (GAME_W * scale) + 'px';
  canvas.style.height = (GAME_H * scale) + 'px';
}
window.addEventListener('resize', scaleCanvas);
scaleCanvas();

const startScreen    = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay   = document.getElementById('scoreDisplay');
const timeDisplay    = document.getElementById('timeDisplay');
const comboDisplay   = document.getElementById('comboDisplay');
const finalScoreEl   = document.getElementById('finalScore');
const bestScoreEl    = document.getElementById('bestScore');

let state, score, elapsed, spawnTimer, blocks, particles, comboTimer, comboActive;
let bestScore = parseInt(localStorage.getItem('sebcioRekord') || '0');

const GROUND_H = 55;
const GROUND_Y = GAME_H - GROUND_H;

const faceImg = new Image();
faceImg.src = 'face1.jpg';

const player = { x: GAME_W / 2, w: 36, h: 74, speed: 0 };

const TYPES = [
  { id: 'zus',   label: 'ZUS',   emoji: '💰', color: '#ffcc00', pts: 10, w: 6 },
  { id: 'renta', label: 'RENTA', emoji: '🏖️', color: '#00e5ff', pts: 25, w: 2 },
  { id: 'praca', label: 'PRACA', emoji: '💼', color: '#ff2244', pts: 0,  w: 3 },
];

function pickType() {
  const total = TYPES.reduce((s, t) => s + t.w, 0);
  let r = Math.random() * total;
  for (const t of TYPES) { r -= t.w; if (r <= 0) return t; }
  return TYPES[0];
}

const keys  = { left: false, right: false };
const touch = { left: false, right: false };

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

function holdBtn(el, dir) {
  el.addEventListener('touchstart', e => { e.preventDefault(); touch[dir] = true; el.classList.add('pressed'); }, { passive: false });
  el.addEventListener('touchend',   e => { e.preventDefault(); touch[dir] = false; el.classList.remove('pressed'); });
  el.addEventListener('mousedown',  () => { touch[dir] = true; el.classList.add('pressed'); });
  el.addEventListener('mouseup',    () => { touch[dir] = false; el.classList.remove('pressed'); });
  el.addEventListener('mouseleave', () => { touch[dir] = false; el.classList.remove('pressed'); });
}
holdBtn(document.getElementById('btnL'), 'left');
holdBtn(document.getElementById('btnR'), 'right');

const STARS = Array.from({ length: 55 }, () => ({
  x: Math.random() * GAME_W,
  y: Math.random() * GAME_Y() * .9,
  r: Math.random() * 1.4 + .3,
  a: Math.random(),
}));

function GAME_Y() { return GROUND_Y; }

function drawBg() {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#04040f');
  grad.addColorStop(1, '#0d0d2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_W, GROUND_Y);

  STARS.forEach(s => {
    ctx.globalAlpha = s.a * (.5 + .5 * Math.sin(elapsed * 1.8 + s.x));
    ctx.fillStyle = 'rgba(200,200,255,0.8)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(0, GROUND_Y, GAME_W, GROUND_H);
  ctx.fillStyle = '#3a3aaa';
  ctx.fillRect(0, GROUND_Y, GAME_W, 3);

  const sp = 50;
  ctx.strokeStyle = 'rgba(100,100,200,0.12)';
  ctx.lineWidth = 1;
  for (let x = (elapsed * 100) % sp; x < GAME_W; x += sp) {
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GAME_H); ctx.stroke();
  }
}

let walkFrame = 0, walkTimer = 0;

function drawPlayer(dt) {
  const moving = keys.left || keys.right || touch.left || touch.right;
  if (moving) { walkTimer += dt; if (walkTimer > .11) { walkFrame++; walkTimer = 0; } }
  else walkFrame = 0;

  const cx = player.x;
  const py = GROUND_Y - player.h;
  const sh = player.h;
  const headR  = sh * .15;
  const headCY = py + headR + 2;
  const shouldY = headCY + headR + 1;
  const hipY    = shouldY + sh * .28;
  const bob     = Math.sin(walkFrame * .8) * 2.5;
  const swing   = Math.sin(walkFrame * .8) * 16;

  ctx.strokeStyle = '#e8e8ff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  ctx.beginPath(); ctx.moveTo(cx, hipY + bob);
  ctx.lineTo(cx - Math.sin(swing * Math.PI / 180) * sh * .3,
             hipY + bob + Math.cos(swing * Math.PI / 180) * sh * .3);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, hipY + bob);
  ctx.lineTo(cx + Math.sin(swing * Math.PI / 180) * sh * .3,
             hipY + bob + Math.cos(swing * Math.PI / 180) * sh * .3);
  ctx.stroke();

  ctx.beginPath(); ctx.moveTo(cx, shouldY + bob); ctx.lineTo(cx, hipY + bob); ctx.stroke();

  const aswing = Math.sin(walkFrame * .8 + Math.PI) * 20;
  ctx.beginPath(); ctx.moveTo(cx, shouldY + bob + sh * .07);
  ctx.lineTo(cx - Math.sin(aswing * Math.PI / 180) * sh * .22,
             shouldY + bob + sh * .07 + Math.cos(aswing * Math.PI / 180) * sh * .21);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, shouldY + bob + sh * .07);
  ctx.lineTo(cx + Math.sin(aswing * Math.PI / 180) * sh * .22,
             shouldY + bob + sh * .07 + Math.cos(aswing * Math.PI / 180) * sh * .21);
  ctx.stroke();

  const s = headR * 2.2;
  if (faceImg.complete && faceImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, headCY + bob, headR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(faceImg, cx - s / 2, headCY + bob - s / 2, s, s);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, headCY + bob, headR, 0, Math.PI * 2);
    ctx.strokeStyle = '#e8e8ff'; ctx.lineWidth = 2.5; ctx.stroke();
  } else {
    ctx.fillStyle = '#f5c99b';
    ctx.beginPath(); ctx.arc(cx, headCY + bob, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8945a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(cx - headR * .32, headCY + bob - headR * .1, headR * .12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + headR * .32, headCY + bob - headR * .1, headR * .12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, headCY + bob + headR * .1, headR * .32, .2, Math.PI - .2); ctx.stroke();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBlock(b) {
  const sz = b.size;
  ctx.save();
  ctx.translate(b.x + sz / 2, b.y + sz / 2);
  ctx.rotate(b.angle);
  ctx.shadowColor = b.type.color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#111128';
  ctx.strokeStyle = b.type.color;
  ctx.lineWidth = 2;
  roundRect(-sz / 2, -sz / 2, sz, sz, 7);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = `${sz * .42}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.type.emoji, 0, -sz * .07);
  ctx.font = `bold ${sz * .17}px 'Rajdhani', sans-serif`;
  ctx.fillStyle = b.type.color;
  ctx.fillText(b.type.label, 0, sz * .3);
  ctx.restore();
}

function spawnBlock() {
  const sz = 48;
  const margin = 10;
  const usable = GAME_W - sz - margin * 2;
  let x, tries = 0;
  do {
    x = margin + Math.random() * usable;
    tries++;
  } while (
    tries < 20 &&
    blocks.some(b => b.y < 0 && Math.abs(b.x - x) < sz + 8)
  );
  blocks.push({
    x, y: -sz, size: sz,
    type: pickType(),
    vy: 150 + elapsed * 2,
    angle: (Math.random() - .5) * .4,
    spin: (Math.random() - .5) * .7,
  });
}

function hit(b) {
  const sh = player.h;
  const headR  = sh * .15;
  const headCY = (GROUND_Y - sh) + headR + 2;
  const shouldY = headCY + headR + 1;
  const hitTop  = shouldY;
  const hitBot  = GROUND_Y;
  const hitL    = player.x - player.w * .28;
  const hitR    = player.x + player.w * .28;
  return b.x + b.size > hitL && b.x < hitR && b.y + b.size > hitTop && b.y < hitBot;
}

function fx(x, y, type, pts) {
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 / 10) * i;
    const spd = 70 + Math.random() * 100;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 50,
      life: 1, decay: 1.6 + Math.random(),
      r: 3 + Math.random() * 3,
      color: type.color,
      text: `+${pts}`,
      isText: i === 0,
    });
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

let frameId, lastTime;

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, .05);
  lastTime = ts;
  elapsed += dt;

  const dx = (keys.left || touch.left ? -1 : 0) + (keys.right || touch.right ? 1 : 0);
  player.x = Math.max(player.w / 2, Math.min(GAME_W - player.w / 2, player.x + dx * player.speed * dt));

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnBlock();
    if (elapsed > 15 && Math.random() < .35) spawnBlock();
    if (elapsed > 35 && Math.random() < .25) spawnBlock();
    spawnTimer = Math.max(.4, 1.6 - elapsed * .016);
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    b.vy = 150 + elapsed * 2;
    b.y += b.vy * dt;
    b.angle += b.spin * dt;
    if (b.y > GAME_H + 60) { blocks.splice(i, 1); continue; }
    if (hit(b)) {
      blocks.splice(i, 1);
      if (b.type.id === 'praca') { endGame(); return; }
      const mult = comboActive ? 2 : 1;
      const earned = b.type.pts * mult;
      score += earned;
      fx(b.x + b.size / 2, b.y + b.size / 2, b.type, earned);
      if (b.type.id === 'renta') { comboTimer = 5; comboActive = true; }
    }
  }

  if (comboActive) {
    comboTimer -= dt;
    if (comboTimer <= 0) { comboActive = false; comboDisplay.style.display = 'none'; }
    else comboDisplay.style.display = 'inline';
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  player.speed = 200 + Math.floor(elapsed / 15) * 18;

  scoreDisplay.textContent = `WYNIK: ${score}`;
  timeDisplay.textContent  = `CZAS: ${formatTime(elapsed)}`;

  drawBg();

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    if (p.isText) {
      ctx.font = `bold 18px 'Black Han Sans', sans-serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  blocks.forEach(drawBlock);
  drawPlayer(dt);

  frameId = requestAnimationFrame(loop);
}

function startGame() {
  score = 0; elapsed = 0; spawnTimer = 0;
  blocks = []; particles = [];
  comboTimer = 0; comboActive = false;
  player.x = GAME_W / 2; player.speed = 200;
  comboDisplay.style.display = 'none';
  scoreDisplay.textContent = 'WYNIK: 0';
  timeDisplay.textContent = 'CZAS: 0:00';
  lastTime = performance.now();
  frameId = requestAnimationFrame(loop);
}

function endGame() {
  cancelAnimationFrame(frameId);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('sebcioRekord', bestScore);
  }
  ctx.fillStyle = 'rgba(255,0,0,0.35)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  setTimeout(() => {
    finalScoreEl.textContent = score;
    bestScoreEl.textContent  = bestScore;
    gameOverScreen.style.display = 'flex';
  }, 400);
}

document.getElementById('startBtn').addEventListener('click', () => {
  startScreen.style.display = 'none';
  canvas.style.display = 'block';
  startGame();
});
document.getElementById('restartBtn').addEventListener('click', () => {
  gameOverScreen.style.display = 'none';
  startGame();
});

elapsed = 0;
