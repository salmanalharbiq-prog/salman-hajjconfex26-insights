// @ts-check
import {
  BUILDING_BLOCKS,
  CHAIN_LINK_TITLES,
  IDEAL_PLAN_IDS,
  ORG_PROFILES,
  SECTORS,
  SHELL_PLAN_IDS,
  STATE_PRESETS,
} from './data.js';

/**
 * Linear interpolation helper used by ambient canvas physics.
 * @param {number} start
 * @param {number} end
 * @param {number} amt
 * @returns {number}
 */
export function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

/**
 * Classify a KPI value (0-100) into an accessible status descriptor.
 * @param {number} value
 * @param {'ar' | 'en'} [lang='ar']
 */
export function getKpiStatus(value, lang = 'ar') {
  const isEn = lang === 'en';
  if (value >= 75) {
    return {
      label: isEn ? 'Healthy & Secure' : 'ممتلئ وآمن',
      tone: 'healthy',
      color: 'var(--accent-emerald)',
    };
  }
  if (value >= 50) {
    return {
      label: isEn ? 'Moderate — Needs Core' : 'متوسط يحتاج تدعيم',
      tone: 'warning',
      color: 'var(--accent-orange)',
    };
  }
  return {
    label: isEn ? 'Critical Risk Zone' : 'منخفض في دائرة الخطر',
    tone: 'critical',
    color: 'var(--accent-crimson)',
  };
}

/**
 * Clamp value between 0 and 100.
 * @param {number} n
 */
function clamp100(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Evaluate the complete simulation state from unified scenario + 4-stage choices.
 * Pure deterministic function — zero DOM side effects.
 *
 * @param {object} input
 * @param {'ideal' | 'shell' | 'custom'} input.scenario
 * @param {(string | null)[]} input.slots
 * @param {'enterprise' | 'sme'} input.orgSize
 * @param {string} input.sectorId
 * @param {'ar' | 'en'} [input.lang='ar']
 */
export function evaluateSimulation({ scenario, slots, orgSize, sectorId, lang = 'ar' }) {
  const isEn = lang === 'en';
  const sector = SECTORS.find((s) => s.id === sectorId) || SECTORS[0];
  const org = ORG_PROFILES[orgSize] || ORG_PROFILES.enterprise;

  const sectorName = isEn ? sector.nameEn : sector.name;
  const sectorShort = isEn ? sector.shortNameEn : sector.shortName;
  const orgShort = isEn ? org.shortLabelEn : org.shortLabel;

  // Resolve effective 4 slots based on scenario
  const effectiveSlots =
    scenario === 'ideal'
      ? [...IDEAL_PLAN_IDS]
      : scenario === 'shell'
      ? [...SHELL_PLAN_IDS]
      : [0, 1, 2, 3].map((idx) => (slots && slots[idx] ? slots[idx] : null));

  let readinessScore = 60;
  /** @type {'neutral' | 'governed' | 'warning' | 'critical'} */
  let simState = 'neutral';
  let hasOrderViolation = false;
  let kpiValues = { financial: 62, memory: 60, compliance: 62, resilience: 60 };
  let warningTitle = isEn
    ? 'Simulator Ready: Pick a scenario or customize the 4 stages'
    : 'المحاكي جاهز: اختر سيناريو أو خصّص المراحل الأربع';
  let fieldReaction = isEn
    ? `In ${sectorName}, sequence core governance stages before AI to protect staff and liquidity.`
    : `في ${sector.name}، رتّب مراحل الأساس قبل الذكاء الاصطناعي لحماية الموظف والسيولة.`;

  const filledBlocks = effectiveSlots
    .map((id, idx) => ({
      idx,
      block: BUILDING_BLOCKS.find((b) => b.id === id) || null,
    }))
    .filter((entry) => entry.block !== null);

  let isSoundPlan = false;
  let bottleneckIndex = -1;

  if (scenario === 'shell') {
    simState = 'critical';
    readinessScore = 35;
    hasOrderViolation = true;
    bottleneckIndex = 0;
    kpiValues =
      orgSize === 'sme'
        ? { financial: 22, memory: 28, compliance: 34, resilience: 31 }
        : { financial: 44, memory: 30, compliance: 36, resilience: 35 };
    warningTitle = isEn
      ? 'AI on Sand! Deploying AI without data governance'
      : 'ذكاء فوق الرمال! القفز للذكاء الاصطناعي بلا حوكمة';
    fieldReaction =
      orgSize === 'sme'
        ? isEn
          ? `Conflicting AI outputs in ${sectorName} overwhelm staff manually and drain seasonal cashflow immediately.`
          : `تضارب نتائج الذكاء الاصطناعي في ${sector.name} يرهق الموظفين يدوياً ويستنزف السيولة الموسمية فوراً.`
        : isEn
        ? `Conflicting readings in ${sectorName} erode team trust and institutional memory despite enterprise capital.`
        : `تضارب القراءات في ${sector.name} يفقد الفريق الثقة ويستنزف ذاكرة التشغيل رغم ملاءة الشركة.`;
  } else if (filledBlocks.length === 0) {
    simState = 'neutral';
    readinessScore = 58;
    kpiValues = { financial: 60, memory: 56, compliance: 58, resilience: 58 };
    warningTitle = isEn
      ? 'Manual Builder: Start with Core Foundations in Stages 1 & 2'
      : 'تخصيص يدوي: ابدأ بلبنات الأساس في المرحلتين 1 و2';
    fieldReaction = isEn
      ? `Select a building block below to assign it to the active stage for ${sectorShort}.`
      : `اختر لبنة من القائمة لإضافتها إلى المرحلة النشطة في قطاع ${sector.shortName}.`;
  } else {
    let foundationBeforeAi = 0;
    let totalFoundation = 0;
    let totalAi = 0;
    let firstAiIndex = -1;

    for (const entry of filledBlocks) {
      const b = /** @type {NonNullable<typeof entry.block>} */ (entry.block);
      if (b.type === 'foundation') {
        totalFoundation += 1;
        if (firstAiIndex === -1) foundationBeforeAi += 1;
      } else {
        totalAi += 1;
        if (firstAiIndex === -1) firstAiIndex = entry.idx;
      }
    }

    const aiInEarlyStage = filledBlocks.some(
      (e) => e.block && e.block.type === 'ai' && e.idx <= 1
    );
    const aiBeforeTwoFoundations = totalAi > 0 && foundationBeforeAi < 2;

    if (aiInEarlyStage || aiBeforeTwoFoundations) {
      hasOrderViolation = true;
      simState = 'critical';
      bottleneckIndex = firstAiIndex === 0 ? 0 : 1;
      readinessScore = Math.min(44, Math.max(24, 42 - totalAi * 6 + totalFoundation * 5));
      kpiValues = {
        financial: clamp100((orgSize === 'sme' ? 24 : 42) + totalFoundation * 4 - totalAi * 5),
        memory: clamp100(32 + totalFoundation * 4 - totalAi * 4),
        compliance: clamp100(34 + (effectiveSlots.includes('ndmo') ? 14 : 0) - totalAi * 4),
        resilience: clamp100(30 + totalFoundation * 4 - totalAi * 5),
      };
      warningTitle = isEn ? 'Instant Alert: AI Built on Sand!' : 'تحذير فوري: ذكاء فوق الرمال!';
      fieldReaction = isEn
        ? `Placing AI in Stage ${firstAiIndex + 1} before core foundations disrupts ${sectorShort} field teams.`
        : `وضع الذكاء الاصطناعي في المرحلة ${firstAiIndex + 1} قبل الأساس يربك فرق ${sector.shortName} الميدانية.`;
    } else {
      const hasDocs = effectiveSlots.includes('docs');
      const hasSsot = effectiveSlots.includes('ssot');
      const hasNdmo = effectiveSlots.includes('ndmo');
      const hasLineage = effectiveSlots.includes('lineage');
      const hasFinops = effectiveSlots.includes('finops');

      if (filledBlocks.length === 4 && totalFoundation >= 3) {
        isSoundPlan = true;
        simState = 'governed';

        const isExactIdeal = IDEAL_PLAN_IDS.every((id, i) => effectiveSlots[i] === id);
        readinessScore = isExactIdeal
          ? 100
          : clamp100(86 + totalFoundation * 2 + (totalAi === 1 ? 6 : 4));

        if (isExactIdeal) {
          kpiValues = { financial: 96, memory: 98, compliance: 99, resilience: 97 };
          readinessScore = 100;
        } else {
          kpiValues = {
            financial: clamp100(82 + (hasFinops ? 12 : 8) + (hasSsot ? 4 : 0) + (totalAi === 1 ? 2 : 0)),
            memory: clamp100(84 + (hasDocs ? 10 : 6) + (hasLineage ? 4 : 2)),
            compliance: clamp100(84 + (hasNdmo ? 12 : 6) + (hasLineage ? 4 : 2)),
            resilience: clamp100(85 + (hasSsot ? 8 : 4) + (totalAi === 1 ? 5 : 2)),
          };
        }

        warningTitle =
          totalAi === 1
            ? isEn
              ? 'Governed Plan (100/100): Foundation First, Then AI'
              : 'خطة محكومة (100/100): الأساس أولاً ثم الذكاء'
            : isEn
            ? 'Solid & Resilient Data Foundation (4 Core Blocks)'
            : 'تأسيس بيانات صلب ومستقر (4 لبنات أساس)';
        fieldReaction = isEn
          ? `Harmonized execution in ${sectorName}: all 6/6 impact links are green with zero bottlenecks.`
          : `أداء متناغم في ${sector.name}: استقرت جميع الحلقات الست (6/6 خضراء) بلا أي اختناق.`;
      } else {
        const rawScore = 52 + totalFoundation * 9 + totalAi * 4;
        readinessScore = clamp100(Math.min(74, rawScore));
        simState = readinessScore >= 45 ? 'warning' : 'critical';

        kpiValues = {
          financial: clamp100(50 + (hasFinops ? 14 : 0) + totalFoundation * 5),
          memory: clamp100(48 + (hasDocs ? 16 : 0) + totalFoundation * 4),
          compliance: clamp100(46 + (hasNdmo ? 18 : 0) + (hasLineage ? 8 : 0) + totalFoundation * 3),
          resilience: clamp100(48 + (hasSsot ? 14 : 0) + totalFoundation * 4),
        };
        warningTitle = isEn
          ? `Plan in Progress (${filledBlocks.length}/4 stages completed)`
          : `خطة قيد البناء (${filledBlocks.length}/4 مراحل مكتملة)`;
        fieldReaction = isEn
          ? `Complete the remaining stages for ${sectorShort} to clear the 70% operational safety threshold.`
          : `أكمل المراحل المتبقية لقطاع ${sector.shortName} لتجاوز حد الأمان التشغيلي (70%).`;
      }
    }
  }

  // Mandatory Fairness Rule: 6-Link Causal Pipeline
  const chainLinks = CHAIN_LINK_TITLES.map((link, idx) => {
    /** @type {'healthy' | 'neutral' | 'bottleneck' | 'degraded'} */
    let state = 'neutral';
    if (isSoundPlan) {
      state = 'healthy';
    } else if (hasOrderViolation) {
      if (idx <= bottleneckIndex) {
        state = 'bottleneck';
      } else {
        state = 'degraded';
      }
    } else if (simState !== 'neutral') {
      state = idx < filledBlocks.length ? 'healthy' : 'neutral';
    }

    return {
      ...link,
      displayLabel: isEn ? link.labelEn : link.label,
      sectorDetail: isEn ? sector.chainDetailsEn[idx] : sector.chainDetails[idx],
      state,
    };
  });

  const usedIds = new Set(effectiveSlots.filter(Boolean));
  const expansionRecommendations = isSoundPlan
    ? BUILDING_BLOCKS.filter((b) => b.type === 'foundation' && !usedIds.has(b.id))
    : [];

  const timeline = buildTimeline({ simState, isSoundPlan, orgSize, sector, lang });

  const stateBadge = isEn ? STATE_PRESETS[simState].badgeEn : STATE_PRESETS[simState].badge;

  const linkedinSummary = isEn
    ? [
        `Executive Diagnosis — ${sectorName} (${orgShort})`,
        `Plan Status: ${stateBadge} (${readinessScore}/100)`,
        `• Liquidity & ROI: ${kpiValues.financial}%`,
        `• Employee Memory & Trust: ${kpiValues.memory}%`,
        `• Sovereign Compliance (NDMO/PDPL): ${kpiValues.compliance}%`,
        `• Peak Operational Resilience: ${kpiValues.resilience}%`,
        `Summary: ${timeline[2].desc}`,
        `— Executive Data & AI Decision Simulator | Salman Alharbi`,
      ].join('\n')
    : [
        `التشخيص التنفيذي — ${sector.name} (${org.shortLabel})`,
        `حالة الخطة: ${STATE_PRESETS[simState].badge} (${readinessScore}/100)`,
        `• السيولة والعائد: ${kpiValues.financial}%`,
        `• ذاكرة الموظف وثقة الفريق: ${kpiValues.memory}%`,
        `• الامتثال السيادي (NDMO/PDPL): ${kpiValues.compliance}%`,
        `• صمود العمليات وقت الذروة: ${kpiValues.resilience}%`,
        `الخلاصة: ${timeline[2].desc}`,
        `— عبر المحاكي التنفيذي لقرارات البيانات والذكاء الاصطناعي | سلمان الحربي`,
      ].join('\n');

  return {
    simState,
    stateMeta: {
      ...STATE_PRESETS[simState],
      badge: stateBadge,
    },
    effectiveSlots,
    readinessScore,
    isSoundPlan,
    hasOrderViolation,
    warningTitle,
    fieldReaction,
    sector,
    org,
    kpis: {
      financial: { value: kpiValues.financial, ...getKpiStatus(kpiValues.financial, lang) },
      memory: { value: kpiValues.memory, ...getKpiStatus(kpiValues.memory, lang) },
      compliance: { value: kpiValues.compliance, ...getKpiStatus(kpiValues.compliance, lang) },
      resilience: { value: kpiValues.resilience, ...getKpiStatus(kpiValues.resilience, lang) },
    },
    chainLinks,
    expansionRecommendations,
    timeline,
    linkedinSummary,
  };
}

/**
 * @param {object} p
 * @param {'neutral' | 'governed' | 'warning' | 'critical'} p.simState
 * @param {boolean} p.isSoundPlan
 * @param {'enterprise' | 'sme'} p.orgSize
 * @param {typeof SECTORS[number]} p.sector
 * @param {'ar' | 'en'} [p.lang='ar']
 */
function buildTimeline({ simState, isSoundPlan, orgSize, sector, lang = 'ar' }) {
  const isEn = lang === 'en';
  const sectorShort = isEn ? sector.shortNameEn : sector.shortName;

  if (isSoundPlan || simState === 'governed') {
    return [
      {
        chapter: isEn ? 'Chapter 1 · Rollout Start' : 'الفصل 1 · بداية التطبيق',
        title: isEn ? 'Calm, Disciplined Foundation' : 'تأسيس صامت ومنضبط',
        tone: 'healthy',
        desc: isEn
          ? `Document ${sectorShort} workflows and unify data sources without rushing.`
          : `توثيق إجراءات ${sector.shortName} وتوحيد المصادر بعيداً عن الاستعجال.`,
      },
      {
        chapter: isEn ? 'Chapter 2 · Peak Season' : 'الفصل 2 · ذروة الموسم',
        title: isEn ? 'Field Operational Resilience' : 'صمود العمليات الميدانية',
        tone: 'healthy',
        desc: isEn
          ? 'Field teams operate from one unified command board and reliable forecasts.'
          : 'تتناغم الفرق الميدانية مع لوحة موحدة وتنبؤات دقيقة بلا تعارض.',
      },
      {
        chapter: isEn ? 'Chapter 3 · After 6 Months' : 'الفصل 3 · بعد 6 أشهر',
        title:
          orgSize === 'enterprise'
            ? isEn
              ? 'Institutional Leadership & Compounding ROI'
              : 'ريادة مؤسسية وعائد مستدام'
            : isEn
            ? 'Safe Growth & Protected Liquidity'
            : 'نمو آمن وحماية السيولة',
        tone: 'healthy',
        desc:
          orgSize === 'enterprise'
            ? isEn
              ? 'Verified cost savings, preserved employee memory, and smooth GDP talent onboarding.'
              : 'تحقق الشركة وفورات موثقة وتحفظ ذاكرة الموظف وتدمج خريجي GDP بكفاءة.'
            : isEn
            ? 'Protects seasonal cashflow and doubles contractual reliability in the market.'
            : 'تحمي المنشأة سيولتها الموسمية وتضاعف موثوقيتها التعاقدية في السوق.',
      },
    ];
  }

  if (simState === 'critical') {
    return [
      {
        chapter: isEn ? 'Chapter 1 · Rollout Start' : 'الفصل 1 · بداية التطبيق',
        title: isEn ? 'Deceptive Demo & Early Applause' : 'انطباع خادع وتصفيق مبكر',
        tone: 'warning',
        desc: isEn
          ? `Flashy AI dashboards are showcased atop disconnected ${sectorShort} silos.`
          : `تُعرض لوحات ذكية جذابة فوق بيانات متفرقة في ${sector.shortName}.`,
      },
      {
        chapter: isEn ? 'Chapter 2 · Peak Season' : 'الفصل 2 · ذروة الموسم',
        title: isEn ? 'Field Exposure & Manual Overload' : 'انكشاف ميداني وإرهاق يدوي',
        tone: 'critical',
        desc: isEn
          ? 'Models misfire under peak load; staff revert to manual firefighting and trust collapses.'
          : 'تخطئ الخوارزميات في الذروة، فيُجبر الموظفون على التصحيح اليدوي وتنهار الثقة.',
      },
      {
        chapter: isEn ? 'Chapter 3 · After 6 Months' : 'الفصل 3 · بعد 6 أشهر',
        title:
          orgSize === 'enterprise'
            ? isEn
              ? 'Million-Scale Write-Off as Transformation Cost'
              : 'خسارة مليونية كبند تحول رقمي'
            : isEn
            ? 'Acute Liquidity Crisis & Exit Risk'
            : 'أزمة سيولة حادة وخطر الخروج',
        tone: 'critical',
        desc:
          orgSize === 'enterprise'
            ? isEn
              ? 'Enterprise reserves absorb the financial loss, yet key talent and employee memory depart.'
              : 'تمتص الشركة الكبرى الخسارة مالياً، لكنها تخسر الكفاءات وذاكرة الموظف.'
            : isEn
            ? 'Operational failures consume seasonal working capital immediately and threaten survival.'
            : 'تلتهم الأعطال سيولة المنشأة الموسمية فوراً وتهدد بقاءها في السوق.',
      },
    ];
  }

  if (simState === 'warning') {
    return [
      {
        chapter: isEn ? 'Chapter 1 · Rollout Start' : 'الفصل 1 · بداية التطبيق',
        title: isEn ? 'Promising Yet Incomplete Core' : 'تأسيس واعد لكنه غير مكتمل',
        tone: 'warning',
        desc: isEn
          ? `Initial blocks exist for ${sectorShort}, but system integration remains partial.`
          : `توجد لبنات أولية في ${sector.shortName} لكن التكامل لم يكتمل بعد.`,
      },
      {
        chapter: isEn ? 'Chapter 2 · Peak Season' : 'الفصل 2 · ذروة الموسم',
        title: isEn ? 'Partial Operational Strain' : 'إجهاد تشغيلي جزئي',
        tone: 'warning',
        desc: isEn
          ? 'Core workflows hold up, yet recurring bottlenecks still force manual workarounds.'
          : 'تصمد العمليات الأساسية مع ظهور اختناقات متكررة تتطلب تدخلاً يدوياً.',
      },
      {
        chapter: isEn ? 'Chapter 3 · After 6 Months' : 'الفصل 3 · بعد 6 أشهر',
        title:
          orgSize === 'enterprise'
            ? isEn
              ? 'Below-Target Return on Investment'
              : 'عائد دون المأمول'
            : isEn
            ? 'Margin Compression Risk'
            : 'ضغط على هوامش الربح',
        tone: 'warning',
        desc: isEn
          ? 'Completing governance blocks before peak safeguards ROI and prevents talent churn.'
          : 'استكمال التأسيس قبل الذروة يحمي العائد ويمنع تسرب الكفاءات.',
      },
    ];
  }

  return [
    {
      chapter: isEn ? 'Chapter 1 · Rollout Start' : 'الفصل 1 · بداية التطبيق',
      title: isEn ? 'Executive Decision Crossroads' : 'مفترق القرار التنفيذي',
      tone: 'neutral',
      desc: isEn
        ? `In ${sectorShort}, tech solutions look identical until data readiness is tested.`
        : `في ${sector.shortName} تبدو الحلول التقنية متشابهة قبل اختبار البيانات.`,
    },
    {
      chapter: isEn ? 'Chapter 2 · Peak Season' : 'الفصل 2 · ذروة الموسم',
      title: isEn ? 'Peak-Season Moment of Truth' : 'لحظة الحقيقة الميدانية',
      tone: 'neutral',
      desc: isEn
        ? 'Peak demand reveals whether systems are truly unified or trapped in silos.'
        : 'ضغط الموسم يكشف هل الأنظمة مترابطة أم تعمل في صوامع معزولة.',
    },
    {
      chapter: isEn ? 'Chapter 3 · After 6 Months' : 'الفصل 3 · بعد 6 أشهر',
      title: isEn ? 'True Financial & Human Impact' : 'الأثر المالي والبشري الحقيقي',
      tone: 'neutral',
      desc:
        orgSize === 'enterprise'
          ? isEn
            ? 'Foundation quality decides whether the initiative yields sustained savings or write-offs.'
            : 'جودة التأسيس تحدد إن كان المشروع وفراً مستداماً أم بند خسائر.'
          : isEn
          ? 'Foundation quality determines whether cashflow stays safe or enters operational crisis.'
          : 'جودة التأسيس تحدد أمان السيولة أو الوقوع في أزمة تشغيلية.',
    },
  ];
}
