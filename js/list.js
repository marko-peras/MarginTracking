/* ==========================================================================
   Margin Tracking App — Shared helpers
   ========================================================================== */

function fmtMoney(n) {
  const neg = n < 0;
  const abs = Math.abs(n).toFixed(2);
  let [intp, dec] = abs.split('.');
  intp = intp.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + intp + ',' + dec;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escape text but keep <br> line breaks used in the vehicle name column.
function escapeWithBr(s) {
  return escapeHtml(s).replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ==========================================================================
   Vehicle list view
   ========================================================================== */

const ListView = (() => {
  const COLUMNS = [
    { key: 'vehicle', label: 'Vehicle', html: true },
    { key: 'type', label: 'Type' },
    { key: 'condition', label: 'Condition' },
    { key: 'status', label: 'Status' },
    { key: 'vin', label: 'VIN' },
    { key: 'commission', label: 'Commission' },
    { key: 'body', label: 'Body' },
    { key: 'fuel', label: 'Fuel' },
    { key: 'dateSold', label: 'Date sold' },
    { key: 'seller', label: 'Seller' },
    { key: 'margin', label: 'Margin', num: true, money: true },
    { key: 'expectedPromos', label: 'Expected Promos', num: true, money: true },
    { key: 'effectivePromos', label: 'Effective Promos', num: true, money: true }
  ];

  const state = {
    search: '',
    pageSize: 10,      // 10 | 25 | 50 | 'all'
    page: 1,
    filters: {
      type: '', condition: '', status: '', body: '', fuel: '', seller: '',
      dateFrom: '', dateTo: '', marginFrom: '', marginTo: ''
    },
    sidebarOpen: false
  };

  let onOpenDetail = null;

  function parseGermanDate(s) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s || '').trim());
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1]);
  }

  function rowSearchText(v) {
    return COLUMNS.map(col => {
      if (col.money) return fmtMoney(v[col.key]);
      return String(v[col.key]).replace(/<br\s*\/?>/gi, ' ');
    }).join(' ').toLowerCase();
  }

  function applyFilters(vehicles) {
    const f = state.filters;
    const term = state.search.trim().toLowerCase();
    const from = f.dateFrom ? new Date(f.dateFrom) : null;
    const to = f.dateTo ? new Date(f.dateTo) : null;
    const mFrom = f.marginFrom !== '' ? parseFloat(f.marginFrom) : null;
    const mTo = f.marginTo !== '' ? parseFloat(f.marginTo) : null;

    return vehicles.filter(v => {
      if (term && !rowSearchText(v).includes(term)) return false;
      if (f.type && v.type !== f.type) return false;
      if (f.condition && v.condition !== f.condition) return false;
      if (f.status && v.status !== f.status) return false;
      if (f.body && v.body !== f.body) return false;
      if (f.fuel && v.fuel !== f.fuel) return false;
      if (f.seller && v.seller !== f.seller) return false;
      if (from || to) {
        const d = parseGermanDate(v.dateSold);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (mFrom !== null && v.margin < mFrom) return false;
      if (mTo !== null && v.margin > mTo) return false;
      return true;
    });
  }

  function render(container, openDetailFn) {
    onOpenDetail = openDetailFn;
    const all = Data.getVehicles();
    const filtered = applyFilters(all);
    const total = filtered.length;
    const totalMargin = filtered.reduce((s, v) => s + v.margin, 0);

    const size = state.pageSize === 'all' ? total || 1 : state.pageSize;
    const pageCount = Math.max(1, Math.ceil(total / size));
    if (state.page > pageCount) state.page = pageCount;
    const start = state.pageSize === 'all' ? 0 : (state.page - 1) * size;
    const end = state.pageSize === 'all' ? total : Math.min(start + size, total);
    const pageRows = filtered.slice(start, end);

    container.innerHTML = `
      <div class="layout">
        ${railHtml()}
        <div class="content">
          <div class="topbar">
            <div class="crumbs"><span class="back">&larr; Modules</span> <span class="sep">/</span> Sold vehicles</div>
            <div class="topbar-actions"><button class="kebab">&#8942;</button></div>
          </div>

          <div class="list-toolbar">
            <div class="total-margin">Total margin (${total} vehicles):
              <span class="val">${fmtMoney(totalMargin)}</span>
            </div>
            <div class="toolbar-right">
              <input id="search" class="search-input" type="text" placeholder="Search"
                     value="${escapeHtml(state.search)}" />
              <button id="filter-btn" class="btn">Filter</button>
            </div>
          </div>

          <div class="panel">
            <div class="table-wrap">
              <table class="data">
                <thead><tr>
                  ${COLUMNS.map(c => `<th class="${c.num ? 'num' : ''}">${c.label}</th>`).join('')}
                  <th class="details-col">&#8942;</th>
                </tr></thead>
                <tbody>
                  ${pageRows.length ? pageRows.map(rowHtml).join('') :
                    `<tr><td colspan="${COLUMNS.length + 1}" class="empty">No vehicles match your filters.</td></tr>`}
                </tbody>
              </table>
            </div>
            ${pagerHtml(total, start, end, pageCount)}
          </div>
        </div>
      </div>
      ${sidebarHtml(all)}
      <div id="backdrop" class="backdrop ${state.sidebarOpen ? 'show' : ''}"></div>
    `;

    wire(container);
    if (state.sidebarOpen) {
      container.querySelector('.filter-sidebar').classList.add('open');
    }
  }

  function railHtml() {
    return `<div class="rail">
      <img src="img/sidebar.png" alt="EFD" width="50" height="862">
      </div>`;
    /*
      <div class="rail-logo"></div>
      ${Array.from({ length: 12 }).map((_, i) =>
        `<div class="rail-dot ${i === 4 ? 'active' : ''}"></div>`).join('')}
      </div>`; */
  }

  function rowHtml(v) {
    const cells = COLUMNS.map(c => {
      let val;
      if (c.money) val = fmtMoney(v[c.key]);
      else if (c.html) val = escapeWithBr(v[c.key]);
      else val = escapeHtml(v[c.key]);
      const neg = c.money && v[c.key] < 0 ? ' neg' : '';
      return `<td class="${c.num ? 'num' : ''}${neg}">${val}</td>`;
    }).join('');
    return `<tr>${cells}
      <td class="details-col">
        <button class="icon-btn details-btn" data-commission="${escapeHtml(v.commission)}" title="Details">
          <img src="img/info.png" alt="Details" />
        </button>
      </td></tr>`;
  }

  function pagerHtml(total, start, end, pageCount) {
    const first = total === 0 ? 0 : start + 1;
    return `<div class="pager">
      <div class="range">${first} - ${end} / ${total}</div>
      <div class="pager-center">
        <span>Per page:</span>
        <select id="page-size">
          ${['10', '25', '50', 'all'].map(s =>
            `<option value="${s}" ${String(state.pageSize) === s ? 'selected' : ''}>${s === 'all' ? 'All' : s}</option>`).join('')}
        </select>
        <button class="nav-btn" id="first" ${state.page <= 1 ? 'disabled' : ''} title="First">&laquo;</button>
        <button class="nav-btn" id="prev" ${state.page <= 1 ? 'disabled' : ''} title="Previous">&lsaquo;</button>
        <span class="page-of">${state.page} / ${pageCount}</span>
        <button class="nav-btn" id="next" ${state.page >= pageCount ? 'disabled' : ''} title="Next">&rsaquo;</button>
        <button class="nav-btn" id="last" ${state.page >= pageCount ? 'disabled' : ''} title="Last">&raquo;</button>
      </div>
    </div>`;
  }

  function dropdown(id, label, options, selected) {
    return `<div class="filter-group">
      <label>${label}</label>
      <select id="${id}">
        <option value="">All</option>
        ${options.map(o => `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
      </select>
    </div>`;
  }

  function sidebarHtml(all) {
    const f = state.filters;
    return `<aside class="filter-sidebar">
      <div class="filter-head"><span>Filters</span>
        <button class="modal-close" id="filter-close">&times;</button></div>
      <div class="filter-body">
        ${dropdown('f-type', 'Type', Data.distinct('type'), f.type)}
        ${dropdown('f-condition', 'Condition', Data.distinct('condition'), f.condition)}
        ${dropdown('f-status', 'Status', Data.distinct('status'), f.status)}
        ${dropdown('f-body', 'Body', Data.distinct('body'), f.body)}
        ${dropdown('f-fuel', 'Fuel', Data.distinct('fuel'), f.fuel)}
        ${dropdown('f-seller', 'Seller', Data.distinct('seller'), f.seller)}
        <div class="filter-group">
          <label>Date sold</label>
          <div class="filter-row">
            <div><input type="date" id="f-date-from" value="${f.dateFrom}" /></div>
            <div><input type="date" id="f-date-to" value="${f.dateTo}" /></div>
          </div>
        </div>
        <div class="filter-group">
          <label>Margin</label>
          <div class="filter-row">
            <div><input type="number" id="f-margin-from" placeholder="From" value="${f.marginFrom}" /></div>
            <div><input type="number" id="f-margin-to" placeholder="To" value="${f.marginTo}" /></div>
          </div>
        </div>
      </div>
      <div class="filter-foot">
        <button class="btn" id="filter-clear">Clear</button>
        <button class="btn btn-primary" id="filter-apply">Apply</button>
      </div>
    </aside>`;
  }

  function openSidebar(container) {
    state.sidebarOpen = true;
    container.querySelector('.filter-sidebar').classList.add('open');
    document.getElementById('backdrop').classList.add('show');
  }
  function closeSidebar(container) {
    state.sidebarOpen = false;
    container.querySelector('.filter-sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('show');
  }

  function wire(container) {
    const search = container.querySelector('#search');
    search.addEventListener('input', () => {
      state.search = search.value;
      state.page = 1;
      rerender(container);
      const el = container.querySelector('#search');
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });

    container.querySelector('#filter-btn').addEventListener('click', () => openSidebar(container));
    container.querySelector('#filter-close').addEventListener('click', () => closeSidebar(container));
    container.querySelector('#backdrop').addEventListener('click', () => closeSidebar(container));

    container.querySelector('#filter-apply').addEventListener('click', () => {
      state.filters = {
        type: container.querySelector('#f-type').value,
        condition: container.querySelector('#f-condition').value,
        status: container.querySelector('#f-status').value,
        body: container.querySelector('#f-body').value,
        fuel: container.querySelector('#f-fuel').value,
        seller: container.querySelector('#f-seller').value,
        dateFrom: container.querySelector('#f-date-from').value,
        dateTo: container.querySelector('#f-date-to').value,
        marginFrom: container.querySelector('#f-margin-from').value,
        marginTo: container.querySelector('#f-margin-to').value
      };
      state.page = 1;
      state.sidebarOpen = false;
      rerender(container);
    });

    container.querySelector('#filter-clear').addEventListener('click', () => {
      state.filters = {
        type: '', condition: '', status: '', body: '', fuel: '', seller: '',
        dateFrom: '', dateTo: '', marginFrom: '', marginTo: ''
      };
      state.page = 1;
      rerender(container);
      openSidebar(container);
    });

    const sizeSel = container.querySelector('#page-size');
    sizeSel.addEventListener('change', () => {
      state.pageSize = sizeSel.value === 'all' ? 'all' : parseInt(sizeSel.value, 10);
      state.page = 1;
      rerender(container);
    });

    const nav = (id, fn) => {
      const b = container.querySelector('#' + id);
      if (b) b.addEventListener('click', () => { fn(); rerender(container); });
    };
    nav('first', () => state.page = 1);
    nav('prev', () => state.page = Math.max(1, state.page - 1));
    nav('next', () => state.page += 1);
    nav('last', () => state.page = Number.MAX_SAFE_INTEGER);

    container.querySelectorAll('.details-btn').forEach(btn => {
      btn.addEventListener('click', () => onOpenDetail(btn.dataset.commission));
    });
  }

  function rerender(container) { render(container, onOpenDetail); }

  return { render };
})();
