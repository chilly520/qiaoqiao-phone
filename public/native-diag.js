// Native APP 诊断脚本: 在 </body> 前用 classic <script> 引用.
// 5 秒后检测 Vue 是否挂载, 没挂载就显示错误信息.
// 这个文件在 public/ 下, Vite 直接复制到 dist/, 不经过编译.
(function () {
  window.setTimeout(function () {
    var app = document.getElementById('app');
    if (!app || app.children.length === 0) {
      var s = document.getElementById('native-splash');
      if (s) {
        s.innerHTML =
          '<div style="text-align:center;padding:20px;font-family:-apple-system,sans-serif;color:#475569">' +
          '<div style="font-size:48px;margin-bottom:16px">❄️</div>' +
          '<div style="font-size:16px;font-weight:600;color:#ef4444;margin-bottom:8px">加载失败</div>' +
          '<div style="font-size:11px;opacity:0.7;word-break:break-all;padding:0 16px">' +
          'JS 加载失败, 请截图发给开发者</div></div>';
      }
      console.error('DIAG: Vue not mounted after 5s, app children: ' + (app ? app.children.length : 'null'));
    } else {
      console.log('DIAG: Vue mounted OK, children: ' + app.children.length);
    }
  }, 5000);
})();
