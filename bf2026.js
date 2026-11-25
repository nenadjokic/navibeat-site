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
   code prefilled (and loses ?discount=0, which hides the code field).
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
      ctaHref = STORE; ctaText = live ? 'Get it for $3.99' : 'See it on the App Store';
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
    var heading = live ? 'Black Friday.<span>$3.99 once.</span>' : 'Black Friday.<span>$3.99 on Nov 27.</span>';
    var slide = el('article', 'herodeck__slide');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', 'Black Friday sale');
    slide.innerHTML =
      '<div class="wrap bf-slide">'
      + '<div class="bf-slide__copy">'
      +   '<p class="bf-slide__eyebrow"><span class="bf-slide__dot" aria-hidden="true"></span>' + eyebrow + '</p>'
      +   '<h2 class="bf-slide__h' + (live ? '' : ' bf-slide__h--pre') + '">' + heading + '</h2>'
      +   '<p class="bf-slide__p">One Universal Purchase for <strong>iPhone, iPad, Mac, Apple TV and Apple Watch</strong>. '
      +     'Pay once, keep it on every Apple device you own. The sale runs through December 1.</p>'
      +   '<p class="bf-slide__more"><a href="android"><strong>Android</strong> <s>$5.99</s> $3.99 on Google Play</a>'
      +     '<a href="windows"><strong>Windows</strong> <s>$9.99</s> $4.99 with code <code>' + CODE + '</code></a></p>'
      +   '<div class="bf-clock" aria-live="off">'
      +     '<p class="bf-clock__label" data-bf-label>' + (live ? 'Sale ends in' : 'Sale starts in') + '</p>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="d">0</span><span class="bf-clock__unit">days</span></div>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="h">00</span><span class="bf-clock__unit">hours</span></div>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="m">00</span><span class="bf-clock__unit">min</span></div>'
      +     '<div class="bf-clock__cell"><span class="bf-clock__num" data-bf="s">00</span><span class="bf-clock__unit">sec</span></div>'
      +   '</div>'
      +   '<div class="hero__ctas hero__ctas--stores">'
      +     '<div class="store-badges"><a class="store-badge" href="' + STORE + '" target="_blank" rel="noopener">'
      +       '<img src="assets/badges/app-store-badge-black.svg" alt="Download on the App Store" width="120" height="40"></a></div>'
      +     '<a class="btn btn--ghost" href="features">See everything it does&nbsp;&rarr;</a>'
      +   '</div>'
      + '</div>'
      + '<div class="bf-tag" role="img" aria-label="33 percent off: $3.99 instead of $5.99">'
      +   '<p class="bf-tag__off">33%<small>off</small></p>'
      +   '<p class="bf-tag__price"><span class="bf-tag__now">$3.99</span><span class="bf-tag__was">$5.99</span></p>'
      +   '<p class="bf-tag__line">One purchase, five Apple platforms.<span>iPhone &middot; iPad &middot; Mac &middot; Apple TV &middot; Apple Watch</span></p>'
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
    // Windows checkout links: prefill the code while it is valid. ?discount=0
    // hides the code field, so it goes too.
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
