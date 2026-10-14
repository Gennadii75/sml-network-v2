// Shared i18n for Sementsul Network pages. English first (default), RU/ZH on demand.
// Each page defines window.PAGE_I18N = {en:{},ru:{},zh:{}} before this script
// and marks strings with data-i18n="key". Optional window.AFTER_LANG(lang, dict).
(function () {
  var CHROME = {
    en: { nav_stats: "Stats", nav_earn: "Earn", nav_harm: "Bot harm", nav_connect: "Connect", nav_blog: "Blog", nav_faq: "FAQ", nav_home: "Home →", brand: "SEMENTSUL NETWORK", foot_contract: "Sementsul Network · SML contract:", back: "← All articles", next: "Read next:", rm_bots: "Bots vs humans", rm_conn: "10-minute setup", rm_fb: "fail2ban + blocklist", rm_math: "3/7/10 math", rm_fp: "False positives", rm_stack: "Cloudflare + GitHub stack", rm_sys: "System requirements" },
    ru: { nav_stats: "Статистика", nav_earn: "Заработок", nav_harm: "Вред ботов", nav_connect: "Подключение", nav_blog: "Блог", nav_faq: "FAQ", nav_home: "Главная →", brand: "SEMENTSUL NETWORK", foot_contract: "Sementsul Network · контракт SML:", back: "← Все статьи", next: "Дальше:", rm_bots: "Боты против живых", rm_conn: "Подключение за 10 минут", rm_fb: "fail2ban + blocklist", rm_math: "Математика 3/7/10", rm_fp: "Ложные срабатывания", rm_stack: "Стек Cloudflare + GitHub", rm_sys: "Системные требования" },
    zh: { nav_stats: "统计", nav_earn: "收益", nav_harm: "机器人危害", nav_connect: "接入", nav_blog: "博客", nav_faq: "常见问题", nav_home: "首页 →", brand: "SEMENTSUL NETWORK", foot_contract: "Sementsul Network · SML合约：", back: "← 所有文章", next: "继续阅读：", rm_bots: "机器人与真人", rm_conn: "10分钟接入", rm_fb: "fail2ban+封锁名单", rm_math: "3/7/10数学", rm_fp: "误报说明", rm_stack: "Cloudflare+GitHub架构", rm_sys: "系统要求" }
  };
  function getCookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(n, v) {
    document.cookie = n + '=' + encodeURIComponent(v) + '; max-age=31536000; path=/; SameSite=Lax';
  }
  var LANG = getCookie('sml_lang');
  if (!LANG || ['en', 'ru', 'zh'].indexOf(LANG) < 0) {
    var b = (navigator.language || 'en').toLowerCase();
    LANG = b.indexOf('ru') === 0 ? 'ru' : (b.indexOf('zh') === 0 ? 'zh' : 'en');
  }
  function T(lang) {
    var o = {}, k;
    var c = CHROME[lang] || CHROME.en;
    for (k in c) o[k] = c[k];
    var p = window.PAGE_I18N || {}, d = p[lang] || {};
    for (k in d) o[k] = d[k];
    return o;
  }
  window.SML_T = function (k) {
    var D = T(LANG);
    return D[k] != null ? D[k] : k;
  };
  function paint(btn) {
    var on = btn.getAttribute('data-lang') === LANG;
    btn.style.background = on ? '#D4AF37' : 'transparent';
    btn.style.color = on ? '#0A1C2E' : '#D4AF37';
  }
  window.applyLang = function (l) {
    LANG = ['en', 'ru', 'zh'].indexOf(l) >= 0 ? l : 'en';
    setCookie('sml_lang', LANG);
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;
    var D = T(LANG);
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (D[k] != null) el.textContent = D[k];
    });
    document.querySelectorAll('.lang-switch button').forEach(paint);
    if (typeof window.AFTER_LANG === 'function') { try { window.AFTER_LANG(LANG, D); } catch (e) {} }
  };
  document.querySelectorAll('.lang-switch button').forEach(function (btn) {
    btn.addEventListener('click', function () { window.applyLang(btn.getAttribute('data-lang')); });
  });
  window.applyLang(LANG);
})();
