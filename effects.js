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
  let mouse = { x: -1000, y: -1000 };

  function resizeBg() {
    bgW = window.innerWidth;
    bgH = window.innerHeight;
    bgCanvas.width = Math.floor(bgW);
    bgCanvas.height = Math.floor(bgH);
  }

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * bgW;
      this.y = initial ? Math.random() * bgH : -10;
      this.size = Math.random() * 2.5 + 0.8;
      this.speedY = Math.random() * 0.8 + 0.2;
      this.speedX = (Math.random() - 0.5) * 0.6;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.08;
      this.opacity = Math.random() * 0.45 + 0.15;
      this.color = Math.random() > 0.5
        ? `rgba(244,164,96,${this.opacity})`
        : `rgba(210,180,140,${this.opacity})`;
      this.life = 1;
      this.decay = Math.random() * 0.001 + 0.0005;
    }

    update() {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.y * 0.01) * 0.2;
      this.rotation += this.rotationSpeed;

      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80) {
        const force = (80 - dist) / 80;
        this.x += (dx / dist) * force * 2;
        this.y += (dy / dist) * force * 2;
      }

      this.life -= this.decay;
      if (this.y > bgH + 10 || this.life <= 0) this.reset();
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.life;
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
      ctx.restore();
    }
  }

  const particleCount = isTouch ? 40 : 80;
  const particles = Array.from({ length: particleCount }, () => new Particle());

  function animateBg() {
    bgCtx.clearRect(0, 0, bgW, bgH);
    for (const p of particles) {
      p.update();
      p.draw(bgCtx);
    }
    requestAnimationFrame(animateBg);
  }

  if (!prefersReducedMotion && bgCanvas) {
    resizeBg();
    window.addEventListener('resize', resizeBg);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });
    animateBg();
  }

  /* --------------------------
     Headline destruction canvas
     -------------------------- */
  const textCanvas = document.getElementById('text-canvas');
  const headline = document.getElementById('headline');

  if (textCanvas && headline && !prefersReducedMotion) {
    const ctx = textCanvas.getContext('2d');
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
     Submit form mailto handler
     -------------------------- */
  const form = document.getElementById('submit-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const object = data.get('object')?.toString().trim();
      const suggestedBy = data.get('suggestedBy')?.toString().trim();
      const notes = data.get('notes')?.toString().trim();

      if (!object) return;

      const subject = encodeURIComponent(`Suggestion: ${object}`);
      const body = encodeURIComponent(
        `Object to plane: ${object}\n` +
        (suggestedBy ? `Suggested by: ${suggestedBy}\n` : '') +
        (notes ? `\nNotes:\n${notes}` : '')
      );

      window.location.href = `mailto:willitplane@gmail.com?subject=${subject}&body=${body}`;
    });
  }
})();
