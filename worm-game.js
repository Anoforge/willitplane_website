/**
 * Planer Game — drop-in easter egg overlay.
 *
 * Usage: include this script anywhere on a page, then call:
 *   WormGame.init();
 *
 * It creates its own DOM (toggle button, canvas, HUD), its own styles,
 * and loads its local game sprites. Nothing needs to already exist on the
 * host page — one script tag + one init() call.
 *
 * Namespacing: every element/id/class this module creates is prefixed
 * with "wip-worm-" to avoid colliding with anything on the host site.
 */
(function (window, document) {
  'use strict';

  if (window.WormGame) return; // don't double-init if the script loads twice

  const NS = 'wip-worm';
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : window.location.href;
  const SPRITE_ROOT = new URL('worm_game_sprites/', SCRIPT_URL);

  const SEGMENT_SIZE = 14;
  const BASE_SPEED = 2.8;
  const SPEED_PER_ITEM = 0.02;
  const MAX_SPEED = 4.8;
  const EAT_BOOST = 0.7;
  const EAT_BOOST_DURATION = 450;
  const TURN_RATE = 0.08;
  const ITEM_COUNT = 6;
  const ITEM_SIZE = 38;
  const EAT_DISTANCE = 26;
  const SELF_COLLISION_SKIP = 6;
  const GROWTH_PER_ITEM = 3;
  const PLANER_SIZE = 54;
  const PICKUP_TEXT_DURATION = 1200;
  const ITEM_SPRITE_FILES = [
    '01_banana.png', '02_deck_of_cards.png', '03_dragon_fruit.png',
    '04_coconut.png', '05_box_of_spaghetti.png', '06_box_of_crayons.png',
    '07_wasp_nest.png', '08_vhs.png', '09_loaf_of_bread.png',
    '10_toilet_paper.png', '11_bone.png', '12_mushroom.png',
    '13_shaving_cream.png', '14_egg.png', '15_light_bulb.png',
    '16_cat_tail.png', '17_can_of_beans.png', '18_whoopee_cushion.png',
    '19_ukulele.png', '20_pinata.png', '21_chalk.png',
    '22_cauliflower.png', '23_corn.png', '24_potato.png',
    '25_needoh.png', '26_pineapple.png', '27_sponge.png',
    '28_coffee_cup.png', '29_broccoli.png', '30_wine_glass.png',
    '31_baseball.png', '32_silly_string.png', '33_gold_bond.png',
    '34_glow_stick.png', '35_unbreakable_toy.png', '36_seashell.png',
    '37_train.png', '38_squishy_dumpling.png', '39_jawbreaker.png',
    '40_lemon_squishy.png', '41_rug.png', '42_old_boot.png',
    '43_chicken.png', '44_keyboard.png', '45_ice_cream.png',
    '46_ramen_noodles.png', '47_tape_measure.png'
  ];

  let initialized = false;
  let running = false;
  let score = 0;
  let boostUntil = 0;
  let worm = [];
  let angle = 0;
  let targetAngle = 0;
  let items = [];
  let pickupTexts = [];
  let planerSprite = null;
  let itemSprites = [];
  let spriteErrors = 0;
  let spritesLoaded = false;
  let keys = {};
  let touchTarget = null;
  let animId = null;

  let canvas, ctx, toggleBtn, hud, scoreEl, debugEl, shield;
  let highDpiScale = 1;
  let joystick = null;

  function injectStyles() {
    if (document.getElementById(NS + '-styles')) return;
    const style = document.createElement('style');
    style.id = NS + '-styles';
    style.textContent = `
      #${NS}-toggle {
        position: fixed;
        bottom: 1rem;
        left: 1rem;
        z-index: 1000001;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid rgba(245,166,35,0.35);
        background: rgba(17,16,14,0.85);
        color: #f5a623;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(6px);
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
        pointer-events: auto;
      }
      #${NS}-toggle:hover,
      #${NS}-toggle:focus-visible {
        background: rgba(245,166,35,0.12);
        border-color: rgba(245,166,35,0.75);
        transform: translateY(-2px);
        outline: none;
      }
      #${NS}-toggle::after {
        content: attr(data-tooltip);
        position: absolute;
        left: calc(100% + 10px);
        top: 50%;
        transform: translateY(-50%);
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(17,16,14,0.95);
        color: #f3f0ea;
        border: 1px solid rgba(245,166,35,0.25);
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      #${NS}-toggle:hover::after,
      #${NS}-toggle:focus-visible::after {
        opacity: 1;
      }
      #${NS}-toggle[data-position="bottom-right"] {
        left: auto;
        right: 1rem;
      }
      #${NS}-toggle[data-position="top-right"] {
        bottom: auto;
        top: 1rem;
        left: auto;
        right: 1rem;
      }
      #${NS}-toggle[data-position="top-left"] {
        bottom: auto;
        top: 1rem;
      }
      #${NS}-canvas {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999998;
        display: none;
      }
      #${NS}-shield {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999999;
        pointer-events: auto;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        background: rgba(0,0,0,0.0001);
        display: none;
      }
      #${NS}-shield[data-active="true"] {
        display: block;
      }
      #${NS}-hud {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 1000000;
        background: rgba(17,16,14,0.85);
        color: #f3f0ea;
        border: 1px solid rgba(245,166,35,0.18);
        font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 8px 14px;
        border-radius: 10px;
        display: none;
      }
      #${NS}-debug {
        position: fixed;
        bottom: calc(1rem + 54px);
        left: 1rem;
        z-index: 1000000;
        max-width: 280px;
        background: rgba(17,16,14,0.92);
        color: #ff7a7a;
        border: 1px solid rgba(255,122,122,0.35);
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 8px 10px;
        border-radius: 8px;
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createDOM(position) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = NS + '-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', 'Start planer game');
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.setAttribute('data-tooltip', 'Play Planer Game');
    toggleBtn.setAttribute('data-position', position);
    toggleBtn.textContent = '🪚';
    document.body.appendChild(toggleBtn);

    hud = document.createElement('div');
    hud.id = NS + '-hud';
    hud.innerHTML = 'Items planed: <span></span>';
    document.body.appendChild(hud);
    scoreEl = hud.querySelector('span');

    debugEl = document.createElement('div');
    debugEl.id = NS + '-debug';
    document.body.appendChild(debugEl);

    canvas = document.createElement('canvas');
    canvas.id = NS + '-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    shield = document.createElement('div');
    shield.id = NS + '-shield';
    shield.setAttribute('aria-hidden', 'true');
    document.body.appendChild(shield);

    toggleBtn.addEventListener('click', () => {
      if (running) stopGame(); else startGame();
    });
  }

  function loadImage(path, onError) {
    const image = new Image();
    image.onload = () => {
      image.loaded = true;
    };
    image.onerror = () => {
      spriteErrors++;
      if (onError) onError();
    };
    image.src = new URL(path, SPRITE_ROOT).href;
    return image;
  }

  function loadSprites() {
    if (spritesLoaded) return;
    spritesLoaded = true;
    planerSprite = loadImage('planer_sprites/128px/planer_right.png', reportSpriteError);
    itemSprites = ITEM_SPRITE_FILES.map((file) => ({
      file,
      image: loadImage(`item_sprites/128px/${file}`, reportSpriteError)
    }));
  }

  function reportSpriteError() {
    if (running) {
      showDebug(`${spriteErrors} game sprite${spriteErrors === 1 ? '' : 's'} could not load.`);
    }
  }

  function showDebug(msg) {
    debugEl.textContent = msg;
    debugEl.style.display = 'block';
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    highDpiScale = dpr;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function resetWorm() {
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    worm = [];
    for (let i = 0; i < 8; i++) {
      worm.push({ x: startX - i * SEGMENT_SIZE, y: startY });
    }
    angle = 0;
    targetAngle = 0;
  }

  function spawnItem() {
    const margin = 40;
    const x = margin + Math.random() * (window.innerWidth - margin * 2);
    const y = margin + Math.random() * (window.innerHeight - margin * 2);
    const usedFiles = new Set(items.map((item) => item.file));
    const available = itemSprites.filter((sprite) => !usedFiles.has(sprite.file));
    const sprite = available[Math.floor(Math.random() * available.length)];
    const name = sprite.file.replace(/^\d+_/, '').replace(/\.png$/, '').split('_')
      .map((word) => word === 'vhs' ? 'VHS' : word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return { x, y, file: sprite.file, image: sprite.image, name };
  }

  function fillItems() {
    while (items.length < ITEM_COUNT) {
      items.push(spawnItem());
    }
  }

  function currentSpeed() {
    const normalSpeed = Math.min(BASE_SPEED + score * SPEED_PER_ITEM, MAX_SPEED);
    const boostRemaining = Math.max(0, boostUntil - performance.now());
    return normalSpeed + EAT_BOOST * boostRemaining / EAT_BOOST_DURATION;
  }

  function update() {
    if (joystick) {
      targetAngle = joystick.angle;
    } else if (touchTarget) {
      const head = worm[0];
      targetAngle = Math.atan2(touchTarget.y - head.y, touchTarget.x - head.x);
    } else if (keys.ArrowUp) targetAngle = -Math.PI / 2;
    else if (keys.ArrowDown) targetAngle = Math.PI / 2;
    else if (keys.ArrowLeft) targetAngle = Math.PI;
    else if (keys.ArrowRight) targetAngle = 0;

    let diff = targetAngle - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > TURN_RATE) {
      angle += Math.sign(diff) * TURN_RATE;
    } else {
      angle = targetAngle;
    }

    const head = worm[0];
    const speed = currentSpeed();
    let newX = head.x + Math.cos(angle) * speed;
    let newY = head.y + Math.sin(angle) * speed;

    if (newX < 0) newX = window.innerWidth;
    if (newX > window.innerWidth) newX = 0;
    if (newY < 0) newY = window.innerHeight;
    if (newY > window.innerHeight) newY = 0;

    worm.unshift({ x: newX, y: newY });
    worm.pop();

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dx = item.x - newX;
      const dy = item.y - newY;
      if (Math.sqrt(dx * dx + dy * dy) < EAT_DISTANCE) {
        items.splice(i, 1);
        score++;
        pickupTexts.push({ x: item.x, y: item.y, name: item.name, started: performance.now() });
        boostUntil = performance.now() + EAT_BOOST_DURATION;
        scoreEl.textContent = score;
        const tail = worm[worm.length - 1];
        for (let g = 0; g < GROWTH_PER_ITEM; g++) {
          worm.push({ x: tail.x, y: tail.y });
        }
      }
    }

    for (let i = SELF_COLLISION_SKIP; i < worm.length; i++) {
      const seg = worm[i];
      const dx = seg.x - newX;
      const dy = seg.y - newY;
      if (dx * dx + dy * dy < (SEGMENT_SIZE * 0.55) * (SEGMENT_SIZE * 0.55)) {
        stopGame();
        return;
      }
    }

    fillItems();
  }

  function drawShavingsTrail() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = worm.length - 1; i > 0; i--) {
      const tail = worm[i];
      const next = worm[i - 1];
      if (Math.hypot(next.x - tail.x, next.y - tail.y) > 30) {
        ctx.moveTo(tail.x, tail.y);
        continue;
      }
      if (i === worm.length - 1 || Math.hypot(worm[i + 1].x - tail.x, worm[i + 1].y - tail.y) > 30) {
        ctx.moveTo(tail.x, tail.y);
      }
      ctx.lineTo(next.x, next.y);
    }
    ctx.strokeStyle = 'rgba(107, 62, 28, 0.72)';
    ctx.lineWidth = 13;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(199, 139, 67, 0.96)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 222, 164, 0.72)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 6; i < worm.length; i += 6) {
      const seg = worm[i];
      const curl = (i * 2.399) % (Math.PI * 2);
      const offset = (i % 3 - 1) * 3;
      ctx.beginPath();
      ctx.moveTo(seg.x + Math.cos(curl) * offset, seg.y + Math.sin(curl) * offset);
      ctx.quadraticCurveTo(
        seg.x + Math.cos(curl + 0.9) * 7,
        seg.y + Math.sin(curl + 0.9) * 7,
        seg.x + Math.cos(curl + 1.8) * 3,
        seg.y + Math.sin(curl + 1.8) * 3
      );
      ctx.strokeStyle = 'rgba(255, 226, 174, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawFallbackPlaner(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#b8793e';
    ctx.strokeStyle = '#57371f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-PLANER_SIZE / 2 + 8, -PLANER_SIZE / 3);
    ctx.lineTo(PLANER_SIZE / 2 - 8, -PLANER_SIZE / 3);
    ctx.quadraticCurveTo(PLANER_SIZE / 2, -PLANER_SIZE / 3, PLANER_SIZE / 2, -PLANER_SIZE / 3 + 8);
    ctx.lineTo(PLANER_SIZE / 2, PLANER_SIZE / 3 - 8);
    ctx.quadraticCurveTo(PLANER_SIZE / 2, PLANER_SIZE / 3, PLANER_SIZE / 2 - 8, PLANER_SIZE / 3);
    ctx.lineTo(-PLANER_SIZE / 2 + 8, PLANER_SIZE / 3);
    ctx.quadraticCurveTo(-PLANER_SIZE / 2, PLANER_SIZE / 3, -PLANER_SIZE / 2, PLANER_SIZE / 3 - 8);
    ctx.lineTo(-PLANER_SIZE / 2, -PLANER_SIZE / 3 + 8);
    ctx.quadraticCurveTo(-PLANER_SIZE / 2, -PLANER_SIZE / 3, -PLANER_SIZE / 2 + 8, -PLANER_SIZE / 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2d5a5';
    ctx.fillRect(-PLANER_SIZE / 3, -PLANER_SIZE / 2, PLANER_SIZE * 2 / 3, 9);
    ctx.restore();
  }

  function drawPickupTexts() {
    const now = performance.now();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pickupTexts = pickupTexts.filter((pickup) => now - pickup.started < PICKUP_TEXT_DURATION);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    pickupTexts.forEach((pickup) => {
      const progress = Math.max(0, (now - pickup.started) / PICKUP_TEXT_DURATION);
      const rise = reducedMotion ? 0 : 35 * (1 - (1 - progress) ** 2);
      const y = Math.max(24, Math.min(window.innerHeight - 22, pickup.y - 20 - rise));
      const maxWidth = Math.max(1, window.innerWidth - 16);
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const width = Math.min(maxWidth, Math.max(ctx.measureText(pickup.name).width, 40));
      const x = Math.max(width / 2 + 8, Math.min(window.innerWidth - width / 2 - 8, pickup.x));
      ctx.globalAlpha = progress < 0.65 ? 1 : (1 - progress) / 0.35;
      ctx.strokeStyle = 'rgba(25, 16, 9, 0.95)';
      ctx.lineWidth = 4;
      ctx.strokeText(pickup.name, x, y + 20, maxWidth);
      ctx.fillStyle = '#fff1d2';
      ctx.fillText(pickup.name, x, y + 20, maxWidth);
      ctx.font = 'bold 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.strokeText('+1', x, y, maxWidth);
      ctx.fillStyle = '#ffc04f';
      ctx.fillText('+1', x, y, maxWidth);
    });
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    drawShavingsTrail();
    items.forEach((item) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 3;
      if (item.image.loaded) {
        ctx.drawImage(item.image, item.x - ITEM_SIZE / 2, item.y - ITEM_SIZE / 2, ITEM_SIZE, ITEM_SIZE);
      } else {
        ctx.beginPath();
        ctx.arc(item.x, item.y, ITEM_SIZE / 3, 0, Math.PI * 2);
        ctx.fillStyle = '#e0ad68';
        ctx.fill();
      }
      ctx.restore();
    });

    const head = worm[0];
    if (planerSprite && planerSprite.loaded) {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(angle);
      ctx.drawImage(planerSprite, -PLANER_SIZE / 2, -PLANER_SIZE / 2, PLANER_SIZE, PLANER_SIZE);
      ctx.restore();
    } else {
      drawFallbackPlaner(head.x, head.y);
    }
    drawPickupTexts();
  }

  function loop() {
    if (!running) return;
    try {
      update();
      draw();
    } catch (err) {
      showDebug('Frame error: ' + err.message);
    }
    animId = requestAnimationFrame(loop);
  }

  function startGame() {
    loadSprites();
    running = true;
    score = 0;
    boostUntil = 0;
    pickupTexts = [];
    scoreEl.textContent = 0;
    debugEl.style.display = 'none';
    if (spriteErrors) reportSpriteError();
    joystick = null;
    resizeCanvas();
    resetWorm();
    items = [];
    fillItems();
    canvas.style.display = 'block';
    shield.setAttribute('data-active', 'true');
    hud.style.display = 'block';
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtn.setAttribute('aria-label', 'Stop planer game');
    toggleBtn.setAttribute('data-tooltip', 'Stop Planer Game');
    toggleBtn.textContent = '✕';
    loop();
  }

  function stopGame() {
    running = false;
    pickupTexts = [];
    touchTarget = null;
    joystick = null;
    cancelAnimationFrame(animId);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    canvas.style.display = 'none';
    shield.setAttribute('data-active', 'false');
    hud.style.display = 'none';
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.setAttribute('aria-label', 'Start planer game');
    toggleBtn.setAttribute('data-tooltip', 'Play Planer Game');
    toggleBtn.textContent = '🪚';
  }

  function preventAndStop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleShieldTouch(e) {
    if (!running) return;
    preventAndStop(e);
    const t = e.touches[0];
    if (!t) return;
    if (!joystick) {
      joystick = { x: t.clientX, y: t.clientY, angle: angle };
    }
    const dx = t.clientX - joystick.x;
    const dy = t.clientY - joystick.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 8) {
      joystick.angle = Math.atan2(dy, dx);
    }
  }

  function handleShieldTouchEnd(e) {
    if (!running) return;
    preventAndStop(e);
    joystick = null;
  }

  function handleShieldMouseMove(e) {
    if (!running) return;
    e.preventDefault();
    touchTarget = { x: e.clientX, y: e.clientY };
  }

  function attachGlobalListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && running) {
        stopGame();
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keys[e.key] = true;
        if (running) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      keys[e.key] = false;
    });
    window.addEventListener('resize', () => {
      if (running) resizeCanvas();
    });
    shield.addEventListener('touchstart', handleShieldTouch, { passive: false });
    shield.addEventListener('touchmove', handleShieldTouch, { passive: false });
    shield.addEventListener('touchend', handleShieldTouchEnd, { passive: false });
    shield.addEventListener('touchcancel', handleShieldTouchEnd, { passive: false });
    shield.addEventListener('click', (e) => {
      if (running) preventAndStop(e);
    }, true);
    shield.addEventListener('mousemove', handleShieldMouseMove);
    shield.addEventListener('mousedown', (e) => {
      if (!running) return;
      preventAndStop(e);
      touchTarget = { x: e.clientX, y: e.clientY };
    });
    shield.addEventListener('mouseup', (e) => {
      if (!running) return;
      preventAndStop(e);
      touchTarget = null;
    });
    shield.addEventListener('mouseleave', () => {
      touchTarget = null;
    });
  }

  function init(options) {
    if (initialized) return;
    initialized = true;
    options = options || {};

    const validPositions = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
    const position = validPositions.includes(options.position) ? options.position : 'bottom-left';

    injectStyles();
    createDOM(position);
    attachGlobalListeners();

  }

  window.WormGame = {
    init: init,
    start: startGame,
    stop: stopGame
  };
})(window, document);
