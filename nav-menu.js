/**
 * The Features menu in the site header.
 *
 * A separate file because every page carries its own inline copy of the nav
 * script, in slightly different shapes, and nineteen hand-patched copies of one
 * behaviour is nineteen chances for one of them to be wrong. This is the whole
 * menu behaviour, loaded once, identical everywhere.
 *
 * Click opens it, not hover. A hover-only menu cannot be opened by a thumb at
 * all, and this header has already cost one long debugging session over taps
 * that appeared to be ignored. Hover is layered on in CSS behind (hover: hover)
 * so a mouse still gets the faster path.
 */
(function () {
  'use strict';

  var groups = document.querySelectorAll('.nav__group');
  if (!groups.length) return;

  groups.forEach(function (group) {
    var trigger = group.querySelector('.nav__trigger');
    var menu = group.querySelector('.nav__menu');
    if (!trigger || !menu) return;

    var setOpen = function (open) {
      group.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!group.classList.contains('is-open'));
    });

    // Escape closes and hands focus back, so a keyboard user is never left
    // inside a panel that is no longer showing.
    group.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setOpen(false); trigger.focus(); }
    });

    // Leaving the group by tabbing closes it too: an open panel behind the
    // element you are now on is a panel nobody can see the state of.
    group.addEventListener('focusout', function (e) {
      if (!group.contains(e.relatedTarget)) setOpen(false);
    });

    document.addEventListener('click', function (e) {
      if (!group.contains(e.target)) setOpen(false);
    });
  });
})();
