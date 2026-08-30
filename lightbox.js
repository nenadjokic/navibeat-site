/* NaviBeat lightbox: click any platform-page screenshot to open full-screen.
   Auto-attaches to .p-hero__shot img, .p-shot__media img, .strip__item img.
   ESC or click anywhere to close. No external deps. */
(function () {
  if (window.matchMedia('(max-width: 720px)').matches) return;

  const targets = document.querySelectorAll(
    '.p-hero__shot img, .p-shot__media img, .strip__item img, .rbx-hero__ipod img, .rbx-app__item img, .rbx-shot img'
  );
  if (!targets.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Screenshot viewer');
  overlay.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="Close">&times;</button>
    <img class="lightbox__img" alt="" />
    <div class="lightbox__caption" aria-live="polite"></div>
  `;
  document.body.appendChild(overlay);

  const lbImg = overlay.querySelector('.lightbox__img');
  const lbCap = overlay.querySelector('.lightbox__caption');
  const lbClose = overlay.querySelector('.lightbox__close');
  let lastFocused = null;

  function open(img) {
    lastFocused = document.activeElement;
    lbImg.src = img.src;
    lbImg.alt = img.alt || '';
    // Optional chaining is a PARSE error on Safari before 13.1 and killed this
    // whole file silently there (2026-07-30 audit); explicit check instead.
    var lbHost = img.closest('[aria-label]');
    lbCap.textContent = img.alt || (lbHost ? lbHost.getAttribute('aria-label') : '') || '';
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var main = document.querySelector('main');
    if (main) main.setAttribute('inert', '');
    lbClose.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    var main = document.querySelector('main');
    if (main) main.removeAttribute('inert');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  targets.forEach(img => {
    img.classList.add('lightbox-trigger');
    // Keyboard-accessible trigger: behaves like a button.
    img.setAttribute('role', 'button');
    img.setAttribute('tabindex', '0');
    // aria-label REPLACES alt for the accessible name, so setting a fixed
    // label here made every screenshot announce as "View screenshot full
    // screen, button". Measured 2026-08-31: 17 of 17 images on iphone.html
    // announced identically and none of their written alt text reached a
    // screen reader. Append instead of replace, and only when there is alt to
    // keep; an image with no alt still gets the plain action label.
    if (!img.getAttribute('aria-label')) {
      var lbAlt = (img.getAttribute('alt') || '').trim();
      img.setAttribute('aria-label', lbAlt ? lbAlt + ', view full screen' : 'View screenshot full screen');
    }
    img.addEventListener('click', (e) => { e.preventDefault(); open(img); });
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === lbImg || e.target === lbClose) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') { close(); return; }
    // Focus trap: the close button is the only focusable control in the dialog.
    if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); }
  });
})();
