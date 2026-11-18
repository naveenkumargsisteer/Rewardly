import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LogOut,
  Minus,
  Pencil,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
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
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const staffSearchRef = useRef(null);

  const [cartItems, setCartItems] = useState([]);
  const [overallDiscountPct, setOverallDiscountPct] = useState(0);
  const [isPaymentDone, setIsPaymentDone] = useState(false);

  // Custom Item Drawer / Direct Line Entry
  const [customItemName, setCustomItemName] = useState('');
  const [customItemDept, setCustomItemDept] = useState('SILK');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);

  // Edit Catalog Item & Edit Cart Line State
  const [editingItem, setEditingItem] = useState(null);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    dept_code: 'SILK',
    price_inr: '',
    sku: '',
    addToCart: true,
  });

  // Completed Invoices Ledger (Session)
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [submittingBill, setSubmittingBill] = useState(false);

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState(null);
  const receiptQrRef = useRef(null);

  // Helper to persist catalog changes to localStorage
  function saveCatalog(nextCatalog) {
    setCatalog(nextCatalog);
    try {
      localStorage.setItem('rewardly_pos_catalog', JSON.stringify(nextCatalog));
    } catch {}
  }

  const isCatalogModified = useMemo(() => {
    try {
      return Boolean(localStorage.getItem('rewardly_pos_catalog'));
    } catch {
      return false;
    }
  }, [catalog]);

  // Close Staff dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (staffSearchRef.current && !staffSearchRef.current.contains(e.target)) {
        setIsStaffDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset payment done state if cart items or discount changes
  useEffect(() => {
    setIsPaymentDone(false);
  }, [cartItems, overallDiscountPct]);

  // Load Billing initial data (shop, staff, departments, catalog)
  useEffect(() => {
    setInitLoading(true);
    api
      .getBillingInit()
      .then((data) => {
        setInitData(data);
        // Load custom persisted catalog if cashier added/edited items
        let initialCatalog = data.catalog || [];
        try {
          const saved = localStorage.getItem('rewardly_pos_catalog');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialCatalog = parsed;
            }
          }
        } catch {}
        setCatalog(initialCatalog);
        setSalesStaff(data.salesStaff || []);
        setDepartments(data.departments || []);
        // Don't add staff by default - keep staff unassigned until cashier selects one
        setSelectedStaffId('');
        setStaffSearchQuery('');
      })
      .catch((err) => {
        showToast?.(err.message || 'Failed to initialize POS terminal.');
      })
      .finally(() => setInitLoading(false));
  }, [showToast]);

  // Matching Staff based on Staff ID or Name search
  const matchingStaff = useMemo(() => {
    if (!staffSearchQuery.trim()) return salesStaff;
    const q = staffSearchQuery.trim().toLowerCase();
    return salesStaff.filter(
      (s) =>
        s.emp_code.toLowerCase().includes(q) ||
        s.full_name.toLowerCase().includes(q) ||
        (s.department_name && s.department_name.toLowerCase().includes(q))
    );
  }, [salesStaff, staffSearchQuery]);

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

  // Add custom line item (Adds to LEFT-SIDE catalog list AND to active bill invoice)
  function handleAddCustomItem(e) {
    e.preventDefault();
    if (!customItemName.trim()) {
      showToast?.('Please enter item / fabric description.');
      return;
    }
    const price = Number(customItemPrice);
    if (!price || price <= 0) {
      showToast?.('Please enter a valid price/rate.');
      return;
    }

    const deptObj = departments.find((d) => d.code === customItemDept) || {
      name: 'Silk & Sarees',
      code: customItemDept || 'SILK',
    };
    const qty = Math.max(1, Number(customItemQty) || 1);
    const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const skuCode = `${deptObj.code || 'ITEM'}-${customItemName.trim().slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`;

    const newCatalogItem = {
      id: newId,
      name: customItemName.trim(),
      dept_code: deptObj.code,
      dept_name: deptObj.name,
      price_inr: price,
      sku: skuCode,
      tax_pct: 5,
      isCustom: true,
    };

    // 1. Add to LEFT-SIDE catalog list (persisted to localStorage)
    const nextCatalog = [newCatalogItem, ...catalog];
    saveCatalog(nextCatalog);

    // 2. Add to active invoice cart
    const newCartItem = {
      id: newId,
      name: newCatalogItem.name,
      dept_code: deptObj.code,
      dept_name: deptObj.name,
      rate: price,
      qty,
      isCustom: true,
    };
    setCartItems((prev) => [...prev, newCartItem]);

    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty(1);
    showToast?.(`Added "${newCatalogItem.name}" to Catalog (left side) & Invoice!`);
  }

  // Create new item from Catalog "+ Add New Item" modal
  function handleCreateCatalogItem(e) {
    e.preventDefault();
    if (!newItemForm.name.trim()) {
      showToast?.('Item name is required.');
      return;
    }
    const price = Math.max(1, Math.round(Number(newItemForm.price_inr) || 0));
    const deptObj = departments.find((d) => d.code === newItemForm.dept_code) || {
      name: 'Silk & Sarees',
      code: 'SILK',
    };
    const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const skuCode = newItemForm.sku.trim() || `${deptObj.code}-${newItemForm.name.trim().slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`;

    const newCatalogItem = {
      id: newId,
      name: newItemForm.name.trim(),
      dept_name: deptObj.name,
      dept_code: deptObj.code,
      price_inr: price,
      sku: skuCode,
      tax_pct: 5,
    };

    saveCatalog([newCatalogItem, ...catalog]);

    if (newItemForm.addToCart) {
      setCartItems((prev) => [
        ...prev,
        {
          id: newId,
          name: newCatalogItem.name,
          dept_name: newCatalogItem.dept_name,
          dept_code: newCatalogItem.dept_code,
          rate: price,
          qty: 1,
        },
      ]);
    }

    setShowAddItemModal(false);
    setNewItemForm({
      name: '',
      dept_code: 'SILK',
      price_inr: '',
      sku: '',
      addToCart: true,
    });
    showToast?.(`Added "${newCatalogItem.name}" to Showroom Catalog (left side)!`);
  }

  // Save changes to an existing catalog item
  function handleSaveEditItem(e) {
    e.preventDefault();
    if (!editingItem?.name?.trim()) {
      showToast?.('Item name is required.');
      return;
    }
    const nextPrice = Math.max(1, Math.round(Number(editingItem.price_inr) || 0));
    const deptObj = departments.find((d) => d.code === editingItem.dept_code) || {
      name: editingItem.dept_name || 'Silk & Sarees',
      code: editingItem.dept_code || 'SILK',
    };

    const updatedCatalog = catalog.map((it) => {
      if (it.id === editingItem.id) {
        return {
          ...it,
          name: editingItem.name.trim(),
          price_inr: nextPrice,
          dept_code: deptObj.code,
          dept_name: deptObj.name,
          sku: editingItem.sku?.trim() || it.sku,
        };
      }
      return it;
    });

    saveCatalog(updatedCatalog);

    // Also update line in active invoice cart if this item was already added
    setCartItems((prev) =>
      prev.map((ci) => {
        if (ci.id === editingItem.id) {
          return {
            ...ci,
            name: editingItem.name.trim(),
            rate: nextPrice,
            dept_name: deptObj.name,
            dept_code: deptObj.code,
          };
        }
        return ci;
      })
    );

    setEditingItem(null);
    showToast?.(`Updated "${editingItem.name.trim()}".`);
  }

  // Delete an item from the catalog list
  function handleDeleteCatalogItem(e, item) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${item.name}" from the showroom catalog list?`)) return;
    const updatedCatalog = catalog.filter((it) => it.id !== item.id);
    saveCatalog(updatedCatalog);
    showToast?.(`Deleted "${item.name}" from catalog.`);
  }

  // Save changes to an active cart line item
  function handleSaveEditCartItem(e) {
    e.preventDefault();
    if (!editingCartItem?.name?.trim()) return;
    const nextRate = Math.max(1, Math.round(Number(editingCartItem.rate) || 0));
    const nextQty = Math.max(1, Number(editingCartItem.qty) || 1);
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.id === editingCartItem.id
          ? { ...ci, name: editingCartItem.name.trim(), rate: nextRate, qty: nextQty }
          : ci
      )
    );
    setEditingCartItem(null);
    showToast?.('Updated cart item line.');
  }

  // Reset catalog back to standard defaults
  function handleRestoreDefaultCatalog() {
    if (!window.confirm('Reset catalog back to standard Kaveri Silks showroom defaults?')) return;
    try {
      localStorage.removeItem('rewardly_pos_catalog');
    } catch {}
    setCatalog(initData?.catalog || []);
    showToast?.('Restored standard showroom catalog.');
  }

  // Clear current bill (resets cart, inputs, and keeps staff unselected)
  function handleClearBill() {
    if (cartItems.length > 0 && !window.confirm('Clear current invoice lines?')) return;
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedStaffId('');
    setStaffSearchQuery('');
    setOverallDiscountPct(0);
    setIsPaymentDone(false);
    setInvoiceNo(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }

  // Complete and Submit Invoice
  async function handleCheckoutInvoice() {
    if (cartItems.length === 0) {
      showToast?.('Please add at least one item to the bill.');
      return;
    }
    if (!selectedStaffId) {
      showToast?.('Please search and select the assisted sales staff for sales attribution.');
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
        payment_method: 'Paid',
        sale_date: new Date().toISOString().slice(0, 10),
      };

      const res = await api.createBillingInvoice(payload);
      if (res.success && res.invoice) {
        showToast?.(res.message);

        // Real-time sync: notify all open dashboard & staff portal tabs immediately
        try {
          window.dispatchEvent(new CustomEvent('rewardly:sale_created', { detail: res.invoice }));
          localStorage.setItem('rewardly:last_sale_timestamp', Date.now().toString());
        } catch {}

        setRecentInvoices((prev) => [res.invoice, ...prev]);
        setActiveReceipt({
          ...res.invoice,
          staffName: assignedStaff?.full_name || res.invoice.sales_employee_name,
          staffCode: assignedStaff?.emp_code || res.invoice.sales_emp_code,
          cgst: Math.round(gstAmount / 2),
          sgst: Math.round(gstAmount / 2),
        });

        // Reset for next customer bill (keep staff unselected by default)
        setCartItems([]);
        setCustomerName('');
        setCustomerPhone('');
        setSelectedStaffId('');
        setStaffSearchQuery('');
        setOverallDiscountPct(0);
        setIsPaymentDone(false);
        setInvoiceNo(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to complete bill.');
    } finally {
      setSubmittingBill(false);
    }
  }

  // Render Receipt QR code for customer feedback (Placed exclusively on bill)
  useEffect(() => {
    if (activeReceipt && receiptQrRef.current) {
      const staffRef = activeReceipt.staffCode || activeReceipt.sales_emp_code || 'RW002';
      const billNo = activeReceipt.invoice_no || activeReceipt.id;
      const feedbackUrl = `${window.location.origin}/feedback/${encodeURIComponent(staffRef)}?bill=${encodeURIComponent(billNo)}`;
      QRCode.toCanvas(
        receiptQrRef.current,
        feedbackUrl,
        {
          width: 120,
          margin: 1,
          color: { dark: '#1e1b4b', light: '#ffffff' },
        },
        (e) => {
          if (e) console.error('Failed to generate receipt QR code', e);
        }
      );
    }
  }, [activeReceipt]);

  if (initLoading) {
    return <RewardlyLoader message="Loading POS Terminal & Showroom Catalog..." />;
  }

  const assignedStaffObj = salesStaff.find((s) => s.id === selectedStaffId);

  return (
    <div className="billing-shell">
      {/* Main POS Split Layout */}
      <div className="billing-main-grid">
        {/* LEFT COLUMN: Catalog, Fast Item Picker & Search */}
        <div className="billing-catalog-column">
          {/* Search & Filter Bar */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 320px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
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

              {/* Action Buttons for Left Side Catalog */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 13px',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setShowAddItemModal(true)}
                  title="Add new article or fabric line to catalog"
                >
                  <Plus size={14} /> Add New Item
                </button>

                {isCatalogModified && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '7px 10px',
                      fontSize: 11.5,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={handleRestoreDefaultCatalog}
                    title="Reset catalog items back to showroom defaults"
                  >
                    <RefreshCw size={12} /> Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Product Catalog Grid */}
          <div className="catalog-grid">
            {filteredCatalog.length === 0 ? (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  padding: 32,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Tag size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                <p style={{ fontWeight: 600, margin: '4px 0' }}>No items found in catalog</p>
                <p style={{ fontSize: 12, margin: '4px 0 14px' }}>
                  {searchQuery ? `No items matching "${searchQuery}"` : 'Your showroom catalog is empty.'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddItemModal(true)}
                >
                  <Plus size={13} /> Add New Item to Catalog
                </button>
              </div>
            ) : (
              filteredCatalog.map((item) => (
                <div key={item.id} className="catalog-card" onClick={() => handleAddToCart(item)}>
                  <div className="catalog-card-header">
                    <span className="catalog-sku">{item.sku}</span>
                    <span className="catalog-dept-badge">{item.dept_name}</span>
                  </div>
                  <h4 className="catalog-name">{item.name}</h4>
                  <div className="catalog-bottom">
                    <div className="catalog-price">{formatInr(item.price_inr)}</div>
                    <div className="catalog-actions-group">
                      <button
                        type="button"
                        className="catalog-action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem({ ...item });
                        }}
                        title={`Edit "${item.name}"`}
                        aria-label="Edit item"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="catalog-action-btn delete-btn"
                        onClick={(e) => handleDeleteCatalogItem(e, item)}
                        title={`Delete "${item.name}"`}
                        aria-label="Delete item"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        type="button"
                        className="catalog-add-btn"
                        title="Add item to bill"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
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

            {/* Sales Staff Attribution: Search & Fill by Staff ID or Name */}
            <div className="staff-attribution-box" ref={staffSearchRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>
                  <Users size={14} color="#6d28d9" />
                  <span>Assisted Sales Staff</span>
                </span>
                <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600 }}>
                  ★ Credits Performance Score
                </span>
              </div>

              {/* Staff ID Search & Auto-Fill Input */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={15} color="#6d28d9" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="input"
                    value={staffSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStaffSearchQuery(val);
                      setIsStaffDropdownOpen(true);
                      const exact = salesStaff.find(
                        (s) => s.emp_code.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (exact) {
                        setSelectedStaffId(exact.id);
                      } else if (!val.trim()) {
                        setSelectedStaffId('');
                      }
                    }}
                    onFocus={() => setIsStaffDropdownOpen(true)}
                    placeholder="Search Staff ID (e.g. RW002, STAFF01) or name..."
                    style={{
                      paddingLeft: 34,
                      paddingRight: staffSearchQuery ? 30 : 10,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      background: '#ffffff',
                    }}
                  />
                  {staffSearchQuery && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setStaffSearchQuery('');
                        setSelectedStaffId('');
                        setIsStaffDropdownOpen(true);
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        color: '#94a3b8',
                        padding: 3,
                      }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Autocomplete suggestions dropdown */}
                {isStaffDropdownOpen && matchingStaff.length > 0 && (
                  <div
                    className="card"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: 220,
                      overflowY: 'auto',
                      zIndex: 40,
                      marginTop: 4,
                      padding: 4,
                      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
                      border: '1px solid #ddd6fe',
                      background: '#ffffff',
                    }}
                  >
                    {matchingStaff.slice(0, 10).map((staff) => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => {
                          setSelectedStaffId(staff.id);
                          setStaffSearchQuery(staff.emp_code);
                          setIsStaffDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          background: selectedStaffId === staff.id ? '#f3e8ff' : 'transparent',
                          borderRadius: 8,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <EmployeeAvatar employee={staff} size={28} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>
                              <span style={{ color: '#6d28d9', marginRight: 6 }}>{staff.emp_code}</span>
                              {staff.full_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {staff.department_name || 'Showroom Floor'}
                            </div>
                          </div>
                        </div>
                        {selectedStaffId === staff.id && (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                            ✓ Selected
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Staff Member Banner */}
              {assignedStaffObj ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #c4b5fd',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <EmployeeAvatar employee={assignedStaffObj} size={34} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1e1b4b' }}>
                        {assignedStaffObj.full_name}
                        <span
                          style={{
                            marginLeft: 8,
                            background: '#ede9fe',
                            color: '#6d28d9',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {assignedStaffObj.emp_code}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {assignedStaffObj.department_name || 'Showroom Floor'} • Assigned Consultant
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                    ✓ Filled
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 11.5, color: '#dc2626' }}>
                  ⚠️ Type or search a Staff ID to attribute this bill.
                </div>
              )}
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

            {/* Quick Add Custom Fabric / Unlisted Item (Directly in Cart) */}
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1e1b4b',
                  }}
                >
                  <Tag size={13} color="#6d28d9" />
                  <span>Custom Fabric / Unlisted Item Entry</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Direct Line Entry</span>
              </div>

              <form
                onSubmit={handleAddCustomItem}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  className="input"
                  placeholder="Item / fabric description (e.g. Silk cut 4.5m)"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  style={{ flex: '2 1 150px', fontSize: 12, padding: '6px 10px' }}
                />
                <select
                  className="select"
                  value={customItemDept}
                  onChange={(e) => setCustomItemDept(e.target.value)}
                  style={{ flex: '1.2 1 110px', fontSize: 12, padding: '6px 8px' }}
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
                  placeholder="Rate (₹)"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  style={{ flex: '1 1 80px', fontSize: 12, padding: '6px 8px' }}
                  min="1"
                />
                <input
                  type="number"
                  className="input"
                  placeholder="Qty"
                  value={customItemQty}
                  onChange={(e) => setCustomItemQty(e.target.value)}
                  style={{ width: 56, fontSize: 12, padding: '6px 4px', textAlign: 'center' }}
                  min="1"
                />
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    background: '#ede9fe',
                    color: '#6d28d9',
                    borderColor: '#ddd6fe',
                    whiteSpace: 'nowrap',
                  }}
                  title="Add custom line to bill"
                >
                  <Plus size={13} /> Add Line
                </button>
              </form>
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
                    Click items in the showroom catalog to add to invoice
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="catalog-action-btn edit-btn"
                          onClick={() => setEditingCartItem({ ...item })}
                          title="Edit line item name or rate"
                          aria-label="Edit item"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className="cart-remove-btn"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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

            {/* Payment Confirmation & Bill Generation */}
            <div style={{ marginTop: 16 }}>
              {!isPaymentDone ? (
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={cartItems.length === 0}
                  onClick={() => {
                    if (cartItems.length === 0) {
                      showToast?.('Please add items to bill before confirming payment.');
                      return;
                    }
                    if (!selectedStaffId) {
                      showToast?.('Please search and fill the assisted sales staff ID first.');
                      return;
                    }
                    setIsPaymentDone(true);
                    showToast?.('Payment confirmed! Click "Generate Bill" to create tax invoice.');
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px 20px',
                    fontSize: 16,
                    fontWeight: 800,
                    borderRadius: 14,
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 6px 18px rgba(5, 150, 105, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: cartItems.length === 0 ? 0.6 : 1,
                  }}
                >
                  <CheckCircle2 size={18} />
                  Payment Done ({formatInr(netTotalPayable)})
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: 10,
                      fontSize: 13,
                      color: '#065f46',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                      <CheckCircle2 size={16} color="#059669" />
                      Payment Received ({formatInr(netTotalPayable)})
                    </span>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setIsPaymentDone(false)}
                      style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}
                    >
                      Undo
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={submittingBill}
                    onClick={handleCheckoutInvoice}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '14px 20px',
                      fontSize: 16,
                      fontWeight: 800,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)',
                      boxShadow: '0 8px 24px rgba(109, 40, 217, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <FileText size={18} />
                    {submittingBill ? 'Generating Bill...' : `Generate Bill (${formatInr(netTotalPayable)})`}
                  </button>
                </div>
              )}
            </div>
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
                  <span>Payment Status:</span>
                  <strong style={{ color: '#059669' }}>PAID</strong>
                </div>
              </div>

              <div className="receipt-divider-dashed" />

              {/* Customer QR feedback on receipt */}
              <div className="receipt-footer-feedback">
                <canvas ref={receiptQrRef} style={{ display: 'block', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1e1b4b' }}>
                  Rate Consultant {activeReceipt.staffName}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  Scan QR with any phone camera to provide direct shopping feedback!
                </div>
                <div style={{ fontSize: 10.5, color: '#6d28d9', marginTop: 2, fontWeight: 700 }}>
                  Staff ID: {activeReceipt.staffCode || activeReceipt.sales_emp_code || 'Staff'}
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

      {/* Edit Catalog Item Modal */}
      {editingItem && (
        <div className="modal-backdrop" onClick={() => setEditingItem(null)}>
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 24,
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pencil size={18} color="#6d28d9" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>
                  Edit Showroom Item
                </h3>
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => setEditingItem(null)}
                style={{ padding: 4, color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="field-label" style={{ fontSize: 11.5 }}>Item / Fabric Description</label>
                <input
                  type="text"
                  className="input"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g. Pure Kanjeevaram Silk Saree"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="field-label" style={{ fontSize: 11.5 }}>Department / Category</label>
                <select
                  className="select"
                  value={editingItem.dept_code}
                  onChange={(e) => setEditingItem({ ...editingItem, dept_code: e.target.value })}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: 11.5 }}>Price / Rate (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingItem.price_inr}
                    onChange={(e) => setEditingItem({ ...editingItem, price_inr: e.target.value })}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: 11.5 }}>SKU / Article Code</label>
                  <input
                    type="text"
                    className="input"
                    value={editingItem.sku || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
                    placeholder="e.g. SILK-KAN-01"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Item to Catalog Modal */}
      {showAddItemModal && (
        <div className="modal-backdrop" onClick={() => setShowAddItemModal(false)}>
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 24,
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} color="#6d28d9" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>
                  Add New Item to Catalog
                </h3>
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => setShowAddItemModal(false)}
                style={{ padding: 4, color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCatalogItem}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="field-label" style={{ fontSize: 11.5 }}>Item / Fabric Description</label>
                <input
                  type="text"
                  className="input"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  placeholder="e.g. Uppada Silk Jamdani Saree"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="field-label" style={{ fontSize: 11.5 }}>Department / Category</label>
                <select
                  className="select"
                  value={newItemForm.dept_code}
                  onChange={(e) => setNewItemForm({ ...newItemForm, dept_code: e.target.value })}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: 11.5 }}>Price / Rate (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={newItemForm.price_inr}
                    onChange={(e) => setNewItemForm({ ...newItemForm, price_inr: e.target.value })}
                    placeholder="e.g. 15000"
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: 11.5 }}>SKU (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={newItemForm.sku}
                    onChange={(e) => setNewItemForm({ ...newItemForm, sku: e.target.value })}
                    placeholder="Auto-generated if blank"
                  />
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  marginBottom: 18,
                  color: '#475569',
                }}
              >
                <input
                  type="checkbox"
                  checked={newItemForm.addToCart}
                  onChange={(e) => setNewItemForm({ ...newItemForm, addToCart: e.target.checked })}
                />
                <span>Also add to active invoice right away</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddItemModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} /> Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Line Item Modal */}
      {editingCartItem && (
        <div className="modal-backdrop" onClick={() => setEditingCartItem(null)}>
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: '100%',
              padding: 24,
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pencil size={17} color="#6d28d9" />
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#1e1b4b' }}>
                  Edit Invoice Line Item
                </h3>
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => setEditingCartItem(null)}
                style={{ padding: 4, color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditCartItem}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="field-label" style={{ fontSize: 11.5 }}>Description</label>
                <input
                  type="text"
                  className="input"
                  value={editingCartItem.name}
                  onChange={(e) => setEditingCartItem({ ...editingCartItem, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: 11.5 }}>Unit Rate (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={editingCartItem.rate}
                    onChange={(e) => setEditingCartItem({ ...editingCartItem, rate: e.target.value })}
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: 11.5 }}>Quantity</label>
                  <input
                    type="number"
                    className="input"
                    value={editingCartItem.qty}
                    onChange={(e) => setEditingCartItem({ ...editingCartItem, qty: e.target.value })}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingCartItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

