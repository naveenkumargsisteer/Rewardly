const { getConfig } = require('../config/env');
const { getDashboardAnalytics } = require('./analyticsService');

function formatInr(amount) {
  const num = Number(amount || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

async function tryExternalLlmSummary({ question, groundTruthSummary }) {
  const cfg = getConfig();
  if (!cfg.geminiApiKey && !cfg.openaiApiKey) return null;

  const systemPrompt =
    'You are Rewardly AI, an executive analytics assistant for Kaveri Silks & Textiles showroom. ' +
    'Answer concisely in 2-4 sentences using ONLY the verified numbers provided in the JSON context. Never invent numbers.';
  const userPrompt = `Owner Question: ${question}\nVerified Context: ${JSON.stringify(groundTruthSummary)}`;

  try {
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
        if (text) return { text: text.trim(), provider: 'Gemini AI' };
      }
    }

    if (cfg.openaiApiKey) {
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
          temperature: 0.2,
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        const text = json?.choices?.[0]?.message?.content;
        if (text) return { text: text.trim(), provider: 'OpenAI' };
      }
    }
  } catch {
    // Gracefully fall back to built-in analytics engine
  }
  return null;
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

  if (matchedEmployees.length >= 2) {
    const picked = matchedEmployees.slice(0, 4);
    answer = `Here is a side-by-side comparison for ${picked.map((e) => e.full_name).join(' vs ')} (${meta.activeRange.startDate} to ${meta.activeRange.endDate}):`;
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
    answer = `Across all ${departmentBreakdown.length} showroom departments (${meta.activeRange.startDate} to ${meta.activeRange.endDate}), ${leader.name} leads with ${leader.avgPerformanceScore}% performance and ${leader.loyaltyScore}% loyalty.`;
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
    answer = `Here are the top ${top10.length} employees at ${meta.shop.name} (${meta.activeRange.startDate} to ${meta.activeRange.endDate}), led by ${top10[0]?.full_name} at ${top10[0]?.scores.compositeScore}% composite score and ${formatInr(top10[0]?.metrics.netSalesInr)} net sales.`;
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

  // Optional live LLM enhancement when user supplies GEMINI_API_KEY / OPENAI_API_KEY
  let aiProvider = 'Rewardly Analytics Engine';
  const llm = await tryExternalLlmSummary({
    question: q,
    groundTruthSummary: { answer, highlights, kpis },
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
    range: meta.activeRange,
  };
}

module.exports = {
  answerQuestion,
};

