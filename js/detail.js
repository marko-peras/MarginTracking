// Vehicle details view (margin table) + Add/Edit item popup
const DetailView = (function () {
  let commission = null;
  let expandedAll = false;
  const expanded = {}; // category -> bool
  let editingId = null; // null => add mode

  const el = {};

  function cache() {
    el.title = document.getElementById("detail-title");
    el.body = document.getElementById("margin-body");
    el.chevAll = document.getElementById("chev-all");
    // popup
    el.overlay = document.getElementById("item-overlay");
    el.modal = document.getElementById("item-modal");
    el.modalTitle = document.getElementById("item-modal-title");
    el.category = document.getElementById("i-category");
    el.type = document.getElementById("i-type");
    el.iTitle = document.getElementById("i-title");
    el.desc = document.getElementById("i-description");
    el.link = document.getElementById("i-link");
    el.expected = document.getElementById("i-expected");
    el.effective = document.getElementById("i-effective");
    el.error = document.getElementById("item-error");
    el.removeBtn = document.getElementById("item-remove");
  }

  // ----- calculation helpers -----
  function categoryExpectedSum(cat, lines) {
    // Bonuses & Promotions: 0 stays 0. Other categories: fall back to effective when expected is 0.
    if (cat === "Bonuses & Promotions") {
      return lines.reduce((s, l) => s + l.expected, 0);
    }
    return lines.reduce((s, l) => s + (l.expected !== 0 ? l.expected : l.effective), 0);
  }
  function categoryEffectiveSum(lines) {
    return lines.reduce((s, l) => s + l.effective, 0);
  }
  function purchasePrice() {
    const lines = Store.getItems(commission);
    const p = lines.find(
      (l) => /purchase/i.test(l.category) && /purchase price/i.test(l.title)
    );
    if (!p) return 0;
    return p.effective !== 0 ? p.effective : p.expected;
  }

  function render() {
    const vehicle = Store.getVehicle(commission);
    const name = vehicle ? vehicle.vehicle.replace(/<br>/g, " ") : "";
    el.title.innerHTML = `&larr;&nbsp; Modules&nbsp; /&nbsp; Sold vehicles&nbsp; /&nbsp; ${commission} - ${name}`;

    const categories = Store.getCategories(commission);
    el.body.innerHTML = "";

    let totalExpected = 0;
    let totalEffective = 0;

    categories.forEach((cat) => {
      const lines = Store.getItems(commission).filter((l) => l.category === cat);
      const catExp = categoryExpectedSum(cat, lines);
      const catEff = categoryEffectiveSum(lines);
      totalExpected += catExp;
      totalEffective += catEff;

      const isOpen = !!expanded[cat];
      const catRow = document.createElement("tr");
      catRow.className = "cat-row";
      catRow.dataset.cat = cat;
      catRow.innerHTML = `
        <td class="item-col">
          <button class="chev ${isOpen ? "" : "collapsed"}">${isOpen ? "&#9660;" : "&#9654;"}</button>
          <strong>${escapeHtml(cat)}</strong>
        </td>
        <td class="num">${catExp !== catEff ? Format.amountOrBlank(catExp) : ""}</td>
        <td class="num${catExp !== catEff ? " mismatch" : ""}">${Format.amountOrBlank(catEff)}</td>`;
      catRow.addEventListener("click", () => {
        expanded[cat] = !expanded[cat];
        render();
      });
      el.body.appendChild(catRow);

      if (isOpen) {
        lines.forEach((l) => el.body.appendChild(buildLineRow(l)));
      }
    });

    // total row
    const pp = Math.abs(purchasePrice());
    const expPct = pp ? (totalExpected / pp) * 100 : 0;
    const effPct = pp ? (totalEffective / pp) * 100 : 0;
    const totalRow = document.createElement("tr");
    totalRow.className = "total-row";
    totalRow.innerHTML = `
      <td class="item-col">MARGIN:</td>
      <td class="num">${Format.number(totalExpected)} <span class="pct">(${Format.percent(expPct)})</span></td>
      <td class="num">${Format.number(totalEffective)} <span class="pct">(${Format.percent(effPct)})</span></td>`;
    el.body.appendChild(totalRow);
  }

  function buildLineRow(l) {
    const tr = document.createElement("tr");
    tr.className = "line-row" + (l.manual ? " manual" : "");

    const itemCell = document.createElement("td");
    itemCell.className = "item-col line-item";
    const wrap = document.createElement("span");
    wrap.className = "line-item-wrap";

    if (l.manual) {
      const edit = document.createElement("img");
      edit.src = "img/edit.png";
      edit.className = "edit-icon";
      edit.title = "Edit";
      edit.addEventListener("click", (e) => {
        e.stopPropagation();
        openEdit(l.id);
      });
      wrap.appendChild(edit);

      const titleSpan = document.createElement("span");
      titleSpan.className = "item-title-link";
      titleSpan.textContent = l.title;
      titleSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        openEdit(l.id);
      });
      wrap.appendChild(titleSpan);

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "MANUAL";
      wrap.appendChild(tag);

      if (l.docUrl) {
        const doc = document.createElement("a");
        doc.className = "doc-link";
        doc.href = l.docUrl;
        doc.target = "_blank";
        doc.rel = "noopener";
        doc.textContent = "Document";
        wrap.appendChild(doc);
      }
    } else {
      const titleSpan = document.createElement("span");
      titleSpan.textContent = l.title;
      wrap.appendChild(titleSpan);
    }

    itemCell.appendChild(wrap);
    tr.appendChild(itemCell);

    const expCell = document.createElement("td");
    expCell.className = "num";
    expCell.textContent = Format.amountOrBlank(l.expected);
    tr.appendChild(expCell);

    const effCell = document.createElement("td");
    effCell.className = "num";
    effCell.textContent = Format.amountOrBlank(l.effective);
    tr.appendChild(effCell);

    return tr;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  // ----- popup -----
  function fillCategorySelect() {
    el.category.innerHTML = "";
    Store.allCategories().forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      el.category.appendChild(o);
    });
  }

  function openAdd() {
    editingId = null;
    el.modalTitle.textContent = "Add item";
    el.removeBtn.hidden = true;
    fillCategorySelect();
    el.category.value = Store.allCategories()[0];
    el.type.value = "Vehicle Revenue";
    el.iTitle.value = "";
    el.desc.value = "";
    el.link.value = "";
    el.expected.value = "";
    el.effective.value = "";
    el.error.hidden = true;
    el.overlay.hidden = false;
  }

  function openEdit(id) {
    const item = Store.getItem(id);
    if (!item) return;
    editingId = id;
    el.modalTitle.textContent = "Edit item";
    el.removeBtn.hidden = false;
    fillCategorySelect();
    el.category.value = item.category;
    el.type.value = item.itemType || "Vehicle Revenue";
    el.iTitle.value = item.title;
    el.desc.value = item.description || "";
    el.link.value = item.docUrl || "";
    el.expected.value = item.expected ? item.expected : "";
    el.effective.value = item.effective ? item.effective : "";
    el.error.hidden = true;
    el.overlay.hidden = false;
  }

  function closePopup() {
    el.overlay.hidden = true;
    editingId = null;
  }

  function save() {
    const category = el.category.value;
    const title = el.iTitle.value.trim();
    if (!category) {
      showError("Category is required.");
      return;
    }
    if (!title) {
      showError("Title is required.");
      return;
    }
    const data = {
      commission: commission,
      category: category,
      itemType: el.type.value,
      title: title,
      description: el.desc.value.trim(),
      docUrl: el.link.value.trim(),
      expected: el.expected.value === "" ? 0 : parseFloat(el.expected.value),
      effective: el.effective.value === "" ? 0 : parseFloat(el.effective.value),
      manual: true,
    };
    if (editingId == null) {
      Store.addItem(data);
    } else {
      Store.updateItem(editingId, data);
    }
    expanded[category] = true;
    closePopup();
    render();
  }

  function remove() {
    if (editingId != null) {
      Store.removeItem(editingId);
      closePopup();
      render();
    }
  }

  function showError(msg) {
    el.error.textContent = msg;
    el.error.hidden = false;
  }

  function initPopup() {
    document.getElementById("add-new").addEventListener("click", openAdd);
    document.getElementById("item-close").addEventListener("click", closePopup);
    document.getElementById("item-cancel").addEventListener("click", closePopup);
    document.getElementById("item-save").addEventListener("click", save);
    el.removeBtn.addEventListener("click", remove);
    el.overlay.addEventListener("click", (e) => {
      if (e.target === el.overlay) closePopup();
    });

    // history toggle
    const histToggle = document.getElementById("history-toggle");
    const histContent = document.getElementById("history-content");
    const histChev = document.getElementById("chev-history");
    histToggle.addEventListener("click", () => {
      const show = histContent.hidden;
      histContent.hidden = !show;
      histChev.innerHTML = show ? "&#9660;" : "&#9654;";
    });

    // expand/collapse all
    el.chevAll.addEventListener("click", () => {
      expandedAll = !expandedAll;
      Store.getCategories(commission).forEach((c) => (expanded[c] = expandedAll));
      el.chevAll.innerHTML = expandedAll ? "&#9660;" : "&#9654;";
      render();
    });
  }

  let initialized = false;

  function open(com) {
    commission = com;
    if (!initialized) {
      cache();
      initPopup();
      initialized = true;
    }
    // default collapsed
    expandedAll = false;
    el.chevAll.innerHTML = "&#9654;";
    Store.getCategories(commission).forEach((c) => (expanded[c] = false));
    // reset history collapsed
    document.getElementById("history-content").hidden = true;
    document.getElementById("chev-history").innerHTML = "&#9654;";
    render();
  }

  return { open };
})();
