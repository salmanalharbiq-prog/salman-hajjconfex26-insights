// @ts-check
import {
  BUILDING_BLOCKS,
  CASE_STUDIES,
  CONTACT_INFO,
  IDEAL_PLAN_IDS,
  INSIGHTS,
  KPI_META,
  METHODOLOGY_PILLARS,
  METHODOLOGY_WEIGHTS,
  ORG_PROFILES,
  SECTORS,
  SHELL_PLAN_IDS,
  STAGES,
  UI_COPY,
} from './data.js';
import { evaluateSimulation } from './engine.js';
import { initAmbientEngine } from './ambient.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const urlParams = new URLSearchParams(window.location.search);
const initialLang = urlParams.get('lang') === 'en' ? 'en' : 'ar';

/**
 * @type {{
 *   lang: 'ar' | 'en';
 *   orgSize: 'enterprise' | 'sme';
 *   sectorId: string;
 *   scenario: 'ideal' | 'shell' | 'custom';
 *   activeStageIndex: number;
 *   slots: (string | null)[];
 *   impactTab: 'chain' | 'timeline';
 *   caseFilter: 'all' | 'success' | 'failure';
 * }}
 */
const state = {
  lang: initialLang,
  orgSize: 'enterprise',
  sectorId: SECTORS[0].id,
  scenario: 'custom',
  activeStageIndex: 0,
  slots: [null, null, null, null],
  impactTab: 'chain',
  caseFilter: 'all',
};

/** @type {WeakMap<HTMLElement, number>} */
const activeAnimFrames = new WeakMap();

/**
 * Ease-out cubic counter ticker (260ms).
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
    const elapsed = Math.max(0, now - startTime);
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
 * @param {() => void} updateFn
 */
function runWithTransition(updateFn) {
  if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
    try {
      document.startViewTransition(updateFn);
      return;
    } catch {
      // Fallback
    }
  }
  updateFn();
}

/**
 * @param {HTMLImageElement} imgEl
 * @param {string} title
 */
function attachImageFallback(imgEl, title) {
  imgEl.addEventListener(
    'error',
    () => {
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
    },
    { once: true }
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const ambient = initAmbientEngine();

  const langToggleBtn = document.getElementById('lang-toggle');
  const brandWordmark = document.getElementById('brand-wordmark');
  const topNav = document.getElementById('top-nav');
  const heroIdentity = document.getElementById('hero-identity');
  const footerName = document.getElementById('footer-name');
  const footerRole = document.getElementById('footer-role');

  const decisionCodeSteps = document.getElementById('decision-code-steps');
  const btnApplyDecisionCode = document.getElementById('btn-apply-decision-code');

  const orgButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (
    document.querySelectorAll('.org-toggle-group .seg-btn')
  );
  const orgSolvencyBadge = document.getElementById('org-solvency-badge');
  const orgCapacityLine = document.getElementById('org-capacity-line');

  const sectorsStrip = document.getElementById('sectors-strip');
  const sectorCatLabel = document.getElementById('sector-category-label');
  const sectorSummaryLine = document.getElementById('sector-summary-line');

  const simStateBadge = document.getElementById('sim-state-badge');
  const readinessScoreEl = document.getElementById('readiness-score');

  const scenarioBtns = /** @type {NodeListOf<HTMLButtonElement>} */ (
    document.querySelectorAll('.scenario-btn')
  );
  const stageRadios = /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll('input[name="active-stage"]')
  );
  const slotsGrid = document.getElementById('slots-grid');
  const blocksPalette = document.getElementById('blocks-palette');
  const btnResetPlan = document.getElementById('btn-reset-plan');

  const reactionTitle = document.getElementById('reaction-title');
  const reactionDesc = document.getElementById('reaction-desc');

  const gaugesGrid = document.getElementById('gauges-grid');

  const impactTabChain = document.getElementById('impact-tab-chain');
  const impactTabTimeline = document.getElementById('impact-tab-timeline');
  const impactPanelChain = document.getElementById('impact-panel-chain');
  const impactPanelTimeline = document.getElementById('impact-panel-timeline');

  const chainPipeline = document.getElementById('chain-pipeline');
  const chainHealthSummary = document.getElementById('chain-health-summary');
  const expansionCard = document.getElementById('expansion-card');
  const expansionList = document.getElementById('expansion-list');

  const timelineOrgContext = document.getElementById('timeline-org-context');
  const timelineChapters = document.getElementById('timeline-chapters');

  const linkedInsightBtn = document.getElementById('linked-insight-btn');
  const linkedInsightImg = /** @type {HTMLImageElement | null} */ (
    document.getElementById('linked-insight-img')
  );
  const linkedInsightTitle = document.getElementById('linked-insight-title');
  const btnCopyLinkedin = document.getElementById('btn-copy-linkedin');
  const copyFeedback = document.getElementById('copy-feedback');

  const insightDialog = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('insight-dialog')
  );
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalImg = /** @type {HTMLImageElement | null} */ (document.getElementById('modal-img'));
  const modalCat = document.getElementById('modal-cat');
  const modalTitle = document.getElementById('modal-title');
  const modalCaption = document.getElementById('modal-caption');

  let lastResult = evaluateSimulation(state);
  let hasRenderedOnce = false;

  /**
   * Brief shimmer sweep when simulation values update.
   * @param {Element | null} el
   */
  function triggerShimmer(el) {
    if (!el || prefersReducedMotion) return;
    el.classList.remove('is-shimmering');
    if (el instanceof HTMLElement) {
      void el.offsetWidth;
    }
    el.classList.add('is-shimmering');
    el.addEventListener(
      'animationend',
      () => {
        el.classList.remove('is-shimmering');
      },
      { once: true }
    );
  }

  function renderDecisionCodeCard() {
    if (!decisionCodeSteps) return;
    const copy = UI_COPY[state.lang];
    decisionCodeSteps.innerHTML = copy.decisionCodeSteps
      .map(
        (step) => `
      <li class="decision-step-item">
        <div class="decision-step-main">
          <span class="decision-step-title">${step.title}</span>
          <span class="decision-step-desc">${step.desc}</span>
        </div>
        <span class="decision-step-code" dir="ltr">${step.code}</span>
      </li>
    `
      )
      .join('');
  }

  function renderSectorsStrip() {
    if (!sectorsStrip) return;
    const isEn = state.lang === 'en';
    sectorsStrip.innerHTML = SECTORS.map(
      (s) => `
      <button
        type="button"
        role="tab"
        class="sector-btn ${s.id === state.sectorId ? 'is-active' : ''}"
        data-sector-id="${s.id}"
        aria-selected="${s.id === state.sectorId ? 'true' : 'false'}"
      >
        ${isEn ? s.shortNameEn : s.shortName}
      </button>
    `
    ).join('');
  }

  function renderGaugesShell() {
    if (!gaugesGrid) return;
    const isEn = state.lang === 'en';
    gaugesGrid.innerHTML = KPI_META.map(
      (kpi) => `
      <article class="kpi-gauge-card" data-kpi-id="${kpi.id}">
        <div class="gauge-svg-wrap">
          <svg class="arc-svg" viewBox="0 0 120 75" aria-hidden="true">
            <path class="arc-track" pathLength="100" d="M 17.50 66.39 A 44 44 0 1 1 102.50 66.39" />
            <path
              class="arc-fill"
              id="arc-fill-${kpi.id}"
              pathLength="100"
              d="M 17.50 66.39 A 44 44 0 1 1 102.50 66.39"
              style="--val: 50; --gauge-color: var(--accent-emerald);"
            />
          </svg>
          <div class="gauge-val-overlay" dir="ltr">
            <span class="kpi-number" id="kpi-val-${kpi.id}">0</span>
            <span class="gauge-pct">%</span>
          </div>
        </div>

        <div class="pill-meter" id="pill-meter-${kpi.id}" aria-hidden="true">
          ${Array.from({ length: 10 }, () => '<span class="pill-seg"></span>').join('')}
        </div>

        <h4 class="gauge-title">${isEn ? kpi.titleEn : kpi.title}</h4>
        <span class="gauge-status-label" id="kpi-status-${kpi.id}" data-tone="healthy"></span>
      </article>
    `
    ).join('');
  }

  function renderBlocksPalette() {
    if (!blocksPalette) return;
    const isEn = state.lang === 'en';
    blocksPalette.innerHTML = BUILDING_BLOCKS.map(
      (b) => `
      <button
        type="button"
        class="block-btn"
        data-block-id="${b.id}"
        data-type="${b.type}"
      >
        <span class="block-name">${isEn ? b.titleEn : b.title}</span>
        <span class="block-kind">${isEn ? b.badgeEn : b.badge}</span>
      </button>
    `
    ).join('');
  }

  function renderMethodologySection() {
    const isEn = state.lang === 'en';
    const weightBar = document.getElementById('weight-bar');
    const weightsLegend = document.getElementById('weights-legend');
    const pillarsGrid = document.getElementById('pillars-grid');

    if (weightBar && weightsLegend) {
      weightBar.setAttribute(
        'aria-label',
        METHODOLOGY_WEIGHTS.map((w) => `${w.pct}% ${isEn ? w.labelEn : w.label}`).join(', ')
      );
      weightBar.innerHTML = METHODOLOGY_WEIGHTS.map((w) => {
        const label = isEn ? w.labelEn : w.label;
        return `<div class="weight-segment" style="width: ${w.pct}%; background: ${w.color};" title="${label}: ${w.pct}%"></div>`;
      }).join('');
      weightsLegend.innerHTML = METHODOLOGY_WEIGHTS.map(
        (w) => `
        <li>
          <span class="weight-swatch" style="background: ${w.color};"></span>
          <span><strong class="kpi-number">${w.pct}%</strong> — ${isEn ? w.labelEn : w.label}</span>
        </li>
      `
      ).join('');
    }

    if (pillarsGrid) {
      pillarsGrid.innerHTML = METHODOLOGY_PILLARS.map((p) => {
        const title = isEn ? p.titleEn : p.title;
        const metric = isEn ? p.metricEn : p.metric;
        const summary = isEn ? p.summaryEn : p.summary;

        if (p.links) {
          return `
            <article class="bento-card pillar-card">
              <div class="pillar-top">
                <h3 class="pillar-title">${title}</h3>
                <span class="pillar-metric">${metric}</span>
              </div>
              <p class="pillar-summary">${summary}</p>
              <div class="sdaia-links-list">
                ${p.links
                  .map(
                    (l) => `
                  <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="sdaia-link-item">
                    <span>${isEn ? l.labelEn : l.label}</span>
                    <span class="ext-arrow" aria-hidden="true">↗</span>
                  </a>
                `
                  )
                  .join('')}
              </div>
            </article>
          `;
        }
        return `
          <article class="bento-card pillar-card">
            <div class="pillar-top">
              <h3 class="pillar-title">${title}</h3>
              <span class="pillar-metric">${metric}</span>
            </div>
            <p class="pillar-summary">${summary}</p>
            <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="pillar-link">
              ${isEn ? p.linkLabelEn : p.linkLabel}
            </a>
          </article>
        `;
      }).join('');
    }

    renderCases();
  }

  function renderCases() {
    const casesGrid = document.getElementById('cases-grid');
    if (!casesGrid) return;
    const isEn = state.lang === 'en';
    const copy = UI_COPY[state.lang];
    const filtered =
      state.caseFilter === 'all'
        ? CASE_STUDIES
        : CASE_STUDIES.filter((c) => c.category === state.caseFilter);

    casesGrid.innerHTML = filtered
      .map(
        (c) => `
      <article class="bento-card case-card" data-category="${c.category}">
        <div>
          <h4 class="case-title">${c.title}</h4>
          <span class="delta-val">${isEn ? c.deltaEn : c.delta}</span>
        </div>
        <p class="case-summary">${isEn ? c.summaryEn : c.summary}</p>
        <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="case-ext-link">
          ${copy.caseSourceLink}
        </a>
      </article>
    `
      )
      .join('');
  }

  function renderInsightsGallery() {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;
    const isEn = state.lang === 'en';
    const copy = UI_COPY[state.lang];

    grid.innerHTML = INSIGHTS.map((item) => {
      const title = isEn ? item.titleEn : item.title;
      const category = isEn ? item.categoryEn : item.category;
      const caption = isEn ? item.captionEn : item.caption;
      return `
      <article class="insight-card" id="${item.id}">
        <button
          type="button"
          class="insight-media-btn"
          data-insight-id="${item.id}"
          aria-label="${copy.insightZoomAriaPrefix} ${title}"
        >
          <img
            src="${item.thumb}"
            alt="${title}"
            style="object-position: ${item.objectPosition || 'center'};"
            loading="eager"
          />
          <span class="insight-zoom-hint">${copy.insightZoomHint}</span>
        </button>
        <div class="insight-body">
          <span class="insight-cat">${category}</span>
          <h3 class="insight-title">${title}</h3>
          <p class="insight-caption">${caption}</p>
        </div>
      </article>
    `;
    }).join('');

    grid.querySelectorAll('img').forEach((img, idx) => {
      const item = INSIGHTS[idx];
      const title = item ? (isEn ? item.titleEn : item.title) : 'Insight photo';
      attachImageFallback(img, title);
    });
  }

  /**
   * @param {string} insightId
   */
  function openInsightModal(insightId) {
    const item = INSIGHTS.find((i) => i.id === insightId);
    if (!item || !insightDialog || !modalImg) return;
    const isEn = state.lang === 'en';
    const title = isEn ? item.titleEn : item.title;
    const category = isEn ? item.categoryEn : item.category;
    const caption = isEn ? item.captionEn : item.caption;

    modalImg.style.display = 'block';
    const prevFallback = modalImg.parentElement?.querySelector('.insight-fallback');
    if (prevFallback) prevFallback.remove();

    modalImg.src = item.full;
    modalImg.alt = title;
    attachImageFallback(modalImg, title);
    if (modalCat) modalCat.textContent = category;
    if (modalTitle) modalTitle.textContent = title;
    if (modalCaption) modalCaption.textContent = caption;

    insightDialog.showModal();
  }

  function syncStageRadios() {
    stageRadios.forEach((r) => {
      r.checked = Number(r.value) === state.activeStageIndex;
    });
  }

  /**
   * @param {(string | null)[]} effectiveSlots
   */
  function renderSlots(effectiveSlots) {
    if (!slotsGrid) return;
    const isEn = state.lang === 'en';
    const copy = UI_COPY[state.lang];

    slotsGrid.innerHTML = STAGES.map((stage, idx) => {
      const blockId = effectiveSlots[idx];
      const block = BUILDING_BLOCKS.find((b) => b.id === blockId) || null;
      const isTarget = idx === state.activeStageIndex;
      const stageLabel = isEn ? stage.labelEn : stage.label;
      const stageFullLabel = isEn ? stage.fullLabelEn : stage.fullLabel;
      const blockShort = block ? (isEn ? block.shortTitleEn : block.shortTitle) : copy.emptySlot;

      let statusClass = '';
      if (block) {
        if (block.type === 'foundation') {
          statusClass = 'is-foundation';
        } else {
          const foundationsBefore = effectiveSlots
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
            aria-label="${copy.selectSlotPrefix} ${stageFullLabel}"
          >
            <span class="slot-stage-num">${stageLabel}</span>
            <span class="slot-block-name">${blockShort}</span>
          </button>
          ${
            block
              ? `<button type="button" class="slot-clear-btn" data-slot-clear="${idx}" aria-label="${copy.removeSlotPrefix} ${blockShort}">✕</button>`
              : ''
          }
        </div>
      `;
    }).join('');
  }

  function renderSimulation() {
    const isEn = state.lang === 'en';
    const copy = UI_COPY[state.lang];
    const res = evaluateSimulation(state);
    lastResult = res;

    ambient.setState(res.simState);

    const org = ORG_PROFILES[state.orgSize];
    orgButtons.forEach((btn) => {
      const active = btn.getAttribute('data-org') === state.orgSize;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (orgSolvencyBadge) {
      orgSolvencyBadge.textContent = isEn ? org.solvencyBadgeEn : org.solvencyBadge;
    }
    if (orgCapacityLine) {
      orgCapacityLine.textContent = isEn ? org.capacityLineEn : org.capacityLine;
    }

    if (sectorsStrip) {
      sectorsStrip.querySelectorAll('.sector-btn').forEach((btn) => {
        const active = btn.getAttribute('data-sector-id') === state.sectorId;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    if (sectorCatLabel) {
      sectorCatLabel.textContent = isEn ? res.sector.categoryEn : res.sector.category;
    }
    if (sectorSummaryLine) {
      const goal = isEn ? res.sector.goalEn : res.sector.goal;
      const metric = isEn ? res.sector.fieldMetricEn : res.sector.fieldMetric;
      sectorSummaryLine.textContent = `${copy.sectorGoalPrefix} ${goal} (${metric}).`;
    }

    if (simStateBadge) {
      simStateBadge.textContent = res.stateMeta.badge;
      simStateBadge.setAttribute('data-state', res.simState);
    }

    scenarioBtns.forEach((btn) => {
      const active = btn.getAttribute('data-scenario') === state.scenario;
      btn.classList.toggle('is-active', active);
    });

    renderSlots(res.effectiveSlots);
    if (blocksPalette) {
      blocksPalette.querySelectorAll('.block-btn').forEach((btn) => {
        const id = btn.getAttribute('data-block-id');
        btn.classList.toggle('is-used', Boolean(id && res.effectiveSlots.includes(id)));
      });
    }

    if (reactionTitle) reactionTitle.textContent = res.warningTitle;
    if (reactionDesc) reactionDesc.textContent = res.fieldReaction;

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

    // Impact Tab Visibility
    const isChainTab = state.impactTab === 'chain';
    impactTabChain?.classList.toggle('is-active', isChainTab);
    impactTabChain?.setAttribute('aria-selected', isChainTab ? 'true' : 'false');
    impactTabTimeline?.classList.toggle('is-active', !isChainTab);
    impactTabTimeline?.setAttribute('aria-selected', !isChainTab ? 'true' : 'false');
    if (impactPanelChain) impactPanelChain.hidden = !isChainTab;
    if (impactPanelTimeline) impactPanelTimeline.hidden = isChainTab;

    // 6-Link Causal Pipeline (3x2 grid)
    if (chainPipeline) {
      chainPipeline.innerHTML = res.chainLinks
        .map((link) => {
          let cls = '';
          let word = copy.chainNeutralWord;
          if (link.state === 'healthy') {
            cls = 'is-healthy';
            word = copy.chainHealthyWord;
          } else if (link.state === 'bottleneck') {
            cls = 'bottleneck';
            word = copy.chainBottleneckWord;
          } else if (link.state === 'degraded') {
            cls = 'degraded';
            word = copy.chainDegradedWord;
          }
          return `
            <article class="chain-node ${cls}">
              <div class="chain-node-top">
                <span class="node-metric">${link.num}</span>
                <span class="chain-state-word">${word}</span>
              </div>
              <h4 class="chain-node-title">${link.displayLabel}</h4>
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
        chainHealthSummary.textContent = copy.chainSummaryAllHealthy;
        chainHealthSummary.style.color = '#34d399';
      } else if (bottleneckCount > 0) {
        chainHealthSummary.textContent = copy.chainSummaryBottleneck;
        chainHealthSummary.style.color = '#fca5a5';
      } else {
        chainHealthSummary.textContent = copy.chainSummaryProgress.replace('{n}', String(healthyCount));
        chainHealthSummary.style.color = 'var(--accent-gold)';
      }
    }

    if (expansionCard && expansionList) {
      if (res.expansionRecommendations.length > 0) {
        expansionCard.hidden = false;
        expansionList.textContent = res.expansionRecommendations
          .map((b) => `+ ${isEn ? b.shortTitleEn : b.shortTitle}`)
          .join(' · ');
      } else {
        expansionCard.hidden = true;
        expansionList.textContent = '';
      }
    }

    // 3-Chapter Timeline
    if (timelineOrgContext) {
      const orgShort = isEn ? org.shortLabelEn : org.shortLabel;
      const sectorShort = isEn ? res.sector.shortNameEn : res.sector.shortName;
      timelineOrgContext.textContent = `${copy.timelineContextPrefix} ${orgShort} · ${sectorShort}`;
    }
    if (timelineChapters) {
      timelineChapters.innerHTML = res.timeline
        .map(
          (ch) => `
        <article class="chapter-card" data-tone="${ch.tone}">
          <span class="chapter-kicker">${ch.chapter}</span>
          <h4 class="chapter-title">${ch.title}</h4>
          <p class="chapter-desc">${ch.desc}</p>
        </article>
      `
        )
        .join('');
    }

    const linkedInsight = INSIGHTS.find((i) => i.id === res.sector.insightId) || INSIGHTS[0];
    const insightTitle = linkedInsight ? (isEn ? linkedInsight.titleEn : linkedInsight.title) : '';
    if (linkedInsightImg && linkedInsight) {
      linkedInsightImg.style.display = 'block';
      linkedInsightImg.src = linkedInsight.thumb;
      linkedInsightImg.alt = insightTitle;
    }
    if (linkedInsightTitle && linkedInsight) {
      linkedInsightTitle.textContent = insightTitle;
    }
    if (linkedInsightBtn && linkedInsight) {
      linkedInsightBtn.setAttribute('data-linked-insight', linkedInsight.id);
    }

    animateNumber(readinessScoreEl, res.readinessScore, 260);
    for (const kpi of KPI_META) {
      const valEl = document.getElementById(`kpi-val-${kpi.id}`);
      const metric = res.kpis[/** @type {keyof typeof res.kpis} */ (kpi.id)];
      animateNumber(valEl, metric.value, 260);
    }

    if (hasRenderedOnce) {
      triggerShimmer(document.querySelector('.telemetry-card'));
      document.querySelectorAll('.kpi-gauge-card').forEach((card) => triggerShimmer(card));
    }
    hasRenderedOnce = true;
  }

  function applyLanguage() {
    const isEn = state.lang === 'en';
    const copy = UI_COPY[state.lang];

    document.documentElement.lang = state.lang;
    document.documentElement.dir = isEn ? 'ltr' : 'rtl';
    document.title = copy.pageTitle;

    if (brandWordmark) brandWordmark.textContent = CONTACT_INFO.name[state.lang];
    if (heroIdentity) heroIdentity.textContent = CONTACT_INFO.roleHero[state.lang];
    if (footerName) footerName.textContent = CONTACT_INFO.name[state.lang];
    if (footerRole) footerRole.textContent = CONTACT_INFO.role[state.lang];
    if (topNav) topNav.setAttribute('aria-label', copy.navAria);

    const codeRuleEl = document.getElementById('decision-code-rule');
    if (codeRuleEl) codeRuleEl.dir = isEn ? 'ltr' : 'rtl';

    if (langToggleBtn) {
      langToggleBtn.textContent = copy.langToggle;
      langToggleBtn.setAttribute('aria-label', copy.langToggleAria);
    }

    if (modalCloseBtn) {
      modalCloseBtn.textContent = copy.modalClose;
      modalCloseBtn.setAttribute('aria-label', copy.modalCloseAria);
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = /** @type {keyof typeof copy} */ (el.getAttribute('data-i18n'));
      const val = copy[key];
      if (typeof val === 'string') {
        el.textContent = val;
      }
    });

    document.querySelectorAll('[data-stage-label]').forEach((el) => {
      const idx = Number(el.getAttribute('data-stage-label'));
      const stage = STAGES[idx];
      if (stage) el.textContent = isEn ? stage.labelEn : stage.label;
    });

    const execGuideList = document.getElementById('exec-guide-list');
    if (execGuideList) {
      execGuideList.innerHTML = copy.execGuideItems.map((item) => `<li>${item}</li>`).join('');
    }

    renderDecisionCodeCard();
    renderSectorsStrip();
    renderGaugesShell();
    renderBlocksPalette();
    renderMethodologySection();
    renderInsightsGallery();
    renderSimulation();
  }

  // Delegated & Single-Bind Event Listeners
  langToggleBtn?.addEventListener('click', () => {
    state.lang = state.lang === 'ar' ? 'en' : 'ar';
    runWithTransition(applyLanguage);
  });

  btnApplyDecisionCode?.addEventListener('click', () => {
    state.scenario = 'ideal';
    state.slots = [...IDEAL_PLAN_IDS];
    state.activeStageIndex = 3;
    syncStageRadios();
    runWithTransition(renderSimulation);
    document.getElementById('simulator')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  });

  sectorsStrip?.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('[data-sector-id]');
    if (!btn) return;
    const nextId = btn.getAttribute('data-sector-id');
    if (!nextId || nextId === state.sectorId) return;
    state.sectorId = nextId;
    runWithTransition(renderSimulation);
  });

  blocksPalette?.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('[data-block-id]');
    if (!btn) return;
    const blockId = btn.getAttribute('data-block-id');
    if (!blockId) return;

    if (state.scenario === 'ideal') {
      state.slots = [...IDEAL_PLAN_IDS];
    } else if (state.scenario === 'shell') {
      state.slots = [...SHELL_PLAN_IDS];
    }
    state.scenario = 'custom';

    const existingIdx = state.slots.indexOf(blockId);
    if (existingIdx !== -1 && existingIdx !== state.activeStageIndex) {
      const displaced = state.slots[state.activeStageIndex];
      state.slots[existingIdx] = displaced;
    }
    state.slots[state.activeStageIndex] = blockId;

    const nextEmpty = state.slots.findIndex((s, i) => s === null && i > state.activeStageIndex);
    if (nextEmpty !== -1) {
      state.activeStageIndex = nextEmpty;
    } else {
      const firstEmpty = state.slots.findIndex((s) => s === null);
      if (firstEmpty !== -1) state.activeStageIndex = firstEmpty;
    }
    syncStageRadios();
    runWithTransition(renderSimulation);
  });

  document.querySelectorAll('.case-filters .filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filterVal = /** @type {'all' | 'success' | 'failure'} */ (
        btn.getAttribute('data-filter') || 'all'
      );
      state.caseFilter = filterVal;
      document.querySelectorAll('.case-filters .filter-btn').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-filter') === filterVal);
      });
      runWithTransition(renderCases);
    });
  });

  document.getElementById('insights-grid')?.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('[data-insight-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-insight-id');
    if (id) openInsightModal(id);
  });

  if (modalCloseBtn && insightDialog) {
    const closeModal = () => {
      insightDialog.close();
      modalImg?.removeAttribute('src');
    };
    modalCloseBtn.addEventListener('click', closeModal);
    insightDialog.addEventListener('click', (e) => {
      if (e.target === insightDialog) closeModal();
    });
  }

  orgButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const org = /** @type {'enterprise' | 'sme'} */ (btn.getAttribute('data-org'));
      if (!org || org === state.orgSize) return;
      state.orgSize = org;
      runWithTransition(renderSimulation);
    });
  });

  scenarioBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sc = /** @type {'ideal' | 'shell' | 'custom'} */ (btn.getAttribute('data-scenario'));
      if (!sc) return;
      state.scenario = sc;
      if (sc === 'ideal') {
        state.slots = [...IDEAL_PLAN_IDS];
        state.activeStageIndex = 3;
      } else if (sc === 'shell') {
        state.slots = [...SHELL_PLAN_IDS];
        state.activeStageIndex = 0;
      }
      syncStageRadios();
      runWithTransition(renderSimulation);
    });
  });

  stageRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.activeStageIndex = Number(radio.value) || 0;
      const res = evaluateSimulation(state);
      runWithTransition(() => renderSlots(res.effectiveSlots));
    });
  });

  slotsGrid?.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const clearBtn = target?.closest('[data-slot-clear]');
    if (clearBtn) {
      const idx = Number(clearBtn.getAttribute('data-slot-clear'));
      if (!Number.isNaN(idx)) {
        if (state.scenario === 'ideal') state.slots = [...IDEAL_PLAN_IDS];
        if (state.scenario === 'shell') state.slots = [...SHELL_PLAN_IDS];
        state.scenario = 'custom';
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
        const res = evaluateSimulation(state);
        runWithTransition(() => renderSlots(res.effectiveSlots));
      }
    }
  });

  btnResetPlan?.addEventListener('click', () => {
    state.scenario = 'custom';
    state.slots = [null, null, null, null];
    state.activeStageIndex = 0;
    syncStageRadios();
    runWithTransition(renderSimulation);
  });

  impactTabChain?.addEventListener('click', () => {
    if (state.impactTab === 'chain') return;
    state.impactTab = 'chain';
    runWithTransition(renderSimulation);
  });

  impactTabTimeline?.addEventListener('click', () => {
    if (state.impactTab === 'timeline') return;
    state.impactTab = 'timeline';
    runWithTransition(renderSimulation);
  });

  linkedInsightBtn?.addEventListener('click', () => {
    const id = linkedInsightBtn.getAttribute('data-linked-insight') || INSIGHTS[0].id;
    openInsightModal(id);
  });

  btnCopyLinkedin?.addEventListener('click', async () => {
    const text = lastResult.linkedinSummary;
    const msg = UI_COPY[state.lang].copySuccess;
    try {
      await navigator.clipboard.writeText(text);
      if (copyFeedback) copyFeedback.textContent = msg;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      if (copyFeedback) copyFeedback.textContent = msg;
    }
    window.setTimeout(() => {
      if (copyFeedback) copyFeedback.textContent = '';
    }, 3200);
  });

  if (linkedInsightImg) {
    attachImageFallback(linkedInsightImg, 'Field Insight');
  }
  applyLanguage();
});
