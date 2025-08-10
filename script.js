
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
let isMusicPlaying = false;
let isMuted = false;   // 마스터 음소거 상태
const audioIds = ["bgm", "hero-hit-sound", "game-over-bgm", "gold-sound", "hit-sound"];

const bgm = document.getElementById("bgm");
const musicIcon = document.getElementById("music-icon");
const muteBtn = document.getElementById("mute-btn");

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

const monsterImages = [
  "monsters/monster1.png", "monsters/monster2.png", "monsters/monster3.png",
  "monsters/monster4.png", "monsters/monster5.png", "monsters/monster6.png"
];
const bossImages = [
  "monsters/boss1.png", "monsters/boss2.png", "monsters/boss3.png"
];

let bgmStarted = false;
function startBgmIfAllowed() {
  if (bgmStarted || isMuted || !bgm) return;      
  bgm.volume = 0.4;
  const p = bgm.play();
  if (p && p.then) {
    p.then(() => {
      bgmStarted = true;
      isMusicPlaying = true;
      if (musicIcon) musicIcon.src = "icons/music-on.png";
    }).catch(() => {/* 모바일 정책 거부 시 무시 */});
  }
}

function primeAudio() {
  audioIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      if (id === "bgm") el.volume = 0.4;
      el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(()=>{});
    } catch(_) {}
  });
}
function unlockAudioOnce() {
  primeAudio();
  startBgmIfAllowed();


// 1) 화면 아무 곳이나 첫 터치
document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
document.addEventListener("touchstart", unlockAudioOnce, { once: true, passive: true });
document.addEventListener("keydown", unlockAudioOnce, { once: true });
// 2) 입력창을 처음 터치해 포커스 올릴 때
input.addEventListener("focus", startBgmIfAllowed, { once: true });
// 3) 첫 제출(엔터/확인 버튼) 시
typingForm.addEventListener("submit", () => startBgmIfAllowed(), { once: true });

// 음소거 아이콘(마스터 뮤트) 쪽에도 시작 보조
muteBtn.addEventListener("click", () => {
  startBgmIfAllowed();          // iOS에서 아이콘 첫 탭으로도 언락
  setMasterMute(!isMuted);
});



if (bgm && bgm.paused) {
    bgm.play().then(() => {
      if (musicIcon) musicIcon.src = "icons/music-on.png";
      isMusicPlaying = true;
    }).catch(() => {});
  }
}


function setNewWord() {
  const wordsForStage = stageWords[stage] || stageWords[Math.max(...Object.keys(stageWords))];
  currentWord = wordsForStage[Math.floor(Math.random() * wordsForStage.length)];
  wordDiv.textContent = currentWord;
  input.value = "";
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
    } while (randomIndex === previousMonsterIndex && monsterImages.length > 1); // 중복 방지

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
  setTimeout(() => {
    container.classList.remove('shake-screen');
  }, 300);
}

function spawnDustParticles() {
  const container = document.getElementById("dust-container");
  for (let i = 0; i < 6; i++) {
    const dust = document.createElement("div");
    dust.className = "dust";

    const x = (Math.random() * 100 - 50) + 'px'; // -50~+50px
    dust.style.setProperty('--x', x);
    dust.style.left = `calc(50% + ${x})`;

    container.appendChild(dust);
    setTimeout(() => dust.remove(), 500);
  }
}

// === (A) 모바일 오디오 언락: 키/터치/포인터 모두 대응 ===
function ensureBgmUnlocked() {
  if (!isMusicPlaying && bgm.paused) {
    bgm.volume = 0.4;
    bgm.play().then(() => {
      isMusicPlaying = true;
      musicIcon.src = "icons/music-on.png";
    }).catch(() => {
      // 실패 시는 무시(사용자 재터치 시 재시도)
    });
  }
}


// 모든 오디오에 muted 반영
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
    startBgmIfAllowed();       // 첫 탭에서 BGM 시작 보조
    setMasterMute(!isMuted);
  });
}

const typingForm = document.getElementById("typing-form");
const submitBtn  = document.getElementById("submit-btn");
const input = document.getElementById("input");

  // 아이콘 업데이트
const musicIcon = document.getElementById("music-icon");
const muteBtn = document.getElementById("mute-btn");
}

function handleSubmit() {
  if (heroHealth <= 0) return;
  const typed = input.value.trim();
  if (typed === currentWord) {
    damageMonster();
    setNewWord();
  } else {
    heroHealth--;
    updateHeroHearts();
    playSound("hero-hit-sound");
    monster.classList.add("attack");
    setTimeout(() => monster.classList.remove("attack"), 400);

    if (heroHealth <= 0) {
      input.disabled = true;
      // BGM 정지 & 게임오버 BGM 재생
      if (bgm) { bgm.pause(); bgm.currentTime = 0; }
      const gameOverBgm = document.getElementById("game-over-bgm");
      if (gameOverBgm) { gameOverBgm.volume = 0.8; gameOverBgm.currentTime = 0; gameOverBgm.play().catch(()=>{}); }

      gameOverText.classList.remove("hidden");
      void gameOverText.offsetHeight; // 리플로우로 애니메이션 트리거
      gameOverText.classList.add("show-game-over");
      setTimeout(() => { retryBtn.classList.remove("hidden"); retryBtn.classList.add("show"); }, 1000);
    }
  }
  input.value = "";
}
if (typingForm) {
  typingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    startBgmIfAllowed();   // 제출 시점에서도 BGM 보조
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
    setTimeout(() => input.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
  });
}

typingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSubmit();
});


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

  // 같은 소리를 빠르게 여러 번 재생 가능
  const s = srcEl.cloneNode(true);
  s.volume = volume;
  document.body.appendChild(s);
  s.play().catch(err => console.log("play error:", id, err));
  s.addEventListener("ended", () => s.remove());
}


function playAttackEffect() {
  const hero = document.querySelector('.hero');
  const monster = document.querySelector('.monster');
  hero.classList.add('attack');
  monster.classList.add('hit');
  setTimeout(() => {
    hero.classList.remove('attack');
    monster.classList.remove('hit');
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

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (heroHealth <= 0) return;

    const typed = input.value.trim();

    if (typed === currentWord) {
      damageMonster();
      setNewWord();
    } else {
      heroHealth--;
      updateHeroHearts();
      playSound("hero-hit-sound");

      monster.classList.add("attack");
      setTimeout(() => monster.classList.remove("attack"), 400);

     if (heroHealth <= 0) {
  input.disabled = true;
  
  bgm.pause();
  bgm.currentTime = 0;
  
  const gameOverBgm = document.getElementById("game-over-bgm");
  gameOverBgm.volume = 0.8;
  gameOverBgm.currentTime = 0;
  gameOverBgm.play();

  // 표시 준비: opacity 0으로 설정된 상태로 보이게
  gameOverText.classList.remove("hidden");
  
  void gameOverText.offsetHeight;

  gameOverText.classList.add("show-game-over");

  // 비동기적으로 스타일 변경 (애니메이션 트리거)
  
  setTimeout(() => {
    retryBtn.classList.remove("hidden");
    retryBtn.classList.add("show");
  }, 1000);
}
    }
    input.value = "";
  }
});

retryBtn.addEventListener("click", () => {
  score = 0;
  gold = 0;
  heroHealth = 3;
  stage = 1;
  isBossStage = false;
  input.disabled = false;
  
  const gameOverBgm = document.getElementById("game-over-bgm");
  gameOverBgm.pause();
  gameOverBgm.currentTime = 0;

  // ✅ 원래 BGM 다시 재생
  bgm.currentTime = 0;
  bgm.volume = 0.4;
  bgm.play();

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

window.addEventListener("load", () => {
  updateHeroHearts();
  setNewMonster();
  setNewWord();
});
