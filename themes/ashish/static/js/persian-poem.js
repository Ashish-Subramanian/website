/* persian-poem.js — Scrollytelling for "Anatomy of a Persian Poem" */
(function () {
  var container = document.querySelector('.poem-scroll');
  if (!container) return;

  var steps = container.querySelectorAll('.poem-step');
  var display = container.querySelector('.poem-display');

  /* Trigger zone: a narrow band ~35-40% from the top of the viewport.
     When a step's top edge crosses into this band, it becomes active. */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var step = entry.target.getAttribute('data-step');
        container.setAttribute('data-active-step', step);
        steps.forEach(function (s) {
          s.classList.toggle('active', s === entry.target);
        });
      }
    });
  }, {
    rootMargin: '-35% 0px -55% 0px',
    threshold: 0
  });

  steps.forEach(function (step) { observer.observe(step); });

  /* --- Verse word hover pairing --- */
  var versePair = document.querySelector('.verse-pair');
  if (versePair) {
    var allVw = versePair.querySelectorAll('.vw');
    allVw.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        var id = el.getAttribute('data-word');
        versePair.querySelectorAll('.vw[data-word="' + id + '"]').forEach(function (match) {
          match.classList.add('vw-active');
        });
      });
      el.addEventListener('mouseleave', function () {
        var id = el.getAttribute('data-word');
        versePair.querySelectorAll('.vw[data-word="' + id + '"]').forEach(function (match) {
          match.classList.remove('vw-active');
        });
      });
    });
  }

  /* On narrow screens, when the sticky poem is at the top, add a subtle
     shadow to separate it from the scrolling content below. */
  if (display) {
    var stickyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        display.classList.toggle('stuck', !entry.isIntersecting);
      });
    }, { threshold: 1.0 });
    stickyObserver.observe(display);
  }
})();
