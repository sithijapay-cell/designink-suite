/**
 * DesignInk — Interactive Particle Network Background
 * Vanilla Canvas, zero dependencies, ~60fps
 */
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-bg';
  canvas.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0;
    pointer-events: none;
  `;
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');

  // --- Config ---
  const CONFIG = {
    particleCount: 110,
    connectionDistance: 140,
    mouseRadius: 120,
    mouseRepelStrength: 0.04,
    driftSpeed: 0.35,
    particleMinSize: 1.5,
    particleMaxSize: 3.2,
    colors: {
      cyan: '6, 182, 212',
      purple: '139, 92, 246',
      indigo: '99, 102, 241',
    },
  };

  let W = 0, H = 0;
  const mouse = { x: -9999, y: -9999 };
  let particles = [];
  let animId;

  // --- Resize ---
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // --- Particle ---
  class Particle {
    constructor() { this.reset(true); }

    reset(initial = false) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : -10;
      this.ox = this.x; // original position for parallax offset
      this.oy = this.y;
      this.size = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);
      this.speedX = (Math.random() - 0.5) * CONFIG.driftSpeed;
      this.speedY = (Math.random() - 0.5) * CONFIG.driftSpeed;
      // pick a color
      const keys = Object.keys(CONFIG.colors);
      this.colorKey = keys[Math.floor(Math.random() * keys.length)];
      this.baseAlpha = 0.4 + Math.random() * 0.4;
      this.alpha = this.baseAlpha;
      this.twinkleSpeed = 0.005 + Math.random() * 0.01;
      this.twinkleDir = 1;
      // mouse repel velocity
      this.vx = 0;
      this.vy = 0;
    }

    update() {
      // Twinkle
      this.alpha += this.twinkleSpeed * this.twinkleDir;
      if (this.alpha > this.baseAlpha + 0.3 || this.alpha < this.baseAlpha - 0.2) {
        this.twinkleDir *= -1;
      }

      // Mouse repel
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.mouseRadius) {
        const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius;
        this.vx += (dx / dist) * force * CONFIG.mouseRepelStrength;
        this.vy += (dy / dist) * force * CONFIG.mouseRepelStrength;
        this.alpha = Math.min(1, this.alpha + force * 0.5);
      }

      // Dampen repel velocity
      this.vx *= 0.92;
      this.vy *= 0.92;

      this.x += this.speedX + this.vx;
      this.y += this.speedY + this.vy;

      // Wrap edges
      if (this.x < -20) this.x = W + 20;
      if (this.x > W + 20) this.x = -20;
      if (this.y < -20) this.y = H + 20;
      if (this.y > H + 20) this.y = -20;
    }

    draw() {
      const rgb = CONFIG.colors[this.colorKey];
      // Outer glow
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
      grd.addColorStop(0, `rgba(${rgb}, ${this.alpha})`);
      grd.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, this.alpha + 0.2)})`;
      ctx.fill();
    }
  }

  // --- Init particles ---
  function init() {
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new Particle());
    }
  }

  // --- Draw connections ---
  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.connectionDistance) {
          const alpha = (1 - dist / CONFIG.connectionDistance) * 0.25;
          // blend colors
          const rgbA = CONFIG.colors[a.colorKey];
          const rgbB = CONFIG.colors[b.colorKey];
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(${rgbA}, ${alpha})`);
          grad.addColorStop(1, `rgba(${rgbB}, ${alpha})`);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  }

  // --- Mouse cursor glow ---
  function drawMouseGlow() {
    if (mouse.x < 0) return;
    const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, CONFIG.mouseRadius);
    grd.addColorStop(0, 'rgba(6, 182, 212, 0.06)');
    grd.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, CONFIG.mouseRadius, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }

  // --- Animate ---
  function animate() {
    ctx.clearRect(0, 0, W, H);

    drawMouseGlow();
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });

    animId = requestAnimationFrame(animate);
  }

  // --- Events ---
  window.addEventListener('resize', () => { resize(); init(); });
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  // --- Start ---
  resize();
  init();
  animate();
})();
