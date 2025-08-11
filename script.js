// ===== 상태값 =====
const stageWords = {
  1: ["주스", "물", "우유"],
  2: ["빵", "시리얼"],
  3: ["초콜릿", "토마토"],
};

let currentWord = "";
let score = 0;
let gold = 0;
let monsterHealth = 5;
let maxHealth = 5;
let heroHealth = 3;
let gameReady = false;

let stage = 1;
let isBossStage = false;
let bossHealth = 10;

let previousMonsterIndex = -1;

// ===== DOM 참조 (모두 정의) =====
const wordDiv = document.getElementById("word");
const scoreSpan = document.getElementById("score");
const monster = document.getElementById("monster");
const goldSpan = document.getElementById("gold");
const goldMessage = document.getElementById("gold-message");
const heroHearts = document.getElementById("hero-hearts");
const gameOverText = document.getElementById("game-over");
const stageText = document.getElementById("stage-indicator");
const typingForm = document.getElementById("typing-form");
const input = document.getElementById("input");
const retryBtn = document.getElementById("retry-btn");

// 오디오 관련 DOM
const bgm = document.getElementById("bgm");
const musicIcon = document.getElementById("music-icon");
const muteBtn = document.getElementById("mute-btn");

// 효과음 ID들
const sfxIds = ["hero-hit-sound","game-over-bgm","gold-sound","hit-sound"];

// 비교용 정규화 (NFC + 제로폭문자 제거)
const norm = (s) => (s || "").normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, "");

// ===== 한글 IME 조합 처리 =====
let isComposing = false;
if (input) {
  input.addEventListener('compositionstart', () => { isComposing = true; });
  input.addEventListener('compositionend',   () => { isComposing = false; });
}

// ===== Audio Module: 한 곳에서만 관리 =====
const audioState = {
  started: false,   // 사용자 제스처로 play 성공했는지
  playing: false,   // 현재 재생 중인지
  muted:  false,    // 마스터 음소거
};


function primeSfx() {
  sfxIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(()=>{});
    } catch(_) {}
  });
}

let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  primeSfx();            // SFX만 프라임
  startBgmIfAllowed();   // BGM 시작 시도
}

document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
document.addEventListener("keydown",     unlockAudioOnce, { once: true });
if (!('PointerEvent' in window)) {
  document.addEventListener("touchstart", unlockAudioOnce, { once: true, passive: true });
}

function tryStartBgm() {
  if (!bgm || audioState.muted || audioState.playing) return;

  const playNow = () => {
    bgm.volume = 0.4;
    const p = bgm.play();
    if (p && p.then) {
      p.then(() => {
        audioState.started = true;
        audioState.playing = true;
        if (musicIcon) musicIcon.src = "icons/music-on.png";
        console.log("[BGM] started");
      }).catch(err => {
        console.warn("[BGM] play blocked:", err?.name || err);
      });
    }
  };

  if (bgm.readyState < 1) {
    bgm.addEventListener("loadedmetadata", playNow, { once: true });
  } else {
    playNow();
  }
}

function unlockAudioOnce() {
  primeSfx();
  tryStartBgm();
}

function setMasterMute(mute) {
  audioState.muted = !!mute;
  audioIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.muted = audioState.muted;
  });
  if (musicIcon) musicIcon.src = audioState.muted ? "icons/music-off.png" : "icons/music-on.png";
  if (muteBtn)   muteBtn.setAttribute("aria-pressed", String(audioState.muted));

  if (audioState.muted) {
    if (bgm) { try { bgm.pause(); } catch(_){} }
    audioState.playing = false;
  } else {
    tryStartBgm();
  }
}
if (muteBtn) {
  muteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    setMasterMute(!audioState.muted);
  });
}

// 게임 흐름용 헬퍼
function pauseBgm() {
  if (bgm) {
    try { bgm.pause(); } catch(_) {}
    audioState.playing = false;
  }
}
function resumeBgmFromStart() {
  if (!bgm || audioState.muted) return;
  try { bgm.currentTime = 0; } catch(_) {}
  audioState.playing = false;
  tryStartBgm();
}

// ===== 게임 로직 =====
const monsterImages = [
  "monsters/monster1.png","monsters/monster2.png","monsters/monster3.png",
  "monsters/monster4.png","monsters/monster5.png","monsters/monster6.png"
];
const bossImages = ["monsters/boss1.png","monsters/boss2.png","monsters/boss3.png"];

function setNewWord() {
  const stages = Object.keys(stageWords).map(Number);
  const lastStage = Math.max(...stages);
  const wordsForStage = stageWords[stage] || stageWords[lastStage];
  currentWord = wordsForStage[Math.floor(Math.random() * wordsForStage.length)];
  console.log("[WORD] set:", currentWord);
  wordDiv.textContent = currentWord;
  if (input) input.value = "";
}

function setNewMonster() {
  if (score > 0 && score % 1 === 0 && !isBossStage) {
    isBossStage = true;
    const bossIndex = Math.min(stage - 1, bossImages.length - 1);
    monster.src = bossImages[bossIndex];
    monster.classList.add("boss-appear");
    setTimeout(() => {
      monster.classList.remove("boss-appear");
      shakeScreen();
      spawnDustParticles();
    }, 1000);
    monsterHealth = bossHealth;
    previousMonsterIndex = -1;
  } else {
    isBossStage = false;
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * monsterImages.length);
    } while (randomIndex === previousMonsterIndex && monsterImages.length > 1);
    previousMonsterIndex = randomIndex;
    monster.src = monsterImages[randomIndex];
    monsterHealth = maxHealth;
  }
  updateMonsterHealthBar();
}

function updateMonsterHealthBar() {
  const bar = document.querySelector('.health-bar-inner');
  const percent = (monsterHealth / (isBossStage ? bossHealth : maxHealth)) * 100;
  bar.style.width = percent + '%';
}

function shakeScreen() {
  const container = document.querySelector('.game-container');
  container.classList.add('shake-screen');
  setTimeout(() => container.classList.remove('shake-screen'), 300);
}

function spawnDustParticles() {
  const container = document.getElementById("dust-container");
  for (let i = 0; i < 6; i++) {
    const dust = document.createElement("div");
    dust.className = "dust";
    const x = (Math.random() * 100 - 50) + 'px';
    dust.style.setProperty('--x', x);
    dust.style.left = `calc(50% + ${x})`;
    container.appendChild(dust);
    setTimeout(() => dust.remove(), 500);
  }
}

function updateHeroHearts() {
  heroHearts.innerHTML = "";
  for (let i = 0; i < heroHealth; i++) {
    const heart = document.createElement("span");
    heart.textContent = "❤️";
    heart.style.fontSize = "25px";
    heart.style.margin = "0 2px";
    heroHearts.appendChild(heart);
  }
}

function showGoldMessage(amount) {
  goldMessage.textContent = `+${amount} gold`;
  goldMessage.style.opacity = 1;
  setTimeout(() => goldMessage.style.opacity = 0, 1000);
}

function playSound(id, volume = 1.0) {
  const srcEl = document.getElementById(id);
  if (!srcEl) return;
  const s = srcEl.cloneNode(true);
  s.volume = volume;
  s.muted = audioState.muted;
  document.body.appendChild(s);
  s.play().catch(err => console.log("play error:", id, err));
  s.addEventListener("ended", () => s.remove());
}

function playAttackEffect() {
  const hero = document.querySelector('.hero');
  const m = document.querySelector('.monster');
  hero.classList.add('attack');
  m.classList.add('hit');
  setTimeout(() => {
    hero.classList.remove('attack');
    m.classList.remove('hit');
  }, 300);
}

function damageMonster() {
  if (monsterHealth > 0) {
    monsterHealth--;
    updateMonsterHealthBar();
    playAttackEffect();
    playSound("hit-sound");

    if (monsterHealth <= 0) {
      score++;
      scoreSpan.textContent = "무찌른 몬스터 수: " + score;

      if (isBossStage) {
        gold += 10;
        showGoldMessage(10);
        playSound("gold-sound", 0.3);
        stage++;
        stageText.textContent = `Stage ${stage}`;
      } else {
        const earnedGold = Math.floor(Math.random() * 5) + 1;
        gold += earnedGold;
        showGoldMessage(earnedGold);
        playSound("gold-sound", 0.3);
      }
      goldSpan.textContent = "얻은 금화: " + gold;
      setTimeout(setNewMonster, 500);
    }
  }
}

// ===== 입력/제출 =====
function showGameOverUI() {
  console.log("[GAMEOVER] show");
  pauseBgm();

  const gameOverBgm = document.getElementById("game-over-bgm");
  if (gameOverBgm) {
    gameOverBgm.volume = 0.8;
    gameOverBgm.currentTime = 0;
    gameOverBgm.play().catch(()=>{});
  }

  if (gameOverText) {
    gameOverText.classList.remove("hidden");
    void gameOverText.offsetHeight; // 애니메이션 트리거
    gameOverText.classList.add("show-game-over");
  }

  if (retryBtn) {
    setTimeout(() => {
      retryBtn.classList.remove("hidden");
      retryBtn.classList.add("show");
    }, 600);
  }
}

function handleSubmit() {
  if (heroHealth <= 0) return;
  const typed = norm(input.value.trim());
  const answer = norm(currentWord);
  console.log("[SUBMIT] typed:", typed, "answer:", answer);

  if (typed === answer) {
    damageMonster();
    setNewWord();
  } else {
    heroHealth--;
    updateHeroHearts();
    if (monster) {
      monster.classList.add("attack");
      setTimeout(() => monster.classList.remove("attack"), 400);
    }
    playSound("hero-hit-sound");

    if (heroHealth <= 0) {
      input.disabled = true;
      showGameOverUI();
    }
  }
  input.value = "";
}

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (isComposing || e.isComposing) return;
      e.preventDefault();
      handleSubmit();
    }
  }, { passive: false });

  input.addEventListener("focus", () => {
    requestAnimationFrame(() => {
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });
}

if (typingForm) {
  typingForm.addEventListener("submit", (e) => {
    if (isComposing) { e.preventDefault(); return; }
    e.preventDefault();
    handleSubmit();
  });
}

if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    score = 0;
    gold = 0;
    heroHealth = 3;
    stage = 1;
    isBossStage = false;
    input.disabled = false;

    const gameOverBgm = document.getElementById("game-over-bgm");
    if (gameOverBgm) { try { gameOverBgm.pause(); gameOverBgm.currentTime = 0; } catch(_){ } }

    if (!audioState.muted) {
      resumeBgmFromStart();
    }

    gameOverText.classList.add("hidden");
    gameOverText.classList.remove("show-game-over");
    retryBtn.classList.add("hidden");
    retryBtn.classList.remove("show");

    scoreSpan.textContent = "무찌른 몬스터 수: 0";
    goldSpan.textContent = "얻은 금화: 0";
    stageText.textContent = "Stage 1";

    updateHeroHearts();
    setNewMonster();
    setNewWord();
  });
}

// ===== 초기화 & 유틸 =====
function positionHearts() {
  const heroEl = document.getElementById('hero');
  if (!heroEl || !heroHearts) return;

  const h = heroEl.clientHeight || heroEl.naturalHeight || 0;
  if (!h) {
    heroEl.addEventListener('load', positionHearts, { once: true });
    return;
  }
  const baseBottom = 8;
  const offsetFromHead = 16;

  heroHearts.style.left = (heroEl.offsetLeft + 16) + 'px';
  heroHearts.style.bottom = (baseBottom + h + offsetFromHead) + 'px';
}

function initUI() {
  updateHeroHearts();
  setNewMonster();
  setNewWord();

  requestAnimationFrame(() => {
    positionHearts();
    setTimeout(positionHearts, 120);
  });

  gameReady = true;
  console.log("[INIT] ready with word:", currentWord);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI, { once: true });
} else {
  initUI();
}

window.addEventListener('resize', positionHearts);
