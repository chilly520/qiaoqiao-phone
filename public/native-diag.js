// Native APP 诊断脚本: 在 </body> 前用 classic <script> 引用.
// 监听 window.onerror, 捕获 JS 加载/执行失败, 显示具体错误信息.
// 这个文件在 public/ 下, Vite 直接复制到 dist/, 不经过编译.
(function () {
  var errors = [];

  // 捕获所有 JS 错误
  window.addEventListener('error', function (event) {
    var msg = event.message || 'unknown error';
    var src = event.filename || '';
    var line = event.lineno || 0;
    var col = event.colno || 0;
    errors.push(msg + ' @ ' + src + ':' + line + ':' + col);
    console.error('DIAG_ERROR: ' + msg + ' @ ' + src + ':' + line + ':' + col);
  });

  // 捕获未处理的 Promise rejection
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason && event.reason.message ? event.reason.message : String(event.reason);
    errors.push('Promise: ' + reason);
    console.error('DIAG_REJECT: ' + reason);
  });

  // 检测主 JS 是否加载成功
  var scripts = document.querySelectorAll('script[src]');
  var scriptSrcs = [];
  for (var i = 0; i < scripts.length; i++) {
    scriptSrcs.push(scripts[i].src);
  }
  console.log('DIAG: scripts in HTML: ' + JSON.stringify(scriptSrcs));

  // 5 秒后检查 Vue 是否挂载
  window.setTimeout(function () {
    var app = document.getElementById('app');
    var mounted = app && app.children.length > 0;
    console.log('DIAG: 5s check, mounted=' + mounted + ', errors=' + errors.length);

    if (!mounted) {
      var s = document.getElementById('native-splash');
      if (s) {
        var errText = errors.length > 0
          ? errors.slice(0, 3).join('<br>')
          : '无错误捕获 (可能是 JS 文件加载失败)';
        s.innerHTML =
          '<div style="text-align:center;padding:20px;font-family:-apple-system,sans-serif;color:#475569">' +
          '<div style="font-size:48px;margin-bottom:16px">❄️</div>' +
          '<div style="font-size:16px;font-weight:600;color:#ef4444;margin-bottom:8px">加载失败</div>' +
          '<div style="font-size:11px;opacity:0.8;word-break:break-all;padding:0 12px;margin-bottom:12px;line-height:1.5">' +
          errText + '</div>' +
          '<div style="font-size:10px;opacity:0.5;word-break:break-all;padding:0 12px">' +
          'scripts: ' + JSON.stringify(scriptSrcs).substring(0, 200) + '</div>' +
          '</div>';
      }
    }
  }, 5000);
})();
