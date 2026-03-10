/* CV interstitial gate */
(function () {
  var gate = document.getElementById("cv-gate");
  var content = document.getElementById("cv-content");
  var btn = document.getElementById("cv-gate-btn");
  if (!gate || !content) return;

  if (sessionStorage.getItem("cv-gate-passed")) {
    gate.classList.add("dismissed");
    content.classList.add("visible");
    return;
  }

  btn.addEventListener("click", function () {
    sessionStorage.setItem("cv-gate-passed", "1");
    gate.classList.add("dismissed");
    content.classList.add("visible");
  });
})();

/* Scroll-triggered fade-in animations */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var targets = document.querySelectorAll(
    ".fade-in-section, .cv-entry, .pub"
  );

  if (!targets.length) return;

  targets.forEach(function (el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = el.parentElement
          ? Array.prototype.slice.call(
              el.parentElement.querySelectorAll(
                ".fade-in-section, .cv-entry, .pub"
              )
            )
          : [];
        var index = siblings.indexOf(el);
        var delay = Math.min(index, 6) * 0.05;
        el.style.transitionDelay = delay + "s";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        observer.unobserve(el);
      });
    },
    { threshold: 0.1 }
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();

/* CV collapsible sections */
(function () {
  var cvBody = document.querySelector(".cv-body");
  if (!cvBody) return;

  var headings = cvBody.querySelectorAll("h2");
  if (!headings.length) return;

  headings.forEach(function (h2) {
    /* Collect all siblings between this h2 and the next h2 */
    var content = [];
    var sibling = h2.nextElementSibling;
    while (sibling && sibling.tagName !== "H2") {
      content.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    /* Wrap them in a collapsible container */
    var wrapper = document.createElement("div");
    wrapper.className = "cv-section-content";
    content.forEach(function (el) {
      wrapper.appendChild(el);
    });
    h2.after(wrapper);

    /* Make heading clickable */
    h2.classList.add("cv-section-header");
    h2.setAttribute("role", "button");
    h2.setAttribute("tabindex", "0");
    h2.setAttribute("aria-expanded", "true");

    function toggle() {
      var isCollapsed = h2.classList.toggle("collapsed");
      h2.setAttribute("aria-expanded", String(!isCollapsed));

      if (isCollapsed) {
        /* Collapsing: set explicit height first, then trigger transition to 0 */
        wrapper.style.maxHeight = wrapper.scrollHeight + "px";
        wrapper.offsetHeight; /* force reflow */
        wrapper.classList.add("collapsed");
      } else {
        /* Expanding: set target height, then clear constraint after transition */
        wrapper.classList.remove("collapsed");
        wrapper.style.maxHeight = wrapper.scrollHeight + "px";
        wrapper.addEventListener("transitionend", function handler() {
          wrapper.style.maxHeight = "none";
          wrapper.removeEventListener("transitionend", handler);
        });
      }
    }

    h2.addEventListener("click", toggle);
    h2.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
})();

/* KaTeX auto-render initialization */
(function () {
  if (typeof renderMathInElement !== "function") return;
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
  });
})();

/* CV ToC scroll-spy */
(function () {
  var tocLinks = document.querySelectorAll(".cv-toc a");
  if (!tocLinks.length) return;

  var headings = [];
  tocLinks.forEach(function (link) {
    var id = link.getAttribute("href");
    if (id && id.startsWith("#")) {
      var el = document.getElementById(id.slice(1));
      if (el) headings.push({ el: el, link: link });
    }
  });

  if (!headings.length) return;

  function onScroll() {
    var scrollY = window.scrollY + 120;
    var current = headings[0];

    for (var i = 0; i < headings.length; i++) {
      if (headings[i].el.offsetTop <= scrollY) {
        current = headings[i];
      }
    }

    tocLinks.forEach(function (link) {
      link.classList.remove("active");
    });
    if (current) {
      current.link.classList.add("active");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
