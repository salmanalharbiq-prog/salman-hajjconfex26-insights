import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSimulation, lerp } from './engine.js';
import { IDEAL_PLAN_IDS, SECTORS } from './data.js';

test('lerp interpolates smoothly', () => {
  assert.equal(lerp(0, 100, 0.05), 5);
  assert.equal(lerp(10, 20, 0.5), 15);
});

test('quick compare shell path triggers critical AI-on-sand state at 35/100', () => {
  const res = evaluateSimulation({
    mode: 'quick',
    quickPath: 'shell',
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

test('quick compare foundation path achieves governed 100/100 with 6/6 healthy links', () => {
  const res = evaluateSimulation({
    mode: 'quick',
    quickPath: 'foundation',
    slots: [null, null, null, null],
    orgSize: 'enterprise',
    sectorId: 'catering',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.readinessScore, 100);
  assert.equal(res.chainLinks.filter((l) => l.state === 'healthy').length, 6);
  assert.equal(res.chainLinks.filter((l) => l.state === 'bottleneck').length, 0);
});

test('ideal 4-stage plan achieves 100/100, 6/6 green links, and positive expansion card', () => {
  const res = evaluateSimulation({
    mode: 'builder',
    quickPath: 'neutral',
    slots: IDEAL_PLAN_IDS,
    orgSize: 'enterprise',
    sectorId: 'operator',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.readinessScore, 100);
  assert.equal(res.isSoundPlan, true);
  assert.equal(res.chainLinks.filter((l) => l.state === 'healthy').length, 6);
  assert.equal(res.chainLinks.filter((l) => l.state === 'bottleneck').length, 0);
  assert.equal(res.expansionRecommendations.length, 2); // lineage & finops left
});

test('mandatory fairness rule: 4 foundation blocks produce 6/6 green links and 0 red bottlenecks', () => {
  const res = evaluateSimulation({
    mode: 'builder',
    quickPath: 'neutral',
    slots: ['docs', 'ssot', 'ndmo', 'lineage'],
    orgSize: 'sme',
    sectorId: 'logistics',
  });
  assert.equal(res.simState, 'governed');
  assert.equal(res.isSoundPlan, true);
  assert.equal(res.chainLinks.filter((l) => l.state === 'healthy').length, 6);
  assert.equal(res.chainLinks.filter((l) => l.state === 'bottleneck').length, 0);
  assert.equal(res.expansionRecommendations.length, 1); // finops
});

test('placing AI in stage 1 or 2 triggers AI-on-sand warning and bottleneck', () => {
  const res1 = evaluateSimulation({
    mode: 'builder',
    quickPath: 'neutral',
    slots: ['predictive', 'docs', null, null],
    orgSize: 'enterprise',
    sectorId: 'crowds',
  });
  assert.equal(res1.simState, 'critical');
  assert.equal(res1.hasOrderViolation, true);
  assert.match(res1.warningTitle, /ذكاء فوق الرمال/);
  assert.ok(res1.chainLinks.some((l) => l.state === 'bottleneck'));

  const res2 = evaluateSimulation({
    mode: 'builder',
    quickPath: 'neutral',
    slots: ['docs', 'genai', 'ssot', 'ndmo'],
    orgSize: 'sme',
    sectorId: 'hospitality',
  });
  assert.equal(res2.simState, 'critical');
  assert.equal(res2.hasOrderViolation, true);
});

test('enterprise vs sme divergence in Chapter 3 consequence on critical state', () => {
  const ent = evaluateSimulation({
    mode: 'quick',
    quickPath: 'shell',
    slots: [null, null, null, null],
    orgSize: 'enterprise',
    sectorId: 'supply',
  });
  const sme = evaluateSimulation({
    mode: 'quick',
    quickPath: 'shell',
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
      mode: 'quick',
      quickPath: 'foundation',
      slots: [null, null, null, null],
      orgSize: 'enterprise',
      sectorId: sector.id,
    });
    assert.equal(res.chainLinks.length, 6);
    assert.ok(res.sector.insightId.startsWith('insight-'));
  }
});
