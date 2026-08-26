// Vehicle list view
const ListView = (function () {
  const TYPE_OPTIONS = ["Personal", "Commercial"];
  const CONDITION_OPTIONS = ["New", "Demo", "Used", "Day registration"];
  const STATUS_OPTIONS = ["Pipeline", "Stock", "Customer"];
  const BODY_OPTIONS = ["Limousine", "SUV", "Station wagon", "Kombi"];

  let onOpenDetail = null;
  let searchText = "";
  let pageSize = 10;
  let currentPage = 1;
  let selected = new Set();
  let filters = {};

  const el = {};

  function cache() {
    el.body = document.getElementById("vehicle-body");
    el.search = document.getElementById("search");
    el.pageSize = document.getElementById("page-size");
    el.pagerInfo = document.getElementById("pager-info");
    el.pagerPages = document.getElementById("pager-pages");
    el.checkAll = document.getElementById("check-all");
    el.sumCount = document.getElementById("sum-count");
    el.sumExpected = document.getElementById("sum-expected");
    el.sumEffective = document.getElementById("sum-effective");
    el.exportBtn = document.getElementById("export-booking");
    el.exportMargin = document.getElementById("export-margin");
    el.sidebar = document.getElementById("filter-sidebar");
  }

  function fillSelect(id, options, includeAll) {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    if (includeAll) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "All";
      sel.appendChild(o);
    }
    options.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  function unique(key) {
    return Array.from(new Set(Store.getVehicles().map((v) => v[key]).filter(Boolean))).sort();
  }

  function buildFilters() {
    fillSelect("f-type", TYPE_OPTIONS, true);
    fillSelect("f-condition", CONDITION_OPTIONS, true);
    fillSelect("f-status", STATUS_OPTIONS, true);
    fillSelect("f-body", BODY_OPTIONS, true);
    fillSelect("f-fuel", unique("fuel"), true);
    fillSelect("f-seller", unique("seller"), true);
    fillSelect("f-calc", ["Open", "Closed"], true);
  }

  function matchesFilters(v) {
    if (filters.type && v.type !== filters.type) return false;
    if (filters.condition && v.condition !== filters.condition) return false;
    if (filters.status && v.status !== filters.status) return false;
    if (filters.body && v.body !== filters.body) return false;
    if (filters.fuel && v.fuel !== filters.fuel) return false;
    if (filters.seller && v.seller !== filters.seller) return false;
    if (filters.calc && v.calcStatus !== filters.calc) return false;

    if (filters.dateFrom || filters.dateTo) {
      const d = Format.parseDate(v.dateSold);
      if (!d) return false;
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo && d > filters.dateTo) return false;
    }
    if (filters.expFrom != null && v.expectedMargin < filters.expFrom) return false;
    if (filters.expTo != null && v.expectedMargin > filters.expTo) return false;
    if (filters.effFrom != null && v.effectiveMargin < filters.effFrom) return false;
    if (filters.effTo != null && v.effectiveMargin > filters.effTo) return false;
    return true;
  }

  function matchesSearch(v) {
    if (!searchText) return true;
    const hay = [
      v.vehicle.replace(/<br>/g, " "),
      v.type, v.condition, v.status, v.vin, v.commission,
      v.body, v.fuel, v.dateSold, v.seller,
      Format.number(v.expectedMargin), Format.number(v.effectiveMargin),
      v.calcStatus,
    ].join(" ").toLowerCase();
    return hay.includes(searchText.toLowerCase());
  }

  function filtered() {
    return Store.getVehicles().filter((v) => matchesSearch(v) && matchesFilters(v));
  }

  function render() {
    const rows = filtered();

    // summary
    el.sumCount.textContent = rows.length;
    el.sumExpected.textContent = Format.number(rows.reduce((s, v) => s + v.expectedMargin, 0));
    el.sumEffective.textContent = Format.number(rows.reduce((s, v) => s + v.effectiveMargin, 0));

    // paging
    const size = pageSize === "All" ? rows.length || 1 : pageSize;
    const totalPages = Math.max(1, Math.ceil(rows.length / size));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * size;
    const pageRows = rows.slice(start, start + size);

    el.body.innerHTML = "";
    if (pageRows.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "empty-row";
      tr.innerHTML = '<td colspan="15">No vehicles found</td>';
      el.body.appendChild(tr);
    }

    pageRows.forEach((v) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" data-com="${v.commission}" ${selected.has(v.commission) ? "checked" : ""}></td>
        <td class="vehicle-name">${v.vehicle}</td>
        <td>${v.type}</td>
        <td>${v.condition}</td>
        <td>${v.status}</td>
        <td>${v.vin}</td>
        <td>${v.commission}</td>
        <td>${v.body}</td>
        <td>${v.fuel}</td>
        <td>${v.dateSold}</td>
        <td>${v.seller}</td>
        <td class="num">${Format.number(v.expectedMargin)}</td>
        <td class="num">${Format.number(v.effectiveMargin)}</td>
        <td>${v.calcStatus}</td>
        <td class="col-details"><img src="img/info.png" class="details-icon" title="Details" data-com="${v.commission}"></td>`;
      el.body.appendChild(tr);
    });

    // wire row checkboxes
    el.body.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(cb.dataset.com);
        else selected.delete(cb.dataset.com);
        syncSelectionUi(pageRows);
      });
    });
    // wire details icons
    el.body.querySelectorAll(".details-icon").forEach((img) => {
      img.addEventListener("click", () => onOpenDetail && onOpenDetail(img.dataset.com));
    });

    syncSelectionUi(pageRows);

    // pager labels
    const from = rows.length === 0 ? 0 : start + 1;
    const to = Math.min(start + size, rows.length);
    el.pagerInfo.textContent = `${from} - ${to} / ${rows.length}`;
    el.pagerPages.textContent = `${currentPage} / ${totalPages}`;

    document.getElementById("pg-first").disabled = currentPage <= 1;
    document.getElementById("pg-prev").disabled = currentPage <= 1;
    document.getElementById("pg-next").disabled = currentPage >= totalPages;
    document.getElementById("pg-last").disabled = currentPage >= totalPages;
  }

  function syncSelectionUi(pageRows) {
    const allChecked = pageRows.length > 0 && pageRows.every((v) => selected.has(v.commission));
    el.checkAll.checked = allChecked;
    el.exportBtn.disabled = selected.size === 0;
    el.exportMargin.disabled = selected.size === 0;
  }

  function init(openDetail) {
    onOpenDetail = openDetail;
    cache();
    buildFilters();

    el.search.addEventListener("input", () => {
      searchText = el.search.value;
      currentPage = 1;
      render();
    });

    el.pageSize.addEventListener("change", () => {
      pageSize = el.pageSize.value === "All" ? "All" : parseInt(el.pageSize.value, 10);
      currentPage = 1;
      render();
    });

    document.getElementById("pg-first").addEventListener("click", () => { currentPage = 1; render(); });
    document.getElementById("pg-prev").addEventListener("click", () => { currentPage--; render(); });
    document.getElementById("pg-next").addEventListener("click", () => { currentPage++; render(); });
    document.getElementById("pg-last").addEventListener("click", () => { currentPage = 1e9; render(); });

    el.checkAll.addEventListener("change", () => {
      const rows = filtered();
      const size = pageSize === "All" ? rows.length || 1 : pageSize;
      const start = (currentPage - 1) * size;
      const pageRows = rows.slice(start, start + size);
      pageRows.forEach((v) => {
        if (el.checkAll.checked) selected.add(v.commission);
        else selected.delete(v.commission);
      });
      render();
    });

    // Kebab menu
    const kebab = document.getElementById("list-kebab");
    const menu = document.getElementById("list-kebab-menu");
    kebab.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", () => (menu.hidden = true));
    menu.addEventListener("click", (e) => e.stopPropagation());
    el.exportBtn.addEventListener("click", () => {
      if (el.exportBtn.disabled) return;
      document.getElementById("export-link").click();
      menu.hidden = true;
    });
    el.exportMargin.addEventListener("click", () => {
      if (el.exportMargin.disabled) return;
      exportMarginCsv();
      menu.hidden = true;
    });

    // Filter sidebar
    document.getElementById("filter-btn").addEventListener("click", () => (el.sidebar.hidden = false));
    document.getElementById("filter-close").addEventListener("click", () => (el.sidebar.hidden = true));
    document.getElementById("filter-apply").addEventListener("click", applyFilters);
    document.getElementById("filter-clear").addEventListener("click", clearFilters);

    render();
  }

  function num(id) {
    const v = document.getElementById(id).value;
    return v === "" ? null : parseFloat(v);
  }

  // Export selected rows as margin.csv
  function exportMarginCsv() {
    const cols = [
      "Vehicle", "Type", "Condition", "Status", "VIN", "Commission", "Body",
      "Fuel", "Date sold", "Seller", "Expected Margin", "Effective Margin", "Calculation Status",
    ];
    const rows = Store.getVehicles().filter((v) => selected.has(v.commission));
    const lines = [cols.join(";")];
    rows.forEach((v) => {
      lines.push([
        v.vehicle.replace(/<br>/g, " "),
        v.type, v.condition, v.status, v.vin, v.commission, v.body,
        v.fuel, v.dateSold, v.seller,
        v.expectedMargin.toFixed(2), v.effectiveMargin.toFixed(2), v.calcStatus,
      ].join(";"));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "margin.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function applyFilters() {
    filters = {
      type: document.getElementById("f-type").value,
      condition: document.getElementById("f-condition").value,
      status: document.getElementById("f-status").value,
      body: document.getElementById("f-body").value,
      fuel: document.getElementById("f-fuel").value,
      seller: document.getElementById("f-seller").value,
      calc: document.getElementById("f-calc").value,
      dateFrom: document.getElementById("f-date-from").value ? new Date(document.getElementById("f-date-from").value) : null,
      dateTo: document.getElementById("f-date-to").value ? new Date(document.getElementById("f-date-to").value) : null,
      expFrom: num("f-exp-from"),
      expTo: num("f-exp-to"),
      effFrom: num("f-eff-from"),
      effTo: num("f-eff-to"),
    };
    currentPage = 1;
    el.sidebar.hidden = true;
    render();
  }

  function clearFilters() {
    ["f-type", "f-condition", "f-status", "f-body", "f-fuel", "f-seller", "f-calc",
      "f-date-from", "f-date-to", "f-exp-from", "f-exp-to", "f-eff-from", "f-eff-to"]
      .forEach((id) => (document.getElementById(id).value = ""));
    filters = {};
    currentPage = 1;
    render();
  }

  function refresh() {
    render();
  }

  return { init, refresh };
})();
