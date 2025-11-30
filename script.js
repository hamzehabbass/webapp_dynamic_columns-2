/* script.js - corrected full file
   - Admin hidden until unlock (Settings button)
   - Drivers are separate list
   - Add Truck = Plate only
   - Shift tables always visible
   - Destinations & Driver dropdowns in shift tables
*/

/* ====== STORAGE KEYS & STATE ====== */
const KEYS = {
  COLUMNS: 'manifest_columns_v1',
  FLEET: 'manifest_fleet_v1',
  DRIVERS: 'manifest_drivers_v1',
  STATUS_OPTIONS: 'manifest_status_v1',
  DEST: 'manifest_dest_v1',
  TODAY: 'manifest_today_v1',
  ARCHIVE: 'manifest_archive_v1',
  LAST_DATE: 'manifest_lastdate_v1',
  ADMIN_PW: 'manifest_adminpw_v1'
};

let columns = [];
let truckFleet = []; // { plate, driver (optional) }
let drivers = [];   // array of driver names
let statusOptions = {};
let destinations = [];
let dailyManifest = { morning: [], midday: [], evening: [] };
let archives = {};

let currentChooserRow = null;

/* ====== Utility ====== */
function uid(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function getToday() { return new Date().toISOString().slice(0, 10); }

/* ====== Load/Save ====== */
async function loadAll() {
  const res = await fetch("https://srv-d4m3qjruibrs738bib80/api/data/load");
  const d = await res.json();

  columns = d.columns;
  truckFleet = d.fleet;
  drivers = d.drivers;
  statusOptions = d.statusOptions;
  destinations = d.destinations;
  dailyManifest = d.dailyManifest;
}


async function saveAll() {
  await fetch("https://srv-d4m3qjruibrs738bib80/api/data/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fleet: truckFleet,
      drivers,
      columns,
      statusOptions,
      destinations,
      dailyManifest
    })
  });
}


/* ====== Initialization ====== */
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  setTodayLabel();
  setupPasswordModal();
  wireUI();
  checkDailyReset();

  // Always render user-visible parts (shifts/summary/archive) even if admin locked
  initShiftTables();
  renderSummary();
  renderArchives();
});

/* ====== Today label ====== */
function setTodayLabel() { document.getElementById('today-label').textContent = `Today: ${getToday()}`; }

/* ====== Password modal & unlock logic ====== */
function setupPasswordModal() {
  document.getElementById('pw-submit').addEventListener('click', () => {
    const attempt = document.getElementById('admin-password-input').value || '';
    const pw = localStorage.getItem(KEYS.ADMIN_PW) || 'admin123';
    const err = document.getElementById('pw-error');

    if (attempt === pw) {
      err.classList.add('d-none');

      // Show Admin tab and admin content
      const adminTabBtn = document.getElementById('admin-tab');
      adminTabBtn.classList.remove('d-none');

      const adminPane = document.getElementById('admin');
      adminPane.hidden = false;

      // hide modal
      bootstrap.Modal.getInstance(document.getElementById('pwModal')).hide();

      // render admin UI
      postUnlockInit();

      // switch to admin tab
      setTimeout(() => adminTabBtn.click(), 10);
    } else {
      err.classList.remove('d-none');
    }
  });
}

/* called after unlocking */
function postUnlockInit() {
  renderAllAdmin();
}

/* ====== Wire UI ====== */
function wireUI() {
  // SETTINGS → OPEN PASSWORD MODAL
  document.getElementById('settings-btn').addEventListener('click', () => {
    const pwModal = new bootstrap.Modal(document.getElementById('pwModal'));
    // clear previous value / error
    document.getElementById('admin-password-input').value = '';
    document.getElementById('pw-error').classList.add('d-none');
    pwModal.show();
  });

  // Fleet & drivers
  document.getElementById('add-truck-btn').addEventListener('click', addTruck);
  document.getElementById('add-driver-btn').addEventListener('click', addDriver);

  // Destinations
  document.getElementById('add-destination-btn').addEventListener('click', addDestination);

  // Columns manager
  document.getElementById('add-column-btn').addEventListener('click', addColumn);

  // Status options manager
  document.getElementById('add-status-main').addEventListener('click', addStatusMain);
  document.getElementById('add-status-sub').addEventListener('click', addStatusSub);
  document.getElementById('status-main-select-2').addEventListener('change', (e) => fillStatusSubSelect(e.target.value));
  document.getElementById('add-status-subsub').addEventListener('click', addStatusSubSub);

  // change pw
  document.getElementById('change-pw-btn').addEventListener('click', changePassword);
  document.getElementById('clear-all-btn').addEventListener('click', resetAllData);

  // shifts save & reload
  document.getElementById('save-morning').addEventListener('click', () => saveShiftData('morning'));
  document.getElementById('save-midday').addEventListener('click', () => saveShiftData('midday'));
  document.getElementById('save-evening').addEventListener('click', () => saveShiftData('evening'));
  document.getElementById('reload-morning').addEventListener('click', () => renderShiftTable('morning'));
  document.getElementById('reload-midday').addEventListener('click', () => renderShiftTable('midday'));
  document.getElementById('reload-evening').addEventListener('click', () => renderShiftTable('evening'));

  // PDF & Archives
  document.getElementById('download-summary').addEventListener('click', downloadSummaryPdf);
  document.getElementById('select-all-archives').addEventListener('click', () => toggleAllArchives(true));
  document.getElementById('deselect-all-archives').addEventListener('click', () => toggleAllArchives(false));
  document.getElementById('download-selected-archives').addEventListener('click', downloadSelectedArchivePdf);

  // status chooser
  document.getElementById('chooser-apply').addEventListener('click', chooserApply);
  document.getElementById('chooser-clear').addEventListener('click', chooserClear);

  // click outside chooser hides it
  document.addEventListener('click', (e) => {
    const chooser = document.getElementById('status-chooser');
    if (chooser.classList.contains('d-none')) return;
    if (!chooser.contains(e.target) && !e.target.classList.contains('status-btn')) hideChooser();
  });
}

/* ====== Admin: Drivers ====== */
function addDriver() {
  const v = (document.getElementById('driver-name-input').value || '').trim();
  if (!v) return;
  if (!drivers.includes(v)) drivers.push(v);
  document.getElementById('driver-name-input').value = '';
  saveAll();
  renderDrivers();
  // update tables to show new driver in selects
  initShiftTables();
}

function deleteDriver(i) {
  if (!confirm(`Delete driver "${drivers[i]}"?`)) return;
  const name = drivers[i];
  drivers.splice(i, 1);

  // Optionally clear driver references in trucks or shift entries (we'll only remove from arrays)
  // Remove driver from truckFleet assignments if any
  truckFleet = truckFleet.map(t => t.driver === name ? { ...t, driver: '' } : t);

  saveAll();
  renderDrivers();
  renderFleet();
  initShiftTables();
}

function renderDrivers() {
  const tbody = document.getElementById('drivers-table-body');
  tbody.innerHTML = '';
  if (!drivers.length) {
    tbody.innerHTML = `<tr><td class="small text-muted" colspan="2">No drivers yet</td></tr>`;
    return;
  }
  drivers.forEach((d, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(d)}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-i="${i}"><i class="fa fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => deleteDriver(Number(b.getAttribute('data-i')))));
}

/* ====== Admin: Fleet (Plate only) ====== */
function addTruck() {
  const plate = (document.getElementById('new-plate').value || '').trim().toUpperCase();
  if (!plate) { alert('Enter plate'); return; }
  if (truckFleet.some(t => t.plate === plate)) { alert('Truck exists'); return; }
  // assign empty driver initially (drivers managed separately)
  truckFleet.push({ plate, driver: '' });
  saveAll();
  document.getElementById('new-plate').value = '';
  renderFleet();
  initShiftTables();
}

function deleteTruck(index) {
  if (!confirm(`Delete ${truckFleet[index].plate}?`)) return;
  truckFleet.splice(index, 1);
  saveAll();
  renderFleet();
  initShiftTables();
}

function renderFleet() {
  const container = document.getElementById('truck-list');
  container.innerHTML = '';
  if (truckFleet.length === 0) {
    container.innerHTML = `<div class="empty p-2 text-muted small">No trucks yet.</div>`;
    return;
  }
  const table = document.createElement('table');
  table.className = 'table table-sm mb-0';
  table.innerHTML = `<thead class="table-light"><tr><th>Plate</th><th>Driver</th><th style="width:110px">Actions</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  truckFleet.forEach((t, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(t.plate)}</td><td>${escapeHtml(t.driver || '')}</td>
      <td><div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-danger" data-i="${i}"><i class="fa fa-trash"></i></button>
      </div></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  container.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => deleteTruck(Number(b.getAttribute('data-i')))));
}

/* ====== Destinations ====== */
function addDestination() {
  const v = (document.getElementById('new-destination').value || '').trim();
  if (!v) return;
  if (!destinations.includes(v)) destinations.push(v);
  document.getElementById('new-destination').value = '';
  saveAll();
  renderDestinations();
  initShiftTables();
}

function deleteDestination(i) {
  if (!confirm(`Delete ${destinations[i]}?`)) return;
  destinations.splice(i, 1);
  saveAll();
  renderDestinations();
  initShiftTables();
}

function renderDestinations() {
  const c = document.getElementById('dest-list');
  c.innerHTML = '';
  if (!destinations.length) { c.innerHTML = '<div class="small text-muted">No destinations</div>'; return; }
  const ul = document.createElement('ul'); ul.className = 'list-group list-group-flush';
  destinations.forEach((d, i) => {
    const li = document.createElement('li'); li.className = 'list-group-item py-1 d-flex justify-content-between align-items-center';
    li.innerHTML = `<div class="small">${escapeHtml(d)}</div><button class="btn btn-sm btn-outline-danger" data-i="${i}"><i class="fa fa-trash"></i></button>`;
    ul.appendChild(li);
  });
  c.appendChild(ul);
  c.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => deleteDestination(Number(b.getAttribute('data-i')))));
}

/* ====== Column Manager (add/rename/delete/reorder) ====== */
function addColumn() {
  const name = (document.getElementById('col-name').value || '').trim();
  const type = document.getElementById('col-type').value;
  if (!name) return alert('Enter column name');
  const id = uid(name);
  columns.push({ id, label: name, type });
  document.getElementById('col-name').value = '';
  saveAll();
  renderColumnsList();
  initShiftTables();
}

function renameColumn(idx) {
  const newLabel = prompt('Rename column', columns[idx].label);
  if (!newLabel) return;
  columns[idx].label = newLabel;
  saveAll();
  renderColumnsList();
  initShiftTables();
}
function moveColumnUp(idx) {
  if (idx <= 0) return;
  const a = columns.splice(idx, 1)[0];
  columns.splice(idx - 1, 0, a);
  saveAll();
  renderColumnsList();
  initShiftTables();
}
function moveColumnDown(idx) {
  if (idx >= columns.length - 1) return;
  const a = columns.splice(idx, 1)[0];
  columns.splice(idx + 1, 0, a);
  saveAll();
  renderColumnsList();
  initShiftTables();
}
function deleteColumn(idx) {
  if (columns[idx].fixed) return alert('This column cannot be removed.');
  if (!confirm(`Delete column "${columns[idx].label}"? Existing row values for this column will be removed.`)) return;
  const colId = columns[idx].id;
  columns.splice(idx, 1);
  ['morning', 'midday', 'evening'].forEach(shift => {
    dailyManifest[shift] = (dailyManifest[shift] || []).map(r => {
      if (r && r.values) { delete r.values[colId]; }
      return r;
    });
  });
  saveAll();
  renderColumnsList();
  initShiftTables();
}

function renderColumnsList() {
  const container = document.getElementById('columns-list');
  container.innerHTML = '';
  columns.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-2 mb-2';
    row.innerHTML = `
      <div style="flex:1"><strong>${escapeHtml(c.label)}</strong> <div class="small text-muted">${escapeHtml(c.type)}</div></div>
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-secondary" data-action="up" data-i="${i}"><i class="fa fa-arrow-up"></i></button>
        <button class="btn btn-outline-secondary" data-action="down" data-i="${i}"><i class="fa fa-arrow-down"></i></button>
        <button class="btn btn-outline-secondary" data-action="rename" data-i="${i}"><i class="fa fa-pen"></i></button>
        <button class="btn btn-outline-danger" data-action="delete" data-i="${i}"><i class="fa fa-trash"></i></button>
      </div>`;
    container.appendChild(row);
  });
  container.querySelectorAll('button[data-action]').forEach(btn => {
    const act = btn.getAttribute('data-action');
    const idx = Number(btn.getAttribute('data-i'));
    btn.addEventListener('click', () => {
      if (act === 'up') moveColumnUp(idx);
      if (act === 'down') moveColumnDown(idx);
      if (act === 'rename') renameColumn(idx);
      if (act === 'delete') deleteColumn(idx);
    });
  });
}

/* ====== Status Options manager (hierarchical) ====== */
function addStatusMain() {
  const val = (document.getElementById('status-main-input').value || '').trim();
  if (!val) return;
  if (!statusOptions[val]) statusOptions[val] = {};
  document.getElementById('status-main-input').value = '';
  saveAll();
  renderStatusControls();
}
function addStatusSub() {
  const main = document.getElementById('status-main-select').value;
  const sub = (document.getElementById('status-sub-input').value || '').trim();
  if (!main) return alert('Choose main');
  if (!sub) return;
  if (!statusOptions[main]) statusOptions[main] = {};
  if (!statusOptions[main][sub]) statusOptions[main][sub] = [];
  document.getElementById('status-sub-input').value = '';
  saveAll();
  renderStatusControls();
}
function addStatusSubSub() {
  const main = document.getElementById('status-main-select-2').value;
  const sub = document.getElementById('status-sub-select-2').value;
  const subsub = (document.getElementById('status-subsub-input').value || '').trim();
  if (!main || !sub) return alert('Choose main and sub');
  if (!subsub) return;
  const arr = statusOptions[main][sub] || [];
  if (!arr.includes(subsub)) arr.push(subsub);
  statusOptions[main][sub] = arr;
  document.getElementById('status-subsub-input').value = '';
  saveAll();
  renderStatusControls();
}
function deleteStatusMain(main) {
  if (!confirm(`Delete main "${main}" and all children?`)) return;
  delete statusOptions[main];
  saveAll();
  renderStatusControls();
}
function deleteStatusSub(main, sub) {
  if (!confirm(`Delete sub "${sub}" under "${main}"?`)) return;
  delete statusOptions[main][sub];
  saveAll();
  renderStatusControls();
}
function deleteStatusSubSub(main, sub, subsub) {
  if (!confirm(`Delete "${subsub}"?`)) return;
  statusOptions[main][sub] = (statusOptions[main][sub] || []).filter(x => x !== subsub);
  saveAll();
  renderStatusControls();
}

function renderStatusControls() {
  const mainSel = document.getElementById('status-main-select');
  const mainSel2 = document.getElementById('status-main-select-2');
  mainSel.innerHTML = '<option value="">Choose main</option>';
  mainSel2.innerHTML = '<option value="">Choose main</option>';
  Object.keys(statusOptions).forEach(m => {
    mainSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`);
    mainSel2.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`);
  });
  fillStatusSubSelect(document.getElementById('status-main-select-2').value || '');

  const container = document.getElementById('status-list');
  container.innerHTML = '';
  if (!Object.keys(statusOptions).length) { container.innerHTML = '<div class="small text-muted">No status options</div>'; return; }
  Object.entries(statusOptions).forEach(([m, subs]) => {
    let html = `<div class="mb-2"><div class="d-flex justify-content-between"><strong>${escapeHtml(m)}</strong>
      <div><button class="btn btn-sm btn-outline-danger" data-del-main="${escapeHtml(m)}"><i class="fa fa-trash"></i></button></div></div>`;
    html += `<div class="mt-1 ms-2 small text-muted">`;
    if (!Object.keys(subs).length) html += '<div class="text-muted">— no subs —</div>';
    Object.entries(subs).forEach(([s, arr]) => {
      html += `<div class="d-flex justify-content-between align-items-start mb-1"><div><i class="fa fa-angle-right me-1"></i>${escapeHtml(s)}</div>
               <div><button class="btn btn-sm btn-outline-danger" data-del-sub="${escapeHtml(m)}||${escapeHtml(s)}"><i class="fa fa-trash"></i></button></div></div>`;
      if (arr && arr.length) {
        html += `<div class="ms-4 small text-muted">` + arr.map(ss => `
          <div class="d-flex justify-content-between"><div>${escapeHtml(ss)}</div>
            <div><button class="btn btn-sm btn-outline-danger" data-del-subsub="${escapeHtml(m)}||${escapeHtml(s)}||${escapeHtml(ss)}"><i class="fa fa-trash"></i></button></div></div>
        `).join('') + `</div>`;
      }
    });
    html += `</div></div>`;
    container.insertAdjacentHTML('beforeend', html);
  });

  container.querySelectorAll('button[data-del-main]').forEach(b => b.addEventListener('click', () => deleteStatusMain(b.getAttribute('data-del-main'))));
  container.querySelectorAll('button[data-del-sub]').forEach(b => {
    const [m, s] = b.getAttribute('data-del-sub').split('||');
    b.addEventListener('click', () => deleteStatusSub(m, s));
  });
  container.querySelectorAll('button[data-del-subsub]').forEach(b => {
    const [m, s, ss] = b.getAttribute('data-del-subsub').split('||');
    b.addEventListener('click', () => deleteStatusSubSub(m, s, ss));
  });

  if (!document.getElementById('status-chooser').classList.contains('d-none')) populateChooserSelects();
}

function fillStatusSubSelect(main) {
  const subSel = document.getElementById('status-sub-select-2');
  subSel.innerHTML = '<option value="">Choose sub</option>';
  if (!main || !statusOptions[main]) return;
  Object.keys(statusOptions[main]).forEach(s => subSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
}

/* ====== Status chooser (floating) ====== */
function populateChooserSelects() {
  const mainSel = document.getElementById('chooser-main');
  mainSel.innerHTML = '<option value="">— choose main —</option>';
  Object.keys(statusOptions).forEach(m => mainSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`));
  document.getElementById('chooser-main').onchange = (e) => populateChooserSub(e.target.value);
}
function populateChooserSub(main) {
  const subSel = document.getElementById('chooser-sub');
  subSel.innerHTML = '<option value="">— choose sub —</option>';
  if (!main || !statusOptions[main]) return;
  Object.keys(statusOptions[main]).forEach(s => subSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
  subSel.onchange = (e) => populateChooserSubSub(document.getElementById('chooser-main').value, e.target.value);
}
function populateChooserSubSub(main, sub) {
  const ssSel = document.getElementById('chooser-subsub');
  ssSel.innerHTML = '<option value="">— choose sub-sub —</option>';
  if (!main || !sub || !statusOptions[main] || !statusOptions[main][sub]) return;
  statusOptions[main][sub].forEach(ss => ssSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(ss)}">${escapeHtml(ss)}</option>`));
}

function openChooserForRow(row, btn) {
  currentChooserRow = row;
  const chooser = document.getElementById('status-chooser');
  chooser.classList.remove('d-none');
  const rect = btn.getBoundingClientRect();
  chooser.style.left = `${rect.left + window.scrollX}px`;
  chooser.style.top = `${rect.bottom + window.scrollY + 6}px`;
  populateChooserSelects();
  const main = row.dataset.statusMain || '';
  const sub = row.dataset.statusSub || '';
  const subsub = row.dataset.statusSubSub || '';
  document.getElementById('chooser-main').value = main || '';
  populateChooserSub(main || '');
  document.getElementById('chooser-sub').value = sub || '';
  populateChooserSubSub(main || '', sub || '');
  document.getElementById('chooser-subsub').value = subsub || '';
}
function chooserApply() {
  if (!currentChooserRow) return hideChooser();
  const main = document.getElementById('chooser-main').value || '';
  const sub = document.getElementById('chooser-sub').value || '';
  const subsub = document.getElementById('chooser-subsub').value || '';
  currentChooserRow.dataset.statusMain = main;
  currentChooserRow.dataset.statusSub = sub;
  currentChooserRow.dataset.statusSubSub = subsub;
  const lbl = currentChooserRow.querySelector('.status-label');
  const parts = [main, sub, subsub].filter(Boolean);
  lbl.textContent = parts.length ? parts.join(' | ') : 'Select Status';
  hideChooser();
}
function chooserClear() {
  if (!currentChooserRow) return hideChooser();
  currentChooserRow.dataset.statusMain = '';
  currentChooserRow.dataset.statusSub = '';
  currentChooserRow.dataset.statusSubSub = '';
  currentChooserRow.querySelector('.status-label').textContent = 'Select Status';
  hideChooser();
}
function hideChooser() {
  document.getElementById('status-chooser').classList.add('d-none');
  currentChooserRow = null;
}

/* ====== Shift tables rendering ====== */
function initShiftTables() {
  ['morning', 'midday', 'evening'].forEach(s => renderShiftTable(s));
}

function renderShiftTable(shift) {
  const container = document.getElementById(`table-${shift}`);
  container.innerHTML = '';
  if (!truckFleet.length) {
    container.innerHTML = '<div class="p-2 small text-warning">No trucks — add from Admin.</div>';
    return;
  }

  const data = dailyManifest[shift] || [];
  const table = document.createElement('table');
  table.className = 'table table-hover table-sm mb-0';

  // header
  const theadCols = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
  table.innerHTML = `<thead class="table-light"><tr>${theadCols}</tr></thead>`;
  const tbody = document.createElement('tbody');

  truckFleet.forEach((truck) => {
    const existing = data.find(r => r.plate === truck.plate) || { plate: truck.plate, driver: truck.driver || '', values: {}, time: '' };
    existing.values = existing.values || {};
    existing.values['plate'] = truck.plate;
    existing.values['driver'] = existing.values['driver'] || truck.driver || '';

    const tr = document.createElement('tr');

    const cells = columns.map(c => {
      const val = existing.values[c.id] !== undefined ? existing.values[c.id] : (c.id === 'plate' ? truck.plate : (c.id === 'driver' ? truck.driver || '' : ''));

      if (c.type === 'hierarchical') {
        const p = parseStatusString(val || '');
        tr.dataset.statusMain = p.main || '';
        tr.dataset.statusSub = p.sub || '';
        tr.dataset.statusSubSub = p.subSub || '';
        return `
          <td>
            <button class="btn btn-sm btn-outline-primary status-btn" type="button">
              <span class="status-label">${escapeHtml(val || 'Select Status')}</span>
              <i class="fa fa-caret-down ms-1"></i>
            </button>
          </td>`;
      }

      // DRIVER column -> select populated from drivers array (managed in Admin)
      if (c.id === 'driver') {
        return `
          <td>
            <select class="form-select form-select-sm col-input" data-col="driver">
              <option value=""></option>
              ${drivers.map(d => `<option value="${escapeHtml(d)}" ${d === val ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
            </select>
          </td>`;
      }

      // DESTINATION column -> select populated from destinations (admin)
      if (c.id === 'destination') {
        return `
          <td>
            <select class="form-select form-select-sm col-input" data-col="destination">
              <option value=""></option>
              ${destinations.map(d => `<option value="${escapeHtml(d)}" ${d === val ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
            </select>
          </td>`;
      }

      if (c.type === 'date') {
        return `<td><input class="form-control form-control-sm col-input" data-col="${c.id}" type="date" value="${escapeHtml(val || '')}"></td>`;
      }
      if (c.type === 'time') {
        return `<td><input class="form-control form-control-sm col-input" data-col="${c.id}" type="time" value="${escapeHtml(val || '')}"></td>`;
      }
      if (c.type === 'number') {
        return `<td><input class="form-control form-control-sm col-input" data-col="${c.id}" type="number" value="${escapeHtml(val || '')}"></td>`;
      }

      return `<td><input class="form-control form-control-sm col-input" data-col="${c.id}" type="text" value="${escapeHtml(val || '')}"></td>`;
    }).join('');

    tr.innerHTML = cells;
    tr.dataset.plate = truck.plate;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  // wire status chooser buttons
  container.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      openChooserForRow(row, btn);
    });
  });

  // wire inputs (no auto-save required)
  container.querySelectorAll('.col-input').forEach(inp => {
    inp.addEventListener('input', () => { /* user changes tracked on Save */ });
  });
}

/* parse "Main | Sub | Sub" into parts */
function parseStatusString(str) {
  if (!str) return { main: '', sub: '', subSub: '' };
  const parts = str.split('|').map(x => x.trim()).filter(Boolean);
  return { main: parts[0] || '', sub: parts[1] || '', subSub: parts[2] || '' };
}

/* ====== Save shift data ====== */
function saveShiftData(shift) {
  const container = document.getElementById(`table-${shift}`);
  if (!container) return;
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rows = Array.from(container.querySelectorAll('tbody tr'));
  const data = rows.map(row => {
    const plate = row.dataset.plate || row.children[0]?.textContent || '';
    // driver pulled from select/input in the row; fallback to truckFleet assignment
    const driverCell = Array.from(row.children).find(cell => cell.querySelector('[data-col="driver"]'));
    const driver = driverCell ? (driverCell.querySelector('[data-col="driver"]').value || '') : (truckFleet.find(t => t.plate === plate)?.driver || '');
    const values = {};
    columns.forEach((c, idx) => {
      const cell = row.children[idx];
      if (!cell) return;
      if (c.type === 'hierarchical') {
        const main = row.dataset.statusMain || '';
        const sub = row.dataset.statusSub || '';
        const subSub = row.dataset.statusSubSub || '';
        values[c.id] = [main, sub, subSub].filter(Boolean).join(' | ');
      } else {
        const input = cell.querySelector('.col-input');
        values[c.id] = input ? input.value.trim() : (c.id === 'plate' ? plate : (c.id === 'driver' ? driver : ''));
      }
    });
    const hasData = Object.values(values).some(v => v && String(v).trim() !== '');
    return { plate, driver, values, time: hasData ? time : '' };
  });
  dailyManifest[shift] = data;
  saveAll();
  renderSummary();
  alert(`✅ ${shift.toUpperCase()} saved`);
}

/* ====== Summary ====== */
function renderSummary() {
  const container = document.getElementById('summary-content');
  container.innerHTML = '';
  const lastByPlate = {};
  ['morning', 'midday', 'evening'].forEach(shift => {
    (dailyManifest[shift] || []).forEach(r => {
      if (!r || !r.plate) return;
      lastByPlate[r.plate] = r;
    });
  });

  const table = document.createElement('table');
  table.className = 'table table-striped table-bordered';
  const theadHtml = `<thead class="table-dark"><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}<th>Last Time</th></tr></thead>`;
  table.innerHTML = theadHtml;
  const tbody = document.createElement('tbody');
  truckFleet.forEach(t => {
    const r = lastByPlate[t.plate] || { values: {}, time: '' };
    const cellsHtml = columns.map(c => `<td>${escapeHtml(r.values ? (r.values[c.id] || '') : '')}</td>`).join('');
    const rowHtml = `<tr>${cellsHtml}<td class="small text-muted">${escapeHtml(r.time || '-')}</td></tr>`;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

/* ====== Archives & daily reset ====== */
function checkDailyReset() {
  const last = localStorage.getItem(KEYS.LAST_DATE) || '';
  const today = getToday();
  if (last && last !== today) {
    const hasAny = ['morning', 'midday', 'evening'].some(s => (dailyManifest[s] || []).some(r => r && r.values && Object.values(r.values).some(v => v && v.toString().trim() !== '')));
    if (hasAny) {
      archives[last] = { date: last, data: JSON.parse(JSON.stringify(dailyManifest)), columns: JSON.parse(JSON.stringify(columns)) };
    }
    dailyManifest = { morning: [], midday: [], evening: [] };
    saveAll();
  }
  localStorage.setItem(KEYS.LAST_DATE, today);
}

function renderArchives() {
  const container = document.getElementById('archive-list');
  container.innerHTML = '';
  const dates = Object.keys(archives).sort((a, b) => b.localeCompare(a));
  if (!dates.length) { container.innerHTML = '<div class="small text-muted">No archives</div>'; return; }
  dates.forEach(date => {
    const a = archives[date];
    const card = document.createElement('div'); card.className = 'card p-3';
    card.setAttribute('data-date', date);
    let html = `<div class="d-flex justify-content-between align-items-center mb-2">
      <div><input type="checkbox" class="form-check-input me-2 archive-checkbox" data-date="${date}"><strong>Archive: ${escapeHtml(date)}</strong></div></div>`;
    ['morning', 'midday', 'evening'].forEach(shift => {
      const sd = a.data[shift] || [];
      if (!sd.length) return;
      html += `<div class="mb-2"><h6 class="small text-uppercase mb-1">${escapeHtml(shift)}</h6>`;
      html += `<table class="table table-sm table-bordered mb-2"><thead class="table-light"><tr>${(a.columns || columns).map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}<th>Time</th></tr></thead><tbody>`;
      sd.forEach(r => {
        const rowVals = (a.columns || columns).map(c => `<td>${escapeHtml(r.values ? (r.values[c.id] || '') : '')}</td>`).join('');
        html += `<tr>${rowVals}<td>${escapeHtml(r.time || '')}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    });
    card.innerHTML = html;
    container.appendChild(card);
  });
}

function toggleAllArchives(state) {
  document.querySelectorAll('.archive-checkbox').forEach(cb => cb.checked = state);
}

/* ====== PDF functions ====== */
async function downloadSummaryPdf() {
  const el = document.getElementById('summary-content');
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2 });
  const imgData = canvas.toDataURL('PNG');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth() - 20;
  const imgH = (canvas.height * pageW) / canvas.width;
  pdf.addImage(imgData, 'PNG', 10, 10, pageW, imgH);
  pdf.save(`summary_${getToday()}.pdf`);
}
async function downloadSelectedArchivePdf() {
  const checked = Array.from(document.querySelectorAll('.archive-checkbox:checked'));
  if (!checked.length) return alert('Select archives to download');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  let first = true;
  for (const cb of checked) {
    const date = cb.getAttribute('data-date');
    const card = document.querySelector(`.card[data-date="${date}"]`);
    if (!card) continue;
    const canvas = await html2canvas(card, { scale: 2 });
    const imgData = canvas.toDataURL('PNG');
    const pageW = pdf.internal.pageSize.getWidth() - 20;
    const imgH = (canvas.height * pageW) / canvas.width;
    if (!first) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, 10, pageW, imgH);
    first = false;
  }
  pdf.save(`archives_${getToday()}.pdf`);
}

/* ====== Change Password & reset ====== */
function changePassword() {
  const p1 = document.getElementById('change-pw-1').value;
  const p2 = document.getElementById('change-pw-2').value;
  const msg = document.getElementById('change-pw-msg');
  msg.textContent = '';
  if (!p1 || p1 !== p2) { msg.style.color = 'red'; msg.textContent = 'Passwords must match and not be empty'; return; }
  localStorage.setItem(KEYS.ADMIN_PW, p1);
  msg.style.color = 'green'; msg.textContent = 'Password changed';
  document.getElementById('change-pw-1').value = ''; document.getElementById('change-pw-2').value = '';
}

function resetAllData() {
  if (!confirm('Reset ALL app data? This clears localStorage for the app.')) return;
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  location.reload();
}

/* ====== Render initial admin UI after unlock ====== */
function renderAllAdmin() {
  renderFleet();
  renderDrivers();
  renderDestinations();
  renderColumnsList();
  renderStatusControls();
  initShiftTables();
  renderSummary();
  renderArchives();
}

/* ====== Expose helper (not used externally normally) ====== */
function getDriverList() { return drivers.slice(); }

/* ====== End of script ====== */
