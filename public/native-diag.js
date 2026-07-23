(function () {
  var errors = [];
  var startTime = Date.now();
  var mainJsLoaded = false;
  var mainJsError = null;
  window.__diagErrors = errors;

  function log(msg) {
    var t = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('[DIAG+' + t + 's] ' + msg);
  }

  window.onerror = function (msg, src, line, col, err) {
    var stack = err && err.stack ? '\n' + err.stack.substring(0, 300) : '';
    var info = 'js-error: ' + msg + ' @ ' + (src || '') + ':' + (line || 0) + ':' + (col || 0) + stack;
    errors.push(info);
    log(info);
    return false;
  };

  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window) {
      var tag = event.target.tagName || '?';
      var src = event.target.src || event.target.href || '';
      var info = 'resource-error: <' + tag.toLowerCase() + '> ' + src;
      if (src.indexOf('assets/index-') !== -1) {
        mainJsError = info;
        log('MAIN JS FAILED TO LOAD: ' + src);
      }
      errors.push(info);
      log(info);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var msg = (reason && reason.message) ? reason.message : String(reason);
    var stack = (reason && reason.stack) ? '\n' + reason.stack.substring(0, 300) : '';
    var info = 'promise-reject: ' + msg + stack;
    errors.push(info);
    log(info);
  });

  // 监听主 JS script 的 load/error 事件
  function watchMainScript() {
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.src && s.src.indexOf('assets/index-') !== -1) {
        s.addEventListener('load', function () {
          mainJsLoaded = true;
          log('main JS <script> load event fired');
        });
        s.addEventListener('error', function (e) {
          mainJsError = 'script error event on main JS: ' + s.src;
          log(mainJsError);
        });
        log('watching main script: ' + s.src);
        return;
      }
    }
    log('main script tag not found in DOM yet, will retry');
    setTimeout(watchMainScript, 200);
  }

  log('init; location=' + location.href);
  log('ua=' + navigator.userAgent.substring(0, 100));
  watchMainScript();

  // 加载 version.json 获取版本号
  var appVersion = '?';
  function fetchVersion() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', './version.json', true);
      xhr.timeout = 3000;
      xhr.onload = function () {
        try {
          var v = JSON.parse(xhr.responseText);
          appVersion = v.version || '?';
          log('version=' + appVersion);
        } catch (e) {}
      };
      xhr.send();
    } catch (e) {}
  }
  fetchVersion();

  function showError(diagInfo) {
    var s = document.getElementById('native-splash');
    if (!s) return;
    var infoHtml = '';
    for (var i = 0; i < diagInfo.length; i++) {
      infoHtml += '<div style="margin-bottom:4px;color:#dc2626;font-size:11px;word-break:break-all">' + escapeHtml(diagInfo[i]) + '</div>';
    }
    s.innerHTML =
      '<div style="text-align:center;padding:20px;font-family:monospace,sans-serif;color:#475569;font-size:11px;width:100%;box-sizing:border-box">' +
      '<div style="font-size:40px;margin-bottom:12px">❄️</div>' +
      '<div style="font-size:16px;font-weight:700;color:#ef4444;margin-bottom:12px">JS 加载失败</div>' +
      '<div style="background:rgba(0,0,0,0.05);border-radius:8px;padding:12px;line-height:1.5;word-break:break-all;text-align:left;margin-bottom:10px;max-height:280px;overflow-y:auto">' +
      infoHtml +
      '</div>' +
      '<div style="font-size:10px;opacity:0.5">v' + appVersion + '</div>' +
      '</div>';
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 2秒检查: 收集诊断信息
  setTimeout(function () {
    var app = document.getElementById('app');
    var mounted = !!(app && app.children.length > 0);
    var scripts = document.querySelectorAll('script[src]');
    var scriptList = [];
    for (var i = 0; i < scripts.length; i++) {
      scriptList.push(scripts[i].src.split('/').pop());
    }
    log('check@2s: mounted=' + mounted + ', errors=' + errors.length + ', mainJsLoaded=' + mainJsLoaded + ', scripts=' + scriptList.join(','));

    if (!mounted) {
      var diag = [];
      if (errors.length > 0) {
        diag = errors.slice(0, 6);
      } else {
        diag.push('无 JS 错误捕获');
        diag.push('mainJsLoaded=' + mainJsLoaded);
        diag.push('mainJsError=' + (mainJsError || 'none'));
        diag.push('url=' + location.href);
        diag.push('scripts=' + scriptList.join(', '));
        // Check if Vue exists
        if (typeof window.Vue !== 'undefined') {
          diag.push('Vue=loaded');
        } else {
          diag.push('Vue=not found');
        }
        // Check if document ready state
        diag.push('readyState=' + document.readyState);
      }
      showError(diag);
    }
  }, 2000);

  // 5秒二次检查
  setTimeout(function () {
    var app = document.getElementById('app');
    var mounted = !!(app && app.children.length > 0);
    log('check@5s: mounted=' + mounted);
    if (!mounted && errors.length === 0) {
      errors.push('5s timeout: JS loaded but Vue never mounted');
      if (!document.getElementById('native-splash') || document.getElementById('native-splash').innerHTML.indexOf('JS 加载失败') === -1) {
        showError(['5s timeout: JS may have executed but Vue never mounted', 'mainJsLoaded=' + mainJsLoaded, 'Check console for errors']);
      }
    }
  }, 5000);
})();
