const input = document.getElementById('typing-input');
const restartBtn = document.getElementById('btn-restart');

restartBtn.addEventListener('click', initGame);
input.addEventListener('input', onType);

function initGame() {
  // TODO: 게임 초기화 로직
}

function onType(e) {
  // TODO: 입력 처리 로직
}

window.addEventListener('load', initGame);
