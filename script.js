document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
if (!('PointerEvent' in window)) {
  document.addEventListener("touchstart", unlockAudioOnce, {once: true, passive: true })
}
document.addEventListener("keydown", unlockAudioOnce, { once: true });

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

// 한글 IME 조합 처리
let isComposing = false;
input.addEventListener('compositionstart', () => { isComposing = true; });
input.addEventListener('compositionend', () => { isComposing = false; });

// 비교용 정규화 유틸 (NFC + 제로폭문자 제거)
const norm = (s) => (s || "").normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, "");

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
  "monsters/monster1.png","monsters/monster2.png","monsters/monster3.png",
  "monsters/monster4.png","monsters/monster5.png","monsters/monster6.png"
];
const bossImages = ["monsters/boss1.png","monsters/boss2.png","monsters/boss3.png"];

const audioIds = ["bgm","hero-hit-sound","game-over-bgm","gold-sound","hit-sound"];

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
      console.log("[BGM] started");
    }).catch((err) => {
      console.warn("[BGM] play blocked:", err?.name || err);
      // 사용자가 버튼/입력 등 또 다른 제스처를 하면 다시 시도되도록 남겨둠
      // (bgmStarted는 여전히 false라 다음 제스처에서 재시도)
    });
  }
}

function positionHearts() {
  const heroEl = document.getElementById('hero');
  if (!heroEl || !heroHearts) return;

  // 히어로 이미지가 준비되지 않았으면 나중에 다시 시도
  const h = heroEl.clientHeight || heroEl.naturalHeight || 0;
  if (!h) {
    // 이미지 로드 후 다시 시도
    heroEl.addEventListener('load', positionHearts, { once: true });
    return;
  }

  const baseBottom = 8;      // .hero { bottom: 8px; }와 동일
  const offsetFromHead = 16; // 머리 위 여백

  // hero의 좌표를 기준으로 살짝 오른쪽으로 치우치게
  heroHearts.style.left = (heroEl.offsetLeft + 16) + 'px';
  heroHearts.style.bottom = (baseBottom + h + offsetFromHead) + 'px';
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
}

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
    startBgmIfAllowed();      // 첫 탭에서 BGM 보조 시작
    setMasterMute(!isMuted);
  });
}

// ===== 게임 로직 =====
function setNewWord() {
  const stages = Object.keys(stageWords).map(Number);
  const lastStage = Math.max(...stages);
  const wordsForStage = stageWords[stage] || stageWords[lastStage];

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
  s.muted = isMuted;
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
function handleSubmit() {
  if (heroHealth <= 0) return;
  const typed = norm(input.value.trim());
  const answer = norm(currentWord);

  if (typed === answer) {
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
      if (bgm) { bgm.pause(); bgm.currentTime = 0; }
      const gameOverBgm = document.getElementById("game-over-bgm");
      if (gameOverBgm) {
        gameOverBgm.volume = 0.8;
        gameOverBgm.currentTime = 0;
        gameOverBgm.play().catch(()=>{});
      }
      gameOverText.classList.remove("hidden");
      void gameOverText.offsetHeight;
      gameOverText.classList.add("show-game-over");
      setTimeout(() => {
        retryBtn.classList.remove("hidden");
        retryBtn.classList.add("show");
      }, 1000);
    }
  }
  input.value = "";
}

if (input) {
  input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (isComposing || e.isComposing) return;  // ← 조합 중이면 무시
    e.preventDefault();
    startBgmIfAllowed();
    handleSubmit();
  }
}, { passive: false });

if (typingForm) {
  typingForm.addEventListener("submit", (e) => {
    if (isComposing) { e.preventDefault(); return; }  // ← 조합 중이면 무시
    e.preventDefault();
    startBgmIfAllowed();
    handleSubmit();
  });
}

  input.addEventListener("focus", () => {
    startBgmIfAllowed();
    requestAnimationFrame(() => {
      input.scrollIntoView({ block: "center", behavior: "smooth" });
  });
});
}

// ===== 재도전 =====
retryBtn.addEventListener("click", () => {
  score = 0;
  gold = 0;
  heroHealth = 3;
  stage = 1;
  isBossStage = false;
  input.disabled = false;

  const gameOverBgm = document.getElementById("game-over-bgm");
  if (gameOverBgm) { gameOverBgm.pause(); gameOverBgm.currentTime = 0; }

  if (!isMuted && bgm) {
    bgm.currentTime = 0;
    bgm.volume = 0.4;
    bgmStarted = false;
    startBgmIfAllowed();
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

function initUI() {
  updateHeroHearts();   // 하트 DOM 채우기
  setNewMonster();
  setNewWord();

  // 히어로 이미지가 준비되면 위치 잡기
  const heroEl = document.getElementById('hero');
  if (heroEl && heroEl.complete && heroEl.naturalHeight > 0) {
    positionHearts();
  } else if (heroEl) {
    heroEl.addEventListener('load', positionHearts, { once: true });
    // 혹시 load 이벤트를 못 받는 경우 대비해 한 번 더 시도
    requestAnimationFrame(() => setTimeout(positionHearts, 100));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI, { once: true });
} else {
  initUI();
}

// 화면 회전/리사이즈 때도 재배치
window.addEventListener('resize', positionHearts);
