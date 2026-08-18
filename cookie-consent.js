/*
 * Cookie consent for Cork Hypnotherapy.
 *
 * Irish ePrivacy Regulations (S.I. 336/2011) and DPC guidance require prior
 * opt-in for non-essential cookies. So nothing that sets a cookie is loaded
 * until the visitor actively accepts:
 *
 *   - Google Analytics (GA4) is not injected at all until consent is given.
 *   - Third-party embeds marked [data-consent-src] (e.g. the Google Map) stay
 *     unloaded and show a click-to-load placeholder instead.
 *
 * Declining is a single click, exactly like accepting - no dark patterns, and
 * no cookie wall: every page works fully either way. The choice is stored for
 * 6 months, after which we ask again, and can be changed at any time via the
 * "Cookie settings" link in the footer.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ch_cookie_consent';
  var VERSION = 1;
  var MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 6 months
  var GA_ID = 'G-1L2DKEFTK2';

  /* ---------- consent storage ---------- */

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data.version !== VERSION) return null;
      if (Date.now() - data.at > MAX_AGE_MS) return null;
      return data.granted === true;
    } catch (e) {
      return null; // private mode / storage blocked: ask again, load nothing
    }
  }

  function writeConsent(granted) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: VERSION,
        granted: granted,
        at: Date.now()
      }));
    } catch (e) { /* not fatal - consent just won't persist */ }
  }

  /* ---------- analytics ---------- */

  var analyticsLoaded = false;

  function loadAnalytics() {
    if (analyticsLoaded || !GA_ID) return;
    analyticsLoaded = true;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  function clearAnalyticsCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var parts = host.split('.');
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));

    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^(_ga|_gid|_gat)/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/' +
          (d ? '; domain=' + d : '');
      });
    });
  }

  /* ---------- gated third-party embeds ---------- */

  function loadEmbeds() {
    document.querySelectorAll('[data-consent-src]').forEach(function (el) {
      if (el.getAttribute('src')) return;
      el.setAttribute('src', el.getAttribute('data-consent-src'));
      var ph = el.closest('[data-consent-wrap]');
      if (ph) {
        var note = ph.querySelector('[data-consent-placeholder]');
        if (note) note.remove();
      }
    });
  }

  function showPlaceholders() {
    document.querySelectorAll('[data-consent-wrap]').forEach(function (wrap) {
      if (wrap.querySelector('[data-consent-placeholder]')) return;
      var frame = wrap.querySelector('[data-consent-src]');
      if (frame && frame.getAttribute('src')) return;

      var label = wrap.getAttribute('data-consent-label') || 'This content';
      var ph = document.createElement('div');
      ph.className = 'consent-placeholder';
      ph.setAttribute('data-consent-placeholder', '');
      ph.innerHTML =
        '<p>' + label + ' is hidden because it sets cookies.</p>' +
        '<button type="button" class="btn btn-primary btn-sm">Load ' + label.toLowerCase() + '</button>';
      ph.querySelector('button').addEventListener('click', function () {
        accept();
      });
      wrap.appendChild(ph);
    });
  }

  /* ---------- banner ---------- */

  function buildBanner() {
    var el = document.createElement('div');
    el.className = 'cookie-banner';
    el.id = 'cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'cookie-banner-title');
    el.setAttribute('aria-describedby', 'cookie-banner-desc');
    el.innerHTML =
      '<div class="cookie-banner-inner">' +
        '<div class="cookie-banner-text">' +
          '<h2 id="cookie-banner-title">Cookies on this site</h2>' +
          '<p id="cookie-banner-desc">We would like to use analytics cookies to understand how the site is used, so we can improve it. ' +
          'We will only set them if you accept. Declining changes nothing about how the site works. ' +
          'See our <a href="/privacy">privacy policy</a>.</p>' +
        '</div>' +
        '<div class="cookie-banner-actions">' +
          '<button type="button" class="btn btn-white btn-sm" data-cookie-decline>Decline</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-cookie-accept>Accept</button>' +
        '</div>' +
      '</div>';
    return el;
  }

  var bannerEl = null;

  function showBanner() {
    if (bannerEl) { bannerEl.classList.add('is-visible'); return; }
    bannerEl = buildBanner();
    document.body.appendChild(bannerEl);
    bannerEl.querySelector('[data-cookie-accept]').addEventListener('click', accept);
    bannerEl.querySelector('[data-cookie-decline]').addEventListener('click', decline);
    requestAnimationFrame(function () { bannerEl.classList.add('is-visible'); });
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('is-visible');
  }

  function accept() {
    writeConsent(true);
    hideBanner();
    loadAnalytics();
    loadEmbeds();
  }

  function decline() {
    writeConsent(false);
    hideBanner();
    clearAnalyticsCookies();
    showPlaceholders();
  }

  /* ---------- init ---------- */

  function init() {
    var consent = readConsent();

    if (consent === true) {
      loadAnalytics();
      loadEmbeds();
    } else {
      // No consent (declined, expired, or not yet asked) means we have no
      // lawful basis to hold analytics cookies - including any left over from
      // a previous visit - so clear them on every load, not just on decline.
      clearAnalyticsCookies();
      showPlaceholders();
      if (consent === null) showBanner();
    }

    // "Cookie settings" link lets the visitor change their mind at any time
    document.querySelectorAll('[data-cookie-settings]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        showBanner();
        var btn = bannerEl && bannerEl.querySelector('[data-cookie-decline]');
        if (btn) btn.focus();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
