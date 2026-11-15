// @ts-check
import {
  BUILDING_BLOCKS,
  CASE_STUDIES,
  IDEAL_PLAN_IDS,
  INSIGHTS,
  KPI_META,
  METHODOLOGY_SOURCES,
  METHODOLOGY_WEIGHTS,
  ORG_PROFILES,
  SDAIA_LINKS,
  SECTORS,
  STAGES,
} from './data.js';
import { evaluateSimulation } from './engine.js';
import { initAmbientEngine } from './ambient.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Application state
 * @type {{
 *   orgSize: 'enterprise' | 'sme';
 *   sectorId: string;
 *   mode: 'quick' | 'builder';
 *   quickPath: 'neutral' | 'shell' | 'foundation';
 *   activeStageIndex: number;
 *   slots: (string | null)[];
 *   caseFilter: 'all' | 'success' | 'failure';
 * }}
 */
const state = {
  orgSize: 'enterprise',
  sectorId: SECTORS[0].id,
  mode: 'quick',
  quickPath: 'neutral',
  activeStageIndex: 0,
  slots: [null, null, null, null],
  caseFilter: 'all',
};

/** @type {WeakMap<HTMLElement, number>} */
const activeAnimFrames = new WeakMap();

/**
 * Ease-out cubic counter ticker (260ms default).
 * @param {HTMLElement | null} el
 * @param {number} targetVal
 * @param {number} [duration=260]
 */
function animateNumber(el, targetVal, duration = 260) {
  if (!el) return;
  const prevFrame = activeAnimFrames.get(el);
  if (prevFrame) cancelAnimationFrame(prevFrame);

  const startVal = Number.parseInt(el.textContent || '0', 10) || 0;
  if (prefersReducedMotion || startVal === targetVal) {
    el.textContent = String(targetVal);
    return;
  }

  const startTime = performance.now();
  /** @param {number} now */
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (targetVal - startVal) * eased);
    if (el) el.textContent = String(current);
    if (progress < 1) {
      const id = requestAnimationFrame(step);
      if (el) activeAnimFrames.set(el, id);
    }
  }
  const id = requestAnimationFrame(step);
  activeAnimFrames.set(el, id);
}

/**
 * Wrap DOM updates with View Transitions API when supported and motion is allowed.
 * @param {() => void} updateFn
 */
function runWithTransition(updateFn) {
  if (
    typeof document.startViewTransition === 'function' &&
    !prefersReducedMotion
  ) {
    try {
      document.startViewTransition(updateFn);
      return;
    } catch {
      // Fallback to direct DOM update
    }
  }
  updateFn();
}

/**
 * Create an accessible fallback image handler so broken external photos never show raw broken-image frames.
 * @param {HTMLImageElement} imgEl
 * @param {string} title
 */
function attachImageFallback(imgEl, title) {
  imgEl.addEventListener('error', () => {
    const parent = imgEl.parentElement;
    if (!parent || parent.querySelector('.insight-fallback')) return;
    imgEl.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.className = 'insight-fallback';
    fallback.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <circle cx="8.5" cy="9.5" r="1.5"></circle>
        <path d="M21 15l-5-5L5 20"></path>
      </svg>
      <span>${title}</span>
    `;
    parent.prepend(fallback);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const ambient = initAmbientEngine();

  // Cached DOM references
  const orgButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (
    document.querySelectorAll('.org-toggle-group .seg-btn')
  );
  const orgSolvencyBadge = document.getElementById('org-solvency-badge');
  const orgFactsList = document.getElementById('org-facts-list');

  const sectorsStrip = document.getElementById('sectors-strip');
  const sectorCatLabel = document.getElementById('sector-category-label');
  const sectorGoalLine = document.getElementById('sector-goal-line');
  const sectorContextText = document.getElementById('sector-context-text');
  const sectorImpactText = document.getElementById('sector-impact-text');

  const simStateBadge = document.getElementById('sim-state-badge');
  const readinessScoreEl = document.getElementById('readiness-score');

  const tabQuick = document.getElementById('tab-quick');
  const tabBuilder = document.getElementById('tab-builder');
  const panelQuick = document.getElementById('panel-quick');
  const panelBuilder = document.getElementById('panel-builder');

  const btnPathShell = document.getElementById('btn-path-shell');
  const btnPathFoundation = document.getElementById('btn-path-foundation');

  const stageRadios = /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll('input[name="active-stage"]')
  );
  const slotsGrid = document.getElementById('slots-grid');
  const blocksPalette = document.getElementById('blocks-palette');
  const btnApplyIdeal = document.getElementById('btn-apply-ideal');
  const btnResetPlan = document.getElementById('btn-reset-plan');

  const reactionTitle = document.getElementById('reaction-title');
  const reactionDesc = document.getElementById('reaction-desc');

  const gaugesGrid = document.getElementById('gauges-grid');
  const chainPipeline = document.getElementById('chain-pipeline');
  const chainHealthSummary = document.getElementById('chain-health-summary');
  const expansionCard = document.getElementById('expansion-card');
  const expansionList = document.getElementById('expansion-list');

  const timelineOrgContext = document.getElementById('timeline-org-context');
  const timelineChapters = document.getElementById('timeline-chapters');

  const peekInsightBtn = document.getElementById('peek-insight-btn');
  const peekInsightImg = /** @type {HTMLImageElement | null} */ (
    document.getElementById('peek-insight-img')
  );
  const peekInsightTitle = document.getElementById('peek-insight-title');
  const btnCopyLinkedin = document.getElementById('btn-copy-linkedin');
  const copyFeedback = document.getElementById('copy-feedback');

  const insightModal = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('insight-modal')
  );
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalImg = /** @type {HTMLImageElement | null} */ (
    document.getElementById('modal-img')
  );
  const modalCat = document.getElementById('modal-cat');
  const modalTitle = document.getElementById('modal-title');
  const modalCaption = document.getElementById('modal-caption');

  let lastResult = evaluateSimulation(state);

  // Build static / semi-static structures once
  function buildSectorsStrip() {
    if (!sectorsStrip) return;
    sectorsStrip.innerHTML = SECTORS.map(
      (s) => `
      <button
        type="button"
        role="tab"
        class="sector-btn ${s.id === state.sectorId ? 'is-active' : ''}"
        data-sector-id="${s.id}"
        aria-selected="${s.id === state.sectorId ? 'true' : 'false'}"
      >
        ${s.name}
      </button>
    `
    ).join('');

    sectorsStrip.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('[data-sector-id]');
      if (!btn) return;
      const nextId = btn.getAttribute('data-sector-id');
      if (!nextId || nextId === state.sectorId) return;
      state.sectorId = nextId;
      runWithTransition(renderSimulation);
    });
  }

  function buildGaugesShell() {
    if (!gaugesGrid) return;
    gaugesGrid.innerHTML = KPI_META.map(
      (kpi) => `
      <article class="gauge-card" data-kpi-id="${kpi.id}">
        <div class="gauge-svg-wrap">
          <svg class="gauge-svg" viewBox="0 0 120 75" aria-hidden="true">
            <path class="arc-track" pathLength="100" d="M 17.50 66.39 A 44 44 0 1 1 102.50 66.39" />
            <path
              class="arc-fill"
              id="arc-fill-${kpi.id}"
              pathLength="100"
              d="M 17.50 66.39 A 44 44 0 1 1 102.50 66.39"
              style="--val: 50; --gauge-color: var(--accent-emerald);"
            />
          </svg>
          <div class="gauge-val-overlay">
            <span class="kpi-number" id="kpi-val-${kpi.id}">0</span>
            <span class="gauge-pct">%</span>
          </div>
        </div>

        <div class="pill-meter" id="pill-meter-${kpi.id}" aria-hidden="true">
          ${Array.from({ length: 10 }, () => '<span class="pill-seg"></span>').join('')}
        </div>

        <h3 class="gauge-title">${kpi.title}</h3>
        <span class="gauge-status-label" id="kpi-status-${kpi.id}" data-tone="healthy"></span>

        <details class="gauge-details">
          <summary class="details-summary">شرح ومثال</summary>
          <p class="gauge-explain-body">
            ${kpi.explain}<br /><strong>${kpi.example}</strong>
          </p>
        </details>
      </article>
    `
    ).join('');
  }

  function buildBlocksPalette() {
    if (!blocksPalette) return;
    blocksPalette.innerHTML = BUILDING_BLOCKS.map(
      (b) => `
      <button
        type="button"
        class="block-btn"
        data-block-id="${b.id}"
        data-type="${b.type}"
        title="${b.desc}"
      >
        <span class="block-kind">${b.badge}</span>
        <span class="block-name">${b.title}</span>
      </button>
    `
    ).join('');

    blocksPalette.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('[data-block-id]');
      if (!btn) return;
      const blockId = btn.getAttribute('data-block-id');
      if (!blockId) return;

      // If already placed in another slot, swap it out cleanly
      const existingIdx = state.slots.indexOf(blockId);
      if (existingIdx !== -1 && existingIdx !== state.activeStageIndex) {
        const displaced = state.slots[state.activeStageIndex];
        state.slots[existingIdx] = displaced;
      }

      state.slots[state.activeStageIndex] = blockId;

      // Auto-advance activeStageIndex to the next empty stage for smooth UX
      const nextEmpty = state.slots.findIndex((s, i) => s === null && i > state.activeStageIndex);
      if (nextEmpty !== -1) {
        state.activeStageIndex = nextEmpty;
      } else {
        const firstEmpty = state.slots.findIndex((s) => s === null);
        if (firstEmpty !== -1) {
          state.activeStageIndex = firstEmpty;
        }
      }
      syncStageRadios();
      runWithTransition(renderSimulation);
    });
  }

  function buildEvidenceDrawer() {
    const weightBar = document.getElementById('weight-bar');
    const weightsLegend = document.getElementById('weights-legend');
    const refsEl = document.getElementById('methodology-refs');
    const sdaiaEl = document.getElementById('sdaia-links');

    if (weightBar && weightsLegend) {
      weightBar.innerHTML = METHODOLOGY_WEIGHTS.map(
        (w) =>
          `<div class="weight-segment" style="width: ${w.pct}%; background: ${w.color};" title="${w.label}: ${w.pct}%"></div>`
      ).join('');
      weightsLegend.innerHTML = METHODOLOGY_WEIGHTS.map(
        (w) => `
        <li>
          <span class="weight-swatch" style="background: ${w.color};"></span>
          <span><strong class="kpi-number">${w.pct}%</strong> — ${w.label}</span>
        </li>
      `
      ).join('');
    }

    if (refsEl) {
      refsEl.innerHTML = METHODOLOGY_SOURCES.map(
        (ref) => `
        <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="ref-card">
          <strong>${ref.title}</strong>
          <p>${ref.desc}</p>
          <span class="ext-link-hint">استعراض المرجع ↗</span>
        </a>
      `
      ).join('');
    }

    if (sdaiaEl) {
      sdaiaEl.innerHTML = SDAIA_LINKS.map(
        (item) => `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="sdaia-link-card">
          <strong>${item.title}</strong>
          <span class="ext-link-hint">فتح البوابة الرسمية ↗</span>
        </a>
      `
      ).join('');
    }

    renderCases();

    const filterBtns = document.querySelectorAll('.case-filters .filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filterVal = /** @type {'all' | 'success' | 'failure'} */ (
          btn.getAttribute('data-filter') || 'all'
        );
        state.caseFilter = filterVal;
        filterBtns.forEach((b) =>
          b.classList.toggle('is-active', b.getAttribute('data-filter') === filterVal)
        );
        renderCases();
      });
    });
  }

  function renderCases() {
    const casesGrid = document.getElementById('cases-grid');
    if (!casesGrid) return;
    const filtered =
      state.caseFilter === 'all'
        ? CASE_STUDIES
        : CASE_STUDIES.filter((c) => c.category === state.caseFilter);

    casesGrid.innerHTML = filtered
      .map(
        (c) => `
      <article class="case-card" data-category="${c.category}">
        <div class="case-top">
          <h4 class="case-title">${c.title}</h4>
          <span class="delta-val">${c.delta}</span>
        </div>
        <div class="case-meta-line">${c.context}</div>
        <p class="case-text"><strong>نقطة القرار:</strong> ${c.decision}</p>
        <p class="case-text"><strong>القاعدة السببية:</strong> ${c.rule}</p>
        <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="case-ext-btn">
          استعرض المصدر الموثق لدراسة الحالة ↗
        </a>
      </article>
    `
      )
      .join('');
  }

  function buildInsightsGallery() {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;

    grid.innerHTML = INSIGHTS.map(
      (item) => `
      <article class="insight-card" id="${item.id}">
        <button
          type="button"
          class="insight-media-btn"
          data-insight-id="${item.id}"
          aria-label="تكبير صورة: ${item.title}"
        >
          <img
            src="${item.thumb}"
            alt="${item.title}"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <span class="insight-zoom-hint">معاينة كاملة ↗</span>
        </button>
        <div class="insight-body">
          <span class="insight-cat">${item.category}</span>
          <h3 class="insight-title">${item.title}</h3>
          <p class="insight-caption">${item.caption}</p>
        </div>
      </article>
    `
    ).join('');

    grid.querySelectorAll('img').forEach((img, idx) => {
      attachImageFallback(img, INSIGHTS[idx]?.title || 'صورة ميدانية');
    });

    grid.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('[data-insight-id]');
      if (!btn) return;
      const id = btn.getAttribute('data-insight-id');
      if (id) openInsightModal(id);
    });
  }

  /**
   * @param {string} insightId
   */
  function openInsightModal(insightId) {
    const item = INSIGHTS.find((i) => i.id === insightId);
    if (!item || !insightModal || !modalImg) return;

    modalImg.style.display = 'block';
    const prevFallback = modalImg.parentElement?.querySelector('.insight-fallback');
    if (prevFallback) prevFallback.remove();

    modalImg.src = item.full;
    modalImg.alt = item.title;
    attachImageFallback(modalImg, item.title);
    if (modalCat) modalCat.textContent = item.category;
    if (modalTitle) modalTitle.textContent = item.title;
    if (modalCaption) modalCaption.textContent = item.caption;

    insightModal.showModal();
  }

  if (modalCloseBtn && insightModal) {
    modalCloseBtn.addEventListener('click', () => insightModal.close());
    insightModal.addEventListener('click', (e) => {
      if (e.target === insightModal) insightModal.close();
    });
  }

  function syncStageRadios() {
    stageRadios.forEach((r) => {
      r.checked = Number(r.value) === state.activeStageIndex;
    });
  }

  function renderSlots() {
    if (!slotsGrid) return;
    slotsGrid.innerHTML = STAGES.map((stage, idx) => {
      const blockId = state.slots[idx];
      const block = BUILDING_BLOCKS.find((b) => b.id === blockId) || null;
      const isTarget = idx === state.activeStageIndex;

      let statusClass = '';
      if (block) {
        if (block.type === 'foundation') {
          statusClass = 'is-foundation';
        } else {
          // Check if placed before 2 foundations
          const foundationsBefore = state.slots
            .slice(0, idx)
            .filter((id) => {
              const b = BUILDING_BLOCKS.find((x) => x.id === id);
              return b && b.type === 'foundation';
            }).length;
          statusClass = idx <= 1 || foundationsBefore < 2 ? 'is-ai-bad' : 'is-ai-ok';
        }
      }

      return `
        <div class="slot-card ${isTarget ? 'is-target' : ''} ${statusClass}">
          <button
            type="button"
            class="slot-select-btn"
            data-slot-select="${idx}"
            aria-label="تحديد ${stage.label}"
          >
            <span class="slot-stage-num">${stage.label}</span>
            <span class="slot-block-name">${block ? block.shortTitle : 'خانة فارغة — اختر لبنة'}</span>
          </button>
          ${
            block
              ? `<button type="button" class="slot-clear-btn" data-slot-clear="${idx}" aria-label="إزالة ${block.shortTitle} من ${stage.short}">✕</button>`
              : ''
          }
        </div>
      `;
    }).join('');
  }

  function renderSimulation() {
    const res = evaluateSimulation(state);
    lastResult = res;

    // 1. Ambient Engine State
    ambient.setState(res.simState);

    // 2. Org UI
    const org = ORG_PROFILES[state.orgSize];
    orgButtons.forEach((btn) => {
      const active = btn.getAttribute('data-org') === state.orgSize;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (orgSolvencyBadge) orgSolvencyBadge.textContent = org.solvencyBadge;
    if (orgFactsList) {
      orgFactsList.innerHTML = `
        <li><strong>الاحتياطي:</strong> ${org.reserveText}</li>
        <li><strong>امتصاص التعثر:</strong> ${org.absorptionText}</li>
        <li><strong>سقف المخاطرة:</strong> ${org.riskCeilingText}</li>
      `;
    }

    // 3. Sector UI
    if (sectorsStrip) {
      sectorsStrip.querySelectorAll('.sector-btn').forEach((btn) => {
        const active = btn.getAttribute('data-sector-id') === state.sectorId;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    if (sectorCatLabel) sectorCatLabel.textContent = res.sector.category;
    if (sectorGoalLine) sectorGoalLine.textContent = `الهدف: ${res.sector.goal}`;
    if (sectorContextText) sectorContextText.textContent = res.sector.context;
    if (sectorImpactText) sectorImpactText.textContent = res.sector.impact;

    // 4. Lab Header & Mode Panels
    if (simStateBadge) {
      simStateBadge.textContent = res.stateMeta.badge;
      simStateBadge.setAttribute('data-state', res.simState);
    }

    const isQuick = state.mode === 'quick';
    tabQuick?.classList.toggle('is-active', isQuick);
    tabQuick?.setAttribute('aria-selected', isQuick ? 'true' : 'false');
    tabBuilder?.classList.toggle('is-active', !isQuick);
    tabBuilder?.setAttribute('aria-selected', !isQuick ? 'true' : 'false');
    if (panelQuick) panelQuick.hidden = !isQuick;
    if (panelBuilder) panelBuilder.hidden = isQuick;

    if (btnPathShell) {
      const active = state.mode === 'quick' && state.quickPath === 'shell';
      btnPathShell.classList.toggle('is-selected', active);
      btnPathShell.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (btnPathFoundation) {
      const active = state.mode === 'quick' && state.quickPath === 'foundation';
      btnPathFoundation.classList.toggle('is-selected', active);
      btnPathFoundation.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    // Builder slots & palette usage state
    renderSlots();
    if (blocksPalette) {
      blocksPalette.querySelectorAll('.block-btn').forEach((btn) => {
        const id = btn.getAttribute('data-block-id');
        btn.classList.toggle('is-used', Boolean(id && state.slots.includes(id)));
      });
    }

    if (reactionTitle) reactionTitle.textContent = res.warningTitle;
    if (reactionDesc) reactionDesc.textContent = res.fieldReaction;

    // 5. Gauges (SVG Arc + 10-segment pill meter + animated ticker)
    for (const kpi of KPI_META) {
      const metric = res.kpis[/** @type {keyof typeof res.kpis} */ (kpi.id)];
      const arcFill = document.getElementById(`arc-fill-${kpi.id}`);
      const pillMeter = document.getElementById(`pill-meter-${kpi.id}`);
      const statusEl = document.getElementById(`kpi-status-${kpi.id}`);

      if (arcFill) {
        arcFill.style.setProperty('--val', String(metric.value));
        arcFill.style.setProperty('--gauge-color', metric.color);
      }

      if (pillMeter) {
        const litCount = Math.round(metric.value / 10);
        const segs = pillMeter.querySelectorAll('.pill-seg');
        segs.forEach((seg, idx) => {
          seg.classList.toggle('is-lit', idx < litCount);
          /** @type {HTMLElement} */ (seg).style.setProperty('--gauge-color', metric.color);
        });
      }

      if (statusEl) {
        statusEl.textContent = metric.label;
        statusEl.setAttribute('data-tone', metric.tone);
      }
    }

    // 6. 6-Link Causal Pipeline
    if (chainPipeline) {
      chainPipeline.innerHTML = res.chainLinks
        .map((link) => {
          let cls = '';
          let word = 'قيد التأسيس';
          if (link.state === 'healthy') {
            cls = 'is-healthy';
            word = 'سليمة';
          } else if (link.state === 'bottleneck') {
            cls = 'bottleneck';
            word = 'اختناق!';
          } else if (link.state === 'degraded') {
            cls = 'degraded';
            word = 'متأثرة';
          }
          return `
            <article class="chain-node ${cls}">
              <div class="chain-node-top">
                <span class="node-metric">${link.num}</span>
                <span class="chain-state-word">${word}</span>
              </div>
              <h3 class="chain-node-title">${link.label}</h3>
              <p class="chain-node-desc">${link.sectorDetail}</p>
            </article>
          `;
        })
        .join('');
    }

    if (chainHealthSummary) {
      const healthyCount = res.chainLinks.filter((l) => l.state === 'healthy').length;
      const bottleneckCount = res.chainLinks.filter((l) => l.state === 'bottleneck').length;
      if (healthyCount === 6) {
        chainHealthSummary.textContent = '6/6 حلقات خضراء مستقرة (0 اختناق)';
        chainHealthSummary.style.color = '#34d399';
      } else if (bottleneckCount > 0) {
        chainHealthSummary.textContent = 'رُصد اختناق في سلسلة الأثر!';
        chainHealthSummary.style.color = '#fca5a5';
      } else {
        chainHealthSummary.textContent = `${healthyCount}/6 حلقات مفعّلة`;
        chainHealthSummary.style.color = 'var(--accent-gold)';
      }
    }

    // Positive expansion card when sound plan is built
    if (expansionCard && expansionList) {
      if (res.expansionRecommendations.length > 0) {
        expansionCard.hidden = false;
        expansionList.innerHTML = res.expansionRecommendations
          .map((b) => `<span class="expansion-item">+ ${b.title}</span>`)
          .join('');
      } else {
        expansionCard.hidden = true;
        expansionList.innerHTML = '';
      }
    }

    // 7. 3-Chapter Timeline
    if (timelineOrgContext) {
      timelineOrgContext.textContent = `منظور ${org.label} · ${res.sector.shortName}`;
    }
    if (timelineChapters) {
      timelineChapters.innerHTML = res.timeline
        .map(
          (ch) => `
        <article class="chapter-card" data-tone="${ch.tone}">
          <span class="chapter-kicker">${ch.chapter}</span>
          <h3 class="chapter-title">${ch.title}</h3>
          <p class="chapter-desc">${ch.desc}</p>
        </article>
      `
        )
        .join('');
    }

    // 8. Matrix Peek linked insight
    const linkedInsight = INSIGHTS.find((i) => i.id === res.sector.insightId) || INSIGHTS[0];
    if (peekInsightImg && linkedInsight) {
      peekInsightImg.style.display = 'block';
      peekInsightImg.src = linkedInsight.thumb;
      peekInsightImg.alt = linkedInsight.title;
    }
    if (peekInsightTitle && linkedInsight) {
      peekInsightTitle.textContent = linkedInsight.title;
    }
    if (peekInsightBtn && linkedInsight) {
      peekInsightBtn.setAttribute('data-linked-insight', linkedInsight.id);
    }

    // Trigger ease-out numeric animations
    animateNumber(readinessScoreEl, res.readinessScore, 260);
    for (const kpi of KPI_META) {
      const valEl = document.getElementById(`kpi-val-${kpi.id}`);
      const metric = res.kpis[/** @type {keyof typeof res.kpis} */ (kpi.id)];
      animateNumber(valEl, metric.value, 260);
    }
  }

  // Event listeners
  orgButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const org = /** @type {'enterprise' | 'sme'} */ (btn.getAttribute('data-org'));
      if (!org || org === state.orgSize) return;
      state.orgSize = org;
      runWithTransition(renderSimulation);
    });
  });

  tabQuick?.addEventListener('click', () => {
    if (state.mode === 'quick') return;
    state.mode = 'quick';
    runWithTransition(renderSimulation);
  });

  tabBuilder?.addEventListener('click', () => {
    if (state.mode === 'builder') return;
    state.mode = 'builder';
    runWithTransition(renderSimulation);
  });

  btnPathShell?.addEventListener('click', () => {
    state.mode = 'quick';
    state.quickPath = 'shell';
    runWithTransition(renderSimulation);
  });

  btnPathFoundation?.addEventListener('click', () => {
    state.mode = 'quick';
    state.quickPath = 'foundation';
    runWithTransition(renderSimulation);
  });

  stageRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.activeStageIndex = Number(radio.value) || 0;
      renderSlots();
    });
  });

  slotsGrid?.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const clearBtn = target?.closest('[data-slot-clear]');
    if (clearBtn) {
      const idx = Number(clearBtn.getAttribute('data-slot-clear'));
      if (!Number.isNaN(idx)) {
        state.slots[idx] = null;
        state.activeStageIndex = idx;
        syncStageRadios();
        runWithTransition(renderSimulation);
      }
      return;
    }

    const selectBtn = target?.closest('[data-slot-select]');
    if (selectBtn) {
      const idx = Number(selectBtn.getAttribute('data-slot-select'));
      if (!Number.isNaN(idx)) {
        state.activeStageIndex = idx;
        syncStageRadios();
        renderSlots();
      }
    }
  });

  btnApplyIdeal?.addEventListener('click', () => {
    state.mode = 'builder';
    state.slots = [...IDEAL_PLAN_IDS];
    state.activeStageIndex = 3;
    syncStageRadios();
    runWithTransition(renderSimulation);
  });

  btnResetPlan?.addEventListener('click', () => {
    state.slots = [null, null, null, null];
    state.activeStageIndex = 0;
    syncStageRadios();
    runWithTransition(renderSimulation);
  });

  peekInsightBtn?.addEventListener('click', () => {
    const id = peekInsightBtn.getAttribute('data-linked-insight') || INSIGHTS[0].id;
    openInsightModal(id);
  });

  btnCopyLinkedin?.addEventListener('click', async () => {
    const text = lastResult.linkedinSummary;
    try {
      await navigator.clipboard.writeText(text);
      if (copyFeedback) copyFeedback.textContent = 'تم نسخ التشخيص التنفيذي بنجاح لمشاركته على LinkedIn.';
    } catch {
      // Clipboard fallback without prompt/alert
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      if (copyFeedback) copyFeedback.textContent = 'تم نسخ التشخيص التنفيذي للحافظة بنجاح.';
    }
    window.setTimeout(() => {
      if (copyFeedback) copyFeedback.textContent = '';
    }, 3200);
  });

  // Initialize UI
  buildSectorsStrip();
  buildGaugesShell();
  buildBlocksPalette();
  buildEvidenceDrawer();
  buildInsightsGallery();
  if (peekInsightImg) {
    attachImageFallback(peekInsightImg, 'شاهد ميداني');
  }
  renderSimulation();
});
