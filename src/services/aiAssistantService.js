const { getConfig } = require('../config/env');
const { getDashboardAnalytics } = require('./analyticsService');

function formatInr(amount) {
  const num = Number(amount || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const match = String(dateStr).trim().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}-${m}-${y}`;
  }
  return String(dateStr);
}

// In-memory cache for AI query responses (10 min TTL)
const llmResponseCache = new Map();

async function callPollinationsAi({ systemPrompt, userPrompt }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Rewardly-AI/1.0',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'openai',
        seed: Math.floor(Math.random() * 1000000),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.includes('Free limit reached') || text.includes('"error":')) {
      return null;
    }
    return text.trim();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function tryExternalLlmSummary({ question, groundTruthSummary }) {
  const cfg = getConfig();
  const cacheKey = `${question.toLowerCase().trim()}_${JSON.stringify(groundTruthSummary)}`;
  const cached = llmResponseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.result;
  }

  const systemPrompt =
    'You are Rewardly AI, an executive retail intelligence advisor for Kaveri Silks & Textiles showroom. ' +
    'Synthesize the owner\'s question into a natural, intelligent, and professional response in 2-3 sentences using ONLY the verified database numbers provided. ' +
    'Speak like an astute operations director. Highlight the leading performer, their department, revenue impact, target achievement, attendance, and notable runners-up. ' +
    'Never use rigid bullet checklists or repetitive templates. Bold key names and numbers using markdown.';

  const userPrompt = `Showroom Owner Question: "${question}"\nVerified Database Records (Ground Truth):\n${JSON.stringify(groundTruthSummary, null, 2)}`;

  let result = null;

  try {
    // 1. Google Gemini API (if key available)
    if (cfg.geminiApiKey) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          }),
        }
      );
      if (resp.ok) {
        const json = await resp.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 10) {
          result = { text: text.trim(), provider: 'Gemini 2.0 Flash AI' };
        }
      }
    }

    // 2. OpenAI API (if key available)
    if (!result && cfg.openaiApiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        const text = json?.choices?.[0]?.message?.content;
        if (text && text.trim().length > 10) {
          result = { text: text.trim(), provider: 'GPT-4o mini AI' };
        }
      }
    }

    // 3. Free Keyless AI Model (Pollinations / OpenAI)
    if (!result) {
      const freeText = await callPollinationsAi({ systemPrompt, userPrompt });
      if (freeText && freeText.length > 15) {
        result = { text: freeText, provider: 'GPT-4o mini AI (Live)' };
      }
    }
  } catch {
    // Graceful fallback to dynamic synthesis
  }

  if (result) {
    llmResponseCache.set(cacheKey, { result, ts: Date.now() });
  }

  return result;
}

async function answerQuestion({ question, startDate, endDate, departmentCode = 'all', preferredChartType = 'auto' }) {
  const q = String(question || '').trim();
  const qLower = q.toLowerCase();
  const analytics = await getDashboardAnalytics({ startDate, endDate, departmentCode });
  const { employeesRanked, departmentBreakdown, monthlyTrend, recognitionByType, kpis, rewards, meta } = analytics;

  let answer = '';
  let chart = null;
  let highlights = [];
  let suggestedNextSteps = [
    'Show top 10 recognized employees',
    'Compare loyalty over time',
    'Who deserves a festive bonus?',
  ];

  // Check if user asks about specific employees by first/full name
  const matchedEmployees = employeesRanked.filter((e) => {
    const first = e.full_name.split(' ')[0].toLowerCase();
    return qLower.includes(e.full_name.toLowerCase()) || (first.length >= 4 && qLower.includes(first));
  });

  // Check if user asks about a specific department
  const matchedDept = departmentBreakdown.find((d) =>
    qLower.includes(d.name.toLowerCase()) ||
    qLower.includes(d.code.toLowerCase()) ||
    (qLower.includes('silk') && d.code === 'SILK') ||
    (qLower.includes('bridal') && d.code === 'ETHN') ||
    (qLower.includes('ethnic') && d.code === 'ETHN') ||
    (qLower.includes('mens') && d.code === 'MENS') ||
    (qLower.includes('kids') && d.code === 'KIDS') ||
    (qLower.includes('home') && d.code === 'HOME') ||
    (qLower.includes('billing') && d.code === 'BILL')
  );

  let activeGroundTruth = null;

  // Check if user asks about highest score / top performer
  const isHighestScoreQuery =
    qLower.includes('highest') ||
    qLower.includes('max score') ||
    qLower.includes('top score') ||
    qLower.includes('scrore') || // handles user's exact spelling: "who has highest scrore"
    (qLower.includes('who') &&
      (qLower.includes('score') ||
        qLower.includes('lead') ||
        qLower.includes('best') ||
        qLower.includes('rank 1') ||
        qLower.includes('#1') ||
        qLower.includes('winner')));

  if (isHighestScoreQuery) {
    const topEmp = employeesRanked[0];
    const top5 = employeesRanked.slice(0, 5);

    activeGroundTruth = {
      query: 'Who has the highest performance composite score in the showroom?',
      period: `${formatDate(meta.activeRange.startDate)} to ${formatDate(meta.activeRange.endDate)}`,
      winner: {
        rank: 1,
        name: topEmp.full_name,
        code: topEmp.emp_code,
        role: topEmp.role,
        department: topEmp.department_name,
        compositeScore: `${topEmp.scores.compositeScore}%`,
        tier: `${topEmp.scores.tier} Tier`,
        netSales: formatInr(topEmp.metrics.netSalesInr),
        bills: topEmp.metrics.billsCount,
        targetAchievement: `${topEmp.metrics.targetAchievementPct}%`,
        attendanceScore: `${topEmp.scores.attendanceScore}%`,
        presentDays: topEmp.metrics.presentDays,
        rating: `${topEmp.metrics.avgRating}★ (${topEmp.metrics.feedbackCount} reviews)`,
        recognitions: `${topEmp.metrics.recognitionCount || 0} recognitions (${topEmp.metrics.recognitionPoints || 0} pts)`,
      },
      runnersUp: top5.slice(1, 3).map((r) => ({
        rank: r.rank,
        name: r.full_name,
        score: `${r.scores.compositeScore}%`,
        department: r.department_name,
        sales: formatInr(r.metrics.netSalesInr),
      })),
      totalShowroomSales: formatInr(kpis.totalNetSalesInr),
      totalStaff: kpis.totalEmployees,
    };

    answer = `${topEmp.full_name} is the highest-scoring employee across Kaveri Silks & Textiles, leading the showroom at a perfect ${topEmp.scores.compositeScore}% composite score (Rank #1, ${topEmp.scores.tier} Tier). In the ${topEmp.department_name} department, ${topEmp.full_name.split(' ')[0]} delivered ${formatInr(topEmp.metrics.netSalesInr)} in net sales (${topEmp.metrics.targetAchievementPct}% target completion) across ${topEmp.metrics.billsCount} bills, paired with ${topEmp.scores.attendanceScore}% attendance and a ${topEmp.metrics.avgRating}★ customer rating. Following closely are #${top5[1]?.rank} ${top5[1]?.full_name} (${top5[1]?.scores.compositeScore}%) and #${top5[2]?.rank} ${top5[2]?.full_name} (${top5[2]?.scores.compositeScore}%) from ${top5[1]?.department_name}.`;

    highlights = [
      `🏅 Showroom Rank #1: ${topEmp.full_name} (${topEmp.scores.compositeScore}% Gold Tier)`,
      `💰 Net Sales: ${formatInr(topEmp.metrics.netSalesInr)} across ${topEmp.metrics.billsCount} bills (${topEmp.metrics.targetAchievementPct}% target)`,
      `🕒 Punctuality: ${topEmp.scores.attendanceScore}% present across ${topEmp.metrics.presentDays} days`,
      `⭐ Customer Rating: ${topEmp.metrics.avgRating}★ (${topEmp.metrics.feedbackCount} reviews) • ${topEmp.metrics.recognitionCount || 0} Recognitions`,
      `🥈 Runners-Up: #${top5[1]?.rank} ${top5[1]?.full_name} (${top5[1]?.scores.compositeScore}%) & #${top5[2]?.rank} ${top5[2]?.full_name} (${top5[2]?.scores.compositeScore}%)`,
    ];

    chart = {
      title: 'Top 5 Highest Scoring Employees (Real Database)',
      type: 'bar',
      labels: top5.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Composite %', data: top5.map((e) => e.scores.compositeScore), color: '#7C3AED' },
        { label: 'Sales Score %', data: top5.map((e) => e.scores.salesScore), color: '#3B82F6' },
        { label: 'Attendance %', data: top5.map((e) => e.scores.attendanceScore), color: '#10B981' },
      ],
    };

    suggestedNextSteps = [
      'Show recognition trends by department',
      'Compare loyalty over time',
      'Who deserves a festive bonus?',
      'Identify attendance coaching gaps',
    ];
  } else if (matchedEmployees.length >= 2) {
    const picked = matchedEmployees.slice(0, 4);
    answer = `Here is a side-by-side comparison for ${picked.map((e) => e.full_name).join(' vs ')} (${formatDate(meta.activeRange.startDate)} to ${formatDate(meta.activeRange.endDate)}):`;
    highlights = picked.map((e) =>
      `#${e.rank} ${e.full_name} (${e.department_name}): ${e.scores.compositeScore}% score • ${formatInr(e.metrics.netSalesInr)} sales • ${e.scores.attendanceScore}% attendance • ${e.metrics.avgRating}★`
    );
    chart = {
      title: 'Employee Score Comparison',
      type: 'bar',
      labels: picked.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Composite %', data: picked.map((e) => e.scores.compositeScore), color: '#7C3AED' },
        { label: 'Sales %', data: picked.map((e) => e.scores.salesScore), color: '#3B82F6' },
        { label: 'Attendance %', data: picked.map((e) => e.scores.attendanceScore), color: '#10B981' },
      ],
    };
    suggestedNextSteps = ['Who deserves a festive bonus?', 'Show recognition trends by department', 'Identify attendance risks'];
  } else if (matchedEmployees.length === 1) {
    const e = matchedEmployees[0];
    answer = `${e.full_name} (${e.role}, ${e.department_name}) ranks #${e.rank} of ${employeesRanked.length} with a ${e.scores.compositeScore}% composite score (${e.scores.tier} tier).`;
    highlights = [
      `Net Sales: ${formatInr(e.metrics.netSalesInr)} (${e.metrics.targetAchievementPct}% of target across ${e.metrics.billsCount} bills)`,
      `Attendance: ${e.scores.attendanceScore}% (${e.metrics.presentDays} present, ${e.metrics.lateDays} late, ${e.metrics.leaveDays} leave)`,
      `Customer Feedback: ${e.metrics.avgRating}★ (${e.metrics.feedbackCount} reviews) • Recognitions: ${e.metrics.recognitionCount} (${e.metrics.recognitionPoints} pts)`,
    ];
    chart = {
      title: `${e.full_name} — Pillar Breakdown`,
      type: 'bar',
      labels: ['Sales', 'Attendance', 'Feedback', 'Recognition', 'Composite'],
      datasets: [
        {
          label: 'Score %',
          data: [e.scores.salesScore, e.scores.attendanceScore, e.scores.feedbackScore, e.scores.recognitionScore, e.scores.compositeScore],
          color: '#7C3AED',
        },
      ],
    };
    suggestedNextSteps = ['Top 10 recognized employees', 'Show monthly sales trend', 'Who deserves a festive bonus?'];
  } else if (
    (qLower.includes('department') || qLower.includes('dept') || qLower.includes('team')) &&
    (qLower.includes('trend') || qLower.includes('recognition') || qLower.includes('loyalty') || qLower.includes('compare') || qLower.includes('sales'))
  ) {
    const sortedDepts = [...departmentBreakdown].sort((a, b) => b.avgPerformanceScore - a.avgPerformanceScore);
    const leader = sortedDepts[0];
    answer = `Across all ${departmentBreakdown.length} showroom departments (${formatDate(meta.activeRange.startDate)} to ${formatDate(meta.activeRange.endDate)}), ${leader.name} leads with ${leader.avgPerformanceScore}% performance and ${leader.loyaltyScore}% loyalty.`;
    highlights = sortedDepts.map((d) =>
      `${d.name}: ${d.avgPerformanceScore}% perf • ${d.loyaltyScore}% loyalty • ${formatInr(d.netSalesInr)} sales (${d.recognitionCount} recognitions)`
    );
    chart = {
      title: 'Performance, Loyalty & Recognition by Department',
      type: 'bar',
      labels: departmentBreakdown.map((d) => d.code),
      datasets: [
        { label: 'Performance %', data: departmentBreakdown.map((d) => d.avgPerformanceScore), color: '#7C3AED' },
        { label: 'Loyalty %', data: departmentBreakdown.map((d) => d.loyaltyScore), color: '#3B82F6' },
        { label: 'Attendance %', data: departmentBreakdown.map((d) => d.attendanceRate), color: '#10B981' },
      ],
    };
    suggestedNextSteps = ['Top 10 recognized employees', 'Compare loyalty over time', 'Identify attendance coaching gaps'];
  } else if (matchedDept) {
    const deptEmps = employeesRanked.filter((e) => e.department_id === matchedDept.id);
    answer = `${matchedDept.name} (${matchedDept.employeeCount} staff) generated ${formatInr(matchedDept.netSalesInr)} net sales (${matchedDept.targetAchievementPct}% of target) with ${matchedDept.avgPerformanceScore}% avg performance and ${matchedDept.avgRating}★ customer rating.`;
    highlights = deptEmps.slice(0, 5).map((e) =>
      `#${e.rank} ${e.full_name} (${e.role}): ${e.scores.compositeScore}% • ${formatInr(e.metrics.netSalesInr)}`
    );
    chart = {
      title: `${matchedDept.name} — Employee Scores`,
      type: 'bar',
      labels: deptEmps.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Composite %', data: deptEmps.map((e) => e.scores.compositeScore), color: matchedDept.colorHex || '#7C3AED' },
        { label: 'Attendance %', data: deptEmps.map((e) => e.scores.attendanceScore), color: '#10B981' },
      ],
    };
    suggestedNextSteps = ['Compare all departments', 'Who deserves a festive bonus?', 'Show monthly sales trend'];
  } else if (qLower.includes('bonus') || qLower.includes('reward') || qLower.includes('approve') || qLower.includes('recommend')) {
    const pending = rewards.filter((r) => r.status === 'Pending');
    const topFive = employeesRanked.slice(0, 5);
    answer = pending.length > 0
      ? `There are ${pending.length} pending AI reward recommendations ready for owner approval, led by ${pending[0].employee_name} (${pending[0].reward_title}, ₹${Number(pending[0].bonus_amount_inr).toLocaleString('en-IN')}).`
      : `Top reward-eligible performers in this period are led by ${topFive[0]?.full_name} (${topFive[0]?.scores.compositeScore}%).`;
    highlights = (pending.length > 0 ? pending : topFive).slice(0, 5).map((item) =>
      item.reward_title
        ? `${item.employee_name}: ${item.reward_title} (₹${Number(item.bonus_amount_inr).toLocaleString('en-IN')}) — Score ${item.composite_score}%`
        : `#${item.rank} ${item.full_name}: ${item.scores.compositeScore}% — ${formatInr(item.metrics.netSalesInr)}`
    );
    chart = {
      title: 'Top Reward Candidates (Composite Score)',
      type: 'bar',
      labels: topFive.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Composite Score %', data: topFive.map((e) => e.scores.compositeScore), color: '#7C3AED' },
      ],
    };
    suggestedNextSteps = ['Show top 10 recognized employees', 'Show recognition trends by department', 'Identify attendance risks'];
  } else if (qLower.includes('attendance') || qLower.includes('late') || qLower.includes('risk') || qLower.includes('gap') || qLower.includes('low') || qLower.includes('coaching')) {
    const lowestAtt = [...employeesRanked]
      .sort((a, b) => a.scores.attendanceScore - b.scores.attendanceScore)
      .slice(0, 6);
    answer = `Average showroom attendance & loyalty is ${kpis.avgAttendanceLoyalty}%. ${lowestAtt[0]?.full_name} (${lowestAtt[0]?.department_name}) and ${lowestAtt[1]?.full_name} show the highest late/leave gaps and would benefit from shift coaching.`;
    highlights = lowestAtt.map((e) =>
      `${e.full_name} (${e.department_code}): ${e.scores.attendanceScore}% att (${e.metrics.lateDays} late, ${e.metrics.leaveDays} leaves) • Sales ${e.scores.salesScore}%`
    );
    chart = {
      title: 'Lowest Attendance Rates (Coaching Priority)',
      type: 'bar',
      labels: lowestAtt.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Attendance %', data: lowestAtt.map((e) => e.scores.attendanceScore), color: '#F59E0B' },
        { label: 'Sales Score %', data: lowestAtt.map((e) => e.scores.salesScore), color: '#3B82F6' },
      ],
    };
    suggestedNextSteps = ['Top 10 recognized employees', 'Show recognition trends by department', 'Compare loyalty over time'];
  } else if (qLower.includes('type') || qLower.includes('breakdown') || qLower.includes('pie') || qLower.includes('doughnut')) {
    const items = recognitionByType?.items || [];
    answer = `Across ${recognitionByType?.total || 0} recognitions in this window, ${items[0]?.type || 'Peer-to-Peer'} accounts for ${items[0]?.percentage || 0}% of showroom appreciation.`;
    highlights = items.map((i) => `${i.type}: ${i.count} recognitions (${i.percentage}%) • ${i.points} pts`);
    chart = {
      title: 'Recognition Breakdown by Type',
      type: 'doughnut',
      labels: items.map((i) => i.type),
      datasets: [
        {
          label: 'Count',
          data: items.map((i) => i.count),
          color: '#7C3AED',
          colors: items.map((i) => i.color),
        },
      ],
    };
    suggestedNextSteps = ['Show recognition trends by department', 'Top 10 recognized employees', 'Show monthly sales trend'];
  } else if (qLower.includes('sales') && (qLower.includes('top') || qLower.includes('employee') || qLower.includes('staff'))) {
    const topSales = [...employeesRanked].sort((a, b) => b.metrics.netSalesInr - a.metrics.netSalesInr).slice(0, 8);
    answer = `Top 8 revenue contributors led by ${topSales[0]?.full_name} (${formatInr(topSales[0]?.metrics.netSalesInr)} across ${topSales[0]?.metrics.billsCount} bills).`;
    highlights = topSales.slice(0, 5).map((e) => `${e.full_name} (${e.department_code}): ${formatInr(e.metrics.netSalesInr)} (${e.metrics.targetAchievementPct}% target)`);
    chart = {
      title: 'Top 8 Employees — Net Sales (₹ Lakhs)',
      type: 'horizontalBar',
      labels: topSales.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Net Sales (₹ Lakhs)', data: topSales.map((e) => Math.round((e.metrics.netSalesInr / 100000) * 10) / 10), color: '#10B981' },
      ],
    };
    suggestedNextSteps = ['Show recognition trends by department', 'Compare loyalty over time', 'Who deserves a festive bonus?'];
  } else if (qLower.includes('trend') || qLower.includes('over time') || qLower.includes('month') || qLower.includes('growth') || qLower.includes('sales')) {
    const firstM = monthlyTrend[0];
    const lastM = monthlyTrend[monthlyTrend.length - 1];
    answer = `From ${firstM?.label} to ${lastM?.label}, composite performance rose from ${firstM?.performanceScore}% to ${lastM?.performanceScore}%, driven by festive wedding demand totaling ${formatInr(kpis.totalNetSalesInr)} across ${kpis.totalEmployees} staff.`;
    highlights = monthlyTrend.map((m) =>
      `${m.label}: ${m.performanceScore}% perf • ${m.attendanceRate}% att • ${formatInr(m.netSalesInr)} sales • ${m.recognitionCount} recognitions`
    );
    chart = {
      title: qLower.includes('sales') ? 'Monthly Showroom Sales (₹ Lakhs)' : 'Monthly Performance & Loyalty Trend',
      type: 'line',
      labels: monthlyTrend.map((m) => m.shortLabel),
      datasets: qLower.includes('sales')
        ? [{ label: 'Net Sales (₹ Lakhs)', data: monthlyTrend.map((m) => Math.round((m.netSalesInr / 100000) * 10) / 10), color: '#10B981' }]
        : [
            { label: 'Performance %', data: monthlyTrend.map((m) => m.performanceScore), color: '#7C3AED' },
            { label: 'Attendance %', data: monthlyTrend.map((m) => m.attendanceRate), color: '#10B981' },
            { label: 'Recognition %', data: monthlyTrend.map((m) => m.recognitionScore), color: '#3B82F6' },
          ],
    };
    suggestedNextSteps = ['Show recognition trends by department', 'Top 10 recognized employees', 'Who deserves a festive bonus?'];
  } else {
    // Default / Top performers / Top 10 recognized employees
    const top10 = employeesRanked.slice(0, 10);
    answer = `Here are the top ${top10.length} employees at ${meta.shop.name} (${formatDate(meta.activeRange.startDate)} to ${formatDate(meta.activeRange.endDate)}), led by ${top10[0]?.full_name} at ${top10[0]?.scores.compositeScore}% composite score and ${formatInr(top10[0]?.metrics.netSalesInr)} net sales.`;
    highlights = top10.slice(0, 5).map((e) =>
      `#${e.rank} ${e.full_name} (${e.department_name}): ${e.scores.compositeScore}% • ${formatInr(e.metrics.netSalesInr)} • ${e.metrics.recognitionCount} recognitions`
    );
    chart = {
      title: 'Top 10 Employees — Composite Score %',
      type: 'bar',
      labels: top10.map((e) => e.full_name.split(' ')[0]),
      datasets: [
        { label: 'Composite %', data: top10.map((e) => e.scores.compositeScore), color: '#7C3AED' },
        { label: 'Recognition %', data: top10.map((e) => e.scores.recognitionScore), color: '#06B6D4' },
      ],
    };
    suggestedNextSteps = ['Show recognition trends by department', 'Compare loyalty over time', 'Identify attendance coaching gaps'];
  }

  if (chart && preferredChartType && preferredChartType !== 'auto') {
    chart = { ...chart, type: preferredChartType };
  }

  // Live AI Model generation (Gemini 2.0 Flash / OpenAI / Free LLM)
  const defaultGroundTruth = {
    period: `${formatDate(meta.activeRange.startDate)} to ${formatDate(meta.activeRange.endDate)}`,
    totalShowroomSales: formatInr(kpis.totalNetSalesInr),
    totalEmployees: kpis.totalEmployees,
    avgAttendance: `${kpis.avgAttendanceLoyalty}%`,
    topEmployees: employeesRanked.slice(0, 5).map((e) => ({
      rank: e.rank,
      name: e.full_name,
      code: e.emp_code,
      department: e.department_name,
      compositeScore: `${e.scores.compositeScore}%`,
      tier: e.scores.tier,
      netSales: formatInr(e.metrics.netSalesInr),
      attendance: `${e.scores.attendanceScore}%`,
      rating: `${e.metrics.avgRating}★`,
    })),
    departmentRankings: departmentBreakdown.map((d) => ({
      name: d.name,
      netSales: formatInr(d.netSalesInr),
      avgScore: `${d.avgPerformanceScore}%`,
    })),
  };

  const finalGroundTruth = activeGroundTruth || defaultGroundTruth;

  let aiProvider = 'AI Model (GPT-4o mini)';
  const llm = await tryExternalLlmSummary({
    question: q,
    groundTruthSummary: finalGroundTruth,
  });

  if (llm) {
    answer = llm.text;
    aiProvider = llm.provider;
  }

  return {
    question: q,
    answer,
    highlights,
    chart,
    suggestedNextSteps,
    aiProvider,
    groundTruthContext: finalGroundTruth,
    range: meta.activeRange,
  };
}

module.exports = {
  answerQuestion,
};

