/* ==========================================================================
   Margin Tracking App — Add / Edit item popup
   ========================================================================== */

const Modal = (() => {
  const overlay = () => document.getElementById('modal-overlay');
  const modalEl = () => document.getElementById('item-modal');

  let mode = 'add';            // 'add' | 'edit'
  let editing = null;
  let onSaved = null;
  let onRemoved = null;
  let escHandler = null;

  function openAdd(commission, categories, savedCb) {
    mode = 'add';
    editing = { commission };
    onSaved = savedCb;
    onRemoved = null;
    build(categories, {
      category: categories[0] || '', type: Data.TYPE_OPTIONS[0],
      title: '', description: '', link: '', amount: '', isExpected: false
    });
  }

  function openEdit(item, categories, savedCb, removedCb) {
    mode = 'edit';
    editing = item;
    onSaved = savedCb;
    onRemoved = removedCb;
    build(categories, {
      category: item.category, type: item.type || Data.TYPE_OPTIONS[0],
      title: item.title, description: item.description || '',
      link: item.link || '', amount: item.amount, isExpected: item.isExpected
    });
  }

  function build(categories, data) {
    const isEdit = mode === 'edit';
    const catOptions = categories.map(c =>
      `<option value="${escapeHtml(c)}" ${c === data.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
    const typeOptions = Data.TYPE_OPTIONS.map(t =>
      `<option value="${escapeHtml(t)}" ${t === data.type ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
    const amountVal = data.amount === '' ? '' :
      (typeof data.amount === 'number' ? fmtMoney(data.amount) : data.amount);

    modalEl().innerHTML = `
      <div class="modal-bar">
        <h2>${isEdit ? 'Edit item' : 'Add item'}</h2>
        <button class="modal-close" id="m-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="field-label">Category*:</label>
          <div class="field">
            <select id="m-category">${catOptions}</select>
            <div class="field-error" id="e-category">Category is required.</div>
          </div>
        </div>
        <div class="form-row">
          <label class="field-label">Type*:</label>
          <div class="field"><select id="m-type">${typeOptions}</select></div>
        </div>
        <div class="form-row">
          <label class="field-label">Title*:</label>
          <div class="field">
            <input type="text" id="m-title" maxlength="100" value="${escapeHtml(data.title)}" />
            <div class="field-error" id="e-title">Title is required.</div>
          </div>
        </div>
        <div class="form-row">
          <label class="field-label">Description:</label>
          <div class="field"><textarea id="m-description" maxlength="255">${escapeHtml(data.description)}</textarea></div>
        </div>
        <div class="form-row">
          <label class="field-label">Link to document:</label>
          <div class="field"><input type="text" id="m-link" maxlength="255" value="${escapeHtml(data.link)}" /></div>
        </div>
        <div class="form-row">
          <label class="field-label">Amount*:</label>
          <div class="field">
            <input type="text" id="m-amount" value="${amountVal}" />
            <div class="field-error" id="e-amount">A valid amount is required.</div>
          </div>
        </div>
        <div class="form-row">
          <label class="field-label"></label>
          <div class="field radio-row">
            <label><input type="radio" name="position" value="expected" ${data.isExpected ? 'checked' : ''} /> Expected position</label>
            <label><input type="radio" name="position" value="effective" ${data.isExpected ? '' : 'checked'} /> Effective position</label>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        ${isEdit ? '<button class="btn btn-danger" id="m-remove">Remove</button>' : ''}
        <span class="spacer"></span>
        <button class="btn btn-grey" id="m-cancel">Cancel</button>
        <button class="btn btn-primary" id="m-save">Save</button>
      </div>
    `;

    overlay().hidden = false;
    wire();
    modalEl().querySelector('#m-title').focus();
  }

  function parseAmount(raw) {
    const s = String(raw).trim().replace(/\s/g, '');
    if (s === '') return NaN;
    // Accept European (1.234,56) and plain (1234.56 / -1234) formats.
    let norm = s;
    if (/,/.test(s) && /\./.test(s)) norm = s.replace(/\./g, '').replace(',', '.');
    else if (/,/.test(s)) norm = s.replace(',', '.');
    const n = parseFloat(norm);
    return isNaN(n) ? NaN : n;
  }

  function collect() {
    const title = modalEl().querySelector('#m-title').value.trim();
    const category = modalEl().querySelector('#m-category').value;
    const amount = parseAmount(modalEl().querySelector('#m-amount').value);
    const isExpected = modalEl().querySelector('input[name="position"]:checked').value === 'expected';
    return {
      commission: editing.commission,
      category,
      type: modalEl().querySelector('#m-type').value,
      title,
      description: modalEl().querySelector('#m-description').value.trim(),
      link: modalEl().querySelector('#m-link').value.trim(),
      amount,
      isExpected
    };
  }

  function validate(d) {
    let ok = true;
    const setErr = (field, show) => {
      const input = modalEl().querySelector('#m-' + field);
      const err = modalEl().querySelector('#e-' + field);
      if (input) input.classList.toggle('invalid', show);
      if (err) err.classList.toggle('show', show);
      if (show) ok = false;
    };
    setErr('category', !d.category);
    setErr('title', !d.title);
    setErr('amount', isNaN(d.amount));
    return ok;
  }

  function save() {
    const d = collect();
    if (!validate(d)) { showToast('Please fix the highlighted fields.', true); return; }
    if (mode === 'add') Data.addItem(d);
    else Data.updateItem(editing.id, d);
    close();
    if (onSaved) onSaved();
  }

  function remove() {
    if (!editing || !editing.id) return;
    Data.removeItem(editing.id);
    close();
    if (onRemoved) onRemoved();
  }

  function close() {
    overlay().hidden = true;
    modalEl().innerHTML = '';
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  }

  function wire() {
    modalEl().querySelector('#m-close').addEventListener('click', close);
    modalEl().querySelector('#m-cancel').addEventListener('click', close);
    modalEl().querySelector('#m-save').addEventListener('click', save);
    const rm = modalEl().querySelector('#m-remove');
    if (rm) rm.addEventListener('click', remove);

    // Click outside the modal closes it (FR-041, FR-051).
    overlay().onclick = e => { if (e.target === overlay()) close(); };

    escHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);
  }

  return { openAdd, openEdit };
})();
