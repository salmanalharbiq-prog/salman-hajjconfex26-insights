// @ts-check
import { STATE_PRESETS } from './data.js';
import { lerp } from './engine.js';

/**
 * Calm State-Driven Ambient Engine:
 * 1) CSS @property Aurora Mesh via body[data-sim-state]
 * 2) Subtle 60fps HTML5 Canvas Node-Link Data Flow (lerp 0.05)
 * 3) Unified pointermove Cursor-Tracking Spotlight Borders on .bento-card
 */
export function initAmbientEngine() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = /** @type {HTMLCanvasElement | null} */ (
    document.getElementById('data-flow-canvas')
  );

  // Layer 3: Proximity cursor-tracking + mobile touch/scroll glow across all card boxes
  if (!prefersReducedMotion) {
    const CARD_SELECTOR =
      '.bento-card, .kpi-gauge-card, .chain-node, .chapter-card, .insight-card, .slot-card, .footer-disclaimer';
    /** @type {HTMLElement[]} */
    let cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    let cardsDirty = false;

    const observer = new MutationObserver(() => {
      cardsDirty = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let rafPending = false;
    let lastX = -9999;
    let lastY = -9999;
    let lastPointerTime = 0;
    /** @type {'mouse' | 'touch'} */
    let lastMode = window.matchMedia('(hover: none)').matches ? 'touch' : 'mouse';
    /** @type {HTMLElement | null} */
    let touchedCard = null;
    let touchTimer = 0;

    function syncCardsList() {
      if (cardsDirty) {
        cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
        cardsDirty = false;
      }
    }

    function updatePointerGlow() {
      syncCardsList();
      const vh = window.innerHeight;
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const rect = card.getBoundingClientRect();
        if (rect.bottom < -180 || rect.top > vh + 180) continue;

        const clampedX = Math.max(rect.left, Math.min(lastX, rect.right));
        const clampedY = Math.max(rect.top, Math.min(lastY, rect.bottom));
        const dist = Math.hypot(lastX - clampedX, lastY - clampedY);
        const radius = 210;
        const proximity = Math.max(0, 1 - dist / radius);

        card.style.setProperty('--mouse-x', `${(lastX - rect.left).toFixed(1)}px`);
        card.style.setProperty('--mouse-y', `${(lastY - rect.top).toFixed(1)}px`);
        card.style.setProperty('--glow-strength', proximity.toFixed(3));
      }
    }

    function updateScrollFocalGlow() {
      syncCardsList();
      const vh = window.innerHeight;
      const focalY = vh * 0.46;
      const band = vh * 0.42;

      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const rect = card.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) {
          card.style.setProperty('--glow-strength', '0');
          continue;
        }
        const centerY = rect.top + rect.height / 2;
        const distFromFocal = Math.abs(centerY - focalY);
        const strength = Math.max(0.18, Math.min(0.88, 1 - distFromFocal / band));
        card.style.setProperty('--mouse-x', `${(rect.width * 0.5).toFixed(1)}px`);
        card.style.setProperty('--mouse-y', `${(rect.height * 0.36).toFixed(1)}px`);
        card.style.setProperty('--glow-strength', strength.toFixed(3));
      }
    }

    function scheduleUpdate() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const now = performance.now();
        if (lastMode === 'mouse' && now - lastPointerTime < 3500 && lastX > -1000) {
          updatePointerGlow();
        } else {
          updateScrollFocalGlow();
        }
      });
    }

    document.addEventListener(
      'pointermove',
      (e) => {
        lastX = e.clientX;
        lastY = e.clientY;
        lastPointerTime = performance.now();
        lastMode = e.pointerType === 'touch' ? 'touch' : 'mouse';
        if (lastMode === 'mouse') {
          scheduleUpdate();
        } else {
          updatePointerGlow();
        }
      },
      { passive: true }
    );

    /** @param {TouchEvent} e */
    function handleTouch(e) {
      const touch = e.touches[0];
      if (!touch) return;
      lastX = touch.clientX;
      lastY = touch.clientY;
      lastPointerTime = performance.now();
      lastMode = 'touch';

      const target = /** @type {HTMLElement | null} */ (e.target)?.closest(CARD_SELECTOR);
      if (target instanceof HTMLElement) {
        if (touchedCard && touchedCard !== target) {
          touchedCard.classList.remove('is-touch-lit');
        }
        touchedCard = target;
        touchedCard.classList.add('is-touch-lit');
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(() => {
          touchedCard?.classList.remove('is-touch-lit');
        }, 900);
      }
      scheduleUpdate();
    }

    document.addEventListener('touchstart', handleTouch, { passive: true });
    document.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('scroll', scheduleUpdate, { passive: true });

    // Initial gentle illumination for visible cards (especially on mobile)
    requestAnimationFrame(() => {
      updateScrollFocalGlow();
    });
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
        vx: Math.cos(angle) * (0.35 + Math.random() * 0.45),
        vy: Math.sin(angle) * (0.35 + Math.random() * 0.45),
        radius: 1.4 + (i % 3) * 0.5,
        phase: (i / count) * Math.PI * 2,
      });
    }
    if (canvas) {
      canvas.setAttribute('data-node-count', String(nodes.length));
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
    tick += 0.012;

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
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(strength * 0.17).toFixed(3)})`;
          ctx.lineWidth = 0.75 + strength * 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(nodeB.x, nodeB.y);
          ctx.stroke();

          if (!prefersReducedMotion && strength > 0.4 && packetIndex % 5 === 0) {
            const t = (tick + a.phase) % 1;
            const px = lerp(a.x, nodeB.x, t);
            const py = lerp(a.y, nodeB.y, t);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(strength * 0.55).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          packetIndex += 1;
        }
      }
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.42)`;
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
      if (prefersReducedMotion) {
        drawFrame();
      }
    },
  };
}
