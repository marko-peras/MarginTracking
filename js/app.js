/* ==========================================================================
   Margin Tracking App — Router & bootstrap
   ========================================================================== */

(function () {
  const app = document.getElementById('app');

  function showList() {
    ListView.render(app, showDetail);
  }

  function showDetail(commission) {
    DetailView.render(app, commission, showList);
    window.scrollTo(0, 0);
  }

  async function boot() {
    try {
      await Data.init();
      showList();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="empty">
        Failed to load data. Serve this folder over HTTP (e.g. <code>python3 -m http.server 8765</code>)
        and open the app from <code>http://localhost:8765/</code>.<br><br>${escapeHtml(e.message)}
      </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
