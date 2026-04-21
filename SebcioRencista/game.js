// ─── FIREBASE SETUP ───────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABWDAnHr5hqlbRPCN3vkEN6x19xulNI0M",
  authDomain: "sebcio-rencista.firebaseapp.com",
  projectId: "sebcio-rencista",
  storageBucket: "sebcio-rencista.firebasestorage.app",
  messagingSenderId: "852207292542",
  appId: "1:852207292542:web:f002c65b9a8bdf7dc7082f",
  measurementId: "G-PNNE1LVC2Q"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── AUTH STATE ───────────────────────────────────────────────
let currentUser  = null;
let myBestScore  = 0;
let authMode     = 'login';
let rankingUnsub = null;

function listenRanking() {
  if (rankingUnsub) rankingUnsub();
  const q = query(collection(db, 'ranking'), orderBy('score', 'desc'), limit(5));
  rankingUnsub = onSnapshot(q, snap => {
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    renderRankPanel(rows);
  });
}

function renderRankPanel(rows) {
  const list   = document.getElementById('rankList');
  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
  if (!rows.length) {
    list.innerHTML = '<div class="rank-n" style="font-size:11px;text-align:center">Brak wyników</div>';
    return;
  }
  list.innerHTML = rows.map((r, i) => {
    const isMe = currentUser && !currentUser.isGuest && r.name === currentUser.name;
    const cls  = isMe ? 'rank-me' : (i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n');
    return `<div class="rank-row ${cls}"><span>${medals[i]} ${r.name}</span><span>${r.score}</span></div>`;
  }).join('');
}

async function loadMyBest() {
  if (!currentUser || currentUser.isGuest) return;
  try {
    const snap = await getDoc(doc(db, 'ranking', currentUser.uid));
    if (snap.exists()) myBestScore = snap.data().score || 0;
  } catch (e) { console.warn('loadMyBest:', e); }
  updateUserCorner();
}

async function saveScore(score) {
  if (!currentUser || currentUser.isGuest) return;
  if (score <= myBestScore) return;
  myBestScore = score;
  try {
    await setDoc(doc(db, 'ranking', currentUser.uid), {
      name:      currentUser.name,
      score,
      uid:       currentUser.uid,
      updatedAt: serverTimestamp()
    });
  } catch (e) { console.warn('saveScore:', e); }
  updateUserCorner();
}

// ─── AUTH UI ──────────────────────────────────────────────────
window.showTab = function(mode) {
  authMode = mode;
  document.getElementById('tabLogin').className = 'auth-tab' + (mode === 'login' ? ' active' : '');
  document.getElementById('tabReg').className   = 'auth-tab' + (mode === 'reg'   ? ' active' : '');
  document.getElementById('regExtra').style.display   = mode === 'reg' ? 'block' : 'none';
  document.getElementById('authUser').style.display   = mode === 'reg' ? 'block' : 'none';
  document.getElementById('authBtn').textContent = mode === 'login' ? 'ZALOGUJ' : 'ZAREJESTRUJ';
  hideAuthMsg();
};

function showAuthMsg(msg, ok) {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = 'auth-msg ' + (ok ? 'auth-ok' : 'auth-err');
  el.style.display = 'block';
}
function hideAuthMsg() { document.getElementById('authMsg').style.display = 'none'; }

window.doAuth = async function() {
  const email = document.getElementById('authEmail').value.trim();
  const pass  = document.getElementById('authPass').value;

  if (!email || !pass) { showAuthMsg('Podaj e-mail i hasło!', false); return; }

  if (authMode === 'login') {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      const msg = (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
        ? 'Błędny e-mail lub hasło!' : 'Błąd logowania: ' + e.message;
      showAuthMsg(msg, false);
    }
  } else {
    const name = document.getElementById('authUser').value.trim();
    if (!name || name.length < 3) { showAuthMsg('Pseudonim min. 3 znaki!', false); return; }
    if (pass.length < 6)          { showAuthMsg('Hasło min. 6 znaków!', false); return; }
    const pass2 = document.getElementById('authPass2').value;
    if (pass !== pass2)           { showAuthMsg('Hasła się nie zgadzają!', false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      // force refresh so onAuthStateChanged sees displayName
      await cred.user.reload();
      showAuthMsg('Konto założone!', true);
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use'
        ? 'Ten e-mail jest już zajęty!' : 'Błąd rejestracji: ' + e.message;
      showAuthMsg(msg, false);
    }
  }
};

window.playAsGuest = function() {
  currentUser = { uid: null, name: 'GOŚĆ', isGuest: true };
  myBestScore = parseInt(localStorage.getItem('sebcioGuestBest') || '0');
  enterGame();
};

window.logout = async function() {
  if (rankingUnsub) { rankingUnsub(); rankingUnsub = null; }
  await signOut(auth);
  currentUser = null;
  document.getElementById('startScreen').style.display  = 'none';
  document.getElementById('authScreen').style.display   = 'flex';
  // show pseudonim field again for next login/reg
  document.getElementById('authUser').style.display = 'none';
  hideGame();
};

onAuthStateChanged(auth, async user => {
  if (user) {
    // Wait for displayName to be set (important right after registration)
    if (!user.displayName) await user.reload();
    const freshUser = auth.currentUser;
    currentUser = {
      uid:     freshUser.uid,
      name:    freshUser.displayName || freshUser.email.split('@')[0],
      isGuest: false
    };
    hideAuthMsg();
    await loadMyBest();
    enterGame();
  }
});

function enterGame() {
  document.getElementById('authScreen').style.display  = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  updateUserCorner();
}

function hideGame() {
  document.getElementById('hud').style.display        = 'none';
  document.getElementById('rankPanel').style.display  = 'none';
  document.getElementById('userCorner').style.display = 'none';
  document.getElementById('mc').style.display         = 'none';
  canvas.style.display = 'none';
}

function updateUserCorner() {
  if (!currentUser) return;
  const best = currentUser.isGuest
    ? parseInt(localStorage.getItem('sebcioGuestBest') || '0')
    : myBestScore;
  document.getElementById('ucName').textContent = '👤 ' + currentUser.name;
  document.getElementById('ucBest').textContent = 'REK: ' + best + ' pkt';
}

// ─── CANVAS SETUP ─────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const GAME_W = 400, GAME_H = 600;
canvas.width = GAME_W; canvas.height = GAME_H;

function scaleCanvas() {
  const maxH = window.innerHeight - 80, maxW = window.innerWidth - 20;
  const scale = Math.min(maxW / GAME_W, maxH / GAME_H, 1.4);
  canvas.style.width  = (GAME_W * scale) + 'px';
  canvas.style.height = (GAME_H * scale) + 'px';
}
window.addEventListener('resize', scaleCanvas);
scaleCanvas();

const scoreDisplay = document.getElementById('scoreDisplay');
const timeDisplay  = document.getElementById('timeDisplay');
const comboDisplay = document.getElementById('comboDisplay');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl  = document.getElementById('bestScore');

const GROUND_H = 55;
const GROUND_Y = GAME_H - GROUND_H;
const player   = { x: GAME_W / 2, w: 36, h: 74, speed: 0 };

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

const keys   = { left: false, right: false };
const touch2 = { left: false, right: false };

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

function holdBtn(el, dir) {
  el.addEventListener('touchstart', e => { e.preventDefault(); touch2[dir] = true; el.classList.add('pressed'); }, { passive: false });
  el.addEventListener('touchend',   e => { e.preventDefault(); touch2[dir] = false; el.classList.remove('pressed'); });
  el.addEventListener('mousedown',  () => { touch2[dir] = true; el.classList.add('pressed'); });
  el.addEventListener('mouseup',    () => { touch2[dir] = false; el.classList.remove('pressed'); });
  el.addEventListener('mouseleave', () => { touch2[dir] = false; el.classList.remove('pressed'); });
}
holdBtn(document.getElementById('btnL'), 'left');
holdBtn(document.getElementById('btnR'), 'right');

// face image
const faceImg = new Image();
faceImg.src = 'face1.jpg';

const STARS = Array.from({ length: 55 }, () => ({
  x: Math.random() * GAME_W,
  y: Math.random() * GROUND_Y * .9,
  r: Math.random() * 1.4 + .3,
  a: Math.random(),
}));

let score, elapsed, spawnTimer, blocks, particles, comboTimer, comboActive;

function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, '#04040f'); g.addColorStop(1, '#0d0d2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, GAME_W, GROUND_Y);
  STARS.forEach(s => {
    ctx.globalAlpha = s.a * (.5 + .5 * Math.sin(elapsed * 1.8 + s.x));
    ctx.fillStyle = 'rgba(200,200,255,0.8)';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#1a1a3a'; ctx.fillRect(0, GROUND_Y, GAME_W, GROUND_H);
  ctx.fillStyle = '#3a3aaa'; ctx.fillRect(0, GROUND_Y, GAME_W, 3);
  const sp = 50;
  ctx.strokeStyle = 'rgba(100,100,200,0.12)'; ctx.lineWidth = 1;
  for (let x = (elapsed * 100) % sp; x < GAME_W; x += sp) {
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GAME_H); ctx.stroke();
  }
}

let walkFrame = 0, walkTimer = 0;
function drawPlayer(dt) {
  const moving = keys.left || keys.right || touch2.left || touch2.right;
  if (moving) { walkTimer += dt; if (walkTimer > .11) { walkFrame++; walkTimer = 0; } }
  else walkFrame = 0;
  const cx = player.x, py = GROUND_Y - player.h, sh = player.h;
  const headR   = sh * .15;
  const headCY  = py + headR + 2;
  const shouldY = headCY + headR + 1;
  const hipY    = shouldY + sh * .28;
  const bob     = Math.sin(walkFrame * .8) * 2.5;
  const swing   = Math.sin(walkFrame * .8) * 16;

  ctx.strokeStyle = '#e8e8ff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';

  // legs
  ctx.beginPath(); ctx.moveTo(cx, hipY + bob);
  ctx.lineTo(cx - Math.sin(swing * Math.PI / 180) * sh * .3, hipY + bob + Math.cos(swing * Math.PI / 180) * sh * .3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, hipY + bob);
  ctx.lineTo(cx + Math.sin(swing * Math.PI / 180) * sh * .3, hipY + bob + Math.cos(swing * Math.PI / 180) * sh * .3); ctx.stroke();

  // body
  ctx.beginPath(); ctx.moveTo(cx, shouldY + bob); ctx.lineTo(cx, hipY + bob); ctx.stroke();

  // arms
  const aswing = Math.sin(walkFrame * .8 + Math.PI) * 20;
  ctx.beginPath(); ctx.moveTo(cx, shouldY + bob + sh * .07);
  ctx.lineTo(cx - Math.sin(aswing * Math.PI / 180) * sh * .22, shouldY + bob + sh * .07 + Math.cos(aswing * Math.PI / 180) * sh * .21); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, shouldY + bob + sh * .07);
  ctx.lineTo(cx + Math.sin(aswing * Math.PI / 180) * sh * .22, shouldY + bob + sh * .07 + Math.cos(aswing * Math.PI / 180) * sh * .21); ctx.stroke();

  // head — face image or fallback
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
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function drawBlock(b) {
  const sz = b.size;
  ctx.save(); ctx.translate(b.x + sz / 2, b.y + sz / 2); ctx.rotate(b.angle);
  ctx.shadowColor = b.type.color; ctx.shadowBlur = 12;
  ctx.fillStyle = '#111128'; ctx.strokeStyle = b.type.color; ctx.lineWidth = 2;
  roundRect(-sz / 2, -sz / 2, sz, sz, 7); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.font = `${sz * .42}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.type.emoji, 0, -sz * .07);
  ctx.font = `bold ${sz * .17}px 'Rajdhani', sans-serif`; ctx.fillStyle = b.type.color;
  ctx.fillText(b.type.label, 0, sz * .3);
  ctx.restore();
}

function spawnBlock() {
  const sz = 48, margin = 10, usable = GAME_W - sz - margin * 2;
  let x, tries = 0;
  do { x = margin + Math.random() * usable; tries++; }
  while (tries < 20 && blocks.some(b => b.y < 0 && Math.abs(b.x - x) < sz + 8));
  blocks.push({ x, y: -sz, size: sz, type: pickType(), vy: 150 + elapsed * 2, angle: (Math.random() - .5) * .4, spin: (Math.random() - .5) * .7 });
}

function hit(b) {
  const sh = player.h, headR = sh * .15, headCY = (GROUND_Y - sh) + headR + 2, shouldY = headCY + headR + 1;
  return b.x + b.size > player.x - player.w * .28 && b.x < player.x + player.w * .28 && b.y + b.size > shouldY && b.y < GROUND_Y;
}

function fx(x, y, type, pts) {
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 / 10) * i, spd = 70 + Math.random() * 100;
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 50, life: 1, decay: 1.6 + Math.random(), r: 3 + Math.random() * 3, color: type.color, text: `+${pts}`, isText: i === 0 });
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

let frameId, lastTime;

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, .05);
  lastTime = ts; elapsed += dt;
  const dx = (keys.left || touch2.left ? -1 : 0) + (keys.right || touch2.right ? 1 : 0);
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
    b.vy = 150 + elapsed * 2; b.y += b.vy * dt; b.angle += b.spin * dt;
    if (b.y > GAME_H + 60) { blocks.splice(i, 1); continue; }
    if (hit(b)) {
      blocks.splice(i, 1);
      if (b.type.id === 'praca') { endGame(); return; }
      const mult = comboActive ? 2 : 1, earned = b.type.pts * mult;
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
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= p.decay * dt;
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
      ctx.fillStyle = p.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  timeDisplay.textContent  = 'CZAS: 0:00';
  document.getElementById('hud').style.display        = 'flex';
  document.getElementById('rankPanel').style.display  = 'block';
  document.getElementById('userCorner').style.display = 'block';
  document.getElementById('mc').style.display         = 'flex';
  canvas.style.display = 'block';
  listenRanking();
  lastTime = performance.now();
  frameId  = requestAnimationFrame(loop);
}

function showNewRecordBanner() {
  const banner = document.getElementById('newRecordBanner');
  banner.textContent = `🏆 ${currentUser && !currentUser.isGuest ? currentUser.name + ': ' : ''}NOWY REKORD!`;
  banner.style.animation = 'none';
  banner.style.display = 'block';
  banner.offsetHeight;
  banner.style.animation = '';
  setTimeout(() => { banner.style.display = 'none'; }, 2200);
}

async function endGame() {
  cancelAnimationFrame(frameId);
  const prevBest = currentUser && !currentUser.isGuest
    ? myBestScore
    : parseInt(localStorage.getItem('sebcioGuestBest') || '0');
  const isNewRecord = score > prevBest;

  if (currentUser && !currentUser.isGuest) {
    await saveScore(score);
  } else if (currentUser && currentUser.isGuest) {
    if (score > prevBest) localStorage.setItem('sebcioGuestBest', score);
  }

  const best = currentUser && !currentUser.isGuest
    ? myBestScore
    : parseInt(localStorage.getItem('sebcioGuestBest') || '0');

  ctx.fillStyle = 'rgba(255,0,0,0.35)'; ctx.fillRect(0, 0, GAME_W, GAME_H);

  setTimeout(() => {
    if (isNewRecord) showNewRecordBanner();
    finalScoreEl.textContent = score;
    bestScoreEl.textContent  = best;
    document.getElementById('newRecordMsg').style.display   = isNewRecord ? 'block' : 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('hud').style.display        = 'none';
    document.getElementById('rankPanel').style.display  = 'none';
    document.getElementById('userCorner').style.display = 'none';
    document.getElementById('mc').style.display         = 'none';
    canvas.style.display = 'none';
    updateUserCorner();
  }, 400);
}

window.showStartFromGameOver = function() {
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('startScreen').style.display    = 'flex';
};

// ─── EVENT LISTENERS ─────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startScreen').style.display = 'none';
  startGame();
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverScreen').style.display = 'none';
  startGame();
});
document.getElementById('authEmail').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('authPass').focus(); });
document.getElementById('authPass').addEventListener('keydown',  e => { if (e.key === 'Enter') window.doAuth(); });

// hide pseudonim field on load (only shown during registration)
document.getElementById('authUser').style.display = 'none';