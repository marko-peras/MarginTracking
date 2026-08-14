/* ==========================================================================
   Margin Tracking App — Vehicle details view
   ========================================================================== */

const DetailView = (() => {
  let commission = null;
  let container = null;
  let onBack = null;
  let collapsed = {};        // category -> true when collapsed
  let historyOpen = false;

  function render(cont, comm, backFn) {
    container = cont;
    commission = comm;
    onBack = backFn;
    draw();
  }

  function draw() {
    const v = Data.getVehicle(commission);
    const categories = Data.getCategories(commission);
    const title = v ? `${commission} - ${escapeWithBr(v.vehicle).replace(/<br>/g, ' ')}` : commission;

    // Default all categories collapsed on first draw (FR-026).
    categories.forEach(c => { if (!(c in collapsed)) collapsed[c] = true; });
    const allCollapsed = categories.every(c => collapsed[c]);

    const total = Data.totalMargin(commission);
    const pct = Data.marginPercent(commission);

    container.innerHTML = `
      <div class="layout">
        ${railHtml()}
        <div class="content">
          <div class="topbar">
            <div class="crumbs">
              <span class="back">&larr; Modules</span>
              <span class="sep">/</span><a href="#" id="crumb-list">Sold vehicles</a>
              <span class="sep">/</span>${escapeHtml(title)}
            </div>
            <div class="topbar-actions">
              <button class="btn btn-primary" id="add-new">+ Add new</button>
              <button class="kebab">&#8942;</button>
            </div>
          </div>

          <div class="tabs">
            ${['Info', 'Media', 'Details', 'Publish', 'Appraisal', 'Commission', 'Offers', 'Contracts']
              .map(t => `<span class="tab">${t}</span>`).join('')}
            <span class="tab active">Margin</span>
          </div>

          <div class="panel" style="margin-top:22px;">
            <table class="margin-table">
              <thead>
                <tr>
                  <th><span class="chev header-chev ${allCollapsed ? 'collapsed' : ''}" id="toggle-all">&#9660;</span>Item</th>
                  <th class="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                ${categories.map(cat => categoryHtml(cat)).join('')}
                <tr class="margin-total-row">
                  <td>MARGIN:</td>
                  <td class="num">${fmtMoney(total)}<span class="margin-pct">(${pct.toFixed(2)}%)</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          ${historyHtml()}
        </div>
      </div>
    `;
    wire();
  }

  function railHtml() {
    return `<div class="rail">
      <div class="rail-logo"></div>
      ${Array.from({ length: 12 }).map((_, i) =>
        `<div class="rail-dot ${i === 8 ? 'active' : ''}"></div>`).join('')}
    </div>`;
  }

  function categoryHtml(cat) {
    const items = Data.getItems(commission).filter(it => it.category === cat);
    const sum = Data.categorySum(commission, cat);
    const isCollapsed = collapsed[cat];
    const head = `<tr class="cat-row" data-cat="${escapeHtml(cat)}">
      <td><span class="chev ${isCollapsed ? 'collapsed' : ''}">&#9660;</span>${escapeHtml(cat)}</td>
      <td class="num ${sum < 0 ? 'neg' : ''}">${fmtMoney(sum)}</td>
    </tr>`;
    if (isCollapsed) return head;
    const rows = items.map(itemHtml).join('');
    return head + rows;
  }

  function itemHtml(it) {
    const manual = it.isManual;
    const expected = it.isExpected
      ? '<span class="tag tag-expected">EXPECTED</span>' : '';
    const manualTag = manual ? '<span class="tag tag-manual">Manual</span>' : '';
    const doc = (manual && it.link)
      ? `<a class="doc-link" href="${escapeHtml(it.link)}" target="_blank" rel="noopener">Document</a>` : '';
    const editIcon = manual
      ? `<img class="edit-icon" src="img/edit.png" alt="Edit" data-id="${it.id}" />` : '';
    const titleClass = manual ? 'item-title' : '';
    return `<tr class="item-row ${manual ? 'manual' : ''}">
      <td>${editIcon}<span class="${titleClass}" data-id="${it.id}">${escapeHtml(it.title)}${manual ? ' (manual)' : ''}</span>${manualTag}${expected}${doc}</td>
      <td class="num ${it.amount < 0 ? 'neg' : ''}">${fmtMoney(it.amount)}</td>
    </tr>`;
  }

  function historyHtml() {
    const rows = Data.getHistory(commission);
    return `<div class="history">
      <div class="history-head" id="history-toggle">
        <span class="chev ${historyOpen ? '' : 'collapsed'}">&#9660;</span>History
      </div>
      <div class="history-body ${historyOpen ? '' : 'collapsed'}">
        <table class="history-table">
          <thead><tr><td>Date and time</td><td>User</td><td>Action</td></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td>${escapeHtml(r.when)}</td>
              <td>${escapeHtml(r.user)}</td>
              <td>${escapeHtml(r.action)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function wire() {
    container.querySelector('#crumb-list').addEventListener('click', e => { e.preventDefault(); onBack(); });
    container.querySelector('.crumbs .back').addEventListener('click', onBack);

    container.querySelector('#add-new').addEventListener('click', () => {
      Modal.openAdd(commission, Data.getCategories(commission), () => {
        showToast('Item added');
        draw();
      });
    });

    container.querySelector('#toggle-all').addEventListener('click', () => {
      const cats = Data.getCategories(commission);
      const anyOpen = cats.some(c => !collapsed[c]);
      cats.forEach(c => { collapsed[c] = anyOpen; }); // if any open -> collapse all, else expand all
      draw();
    });

    container.querySelectorAll('.cat-row').forEach(row => {
      row.addEventListener('click', () => {
        const cat = row.dataset.cat;
        collapsed[cat] = !collapsed[cat];
        draw();
      });
    });

    container.querySelectorAll('.edit-icon, .item-title').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.id;
        const item = Data.getItems(commission).find(x => x.id === id);
        if (!item) return;
        Modal.openEdit(item, Data.getCategories(commission),
          () => { showToast('Item updated'); draw(); },
          () => { showToast('Item removed'); draw(); });
      });
    });

    container.querySelector('#history-toggle').addEventListener('click', () => {
      historyOpen = !historyOpen;
      draw();
    });
  }

  return { render };
})();
