const crypto = require('node:crypto');
const { createSupabaseClient } = require('./supabaseClient');
const { generateSeedDataset } = require('../../scripts/seed-data-generator');
const {
  httpError,
  sanitizeDepartmentPayload,
  sanitizeEmployeePayload,
  sanitizePublicFeedbackPayload,
} = require('../utils/crudValidation');

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

    const [{ data: minRow }, { data: maxRow }, { data: minFbRow }, { data: maxFbRow }] = await Promise.all([
      this.supabase.from('sales_records').select('sale_date').order('sale_date', { ascending: true }).limit(1),
      this.supabase.from('sales_records').select('sale_date').order('sale_date', { ascending: false }).limit(1),
      this.supabase.from('customer_feedback').select('feedback_date').order('feedback_date', { ascending: true }).limit(1),
      this.supabase.from('customer_feedback').select('feedback_date').order('feedback_date', { ascending: false }).limit(1),
    ]);

    const minCandidates = [minRow?.[0]?.sale_date, minFbRow?.[0]?.feedback_date].filter(Boolean).sort();
    const maxCandidates = [maxRow?.[0]?.sale_date, maxFbRow?.[0]?.feedback_date].filter(Boolean).sort();

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
        minDate: minCandidates[0] || '2026-07-12',
        maxDate: maxCandidates[maxCandidates.length - 1] || '2026-11-11',
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

  _formatEmployeeRow(row) {
    const { departments, ...emp } = row;
    return {
      ...emp,
      department_code: departments?.code || '',
      department_name: departments?.name || '',
      department_color: departments?.color_hex || '#7C3AED',
      target_monthly_sales: Number(departments?.target_monthly_sales || 1000000),
    };
  }

  async getEmployees() {
    await this.ensureSeededIfEmpty();
    const { data, error } = await this.supabase
      .from('employees')
      .select('*, departments(code, name, color_hex, target_monthly_sales)')
      .order('emp_code', { ascending: true });
    if (error) throw new Error(`Supabase employees error: ${error.message}`);

    return (data || []).map((row) => this._formatEmployeeRow(row));
  }

  async createDepartment(payload) {
    const { shop } = await this.getShopAndMeta();
    const clean = sanitizeDepartmentPayload(payload, { isUpdate: false });

    const { data: existing } = await this.supabase
      .from('departments')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('code', clean.code)
      .maybeSingle();
    if (existing) {
      throw httpError(409, `Department code "${clean.code}" already exists.`);
    }

    const row = { id: crypto.randomUUID(), shop_id: shop.id, ...clean };
    const { data, error } = await this.supabase
      .from('departments')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(`Supabase department create error: ${error.message}`);
    return data;
  }

  async updateDepartment(id, payload) {
    await this.ensureSeededIfEmpty();
    const { data: current, error: findErr } = await this.supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(`Supabase department lookup error: ${findErr.message}`);
    if (!current) throw httpError(404, 'Department not found.');

    const clean = sanitizeDepartmentPayload(payload, { isUpdate: true });
    if (clean.code && clean.code !== current.code) {
      const { data: dup } = await this.supabase
        .from('departments')
        .select('id')
        .eq('shop_id', current.shop_id)
        .eq('code', clean.code)
        .neq('id', id)
        .maybeSingle();
      if (dup) {
        throw httpError(409, `Department code "${clean.code}" already exists.`);
      }
    }

    if (Object.keys(clean).length === 0) return current;
    const { data, error } = await this.supabase
      .from('departments')
      .update(clean)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Supabase department update error: ${error.message}`);
    return data;
  }

  async deleteDepartment(id) {
    await this.ensureSeededIfEmpty();
    const { data: current, error: findErr } = await this.supabase
      .from('departments')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(`Supabase department lookup error: ${findErr.message}`);
    if (!current) throw httpError(404, 'Department not found.');

    const { count, error: cntErr } = await this.supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', id);
    if (cntErr) throw new Error(`Supabase department check error: ${cntErr.message}`);
    if ((count || 0) > 0) {
      throw httpError(
        409,
        `Cannot delete "${current.name}" while ${count} employee${count === 1 ? ' is' : 's are'} assigned to it. Reassign or delete them first.`
      );
    }

    const { error } = await this.supabase.from('departments').delete().eq('id', id);
    if (error) throw new Error(`Supabase department delete error: ${error.message}`);
    return { deleted: true, id };
  }

  async _requireDepartment(departmentId) {
    const { data: dept, error } = await this.supabase
      .from('departments')
      .select('*')
      .eq('id', departmentId)
      .maybeSingle();
    if (error) throw new Error(`Supabase department lookup error: ${error.message}`);
    if (!dept) throw httpError(400, 'Selected department does not exist.');
    return dept;
  }

  async createEmployee(payload) {
    const { shop } = await this.getShopAndMeta();
    const prelimDeptId = String(payload?.department_id || '').trim();
    if (!prelimDeptId) throw httpError(400, 'Department is required.');
    const dept = await this._requireDepartment(prelimDeptId);

    const clean = sanitizeEmployeePayload(payload, {
      isUpdate: false,
      fallbackColor: dept.color_hex || '#7C3AED',
    });

    const { data: dup } = await this.supabase
      .from('employees')
      .select('id')
      .eq('emp_code', clean.emp_code)
      .maybeSingle();
    if (dup) {
      throw httpError(409, `Employee code "${clean.emp_code}" already exists.`);
    }

    const row = { id: crypto.randomUUID(), shop_id: shop.id, ...clean };
    const { data, error } = await this.supabase
      .from('employees')
      .insert(row)
      .select('*, departments(code, name, color_hex, target_monthly_sales)')
      .single();
    if (error) throw new Error(`Supabase employee create error: ${error.message}`);
    return this._formatEmployeeRow(data);
  }

  async updateEmployee(id, payload) {
    await this.ensureSeededIfEmpty();
    const { data: current, error: findErr } = await this.supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(`Supabase employee lookup error: ${findErr.message}`);
    if (!current) throw httpError(404, 'Employee not found.');

    let fallbackColor = current.avatar_color || '#7C3AED';
    if (payload?.department_id !== undefined && payload.department_id !== current.department_id) {
      const nextDept = await this._requireDepartment(String(payload.department_id).trim());
      fallbackColor = nextDept.color_hex || fallbackColor;
    }

    const clean = sanitizeEmployeePayload(payload, { isUpdate: true, fallbackColor });
    if (clean.emp_code && clean.emp_code !== current.emp_code) {
      const { data: dup } = await this.supabase
        .from('employees')
        .select('id')
        .eq('emp_code', clean.emp_code)
        .neq('id', id)
        .maybeSingle();
      if (dup) {
        throw httpError(409, `Employee code "${clean.emp_code}" already exists.`);
      }
    }

    if (Object.keys(clean).length === 0) {
      const { data } = await this.supabase
        .from('employees')
        .select('*, departments(code, name, color_hex, target_monthly_sales)')
        .eq('id', id)
        .single();
      return this._formatEmployeeRow(data);
    }

    const { data, error } = await this.supabase
      .from('employees')
      .update(clean)
      .eq('id', id)
      .select('*, departments(code, name, color_hex, target_monthly_sales)')
      .single();
    if (error) throw new Error(`Supabase employee update error: ${error.message}`);
    return this._formatEmployeeRow(data);
  }

  async deleteEmployee(id) {
    await this.ensureSeededIfEmpty();
    const { data: current, error: findErr } = await this.supabase
      .from('employees')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(`Supabase employee lookup error: ${findErr.message}`);
    if (!current) throw httpError(404, 'Employee not found.');

    const { error } = await this.supabase.from('employees').delete().eq('id', id);
    if (error) throw new Error(`Supabase employee delete error: ${error.message}`);
    return { deleted: true, id };
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

  async getEmployeePublicTarget(empRef) {
    await this.ensureSeededIfEmpty();
    const ref = String(empRef || '').trim();
    if (!ref) {
      throw httpError(400, 'Employee feedback code is required.');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const baseQuery = this.supabase
      .from('employees')
      .select('id, shop_id, emp_code, full_name, role, avatar_initials, avatar_color, status, departments(name, color_hex)')
      .limit(1);

    const { data: empRows, error: empErr } = isUuid
      ? await baseQuery.eq('id', ref)
      : await baseQuery.ilike('emp_code', ref);

    if (empErr) throw new Error(`Supabase employee lookup error: ${empErr.message}`);
    const emp = empRows?.[0];
    if (!emp) {
      throw httpError(404, 'Employee feedback link not found.');
    }

    const { data: shopRows, error: shopErr } = await this.supabase
      .from('shops')
      .select('id, name, tagline, location, city')
      .eq('id', emp.shop_id)
      .limit(1);
    if (shopErr) throw new Error(`Supabase shop lookup error: ${shopErr.message}`);
    const shop = shopRows?.[0] || null;

    return {
      shop,
      employee: {
        id: emp.id,
        emp_code: emp.emp_code,
        full_name: emp.full_name,
        role: emp.role,
        avatar_initials: emp.avatar_initials,
        avatar_color: emp.avatar_color,
        status: emp.status,
        department_name: emp.departments?.name || '',
        department_color: emp.departments?.color_hex || '#7C3AED',
      },
    };
  }

  async createPublicFeedback(payload) {
    const clean = sanitizePublicFeedbackPayload(payload);
    const target = await this.getEmployeePublicTarget(clean.empRef);

    const row = {
      id: crypto.randomUUID(),
      shop_id: target.shop.id,
      employee_id: target.employee.id,
      feedback_date: clean.feedback_date,
      rating: clean.rating,
      sentiment: clean.sentiment,
      customer_name: clean.customer_name,
      comment: clean.comment,
      channel: clean.channel,
    };

    const { error } = await this.supabase.from('customer_feedback').insert(row);
    if (error) throw new Error(`Supabase feedback insert error: ${error.message}`);

    return {
      ...row,
      employee_name: target.employee.full_name,
      emp_code: target.employee.emp_code,
      department_name: target.employee.department_name,
      shop_name: target.shop.name,
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
