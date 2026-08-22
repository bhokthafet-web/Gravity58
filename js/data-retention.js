(function () {
  'use strict';

  const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const WARNING_MS = 30 * 24 * 60 * 60 * 1000;
  const CLOSED = {
    'digital-menu': new Set(['Completed', 'Rejected', 'Payment Rejected', 'Cancelled']),
    refills: new Set(['Delivered', 'Completed', 'Rejected', 'Cancelled']),
    service: new Set(['Expired', 'Rejected', 'Completed', 'Cancelled']),
    pos: null,
  };
  const LABELS = { 'digital-menu': 'Digital Menu', refills: 'Store / Refills', service: 'Service / Advertising', pos: 'POS' };
  const LEGAL_TEXT = 'G58 keeps order and booking history for a maximum of 1 year. A backup warning appears during the final 30 days. Downloading the CSV through this control permanently deletes the backed-up history after password confirmation. Active orders, active bookings and customer login accounts are not deleted. When a product subscription expires, owner-linked customer records receive a 30-day buffer and are then permanently removed.';

  function recordTime(row) {
    const value = row.deliveredAt || row.completedAt || row.cancelledAt || row.rejectedAt || row.expiredAt || row.updatedAt || row.createdAt || row.date || row.$updatedAt || row.$createdAt;
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  function eligibleRows(product, rows) {
    const statuses = CLOSED[product];
    if (!statuses) return Array.isArray(rows) ? rows.slice() : [];
    return (rows || []).filter(row => statuses.has(String(row.status || '')) || (product === 'service' && row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()));
  }
  function csvCell(value) {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }
  function toCsv(rows) {
    if (!rows.length) return '';
    const keys = [...new Set(rows.flatMap(row => Object.keys(row).filter(key => !key.startsWith('$'))))];
    return `${keys.map(csvCell).join(',')}\n${rows.map(row => keys.map(key => csvCell(row[key])).join(',')).join('\n')}\n`;
  }
  function downloadCsv(filename, rows) {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function injectStyles() {
    if (document.getElementById('g58-retention-styles')) return;
    const style = document.createElement('style');
    style.id = 'g58-retention-styles';
    style.textContent = `.g58-retention{margin:24px 0;padding:20px;border:1px solid rgba(249,115,22,.42);border-radius:18px;background:linear-gradient(135deg,rgba(249,115,22,.09),rgba(124,58,237,.06));box-shadow:0 16px 40px rgba(15,23,42,.08)}.g58-retention h2{margin:0 0 8px}.g58-retention p{line-height:1.55}.g58-retention-meta{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.g58-retention-chip{display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(15,23,42,.08);font-weight:700;font-size:12px}.g58-retention-warning{color:#c2410c;font-weight:800}.g58-retention-button{border:0;border-radius:12px;padding:12px 16px;background:#c2410c;color:#fff;font:inherit;font-weight:800;cursor:pointer}.g58-retention-button:disabled{opacity:.45;cursor:not-allowed}.g58-retention-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.76);display:grid;place-items:center;padding:18px}.g58-retention-dialog{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;color:#171717;border-radius:20px;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.4)}.g58-retention-dialog h2{margin-top:0}.g58-retention-dialog label{display:block;margin:14px 0 6px;font-weight:800}.g58-retention-dialog input[type=password],.g58-retention-dialog input[type=text]{width:100%;box-sizing:border-box;padding:12px;border:1px solid #bbb;border-radius:10px;font:inherit;background:#fff;color:#111}.g58-retention-check{display:flex!important;align-items:flex-start;gap:10px;font-weight:600!important}.g58-retention-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}.g58-retention-cancel{border:1px solid #aaa;border-radius:12px;padding:12px 16px;background:#fff;color:#222;font:inherit;font-weight:800;cursor:pointer}.g58-retention-error{margin-top:12px;padding:10px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:700}.g58-retention-success{margin-top:12px;padding:10px;border-radius:10px;background:#dcfce7;color:#166534;font-weight:700}`;
    document.head.appendChild(style);
  }
  function fileName(product) {
    return `g58-${product}-history-${new Date().toISOString().slice(0, 10)}.csv`;
  }
  async function invoke(action, product, password, confirmation) {
    const api = window.Gravity58Ads;
    const functionId = api?.config?.digitalOrderFunctionId;
    if (!api?.executeFunction || !functionId) throw new Error('Secure deletion service is unavailable. No data was deleted.');
    return api.executeFunction(functionId, { action, product, password, confirmation });
  }
  function openDialog(options, rows, host) {
    const label = LABELS[options.product] || options.product;
    const backdrop = document.createElement('div');
    backdrop.className = 'g58-retention-backdrop';
    backdrop.innerHTML = `<section class="g58-retention-dialog" role="dialog" aria-modal="true" aria-labelledby="g58RetentionTitle"><h2 id="g58RetentionTitle">Back up and permanently delete ${label} history</h2><p>A CSV backup will download first. Then the selected closed order and booking history will be deleted permanently. This cannot be undone.</p><p><strong>Not deleted:</strong> active work, menus, stores, services, POS settings, or customer login accounts.</p><label for="g58RetentionPassword">Current login password</label><input id="g58RetentionPassword" type="password" autocomplete="current-password" required><label for="g58RetentionConfirm">Type DELETE</label><input id="g58RetentionConfirm" type="text" autocomplete="off" required><label class="g58-retention-check"><input id="g58RetentionConsent" type="checkbox"> <span>I downloaded or will keep the CSV backup and understand that ${rows.length} history record(s) will be permanently deleted.</span></label><div id="g58RetentionMessage"></div><div class="g58-retention-actions"><button class="g58-retention-cancel" type="button">Cancel</button><button class="g58-retention-button" type="button" id="g58RetentionDelete">Verify, Backup & Delete</button></div></section>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelector('.g58-retention-cancel').onclick = close;
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    const submit = backdrop.querySelector('#g58RetentionDelete');
    submit.onclick = async () => {
      const password = backdrop.querySelector('#g58RetentionPassword').value;
      const confirmation = backdrop.querySelector('#g58RetentionConfirm').value.trim();
      const consent = backdrop.querySelector('#g58RetentionConsent').checked;
      const message = backdrop.querySelector('#g58RetentionMessage');
      message.className = ''; message.textContent = '';
      if (!password || confirmation !== 'DELETE' || !consent) { message.className = 'g58-retention-error'; message.textContent = 'Enter your password, type DELETE exactly, and select the confirmation checkbox.'; return; }
      submit.disabled = true; submit.textContent = 'Verifying password…';
      try {
        const verified = await invoke('owner-verify-history-delete', options.product, password, confirmation);
        const backupRows = Array.isArray(verified?.backupRecords) ? verified.backupRecords : [];
        if (!backupRows.length) throw new Error('No eligible cloud history was found. No data was deleted.');
        downloadCsv(fileName(options.product), backupRows);
        submit.textContent = 'Deleting permanently…';
        const result = await invoke('owner-backup-delete-history', options.product, password, confirmation);
        message.className = 'g58-retention-success';
        message.textContent = `${Number(result?.deleted || 0)} history record(s) permanently deleted after the ${backupRows.length}-record CSV backup was created.`;
        await options.afterDelete?.(result);
        setTimeout(() => { close(); options.render?.(); }, 900);
      } catch (error) {
        message.className = 'g58-retention-error';
        message.textContent = error?.message || 'Verification failed. No data was deleted.';
        submit.disabled = false; submit.textContent = 'Verify, Backup & Delete';
      }
    };
    backdrop.querySelector('#g58RetentionPassword').focus();
  }
  function mount(options) {
    injectStyles();
    const host = typeof options.host === 'string' ? document.querySelector(options.host) : options.host;
    if (!host) return;
    const rows = eligibleRows(options.product, options.rows || []);
    const oldest = rows.reduce((min, row) => Math.min(min, recordTime(row) || Infinity), Infinity);
    const age = Number.isFinite(oldest) ? Date.now() - oldest : 0;
    const approaching = age >= YEAR_MS - WARNING_MS;
    host.innerHTML = `<section class="g58-retention"><h2>History backup & permanent deletion</h2><p>${LEGAL_TEXT}</p><div class="g58-retention-meta"><span class="g58-retention-chip">${LABELS[options.product] || options.product}</span><span class="g58-retention-chip">${rows.length} deletable history record(s)</span>${approaching ? '<span class="g58-retention-chip g58-retention-warning">Backup due within 30 days</span>' : ''}</div><button class="g58-retention-button" type="button" ${rows.length ? '' : 'disabled'}>${rows.length ? 'Backup CSV & Delete History Permanently' : 'No closed history to delete'}</button></section>`;
    host.querySelector('button')?.addEventListener('click', () => openDialog(options, rows, host));
  }
  window.G58DataRetention = { LEGAL_TEXT, eligibleRows, toCsv, mount };
})();
