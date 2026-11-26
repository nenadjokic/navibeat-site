/* bf2026.js: Black Friday 2026 promotion for Apple, Android and Windows.
   App Store Connect schedule (read back 2026-11-24): USA $5.99 until 2026-11-27,
   $3.99 from 2026-11-27, $5.99 again from 2026-12-02. So the sale runs
   November 27 through December 1.

   Self-contained on purpose. Removing the promotion = delete this file,
   bf2026.css, and every line containing "bf2026" in the HTML pages.
   Until then it guards itself: after END it draws nothing at all.

   Android (Google Play, read back 2026-11-19): $5.99 -> $3.99 in the US, Nov 27
   through Dec 1; other countries 33.39 % off their own price.
   Windows (Lemon Squeezy discount 1263649, read back 2026-11-25): code
   BLACKFRIDAY50, 50 % off $9.99 -> $4.99, valid 2026-11-27T00:00Z to
   2026-12-02T08:00Z. During that window every checkout link on the site gets the
   code prefilled (the links no longer carry ?discount=0 since 2026-11-26, so the code field always shows).
   Linux is free, nothing to discount.

   Surfaces:
   1. a ribbon above the nav on every page that loads this file;
   2. on the home page, a first hero slide (inserted before the deck script runs);
   3. on the home page, the Apple, Android and Windows cards in the Prices section;
   4. on android.html and windows.html, the price block, and the Windows checkout links. */
(function () {
  var START = Date.UTC(2026, 10, 27, 8, 0, 0); // Nov 27 00:00 Pacific
  var END = Date.UTC(2026, 11, 2, 8, 0, 0);    // Dec 2 00:00 Pacific, the old price is back
  var STORE = 'https://apps.apple.com/app/navibeat/id6763518834?pt=128824034&ct=site-bf2026&mt=8';
  var PLAY = 'https://play.google.com/store/apps/details?id=app.navibeat.android';
  var CODE = 'BLACKFRIDAY50';
  var WIN_START = Date.UTC(2026, 10, 27, 0, 0, 0);  // code valid from Nov 27 00:00 UTC
  var WIN_CHECKOUT = 'https://navibeat.lemonsqueezy.com/checkout/buy/f39cd7e9-1ed5-4f85-9e85-cd86f60b99d5?checkout[discount_code]=' + CODE;
  var path = (location.pathname || '').toLowerCase();
  var page = /android/.test(path) ? 'android' : /windows/.test(path) ? 'windows' : 'apple';

  var now = Date.now();
  if (now >= END) return;
  var live = now >= START;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parts(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }
  function target() { return Date.now() < START ? START : END; }

  /* ---------- 1. ribbon ---------- */
  var nav = document.querySelector('header.nav, #nav');
  if (nav && !document.querySelector('.bf-ribbon')) {
    var msg, ctaHref, ctaText;
    if (page === 'android') {
      msg = live
        ? 'NaviBeat for Android, <s>$5.99</s> <strong>$3.99</strong> on Google Play. Ends in <span class="bf-ribbon__clock" data-bf-short></span>'
        : 'NaviBeat for Android drops to <strong>$3.99</strong> on Google Play on November 27, through December 1.';
      ctaHref = PLAY; ctaText = live ? 'Get it for $3.99' : 'See it on Google Play';
    } else if (page === 'windows') {
      msg = live
        ? 'NaviBeat for Windows, <s>$9.99</s> <strong>$4.99</strong> with code <strong>' + CODE + '</strong>. Ends in <span class="bf-ribbon__clock" data-bf-short></span>'
        : 'NaviBeat for Windows is <strong>50% off</strong> with code <strong>' + CODE + '</strong>, November 27 through December 1.';
      ctaHref = Date.now() >= WIN_START ? WIN_CHECKOUT : '#buy'; ctaText = live ? 'Buy for $4.99' : 'See the price';
    } else {
      msg = live
        ? 'Apple and Android <s>$5.99</s> <strong>$3.99</strong>, Windows <strong>50% off</strong> with code <strong>' + CODE + '</strong>. Ends in <span class="bf-ribbon__clock" data-bf-short></span>'
        : 'November 27 to December 1: Apple and Android drop to <strong>$3.99</strong>, Windows is <strong>50% off</strong> with code <strong>' + CODE + '</strong>.';
      // Not Apple only: send people to the price list, which has all four platforms.
      ctaHref = (/^\/(index(\.html)?)?$/.test(path) ? '' : '/') + '#buy'; ctaText = 'See all prices';
    }
    var rib = el('div', 'bf-ribbon');
    rib.setAttribute('role', 'region');
    rib.setAttribute('aria-label', 'Black Friday sale');
    rib.innerHTML = '<div class="bf-ribbon__in">'
      + '<span class="bf-ribbon__tag">Black Friday</span>'
      + '<span class="bf-ribbon__msg">' + msg + '</span>'
      + '<a class="bf-ribbon__cta" href="' + ctaHref + '"' + (ctaHref.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"') + '>'
      + ctaText + ' &rarr;</a>'
      + '</div>';
    nav.parentNode.insertBefore(rib, nav);
  }

  /* ---------- 2. hero slide (home page only) ---------- */
  var deck = document.querySelector('[data-herodeck]');
  var track = deck && deck.querySelector('.herodeck__track');
  var dotsNav = deck && deck.querySelector('.herodeck__nav');
  if (track && dotsNav && !deck.querySelector('.bf-slide')) {
    var eyebrow = live ? 'Black Friday sale &middot; on now' : 'Black Friday &middot; November 27 to December 1';
    var heading = 'Black Friday.<span>Up to 50% off.</span>';
    var slide = el('article', 'herodeck__slide');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', 'Black Friday sale');
    // One row per paid platform, the same weight for each. Linux is free.
    function row(name, devices, now, was, extra) {
      return '<li class="bf-tag__row"><span class="bf-tag__name">' + name + '<small>' + devices + '</small></span>'
        + '<span class="bf-tag__amt"><b>' + now + '</b><s>' + was + '</s>' + (extra || '') + '</span></li>';
    }
    slide.innerHTML =
      '<div class="wrap bf-slide">'
      + '<div class="bf-slide__copy">'
      +   '<p class="bf-slide__eyebrow"><span class="bf-slide__dot" aria-hidden="true"></span>' + eyebrow + '</p>'
      +   '<h2 class="bf-slide__h">' + heading + '</h2>'
      +   '<p class="bf-slide__p"><strong>Apple</strong> and <strong>Android</strong> drop from $5.99 to <strong>$3.99</strong>. '
      +     '<strong>Windows</strong> is <strong>$4.99</strong> instead of $9.99 with code <code class="bf-code">' + CODE + '</code>. '
      +     'Pay once, keep it. The sale runs through December 1.</p>'
      +   '<div class="bf-clock" aria-live="off">'
      +     '<p class="bf-clock__label" data-bf-label>' + (live ? 'Sale ends in' : 'Sale starts in') + '</p>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="d">0</span><span class="bf-clock__unit">days</span></div>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="h">00</span><span class="bf-clock__unit">hours</span></div>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="m">00</span><span class="bf-clock__unit">min</span></div>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="s">00</span><span class="bf-clock__unit">sec</span></div>'
      +   '</div>'
      +   '<div class="hero__ctas hero__ctas--stores bf-stores">'
      +     '<div class="store-badges">'
      +       '<a class="store-badge" href="' + STORE + '" target="_blank" rel="noopener">'
      +         '<img src="assets/badges/app-store-badge-black.svg" alt="Download on the App Store" width="120" height="40"></a>'
      +       '<a class="store-badge" href="' + PLAY + '" target="_blank" rel="noopener">'
      +         '<img src="assets/badges/google-play-badge.png" alt="Get it on Google Play" width="134" height="40"></a>'
      +     '</div>'
      +     '<a class="btn btn--ghost bf-win-btn" href="windows">Windows, $4.99&nbsp;&rarr;</a>'
      +   '</div>'
      + '</div>'
      + '<div class="bf-tag" role="img" aria-label="Black Friday prices: Apple $3.99 instead of $5.99, Android $3.99 instead of $5.99, Windows $4.99 instead of $9.99 with code ' + CODE + '">'
      +   '<p class="bf-tag__off">Up to 50%<small>off</small></p>'
      +   '<ul class="bf-tag__rows">'
      +     row('Apple', 'iPhone &middot; iPad &middot; Mac &middot; TV &middot; Watch', '$3.99', '$5.99')
      +     row('Android', 'Phone &middot; TV &middot; Auto', '$3.99', '$5.99')
      +     row('Windows', 'code ' + CODE, '$4.99', '$9.99')
      +   '</ul>'
      +   '<p class="bf-tag__line">Paid once, no subscription.<span>Linux stays free.</span></p>'
      + '</div>'
      + '</div>';
    track.insertBefore(slide, track.firstElementChild);

    // The deck script reads slides and dots by position, so the new slide
    // goes first, takes the "current" state, and every dot is renumbered.
    Array.prototype.forEach.call(track.querySelectorAll('.herodeck__slide'), function (s) {
      s.classList.toggle('is-current', s === slide);
    });
    var dot = el('button', 'herodeck__dot', '<span class="visually-hidden">Black Friday sale</span>');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dotsNav.insertBefore(dot, dotsNav.firstElementChild);
    Array.prototype.forEach.call(dotsNav.querySelectorAll('.herodeck__dot'), function (d, i) {
      d.setAttribute('data-go', String(i));
      d.classList.toggle('is-on', i === 0);
      d.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    });
  }

  /* ---------- 3. price cards in #buy (home page) and 4. platform pages ---------- */
  // On the home page this file runs right after the hero, before #buy is parsed.
  function strike(h, was, now, tail) {
    h.classList.add('bf-price');
    h.innerHTML = '<s>' + was + '</s><b>' + now + '</b>' + (tail || '');
  }
  function note(card, text) {
    if (card.querySelector('.bf-price-note')) return;
    card.insertBefore(el('span', 'bf-price-note', text), card.firstElementChild);
  }
  function priceCard() {
    var buy = document.getElementById('buy');
    if (!buy) return;
    // Home page: one f-card per platform, told apart by the label.
    Array.prototype.forEach.call(buy.querySelectorAll('.f-card'), function (card) {
      var idx = card.querySelector('.f-card__idx');
      var h3 = card.querySelector('h3');
      var label = idx ? idx.textContent : '';
      if (/^\s*Apple/.test(label)) {
        if (h3 && live) strike(h3, '$5.99', '$3.99', ' once');
        note(card, live ? 'Black Friday, through Dec 1' : 'Black Friday: $3.99 from Nov 27');
      } else if (/^\s*Android/.test(label)) {
        if (h3 && live) strike(h3, '$5.99', '$3.99', ' once');
        note(card, live ? 'Black Friday on Google Play, through Dec 1' : 'Black Friday: $3.99 from Nov 27');
      } else if (/^\s*Windows/.test(label)) {
        if (h3 && live) strike(h3, '$9.99', '$4.99', ' once');
        note(card, (live ? 'Code ' : 'From Nov 27, code ') + CODE + ', 50% off');
      }
    });
    // android.html / windows.html: the single price block.
    var num = buy.querySelector('.price__num');
    if (num && page === 'android') {
      // The page price is one huge number: show only the sale price there and
      // name the old one in the pill, so the two never collide.
      if (live) { num.classList.add('bf-price-big'); num.textContent = '$3.99'; }
      var sub = buy.querySelector('.price__sub');
      if (sub && !buy.querySelector('.bf-price-note')) sub.insertAdjacentElement('beforebegin', el('span', 'bf-price-note',
        live ? 'Black Friday, was $5.99, through Dec 1' : 'Black Friday: $3.99 on Google Play, Nov 27 to Dec 1'));
    } else if (num && page === 'windows') {
      if (live) {
        num.classList.add('bf-price-big'); num.textContent = '$4.99';
        var title = document.getElementById('windows-price-title');
        if (title) title.textContent = title.textContent.replace('$9.99', '$4.99');
      }
      if (!buy.querySelector('.bf-price-note')) num.insertAdjacentElement('afterend', el('span', 'bf-price-note',
        (live ? 'Black Friday, was $9.99: code ' : 'Black Friday, Nov 27 to Dec 1: code ') + CODE + ', 50% off at checkout'));
    }
    // Windows checkout links: prefill the code while it is valid.
    // (The field itself is visible without the sale too, since 2026-11-26.)
    if (Date.now() >= WIN_START) {
      Array.prototype.forEach.call(document.querySelectorAll('a[href*="lemonsqueezy.com/checkout/buy/f39cd7e9"]'), function (a) {
        a.href = WIN_CHECKOUT;
        if (/\$9\.99/.test(a.textContent)) a.textContent = a.textContent.replace('$9.99', '$4.99');
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', priceCard); else priceCard();

  /* ---------- clocks ---------- */
  var cells = { d: document.querySelector('[data-bf="d"]'), h: document.querySelector('[data-bf="h"]'),
                m: document.querySelector('[data-bf="m"]'), s: document.querySelector('[data-bf="s"]') };
  var shortClock = document.querySelector('[data-bf-short]');
  var label = document.querySelector('[data-bf-label]');
  function tick() {
    var t = Date.now();
    if (t >= END || (t >= START) !== live) { window.location.reload(); return; }
    if (label) label.textContent = t < START ? 'Sale starts in' : 'Sale ends in';
    var p = parts(target() - t);
    if (cells.d) cells.d.textContent = String(p.d);
    if (cells.h) cells.h.textContent = pad(p.h);
    if (cells.m) cells.m.textContent = pad(p.m);
    if (cells.s) cells.s.textContent = pad(p.s);
    if (shortClock) shortClock.textContent = (p.d ? p.d + 'd ' : '') + pad(p.h) + ':' + pad(p.m) + ':' + pad(p.s);
  }
  tick();
  setInterval(tick, 1000);
})();
