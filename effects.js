(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  /* --------------------------
     Background sawdust canvas
     -------------------------- */
  const bgCanvas = document.getElementById('bg-canvas');
  const bgCtx = bgCanvas.getContext('2d');
  let bgW, bgH;
  let mouse = { x: -1000, y: -1000, vx: 0, vy: 0, lastX: -1000, lastY: -1000 };
  let effectsEnabled = localStorage.getItem('wip-effects') !== 'off';
  let particleCount = effectsEnabled ? (isTouch ? 55 : 110) : 0;
  let particles = [];
  let blasts = [];

  function resizeBg() {
    bgW = window.innerWidth;
    bgH = window.innerHeight;
    bgCanvas.width = Math.floor(bgW);
    bgCanvas.height = Math.floor(bgH);
  }

  const PALETTES = {
    dust:  ['rgba(244,164,96,', 'rgba(210,180,140,', 'rgba(222,184,135,'],
    chip:  ['rgba(245,166,35,', 'rgba(224,130,50,', 'rgba(194,120,60,'],
    spark: ['rgba(255,200,120,', 'rgba(255,160,80,'],
  };

  class Particle {
    constructor(x, y, typeOverride) {
      this.type = typeOverride || (Math.random() < 0.75 ? 'dust' : (Math.random() < 0.8 ? 'chip' : 'spark'));
      this.reset(true, x, y);
    }

    reset(initial = false, spawnX, spawnY) {
      this.x = spawnX != null ? spawnX : Math.random() * bgW;
      this.y = spawnY != null ? spawnY : (initial ? Math.random() * bgH : -12);

      if (this.type === 'dust') {
        this.size = Math.random() * 2 + 0.6;
        this.speedY = Math.random() * 0.9 + 0.25;
        this.speedX = (Math.random() - 0.5) * 0.7;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.06;
        this.opacity = Math.random() * 0.4 + 0.12;
      } else if (this.type === 'chip') {
        this.size = Math.random() * 5 + 2.5;
        this.speedY = Math.random() * 1.4 + 0.6;
        this.speedX = (Math.random() - 0.5) * 1.1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.18;
        this.opacity = Math.random() * 0.55 + 0.25;
      } else {
        this.size = Math.random() * 1.6 + 0.4;
        this.speedY = Math.random() * 0.6 + 0.15;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.55 + 0.35;
      }

      const palette = PALETTES[this.type];
      this.colorBase = palette[Math.floor(Math.random() * palette.length)];
      this.life = 1;
      this.decay = this.type === 'spark' ? 0.006 : (Math.random() * 0.0012 + 0.0004);
    }

    update() {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.y * 0.012) * 0.25;
      this.rotation += this.rotationSpeed;

      // Mouse turbulence with stronger swirl
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 160) {
        const force = (160 - dist) / 160;
        const push = 3.5 * force;
        this.x += (dx / (dist + 1)) * push;
        this.y += (dy / (dist + 1)) * push;
        this.speedX += (dx / (dist + 1)) * force * 0.15;
        this.speedY += (dy / (dist + 1)) * force * 0.15;

        // Add wake from fast mouse movement
        const wake = Math.hypot(mouse.vx, mouse.vy);
        if (wake > 6) {
          this.speedX += mouse.vx * 0.015 * force;
          this.speedY += mouse.vy * 0.015 * force;
        }
      }

      // Blast interactions
      for (const blast of blasts) {
        const bdx = this.x - blast.x;
        const bdy = this.y - blast.y;
        const bDist = Math.hypot(bdx, bdy);
        if (bDist < blast.radius) {
          const bForce = (blast.radius - bDist) / blast.radius;
          const bPush = blast.strength * bForce;
          this.x += (bdx / (bDist + 1)) * bPush;
          this.y += (bdy / (bDist + 1)) * bPush;
          this.speedX += (bdx / (bDist + 1)) * bForce * 2;
          this.speedY += (bdy / (bDist + 1)) * bForce * 2;
          this.rotationSpeed += bForce * 0.3;
        }
      }

      // Gentle flow away from central content column
      const centerX = bgW / 2;
      const fromCenter = this.x - centerX;
      if (Math.abs(fromCenter) < 180 && this.y > 120 && this.y < bgH - 80) {
        const nudge = (fromCenter > 0 ? 1 : -1) * 0.06;
        this.speedX += nudge;
      }

      // Damping
      this.speedX *= 0.995;
      this.speedY *= 0.998;

      this.life -= this.decay;
      if (this.y > bgH + 20 || this.life <= 0 || this.x < -20 || this.x > bgW + 20) {
        this.reset();
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.colorBase + (this.opacity * this.life) + ')';
      ctx.globalAlpha = this.life;

      if (this.type === 'dust') {
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      } else if (this.type === 'chip') {
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function spawnBlast(x, y) {
    blasts.push({ x, y, radius: 10, maxRadius: 220, strength: 8, life: 1 });
    const spawnCount = isTouch ? 18 : 32;
    for (let i = 0; i < spawnCount; i++) {
      const type = Math.random() < 0.7 ? 'chip' : (Math.random() < 0.6 ? 'dust' : 'spark');
      const p = new Particle(x, y, type);
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      p.speedX = Math.cos(angle) * speed;
      p.speedY = Math.sin(angle) * speed;
      p.rotationSpeed = (Math.random() - 0.5) * 0.5;
      particles.push(p);
    }
    // Trim back to target count after the blast settles
    while (particles.length > particleCount) particles.shift();
  }

  function animateBg() {
    if (!effectsEnabled) return;
    bgCtx.clearRect(0, 0, bgW, bgH);

    // Update blasts
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.radius += (b.maxRadius - b.radius) * 0.12;
      b.strength *= 0.92;
      b.life -= 0.025;
      if (b.life <= 0 || b.strength < 0.1) blasts.splice(i, 1);
    }

    // Track mouse velocity
    mouse.vx = mouse.x - mouse.lastX;
    mouse.vy = mouse.y - mouse.lastY;
    mouse.lastX = mouse.x;
    mouse.lastY = mouse.y;

    for (const p of particles) {
      p.update();
      p.draw(bgCtx);
    }
    requestAnimationFrame(animateBg);
  }

  function setEffectsEnabled(enabled) {
    effectsEnabled = enabled;
    localStorage.setItem('wip-effects', enabled ? 'on' : 'off');
    if (enabled) {
      particleCount = isTouch ? 55 : 110;
      while (particles.length < particleCount) particles.push(new Particle());
      animateBg();
    } else {
      particleCount = 0;
      particles = [];
      blasts = [];
      bgCtx.clearRect(0, 0, bgW, bgH);
    }
    updateToggleUI();
  }

  if (!prefersReducedMotion && bgCanvas) {
    resizeBg();
    window.addEventListener('resize', resizeBg);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('click', (e) => {
      if (effectsEnabled) spawnBlast(e.clientX, e.clientY);
    });
    window.addEventListener('touchstart', (e) => {
      if (effectsEnabled && e.touches.length) {
        const t = e.touches[0];
        spawnBlast(t.clientX, t.clientY);
      }
    }, { passive: true });

    if (effectsEnabled) {
      particles = Array.from({ length: particleCount }, () => new Particle());
      animateBg();
    }
  }

  /* --------------------------
     Headline destruction canvas
     -------------------------- */
  const textCanvas = document.getElementById('text-canvas');
  const headline = document.getElementById('headline');

  if (textCanvas && headline && !prefersReducedMotion) {
    const ctx = textCanvas.getContext('2d', { willReadFrequently: true });
    const text = 'Will It Plane?';
    const fontSize = 72;
    let destroyed = false;
    let animating = false;
    let textPixels = [];
    let chipParticles = [];
    let width, height;

    function setCanvasSize() {
      const viewportW = window.innerWidth;
      const maxWidth = Math.min(720, viewportW - 32); // full wrap width with small padding
      width = Math.floor(maxWidth);
      height = Math.max(120, fontSize * 1.8);
      textCanvas.width = width;
      textCanvas.height = height;
      sampleText();
    }

    function sampleText() {
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(1, (width - 24) / 560); // fit text into available width; 560 is rough measure for 72px text
      const drawSize = Math.max(42, Math.floor(fontSize * scale));
      ctx.font = `900 ${drawSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f5a623';
      ctx.fillText(text, width / 2, height / 2);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      textPixels = [];

      const step = 3;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3];
          if (alpha > 128) {
            textPixels.push({
              sx: x,
              sy: y,
              x,
              y,
              vx: 0,
              vy: 0,
              rot: 0,
              vRot: 0,
              color: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
              alpha: 1,
              size: step,
            });
          }
        }
      }
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function drawTextPixel(p, progress) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha * (1 - progress * 0.85);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    function drawIntact() {
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(1, (width - 24) / 560);
      const drawSize = Math.max(42, Math.floor(fontSize * scale));
      ctx.font = `900 ${drawSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f5a623';
      ctx.shadowColor = 'rgba(245, 166, 35, 0.35)';
      ctx.shadowBlur = 20;
      ctx.fillText(text, width / 2, height / 2);
      ctx.shadowBlur = 0;
    }

    function animateDestroy() {
      animating = true;
      const start = performance.now();
      const duration = 1400;
      const chipCount = isTouch ? 120 : 220;

      chipParticles = [];
      for (let i = 0; i < chipCount; i++) {
        const src = textPixels[Math.floor(Math.random() * textPixels.length)] || { sx: width / 2, sy: height / 2 };
        const angle = (Math.random() - 0.5) * Math.PI * 1.2;
        const speed = Math.random() * 10 + 4;
        chipParticles.push({
          x: src.sx,
          y: src.sy,
          vx: Math.sin(angle) * speed,
          vy: Math.cos(angle) * speed - 3,
          rot: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 4 + 2,
          color: Math.random() > 0.5 ? '#f5a623' : '#e05200',
          life: 1,
        });
      }

      function frame(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        ctx.clearRect(0, 0, width, height);

        // Draw remaining text pixels moving apart
        if (progress < 0.85) {
          for (const p of textPixels) {
            p.x = p.sx + p.vx * eased;
            p.y = p.sy + p.vy * eased;
            p.rot = p.vRot * eased;
            drawTextPixel(p, progress);
          }
        }

        // Draw shavings
        for (const c of chipParticles) {
          c.x += c.vx;
          c.y += c.vy;
          c.vy += 0.25; // gravity
          c.rot += c.vRot;
          c.life -= 0.012;
          if (c.life > 0) {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.globalAlpha = c.life;
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
            ctx.restore();
          }
        }

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          destroyed = true;
          animating = false;
          setTimeout(rebuildText, 350);
        }
      }
      requestAnimationFrame(frame);
    }

    function rebuildText() {
      const start = performance.now();
      const duration = 700;
      const target = textPixels.map(p => ({ sx: p.sx, sy: p.sy, x: p.x, y: p.y, vx: p.vx, vy: p.vy, rot: p.rot, vRot: p.vRot, color: p.color, alpha: p.alpha, size: p.size }));

      function frame(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        ctx.clearRect(0, 0, width, height);
      const scale = Math.min(1, (width - 24) / 560);
      const drawSize = Math.max(42, Math.floor(fontSize * scale));
      ctx.font = `900 ${drawSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < textPixels.length; i++) {
          const t = target[i];
          textPixels[i].x = t.x + (t.sx - t.x) * eased;
          textPixels[i].y = t.y + (t.sy - t.y) * eased;
          textPixels[i].rot = t.rot * (1 - eased);
          textPixels[i].alpha = 0.2 + 0.8 * eased;
          drawTextPixel(textPixels[i], 1 - eased);
        }

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          destroyed = false;
          sampleText();
          drawIntact();
        }
      }
      requestAnimationFrame(frame);
    }

    function triggerDestroy() {
      if (animating || destroyed) return;
      sampleText();
      for (const p of textPixels) {
        const dx = p.sx - width / 2;
        const dy = p.sy - height / 2;
        const dist = Math.hypot(dx, dy) + 1;
        p.vx = (dx / dist) * (Math.random() * 8 + 3);
        p.vy = (dy / dist) * (Math.random() * 8 + 3) - 2;
        p.vRot = (Math.random() - 0.5) * 0.5;
      }
      animateDestroy();
    }

    setCanvasSize();
    drawIntact();
    window.addEventListener('resize', () => {
      setCanvasSize();
      drawIntact();
    });

    headline.addEventListener('click', triggerDestroy);
    headline.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerDestroy();
      }
    });
    headline.setAttribute('tabindex', '0');
    headline.setAttribute('role', 'button');
  }

  /* --------------------------
     Submit form handler
     -------------------------- */
  const form = document.getElementById('submit-form');
  const submitBtn = document.getElementById('submit-btn');
  const formStatus = document.getElementById('form-status');

  const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1528412213079969995/SU_a2B0nzkQuaLW1krkD3gOWxHJlhCYVHAw4Ptz7iLh-6lg-6qhqNkNA-UcU8Y9DFJtz';
  const DAILY_LIMIT = 3;
  const RATE_LIMIT_KEY = 'wip-suggestion-rate';

  function getRateLimitState() {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { date: '', count: 0 };
    try {
      return JSON.parse(raw);
    } catch {
      return { date: '', count: 0 };
    }
  }

  function setRateLimitState(state) {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  }

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function canSubmitToday() {
    const state = getRateLimitState();
    const today = getToday();
    if (state.date !== today) {
      setRateLimitState({ date: today, count: 0 });
      return { ok: true, remaining: DAILY_LIMIT };
    }
    const remaining = Math.max(0, DAILY_LIMIT - state.count);
    return { ok: remaining > 0, remaining };
  }

  function recordSubmission() {
    const today = getToday();
    const state = getRateLimitState();
    if (state.date !== today) {
      setRateLimitState({ date: today, count: 1 });
    } else {
      state.count += 1;
      setRateLimitState(state);
    }
  }

  /* --------------------------
     Effects toggle UI
     -------------------------- */
  function updateToggleUI() {
    const btn = document.getElementById('effects-toggle');
    if (!btn) return;
    const on = localStorage.getItem('wip-effects') !== 'off';
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Effects: on' : 'Effects: off';
    btn.title = on ? 'Turn particle effects off' : 'Turn particle effects on';
  }

  const toggleBtn = document.getElementById('effects-toggle');
  if (toggleBtn) {
    updateToggleUI();
    toggleBtn.addEventListener('click', () => {
      const currentlyOn = localStorage.getItem('wip-effects') !== 'off';
      setEffectsEnabled(!currentlyOn);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (formStatus) {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
      }

      const data = new FormData(form);
      const object = data.get('object')?.toString().trim();
      const suggestedBy = data.get('suggestedBy')?.toString().trim();
      const notes = data.get('notes')?.toString().trim();

      if (!object) {
        if (formStatus) {
          formStatus.textContent = 'Please enter an object to plane.';
          formStatus.className = 'form-status error';
        }
        return;
      }

      if (object.length > 120) {
        if (formStatus) {
          formStatus.textContent = 'Object name is too long (max 120 characters).';
          formStatus.className = 'form-status error';
        }
        return;
      }

      const rate = canSubmitToday();
      if (!rate.ok) {
        if (formStatus) {
          formStatus.textContent = `Daily suggestion limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Try again tomorrow.`;
          formStatus.className = 'form-status error';
        }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      const payload = {
        username: 'Will It Plane Suggestions',
        avatar_url: 'https://www.willitplane.com/WIP_logo_hazard.png',
        embeds: [{
          title: 'New object suggestion',
          color: 16098851, // #f5a623
          fields: [
            { name: 'Object to plane', value: object, inline: false },
          ],
          footer: { text: 'Submitted via willitplane.com' },
          timestamp: new Date().toISOString(),
        }],
      };

      if (suggestedBy) {
        payload.embeds[0].fields.push({ name: 'Suggested by', value: suggestedBy.slice(0, 80), inline: true });
      }
      if (notes) {
        payload.embeds[0].fields.push({ name: 'Notes', value: notes.slice(0, 500), inline: false });
      }

      try {
        const res = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          recordSubmission();
          form.reset();
          const remaining = rate.remaining - 1;
          if (formStatus) {
            formStatus.textContent = `Suggestion sent — thanks! ${remaining} remaining today.`;
            formStatus.className = 'form-status success';
          }
        } else {
          throw new Error(`Discord responded with ${res.status}`);
        }
      } catch (err) {
        if (formStatus) {
          formStatus.textContent = 'Could not send. Try again or email us directly.';
          formStatus.className = 'form-status error';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send suggestion';
      }
    });
  }
})();
