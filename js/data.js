/* ==========================================================================
   Margin Tracking App — Data model, CSV loading & local storage
   ========================================================================== */

const Data = (() => {
  const VEHICLES_KEY = 'mt_vehicles';
  const ITEMS_KEY = 'mt_items';
  const HISTORY_KEY = 'mt_history';

  const TYPE_OPTIONS = [
    'Vehicle Revenue', 'Vehicle Cost', 'Parts revenue',
    'Parts cost', 'Accrual revenue', 'Accrual cost'
  ];

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* ---------- CSV parsing ---------- */
  function splitRows(text) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n').filter(l => l.trim().length > 0);
  }

  function parseVehiclesCsv(text) {
    // Columns: 0 Vehicle,1 Type,2 Condition,3 Status,4 VIN,5 -,6 Commission,
    //          7 -,8 Body,9 Fuel,10 Date sold,11 Seller,12 Margin,
    //          13 Expected Promos,14 Effective Promos
    const rows = splitRows(text);
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i].split(';');
      out.push({
        vehicle: c[0] || '',
        type: c[1] || '',
        condition: c[2] || '',
        status: c[3] || '',
        vin: c[4] || '',
        commission: (c[6] || '').trim(),
        body: c[8] || '',
        fuel: c[9] || '',
        dateSold: (c[10] || '').trim(),
        seller: c[11] || '',
        margin: parseNum(c[12]),
        expectedPromos: parseNum(c[13]),
        effectivePromos: parseNum(c[14])
      });
    }
    return out;
  }

  function parseNum(v) {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  // Parse "[EXPECTED]" and "(manual)" markers out of a raw item title.
  function parseTitle(raw) {
    const isExpected = /\[EXPECTED\]/i.test(raw);
    let t = raw.replace(/\[EXPECTED\]/ig, ' ').replace(/\s+/g, ' ').trim();
    const isManual = /\(manual\)/i.test(t);
    const title = isManual ? t.replace(/\(manual\)/ig, ' ').replace(/\s+/g, ' ').trim() : t;
    return { title, isManual, isExpected };
  }

  function parseVehicleDataCsv(text) {
    // Columns: Commission;Category;Item;Margin
    const rows = splitRows(text);
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i].split(';');
      const commission = (c[0] || '').trim();
      const category = (c[1] || '').trim();
      const parsed = parseTitle(c[2] || '');
      out.push({
        id: uuid(),
        commission,
        category,
        title: parsed.title,
        amount: parseNum(c[3]),
        isManual: parsed.isManual,
        isExpected: parsed.isExpected,
        type: '',
        description: '',
        link: ''
      });
    }
    return out;
  }

  /* ---------- Local storage ---------- */
  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed;
    } catch (e) {
      console.error('Failed reading ' + key, e);
      return null;
    }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  let _vehicles = [];
  let _items = [];
  let _history = {};

  async function fetchText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + path);
    return res.text();
  }

  // Load from local storage; fall back to CSV files on first run (FR-005, FR-020).
  async function init() {
    let vehicles = readJson(VEHICLES_KEY);
    let items = readJson(ITEMS_KEY);

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      vehicles = parseVehiclesCsv(await fetchText('data/Vehicles.csv'));
      writeJson(VEHICLES_KEY, vehicles);
    }
    if (!Array.isArray(items) || items.length === 0) {
      items = parseVehicleDataCsv(await fetchText('data/VehicleData.csv'));
      writeJson(ITEMS_KEY, items);
    }
    _vehicles = vehicles;
    _items = items;
    _history = readJson(HISTORY_KEY) || {};
  }

  /* ---------- Accessors ---------- */
  function getVehicles() { return _vehicles.slice(); }
  function getVehicle(commission) {
    return _vehicles.find(v => v.commission === commission) || null;
  }
  function getItems(commission) {
    return _items.filter(it => it.commission === commission);
  }

  // Distinct categories for a vehicle, preserving first-seen order.
  function getCategories(commission) {
    const seen = [];
    for (const it of _items) {
      if (it.commission === commission && !seen.includes(it.category)) seen.push(it.category);
    }
    return seen;
  }

  function distinct(field) {
    const set = [];
    for (const v of _vehicles) {
      const val = v[field];
      if (val && !set.includes(val)) set.push(val);
    }
    return set;
  }

  function persistItems() { writeJson(ITEMS_KEY, _items); }

  function addItem(data) {
    const item = {
      id: uuid(),
      commission: data.commission,
      category: data.category,
      title: data.title,
      amount: data.amount,
      isManual: true,
      isExpected: !!data.isExpected,
      type: data.type || '',
      description: data.description || '',
      link: data.link || ''
    };
    _items.push(item);
    persistItems();
    logHistory(data.commission, 'Added: ' + data.category + ' - ' + data.title + ' (manual)');
    return item;
  }

  function updateItem(id, data) {
    const it = _items.find(x => x.id === id);
    if (!it) return null;
    it.category = data.category;
    it.title = data.title;
    it.amount = data.amount;
    it.isExpected = !!data.isExpected;
    it.type = data.type || '';
    it.description = data.description || '';
    it.link = data.link || '';
    persistItems();
    logHistory(it.commission, 'Updated: ' + data.category + ' - ' + data.title + ' (manual)');
    return it;
  }

  function removeItem(id) {
    const it = _items.find(x => x.id === id);
    if (!it) return;
    _items = _items.filter(x => x.id !== id);
    persistItems();
    logHistory(it.commission, 'Removed: ' + it.category + ' - ' + it.title + ' (manual)');
  }

  /* ---------- History ---------- */
  function nowStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function getHistory(commission) {
    if (!_history[commission]) {
      // Seed with the required baseline entry (FR-036).
      _history[commission] = [{
        when: '10.08.2026 10:30',
        user: 'John Doe',
        action: 'Added: Bonuses & Promotions - Toyota Used vehicle sale bonus (manual)'
      }];
      writeJson(HISTORY_KEY, _history);
    }
    return _history[commission].slice();
  }

  function logHistory(commission, action) {
    getHistory(commission); // ensure seeded
    _history[commission].unshift({ when: nowStamp(), user: 'John Doe', action });
    writeJson(HISTORY_KEY, _history);
  }

  /* ---------- Margin calculation ---------- */
  function categorySum(commission, category) {
    return getItems(commission)
      .filter(it => it.category === category)
      .reduce((s, it) => s + it.amount, 0);
  }

  function totalMargin(commission) {
    return getItems(commission).reduce((s, it) => s + it.amount, 0);
  }

  function purchasePrice(commission) {
    const it = getItems(commission).find(x =>
      /purchase/i.test(x.category) && /purchase price/i.test(x.title));
    return it ? it.amount : 0;
  }

  function marginPercent(commission) {
    const pp = Math.abs(purchasePrice(commission));
    if (!pp) return 0;
    return (totalMargin(commission) / pp) * 100;
  }

  return {
    init,
    TYPE_OPTIONS,
    getVehicles, getVehicle, getItems, getCategories, distinct,
    addItem, updateItem, removeItem,
    getHistory,
    categorySum, totalMargin, purchasePrice, marginPercent
  };
})();
