/**
 * Worm Game — drop-in easter egg overlay.
 *
 * Usage: include this script anywhere on a page, then call:
 *   WormGame.init();
 *
 * It creates its own DOM (toggle button, canvas, HUD), its own styles,
 * and lazy-loads its only dependency (Rough.js) from cdnjs. Nothing needs
 * to already exist on the host page — one script tag + one init() call.
 *
 * Namespacing: every element/id/class this module creates is prefixed
 * with "wip-worm-" to avoid colliding with anything on the host site.
 */
(function (window, document) {
  'use strict';

  if (window.WormGame) return; // don't double-init if the script loads twice

  const NS = 'wip-worm';
  const ROUGH_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/rough.js/2.1.1/rough.umd.min.js';

  const SEGMENT_SIZE = 14;
  const SPEED = 3.2;
  const TURN_RATE = 0.08;
  const FRUIT_COUNT = 6;
  const FRUIT_RADIUS = 8;
  const EAT_DISTANCE = 16;

  let initialized = false;
  let running = false;
  let score = 0;
  let worm = [];
  let angle = 0;
  let targetAngle = 0;
  let fruits = [];
  let keys = {};
  let touchTarget = null;
  let animId = null;
  let roughOk = false;
  let headSprite = null;
  let bodySprite = null;
  const WORM_SPRITE_SIZE = SEGMENT_SIZE * 2 + 12;

  let canvas, ctx, toggleBtn, hud, scoreEl, debugEl, shield;

  function injectStyles() {
    if (document.getElementById(NS + '-styles')) return;
    const style = document.createElement('style');
    style.id = NS + '-styles';
    style.textContent = `
      #${NS}-toggle {
        position: fixed;
        bottom: 1rem;
        left: 1rem;
        z-index: 1000000;
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
        z-index: 999999;
        pointer-events: none;
        display: none;
      }
      #${NS}-shield {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999990;
        background: transparent;
        display: none;
      }
      #${NS}-shield[data-active="true"] {
        display: block;
      }
      #${NS}-hud {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 999999;
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
        z-index: 999999;
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
    toggleBtn.setAttribute('aria-label', 'Start worm game');
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.setAttribute('data-tooltip', 'Play Worm Game');
    toggleBtn.setAttribute('data-position', position);
    toggleBtn.textContent = '🐛';
    document.body.appendChild(toggleBtn);

    hud = document.createElement('div');
    hud.id = NS + '-hud';
    hud.innerHTML = 'Score: <span></span>';
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

  function loadRough(callback) {
    if (window.rough && typeof window.rough.canvas === 'function') {
      callback(true);
      return;
    }
    const existing = document.querySelector('script[data-wip-worm-rough]');
    if (existing) {
      existing.addEventListener('load', () => callback(true));
      existing.addEventListener('error', () => callback(false));
      return;
    }
    const script = document.createElement('script');
    script.src = ROUGH_CDN_URL;
    script.setAttribute('data-wip-worm-rough', '1');
    script.onload = () => callback(true);
    script.onerror = () => callback(false);
    document.head.appendChild(script);
  }

  function makeSpriteCanvas(size, drawFn) {
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const rc = window.rough.canvas(off);
    drawFn(rc, size);
    return off;
  }

  function buildWormSprites() {
    headSprite = makeSpriteCanvas(WORM_SPRITE_SIZE, (rc, s) => {
      rc.circle(s / 2, s / 2, SEGMENT_SIZE, {
        fill: '#1a7f37', fillStyle: 'solid', stroke: '#12592a',
        strokeWidth: 1.5, roughness: 1.4, seed: 1
      });
    });
    bodySprite = makeSpriteCanvas(WORM_SPRITE_SIZE, (rc, s) => {
      rc.circle(s / 2, s / 2, SEGMENT_SIZE, {
        fill: '#2fae5c', fillStyle: 'solid', stroke: '#12592a',
        strokeWidth: 1.5, roughness: 1.4, seed: 2
      });
    });
  }

  function showDebug(msg) {
    debugEl.textContent = msg;
    debugEl.style.display = 'block';
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

  function spawnFruit() {
    const margin = 40;
    const x = margin + Math.random() * (window.innerWidth - margin * 2);
    const y = margin + Math.random() * (window.innerHeight - margin * 2);
    const hue = Math.floor(Math.random() * 360);
    const seed = Math.floor(Math.random() * 1000);
    const size = FRUIT_RADIUS * 2 + 12;
    const sprite = roughOk ? makeSpriteCanvas(size, (rc, s) => {
      rc.circle(s / 2, s / 2, FRUIT_RADIUS * 2, {
        fill: `hsl(${hue}, 70%, 55%)`,
        fillStyle: 'hachure',
        fillWeight: 1.5,
        hachureGap: 3,
        stroke: `hsl(${hue}, 60%, 35%)`,
        strokeWidth: 1.5,
        roughness: 1.8,
        seed: seed
      });
    }) : null;
    return { x, y, hue, seed, sprite, spriteSize: size };
  }

  function fillFruits() {
    while (fruits.length < FRUIT_COUNT) {
      fruits.push(spawnFruit());
    }
  }

  function update() {
    if (touchTarget) {
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
    let newX = head.x + Math.cos(angle) * SPEED;
    let newY = head.y + Math.sin(angle) * SPEED;

    if (newX < 0) newX = window.innerWidth;
    if (newX > window.innerWidth) newX = 0;
    if (newY < 0) newY = window.innerHeight;
    if (newY > window.innerHeight) newY = 0;

    worm.unshift({ x: newX, y: newY });
    worm.pop();

    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      const dx = f.x - newX;
      const dy = f.y - newY;
      if (Math.sqrt(dx * dx + dy * dy) < EAT_DISTANCE) {
        fruits.splice(i, 1);
        score++;
        scoreEl.textContent = score;
        const tail = worm[worm.length - 1];
        worm.push({ x: tail.x, y: tail.y });
      }
    }
    fillFruits();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (roughOk) {
      fruits.forEach(f => {
        ctx.drawImage(f.sprite, f.x - f.spriteSize / 2, f.y - f.spriteSize / 2);
      });
      worm.forEach((seg, i) => {
        const sprite = i === 0 ? headSprite : bodySprite;
        ctx.drawImage(sprite, seg.x - WORM_SPRITE_SIZE / 2, seg.y - WORM_SPRITE_SIZE / 2);
      });
    } else {
      fruits.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.x, f.y, FRUIT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${f.hue}, 70%, 55%)`;
        ctx.fill();
      });
      worm.forEach((seg, i) => {
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, SEGMENT_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#1a7f37' : '#2fae5c';
        ctx.fill();
      });
    }
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
    running = true;
    score = 0;
    scoreEl.textContent = 0;
    debugEl.style.display = 'none';
    resizeCanvas();
    resetWorm();
    fruits = [];
    fillFruits();
    canvas.style.display = 'block';
    shield.setAttribute('data-active', 'true');
    hud.style.display = 'block';
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtn.setAttribute('aria-label', 'Stop worm game');
    toggleBtn.setAttribute('data-tooltip', 'Stop Worm Game');
    toggleBtn.textContent = '✕';
    loop();
  }

  function stopGame() {
    running = false;
    touchTarget = null;
    cancelAnimationFrame(animId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
    shield.setAttribute('data-active', 'false');
    hud.style.display = 'none';
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.setAttribute('aria-label', 'Start worm game');
    toggleBtn.setAttribute('data-tooltip', 'Play Worm Game');
    toggleBtn.textContent = '🐛';
  }

  function handleShieldTouch(e) {
    if (!running) return;
    e.preventDefault();
    const t = e.touches[0];
    touchTarget = { x: t.clientX, y: t.clientY };
  }

  function handleShieldMouseMove(e) {
    if (!running) return;
    touchTarget = { x: e.clientX, y: e.clientY };
  }

  function attachGlobalListeners() {
    window.addEventListener('keydown', (e) => {
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
    shield.addEventListener('touchend', () => {
      touchTarget = null;
    });
    shield.addEventListener('mousemove', handleShieldMouseMove);
    shield.addEventListener('mousedown', (e) => {
      if (!running) return;
      touchTarget = { x: e.clientX, y: e.clientY };
    });
    shield.addEventListener('mouseup', () => {
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

    loadRough(function (ok) {
      roughOk = ok;
      if (ok) {
        buildWormSprites();
      }
    });
  }

  window.WormGame = {
    init: init,
    start: startGame,
    stop: stopGame
  };
})(window, document);
