// Native APP 诊断脚本: 在 </body> 前、主 JS 前加载, 捕获所有错误.
// 这个文件在 public/ 下, Vite 直接复制到 dist/, 不经过编译.
(function () {
  var errors = [];
  window.__diagErrors = errors;

  // 方法1: 捕获全局 JS 运行时错误
  window.onerror = function (msg, src, line, col, err) {
    var info = (msg || '') + ' @ ' + (src || '') + ':' + (line || 0);
    errors.push('onerror: ' + info);
    console.error('DIAG: ' + info);
    return false; // 不阻止默认行为
  };

  // 方法2: 捕获资源加载错误 (script 404 等)
  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window) {
      // 资源加载错误 (script, img, link 等)
      var tag = event.target.tagName || '?';
      var src = event.target.src || event.target.href || '';
      errors.push('resource: ' + tag + ' ' + src);
      console.error('DIAG_RESOURCE: ' + tag + ' ' + src);
    }
  }, true); // capture phase 捕获所有

  // 方法3: 捕获 Promise rejection
  window.addEventListener('unhandledrejection', function (event) {
    var reason = (event.reason && event.reason.message) ? event.reason.message : String(event.reason);
    errors.push('reject: ' + reason);
    console.error('DIAG_REJECT: ' + reason);
  });

  console.log('DIAG: initialized, errors=' + errors.length);

  // 5 秒后检查 Vue 是否挂载
  window.setTimeout(function () {
    var app = document.getElementById('app');
    var mounted = app && app.children.length > 0;
    console.log('DIAG: 5s, mounted=' + mounted + ', errors=' + errors.length);

    if (!mounted) {
      var s = document.getElementById('native-splash');
      if (s) {
        var errLines = errors.length > 0 ? errors.slice(0, 4) : ['无错误捕获'];
        var errText = errLines.join('<br>');
        s.innerHTML =
          '<div style="text-align:center;padding:16px;font-family:monospace,sans-serif;color:#475569;font-size:11px">' +
          '<div style="font-size:40px;margin-bottom:12px">❄️</div>' +
          '<div style="font-size:15px;font-weight:700;color:#ef4444;margin-bottom:10px">JS 加载失败</div>' +
          '<div style="background:rgba(0,0,0,0.05);border-radius:8px;padding:10px;line-height:1.6;word-break:break-all;text-align:left;margin-bottom:10px">' +
          errText + '</div>' +
          '<div style="font-size:10px;opacity:0.5">v' + ('1.10.212') + '</div>' +
          '</div>';
      }
    }
  }, 5000);
})();