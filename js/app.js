// App bootstrap + view routing
(function () {
  const listView = document.getElementById("list-view");
  const detailView = document.getElementById("detail-view");

  function showList() {
    detailView.hidden = true;
    listView.hidden = false;
    ListView.refresh();
  }

  function showDetail(commission) {
    listView.hidden = true;
    detailView.hidden = false;
    DetailView.open(commission);
  }

  async function start() {
    await Store.init();
    ListView.init(showDetail);

    // Back navigation from detail title
    document.getElementById("detail-title").addEventListener("click", showList);
    showList();
  }

  start().catch((err) => {
    console.error(err);
    document.getElementById("vehicle-body").innerHTML =
      '<tr class="empty-row"><td colspan="14">Failed to load data. Serve the folder over HTTP and reload.</td></tr>';
  });
})();
