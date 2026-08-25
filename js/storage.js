// Data layer: loads CSV files, persists to localStorage, exposes CRUD for items.
const Store = (function () {
  const VEHICLES_KEY = "mt_vehicles";
  const ITEMS_KEY = "mt_items";
  const CATEGORY_ORDER = [
    "Vehicle sale (outgoing invoice)",
    "Vehicle purchase (incoming invoice)",
    "Internal costs",
    "Services",
    "Bonuses & Promotions",
    "Other",
  ];

  let vehicles = [];
  let items = [];
  let nextId = 1;

  function splitCsv(text) {
    return text
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim() !== "");
  }

  async function loadCsv(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.text();
  }

  function parseVehicles(text) {
    const lines = splitCsv(text);
    lines.shift(); // header
    return lines.map((line) => {
      const c = line.split(";");
      return {
        vehicle: c[0] || "",
        type: c[1] || "",
        condition: c[2] || "",
        status: c[3] || "",
        vin: c[4] || "",
        commission: c[6] || "",
        body: c[8] || "",
        fuel: c[9] || "",
        dateSold: c[10] || "",
        seller: c[11] || "",
        expectedMargin: Format.parseAmount(c[12]),
        effectiveMargin: Format.parseAmount(c[13]),
      };
    });
  }

  function parseItems(text) {
    const lines = splitCsv(text);
    lines.shift(); // header
    return lines.map((line) => {
      const c = line.split(";");
      const title = (c[2] || "").trim();
      return {
        id: nextId++,
        commission: (c[0] || "").trim(),
        category: (c[1] || "").trim(),
        title: title,
        description: "",
        docUrl: "",
        itemType: "",
        expected: Format.parseAmount(c[3]),
        effective: Format.parseAmount(c[4]),
        manual: /\(manual\)/i.test(title),
      };
    });
  }

  async function init() {
    const storedVehicles = localStorage.getItem(VEHICLES_KEY);
    const storedItems = localStorage.getItem(ITEMS_KEY);

    if (storedVehicles && storedItems) {
      vehicles = JSON.parse(storedVehicles);
      items = JSON.parse(storedItems);
      nextId = items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
    } else {
      const [vText, iText] = await Promise.all([
        loadCsv("data/Vehicles.csv"),
        loadCsv("data/VehicleData.csv"),
      ]);
      vehicles = parseVehicles(vText);
      items = parseItems(iText);
      persist();
    }
  }

  function persist() {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }

  function getVehicles() {
    return vehicles.slice();
  }

  function getVehicle(commission) {
    return vehicles.find((v) => v.commission === commission) || null;
  }

  function getItems(commission) {
    return items.filter((i) => i.commission === commission);
  }

  // Ordered list of categories for a commission (canonical order first, then any extras).
  function getCategories(commission) {
    const present = new Set(getItems(commission).map((i) => i.category));
    const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
    present.forEach((c) => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    return ordered;
  }

  function allCategories() {
    return CATEGORY_ORDER.slice();
  }

  function addItem(data) {
    const item = Object.assign({ id: nextId++, manual: true }, data);
    items.push(item);
    persist();
    return item;
  }

  function updateItem(id, data) {
    const item = items.find((i) => i.id === id);
    if (item) {
      Object.assign(item, data);
      persist();
    }
    return item;
  }

  function removeItem(id) {
    items = items.filter((i) => i.id !== id);
    persist();
  }

  function getItem(id) {
    return items.find((i) => i.id === id) || null;
  }

  return {
    init,
    getVehicles,
    getVehicle,
    getItems,
    getItem,
    getCategories,
    allCategories,
    addItem,
    updateItem,
    removeItem,
    CATEGORY_ORDER,
  };
})();
