const body = document.body;
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

const welcomeScreen = document.getElementById("welcomeScreen");
const welcomeEnterButton = document.getElementById("welcomeEnterButton");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const speedValue = document.getElementById("speedValue");
const difficultyValue = document.getElementById("difficultyValue");
const tunnelValue = document.getElementById("tunnelValue");
const bonusValue = document.getElementById("bonusValue");
const badgeText = document.getElementById("badgeText");
const bonusBadge = document.getElementById("bonusBadge");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const boardFrame = document.getElementById("boardFrame");
const controlButtons = document.querySelectorAll(".control-btn");
const difficultyButtons = document.querySelectorAll(".difficulty-btn");
const tunnelToggle = document.getElementById("tunnelToggle");
const tunnelHint = document.getElementById("tunnelHint");

const tileCount = 24;
const boardSize = canvas.width;
const tileSize = boardSize / tileCount;
const bestScoreKey = "liquid-snake-best-score";
const normalReferenceStep = 145;

const DIFFICULTIES = {
  beginner: {
    label: "新手",
    baseStepMs: 210,
    minStepMs: 138,
    stepDrop: 3,
    foodScore: 1,
    tunnelDefault: true,
  },
  easy: {
    label: "简单",
    baseStepMs: 180,
    minStepMs: 118,
    stepDrop: 4,
    foodScore: 2,
    tunnelDefault: false,
  },
  normal: {
    label: "普通",
    baseStepMs: 145,
    minStepMs: 96,
    stepDrop: 5,
    foodScore: 3,
    tunnelDefault: false,
  },
  hard: {
    label: "困难",
    baseStepMs: 112,
    minStepMs: 76,
    stepDrop: 6,
    foodScore: 5,
    tunnelDefault: false,
  },
};

const inputDirectionMap = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const safeStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore private mode storage failures.
    }
  },
};

const state = {
  snake: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  food: { x: 16, y: 12 },
  bonus: null,
  nextBonusAt: 0,
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  best: Number.parseInt(safeStorage.get(bestScoreKey) || "0", 10),
  difficulty: "beginner",
  tunnelMode: true,
  stepMs: DIFFICULTIES.beginner.baseStepMs,
  lastTick: 0,
};

const swipeState = {
  startX: 0,
  startY: 0,
};

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDifficultyConfig(key = state.difficulty) {
  return DIFFICULTIES[key];
}

function isWelcomeActive() {
  return body.classList.contains("welcome-active");
}

function dismissWelcome(options = {}) {
  const { startNow = false } = options;
  if (!isWelcomeActive()) {
    if (startNow) {
      startGame();
    }
    return;
  }

  body.classList.remove("welcome-active");
  welcomeScreen.classList.add("hidden");
  if (startNow) {
    startGame();
  } else {
    startButton.focus();
  }
}

function scheduleNextBonus(now = performance.now()) {
  state.nextBonusAt = now + randomBetween(5000, 10500);
}

function describeDifficulty(key = state.difficulty) {
  const config = getDifficultyConfig(key);
  return `${config.label}难度：普通食物 +${config.foodScore} 分，bonus 为复数得分。`;
}

function buildIdleMessage() {
  const config = getDifficultyConfig();
  const tunnelMessage = state.tunnelMode ? "穿墙模式已开启。" : "穿墙模式已关闭。";
  return `当前为${config.label}难度，普通食物 +${config.foodScore} 分，${tunnelMessage}`;
}

function createCollectible(extraBlocked = []) {
  while (true) {
    const candidate = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };

    const occupiedBySnake = state.snake.some((segment) => segment.x === candidate.x && segment.y === candidate.y);
    const occupiedByFood = state.food && state.food.x === candidate.x && state.food.y === candidate.y;
    const occupiedByBonus = state.bonus && state.bonus.x === candidate.x && state.bonus.y === candidate.y;
    const occupiedByExtra = extraBlocked.some((item) => item.x === candidate.x && item.y === candidate.y);

    if (!occupiedBySnake && !occupiedByFood && !occupiedByBonus && !occupiedByExtra) {
      return candidate;
    }
  }
}

function createFood() {
  return createCollectible();
}

function createBonus(now) {
  const multiplier = randomBetween(2, 4);
  const config = getDifficultyConfig();
  const position = createCollectible();

  state.bonus = {
    ...position,
    value: config.foodScore * multiplier,
    expiresAt: now + randomBetween(4200, 6200),
  };
}

function resetGame(options = {}) {
  const { overlayTitleText, overlayDescription } = options;
  const config = getDifficultyConfig();

  state.snake = [
    { x: 8, y: 12 },
    { x: 7, y: 12 },
    { x: 6, y: 12 },
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  state.food = createFood();
  state.bonus = null;
  state.running = false;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.stepMs = config.baseStepMs;
  state.lastTick = 0;
  scheduleNextBonus(performance.now());
  syncUi();
  showOverlay(
    overlayTitleText || "准备开始",
    overlayDescription || buildIdleMessage()
  );
  draw(performance.now());
}

function startGame() {
  if (state.gameOver) {
    resetGame();
  }

  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.lastTick = performance.now();
  hideOverlay();
  syncUi();
}

function togglePause() {
  if (!state.running || state.gameOver) {
    return;
  }

  state.paused = !state.paused;
  if (state.paused) {
    showOverlay("已暂停", "暂停期间 bonus 倒计时会冻结，按空格键或点击暂停继续。");
  } else {
    state.lastTick = performance.now();
    hideOverlay();
  }
  syncUi();
}

function endGame() {
  state.running = false;
  state.paused = false;
  state.gameOver = true;
  state.bonus = null;

  if (state.score > state.best) {
    state.best = state.score;
    safeStorage.set(bestScoreKey, String(state.best));
  }

  syncUi();
  showOverlay("游戏结束", `本局得分 ${state.score}。${describeDifficulty()} 点击开始游戏重新来一局。`);
}

function applyDifficulty(key, options = {}) {
  const config = DIFFICULTIES[key];
  if (!config) {
    return;
  }

  state.difficulty = key;
  state.tunnelMode = config.tunnelDefault;
  tunnelToggle.checked = state.tunnelMode;

  difficultyButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === key);
  });

  syncUi();

  if (options.reset !== false) {
    resetGame({
      overlayTitleText: `已切换到${config.label}`,
      overlayDescription: buildIdleMessage(),
    });
  }
}

function setTunnelMode(enabled) {
  state.tunnelMode = Boolean(enabled);
  tunnelToggle.checked = state.tunnelMode;
  syncUi();

  if (!state.running && !isWelcomeActive()) {
    showOverlay("准备开始", buildIdleMessage());
  }
}

function setDirection(next) {
  if (!next) {
    return;
  }

  const cannotReverse = state.snake.length > 1
    && state.direction.x === -next.x
    && state.direction.y === -next.y;

  if (cannotReverse) {
    return;
  }

  state.nextDirection = next;

  if (!state.running) {
    startGame();
  }
}

function wrapPosition(value) {
  return (value + tileCount) % tileCount;
}

function collectFood() {
  const config = getDifficultyConfig();
  state.score += config.foodScore;
  state.food = createFood();
  state.stepMs = Math.max(config.minStepMs, state.stepMs - config.stepDrop);
}

function collectBonus() {
  if (!state.bonus) {
    return;
  }

  state.score += state.bonus.value;
  state.bonus = null;
  scheduleNextBonus(performance.now());
}

function update() {
  if (!state.running || state.paused || state.gameOver) {
    return;
  }

  state.direction = state.nextDirection;

  const head = state.snake[0];
  const rawHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };

  const wallHit = !state.tunnelMode && (
    rawHead.x < 0
    || rawHead.y < 0
    || rawHead.x >= tileCount
    || rawHead.y >= tileCount
  );

  if (wallHit) {
    endGame();
    return;
  }

  const nextHead = state.tunnelMode
    ? { x: wrapPosition(rawHead.x), y: wrapPosition(rawHead.y) }
    : rawHead;

  const willEatFood = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const willEatBonus = state.bonus && nextHead.x === state.bonus.x && nextHead.y === state.bonus.y;
  const willGrow = willEatFood || willEatBonus;
  const bodyToCheck = willGrow ? state.snake : state.snake.slice(0, -1);
  const selfHit = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

  if (selfHit) {
    endGame();
    return;
  }

  state.snake.unshift(nextHead);

  if (willEatFood) {
    collectFood();
  }

  if (willEatBonus) {
    collectBonus();
  }

  if (!willGrow) {
    state.snake.pop();
  }

  syncUi();
}

function syncUi(now = performance.now()) {
  const config = getDifficultyConfig();
  scoreValue.textContent = String(state.score);
  bestValue.textContent = String(state.best);
  difficultyValue.textContent = config.label;
  tunnelValue.textContent = state.tunnelMode ? "开启" : "关闭";

  const speedMultiplier = (normalReferenceStep / state.stepMs).toFixed(1).replace(".0", "");
  speedValue.textContent = `${speedMultiplier}x`;

  if (state.bonus) {
    const secondsLeft = Math.max(0, Math.ceil((state.bonus.expiresAt - now) / 1000));
    bonusValue.textContent = `+${state.bonus.value}`;
    bonusBadge.textContent = `Bonus +${state.bonus.value} / ${secondsLeft}s`;
    bonusBadge.classList.remove("is-idle");
  } else {
    bonusValue.textContent = "待命";
    bonusBadge.textContent = state.running ? "Bonus 生成中" : "Bonus 待命";
    bonusBadge.classList.add("is-idle");
  }

  if (state.gameOver) {
    badgeText.textContent = "Over";
  } else if (state.paused) {
    badgeText.textContent = "Pause";
  } else if (state.running) {
    badgeText.textContent = "Live";
  } else {
    badgeText.textContent = "Ready";
  }

  tunnelHint.textContent = state.difficulty === "beginner"
    ? "新手默认开启，也可以随时手动关闭。"
    : "当前难度默认关闭，但你可以手动开启穿墙模式。";

  pauseButton.textContent = state.paused ? "继续" : "暂停";
}

function showOverlay(title, description) {
  overlayTitle.textContent = title;
  overlayText.textContent = description;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function roundRectPath(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawCell(x, y, options) {
  const px = x * tileSize + 4;
  const py = y * tileSize + 4;
  const size = tileSize - 8;

  context.save();
  context.shadowBlur = options.shadowBlur;
  context.shadowColor = options.shadowColor;

  const baseGradient = context.createLinearGradient(px, py, px + size, py + size);
  baseGradient.addColorStop(0, options.colorA);
  baseGradient.addColorStop(1, options.colorB);

  roundRectPath(px, py, size, size, options.radius);
  context.fillStyle = baseGradient;
  context.fill();

  const gloss = context.createLinearGradient(px, py, px, py + size);
  gloss.addColorStop(0, "rgba(255,255,255,0.35)");
  gloss.addColorStop(0.45, "rgba(255,255,255,0.08)");
  gloss.addColorStop(1, "rgba(255,255,255,0.02)");

  roundRectPath(px + 1.5, py + 1.5, size - 3, size * 0.54, Math.max(4, options.radius - 2));
  context.fillStyle = gloss;
  context.fill();

  context.restore();
}

function drawBonus(now) {
  if (!state.bonus) {
    return;
  }

  const pulse = 0.75 + ((Math.sin(now / 180) + 1) * 0.18);
  drawCell(state.bonus.x, state.bonus.y, {
    colorA: `rgba(255, 220, 133, ${pulse})`,
    colorB: `rgba(255, 143, 106, ${pulse})`,
    shadowBlur: 28,
    shadowColor: "rgba(255, 179, 102, 0.46)",
    radius: 14,
  });

  context.save();
  context.fillStyle = "rgba(63, 34, 4, 0.92)";
  context.font = "bold 12px Segoe UI";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`+${state.bonus.value}`, state.bonus.x * tileSize + tileSize / 2, state.bonus.y * tileSize + tileSize / 2 + 0.5);
  context.restore();
}

function drawBoard() {
  const boardGradient = context.createRadialGradient(
    boardSize * 0.5,
    boardSize * 0.3,
    10,
    boardSize * 0.5,
    boardSize * 0.5,
    boardSize * 0.65
  );
  boardGradient.addColorStop(0, "rgba(22, 41, 65, 0.95)");
  boardGradient.addColorStop(1, "rgba(6, 13, 25, 1)");
  context.fillStyle = boardGradient;
  context.fillRect(0, 0, boardSize, boardSize);

  for (let row = 0; row < tileCount; row += 1) {
    for (let column = 0; column < tileCount; column += 1) {
      const px = column * tileSize;
      const py = row * tileSize;
      const cellGradient = context.createLinearGradient(px, py, px + tileSize, py + tileSize);
      const tint = (row + column) % 2 === 0 ? 0.045 : 0.02;
      cellGradient.addColorStop(0, `rgba(255, 255, 255, ${tint})`);
      cellGradient.addColorStop(1, "rgba(255, 255, 255, 0.008)");
      context.fillStyle = cellGradient;
      roundRectPath(px + 2, py + 2, tileSize - 4, tileSize - 4, 8);
      context.fill();
    }
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.05)";
  context.lineWidth = 1;
  for (let index = 1; index < tileCount; index += 1) {
    const offset = index * tileSize;
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, boardSize);
    context.stroke();
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(boardSize, offset);
    context.stroke();
  }
}

function draw(now = performance.now()) {
  drawBoard();

  drawCell(state.food.x, state.food.y, {
    colorA: "rgba(255, 145, 186, 0.95)",
    colorB: "rgba(255, 110, 143, 0.7)",
    shadowBlur: 24,
    shadowColor: "rgba(255, 110, 143, 0.38)",
    radius: 12,
  });

  drawBonus(now);

  state.snake.forEach((segment, index) => {
    const isHead = index === 0;
    drawCell(segment.x, segment.y, {
      colorA: isHead ? "rgba(155, 255, 230, 0.98)" : "rgba(126, 247, 210, 0.92)",
      colorB: isHead ? "rgba(114, 166, 255, 0.9)" : "rgba(84, 184, 255, 0.72)",
      shadowBlur: isHead ? 26 : 18,
      shadowColor: isHead ? "rgba(126, 247, 210, 0.36)" : "rgba(114, 166, 255, 0.22)",
      radius: isHead ? 14 : 12,
    });
  });

  if (state.running && !state.paused && !state.gameOver) {
    const head = state.snake[0];
    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.beginPath();
    context.arc(head.x * tileSize + tileSize * 0.38, head.y * tileSize + tileSize * 0.38, 2.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function updateBonusState(now) {
  if (!state.running || state.paused || state.gameOver) {
    return;
  }

  if (state.bonus && now >= state.bonus.expiresAt) {
    state.bonus = null;
    scheduleNextBonus(now);
    syncUi(now);
  }

  if (!state.bonus && now >= state.nextBonusAt) {
    createBonus(now);
    syncUi(now);
  }
}

function loop(timestamp) {
  updateBonusState(timestamp);

  if (!state.lastTick) {
    state.lastTick = timestamp;
  }

  const elapsed = timestamp - state.lastTick;
  if (elapsed >= state.stepMs) {
    update();
    draw(timestamp);
    state.lastTick = timestamp;
  } else if (!state.running || state.paused || state.gameOver || state.bonus) {
    draw(timestamp);
  }

  syncUi(timestamp);
  requestAnimationFrame(loop);
}

function handleDirectionInput(key) {
  const nextDirection = inputDirectionMap[key];
  if (nextDirection) {
    setDirection(nextDirection);
  }
}

document.addEventListener("keydown", (event) => {
  if (isWelcomeActive()) {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      dismissWelcome();
      return;
    }

    if (inputDirectionMap[event.code]) {
      event.preventDefault();
      dismissWelcome();
      handleDirectionInput(event.code);
    }
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (state.gameOver && !state.running) {
      startGame();
      return;
    }
    togglePause();
    return;
  }

  if (inputDirectionMap[event.code]) {
    event.preventDefault();
    handleDirectionInput(event.code);
  }
});

welcomeEnterButton.addEventListener("click", () => {
  dismissWelcome();
});

controlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleDirectionInput(button.dataset.direction);
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyDifficulty(button.dataset.difficulty);
  });
});

tunnelToggle.addEventListener("change", () => {
  setTunnelMode(tunnelToggle.checked);
});

boardFrame.addEventListener("pointerdown", (event) => {
  swipeState.startX = event.clientX;
  swipeState.startY = event.clientY;
});

boardFrame.addEventListener("pointerup", (event) => {
  const deltaX = event.clientX - swipeState.startX;
  const deltaY = event.clientY - swipeState.startY;
  const threshold = 24;

  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
    return;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    handleDirectionInput(deltaX > 0 ? "right" : "left");
  } else {
    handleDirectionInput(deltaY > 0 ? "down" : "up");
  }
});

startButton.addEventListener("click", () => {
  dismissWelcome();
  startGame();
});

pauseButton.addEventListener("click", togglePause);

applyDifficulty("beginner", { reset: false });
resetGame();
requestAnimationFrame(loop);
