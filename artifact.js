/* =============================================================================
   THE ARTIFACT, NaviBeat: a working 10-band equaliser.

   Ten real range inputs, so keyboard, screen reader and touch all work without
   being reimplemented. The response curve is a Catmull-Rom spline through the
   band values, converted to cubic beziers. No library.

   The curve is drawn from the MEASURED geometry of the sliders rather than from
   assumed heights, because the thumb travel is the input height minus the thumb
   and the columns are laid out by grid. Assuming it puts the curve visibly out
   of register with the handles.
   ============================================================================= */
(function () {
  'use strict';

  var bands = document.getElementById('eqBands');
  if (!bands) return;

  var FREQ  = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  var START = [3, 2, 0, -1, -2, 0, 1, 2, 3, 2];   /* a gentle smile, not flat */

  var svg    = document.getElementById('eqCurve');
  var path   = document.getElementById('eqPath');
  var fill   = document.getElementById('eqFill');
  var gainEl = document.getElementById('eqGain');
  var preEl  = document.getElementById('eqPre');
  var preset = document.getElementById('eqPreset');

  var inputs = FREQ.map(function (f, i) {
    var col = document.createElement('div');
    col.className = 'eq-col';

    var input = document.createElement('input');
    input.type = 'range';
    input.min = -12;
    input.max = 12;
    input.step = 0.5;
    input.value = START[i];
    input.setAttribute('orient', 'vertical');   /* older Firefox */
    input.setAttribute('aria-label', f + ' hertz band, gain in decibels');

    var lab = document.createElement('span');
    lab.className = 'eq-col__f';
    lab.textContent = f;

    col.appendChild(input);
    col.appendChild(lab);
    bands.appendChild(col);
    input.addEventListener('input', draw);
    return input;
  });

  /* Catmull-Rom through the band points, emitted as cubic beziers. */
  function spline(pts) {
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i === 0 ? 0 : i - 1];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[Math.min(i + 2, pts.length - 1)];
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6) + ',' + (p1[1] + (p2[1] - p0[1]) / 6) +
           ' ' + (p2[0] - (p3[0] - p1[0]) / 6) + ',' + (p2[1] - (p3[1] - p1[1]) / 6) +
           ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }

  function draw() {
    var stage = bands.getBoundingClientRect();
    if (!stage.width) return;

    var W = 1000;
    var H = Math.max(1, stage.height);
    var vals = inputs.map(function (i) { return parseFloat(i.value); });

    var pts = inputs.map(function (input, i) {
      var r = input.getBoundingClientRect();
      var thumb = 8;
      var travel = Math.max(1, r.height - thumb);
      /* +12 dB sits at the top of travel, -12 dB at the bottom */
      var y = (r.top - stage.top) + thumb / 2 + (1 - (vals[i] + 12) / 24) * travel;
      var x = (r.left - stage.left) + r.width / 2;
      return [x / stage.width * W, y];
    });

    var d = spline(pts);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    path.setAttribute('d', d);
    fill.setAttribute('d', d + 'L' + W + ',' + H + 'L0,' + H + 'Z');

    var peak = Math.max.apply(null, vals);
    var avg  = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    gainEl.textContent = (peak >= 0 ? '+' : '') + peak.toFixed(1) + ' dB';
    preEl.textContent  = (-avg >= 0 ? '+' : '') + (-avg).toFixed(1) + ' dB';

    var flat = vals.every(function (v) { return v === 0; });
    preset.textContent = flat ? 'flat'
      : (vals[0] > 4 && vals[9] > 4) ? 'loudness'
      : (vals[9] > vals[0]) ? 'bright'
      : 'warm';
  }

  draw();
  addEventListener('resize', draw);
  /* Web fonts landing changes the label height, so remeasure once they do. */
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(draw); }
})();
