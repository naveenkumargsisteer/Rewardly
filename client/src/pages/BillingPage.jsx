import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  LogOut,
  Minus,
  Percent,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api, formatCompactInr, formatDate, formatInr } from '../api/client';
import EmployeeAvatar from '../components/EmployeeAvatar';
import RewardlyLoader from '../components/RewardlyLoader';

export default function BillingPage({ user, onLogout, onSwitchToManager, showToast }) {
  const [initLoading, setInitLoading] = useState(true);
  const [initData, setInitData] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [salesStaff, setSalesStaff] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Search & Catalog Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptCode, setSelectedDeptCode] = useState('all');

  // Active Invoice Form State
  const [invoiceNo, setInvoiceNo] = useState(() => `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [overallDiscountPct, setOverallDiscountPct] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'Cash' | 'UPI' | 'Card'
  const [cashTendered, setCashTendered] = useState('');

  // Custom Item Drawer/Row
  const [customItemName, setCustomItemName] = useState('');
  const [customItemDept, setCustomItemDept] = useState('SILK');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);

  // Completed Invoices Ledger (Session)
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [submittingBill, setSubmittingBill] = useState(false);

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState(null);
  const receiptQrRef = useRef(null);
  const upiQrRef = useRef(null);

  // Load Billing initial data (shop, staff, departments, catalog)
  useEffect(() => {
    setInitLoading(true);
    api
      .getBillingInit()
      .then((data) => {
        setInitData(data);
        setCatalog(data.catalog || []);
        setSalesStaff(data.salesStaff || []);
        setDepartments(data.departments || []);
        // Pre-select first sales consultant
        if (data.salesStaff?.length > 0) {
          const firstSales = data.salesStaff.find((s) => s.emp_code === 'STAFF01' || s.emp_code === 'RW002') || data.salesStaff[0];
          setSelectedStaffId(firstSales.id);
        }
      })
      .catch((err) => {
        showToast?.(err.message || 'Failed to initialize POS terminal.');
      })
      .finally(() => setInitLoading(false));
  }, [showToast]);

  // Filter Catalog
  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (selectedDeptCode !== 'all') {
      list = list.filter((it) => it.dept_code === selectedDeptCode);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.dept_name.toLowerCase().includes(q) ||
          (it.sku && it.sku.toLowerCase().includes(q))
      );
    }
    return list;
  }, [catalog, selectedDeptCode, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.rate) || 0) * (Number(item.qty) || 1), 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (overallDiscountPct <= 0) return 0;
    return Math.round((cartSubtotal * overallDiscountPct) / 100);
  }, [cartSubtotal, overallDiscountPct]);

  const taxableAmount = Math.max(0, cartSubtotal - discountAmount);
  // 5% GST for textiles (2.5% CGST + 2.5% SGST)
  const gstAmount = Math.round(taxableAmount * 0.05);
  const netTotalPayable = taxableAmount + gstAmount;

  // Add catalog item to cart
  function handleAddToCart(item) {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          dept_code: item.dept_code,
          dept_name: item.dept_name,
          rate: item.price_inr,
          qty: 1,
        },
      ];
    });
    showToast?.(`Added "${item.name}" to bill`);
  }

  // Update item quantity
  function handleUpdateQty(id, delta) {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.qty + delta;
            return nextQty > 0 ? { ...i, qty: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  }

  // Remove item
  function handleRemoveItem(id) {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Add custom line item
  function handleAddCustomItem(e) {
    e.preventDefault();
    if (!customItemName.trim()) {
      showToast?.('Please enter item name.');
      return;
    }
    const price = Number(customItemPrice);
    if (!price || price <= 0) {
      showToast?.('Please enter a valid price.');
      return;
    }

    const deptObj = departments.find((d) => d.code === customItemDept) || {
      name: 'Custom Fabric',
      code: customItemDept,
    };
    const newItem = {
      id: `custom_${Date.now()}`,
      name: customItemName.trim(),
      dept_code: customItemDept,
      dept_name: deptObj.name,
      rate: price,
      qty: Math.max(1, Number(customItemQty) || 1),
    };

    setCartItems((prev) => [...prev, newItem]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty(1);
    showToast?.(`Added custom line: ${newItem.name}`);
  }

  // 1-Click Quick Demo Invoice generator
  function handlePopulateQuickTestBill() {
    const demoCatalog = catalog[0] || {
      id: 'cat_01',
      name: 'Pure Kanjeevaram Bridal Silk Saree',
      dept_code: 'SILK',
      dept_name: 'Silk & Sarees',
      price_inr: 18500,
    };
    const demoBlouse = catalog[3] || {
      id: 'cat_04',
      name: 'Tussar Handwoven Silk with Blouse',
      dept_code: 'SILK',
      dept_name: 'Silk & Sarees',
      price_inr: 6400,
    };

    setCartItems([
      { id: demoCatalog.id, name: demoCatalog.name, dept_code: demoCatalog.dept_code, dept_name: demoCatalog.dept_name, rate: demoCatalog.price_inr, qty: 1 },
      { id: demoBlouse.id, name: demoBlouse.name, dept_code: demoBlouse.dept_code, dept_name: demoBlouse.dept_name, rate: demoBlouse.price_inr, qty: 1 },
    ]);
    setCustomerName('Ananya Sharma');
    setCustomerPhone('9845012345');
    setOverallDiscountPct(5);
    setPaymentMethod('UPI');
    showToast?.('⚡ Loaded Quick Test Bridal Silk Invoice (₹23,655)');
  }

  // Clear current bill
  function handleClearBill() {
    if (cartItems.length > 0 && !window.confirm('Clear current invoice lines?')) return;
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setOverallDiscountPct(0);
    setCashTendered('');
    setInvoiceNo(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }

  // Complete and Submit Invoice
  async function handleCheckoutInvoice() {
    if (cartItems.length === 0) {
      showToast?.('Please add at least one item to the bill.');
      return;
    }
    if (!selectedStaffId) {
      showToast?.('Please assign the assisted sales staff for sales attribution.');
      return;
    }

    const assignedStaff = salesStaff.find((s) => s.id === selectedStaffId);

    setSubmittingBill(true);
    try {
      const payload = {
        invoice_no: invoiceNo,
        counter_id: 'POS-KVR-01',
        cashier_id: user?.emp_code || 'CASH01',
        cashier_name: user?.full_name || 'Harshvardhan Singh',
        sales_employee_id: selectedStaffId,
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        items: cartItems.map((it) => ({
          name: it.name,
          dept: it.dept_name,
          qty: it.qty,
          rate: it.rate,
          total: it.rate * it.qty,
        })),
        gross_amount: cartSubtotal,
        discount_amount: discountAmount,
        tax_amount: gstAmount,
        net_amount: netTotalPayable,
        payment_method: paymentMethod,
        sale_date: new Date().toISOString().slice(0, 10),
      };

      const res = await api.createBillingInvoice(payload);
      if (res.success && res.invoice) {
        showToast?.(res.message);
        setRecentInvoices((prev) => [res.invoice, ...prev]);
        setActiveReceipt({
          ...res.invoice,
          staffName: assignedStaff?.full_name || res.invoice.sales_employee_name,
          staffCode: assignedStaff?.emp_code || res.invoice.sales_emp_code,
          cgst: Math.round(gstAmount / 2),
          sgst: Math.round(gstAmount / 2),
        });

        // Reset for next customer bill
        setCartItems([]);
        setCustomerName('');
        setCustomerPhone('');
        setOverallDiscountPct(0);
        setCashTendered('');
        setInvoiceNo(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to complete bill.');
    } finally {
      setSubmittingBill(false);
    }
  }

  // Render UPI QR Code inside modal / drawer
  useEffect(() => {
    if (paymentMethod === 'UPI' && upiQrRef.current && netTotalPayable > 0) {
      const upiUrl = `upi://pay?pa=kaveri.silks@icici&pn=Kaveri%20Silks%20Textiles&am=${netTotalPayable}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`;
      QRCode.toCanvas(upiQrRef.current, upiUrl, { width: 140, margin: 1 }, (e) => {
        if (e) console.error(e);
      });
    }
  }, [paymentMethod, netTotalPayable, invoiceNo]);

  // Render Receipt QR code for customer feedback
  useEffect(() => {
    if (activeReceipt && receiptQrRef.current) {
      const staffRef = activeReceipt.staffCode || activeReceipt.sales_emp_code || 'RW002';
      const feedbackUrl = `${window.location.origin}/feedback/${encodeURIComponent(staffRef)}`;
      QRCode.toCanvas(receiptQrRef.current, feedbackUrl, { width: 100, margin: 1 }, (e) => {
        if (e) console.error(e);
      });
    }
  }, [activeReceipt]);

  if (initLoading) {
    return <RewardlyLoader message="Loading POS Terminal & Showroom Catalog..." />;
  }

  const assignedStaffObj = salesStaff.find((s) => s.id === selectedStaffId);

  return (
    <div className="billing-shell">
      {/* Top POS Terminal Navigation Bar */}
      <header className="billing-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand-logo" style={{ cursor: 'default' }}>
            <img src="/rewardly-logo.png" alt="Rewardly" className="brand-logo-img" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 className="billing-title">Showroom POS &amp; Billing Counter</h2>
              <span className="billing-badge">Terminal POS-KVR-01</span>
              <span className="billing-status-dot">🟢 Online • Cloud Sync</span>
            </div>
            <div className="billing-sub">
              Kaveri Silks &amp; Textiles Flagship • Counter #1 Main Silk Floor
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePopulateQuickTestBill}
            title="1-click test invoice to test billing & sales staff credit"
            style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 700 }}
          >
            <Sparkles size={14} color="#d97706" /> ⚡ Quick Test Invoice
          </button>

          {/* Logged in Cashier Profile */}
          <div className="cashier-chip">
            <EmployeeAvatar employee={user} size={30} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
                {user?.full_name || 'Harshvardhan Singh'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Cashier • {user?.emp_code || 'CASH01'}
              </div>
            </div>
          </div>

          {user?.role_category === 'admin' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onSwitchToManager}
              title="Return to Manager Dashboard"
            >
              <Store size={14} /> Admin Dashboard
            </button>
          )}

          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onLogout}
            title="Log Out of POS Terminal"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main POS Split Layout */}
      <div className="billing-main-grid">
        {/* LEFT COLUMN: Catalog, Fast Item Picker & Search */}
        <div className="billing-catalog-column">
          {/* Search & Filter Bar */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <input
                  type="text"
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search saree, fabric, lehenga, sku, code..."
                  style={{ paddingLeft: 36 }}
                />
                <Search
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}
                />
              </div>

              {/* Department filter pills */}
              <div className="catalog-dept-pills">
                <button
                  type="button"
                  className={`dept-pill ${selectedDeptCode === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedDeptCode('all')}
                >
                  All ({catalog.length})
                </button>
                {departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`dept-pill ${selectedDeptCode === d.code ? 'active' : ''}`}
                    onClick={() => setSelectedDeptCode(d.code)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Catalog Grid */}
          <div className="catalog-grid">
            {filteredCatalog.map((item) => (
              <div key={item.id} className="catalog-card" onClick={() => handleAddToCart(item)}>
                <div className="catalog-card-header">
                  <span className="catalog-sku">{item.sku}</span>
                  <span className="catalog-dept-badge">{item.dept_name}</span>
                </div>
                <h4 className="catalog-name">{item.name}</h4>
                <div className="catalog-bottom">
                  <div className="catalog-price">{formatInr(item.price_inr)}</div>
                  <button type="button" className="catalog-add-btn">
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Fabric Entry Strip */}
          <div className="card" style={{ padding: '14px 16px', marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
              <Tag size={15} color="#6d28d9" />
              <span>Custom Fabric / Unlisted Item Quick Entry</span>
            </div>
            <form onSubmit={handleAddCustomItem} className="custom-item-form">
              <input
                type="text"
                className="input"
                placeholder="Item / fabric description (e.g. Georgette cut 4.5m)"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                style={{ flex: '2 1 200px' }}
              />
              <select
                className="select"
                value={customItemDept}
                onChange={(e) => setCustomItemDept(e.target.value)}
                style={{ flex: '1 1 120px' }}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="input"
                placeholder="Price (₹)"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value)}
                style={{ flex: '1 1 100px' }}
                min="1"
              />
              <input
                type="number"
                className="input"
                placeholder="Qty"
                value={customItemQty}
                onChange={(e) => setCustomItemQty(e.target.value)}
                style={{ width: 70 }}
                min="1"
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={14} /> Add Line
              </button>
            </form>
          </div>

          {/* Recent Bills Ledger */}
          {recentInvoices.length > 0 && (
            <div className="card" style={{ padding: '16px 20px', marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  Recent Completed Invoices ({recentInvoices.length})
                </h4>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Total POS Sales: {formatInr(recentInvoices.reduce((a, b) => a + b.net_amount, 0))}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Customer</th>
                      <th>Sales Staff</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Mode</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td><strong>{inv.invoice_no}</strong></td>
                        <td>{inv.customer_name}</td>
                        <td>
                          <span className="brand-badge" style={{ fontSize: 11 }}>
                            {inv.sales_emp_code || 'Staff'} • {inv.sales_employee_name}
                          </span>
                        </td>
                        <td>{inv.items_count} items</td>
                        <td><strong style={{ color: '#059669' }}>{formatInr(inv.net_amount)}</strong></td>
                        <td><span className="status-badge status-Approved">{inv.payment_method}</span></td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => setActiveReceipt(inv)}
                          >
                            <Printer size={12} /> View Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Cart, Staff Attribution & Payment */}
        <div className="billing-cart-column">
          <div className="card billing-cart-card">
            {/* Cart Header */}
            <div className="billing-cart-head">
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  Active Tax Invoice
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <strong>{invoiceNo}</strong> • Date: {formatDate(new Date().toISOString().slice(0, 10))}
                </div>
              </div>
              <button
                type="button"
                className="link-btn"
                style={{ fontSize: 12, color: '#dc2626' }}
                onClick={handleClearBill}
              >
                Clear All
              </button>
            </div>

            {/* Sales Staff Attribution (Crucial for Rewardly!) */}
            <div className="staff-attribution-box">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={14} color="#6d28d9" />
                  <strong>Assisted Sales Staff</strong>
                </span>
                <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600 }}>
                  ★ Credits Performance Score
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                {assignedStaffObj && <EmployeeAvatar employee={assignedStaffObj} size={36} />}
                <select
                  className="select"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{ flex: 1, fontWeight: 600 }}
                  required
                >
                  {salesStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emp_code} — {s.full_name} ({s.department_name})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                This bill's net sales will instantly increment this consultant's composite score and leaderboard rank.
              </div>
            </div>

            {/* Customer Details Strip */}
            <div className="customer-entry-grid">
              <div>
                <label className="field-label" style={{ fontSize: 11 }}>Customer Mobile</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="10-digit mobile"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="field-label" style={{ fontSize: 11 }}>Customer Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Smt. Lakshmi"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            {/* Cart Line Items */}
            <div className="cart-items-container">
              {cartItems.length === 0 ? (
                <div className="cart-empty-state">
                  <ShoppingBag size={36} color="#cbd5e1" />
                  <p style={{ margin: '8px 0 0', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Invoice is empty
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Click items in the catalog or use "⚡ Quick Test Invoice"
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cartItems.map((item) => (
                    <div key={item.id} className="cart-item-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="cart-item-title">{item.name}</div>
                        <div className="cart-item-sub">
                          {formatInr(item.rate)} × {item.qty} • {item.dept_name}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="cart-qty-stepper">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="cart-qty-val">{item.qty}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          onClick={() => handleUpdateQty(item.id, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="cart-item-total">
                        {formatInr(item.rate * item.qty)}
                      </div>

                      <button
                        type="button"
                        className="cart-remove-btn"
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financials & Tax Breakdown */}
            <div className="cart-financials-box">
              <div className="cart-summary-line">
                <span>Items Subtotal ({cartItems.reduce((a, b) => a + b.qty, 0)} items)</span>
                <strong>{formatInr(cartSubtotal)}</strong>
              </div>

              {/* Discount Selector */}
              <div className="cart-summary-line" style={{ alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Percent size={13} color="#6d28d9" /> Showroom Discount
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`discount-chip ${overallDiscountPct === pct ? 'active' : ''}`}
                      onClick={() => setOverallDiscountPct(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                  {discountAmount > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>
                      - {formatInr(discountAmount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="cart-summary-line">
                <span>GST (5% Textile: 2.5% CGST + 2.5% SGST)</span>
                <span>+ {formatInr(gstAmount)}</span>
              </div>

              <div className="cart-net-total-row">
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Net Amount Payable
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>Inclusive of all showroom taxes</div>
                </div>
                <div className="cart-net-amount">{formatInr(netTotalPayable)}</div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginTop: 14 }}>
              <label className="field-label" style={{ fontSize: 12, marginBottom: 8 }}>
                Payment Method
              </label>
              <div className="payment-options-grid">
                <button
                  type="button"
                  className={`payment-option-btn ${paymentMethod === 'UPI' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('UPI')}
                >
                  <QrCode size={16} />
                  <span>UPI / QR</span>
                </button>
                <button
                  type="button"
                  className={`payment-option-btn ${paymentMethod === 'Cash' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('Cash')}
                >
                  <DollarSign size={16} />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  className={`payment-option-btn ${paymentMethod === 'Card' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('Card')}
                >
                  <CreditCard size={16} />
                  <span>POS Card</span>
                </button>
              </div>

              {/* UPI Live QR Drawer */}
              {paymentMethod === 'UPI' && netTotalPayable > 0 && (
                <div className="upi-preview-box">
                  <canvas ref={upiQrRef} style={{ display: 'block', borderRadius: 8 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>
                      Scan &amp; Pay via Any UPI App
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      GPay, PhonePe, Paytm, BHIM • Amount: <strong>{formatInr(netTotalPayable)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash tendered calculator */}
              {paymentMethod === 'Cash' && netTotalPayable > 0 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label" style={{ fontSize: 11 }}>Cash Received (₹)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 25000"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                    />
                  </div>
                  {Number(cashTendered) > netTotalPayable && (
                    <div style={{ flex: 1, padding: '8px 12px', background: '#ecfdf5', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ color: '#065f46', fontWeight: 600 }}>Change Due:</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
                        {formatInr(Number(cashTendered) - netTotalPayable)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Complete Bill CTA */}
            <button
              type="button"
              className="btn btn-primary billing-complete-btn"
              disabled={cartItems.length === 0 || submittingBill}
              onClick={handleCheckoutInvoice}
            >
              <CheckCircle2 size={18} />
              {submittingBill
                ? 'Processing & Crediting Sales Staff...'
                : `Complete Bill (${formatInr(netTotalPayable)})`}
            </button>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <div className="modal-backdrop" onClick={() => setActiveReceipt(null)}>
          <div className="receipt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-modal-header no-print">
              <strong style={{ fontSize: 15 }}>Showroom Tax Invoice Generated</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> Print Receipt
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setActiveReceipt(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Authentic Printable Receipt Body */}
            <div className="receipt-paper">
              <div className="receipt-store-title">KAVERI SILKS &amp; TEXTILES</div>
              <div className="receipt-store-sub">
                Flagship Showroom • Commercial Street &amp; Jayanagar Flagship
                <br />
                Bengaluru - 560001 • GSTIN: 29AABCK1234F1Z5
              </div>

              <div className="receipt-divider-dashed" />

              <div className="receipt-meta-grid">
                <div>
                  <strong>Invoice No:</strong> {activeReceipt.invoice_no}
                  <br />
                  <strong>Date &amp; Time:</strong> {formatDate(activeReceipt.sale_date || new Date().toISOString().slice(0, 10))}
                  <br />
                  <strong>Counter ID:</strong> {activeReceipt.counter_id || 'POS-01'}
                </div>
                <div>
                  <strong>Customer:</strong> {activeReceipt.customer_name}
                  <br />
                  <strong>Cashier:</strong> {activeReceipt.cashier_name}
                  <br />
                  <strong>Sales Consultant:</strong> {activeReceipt.staffName} ({activeReceipt.staffCode})
                </div>
              </div>

              <div className="receipt-divider-dashed" />

              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeReceipt.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        {it.name}
                        <div style={{ fontSize: 10, color: '#666' }}>{it.dept}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{it.qty}</td>
                      <td style={{ textAlign: 'right' }}>{Number(it.rate).toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>{(Number(it.rate) * Number(it.qty)).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-divider-dashed" />

              <div className="receipt-totals-section">
                <div className="receipt-calc-line">
                  <span>Gross Subtotal:</span>
                  <span>₹{Number(activeReceipt.gross_amount).toLocaleString('en-IN')}</span>
                </div>
                {Number(activeReceipt.discount_amount) > 0 && (
                  <div className="receipt-calc-line">
                    <span>Discount:</span>
                    <span>- ₹{Number(activeReceipt.discount_amount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="receipt-calc-line">
                  <span>CGST (2.5%):</span>
                  <span>₹{Math.round(Number(activeReceipt.tax_amount || 0) / 2).toLocaleString('en-IN')}</span>
                </div>
                <div className="receipt-calc-line">
                  <span>SGST (2.5%):</span>
                  <span>₹{Math.round(Number(activeReceipt.tax_amount || 0) / 2).toLocaleString('en-IN')}</span>
                </div>
                <div className="receipt-grand-total">
                  <span>NET TOTAL:</span>
                  <span>₹{Number(activeReceipt.net_amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="receipt-calc-line" style={{ marginTop: 4 }}>
                  <span>Payment Mode:</span>
                  <strong>{activeReceipt.payment_method}</strong>
                </div>
              </div>

              <div className="receipt-divider-dashed" />

              {/* Customer QR feedback on receipt */}
              <div className="receipt-footer-feedback">
                <canvas ref={receiptQrRef} style={{ display: 'block', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: 12 }}>
                  Rate Consultant {activeReceipt.staffName}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>
                  Scan QR with any phone camera to share your showroom shopping feedback!
                </div>
              </div>

              <div className="receipt-footer-brand">
                Thank You for Shopping at Kaveri Silks!
                <br />
                Powered by Rewardly Showroom Retail AI
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
