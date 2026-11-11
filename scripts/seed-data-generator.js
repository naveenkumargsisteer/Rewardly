/**
 * Deterministic 4-Month Seed Generator for Rewardly
 * Shop: Kaveri Silks & Textiles (Flagship Showroom, Bengaluru)
 * Covers: 30 Indian Employees across 6 Textile Departments over 4 months (2026-07-12 to 2026-11-11)
 */

function createRng(seed = 20261111) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeUuid(prefixNum, index) {
  const p = String(prefixNum).padStart(4, '0');
  const i = String(index).padStart(12, '0');
  return `10000000-${p}-4000-8000-${i}`;
}

function formatDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const START_DATE = '2026-07-12';
const END_DATE = '2026-11-11';
const SHOP_ID = makeUuid(1, 1);

const SHOP = {
  id: SHOP_ID,
  name: 'Kaveri Silks & Textiles',
  tagline: 'Celebrate. Engage. Retain. — Flagship Textile Showroom',
  location: 'Commercial Street & Jayanagar Flagship',
  city: 'Bengaluru, Karnataka',
  currency: 'INR',
  owner_name: 'Rajeshwari Deshpande',
};

const DEPARTMENTS = [
  { id: makeUuid(2, 1), shop_id: SHOP_ID, code: 'SILK', name: 'Silk & Sarees', target_monthly_sales: 2400000, color_hex: '#7C3AED' },
  { id: makeUuid(2, 2), shop_id: SHOP_ID, code: 'ETHN', name: 'Ethnic & Bridal', target_monthly_sales: 1850000, color_hex: '#3B82F6' },
  { id: makeUuid(2, 3), shop_id: SHOP_ID, code: 'MENS', name: 'Menswear & Formals', target_monthly_sales: 1450000, color_hex: '#06B6D4' },
  { id: makeUuid(2, 4), shop_id: SHOP_ID, code: 'KIDS', name: 'Kids & Casuals', target_monthly_sales: 950000, color_hex: '#10B981' },
  { id: makeUuid(2, 5), shop_id: SHOP_ID, code: 'HOME', name: 'Home & Linen', target_monthly_sales: 800000, color_hex: '#F59E0B' },
  { id: makeUuid(2, 6), shop_id: SHOP_ID, code: 'BILL', name: 'Billing & Care', target_monthly_sales: 600000, color_hex: '#EC4899' },
];

const DEPT_BY_CODE = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, d]));

const EMPLOYEE_SPECS = [
  // Silk & Sarees (6)
  { code: 'RW001', name: 'Ananya Iyer', dept: 'SILK', gender: 'Female', role: 'Senior Saree Stylist', join: '2022-03-14', salary: 44000, color: '#7C3AED', perf: 1.24, punct: 0.96, rating: 4.88, recBias: 1.35, growth: 0.14 },
  { code: 'RW002', name: 'Karthik Subramanian', dept: 'SILK', gender: 'Male', role: 'Bridal Silk Consultant', join: '2021-11-02', salary: 42000, color: '#6D28D9', perf: 1.16, punct: 0.94, rating: 4.78, recBias: 1.25, growth: 0.12 },
  { code: 'RW003', name: 'Meera Krishnan', dept: 'SILK', gender: 'Female', role: 'Kanjeevaram Specialist', join: '2023-01-19', salary: 36000, color: '#8B5CF6', perf: 1.08, punct: 0.92, rating: 4.68, recBias: 1.15, growth: 0.16 },
  { code: 'RW004', name: 'Vikram Patel', dept: 'SILK', gender: 'Male', role: 'Silk Sales Executive', join: '2023-08-07', salary: 32000, color: '#5B21B6', perf: 0.97, punct: 0.87, rating: 4.45, recBias: 0.95, growth: 0.10 },
  { code: 'RW005', name: 'Lakshmi Narayanan', dept: 'SILK', gender: 'Female', role: 'Floor Merchandiser', join: '2022-09-25', salary: 33500, color: '#9333EA', perf: 1.03, punct: 0.95, rating: 4.62, recBias: 1.10, growth: 0.08 },
  { code: 'RW006', name: 'Suresh Pillai', dept: 'SILK', gender: 'Male', role: 'Sales Associate', join: '2024-04-10', salary: 27000, color: '#4F46E5', perf: 0.84, punct: 0.83, rating: 4.25, recBias: 0.80, growth: 0.11 },

  // Ethnic & Bridal (5)
  { code: 'RW007', name: 'Priya Nair', dept: 'ETHN', gender: 'Female', role: 'Bridal Wear Lead', join: '2021-06-18', salary: 45000, color: '#2563EB', perf: 1.26, punct: 0.97, rating: 4.91, recBias: 1.40, growth: 0.15 },
  { code: 'RW008', name: 'Aarav Sharma', dept: 'ETHN', gender: 'Male', role: 'Sherwani & Ethnic Stylist', join: '2023-02-11', salary: 35500, color: '#1D4ED8', perf: 1.12, punct: 0.91, rating: 4.71, recBias: 1.18, growth: 0.22 },
  { code: 'RW009', name: 'Divya Reddy', dept: 'ETHN', gender: 'Female', role: 'Lehenga Consultant', join: '2022-10-03', salary: 36500, color: '#3B82F6', perf: 1.14, punct: 0.93, rating: 4.76, recBias: 1.22, growth: 0.20 },
  { code: 'RW010', name: 'Siddharth Joshi', dept: 'ETHN', gender: 'Male', role: 'Festive Sales Executive', join: '2024-01-15', salary: 29500, color: '#0284C7', perf: 0.91, punct: 0.85, rating: 4.35, recBias: 0.85, growth: 0.12 },
  { code: 'RW011', name: 'Shreya Chatterjee', dept: 'ETHN', gender: 'Female', role: 'Ethnic Sales Associate', join: '2024-06-01', salary: 26500, color: '#6366F1', perf: 0.88, punct: 0.89, rating: 4.44, recBias: 0.92, growth: 0.17 },

  // Menswear & Formals (5)
  { code: 'RW012', name: 'Rohan Deshmukh', dept: 'MENS', gender: 'Male', role: 'Menswear Floor Lead', join: '2021-09-12', salary: 41000, color: '#0EA5E9', perf: 1.18, punct: 0.95, rating: 4.79, recBias: 1.28, growth: 0.13 },
  { code: 'RW013', name: 'Arjun Malhotra', dept: 'MENS', gender: 'Male', role: 'Suiting & Tailoring Advisor', join: '2022-07-21', salary: 34500, color: '#0891B2', perf: 1.05, punct: 0.90, rating: 4.58, recBias: 1.05, growth: 0.09 },
  { code: 'RW014', name: 'Rahul Menon', dept: 'MENS', gender: 'Male', role: 'Formal Wear Executive', join: '2023-05-08', salary: 31000, color: '#0369A1', perf: 0.95, punct: 0.88, rating: 4.42, recBias: 0.92, growth: 0.08 },
  { code: 'RW015', name: 'Nikhil Choudhary', dept: 'MENS', gender: 'Male', role: 'Casuals & Denim Associate', join: '2024-02-19', salary: 27500, color: '#14B8A6', perf: 0.86, punct: 0.82, rating: 4.21, recBias: 0.78, growth: 0.07 },
  { code: 'RW016', name: 'Varun Kapoor', dept: 'MENS', gender: 'Male', role: 'Menswear Sales Associate', join: '2024-05-14', salary: 26000, color: '#0D9488', perf: 0.96, punct: 0.71, rating: 4.30, recBias: 0.82, growth: 0.05 }, // high potential, attendance coaching flag

  // Kids & Casuals (5)
  { code: 'RW017', name: 'Sneha Kulkarni', dept: 'KIDS', gender: 'Female', role: 'Kids Section Lead', join: '2022-04-04', salary: 37000, color: '#10B981', perf: 1.15, punct: 0.96, rating: 4.82, recBias: 1.24, growth: 0.14 },
  { code: 'RW018', name: 'Kavya Rao', dept: 'KIDS', gender: 'Female', role: 'Kids Ethnic Stylist', join: '2023-03-27', salary: 30500, color: '#059669', perf: 1.04, punct: 0.91, rating: 4.61, recBias: 1.08, growth: 0.15 },
  { code: 'RW019', name: 'Pranav Hegde', dept: 'KIDS', gender: 'Male', role: 'Sales Executive', join: '2023-11-11', salary: 28000, color: '#16A34A', perf: 0.92, punct: 0.88, rating: 4.39, recBias: 0.90, growth: 0.11 },
  { code: 'RW020', name: 'Pooja Verma', dept: 'KIDS', gender: 'Female', role: 'Sales Associate', join: '2024-03-04', salary: 25500, color: '#22C55E', perf: 0.89, punct: 0.90, rating: 4.46, recBias: 0.94, growth: 0.16 },
  { code: 'RW021', name: 'Vivek Mishra', dept: 'KIDS', gender: 'Male', role: 'Junior Floor Associate', join: '2024-07-01', salary: 23500, color: '#84CC16', perf: 0.76, punct: 0.76, rating: 4.05, recBias: 0.68, growth: 0.04 },

  // Home & Linen (4)
  { code: 'RW022', name: 'Swati Bhat', dept: 'HOME', gender: 'Female', role: 'Furnishing & Linen Lead', join: '2022-01-17', salary: 36000, color: '#F59E0B', perf: 1.13, punct: 0.95, rating: 4.74, recBias: 1.18, growth: 0.12 },
  { code: 'RW023', name: 'Manish Gupta', dept: 'HOME', gender: 'Male', role: 'Dress Materials Specialist', join: '2023-06-12', salary: 29500, color: '#D97706', perf: 0.98, punct: 0.89, rating: 4.49, recBias: 0.96, growth: 0.10 },
  { code: 'RW024', name: 'Ritika Bansal', dept: 'HOME', gender: 'Female', role: 'Handloom Advisor', join: '2023-09-18', salary: 28500, color: '#EA580C', perf: 1.02, punct: 0.93, rating: 4.65, recBias: 1.08, growth: 0.18 },
  { code: 'RW025', name: 'Aditya Tiwari', dept: 'HOME', gender: 'Male', role: 'Sales Associate', join: '2024-06-10', salary: 24500, color: '#F97316', perf: 0.78, punct: 0.74, rating: 4.10, recBias: 0.72, growth: 0.03 },

  // Billing & Care (5)
  { code: 'RW026', name: 'Nisha Agarwal', dept: 'BILL', gender: 'Female', role: 'POS & Billing Supervisor', join: '2021-08-09', salary: 38000, color: '#EC4899', perf: 1.17, punct: 0.98, rating: 4.84, recBias: 1.30, growth: 0.11 },
  { code: 'RW027', name: 'Deepika Shetty', dept: 'BILL', gender: 'Female', role: 'Customer Experience Executive', join: '2022-11-21', salary: 31500, color: '#DB2777', perf: 1.10, punct: 0.94, rating: 4.86, recBias: 1.26, growth: 0.14 },
  { code: 'RW028', name: 'Harshvardhan Singh', dept: 'BILL', gender: 'Male', role: 'Senior Cashier', join: '2023-04-03', salary: 29000, color: '#BE185D', perf: 0.96, punct: 0.91, rating: 4.48, recBias: 0.95, growth: 0.09 },
  { code: 'RW029', name: 'Pallavi Gokhale', dept: 'BILL', gender: 'Female', role: 'Loyalty Desk Executive', join: '2023-10-16', salary: 28000, color: '#E11D48', perf: 1.05, punct: 0.93, rating: 4.69, recBias: 1.14, growth: 0.16 },
  { code: 'RW030', name: 'Nandini Srinivasan', dept: 'BILL', gender: 'Female', role: 'Alteration & Dispatch Lead', join: '2022-05-30', salary: 31000, color: '#F43F5E', perf: 1.01, punct: 0.94, rating: 4.59, recBias: 1.06, growth: 0.10 },
];

const TEXTILE_CATEGORIES = {
  SILK: ['Kanjeevaram Pure Silk', 'Banarasi Brocade', 'Mysore Crepe Silk', 'Tussar & Organza'],
  ETHN: ['Bridal Lehengas', 'Wedding Sherwanis', 'Designer Anarkalis', 'Festive Kurtis'],
  MENS: ['Raymond & Suiting', 'Linen Shirts', 'Bandhgala & Jackets', 'Formal Trousers'],
  KIDS: ['Pattu Pavadai & Kids Ethnic', 'Festive Boys Kurta Set', 'Cotton Daily Wear', 'Party Frocks'],
  HOME: ['Cotton Dress Materials', 'Handloom Bedsheets', 'Silk Cushion & Drapes', 'Unstitched Fabrics'],
  BILL: ['Gift Vouchers & Hampers', 'Loyalty Membership Upgrades', 'Express Saree Fall & Pico', 'Care Kits'],
};

const INDIAN_CUSTOMERS = [
  'Ramesh Hegde', 'Kavitha Murthy', 'Srinivas Rao', 'Sunita Menon', 'Manoj Kulkarni',
  'Deepa Krishnan', 'Arvind Nair', 'Geetha Sharma', 'Prakash Gowda', 'Bhavna Joshi',
  'Sanjay Verma', 'Usha Subramanian', 'Vinay Deshpande', 'Rekha Agarwal', 'Mohan Reddy',
  'Anjali Chatterjee', 'Kiran Shetty', 'Parvati Iyer', 'Nitin Bansal', 'Sudha Pillai',
  'Gaurav Kapoor', 'Radhika Bhat', 'Ashok Tiwari', 'Vasudha Srinivasan', 'Harish Patel',
];

const POSITIVE_COMMENTS = [
  'Patiently showed 15+ sarees and helped us choose the ideal bridal Kanjeevaram.',
  'Excellent knowledge of fabric purity, zari work, and color matching.',
  'Warm hospitality and quick assistance even during the busy festive rush.',
  'Suggested thoughtful matching accessories that completed the family wedding look.',
  'Transparent pricing, neat draping demonstration, and super courteous service.',
  'Billing and gift wrapping were handled smoothly within minutes.',
  'Truly memorable showroom experience; we will definitely recommend Kaveri Silks.',
  'Helped coordinate matching outfits for the entire wedding party effortlessly.',
];

const NEUTRAL_COMMENTS = [
  'Good collection overall, though weekend billing counter wait was slightly long.',
  'Helpful staff; needed a little extra time to find the requested size.',
  'Nice fabric suggestions; alteration delivery took an extra hour.',
];

const RECOGNITION_BADGES = [
  { type: 'Peer-to-Peer', badge: 'Team Pillar', points: 20, messages: ['Stepped in smoothly to help close a big wedding family order.', 'Always keeps the display shelves crisp and supports new joiners.', 'Covered floor rush graciously without hesitation.'] },
  { type: 'Manager', badge: 'Festive Sales Star', points: 35, messages: ['Exceeded weekly showroom target with exceptional upsell conversion.', 'Zero billing discrepancies and high repeat customer conversion.', 'Demonstrated exemplary leadership during weekend rush hours.'] },
  { type: 'Customer Praise', badge: 'Customer Delight 5★', points: 30, messages: ['Named specifically in customer feedback for extraordinary patience and styling.', 'Converted first-time visitors into loyal family wedding shoppers.', 'Received glowing in-store QR compliment from bridal party.'] },
  { type: 'Milestone', badge: 'Punctuality & Loyalty', points: 25, messages: ['100% on-time check-ins across consecutive weeks.', 'Consistent high-bar service quality and showroom discipline.', 'Maintained top customer satisfaction score across the month.'] },
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

function getMonthFactor(dateStr) {
  // Reflects authentic Indian textile season: July baseline -> Diwali/Wedding peak in Oct-Nov
  const ym = dateStr.slice(0, 7);
  switch (ym) {
    case '2026-07': return 0.78;
    case '2026-08': return 0.88;
    case '2026-09': return 0.98;
    case '2026-10': return 1.18;
    case '2026-11': return 1.24;
    default: return 1.0;
  }
}

function getMonthProgress(dateStr) {
  // 0.0 at START_DATE -> 1.0 at END_DATE
  const startMs = Date.parse(`${START_DATE}T00:00:00Z`);
  const endMs = Date.parse(`${END_DATE}T00:00:00Z`);
  const curMs = Date.parse(`${dateStr}T00:00:00Z`);
  return Math.max(0, Math.min(1, (curMs - startMs) / (endMs - startMs)));
}

function generateSeedDataset() {
  const rng = createRng(20261111);

  const employees = EMPLOYEE_SPECS.map((spec, idx) => {
    const dept = DEPT_BY_CODE[spec.dept];
    const slug = spec.name.toLowerCase().replace(/[^a-z]+/g, '.');
    return {
      id: makeUuid(3, idx + 1),
      shop_id: SHOP_ID,
      department_id: dept.id,
      emp_code: spec.code,
      full_name: spec.name,
      email: `${slug}@kaverisilks.in`,
      phone: `+91 98${String(45010000 + idx * 13729).slice(0, 8)}`,
      gender: spec.gender,
      role: spec.role,
      shift: idx % 3 === 2 ? 'Afternoon (11:30-21:00)' : 'Morning (10:00-19:30)',
      join_date: spec.join,
      base_salary_inr: spec.salary,
      avatar_initials: getInitials(spec.name),
      avatar_color: spec.color,
      status: 'active',
      _spec: spec,
      _dept: dept,
    };
  });

  const deptCounts = {};
  for (const e of employees) {
    deptCounts[e._dept.code] = (deptCounts[e._dept.code] || 0) + 1;
  }

  const sales_records = [];
  const attendance_records = [];
  const customer_feedback = [];
  const recognitions = [];

  let salesIdCounter = 1;
  let attIdCounter = 1;
  let fbIdCounter = 1;
  let recIdCounter = 1;

  // Iterate each day from START_DATE to END_DATE (123 days)
  for (let dayOffset = 0; ; dayOffset++) {
    const dateObj = addDays(START_DATE, dayOffset);
    const dateStr = formatDate(dateObj);
    if (dateStr > END_DATE) break;

    const dow = dateObj.getUTCDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const weekendBoost = isWeekend ? 1.38 : 0.92;
    const seasonalFactor = getMonthFactor(dateStr);
    const progress = getMonthProgress(dateStr);

    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const emp = employees[empIdx];
      const spec = emp._spec;
      const dept = emp._dept;
      const deptCount = deptCounts[dept.code];

      // Each employee gets a staggered weekly off (Mon-Thu, never Sat/Sun in retail!)
      const offDow = 1 + (empIdx % 4); // 1=Mon..4=Thu
      const isWeeklyOff = dow === offDow;

      if (isWeeklyOff) {
        attendance_records.push({
          id: makeUuid(5, attIdCounter++),
          shop_id: SHOP_ID,
          employee_id: emp.id,
          attendance_date: dateStr,
          status: 'Weekly-Off',
          check_in: null,
          check_out: null,
          hours_worked: 0,
          late_minutes: 0,
        });
        continue;
      }

      // Determine attendance status
      const attRoll = rng();
      const punct = Math.min(0.99, spec.punct + progress * 0.02);
      let attStatus = 'Present';
      let lateMins = 0;
      let hoursWorked = 9.0 + Math.round((rng() * 0.8 - 0.2) * 10) / 10;
      let checkInHour = emp.shift.startsWith('Morning') ? 10 : 11;
      let checkInMin = emp.shift.startsWith('Morning') ? 0 : 30;

      if (attRoll < punct) {
        attStatus = 'Present';
        checkInMin = Math.max(0, checkInMin - Math.floor(rng() * 8));
      } else if (attRoll < punct + (1 - punct) * 0.58) {
        attStatus = 'Late';
        lateMins = 12 + Math.floor(rng() * 38);
        const totalMins = checkInHour * 60 + checkInMin + lateMins;
        checkInHour = Math.floor(totalMins / 60);
        checkInMin = totalMins % 60;
        hoursWorked = Math.max(7.2, hoursWorked - lateMins / 60);
      } else if (attRoll < punct + (1 - punct) * 0.80) {
        attStatus = 'Half-Day';
        hoursWorked = 4.5 + Math.round(rng() * 5) / 10;
      } else {
        attStatus = 'Leave';
        hoursWorked = 0;
      }

      const checkInStr = attStatus === 'Leave'
        ? null
        : `${String(checkInHour).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')}`;
      const checkOutHour = attStatus === 'Half-Day' ? checkInHour + 5 : checkInHour + 9;
      const checkOutStr = attStatus === 'Leave'
        ? null
        : `${String(Math.min(22, checkOutHour)).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')}`;

      attendance_records.push({
        id: makeUuid(5, attIdCounter++),
        shop_id: SHOP_ID,
        employee_id: emp.id,
        attendance_date: dateStr,
        status: attStatus,
        check_in: checkInStr,
        check_out: checkOutStr,
        hours_worked: Math.round(hoursWorked * 100) / 100,
        late_minutes: lateMins,
      });

      if (attStatus === 'Leave') continue;

      // Daily sales per employee (26 working days/month baseline)
      const baseDailyTarget = dept.target_monthly_sales / deptCount / 26;
      const halfDayScale = attStatus === 'Half-Day' ? 0.52 : 1.0;
      const growthScale = 1 + (spec.growth * progress);
      const noise = 0.78 + rng() * 0.44;
      const grossAmount = Math.round(
        (baseDailyTarget * spec.perf * seasonalFactor * weekendBoost * halfDayScale * growthScale * noise) / 10
      ) * 10;
      const returnsAmount = rng() < 0.14 ? Math.round((grossAmount * (0.02 + rng() * 0.05)) / 10) * 10 : 0;
      const netAmount = Math.max(0, grossAmount - returnsAmount);

      const avgTicket = dept.code === 'SILK' ? 14500
        : dept.code === 'ETHN' ? 12000
          : dept.code === 'MENS' ? 6200
            : dept.code === 'KIDS' ? 3800
              : dept.code === 'HOME' ? 4200
                : 2400;

      const billsCount = Math.max(1, Math.round(grossAmount / (avgTicket * (0.85 + rng() * 0.35))));
      const itemsSold = Math.max(billsCount, Math.round(billsCount * (1.4 + rng() * 1.5)));
      const upsellCount = Math.floor(billsCount * (0.25 + spec.perf * 0.18 * rng()));
      const categories = TEXTILE_CATEGORIES[dept.code];
      const category = categories[Math.floor(rng() * categories.length)];

      sales_records.push({
        id: makeUuid(4, salesIdCounter++),
        shop_id: SHOP_ID,
        employee_id: emp.id,
        sale_date: dateStr,
        bills_count: billsCount,
        items_sold: itemsSold,
        gross_amount_inr: grossAmount,
        returns_inr: returnsAmount,
        net_amount_inr: netAmount,
        upsell_count: upsellCount,
        category,
      });

      // Customer feedback (~30% of working days per employee -> ~900+ entries over 4 months)
      if (rng() < 0.30) {
        const rawRating = spec.rating + (rng() - 0.45) * 0.9 + progress * 0.12;
        const clamped = Math.max(2.5, Math.min(5.0, rawRating));
        const rating = Math.round(clamped * 2) / 2;
        const sentiment = rating >= 4.0 ? 'Positive' : rating >= 3.5 ? 'Neutral' : 'Needs-Attention';
        const customerName = INDIAN_CUSTOMERS[Math.floor(rng() * INDIAN_CUSTOMERS.length)];
        const commentList = sentiment === 'Positive' ? POSITIVE_COMMENTS : NEUTRAL_COMMENTS;
        const comment = commentList[Math.floor(rng() * commentList.length)];
        const channel = rng() < 0.55 ? 'In-Store QR' : rng() < 0.85 ? 'WhatsApp Receipt' : 'Google Review';

        customer_feedback.push({
          id: makeUuid(6, fbIdCounter++),
          shop_id: SHOP_ID,
          employee_id: emp.id,
          feedback_date: dateStr,
          rating,
          sentiment,
          customer_name: customerName,
          comment,
          channel,
        });
      }

      // Recognitions (~14% chance per active employee-day * recBias -> ~450+ recognitions over 4 months)
      const recProb = 0.125 * spec.recBias * (0.85 + progress * 0.45);
      if (rng() < recProb) {
        const typeRoll = rng();
        let chosenSpec;
        if (typeRoll < 0.52) chosenSpec = RECOGNITION_BADGES[0]; // Peer-to-Peer (~52-58%)
        else if (typeRoll < 0.78) chosenSpec = RECOGNITION_BADGES[1]; // Manager (~26%)
        else if (typeRoll < 0.91) chosenSpec = RECOGNITION_BADGES[2]; // Customer Praise (~13%)
        else chosenSpec = RECOGNITION_BADGES[3]; // Milestone (~9%)

        let peerIdx = Math.floor(rng() * employees.length);
        if (peerIdx === empIdx) peerIdx = (empIdx + 1) % employees.length;
        const peer = employees[peerIdx];
        const givenByName = chosenSpec.type === 'Manager'
          ? SHOP.owner_name
          : chosenSpec.type === 'Customer Praise'
            ? 'Customer Voice Desk'
            : chosenSpec.type === 'Milestone'
              ? 'Rewardly AI System'
              : peer.full_name;
        const givenByEmpId = chosenSpec.type === 'Peer-to-Peer' ? peer.id : null;
        const msg = chosenSpec.messages[Math.floor(rng() * chosenSpec.messages.length)];

        recognitions.push({
          id: makeUuid(7, recIdCounter++),
          shop_id: SHOP_ID,
          employee_id: emp.id,
          given_by_employee_id: givenByEmpId,
          given_by_name: givenByName,
          recognition_type: chosenSpec.type,
          badge_title: chosenSpec.badge,
          points: chosenSpec.points,
          message: msg,
          recognition_date: dateStr,
          status: 'Approved',
        });
      }
    }
  }

  // Seed AI Reward Recommendations (recent festive month + earlier approved cycle)
  const rewardTemplates = [
    { empCode: 'RW007', title: 'Diwali Bridal Champion Bonus', bonus: 7500, score: 94.6, status: 'Pending', periodStart: '2026-10-12', periodEnd: '2026-11-11', rationale: 'Ranked #1 overall with 126% of Ethnic & Bridal target, 97% attendance, and 4.9★ bridal customer feedback.' },
    { empCode: 'RW001', title: 'Kanjeevaram Excellence Award', bonus: 7000, score: 93.2, status: 'Pending', periodStart: '2026-10-12', periodEnd: '2026-11-11', rationale: 'Highest net silk revenue across all 30 showroom staff with 4.9★ customer delight ratings.' },
    { empCode: 'RW012', title: 'Menswear Leadership Trophy', bonus: 5000, score: 89.4, status: 'Pending', periodStart: '2026-10-12', periodEnd: '2026-11-11', rationale: 'Consistent 118% target achievement and strong peer mentoring in Raymond suiting & formals.' },
    { empCode: 'RW008', title: 'Rising Star Festive Accelerator', bonus: 4000, score: 87.8, status: 'Pending', periodStart: '2026-10-12', periodEnd: '2026-11-11', rationale: '+22% month-over-month sales growth during wedding season with zero customer complaints.' },
    { empCode: 'RW026', title: 'Zero-Error POS & Loyalty Gold', bonus: 4000, score: 88.9, status: 'Pending', periodStart: '2026-10-12', periodEnd: '2026-11-11', rationale: '98% punctuality score and top loyalty card enrollment rate at billing desk.' },
    { empCode: 'RW002', title: 'Q3 Silk Mastery Voucher', bonus: 5000, score: 90.1, status: 'Approved', periodStart: '2026-09-01', periodEnd: '2026-09-30', rationale: 'Outstanding high-ticket bridal silk conversions during Navratri shopping rush.' },
    { empCode: 'RW017', title: 'Kids Floor Customer Hero', bonus: 3500, score: 88.3, status: 'Approved', periodStart: '2026-09-01', periodEnd: '2026-09-30', rationale: '96% attendance and 4.8★ family satisfaction ratings in Kids & Casuals.' },
    { empCode: 'RW027', title: 'Customer Smile Ambassador', bonus: 3000, score: 87.1, status: 'Approved', periodStart: '2026-08-01', periodEnd: '2026-08-31', rationale: 'Top QR customer praise count across all showroom counters.' },
  ];

  const empByCode = Object.fromEntries(employees.map((e) => [e.emp_code, e]));
  const reward_recommendations = rewardTemplates.map((r, i) => ({
    id: makeUuid(8, i + 1),
    shop_id: SHOP_ID,
    employee_id: empByCode[r.empCode].id,
    period_start: r.periodStart,
    period_end: r.periodEnd,
    composite_score: r.score,
    reward_title: r.title,
    bonus_amount_inr: r.bonus,
    rationale: r.rationale,
    status: r.status,
    reviewed_by: r.status === 'Approved' ? SHOP.owner_name : null,
    reviewed_at: r.status === 'Approved' ? '2026-10-03T11:30:00Z' : null,
  }));

  const scoring_settings = {
    id: makeUuid(9, 1),
    shop_id: SHOP_ID,
    sales_weight: 40,
    attendance_weight: 25,
    feedback_weight: 20,
    recognition_weight: 15,
    gold_threshold: 85,
    silver_threshold: 72,
    public_export_token: 'rw_live_kaveri_2026',
    require_export_token: false,
    ai_provider: 'builtin',
  };

  // Strip internal helper props before exporting
  const cleanEmployees = employees.map(({ _spec, _dept, ...rest }) => rest);

  return {
    meta: {
      start_date: START_DATE,
      end_date: END_DATE,
      employee_count: cleanEmployees.length,
      department_count: DEPARTMENTS.length,
    },
    shop: SHOP,
    departments: DEPARTMENTS,
    employees: cleanEmployees,
    sales_records,
    attendance_records,
    customer_feedback,
    recognitions,
    reward_recommendations,
    scoring_settings,
  };
}

module.exports = {
  generateSeedDataset,
  START_DATE,
  END_DATE,
  SHOP_ID,
};

