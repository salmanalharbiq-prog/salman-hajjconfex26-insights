// @ts-check
import {
  BUILDING_BLOCKS,
  CHAIN_LINK_TITLES,
  IDEAL_PLAN_IDS,
  ORG_PROFILES,
  SECTORS,
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
 */
export function getKpiStatus(value) {
  if (value >= 75) {
    return { label: 'ممتلئ وآمن', tone: 'healthy', color: 'var(--accent-emerald)' };
  }
  if (value >= 50) {
    return { label: 'متوسط يحتاج تدعيم', tone: 'warning', color: 'var(--accent-orange)' };
  }
  return { label: 'منخفض في دائرة الخطر', tone: 'critical', color: 'var(--accent-crimson)' };
}

/**
 * Clamp value between 0 and 100.
 * @param {number} n
 */
function clamp100(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Evaluate the complete simulation state from user choices.
 * Pure deterministic function — zero DOM side effects.
 *
 * @param {object} input
 * @param {'quick' | 'builder'} input.mode
 * @param {'neutral' | 'shell' | 'foundation'} input.quickPath
 * @param {(string | null)[]} input.slots
 * @param {'enterprise' | 'sme'} input.orgSize
 * @param {string} input.sectorId
 */
export function evaluateSimulation({ mode, quickPath, slots, orgSize, sectorId }) {
  const sector = SECTORS.find((s) => s.id === sectorId) || SECTORS[0];
  const org = ORG_PROFILES[orgSize] || ORG_PROFILES.enterprise;

  // Normalize 4-slot array
  const normalizedSlots = [0, 1, 2, 3].map((idx) => (slots && slots[idx] ? slots[idx] : null));

  let readinessScore = 62;
  /** @type {'neutral' | 'governed' | 'warning' | 'critical'} */
  let simState = 'neutral';
  let hasOrderViolation = false;
  let kpiValues = { financial: 64, memory: 60, compliance: 62, resilience: 62 };
  let warningTitle = 'الوضع الاستكشافي: اختر مساراً أو رتّب مراحل خطتك';
  let fieldReaction = `في ${sector.name}، كل قرار يبدأ بتحديد الأولوية: هل نؤسس البيانات وتوثيق الأنظمة أولاً أم نقفز مباشرة للذكاء الاصطناعي؟`;

  // Track which blocks are used
  const filledBlocks = normalizedSlots
    .map((id, idx) => ({
      idx,
      block: BUILDING_BLOCKS.find((b) => b.id === id) || null,
    }))
    .filter((entry) => entry.block !== null);

  let isSoundPlan = false;
  let bottleneckIndex = -1;

  if (mode === 'quick') {
    if (quickPath === 'shell') {
      simState = 'critical';
      readinessScore = 35;
      hasOrderViolation = true;
      bottleneckIndex = 0; // Knowledge / foundation bottleneck
      kpiValues =
        orgSize === 'sme'
          ? { financial: 22, memory: 28, compliance: 34, resilience: 31 }
          : { financial: 44, memory: 30, compliance: 36, resilience: 35 };
      warningTitle = 'ذكاء فوق الرمال! قفز للمظاهر التقنية بلا أساس';
      fieldReaction =
        orgSize === 'sme'
          ? `إنذار حرج في ${sector.name}: غياب توحيد المصادر والتوثيق أدى إلى تضارب نتائج الذكاء الاصطناعي، واضطرار الكوادر الميدانية للعمل اليدوي المضاعف مع استنزاف حاد للسيولة الموسمية.`
          : `تعثر تشغيلي في ${sector.name}: الآلة تصدر قراءات متضاربة فوق صوامع بيانات متفرقة؛ الموظفون الميدانيون يفقدون الثقة ويغادرون حاملين ذاكرة التشغيل، بينما تسجل الإدارة الخسارة تحت بند «التحول الرقمي».`;
    } else if (quickPath === 'foundation') {
      simState = 'governed';
      readinessScore = 100;
      isSoundPlan = true;
      kpiValues = { financial: 96, memory: 98, compliance: 99, resilience: 97 };
      warningTitle = 'مسار الأساس المحكوم: تأسيس صلب يقود ذكاءً موثوقاً';
      fieldReaction = `أداء مثالي في ${sector.name}: توثيق الأنظمة وتوحيد المصادر وتصنيف البيانات (NDMO/PDPL) منحت الخوارزميات بيانات نظيفة، فارتفعت ثقة الفريق الميداني وصمدت العمليات في ذروة الموسم.`;
    } else {
      simState = 'neutral';
      readinessScore = 62;
      kpiValues = { financial: 64, memory: 60, compliance: 62, resilience: 62 };
      warningTitle = 'الوضع الاستكشافي: قارن بين المسارين أو انتقل للمختبر';
      fieldReaction = `اختر «مسار القشور» أو «مسار الأساس» لمعاينة أثر القرار مباشرة على مؤشرات ${sector.name} وسلسلة القيمة.`;
    }
  } else {
    // Builder Mode (4-stage interactive plan)
    if (filledBlocks.length === 0) {
      simState = 'neutral';
      readinessScore = 58;
      kpiValues = { financial: 60, memory: 56, compliance: 58, resilience: 58 };
      warningTitle = 'المختبر جاهز: ضع اللبنات في المراحل الأربع';
      fieldReaction = `ابدأ بوضع لبنات الأساس في المرحلتين 1 و2 لقطاع ${sector.name}، أو جرّب وضع الذكاء الاصطناعي في البداية لترى رد فعل الميدان.`;
    } else {
      let foundationBeforeAi = 0;
      let totalFoundation = 0;
      let totalAi = 0;
      let firstAiIndex = -1;

      for (const entry of filledBlocks) {
        const b = /** @type {NonNullable<typeof entry.block>} */ (entry.block);
        if (b.type === 'foundation') {
          totalFoundation += 1;
          if (firstAiIndex === -1) {
            foundationBeforeAi += 1;
          }
        } else {
          totalAi += 1;
          if (firstAiIndex === -1) {
            firstAiIndex = entry.idx;
          }
        }
      }

      // Check for "AI on Sand" ordering violation:
      // Any AI block placed in Stage 1 (idx 0) or Stage 2 (idx 1), OR placed before at least 2 foundation blocks
      const aiInEarlyStage = filledBlocks.some(
        (e) => e.block && e.block.type === 'ai' && e.idx <= 1
      );
      const aiBeforeTwoFoundations = totalAi > 0 && foundationBeforeAi < 2;

      if (aiInEarlyStage || aiBeforeTwoFoundations) {
        hasOrderViolation = true;
        simState = 'critical';
        bottleneckIndex = firstAiIndex === 0 ? 0 : 1;
        const baseScore = Math.max(24, 42 - totalAi * 6 + totalFoundation * 5);
        readinessScore = Math.min(44, baseScore);

        kpiValues = {
          financial: clamp100((orgSize === 'sme' ? 24 : 42) + totalFoundation * 4 - totalAi * 5),
          memory: clamp100(32 + totalFoundation * 4 - totalAi * 4),
          compliance: clamp100(34 + (normalizedSlots.includes('ndmo') ? 14 : 0) - totalAi * 4),
          resilience: clamp100(30 + totalFoundation * 4 - totalAi * 5),
        };
        warningTitle = 'تحذير فوري: ذكاء فوق الرمال!';
        fieldReaction = `تم وضع لبنة ذكاء اصطناعي قبل إكمال الأساس (في المرحلة ${
          firstAiIndex + 1
        })! في ${sector.name}، ستتغذى الخوارزمية على بيانات غير موحدة أو غير موثقة وتُربك الفرق الميدانية.`;
      } else {
        // No AI ordering violation
        const hasDocs = normalizedSlots.includes('docs');
        const hasSsot = normalizedSlots.includes('ssot');
        const hasNdmo = normalizedSlots.includes('ndmo');
        const hasLineage = normalizedSlots.includes('lineage');
        const hasFinops = normalizedSlots.includes('finops');

        // Sound complete plan: 4 slots filled with (3 foundation + 1 AI) OR (4 foundation) and no ordering violation
        if (filledBlocks.length === 4 && totalFoundation >= 3) {
          isSoundPlan = true;
          simState = 'governed';

          const isExactIdeal = IDEAL_PLAN_IDS.every((id, i) => normalizedSlots[i] === id);
          readinessScore = isExactIdeal
            ? 100
            : clamp100(86 + totalFoundation * 2 + (totalAi === 1 ? 6 : 4));

          kpiValues = {
            financial: clamp100(
              82 + (hasFinops ? 12 : 8) + (hasSsot ? 4 : 0) + (totalAi === 1 ? 2 : 0)
            ),
            memory: clamp100(84 + (hasDocs ? 10 : 6) + (hasLineage ? 4 : 2)),
            compliance: clamp100(84 + (hasNdmo ? 12 : 6) + (hasLineage ? 4 : 2)),
            resilience: clamp100(85 + (hasSsot ? 8 : 4) + (totalAi === 1 ? 5 : 2)),
          };

          if (isExactIdeal) {
            kpiValues = { financial: 96, memory: 98, compliance: 99, resilience: 97 };
            readinessScore = 100;
          }

          warningTitle =
            totalAi === 1
              ? 'خطة مرجعية محكومة (3 لبنات أساس + ذكاء اصطناعي)'
              : 'تأسيس بيانات صلب ومستقر (4 لبنات أساس)';
          fieldReaction = `ممتاز! في ${sector.name}، استقرت جميع الحلقات الست بلا أي اختناق، وأصبحت المعلومة الموحدة تحمي ذاكرة الموظف وتدعم القرار التنفيذي وقت الذروة.`;
        } else {
          // Partial plan in progress (1-3 blocks, no order violation)
          const rawScore = 52 + totalFoundation * 9 + totalAi * 4;
          readinessScore = clamp100(Math.min(74, rawScore));
          simState = readinessScore >= 45 ? 'warning' : 'critical';

          kpiValues = {
            financial: clamp100(50 + (hasFinops ? 14 : 0) + totalFoundation * 5),
            memory: clamp100(48 + (hasDocs ? 16 : 0) + totalFoundation * 4),
            compliance: clamp100(46 + (hasNdmo ? 18 : 0) + (hasLineage ? 8 : 0) + totalFoundation * 3),
            resilience: clamp100(48 + (hasSsot ? 14 : 0) + totalFoundation * 4),
          };
          warningTitle = `خطة قيد البناء (${filledBlocks.length}/4 مراحل مكتملة)`;
          fieldReaction = `واصل استكمال المراحل المتبقية لقطاع ${sector.name} للوصول إلى خطة محكومة (≥ 75%) تضيء معها جميع حلقات سلسلة الأثر.`;
        }
      }
    }
  }

  // Build 6-Link Causal Pipeline following the Mandatory Fairness Rule
  const chainLinks = CHAIN_LINK_TITLES.map((link, idx) => {
    /** @type {'healthy' | 'neutral' | 'bottleneck' | 'degraded'} */
    let state = 'neutral';
    if (isSoundPlan) {
      // Mandatory Fairness Rule: 6/6 emerald green, ZERO red links
      state = 'healthy';
    } else if (hasOrderViolation) {
      if (idx === bottleneckIndex) {
        state = 'bottleneck';
      } else if (idx > bottleneckIndex) {
        state = 'degraded';
      } else {
        state = 'bottleneck';
      }
    } else if (simState === 'neutral') {
      state = 'neutral';
    } else {
      // Partial builder plan with no violation
      const filledCount = filledBlocks.length;
      state = idx < filledCount ? 'healthy' : 'neutral';
    }

    return {
      ...link,
      sectorDetail: sector.chainDetails[idx],
      state,
    };
  });

  // Positive expansion recommendations when sound plan is achieved
  const usedIds = new Set(normalizedSlots.filter(Boolean));
  const expansionRecommendations = isSoundPlan
    ? BUILDING_BLOCKS.filter((b) => b.type === 'foundation' && !usedIds.has(b.id))
    : [];

  // Build 3-Chapter Executive Timeline (Enterprise vs SME divergence)
  const timeline = buildTimeline({ simState, isSoundPlan, orgSize, sector });

  // Build LinkedIn diagnostic copy text
  const linkedinSummary = [
    `التشخيص التنفيذي — ${sector.name} (${org.label})`,
    `حالة الخطة: ${STATE_PRESETS[simState].badge} (${readinessScore}/100)`,
    `• السيولة والعائد: ${kpiValues.financial}%`,
    `• ذاكرة الموظف وثقة الفريق: ${kpiValues.memory}%`,
    `• الامتثال السيادي (NDMO/PDPL): ${kpiValues.compliance}%`,
    `• صمود العمليات وقت الذروة: ${kpiValues.resilience}%`,
    `الخلاصة: ${timeline[2].desc}`,
    `— عبر المحاكي التنفيذي لقرارات البيانات والذكاء الاصطناعي | م. سلمان الحربي`,
  ].join('\n');

  return {
    simState,
    stateMeta: STATE_PRESETS[simState],
    readinessScore,
    isSoundPlan,
    hasOrderViolation,
    warningTitle,
    fieldReaction,
    sector,
    org,
    kpis: {
      financial: { value: kpiValues.financial, ...getKpiStatus(kpiValues.financial) },
      memory: { value: kpiValues.memory, ...getKpiStatus(kpiValues.memory) },
      compliance: { value: kpiValues.compliance, ...getKpiStatus(kpiValues.compliance) },
      resilience: { value: kpiValues.resilience, ...getKpiStatus(kpiValues.resilience) },
    },
    chainLinks,
    expansionRecommendations,
    timeline,
    linkedinSummary,
  };
}

/**
 * Build the 3-Chapter Delayed Consequence Timeline.
 * @param {object} p
 * @param {'neutral' | 'governed' | 'warning' | 'critical'} p.simState
 * @param {boolean} p.isSoundPlan
 * @param {'enterprise' | 'sme'} p.orgSize
 * @param {typeof SECTORS[number]} p.sector
 */
function buildTimeline({ simState, isSoundPlan, orgSize, sector }) {
  if (isSoundPlan || simState === 'governed') {
    return [
      {
        chapter: 'الفصل 1 · بداية التطبيق',
        title: 'تأسيس صامت ومنضبط',
        tone: 'healthy',
        desc: `تركيز القيادة على توثيق العمليات وتوحيد مصادر ${sector.shortName} دون ضجيج إعلامي متسرع.`,
      },
      {
        chapter: 'الفصل 2 · ذروة الموسم',
        title: 'اختبار الضغط الميداني بنجاح',
        tone: 'healthy',
        desc: `تتناغم الفرق الميدانية مع لوحة موحدة، وتخرج تنبؤات الذكاء الاصطناعي دقيقة وخالية من التعارض.`,
      },
      {
        chapter: 'الفصل 3 · بعد 6 أشهر',
        title:
          orgSize === 'enterprise'
            ? 'ريادة مؤسسية وعائد مستدام'
            : 'نمو آمن وتعظيم للسيولة',
        tone: 'healthy',
        desc:
          orgSize === 'enterprise'
            ? 'تسجّل الشركة وفورات تشغيلية موثقة، وتحتفظ بذاكرة الموظف وتدمج الخريجين الجدد (GDP) بكفاءة.'
            : 'تحمي المنشأة سيولتها الموسمية، وتضاعف موثوقيتها التعاقدية أمام الجهات المنظمة والمشغّلين.',
      },
    ];
  }

  if (simState === 'critical') {
    return [
      {
        chapter: 'الفصل 1 · بداية التطبيق',
        title: 'انطباع خادع وتصفيق مبكر',
        tone: 'warning',
        desc: `تُعرض لوحات ذكاء اصطناعي جذابة في الاجتماعات بينما بيانات ${sector.shortName} متفرقة في ملفات وصوامع منفصلة.`,
      },
      {
        chapter: 'الفصل 2 · ذروة الموسم',
        title: 'انكشاف ميداني وتضاعف الجهد اليدوي',
        tone: 'critical',
        desc: `تُصدر الخوارزميات نتائج مغلوطة تحت ضغط الذروة، فيضطر الموظفون للتصحيح اليدوي وتنهار ثقتهم في قرارات الإدارة.`,
      },
      {
        chapter: 'الفصل 3 · بعد 6 أشهر',
        title:
          orgSize === 'enterprise'
            ? 'خسارة مليونية تُمرَّر كـ «تكاليف تحول رقمي»'
            : 'أزمة سيولة حادة وخطر الخروج من السوق',
        tone: 'critical',
        desc:
          orgSize === 'enterprise'
            ? 'تمتص الشركة الكبرى الخسارة عبر احتياطياتها وتسجلها كبند مبادرات ابتكارية، لكنها تخسر الموظفين الكفؤين و«ذاكرة الموظف».'
            : 'تلتهم الأعطال التشغيلية والغرامات سيولة المنشأة الموسمية فوراً، ما يضعها أمام شلل تشغيلي وخطر الخروج من السوق.',
      },
    ];
  }

  if (simState === 'warning') {
    return [
      {
        chapter: 'الفصل 1 · بداية التطبيق',
        title: 'بداية واعدة لكنها ناقصة',
        tone: 'warning',
        desc: `تتوفر بعض لبنات التأسيس في ${sector.shortName} لكن غياب اكتمال التكامل يترك فجوات صامتة.`,
      },
      {
        chapter: 'الفصل 2 · ذروة الموسم',
        title: 'إجهاد تشغيلي عند الذروة',
        tone: 'warning',
        desc: 'تصمد العمليات الأساسية لكن تظهر اختناقات جزئية تتطلب تدخلاً يدوياً متكرراً من المشرفين.',
      },
      {
        chapter: 'الفصل 3 · بعد 6 أشهر',
        title:
          orgSize === 'enterprise'
            ? 'عائد دون المأمول واستنزاف بطيء'
            : 'ضغط على هوامش الربح الموسمية',
        tone: 'warning',
        desc:
          orgSize === 'enterprise'
            ? 'تحتاج الشركة لإعادة هيكلة تكامل الأنظمة قبل الموسم التالي لتفادي تسرب الكفاءات.'
            : 'استكمال لبنات التأسيس الأربع ضروري لحماية هامش الربح وتفادي الأخطاء المكلفة.',
      },
    ];
  }

  return [
    {
      chapter: 'الفصل 1 · بداية التطبيق',
      title: 'مفترق القرار التنفيذي',
      tone: 'neutral',
      desc: `في ${sector.name}، تبدو كل الحلول التقنية لامعة في البداية قبل اختبار البيانات الحقيقية.`,
    },
    {
      chapter: 'الفصل 2 · ذروة الموسم',
      title: 'لحظة الحقيقة الميدانية',
      tone: 'neutral',
      desc: 'ضغط الأعداد والوقت في المشاعر يكشف فوراً هل الأنظمة مترابطة أم تعمل في جزر معزولة.',
    },
    {
      chapter: 'الفصل 3 · بعد 6 أشهر',
      title: 'الأثر المالي والبشري الحقيقي',
      tone: 'neutral',
      desc:
        orgSize === 'enterprise'
          ? 'تحدد جودة التأسيس ما إذا كان المشروع سيحقق وفراً مستداماً أم يتحول لبند خسائر تحول رقمي.'
          : 'تحدد جودة التأسيس ما إذا كانت المنشأة ستنمو بأمان أم ستواجه ضغط سيولة حاداً.',
    },
  ];
}
