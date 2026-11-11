function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function getDaysInclusive(startDate, endDate) {
  const s = Date.parse(`${startDate}T00:00:00Z`);
  const e = Date.parse(`${endDate}T00:00:00Z`);
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

/**
 * Computes transparent weighted employee scorecards for any date range.
 * Every score is verifiable against manual calculation:
 *   Composite = (Sales * W_s + Attendance * W_a + Feedback * W_f + Recognition * W_r) / TotalWeight
 */
function scoreEmployees({
  employees,
  departments,
  sales,
  attendance,
  feedback,
  recognitions,
  settings,
  startDate,
  endDate,
}) {
  const daysInRange = getDaysInclusive(startDate, endDate);
  const deptEmpCounts = {};
  for (const emp of employees) {
    deptEmpCounts[emp.department_id] = (deptEmpCounts[emp.department_id] || 0) + 1;
  }

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d]));

  // Group records by employee_id
  const salesByEmp = {};
  for (const row of sales) {
    (salesByEmp[row.employee_id] ||= []).push(row);
  }

  const attByEmp = {};
  for (const row of attendance) {
    (attByEmp[row.employee_id] ||= []).push(row);
  }

  const fbByEmp = {};
  for (const row of feedback) {
    (fbByEmp[row.employee_id] ||= []).push(row);
  }

  const recByEmp = {};
  for (const row of recognitions) {
    if (row.status === 'Rejected') continue;
    (recByEmp[row.employee_id] ||= []).push(row);
  }

  const wSales = Number(settings.sales_weight ?? 40);
  const wAtt = Number(settings.attendance_weight ?? 25);
  const wFb = Number(settings.feedback_weight ?? 20);
  const wRec = Number(settings.recognition_weight ?? 15);
  const totalW = Math.max(1, wSales + wAtt + wFb + wRec);

  const benchmarkRecPoints = Math.max(30, (daysInRange / 30) * 125);

  const scored = employees.map((emp) => {
    const dept = deptMap[emp.department_id] || { target_monthly_sales: 1000000, name: emp.department_name };
    const deptSize = Math.max(1, deptEmpCounts[emp.department_id] || 1);

    // 1. Sales Metrics & Score
    const empSales = salesByEmp[emp.id] || [];
    let grossSalesInr = 0;
    let returnsInr = 0;
    let netSalesInr = 0;
    let billsCount = 0;
    let itemsSold = 0;
    let upsellCount = 0;

    for (const s of empSales) {
      grossSalesInr += Number(s.gross_amount_inr || 0);
      returnsInr += Number(s.returns_inr || 0);
      netSalesInr += Number(s.net_amount_inr || 0);
      billsCount += Number(s.bills_count || 0);
      itemsSold += Number(s.items_sold || 0);
      upsellCount += Number(s.upsell_count || 0);
    }

    const proRatedTargetInr = Math.round((Number(dept.target_monthly_sales) / deptSize) * (daysInRange / 30));
    const targetAchievementPct = proRatedTargetInr > 0
      ? round1((netSalesInr / proRatedTargetInr) * 100)
      : 100;
    // Hitting 100% target = 68 score; exceeding by ~45% reaches 100
    const salesScore = round1(Math.min(100, (netSalesInr / Math.max(1, proRatedTargetInr)) * 68));

    // 2. Attendance Metrics & Score
    const empAtt = attByEmp[emp.id] || [];
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let weeklyOffDays = 0;
    let totalHours = 0;

    for (const a of empAtt) {
      totalHours += Number(a.hours_worked || 0);
      if (a.status === 'Present') presentDays++;
      else if (a.status === 'Late') lateDays++;
      else if (a.status === 'Half-Day') halfDays++;
      else if (a.status === 'Leave') leaveDays++;
      else if (a.status === 'Weekly-Off') weeklyOffDays++;
    }

    const workingDays = presentDays + lateDays + halfDays + leaveDays;
    const earnedCredits = presentDays * 1.0 + lateDays * 0.65 + halfDays * 0.45;
    const attendanceScore = workingDays > 0 ? round1((earnedCredits / workingDays) * 100) : 100;
    const punctualityPct = workingDays > 0 ? round1((presentDays / workingDays) * 100) : 100;

    // 3. Customer Feedback Metrics & Score
    const empFb = fbByEmp[emp.id] || [];
    const feedbackCount = empFb.length;
    const avgRating = feedbackCount > 0
      ? round2(empFb.reduce((acc, f) => acc + Number(f.rating || 0), 0) / feedbackCount)
      : 4.3;
    const positiveFeedbackCount = empFb.filter((f) => f.sentiment === 'Positive').length;
    const feedbackScore = round1((avgRating / 5.0) * 100);

    // 4. Recognition Metrics & Score
    const empRec = recByEmp[emp.id] || [];
    const recognitionCount = empRec.length;
    const recognitionPoints = empRec.reduce((acc, r) => acc + Number(r.points || 0), 0);
    const recognitionScore = round1(Math.min(100, (recognitionPoints / benchmarkRecPoints) * 100));

    // 5. Weighted Composite Score
    const compositeScore = round1(
      (salesScore * wSales + attendanceScore * wAtt + feedbackScore * wFb + recognitionScore * wRec) / totalW
    );

    const tier = compositeScore >= (settings.gold_threshold ?? 85)
      ? 'Gold'
      : compositeScore >= (settings.silver_threshold ?? 72)
        ? 'Silver'
        : 'Needs Coaching';

    const formulaText = `(${salesScore} × ${wSales}% Sales) + (${attendanceScore} × ${wAtt}% Attendance) + (${feedbackScore} × ${wFb}% Feedback) + (${recognitionScore} × ${wRec}% Recognition) = ${compositeScore}%`;

    return {
      id: emp.id,
      emp_code: emp.emp_code,
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone,
      gender: emp.gender,
      role: emp.role,
      shift: emp.shift,
      join_date: emp.join_date,
      base_salary_inr: Number(emp.base_salary_inr),
      avatar_initials: emp.avatar_initials,
      avatar_color: emp.avatar_color,
      department_id: emp.department_id,
      department_code: emp.department_code,
      department_name: emp.department_name,
      department_color: emp.department_color,
      metrics: {
        grossSalesInr: Math.round(grossSalesInr),
        returnsInr: Math.round(returnsInr),
        netSalesInr: Math.round(netSalesInr),
        proRatedTargetInr,
        targetAchievementPct,
        billsCount,
        itemsSold,
        upsellCount,
        avgBillValueInr: billsCount > 0 ? Math.round(netSalesInr / billsCount) : 0,
        workingDays,
        presentDays,
        lateDays,
        halfDays,
        leaveDays,
        weeklyOffDays,
        totalHours: round1(totalHours),
        punctualityPct,
        feedbackCount,
        avgRating,
        positiveFeedbackCount,
        recognitionCount,
        recognitionPoints,
      },
      scores: {
        salesScore,
        attendanceScore,
        feedbackScore,
        recognitionScore,
        compositeScore,
        tier,
      },
      formulaBreakdown: {
        formulaText,
        weights: { sales: wSales, attendance: wAtt, feedback: wFb, recognition: wRec },
        contributions: {
          sales: round2((salesScore * wSales) / totalW),
          attendance: round2((attendanceScore * wAtt) / totalW),
          feedback: round2((feedbackScore * wFb) / totalW),
          recognition: round2((recognitionScore * wRec) / totalW),
        },
      },
    };
  });

  scored.sort((a, b) => b.scores.compositeScore - a.scores.compositeScore || b.metrics.netSalesInr - a.metrics.netSalesInr);
  return scored.map((emp, index) => ({
    ...emp,
    rank: index + 1,
  }));
}

module.exports = {
  scoreEmployees,
  getDaysInclusive,
  round1,
  round2,
};
