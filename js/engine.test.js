import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSimulation, lerp } from './engine.js';
import { IDEAL_PLAN_IDS, SECTORS, STATE_PRESETS } from './data.js';

test('lerp interpolates smoothly', () => {
  assert.equal(lerp(0, 100, 0.05), 5);
  assert.equal(lerp(10, 20, 0.5), 15);
});

test('shell scenario triggers critical AI-on-sand state at 35/100', () => {
  const res = evaluateSimulation({
    scenario: 'shell',
    slots: [null, null, null, null],
    orgSize: 'sme',
    sectorId: 'shuttle',
  });
  assert.equal(res.simState, 'critical');
  assert.equal(res.readinessScore, 35);
  assert.equal(res.hasOrderViolation, true);
  assert.ok(res.chainLinks.some((l) => l.state === 'bottleneck'));
  assert.match(res.timeline[2].title, /أزمة سيولة/);
});

test('ideal scenario achieves governed 100/100 with 6/6 healthy links and zero bottlenecks', () => {
  const res = evaluateSimulation({
    scenario: 'ideal',
    slots: [null, null, null, null],
    orgSize: 'enterprise',
    sectorId: 'catering',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.readinessScore, 100);
  assert.equal(res.isSoundPlan, true);
  assert.equal(res.chainLinks.filter((l) => l.state === 'healthy').length, 6);
  assert.equal(res.chainLinks.filter((l) => l.state === 'bottleneck').length, 0);
  assert.equal(res.expansionRecommendations.length, 2);
});

test('custom builder with ideal 4-stage plan achieves 100/100 and 6/6 green links', () => {
  const res = evaluateSimulation({
    scenario: 'custom',
    slots: IDEAL_PLAN_IDS,
    orgSize: 'enterprise',
    sectorId: 'operator',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.readinessScore, 100);
  assert.equal(res.chainLinks.filter((l) => l.state === 'healthy').length, 6);
  assert.equal(res.chainLinks.filter((l) => l.state === 'bottleneck').length, 0);
});

test('mandatory fairness rule: 4 foundation blocks produce 6/6 green links and 0 red bottlenecks', () => {
  const res = evaluateSimulation({
    scenario: 'custom',
    slots: ['docs', 'ssot', 'ndmo', 'lineage'],
    orgSize: 'sme',
    sectorId: 'logistics',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.isSoundPlan, true);
  assert.equal(res.chainLinks.filter((l) => l.state === 'healthy').length, 6);
  assert.equal(res.chainLinks.filter((l) => l.state === 'bottleneck').length, 0);
  assert.equal(res.expansionRecommendations.length, 1);
});

test('placing AI in stage 1 or 2 in custom scenario triggers AI-on-sand warning', () => {
  const res1 = evaluateSimulation({
    scenario: 'custom',
    slots: ['predictive', 'docs', null, null],
    orgSize: 'enterprise',
    sectorId: 'crowds',
  });
  assert.equal(res1.simState, 'critical');
  assert.equal(res1.hasOrderViolation, true);
  assert.match(res1.warningTitle, /ذكاء فوق الرمال/);
  assert.ok(res1.chainLinks.some((l) => l.state === 'bottleneck'));

  const res2 = evaluateSimulation({
    scenario: 'custom',
    slots: ['docs', 'genai', 'ssot', 'ndmo'],
    orgSize: 'sme',
    sectorId: 'hospitality',
  });
  assert.equal(res2.simState, 'critical');
  assert.equal(res2.hasOrderViolation, true);
});

test('enterprise vs sme divergence in Chapter 3 consequence on critical state', () => {
  const ent = evaluateSimulation({
    scenario: 'shell',
    slots: [null, null, null, null],
    orgSize: 'enterprise',
    sectorId: 'supply',
  });
  const sme = evaluateSimulation({
    scenario: 'shell',
    slots: [null, null, null, null],
    orgSize: 'sme',
    sectorId: 'supply',
  });
  assert.match(ent.timeline[2].title, /تحول رقمي/);
  assert.match(sme.timeline[2].title, /سيولة/);
});

test('all 7 sectors return valid metadata and 6 chain descriptions', () => {
  assert.equal(SECTORS.length, 7);
  for (const sector of SECTORS) {
    const res = evaluateSimulation({
      scenario: 'ideal',
      slots: [null, null, null, null],
      orgSize: 'enterprise',
      sectorId: sector.id,
    });
    assert.equal(res.chainLinks.length, 6);
    assert.ok(res.sector.insightId.startsWith('insight-'));
    assert.ok(res.sector.fieldMetric.length > 0);
  }
});

test('english language mode returns clean English labels, 6 chain details, and clean author name', () => {
  const res = evaluateSimulation({
    scenario: 'ideal',
    slots: [null, null, null, null],
    orgSize: 'enterprise',
    sectorId: 'shuttle',
    lang: 'en',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.readinessScore, 100);
  assert.match(res.warningTitle, /Governed Plan/);
  assert.match(res.kpis.financial.label, /Healthy/);
  assert.match(res.chainLinks[0].displayLabel, /Institutional Knowledge/);
  assert.match(res.timeline[2].title, /Institutional Leadership/);
  assert.match(res.linkedinSummary, /Salman Alharbi/);
  assert.doesNotMatch(res.linkedinSummary, /عبد الرحمن/);

  const crit = evaluateSimulation({
    scenario: 'shell',
    slots: [null, null, null, null],
    orgSize: 'sme',
    sectorId: 'logistics',
    lang: 'en',
  });
  assert.match(crit.warningTitle, /AI on Sand/);
  assert.match(crit.timeline[2].title, /Liquidity Crisis/);
});

test('STATE_PRESETS defines valid aurora and canvas parameters for all 4 states', () => {
  for (const key of /** @type {const} */ (['neutral', 'governed', 'warning', 'critical'])) {
    const preset = STATE_PRESETS[key];
    assert.ok(preset);
    assert.equal(typeof preset.speed, 'number');
    assert.equal(typeof preset.maxDist, 'number');
    assert.ok(preset.r >= 0 && preset.g >= 0 && preset.b >= 0);
    assert.ok(preset.aurora1.length > 0 && preset.aurora2.length > 0);
  }
});
