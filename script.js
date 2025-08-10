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

let stage = 1;
let isBossStage = false;
let bossHealth = 10;

let previousMonsterIndex = -1;

// 오디오 상태
let isMusicPlaying = false;
let isMuted = false;
let bgmStarted = false;

// ===== DOM 참조 (한 번만) =====
const wordDiv = document.getElementById("word");
const input = document.getElementById("input");
const scoreSpan = document.getElementById("score");
const monster = document.getElementById("monster");
const goldSpan = document.getElementById("gold");
const goldMessage = document.getElementById("gold-message");
const heroHearts = document.getElementById("hero-hearts");
const gameOverText = document.getElementById("game-over");
const stageText = document.getElementById("stage-indicator");
const retryBtn = document.getElementById("retry-btn");
const typingForm = document.getElementById("typing-form");
const musicIcon = document.getElementById("music-icon");
const muteBtn = document.getElementById("mute-btn");
const bgm = document.getElementById("bgm");

const monsterImages = [
  "monsters/monster1.png", "monsters/monster2.png", "monsters/monster3.png",
  "monsters/monster4.png", "monsters/monster5.png", "monsters/monster6.png"
];
const bossImages = ["monsters/boss1.png", "monsters/boss2.png", "monsters/boss3.png"];

const audioIds = ["bgm", "hero-hit-sound", "game-over-bgm", "gold-sound", "hit-sound"];

// ===== BGM 시작 보장 & 오디오 언락 =====
function startBgmIfAllowed() {
  if (bgmStarted || isMuted || !bgm || isMusicPlaying) return;
  bgm.volume = 0.4;
  const p = bgm.play();
  if (p && p.then) {
    p.then(() => {
      bgmStarted = true;
      isMusicPlaying = true;
      if (musicIcon) musicIcon.src = "icons/music-on.png";
    }).catch(() => {/* 모바일 정책 거부 시 조용히 무시 */});
  }
}

function primeAudio() {
  audioIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`Audio element with ID ${id} not found.`);
      return;
    }
    try {
      if (id === "bgm") el.volume = 0.4;
      el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(() => {});
    } catch (_) {}
  });
}

function unlockAudioOnce() {
  primeAudio();
  startBgmIfAllowed();
}

// 오디오 언락 이벤트 최적화
document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
if (!('PointerEvent' in window)) {
  document.addEventListener("touchstart", unlockAudioOnce, { once: true, passive: true });
}
document.addEventListener("keydown", unlockAudioOnce, { once: true });

// ===== 마스터 음소거 =====
function setMasterMute(mute) {
  isMuted = mute;
  audioIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.muted = mute;
  });
  if (musicIcon) musicIcon.src = mute ? "icons/music-off.png" : "icons/music-on.png";
  if (muteBtn) muteBtn.setAttribute("aria-pressed", String(mute));
}

if (muteBtn) {
  muteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startBgmIfAllowed();
    setMasterMute(!isMuted);
  });
}

// ===== 게임 로직 =====
function setNewWord() {
  const stages = Object.keys(stageWords).map(Number);
  const lastStage = Math.max(...stages);
  const wordsForStage = stageWords[stage] || stageWords[lastStage];
  currentWord = wordsForStage[Math.floor(Math.random() * wordsForStage.length)];
  if (wordDiv) wordDiv.textContent = currentWord;
  if (input) input.value = "";
}

function setNewMonster() {
  if (score > 0 && score % 10 === 0 && !isBossStage) {
    isBossStage = true;
    const bossIndex = Math.min(stage - 1, bossImages.length - 1);
    if (monster) {
      monster.src = bossImages[bossIndex];
      monster.classList.add("boss-appear");
      setTimeout(() => {
        monster.classList.remove("boss-appear");
        shakeScreen();
        spawnDustParticles();
      }, 1000);
    }
    monsterHealth = bossHealth;
    previousMonsterIndex = -1;
  } else {
    isBossStage = false;
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * monsterImages.length);
    } while (randomIndex === previousMonsterIndex && monsterImages.length > 1);
    previousMonsterIndex = randomIndex;
    if (monster) monster.src = monsterImages[randomIndex];
    monsterHealth = maxHealth;
  }
  updateMonsterHealthBar();
}

function updateMonsterHealthBar() {
  const bar = document.querySelector('.health-bar-inner');
  if (bar) {
    const percent = (monsterHealth / (isBossStage ? bossHealth : maxHealth)) * 100;
    bar.style.width = percent + '%';
  }
}

function shakeScreen() {
  const container = document.querySelector('.game-container');
  if (container) {
    container.classList.add('shake-screen');
    setTimeout(() => container.classList.remove('shake-screen'), 300);
  }
}

function spawnDustParticles() {
  const container = document.getElementById("dust-container");
  if (!container) return;
  for (let i = 0; i < 6; i++) {
    const dust = document.createElement("div");
    dust.className = "dust";
    const x = (Math.random() * 100 - 50) + 'px';
    dust.style.setProperty('--x', x);
    dust.style.left = `calc(50% + ${x})`;
    container.appendChild(dust);
    dust.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-50px)', opacity: 0 }
    ], { duration: 500, easing: 'ease-out' }).onfinish = () => dust.remove();
  }
}

function updateHeroHearts() {
  if (heroHearts) {
    heroHearts.innerHTML = "";
    for (let i = 0; i < heroHealth; i++) {
      const heart = document.createElement("span");
      heart.textContent = "❤️";
      heart.style.fontSize = "25px";
      heart.style.margin = "0 2px";
      heroHearts.appendChild(heart);
    }
  }
}

function showGoldMessage(amount) {
  if (goldMessage) {
    goldMessage.textContent = `+${amount} gold`;
    goldMessage.style.opacity = 1;
    setTimeout(() => goldMessage.style.opacity = 0, 1000);
  }
}

function playSound(id, volume = 1.0) {
  const srcEl = document.getElementById(id);
  if (!srcEl) {
    console.warn(`Audio element with ID ${id} not found.`);
    return;
  }
  const s = srcEl.cloneNode(true);
  s.volume = volume;
  s.muted = isMuted;
  document.body.appendChild(s);
  s.play().catch(err => console.log("play error:", id, err));
  s.addEventListener("ended", () => s.remove());
}

function playAttackEffect() {
  const hero = document.querySelector('.hero');
  const m = document.querySelector('.monster');
  if (hero) hero.classList.add('attack');
  if (m) m.classList.add('hit');
  setTimeout(() => {
    if (hero) hero.classList.remove('attack');
    if (m) m.classList.remove('hit');
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
      if (scoreSpan) scoreSpan.textContent = "무찌른 몬스터 수: " + score;

      if (isBossStage) {
        gold += 10;
        showGoldMessage(10);
        playSound("gold-sound", 0.3);
        stage++;
        if (stageText) stageText.textContent = `Stage ${stage} ${isBossStage ? "(Boss)" : ""}`;
      } else {
        const earnedGold = Math.floor(Math.random() * 5) + 1;
        gold += earnedGold;
        showGoldMessage(earnedGold);
        playSound("gold-sound", 0.3);
      }
      if (goldSpan) goldSpan.textContent = "얻은 금화: " + gold;
      setTimeout(setNewMonster, 500);
    }
  }
}

// ===== 입력/제출 =====
function handleSubmit() {
  if (heroHealth <= 0) return;
  const typed = input ? input.value.trim() : "";
  if (typed === currentWord) {
    damageMonster();
    setNewWord();
    if (input) input.classList.remove("error");
  } else {
    heroHealth--;
    updateHeroHearts();
    playSound("hero-hit-sound");
    if (monster) {
      monster.classList.add("attack");
      setTimeout(() => monster.classList.remove("attack"), 400);
    }
    if (input) {
      input.classList.add("error");
      setTimeout(() => input.classList.remove("error"), 300);
    }

    if (heroHealth <= 0) {
      if (input) input.disabled = true;
      if (bgm) { bgm.pause(); bgm.currentTime = 0; }
      const gameOverBgm = document.getElementById("game-over-bgm");
      if (gameOverBgm) {
        gameOverBgm.volume = 0.8;
        gameOverBgm.currentTime = 0;
        gameOverBgm.play().catch(() => {});
      }
      if (gameOverText) {
        gameOverText.classList.remove("hidden");
        void gameOverText.offsetHeight;
        gameOverText.classList.add("show-game-over");
      }
      setTimeout(() => {
        if (retryBtn) {
          retryBtn.classList.remove("hidden");
          retryBtn.classList.add("show");
        }
      }, 1000);
    }
  }
  if (input) input.value = "";
}

if (typingForm) {
  typingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    startBgmIfAllowed();
    handleSubmit();
  });
}

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      startBgmIfAllowed();
      handleSubmit();
    }
  }, { passive: false });

  input.addEventListener("focus", () => {
    startBgmIfAllowed();
    requestAnimationFrame(() => {
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });
}

// 모바일 키보드 뷰포트 조정
window.visualViewport.addEventListener("resize", () => {
  if (input && input === document.activeElement) {
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  }
});

// ===== 재도전 =====
if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    score = 0;
    gold = 0;
    heroHealth = 3;
    stage = 1;
    isBossStage = false;
    if (input) input.disabled = false;

    const gameOverBgm = document.getElementById("game-over-bgm");
    if (gameOverBgm) { gameOverBgm.pause(); gameOverBgm.currentTime = 0; }

    if (!isMuted && bgm) {
      bgm.currentTime = 0;
      bgm.volume = 0.4;
      bgmStarted = false;
      startBgmIfAllowed();
    }

    if (gameOverText) {
      gameOverText.classList.add("hidden");
      gameOverText.classList.remove("show-game-over");
    }
    if (retryBtn) {
      retryBtn.classList.add("hidden");
      retryBtn.classList.remove("show");
    }

    if (scoreSpan) scoreSpan.textContent = "무찌른 몬스터 수: 0";
    if (goldSpan) goldSpan.textContent = "얻은 금화: 0";
    if (stageText) stageText.textContent = "Stage 1";

    updateHeroHearts();
    setNewMonster();
    setNewWord();
  });
}

// ===== 초기화 =====
window.addEventListener("load", () => {
  if (!wordDiv || !input || !monster || !scoreSpan || !goldSpan || !heroHearts || !stageText) {
    console.error("Required DOM elements are missing!");
    return;
  }
  updateHeroHearts();
  setNewMonster();
  setNewWord();
});