// @ts-check
import { STATE_PRESETS } from './data.js';
import { lerp } from './engine.js';

/**
 * Initialize the 3-layer State-Driven Ambient Engine:
 * 1) CSS @property Aurora Mesh via body[data-sim-state]
 * 2) 60fps HTML5 Canvas Node-Link Data Flow with lerp(0.05) & Data Packets
 * 3) Unified pointermove Cursor-Tracking Spotlight Borders on .bento-card
 */
export function initAmbientEngine() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = /** @type {HTMLCanvasElement | null} */ (
    document.getElementById('data-flow-canvas')
  );
  const cockpit = document.getElementById('bento-cockpit');

  // Layer 3: Cursor-tracking spotlight border on bento cards
  if (cockpit && !prefersReducedMotion) {
    /** @type {NodeListOf<HTMLElement>} */
    const cards = cockpit.querySelectorAll('.bento-card');
    let rafPending = false;
    let lastX = -9999;
    let lastY = -9999;

    cockpit.addEventListener(
      'pointermove',
      (e) => {
        lastX = e.clientX;
        lastY = e.clientY;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          for (let i = 0; i < cards.length; i += 1) {
            const card = cards[i];
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${lastX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${lastY - rect.top}px`);
          }
        });
      },
      { passive: true }
    );
  }

  if (!canvas) {
    return {
      setState(/** @type {keyof typeof STATE_PRESETS} */ simState) {
        document.body.setAttribute('data-sim-state', simState);
      },
    };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      setState(/** @type {keyof typeof STATE_PRESETS} */ simState) {
        document.body.setAttribute('data-sim-state', simState);
      },
    };
  }

  let currentPresetKey = /** @type {keyof typeof STATE_PRESETS} */ (
    document.body.getAttribute('data-sim-state') || 'neutral'
  );
  let target = STATE_PRESETS[currentPresetKey] || STATE_PRESETS.neutral;

  const current = {
    speed: target.speed,
    maxDist: target.maxDist,
    r: target.r,
    g: target.g,
    b: target.b,
  };

  let width = 0;
  let height = 0;
  let dpr = 1;

  /** @type {{ x: number; y: number; vx: number; vy: number; radius: number; phase: number }[]} */
  let nodes = [];

  function buildNodes() {
    const count = window.innerWidth >= 1024 ? 48 : 24;
    nodes = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i * 137.5 * Math.PI) / 180;
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * (0.4 + Math.random() * 0.6),
        vy: Math.sin(angle) * (0.4 + Math.random() * 0.6),
        radius: 1.5 + (i % 3) * 0.65,
        phase: (i / count) * Math.PI * 2,
      });
    }
  }

  function resize() {
    if (!canvas || !ctx) return;
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildNodes();
  }

  resize();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 150);
  });

  let tick = 0;

  function drawFrame() {
    if (!ctx) return;
    tick += 0.018;

    // Lerp physics & color toward target state
    current.speed = lerp(current.speed, target.speed, 0.05);
    current.maxDist = lerp(current.maxDist, target.maxDist, 0.05);
    current.r = lerp(current.r, target.r, 0.05);
    current.g = lerp(current.g, target.g, 0.05);
    current.b = lerp(current.b, target.b, 0.05);

    const r = Math.round(current.r);
    const g = Math.round(current.g);
    const b = Math.round(current.b);
    const maxDistSq = current.maxDist * current.maxDist;

    ctx.clearRect(0, 0, width, height);

    // Update node positions
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      if (!prefersReducedMotion) {
        n.x += n.vx * current.speed;
        n.y += n.vy * current.speed;
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
      }
    }

    // Connect nearby nodes (using squared distance, zero Math.sqrt)
    let packetIndex = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const nodeB = nodes[j];
        const dx = a.x - nodeB.x;
        const dy = a.y - nodeB.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          const strength = 1 - distSq / maxDistSq;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(strength * 0.28).toFixed(3)})`;
          ctx.lineWidth = 0.8 + strength * 0.9;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(nodeB.x, nodeB.y);
          ctx.stroke();

          // Flowing Data Packet pulse on strong links
          if (!prefersReducedMotion && strength > 0.35 && packetIndex % 4 === 0) {
            const t = (tick + a.phase) % 1;
            const px = lerp(a.x, nodeB.x, t);
            const py = lerp(a.y, nodeB.y, t);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(strength * 0.85).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          packetIndex += 1;
        }
      }
    }

    // Draw nodes
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.62)`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!prefersReducedMotion) {
      requestAnimationFrame(drawFrame);
    }
  }

  if (prefersReducedMotion) {
    drawFrame();
  } else {
    requestAnimationFrame(drawFrame);
  }

  return {
    /**
     * @param {keyof typeof STATE_PRESETS} simState
     */
    setState(simState) {
      currentPresetKey = simState;
      target = STATE_PRESETS[simState] || STATE_PRESETS.neutral;
      document.body.setAttribute('data-sim-state', simState);
      document.documentElement.style.setProperty('--aurora-c1', target.aurora1);
      document.documentElement.style.setProperty('--aurora-c2', target.aurora2);
      if (prefersReducedMotion) {
        drawFrame();
      }
    },
  };
}
