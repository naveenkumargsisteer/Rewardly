const crypto = require('node:crypto');
const { createSupabaseClient } = require('./supabaseClient');
const { generateSeedDataset } = require('../../scripts/seed-data-generator');

const DEFAULT_SETTINGS = {
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

class SupabaseRepository {
  constructor(url, key, ssrContext = null) {
    this.supabase = createSupabaseClient({
      url,
      key,
      req: ssrContext?.req || null,
      res: ssrContext?.res || null,
      useSsr: Boolean(ssrContext?.useSsr),
    });
    this._seedChecked = false;
  }

  async ensureSeededIfEmpty() {
    if (this._seedChecked) return;
    const [shopsRes, empRes, salesRes] = await Promise.all([
      this.supabase.from('shops').select('*', { count: 'exact', head: true }),
      this.supabase.from('employees').select('*', { count: 'exact', head: true }),
      this.supabase.from('sales_records').select('*', { count: 'exact', head: true }),
    ]);
    const firstErr = shopsRes.error || empRes.error || salesRes.error;
    if (firstErr) {
      throw new Error(`Supabase schema check error (verify schema.sql was executed): ${firstErr.message}`);
    }
    if ((shopsRes.count || 0) === 0 || (empRes.count || 0) === 0 || (salesRes.count || 0) === 0) {
      await this.resetAndReseed();
    }
    this._seedChecked = true;
  }

  async fetchAllPaginated(table, buildQuery) {
    const pageSize = 1000;
    let from = 0;
    const all = [];

    while (true) {
      let query = this.supabase.from(table).select('*');
      if (buildQuery) {
        query = buildQuery(query);
      }
      // Always apply deterministic tie-breaker sort for stable range pagination
      query = query.order('id', { ascending: true });
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw new Error(`Supabase query error (${table}): ${error.message}`);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return all;
  }

  async countTable(table) {
    const { count, error } = await this.supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Supabase count error (${table}): ${error.message}`);
    return count || 0;
  }

  async getShopAndMeta() {
    await this.ensureSeededIfEmpty();
    const { data: shops, error: shopErr } = await this.supabase.from('shops').select('*').limit(1);
    if (shopErr) throw new Error(`Supabase shops error: ${shopErr.message}`);
    const shop = shops?.[0] || null;

    const [{ data: minRow }, { data: maxRow }] = await Promise.all([
      this.supabase.from('sales_records').select('sale_date').order('sale_date', { ascending: true }).limit(1),
      this.supabase.from('sales_records').select('sale_date').order('sale_date', { ascending: false }).limit(1),
    ]);

    const [employees, departments, sales_records, attendance_records, customer_feedback, recognitions, reward_recommendations] =
      await Promise.all([
        this.countTable('employees'),
        this.countTable('departments'),
        this.countTable('sales_records'),
        this.countTable('attendance_records'),
        this.countTable('customer_feedback'),
        this.countTable('recognitions'),
        this.countTable('reward_recommendations'),
      ]);

    return {
      shop,
      dateBounds: {
        minDate: minRow?.[0]?.sale_date || '2026-07-12',
        maxDate: maxRow?.[0]?.sale_date || '2026-11-11',
      },
      counts: {
        employees,
        departments,
        sales_records,
        attendance_records,
        customer_feedback,
        recognitions,
        reward_recommendations,
      },
    };
  }

  async getDepartments() {
    await this.ensureSeededIfEmpty();
    const { data, error } = await this.supabase
      .from('departments')
      .select('*')
      .order('target_monthly_sales', { ascending: false });
    if (error) throw new Error(`Supabase departments error: ${error.message}`);
    return data || [];
  }

  async getEmployees() {
    await this.ensureSeededIfEmpty();
    const { data, error } = await this.supabase
      .from('employees')
      .select('*, departments(code, name, color_hex, target_monthly_sales)')
      .order('emp_code', { ascending: true });
    if (error) throw new Error(`Supabase employees error: ${error.message}`);

    return (data || []).map((row) => {
      const { departments, ...emp } = row;
      return {
        ...emp,
        department_code: departments?.code || '',
        department_name: departments?.name || '',
        department_color: departments?.color_hex || '#7C3AED',
        target_monthly_sales: Number(departments?.target_monthly_sales || 1000000),
      };
    });
  }

  async getSettings() {
    await this.ensureSeededIfEmpty();
    const { data, error } = await this.supabase.from('scoring_settings').select('*').limit(1);
    if (error) throw new Error(`Supabase settings error: ${error.message}`);
    const row = data?.[0];
    if (!row) return { ...DEFAULT_SETTINGS };
    return {
      ...row,
      require_export_token: Boolean(row.require_export_token),
    };
  }

  async updateSettings(patch) {
    const current = await this.getSettings();
    const next = {
      sales_weight: patch.sales_weight ?? current.sales_weight,
      attendance_weight: patch.attendance_weight ?? current.attendance_weight,
      feedback_weight: patch.feedback_weight ?? current.feedback_weight,
      recognition_weight: patch.recognition_weight ?? current.recognition_weight,
      gold_threshold: patch.gold_threshold ?? current.gold_threshold,
      silver_threshold: patch.silver_threshold ?? current.silver_threshold,
      public_export_token: patch.public_export_token ?? current.public_export_token,
      require_export_token: patch.require_export_token !== undefined
        ? Boolean(patch.require_export_token)
        : Boolean(current.require_export_token),
      ai_provider: patch.ai_provider ?? current.ai_provider,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('scoring_settings')
      .update(next)
      .eq('id', current.id)
      .select()
      .single();
    if (error) throw new Error(`Supabase settings update error: ${error.message}`);
    return {
      ...data,
      require_export_token: Boolean(data.require_export_token),
    };
  }

  async updateShop(patch) {
    const { shop } = await this.getShopAndMeta();
    const { data, error } = await this.supabase
      .from('shops')
      .update({
        name: patch.name ?? shop.name,
        tagline: patch.tagline ?? shop.tagline,
        location: patch.location ?? shop.location,
        city: patch.city ?? shop.city,
        owner_name: patch.owner_name ?? shop.owner_name,
      })
      .eq('id', shop.id)
      .select()
      .single();
    if (error) throw new Error(`Supabase shop update error: ${error.message}`);
    return data;
  }

  async getPeriodData({ startDate, endDate, departmentCode }) {
    await this.ensureSeededIfEmpty();
    let employeeIds = null;
    const employees = await this.getEmployees();

    if (departmentCode && departmentCode !== 'all') {
      employeeIds = employees
        .filter((e) => e.department_code === departmentCode || e.department_id === departmentCode)
        .map((e) => e.id);
      if (employeeIds.length === 0) {
        return { sales: [], attendance: [], feedback: [], recognitions: [], rewards: [] };
      }
    }

    const applyEmpFilter = (q) => (employeeIds ? q.in('employee_id', employeeIds) : q);

    const [sales, attendance, feedback, recognitions, rewardsRaw] = await Promise.all([
      this.fetchAllPaginated('sales_records', (q) =>
        applyEmpFilter(q.gte('sale_date', startDate).lte('sale_date', endDate)).order('sale_date', { ascending: true })
      ),
      this.fetchAllPaginated('attendance_records', (q) =>
        applyEmpFilter(q.gte('attendance_date', startDate).lte('attendance_date', endDate)).order('attendance_date', { ascending: true })
      ),
      this.fetchAllPaginated('customer_feedback', (q) =>
        applyEmpFilter(q.gte('feedback_date', startDate).lte('feedback_date', endDate)).order('feedback_date', { ascending: false })
      ),
      this.fetchAllPaginated('recognitions', (q) =>
        applyEmpFilter(q.gte('recognition_date', startDate).lte('recognition_date', endDate)).order('recognition_date', { ascending: false })
      ),
      this.fetchAllPaginated('reward_recommendations', (q) =>
        applyEmpFilter(q.gte('period_end', startDate).lte('period_start', endDate)).order('composite_score', { ascending: false })
      ),
    ]);

    const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
    const rewards = rewardsRaw.map((r) => {
      const emp = empMap[r.employee_id] || {};
      return {
        ...r,
        employee_name: emp.full_name || '',
        emp_code: emp.emp_code || '',
        role: emp.role || '',
        avatar_initials: emp.avatar_initials || '',
        avatar_color: emp.avatar_color || '#7C3AED',
        department_name: emp.department_name || '',
        department_code: emp.department_code || '',
      };
    });

    return { sales, attendance, feedback, recognitions, rewards };
  }

  async createRecognition({ employee_id, given_by_name, recognition_type, badge_title, points, message, recognition_date }) {
    const { shop } = await this.getShopAndMeta();
    const row = {
      id: crypto.randomUUID(),
      shop_id: shop.id,
      employee_id,
      given_by_employee_id: null,
      given_by_name,
      recognition_type,
      badge_title,
      points: Number(points) || 25,
      message,
      recognition_date: recognition_date || new Date().toISOString().slice(0, 10),
      status: 'Approved',
    };
    const { data, error } = await this.supabase.from('recognitions').insert(row).select().single();
    if (error) throw new Error(`Supabase insert recognition error: ${error.message}`);
    return data;
  }

  async updateRewardRecommendation(id, { status, reviewedBy }) {
    const { data, error } = await this.supabase
      .from('reward_recommendations')
      .update({
        status,
        reviewed_by: reviewedBy || 'Showroom Owner',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, employees(full_name, emp_code, role, avatar_initials, avatar_color, departments(name))')
      .single();
    if (error) throw new Error(`Supabase reward update error: ${error.message}`);
    const { employees, ...reward } = data;
    return {
      ...reward,
      employee_name: employees?.full_name || '',
      emp_code: employees?.emp_code || '',
      role: employees?.role || '',
      avatar_initials: employees?.avatar_initials || '',
      avatar_color: employees?.avatar_color || '#7C3AED',
      department_name: employees?.departments?.name || '',
    };
  }

  async insertSalesRows(rows) {
    const { shop } = await this.getShopAndMeta();
    const emps = await this.getEmployees();
    const byCode = Object.fromEntries(emps.map((e) => [e.emp_code.toUpperCase(), e]));

    const validRows = [];
    const skipped = [];

    for (const r of rows) {
      const emp = byCode[String(r.emp_code || '').trim().toUpperCase()];
      if (!emp) {
        skipped.push(r.emp_code || 'unknown');
        continue;
      }
      const gross = Number(r.gross_amount_inr || r.net_amount_inr || 0);
      const returns = Number(r.returns_inr || 0);
      const net = Number(r.net_amount_inr ?? Math.max(0, gross - returns));
      validRows.push({
        id: crypto.randomUUID(),
        shop_id: shop.id,
        employee_id: emp.id,
        sale_date: r.sale_date,
        bills_count: Number(r.bills_count || 1),
        items_sold: Number(r.items_sold || 1),
        gross_amount_inr: gross,
        returns_inr: returns,
        net_amount_inr: net,
        upsell_count: Number(r.upsell_count || 0),
        category: r.category || emp.department_name,
      });
    }

    if (validRows.length > 0) {
      const { error } = await this.supabase.from('sales_records').insert(validRows);
      if (error) throw new Error(`Supabase sales insert error: ${error.message}`);
    }

    return { inserted: validRows.length, skipped };
  }

  async resetAndReseed() {
    const dataset = generateSeedDataset();
    const batchUpsert = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await this.supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
        if (error) throw new Error(`Supabase reseed error (${table}): ${error.message}`);
      }
    };
    await batchUpsert('shops', [dataset.shop]);
    await batchUpsert('departments', dataset.departments);
    await batchUpsert('employees', dataset.employees);
    await batchUpsert('sales_records', dataset.sales_records);
    await batchUpsert('attendance_records', dataset.attendance_records);
    await batchUpsert('customer_feedback', dataset.customer_feedback);
    await batchUpsert('recognitions', dataset.recognitions);
    await batchUpsert('reward_recommendations', dataset.reward_recommendations);
    await batchUpsert('scoring_settings', [dataset.scoring_settings]);
    this._seedChecked = true;
    return {
      reset: true,
      employees: dataset.employees.length,
      sales_records: dataset.sales_records.length,
      attendance_records: dataset.attendance_records.length,
    };
  }
}

module.exports = SupabaseRepository;
