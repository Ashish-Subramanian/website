/* ==========================================================================
   Reading List — Interactive blog post
   Loads reading-list.json, renders stats, map, timeline, filterable list
   ========================================================================== */

(function () {
  "use strict";

  /* --- Region colors & default map coords --- */
  var REGION_COLORS = {
    "East Asia":                                        "#2c6e49",
    "South and Southeast Asia":                         "#e07b39",
    "West Asia, Central Asia, and North Africa":        "#8b4513",
    "Southern Europe":                                  "#34568B",
    "Northern Europe":                                  "#5b7fa5",
    "Eastern Europe":                                   "#7a6e5e",
    "British Isles":                                    "#1a9988",
    "Africa":                                           "#9b2335",
    "Latin America":                                    "#6b3fa0",
    "United States, Canada, Australia, and New Zealand": "#3d7ea6"
  };

  /* Approximate centroids for region markers (lat, lng) */
  var REGION_COORDS = {
    "East Asia":                                        [35.0, 110.0],
    "South and Southeast Asia":                         [15.0, 80.0],
    "West Asia, Central Asia, and North Africa":        [33.0, 50.0],
    "Southern Europe":                                  [42.0, 14.0],
    "Northern Europe":                                  [58.0, 12.0],
    "Eastern Europe":                                   [52.0, 30.0],
    "British Isles":                                    [54.0, -2.0],
    "Africa":                                           [5.0, 20.0],
    "Latin America":                                    [-15.0, -60.0],
    "United States, Canada, Australia, and New Zealand": [40.0, -100.0]
  };

  var PERIOD_ORDER = ["Early", "Classical", "Post-Classical", "Early Modern", "Modern", "Contemporary"];

  var PERIOD_COLORS = {
    "Early":          "#8b6914",
    "Classical":      "#7a6e5e",
    "Post-Classical": "#2c6e49",
    "Early Modern":   "#34568B",
    "Modern":         "#9b2335",
    "Contemporary":   "#6b3fa0"
  };

  /* --- Helpers --- */

  function formatHours(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h + "h " + (m < 10 ? "0" : "") + m + "m";
  }

  function formatHoursShort(minutes) {
    return Math.round(minutes / 60).toLocaleString();
  }

  function shortTitle(t) {
    var i = t.indexOf(":");
    return i !== -1 ? t.substring(0, i) : t;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  /* Collapse 3+ consecutive entries into ranges (e.g., "4–7") */
  function collapseRanges(items) {
    /* Parse each item into {prefix, num, raw} */
    var parsed = items.map(function (s) {
      var m = s.match(/^(.*?)(\d+)$/);
      if (!m) return { prefix: "", num: NaN, raw: s };
      return { prefix: m[1], num: parseInt(m[2], 10), raw: s };
    });
    var result = [];
    var i = 0;
    while (i < parsed.length) {
      var start = i;
      /* Walk consecutive entries with same prefix */
      while (i + 1 < parsed.length &&
             parsed[i + 1].prefix === parsed[start].prefix &&
             parsed[i + 1].num === parsed[i].num + 1) {
        i++;
      }
      var runLen = i - start + 1;
      if (runLen >= 3) {
        result.push(parsed[start].raw + "\u2013" + parsed[i].num);
      } else {
        for (var j = start; j <= i; j++) result.push(parsed[j].raw);
      }
      i++;
    }
    return result.join(", ");
  }

  /* --- Read status (localStorage) --- */

  var READ_KEY = "rl-read-works";

  function getReadSet() {
    try {
      var raw = localStorage.getItem(READ_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function isRead(id) {
    return !!getReadSet()[id];
  }

  function setRead(id, val) {
    var set = getReadSet();
    if (val) { set[id] = true; } else { delete set[id]; }
    try { localStorage.setItem(READ_KEY, JSON.stringify(set)); } catch (e) { /* noop */ }
    updateReadCount();
    updateCumulativeProgress();
  }

  function updateReadCount() {
    var counter = document.getElementById("rl-read-count");
    if (!counter) return;
    var set = getReadSet();
    var n = Object.keys(set).length;
    counter.textContent = n + " of " + totalWorkCount + " read";
  }

  var totalWorkCount = 0;
  var cumulativeState = null;

  /* --- Load data and initialize --- */

  fetch("/data/reading-list.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      /* Separate works/criticism from folktale collections */
      var works = data.filter(function (d) { return d.type !== "folktale"; });
      var folktales = data.filter(function (d) { return d.type === "folktale"; });
      init(works, folktales, data);
    })
    .catch(function (err) {
      console.error("Failed to load reading list data:", err);
    });

  function init(works, folktales, allData) {
    totalWorkCount = works.length + folktales.length;

    /* Build lookup and bidirectional connection map */
    works.forEach(function (w) { worksById[w.id] = w; });
    works.forEach(function (w) {
      if (!w.connections || !w.connections.length) return;
      w.connections.forEach(function (c) {
        /* External (off-list) connection: {title, year} object */
        if (typeof c === "object" && c !== null) {
          if (!externalConns[w.id]) externalConns[w.id] = [];
          externalConns[w.id].push(c);
          return;
        }
        /* Internal connection: numeric id */
        var tid = c;
        if (tid === w.id || !worksById[tid]) return;
        if (!connectionMap[w.id]) connectionMap[w.id] = [];
        if (connectionMap[w.id].indexOf(tid) === -1) connectionMap[w.id].push(tid);
        if (!connectionMap[tid]) connectionMap[tid] = [];
        if (connectionMap[tid].indexOf(w.id) === -1) connectionMap[tid].push(w.id);
      });
    });

    /* All entries sorted by ID (already in chronological order from JSON) */
    allFolktales = folktales;
    allWorks = allData.slice().sort(function (a, b) { return a.id - b.id; });

    renderStats(works, folktales, allData);
    renderMap(works, folktales);
    renderTimeline(allWorks);
    renderFilters(allWorks);
    renderList(allWorks);
    renderCumulative(allWorks);
    initBackToTop();
  }

  /* ========== HERO STATS ========== */

  function renderStats(works, folktales, allData) {
    var container = document.getElementById("rl-stats");
    if (!container) return;

    var totalWorks = works.length + folktales.length;
    var totalMinutes = allData.reduce(function (s, d) { return s + (d.readingMinutes || 0); }, 0);

    /* Count unique countries from place field */
    var countries = {};
    allData.forEach(function (d) {
      var p = d.place;
      if (!p) return;
      var places = Array.isArray(p) ? p : [p];
      places.forEach(function (loc) {
        /* Extract country: last part after comma, or the whole string */
        var parts = loc.split(",");
        var country = parts[parts.length - 1].trim();
        if (country) countries[country] = true;
      });
    });
    var countryCount = Object.keys(countries).length;

    var years = works.filter(function (d) { return d.year !== null; });
    var minYear = Math.min.apply(null, years.map(function (d) { return d.year; }));
    var maxYear = Math.max.apply(null, years.map(function (d) { return d.year; }));
    var span = (minYear < 0 ? Math.abs(minYear) + maxYear : maxYear - minYear);

    var stats = [
      { value: totalWorks, label: "works" },
      { value: formatHoursShort(totalMinutes), label: "hours" },
      { value: countryCount, label: "countries" },
      { value: span.toLocaleString() + "+", label: "years spanned" }
    ];

    stats.forEach(function (s) {
      var div = el("div", "rl-stat");
      div.appendChild(el("span", "rl-stat-value", String(s.value)));
      div.appendChild(el("span", "rl-stat-label", s.label));
      container.appendChild(div);
    });

    /* Read progress counter */
    var readDiv = el("div", "rl-read-progress");
    readDiv.id = "rl-read-count";
    var readSet = getReadSet();
    var n = Object.keys(readSet).length;
    readDiv.textContent = n + " of " + totalWorkCount + " read";
    container.appendChild(readDiv);

  }

  /* ========== MAP ========== */

  /* Tiered radius for multi-place dots based on collection size */
  function multiPlaceRadius(totalPlaces) {
    if (totalPlaces >= 16) return 1.5;
    if (totalPlaces >= 6) return 2.0;
    return 2.5;
  }

  function renderMap(works, folktales) {
    var container = document.getElementById("rl-map");
    if (!container || typeof d3 === "undefined") return;

    /* Group works by coordinate key, expanding multi-place works.
       Exclude criticism/theory (no geography — timeline only). */
    var byLocation = {};
    var allItems = works.filter(function (w) { return w.type !== "criticism"; })
      .concat(folktales || []);
    allItems.forEach(function (w) {
      var coordsList;
      var placeNames;
      if (w.allCoords && w.allCoords.length > 1) {
        coordsList = w.allCoords;
        placeNames = Array.isArray(w.place) ? w.place : w.place.split("; ");
      } else if (w.coords) {
        coordsList = [w.coords];
        placeNames = [Array.isArray(w.place) ? w.place[0] : w.place];
      } else {
        return;
      }
      var isMultiPlace = coordsList.length > 1;
      var totalPlaces = coordsList.length;
      coordsList.forEach(function (coords, idx) {
        if (!coords) return;
        var key = coords[0] + "," + coords[1];
        if (!byLocation[key]) byLocation[key] = { coords: coords, works: [] };
        byLocation[key].works.push({
          work: w,
          isMultiPlace: isMultiPlace,
          totalPlaces: totalPlaces,
          placeName: placeNames[idx] || (Array.isArray(w.place) ? w.place[0] : w.place)
        });
      });
    });
    var locations = Object.values(byLocation);

    var width = container.clientWidth;
    var height = parseInt(container.style.height) || 450;

    /* Natural Earth projection — aesthetically pleasing for world maps */
    var projection = d3.geoNaturalEarth1()
      .scale(width / 5.5)
      .translate([width / 2, height / 2]);

    var path = d3.geoPath().projection(projection);

    var svgRoot = d3.select(container)
      .append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class", "rl-map-svg");

    /* Inner group that receives zoom transforms */
    var svg = svgRoot.append("g");

    /* Zoom — handler attached after dots are created (inside d3.json callback) */
    mapState.zoomK = 1;
    var zoom = d3.zoom().scaleExtent([1, 8]);
    svgRoot.call(zoom);

    /* Tooltip */
    var tooltip = d3.select(container)
      .append("div")
      .attr("class", "rl-map-tooltip")
      .style("opacity", 0);

    /* Load world boundaries (countries for dual-layer borders) */
    d3.json("/data/countries-50m.json").then(function (world) {
      var land = topojson.feature(world, world.objects.land);
      /* Internal country borders only (exclude coastlines) */
      var borders = topojson.mesh(world, world.objects.countries, function (a, b) { return a !== b; });

      /* Country borders — lighter */
      svg.append("path")
        .datum(borders)
        .attr("class", "rl-map-borders")
        .attr("d", path);

      /* Continent/coastline outlines — darker */
      svg.append("path")
        .datum(land)
        .attr("class", "rl-map-land")
        .attr("d", path);

      /* Work markers — folktale collections don't inflate dot size */
      function dotRadius(d) {
        var numbered = d.works.filter(function (e) { return e.work.type !== "folktale"; });
        var full = numbered.filter(function (e) { return !e.isMultiPlace; }).length;
        var multi = numbered.length - full;
        if (numbered.length === 0) {
          /* Only folktales at this location — use smallest multi-place radius */
          var minR = 2.5;
          d.works.forEach(function (e) {
            if (e.isMultiPlace) minR = Math.min(minR, multiPlaceRadius(e.totalPlaces));
          });
          return minR;
        }
        if (full === 0 && multi > 0) {
          var minR2 = 2.5;
          numbered.forEach(function (e) {
            if (e.isMultiPlace) minR2 = Math.min(minR2, multiPlaceRadius(e.totalPlaces));
          });
          return minR2;
        }
        var n = full + multi;
        return n === 1 ? 3.5 : Math.min(9, 3.5 + Math.sqrt(n) * 1.5);
      }

      function dotOpacity(d) {
        var numbered = d.works.filter(function (e) { return e.work.type !== "folktale"; });
        var hasFullPresence = numbered.some(function (e) { return !e.isMultiPlace; });
        return hasFullPresence ? 0.75 : 0.6;
      }

      function dotStroke(d) {
        var r = dotRadius(d);
        if (r <= 1.5) return 0.3;
        if (r <= 2) return 0.5;
        return 1;
      }

      var dots = svg.selectAll(".rl-map-dot")
        .data(locations)
        .join("circle")
        .attr("class", "rl-map-dot")
        .attr("cx", function (d) { return projection([d.coords[1], d.coords[0]])[0]; })
        .attr("cy", function (d) { return projection([d.coords[1], d.coords[0]])[1]; })
        .attr("r", dotRadius)
        .attr("fill", function (d) { return PERIOD_COLORS[d.works[0].work.period] || "#34568B"; })
        .attr("fill-opacity", dotOpacity)
        .attr("stroke", "#fff")
        .attr("stroke-width", function (d) { return dotStroke(d); })
        .on("mouseenter", function (event, d) {
          /* Check if this dot has any active (filtered-in) works */
          var visWorks = d._visibleWorks || d.works;
          var matching = _hasActiveFilter()
            ? visWorks.filter(function (e) { return workMatchesFilter(e.work); })
            : visWorks;
          var isActive = matching.length > 0;
          if (!isActive) return; /* Don't highlight grayed-out dots */

          var s = Math.sqrt(mapState.zoomK || 1);
          d3.select(this).attr("fill-opacity", 1).attr("stroke-width", Math.max(1, dotStroke(d) * 2) / s);
          /* Highlight sibling dots for multi-place works at this location */
          var hoveredWorks = matching.map(function (e) { return e.work; });
          dots.each(function (other) {
            if (other === d) return;
            var shared = other.works.some(function (e) {
              return e.isMultiPlace && hoveredWorks.indexOf(e.work) !== -1;
            });
            if (shared) d3.select(this).attr("fill-opacity", 1).attr("stroke-width", Math.max(1, dotStroke(other) * 2) / s);
          });
          var html = "";
          var show = matching.slice(0, 4);
          show.forEach(function (entry, i) {
            var w = entry.work;
            if (i > 0) html += "<div style='margin-top:0.35rem;padding-top:0.35rem;border-top:1px solid #e2e2e2'></div>";
            html += "<strong>" + shortTitle(w.title) + "</strong>";
            if (w.author && w.author !== "anonymous") html += "<br>" + w.author;
            if (w.date) html += "<br><span class='rl-map-tip-meta'>" + w.date + "</span>";
          });
          if (matching.length > 4) {
            html += "<div style='margin-top:0.35rem' class='rl-map-tip-meta'>… and " + (matching.length - 4) + " more</div>";
          }
          tooltip.html(html).style("opacity", 1);
        })
        .on("mousemove", function (event) {
          var rect = container.getBoundingClientRect();
          var cx = event.clientX - rect.left;
          var flipX = cx > rect.width * 0.65;
          tooltip
            .style("left", flipX ? null : (cx + 14) + "px")
            .style("right", flipX ? (rect.width - cx + 14) + "px" : null)
            .style("top", (event.clientY - rect.top - 14) + "px");
        })
        .on("mouseleave", function (event, d) {
          var s = Math.sqrt(mapState.zoomK || 1);
          /* Restore to current filter state, not default opacity */
          var visWorks = d._visibleWorks || d.works;
          var matching = _hasActiveFilter()
            ? visWorks.filter(function (e) { return workMatchesFilter(e.work); })
            : visWorks;
          if (matching.length === 0) {
            d3.select(this)
              .attr("fill-opacity", _hasActiveFilter() ? 0.15 : 0.3)
              .attr("stroke-width", dotStroke(d) / s);
          } else {
            var numbered = matching.filter(function (e) { return e.work.type !== "folktale"; });
            d3.select(this)
              .attr("fill-opacity", numbered.some(function (e) { return !e.isMultiPlace; }) ? 0.75 : 0.6)
              .attr("stroke-width", dotStroke(d) / s);
          }
          /* Reset sibling dots */
          var hoveredWorks = d.works.map(function (e) { return e.work; });
          dots.each(function (other) {
            if (other === d) return;
            var shared = other.works.some(function (e) {
              return e.isMultiPlace && hoveredWorks.indexOf(e.work) !== -1;
            });
            if (shared) {
              var oVis = other._visibleWorks || other.works;
              var oMatch = _hasActiveFilter()
                ? oVis.filter(function (e) { return workMatchesFilter(e.work); })
                : oVis;
              if (oMatch.length === 0) {
                d3.select(this).attr("fill-opacity", _hasActiveFilter() ? 0.15 : 0.3).attr("stroke-width", dotStroke(other) / s);
              } else {
                var oNum = oMatch.filter(function (e) { return e.work.type !== "folktale"; });
                d3.select(this).attr("fill-opacity", oNum.some(function (e) { return !e.isMultiPlace; }) ? 0.75 : 0.6).attr("stroke-width", dotStroke(other) / s);
              }
            }
          });
          tooltip.style("opacity", 0);
        });

      /* Attach zoom handler now that dotRadius/dotStroke are in scope */
      zoom.on("zoom", function (event) {
        mapState.zoomK = event.transform.k;
        svg.attr("transform", event.transform);
        /* Use sqrt for softer scaling — dots shrink but stay readable */
        var s = Math.sqrt(mapState.zoomK);
        dots.each(function (d) {
          var r = d._visibleR != null ? d._visibleR : dotRadius(d);
          d3.select(this)
            .attr("r", r / s)
            .attr("stroke-width", dotStroke(d) / s);
        });
        svg.selectAll(".rl-map-arc")
          .attr("stroke-width", 1.2 / s)
          .attr("stroke-dasharray", (4 / s) + " " + (3 / s));
      });

      /* --- Connection arcs (great circle lines) --- */
      var arcData = [];
      var seenEdges = {};
      Object.keys(connectionMap).forEach(function (sid) {
        var srcId = Number(sid);
        var src = worksById[srcId];
        if (!src || !src.coords) return;
        connectionMap[srcId].forEach(function (tid) {
          if (!worksById[tid] || !worksById[tid].coords) return;
          var key = Math.min(srcId, tid) + "-" + Math.max(srcId, tid);
          if (seenEdges[key]) return;
          seenEdges[key] = true;
          arcData.push({
            srcId: srcId,
            tgtId: tid,
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [src.coords[1], src.coords[0]],
                [worksById[tid].coords[1], worksById[tid].coords[0]]
              ]
            }
          });
        });
      });

      var arcGroup = svg.append("g")
        .attr("class", "rl-arc-group")
        .style("display", "none");

      arcGroup.selectAll(".rl-map-arc")
        .data(arcData)
        .join("path")
        .attr("class", "rl-map-arc")
        .attr("d", path);

      /* Toggle button */
      var arcToggle = document.createElement("button");
      arcToggle.className = "rl-arc-toggle";
      arcToggle.textContent = "Show connections";
      arcToggle.addEventListener("click", function () {
        var visible = arcGroup.style("display") !== "none";
        arcGroup.style("display", visible ? "none" : null);
        arcToggle.textContent = visible ? "Show connections" : "Hide connections";
      });
      container.appendChild(arcToggle);

      /* Zoom controls */
      var zoomControls = el("div", "rl-map-zoom-controls");
      var zoomIn = el("button", "rl-map-zoom-btn", "+");
      zoomIn.title = "Zoom in";
      zoomIn.addEventListener("click", function () {
        svgRoot.transition().duration(300).call(zoom.scaleBy, 1.5);
      });
      var zoomOut = el("button", "rl-map-zoom-btn", "\u2212");
      zoomOut.title = "Zoom out";
      zoomOut.addEventListener("click", function () {
        svgRoot.transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
      });
      var zoomReset = el("button", "rl-map-zoom-btn", "\u21BA");
      zoomReset.title = "Reset zoom";
      zoomReset.addEventListener("click", function () {
        svgRoot.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      });
      zoomControls.appendChild(zoomIn);
      zoomControls.appendChild(zoomOut);
      zoomControls.appendChild(zoomReset);
      container.appendChild(zoomControls);

      /* Store references for external filtering */
      mapState.svg = svg;
      mapState.projection = projection;
      mapState.path = path;
      mapState.dots = dots;
      mapState.locations = locations;
      mapState.tooltip = tooltip;
      mapState.container = container;
      mapState.arcGroup = arcGroup;
      mapState.arcData = arcData;
      mapState.ready = true;
    });
  }

  /* ========== TIMELINE (Dot Plot) ========== */

  var _updatingFromBrush = false;
  var _updatingFromInput = false;

  function renderTimeline(works) {
    var container = document.getElementById("rl-timeline");
    if (!container || typeof d3 === "undefined") return;

    /* Exclude folktale collections from the timeline (like criticism is excluded from the map) */
    var dated = works.filter(function (d) { return d.year !== null && d.type !== "folktale"; });
    if (!dated.length) return;

    /* --- Controls wrapper: [input] [chart] [input] --- */
    var controlsWrap = el("div", "rl-timeline-controls");
    var inputMin = document.createElement("input");
    inputMin.type = "text";
    inputMin.className = "rl-year-input";
    inputMin.placeholder = "From…";
    inputMin.setAttribute("aria-label", "Start year");

    var chartDiv = el("div", "rl-timeline-chart");

    var inputMax = document.createElement("input");
    inputMax.type = "text";
    inputMax.className = "rl-year-input";
    inputMax.placeholder = "To…";
    inputMax.setAttribute("aria-label", "End year");

    controlsWrap.appendChild(inputMin);
    controlsWrap.appendChild(chartDiv);
    controlsWrap.appendChild(inputMax);
    container.appendChild(controlsWrap);

    /* Status + Reset row */
    var statusRow = el("div", "rl-timeline-status-row");
    var statusText = el("span", "rl-timeline-status", "Showing " + dated.length + " of " + works.length + " works");
    var resetBtn = el("button", "rl-timeline-reset", "Reset");
    resetBtn.style.display = "none";
    statusRow.appendChild(statusText);
    statusRow.appendChild(resetBtn);
    container.appendChild(statusRow);

    /* --- Chart dimensions --- */
    var margin = { top: 12, right: 12, bottom: 48, left: 12 };
    var width = (container.clientWidth || 600) - margin.left - margin.right;

    /* Piecewise linear x scale — period boundaries at equal-width sixths */
    var xMin = -2500;
    var xMax = 2000;
    var w6 = width / 6;
    var x = d3.scaleLinear()
      .domain([-2500, -500, 600, 1450, 1750, 1900, 2000])
      .range([0, w6, w6 * 2, w6 * 3, w6 * 4, w6 * 5, width]);

    /* --- Separate point works vs range works --- */
    var dotR = 3;
    var dotSpacing = dotR * 2 + 1.5;  /* vertical distance between stacked dots */

    /* Render as dot if the bar would be narrower than a dot diameter */
    var MIN_BAR_PX = dotR * 2;
    function isPointWork(w) {
      if (w.yearStart == null || w.yearStart === w.yearEnd) return true;
      return Math.abs(x(w.yearEnd) - x(w.yearStart)) < MIN_BAR_PX;
    }
    var pointWorks = dated.filter(isPointWork)
      .sort(function (a, b) { return a.year - b.year; });

    var rangeWorks = dated.filter(function (w) { return !isPointWork(w); })
      .sort(function (a, b) { return a.yearStart - b.yearStart; });

    /* --- Dodge algorithm for point works: greedy vertical stacking --- */
    var dotPositions = [];
    var occupiedSlots = []; /* [{xPx, yRow}] */
    pointWorks.forEach(function (w) {
      var px = x(w.year);
      var row = 0;
      /* Find lowest row where this dot doesn't overlap */
      var placed = false;
      while (!placed) {
        placed = true;
        for (var i = 0; i < occupiedSlots.length; i++) {
          if (occupiedSlots[i].yRow === row && Math.abs(occupiedSlots[i].xPx - px) < dotR * 2 + 1) {
            row++;
            placed = false;
            break;
          }
        }
      }
      occupiedSlots.push({ xPx: px, yRow: row });
      dotPositions.push({ work: w, px: px, row: row });
    });

    var maxDotRow = dotPositions.length ? d3.max(dotPositions, function (d) { return d.row; }) : 0;

    /* --- Lane packing for range works --- */
    var rangeBarH = 3;
    var rangeLaneH = rangeBarH + 3;
    var rangeLanes = []; /* array of arrays: each lane holds [{xStart, xEnd}] */
    var rangePositions = [];

    rangeWorks.forEach(function (w) {
      var xStart = x(w.yearStart);
      var xEnd = x(w.yearEnd);
      if (xEnd - xStart < 2) xEnd = xStart + 2; /* min width */

      var lane = -1;
      for (var i = 0; i < rangeLanes.length; i++) {
        var fits = true;
        for (var j = 0; j < rangeLanes[i].length; j++) {
          var occ = rangeLanes[i][j];
          if (!(xEnd <= occ.xStart - 1 || xStart >= occ.xEnd + 1)) {
            fits = false;
            break;
          }
        }
        if (fits) { lane = i; break; }
      }
      if (lane === -1) {
        lane = rangeLanes.length;
        rangeLanes.push([]);
      }
      rangeLanes[lane].push({ xStart: xStart, xEnd: xEnd });
      rangePositions.push({ work: w, xStart: xStart, xEnd: xEnd, lane: lane });
    });

    /* --- Compute chart height --- */
    var dotAreaH = (maxDotRow + 1) * dotSpacing + 4;
    var rangeAreaH = rangeLanes.length * rangeLaneH + 4;
    var height = Math.max(80, Math.min(250, dotAreaH + rangeAreaH + 20));
    /* Dots on top, range bars below */
    var dotBaseY = dotAreaH;  /* row 0 at bottom of dot area, stacking upward */
    var rangeBaseY = dotAreaH + 6; /* ranges start below dots */

    var svg = d3.select(chartDiv)
      .append("svg")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    /* --- X axis --- */
    var tickVals = [-2500, -500, 600, 1450, 1750, 1900, 2000];
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(
        d3.axisBottom(x)
          .tickValues(tickVals)
          .tickFormat("")
          .tickSize(4)
      );

    svg.select(".domain").remove();
    svg.selectAll(".tick line").attr("stroke", "#ccc");

    /* --- Period bands along x-axis (also serves as map legend) --- */
    var periodBounds = [
      { period: "Early",          start: -2500, end: -500 },
      { period: "Classical",      start: -500,  end: 600 },
      { period: "Post-Classical", start: 600,   end: 1450 },
      { period: "Early Modern",   start: 1450,  end: 1750 },
      { period: "Modern",         start: 1750,  end: 1900 },
      { period: "Contemporary",   start: 1900,  end: 2000 }
    ];
    var bandH = 3;
    var periodBandRects = [];
    var periodLabelTexts = [];
    periodBounds.forEach(function (pb) {
      var px0 = Math.max(0, x(pb.start));
      var px1 = Math.min(width, x(pb.end));
      if (px1 <= px0) return;
      var rect = svg.append("rect")
        .datum(pb)
        .attr("class", "rl-period-band")
        .attr("x", px0)
        .attr("y", height)
        .attr("width", px1 - px0)
        .attr("height", bandH)
        .attr("fill", PERIOD_COLORS[pb.period])
        .attr("fill-opacity", 0.5)
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          currentFilter.period = (currentFilter.period === d.period) ? "all" : d.period;
          applyFilter();
        });
      periodBandRects.push(rect);
      /* Label centered in band */
      var midX = (px0 + px1) / 2;
      var labelW = px1 - px0;
      if (labelW > 30) {
        var label = svg.append("text")
          .datum(pb)
          .attr("class", "rl-period-label")
          .attr("x", midX)
          .attr("y", height + bandH + 12)
          .attr("text-anchor", "middle")
          .attr("fill", PERIOD_COLORS[pb.period])
          .attr("font-size", labelW > 60 ? "10px" : "8px")
          .attr("font-family", "var(--font-sans)")
          .style("cursor", "pointer")
          .text(pb.period)
          .on("click", function (event, d) {
            currentFilter.period = (currentFilter.period === d.period) ? "all" : d.period;
            applyFilter();
          });
        periodLabelTexts.push(label);
      }
    });

    /* --- Draw dots (point works) --- */
    var dotMarks = svg.selectAll(".rl-dot-mark")
      .data(dotPositions)
      .join("circle")
      .attr("class", "rl-dot-mark")
      .attr("cx", function (d) { return d.px; })
      .attr("cy", function (d) { return dotBaseY - d.row * dotSpacing - dotR; })
      .attr("r", dotR)
      .attr("fill", function (d) { return REGION_COLORS[d.work.region] || "#34568B"; })
      .attr("fill-opacity", 0.75)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);

    /* --- Draw range bars --- */
    var rangeBars = svg.selectAll(".rl-range-bar")
      .data(rangePositions)
      .join("rect")
      .attr("class", "rl-range-bar")
      .attr("x", function (d) { return d.xStart; })
      .attr("y", function (d) { return rangeBaseY + d.lane * rangeLaneH; })
      .attr("width", function (d) { return Math.max(2, d.xEnd - d.xStart); })
      .attr("height", rangeBarH)
      .attr("rx", 1.5)
      .attr("fill", function (d) { return REGION_COLORS[d.work.region] || "#34568B"; })
      .attr("fill-opacity", 0.65);

    /* --- Tooltip --- */
    var tooltip = d3.select(container)
      .append("div")
      .attr("class", "rl-tooltip")
      .style("opacity", 0);

    function showTooltip(event, w) {
      var html = "<strong>" + shortTitle(w.title) + "</strong>";
      if (w.author && w.author !== "anonymous") html += "<br>" + w.author;
      if (w.date) html += "<br><span class='rl-map-tip-meta'>" + w.date + "</span>";
      tooltip.html(html).style("opacity", 1);
      var rect = container.getBoundingClientRect();
      var cx = event.clientX - rect.left;
      var flipX = cx > rect.width * 0.65;
      tooltip
        .style("left", flipX ? null : (cx + 12) + "px")
        .style("right", flipX ? (rect.width - cx + 12) + "px" : null)
        .style("top", (event.clientY - rect.top - 28) + "px");
    }

    function hideTooltip() { tooltip.style("opacity", 0); }

    /* Hover overlays for dots (above brush) */
    svg.selectAll(".rl-dot-hover")
      .data(dotPositions)
      .join("circle")
      .attr("class", "rl-dot-hover")
      .attr("cx", function (d) { return d.px; })
      .attr("cy", function (d) { return dotBaseY - d.row * dotSpacing - dotR; })
      .attr("r", dotR + 3)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("mouseenter", function (event, d) { showTooltip(event, d.work); })
      .on("mousemove", function (event, d) { showTooltip(event, d.work); })
      .on("mouseleave", hideTooltip);

    /* Hover overlays for range bars */
    svg.selectAll(".rl-range-hover")
      .data(rangePositions)
      .join("rect")
      .attr("class", "rl-range-hover")
      .attr("x", function (d) { return d.xStart - 2; })
      .attr("y", function (d) { return rangeBaseY + d.lane * rangeLaneH - 3; })
      .attr("width", function (d) { return Math.max(6, d.xEnd - d.xStart + 4); })
      .attr("height", rangeBarH + 6)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("mouseenter", function (event, d) { showTooltip(event, d.work); })
      .on("mousemove", function (event, d) { showTooltip(event, d.work); })
      .on("mouseleave", hideTooltip);

    /* --- Brush --- */
    var brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on("brush", onBrush)
      .on("end", onBrushEnd);

    var brushG = svg.append("g")
      .attr("class", "rl-brush")
      .call(brush);

    /* Raise hover elements above brush overlay */
    svg.selectAll(".rl-dot-hover").raise();
    svg.selectAll(".rl-range-hover").raise();

    function onBrush(event) {
      if (!event.selection || _updatingFromInput) return;
      _updatingFromBrush = true;
      var s = event.selection;
      var minY = Math.round(x.invert(s[0]));
      var maxY = Math.round(x.invert(s[1]));
      updateTimeRange(minY, maxY);
      _updatingFromBrush = false;
    }

    function onBrushEnd(event) {
      if (_updatingFromInput) return;
      if (!event.selection) {
        _updatingFromBrush = true;
        updateTimeRange(-Infinity, Infinity);
        _updatingFromBrush = false;
      }
    }

    /* --- Year input handlers --- */
    function onInputChange() {
      _updatingFromInput = true;
      var minVal = parseYearInput(inputMin.value);
      var maxVal = parseYearInput(inputMax.value);
      if (minVal === null && maxVal === null) {
        brush.move(brushG, null);
        updateTimeRange(-Infinity, Infinity);
      } else {
        var lo = minVal !== null ? minVal : xMin;
        var hi = maxVal !== null ? maxVal : xMax;
        if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
        lo = Math.max(lo, xMin);
        hi = Math.min(hi, xMax);
        brush.move(brushG, [x(lo), x(hi)]);
        updateTimeRange(lo, hi);
      }
      _updatingFromInput = false;
    }

    inputMin.addEventListener("change", onInputChange);
    inputMax.addEventListener("change", onInputChange);
    inputMin.addEventListener("keydown", function (e) { if (e.key === "Enter") onInputChange(); });
    inputMax.addEventListener("keydown", function (e) { if (e.key === "Enter") onInputChange(); });

    /* --- Reset button --- */
    resetBtn.addEventListener("click", function () {
      currentFilter.period = "all";
      currentFilter.region = "all";
      brush.move(brushG, null);
      _updatingFromBrush = true;
      updateTimeRange(-Infinity, Infinity);
      _updatingFromBrush = false;
      updateLegendHighlights();
      var periodSel = document.getElementById("rl-filter-period");
      var regionSel = document.getElementById("rl-filter-region");
      if (periodSel) periodSel.value = "all";
      if (regionSel) regionSel.value = "all";
    });

    /* --- Store state for external access --- */
    timelineState.x = x;
    timelineState.dotMarks = dotMarks;
    timelineState.rangeBars = rangeBars;
    timelineState.brush = brush;
    timelineState.brushG = brushG;
    timelineState.inputMin = inputMin;
    timelineState.inputMax = inputMax;
    timelineState.statusText = statusText;
    timelineState.resetBtn = resetBtn;
    timelineState.height = height;
    timelineState.totalDated = dated.length;
    timelineState.totalWorks = works.length;
    timelineState.periodBands = svg.selectAll(".rl-period-band");
    timelineState.periodLabels = svg.selectAll(".rl-period-label");

    /* --- Region legend (timeline colored by region) --- */
    var legend = el("div", "rl-legend");
    Object.keys(REGION_COLORS).sort().forEach(function (r) {
      var item = el("span", "rl-legend-item");
      item.dataset.region = r;
      item.style.cursor = "pointer";
      var swatch = el("span", "rl-legend-swatch");
      swatch.style.backgroundColor = REGION_COLORS[r];
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(r));
      item.addEventListener("click", function () {
        currentFilter.region = (currentFilter.region === r) ? "all" : r;
        applyFilter();
      });
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  /* ========== UPDATE FUNCTIONS (brushable timeline) ========== */

  function updateTimeRange(min, max) {
    timeRange.min = min;
    timeRange.max = max;
    updateTimelineMarks(min, max);
    updateMapDots(min, max);
    renderList(filterAndSort());
    syncBrushInputs(min, max);
    updateTimelineStatus(min, max);
    /* Show/hide reset */
    if (timelineState.resetBtn) {
      timelineState.resetBtn.style.display =
        (min === -Infinity && max === Infinity && !_hasActiveFilter()) ? "none" : "";
    }
  }

  function updateTimelineMarks(min, max) {
    var showAll = (min === -Infinity && max === Infinity);

    if (timelineState.dotMarks) {
      timelineState.dotMarks.each(function (d) {
        var inRange = showAll || (d.work.year >= min && d.work.year < max);
        var match = workMatchesFilter(d.work);
        d3.select(this).attr("fill-opacity", (inRange && match) ? 0.75 : 0.08);
      });
    }

    if (timelineState.rangeBars) {
      timelineState.rangeBars.each(function (d) {
        var w = d.work;
        var ys = w.yearStart != null ? w.yearStart : w.year;
        var ye = w.yearEnd != null ? w.yearEnd : w.year;
        var inRange = showAll || (ye >= min && ys < max);
        var match = workMatchesFilter(w);
        d3.select(this).attr("fill-opacity", (inRange && match) ? 0.65 : 0.06);
      });
    }
  }

  function updateMapDots(min, max) {
    if (!mapState.ready || !mapState.dots) return;
    var showAll = (min === -Infinity && max === Infinity);
    var k = Math.sqrt(mapState.zoomK || 1);

    mapState.dots.each(function (d) {
      /* Filter by time range first */
      var timeFiltered;
      if (showAll) {
        timeFiltered = d.works;
      } else {
        timeFiltered = d.works.filter(function (entry) {
          var w = entry.work;
          if (w.year === null) return true; /* folktale — always visible */
          return w.year >= min && w.year < max;
        });
      }

      /* Then filter by legend */
      var visible = _hasActiveFilter() ? timeFiltered.filter(function (e) { return workMatchesFilter(e.work); }) : timeFiltered;
      d._visibleWorks = timeFiltered.length ? timeFiltered : [];

      if (visible.length === 0) {
        d._visibleR = 2.5;
        d3.select(this)
          .attr("fill", "#ccc")
          .attr("fill-opacity", _hasActiveFilter() ? 0.15 : 0.3)
          .attr("r", 2.5 / k);
      } else {
        /* Folktales don't inflate dot size */
        var numbered = visible.filter(function (e) { return e.work.type !== "folktale"; });
        var r = (function () {
          if (numbered.length === 0) {
            var minR = 2.5;
            visible.forEach(function (e) {
              if (e.isMultiPlace) minR = Math.min(minR, multiPlaceRadius(e.totalPlaces));
            });
            return minR;
          }
          var full = numbered.filter(function (e) { return !e.isMultiPlace; }).length;
          if (full === 0) {
            var minR2 = 2.5;
            numbered.forEach(function (e) {
              if (e.isMultiPlace) minR2 = Math.min(minR2, multiPlaceRadius(e.totalPlaces));
            });
            return minR2;
          }
          var n = numbered.length;
          return n === 1 ? 3.5 : Math.min(9, 3.5 + Math.sqrt(n) * 1.5);
        })();
        d._visibleR = r;
        d3.select(this)
          .attr("fill", PERIOD_COLORS[visible[0].work.period] || "#34568B")
          .attr("fill-opacity", numbered.some(function (e) { return !e.isMultiPlace; }) ? 0.75 : 0.6)
          .attr("r", r / k);
      }
    });

    /* Update arc opacity based on time range + legend filter */
    if (mapState.arcGroup) {
      mapState.arcGroup.selectAll(".rl-map-arc").each(function (d) {
        var srcW = worksById[d.srcId];
        var tgtW = worksById[d.tgtId];
        var srcIn = showAll || (srcW && srcW.year !== null && srcW.year >= min && srcW.year < max);
        var tgtIn = showAll || (tgtW && tgtW.year !== null && tgtW.year >= min && tgtW.year < max);
        var srcMatch = srcW && workMatchesFilter(srcW);
        var tgtMatch = tgtW && workMatchesFilter(tgtW);
        d3.select(this).attr("stroke-opacity", (srcIn && tgtIn && srcMatch && tgtMatch) ? 0.6 : 0.12);
      });
    }
  }

  function syncBrushInputs(min, max) {
    if (_updatingFromInput) return;
    if (!timelineState.inputMin) return;
    timelineState.inputMin.value = (min === -Infinity) ? "" : formatYearForInput(min);
    timelineState.inputMax.value = (max === Infinity) ? "" : formatYearForInput(max);
  }

  function updateTimelineStatus(min, max) {
    if (!timelineState.statusText) return;
    var showAll = (min === -Infinity && max === Infinity);
    var count = 0;
    allWorks.forEach(function (w) {
      if (w.year === null) return;
      if (!workMatchesFilter(w)) return;
      var ys = w.yearStart != null ? w.yearStart : w.year;
      var ye = w.yearEnd != null ? w.yearEnd : w.year;
      if (!showAll && !(ye >= min && ys < max)) return;
      count++;
    });
    if (showAll && !_hasActiveFilter()) {
      timelineState.statusText.textContent =
        "Showing " + timelineState.totalDated + " of " + timelineState.totalWorks + " works";
    } else {
      timelineState.statusText.textContent =
        "Showing " + count + " of " + timelineState.totalWorks + " works";
    }
  }

  function parseYearInput(str) {
    if (!str) return null;
    str = str.trim();
    if (!str) return null;
    /* Patterns: "800 BCE", "800 BC", "1200 CE", "1200 AD", "1200", "-800" */
    var m = str.match(/^(-?\d+)\s*(BCE|BC|CE|AD)?$/i);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var suffix = (m[2] || "").toUpperCase();
    if (suffix === "BCE" || suffix === "BC") return -n;
    return n;
  }

  function formatYearForInput(year) {
    if (year < 0) return Math.abs(year) + " BCE";
    return year + " CE";
  }

  /* ========== FILTERS & SORT ========== */

  var currentFilter = { period: "all", region: "all" };
  var liteMode = false;
  var currentSort = "order";
  var allWorks = [];
  var allFolktales = [];
  var worksById = {};
  var connectionMap = {};
  var externalConns = {};  /* id → [{title, year}] for off-list works */

  /* --- Global state for brushable timeline & map filtering --- */
  var timeRange = { min: -Infinity, max: Infinity };
  var timelineState = {};
  var mapState = {};

  /* Whether a work passes the current period/region/lite filter */
  function workMatchesFilter(w) {
    if (currentFilter.period !== "all" && w.period !== currentFilter.period) return false;
    if (currentFilter.region !== "all" && w.region !== currentFilter.region) return false;
    if (liteMode && !w.lite) return false;
    return true;
  }

  var _hasActiveFilter = function () {
    return currentFilter.period !== "all" || currentFilter.region !== "all" || liteMode;
  };

  /* Apply period/region filter to timeline marks, map dots, card list, and legends */
  function applyFilter() {
    /* Update timeline marks */
    if (timelineState.dotMarks) {
      timelineState.dotMarks.each(function (d) {
        var match = workMatchesFilter(d.work);
        var inTime = (timeRange.min === -Infinity && timeRange.max === Infinity) ||
          (d.work.year >= timeRange.min && d.work.year < timeRange.max);
        d3.select(this).attr("fill-opacity", (match && inTime) ? 0.75 : 0.08);
      });
    }
    if (timelineState.rangeBars) {
      timelineState.rangeBars.each(function (d) {
        var w = d.work;
        var match = workMatchesFilter(w);
        var ys = w.yearStart != null ? w.yearStart : w.year;
        var ye = w.yearEnd != null ? w.yearEnd : w.year;
        var showAll = (timeRange.min === -Infinity && timeRange.max === Infinity);
        var inTime = showAll || (ye >= timeRange.min && ys < timeRange.max);
        d3.select(this).attr("fill-opacity", (match && inTime) ? 0.65 : 0.06);
      });
    }

    /* Update map dots and arcs (reuses time-range + filter logic) */
    updateMapDots(timeRange.min, timeRange.max);

    /* Update card list */
    renderList(filterAndSort());

    /* Update status text */
    updateTimelineStatus(timeRange.min, timeRange.max);

    /* Show/hide reset button */
    if (timelineState.resetBtn) {
      timelineState.resetBtn.style.display =
        (timeRange.min === -Infinity && timeRange.max === Infinity && !_hasActiveFilter()) ? "none" : "";
    }

    /* Sync dropdown values */
    var periodSel = document.getElementById("rl-filter-period");
    var regionSel = document.getElementById("rl-filter-region");
    if (periodSel && periodSel.value !== currentFilter.period) periodSel.value = currentFilter.period;
    if (regionSel && regionSel.value !== currentFilter.region) regionSel.value = currentFilter.region;

    /* Update legend highlight states */
    updateLegendHighlights();
  }

  function updateLegendHighlights() {
    /* Period band labels */
    if (timelineState.periodLabels) {
      timelineState.periodLabels.each(function (d) {
        var active = currentFilter.period === "all" || currentFilter.period === d.period;
        d3.select(this).attr("opacity", active ? 1 : 0.3);
      });
    }
    if (timelineState.periodBands) {
      timelineState.periodBands.each(function (d) {
        var active = currentFilter.period === "all" || currentFilter.period === d.period;
        d3.select(this).attr("fill-opacity", active ? 0.5 : 0.15);
      });
    }
    /* Region legend items */
    var regionItems = document.querySelectorAll(".rl-legend-item");
    regionItems.forEach(function (item) {
      var r = item.dataset.region;
      var active = currentFilter.region === "all" || currentFilter.region === r;
      item.style.opacity = active ? "1" : "0.3";
    });
  }

  function renderFilters(works) {
    var periodSelect = document.getElementById("rl-filter-period");
    var regionSelect = document.getElementById("rl-filter-region");

    if (periodSelect) {
      PERIOD_ORDER.forEach(function (p) {
        var count = works.filter(function (w) { return w.period === p; }).length;
        if (count === 0) return;
        var opt = el("option", null, p + " (" + count + ")");
        opt.value = p;
        periodSelect.appendChild(opt);
      });
      periodSelect.addEventListener("change", function () {
        currentFilter.period = this.value;
        applyFilter();
      });
    }

    if (regionSelect) {
      var regions = {};
      works.forEach(function (w) {
        if (w.region) {
          regions[w.region] = (regions[w.region] || 0) + 1;
        }
      });
      Object.keys(regions).sort().forEach(function (r) {
        var opt = el("option", null, r + " (" + regions[r] + ")");
        opt.value = r;
        regionSelect.appendChild(opt);
      });
      regionSelect.addEventListener("change", function () {
        currentFilter.region = this.value;
        applyFilter();
      });
    }

    /* Sort buttons */
    var sortBtns = document.querySelectorAll(".rl-sort-btn");
    sortBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        sortBtns.forEach(function (b) { b.classList.remove("active"); });
        this.classList.add("active");
        currentSort = this.dataset.sort;
        renderList(filterAndSort());
      });
    });

    /* Greatest hits toggle */
    var liteBtn = document.getElementById("rl-lite-toggle");
    if (liteBtn) {
      liteBtn.addEventListener("click", function () {
        liteMode = !liteMode;
        this.classList.toggle("active", liteMode);
        applyFilter();
      });
    }
  }

  function filterAndSort() {
    var list = allWorks.slice();

    if (currentFilter.period !== "all") {
      list = list.filter(function (w) { return w.period === currentFilter.period; });
    }
    if (currentFilter.region !== "all") {
      list = list.filter(function (w) { return w.region === currentFilter.region; });
    }
    if (liteMode) {
      list = list.filter(function (w) { return w.lite; });
    }

    /* Time range filter from brushable timeline (overlap test for range works) */
    if (timeRange.min !== -Infinity || timeRange.max !== Infinity) {
      list = list.filter(function (w) {
        if (w.year === null) return false;
        var ys = w.yearStart != null ? w.yearStart : w.year;
        var ye = w.yearEnd != null ? w.yearEnd : w.year;
        return ye >= timeRange.min && ys < timeRange.max;
      });
    }

    if (currentSort === "time") {
      list.sort(function (a, b) { return (b.readingMinutes || 0) - (a.readingMinutes || 0); });
    } else if (currentSort === "alpha") {
      list.sort(function (a, b) {
        var ta = (a.title || "").replace(/^(the|a|an)\s+/i, "").toLowerCase();
        var tb = (b.title || "").replace(/^(the|a|an)\s+/i, "").toLowerCase();
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
    }
    /* "order" keeps the original id order (chronological) */

    return list;
  }

  /* ========== SCROLL TO WORK ========== */

  function scrollToWork(workId) {
    var el_target = document.getElementById("rl-work-" + workId);
    if (!el_target) {
      /* Target is filtered out — reset all filters and re-render */
      currentFilter.period = "all";
      currentFilter.region = "all";
      timeRange.min = -Infinity;
      timeRange.max = Infinity;
      var periodSel = document.getElementById("rl-filter-period");
      var regionSel = document.getElementById("rl-filter-region");
      if (periodSel) periodSel.value = "all";
      if (regionSel) regionSel.value = "all";
      if (timelineState.brush && timelineState.brushG) {
        timelineState.brush.move(timelineState.brushG, null);
      }
      syncBrushInputs(-Infinity, Infinity);
      updateTimelineStatus(-Infinity, Infinity);
      if (timelineState.resetBtn) timelineState.resetBtn.style.display = "none";
      updateTimelineMarks(-Infinity, Infinity);
      updateMapDots(-Infinity, Infinity);
      updateLegendHighlights();
      renderList(allWorks);
      el_target = document.getElementById("rl-work-" + workId);
    }
    if (!el_target) return;
    el_target.scrollIntoView({ behavior: "smooth", block: "center" });
    el_target.classList.add("rl-card-highlight");
    setTimeout(function () {
      el_target.classList.remove("rl-card-highlight");
    }, 1500);
  }

  /* ========== CARD LIST ========== */

  function renderList(works) {
    var container = document.getElementById("rl-list");
    if (!container) return;
    container.innerHTML = "";

    if (!works || !works.length) {
      container.appendChild(el("p", "rl-empty", "No works match the current filters."));
      return;
    }

    works.forEach(function (w) {
      var card = el("div", "rl-card");
      card.id = "rl-work-" + w.id;
      /* Belt-and-suspenders: enforce flex row inline */
      card.style.display = "flex";
      card.style.flexDirection = "row";
      card.style.alignItems = "flex-start";
      card.style.gap = "0.85rem";
      card.dataset.period = w.period || "";
      card.dataset.region = w.region || "";

      /* Number badge */
      var badgeWrap = el("div", "rl-card-badge");
      badgeWrap.style.flexShrink = "0";
      badgeWrap.appendChild(el("span", "rl-card-num", w.id ? "#" + w.id : ""));
      if (w.lite) {
        badgeWrap.appendChild(el("span", "rl-lite-star", "\u2605"));
      }
      card.appendChild(badgeWrap);

      /* Title & author block */
      var body = el("div", "rl-card-body");
      body.style.flex = "1";
      body.style.minWidth = "0";

      var title = el("div", "rl-card-title");
      var colonIdx = w.title.indexOf(":");
      if (colonIdx !== -1) {
        title.appendChild(document.createTextNode(w.title.substring(0, colonIdx)));
        var sub = el("span", "rl-card-subtitle", w.title.substring(colonIdx + 1));
        title.appendChild(sub);
      } else {
        title.textContent = w.title;
      }
      body.appendChild(title);

      var authorLine = "";
      if (w.author && w.author !== "anonymous") {
        authorLine = w.author;
      }
      if (w.translator) {
        authorLine += (authorLine ? " \u00b7 " : "") + "tr. " + w.translator;
      }
      if (authorLine) {
        body.appendChild(el("div", "rl-card-author", authorLine));
      }

      /* Meta tags row */
      var meta = el("div", "rl-card-meta");
      meta.style.display = "flex";
      meta.style.flexWrap = "wrap";
      meta.style.gap = "0.3rem";

      if (w.date) {
        meta.appendChild(el("span", "rl-tag", w.date));
      }
      if (w.region) {
        var regionTag = el("span", "rl-tag rl-tag-region", w.region);
        regionTag.style.borderColor = REGION_COLORS[w.region] || "#ccc";
        regionTag.style.color = REGION_COLORS[w.region] || "#666";
        meta.appendChild(regionTag);
      }
      if (w.period) {
        var periodTag = el("span", "rl-tag rl-tag-period", w.period);
        periodTag.style.borderColor = PERIOD_COLORS[w.period] || "#ccc";
        periodTag.style.color = PERIOD_COLORS[w.period] || "#666";
        meta.appendChild(periodTag);
      }
      body.appendChild(meta);

      /* Why (reasons for inclusion) */
      if (w.why && w.why.length) {
        var whyDiv = el("div", "rl-card-why");
        whyDiv.textContent = Array.isArray(w.why) ? w.why.join(" \u00b7 ") : w.why;
        body.appendChild(whyDiv);
      }

      /* Collapsible selections list */
      if (w.selections && w.selections.length) {
        var details = document.createElement("details");
        details.className = "rl-card-selections";
        var summary = document.createElement("summary");
        summary.textContent = "Selections (" + w.selections.length + ")";
        details.appendChild(summary);
        var selList = el("div", "rl-card-selections-list");
        selList.textContent = collapseRanges(w.selections);
        details.appendChild(selList);
        body.appendChild(details);
      }

      /* Connections to other works (bidirectional, clickable, directional) */
      var connIds = connectionMap[w.id] || [];
      var extConns = externalConns[w.id] || [];
      if (connIds.length || extConns.length) {
        var earlier = [];
        var later = [];
        var earlierExt = [];
        var laterExt = [];

        connIds.forEach(function (tid) {
          var target = worksById[tid];
          if (!target) return;
          if (target.year !== null && w.year !== null && target.year < w.year) {
            earlier.push(tid);
          } else {
            later.push(tid);
          }
        });

        extConns.forEach(function (ext) {
          if (ext.year != null && w.year !== null && ext.year < w.year) {
            earlierExt.push(ext);
          } else {
            laterExt.push(ext);
          }
        });

        var connDiv = el("div", "rl-card-conn");

        function appendConnLink(tid) {
          var target = worksById[tid];
          if (!target) return;
          var a = document.createElement("a");
          a.className = "rl-conn-link";
          a.href = "#rl-work-" + tid;
          a.textContent = target.title;
          a.addEventListener("click", function (e) {
            e.preventDefault();
            scrollToWork(tid);
          });
          connDiv.appendChild(a);
        }

        function appendExtLink(ext) {
          var cls = "rl-conn-ext" + (ext.nonLiterary ? " rl-conn-ext-nonlit" : "");
          var span = el("span", cls, ext.title);
          connDiv.appendChild(span);
        }

        var hasEarlier = earlier.length || earlierExt.length;
        var hasLater = later.length || laterExt.length;

        if (hasEarlier) {
          connDiv.appendChild(el("span", "rl-conn-label", "\u2190 "));
          var firstE = true;
          earlier.forEach(function (tid) {
            if (!firstE) connDiv.appendChild(document.createTextNode(", "));
            appendConnLink(tid);
            firstE = false;
          });
          earlierExt.forEach(function (ext) {
            if (!firstE) connDiv.appendChild(document.createTextNode(", "));
            appendExtLink(ext);
            firstE = false;
          });
        }
        if (hasEarlier && hasLater) {
          connDiv.appendChild(document.createTextNode("  "));
        }
        if (hasLater) {
          connDiv.appendChild(el("span", "rl-conn-label", "\u2192 "));
          var firstL = true;
          later.forEach(function (tid) {
            if (!firstL) connDiv.appendChild(document.createTextNode(", "));
            appendConnLink(tid);
            firstL = false;
          });
          laterExt.forEach(function (ext) {
            if (!firstL) connDiv.appendChild(document.createTextNode(", "));
            appendExtLink(ext);
            firstL = false;
          });
        }

        body.appendChild(connDiv);
      }

      card.appendChild(body);

      /* Reading time on right */
      var mins = (liteMode && w.litePages) ? w.litePages : (w.readingMinutes || 0);
      var timeStr = mins > 0 ? (w.approximate ? "~" : "") + formatHours(mins) : "";
      var time = el("div", "rl-card-time", timeStr);
      time.style.flexShrink = "0";
      card.appendChild(time);

      /* Read toggle checkbox */
      var toggle = el("label", "rl-card-toggle");
      toggle.title = "Mark as read";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "rl-check";
      checkbox.checked = isRead(w.id);
      checkbox.addEventListener("change", function () {
        setRead(w.id, this.checked);
        card.classList.toggle("rl-card-read", this.checked);
      });
      toggle.appendChild(checkbox);
      var checkmark = el("span", "rl-checkmark");
      toggle.appendChild(checkmark);
      card.appendChild(toggle);

      if (isRead(w.id)) {
        card.classList.add("rl-card-read");
      }

      container.appendChild(card);
    });
  }

  /* ========== CUMULATIVE READING TIME ========== */

  function renderCumulative(works) {
    var container = document.getElementById("rl-cumulative");
    if (!container || typeof d3 === "undefined") return;

    /* Clear previous content (for re-renders on date change) */
    container.innerHTML = "";

    var sorted = works.slice().sort(function (a, b) { return a.id - b.id; });
    var cumData = [];
    var total = 0;
    sorted.forEach(function (w) {
      total += w.readingMinutes || 0;
      cumData.push({ id: w.id, title: w.title, minutes: total });
    });

    if (!cumData.length) return;

    /* Target line */
    var targetMinutes = 365 * 150; /* 365 days × 2.5 hours */

    /* Start date from localStorage or default to Jan 1 of current year */
    var START_DATE_KEY = "rl-start-date";
    var storedDate = null;
    try { storedDate = localStorage.getItem(START_DATE_KEY); } catch (e) { /* noop */ }
    var startDate = storedDate
      ? new Date(storedDate + "T00:00:00")
      : new Date(new Date().getFullYear(), 0, 1);
    if (isNaN(startDate.getTime())) startDate = new Date(new Date().getFullYear(), 0, 1);

    /* Heading */
    container.appendChild(el("h3", "rl-section-title", "Cumulative Reading Time"));

    /* Date picker controls */
    var controls = el("div", "rl-cumulative-controls");
    var label = el("label", "rl-cumulative-label", "Start date ");
    var dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "rl-cumulative-date";
    dateInput.id = "rl-start-date";
    var sy = startDate.getFullYear();
    var sm = startDate.getMonth() + 1;
    var sd = startDate.getDate();
    dateInput.value = sy + "-" + (sm < 10 ? "0" : "") + sm + "-" + (sd < 10 ? "0" : "") + sd;
    dateInput.addEventListener("change", function () {
      try { localStorage.setItem(START_DATE_KEY, this.value); } catch (e) { /* noop */ }
      renderCumulative(works);
    });
    label.appendChild(dateInput);
    controls.appendChild(label);
    container.appendChild(controls);

    /* Chart dimensions — symmetric margins for centering */
    var margin = { top: 20, right: 60, bottom: 40, left: 60 };
    var width = container.clientWidth - margin.left - margin.right;
    var height = 200;

    var svg = d3.select(container)
      .append("svg")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var yMax = Math.max(targetMinutes, total) * 1.05;

    var x = d3.scaleLinear()
      .domain([1, cumData.length])
      .range([0, width]);

    var y = d3.scaleLinear()
      .domain([0, yMax])
      .range([height, 0]);

    /* Right Y-axis: calendar dates (synchronized with left axis) */
    var yMaxDays = yMax / 150;
    var endDate = new Date(startDate.getTime() + yMaxDays * 86400000);
    var yDate = d3.scaleTime()
      .domain([startDate, endDate])
      .range([height, 0]);

    /* 1. Grid lines */
    svg.append("g")
      .attr("class", "rl-cum-grid")
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat("")
          .tickSize(-width)
      );
    svg.selectAll(".rl-cum-grid .tick line").attr("stroke", "#e2e2e2");
    svg.selectAll(".rl-cum-grid .domain").remove();

    /* 2. Target line (red dashed) */
    svg.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(targetMinutes))
      .attr("y2", y(targetMinutes))
      .attr("stroke", "#9b2335")
      .attr("stroke-dasharray", "6 3")
      .attr("stroke-width", 1.5);

    svg.append("text")
      .attr("x", width - 4)
      .attr("y", y(targetMinutes) - 6)
      .attr("text-anchor", "end")
      .attr("fill", "#9b2335")
      .attr("font-size", "10px")
      .text("365-day target (" + formatHoursShort(targetMinutes) + "h)");

    /* Shared area and line generators */
    var area = d3.area()
      .x(function (d) { return x(d.id); })
      .y0(height)
      .y1(function (d) { return y(d.minutes); })
      .curve(d3.curveMonotoneX);

    var line = d3.line()
      .x(function (d) { return x(d.id); })
      .y(function (d) { return y(d.minutes); })
      .curve(d3.curveMonotoneX);

    /* 3. Total cumulative area (blue, low opacity) */
    svg.append("path")
      .datum(cumData)
      .attr("fill", "#34568B")
      .attr("fill-opacity", 0.08)
      .attr("d", area);

    /* 4. Read progress area (green) */
    var readSet = getReadSet();
    var readTotal = 0;
    var readCumData = [];
    sorted.forEach(function (w) {
      if (readSet[w.id]) readTotal += w.readingMinutes || 0;
      readCumData.push({ id: w.id, minutes: readTotal });
    });

    var readAreaPath = svg.append("path")
      .datum(readCumData)
      .attr("fill", "#2c6e49")
      .attr("fill-opacity", 0.15)
      .attr("d", area);

    /* 5. Total cumulative line (blue stroke) */
    svg.append("path")
      .datum(cumData)
      .attr("fill", "none")
      .attr("stroke", "#34568B")
      .attr("stroke-width", 2)
      .attr("d", line);

    /* 6. Today marker */
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    /* Use UTC to avoid DST off-by-one errors */
    var utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    var utcStart = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    var daysSinceStart = Math.floor((utcToday - utcStart) / 86400000);

    if (daysSinceStart >= 0 && daysSinceStart <= 365) {
      var scheduledMinutes = daysSinceStart * 150;
      var todayX = null;
      var todayY = y(scheduledMinutes);

      /* Find x-position by interpolating through cumData */
      if (scheduledMinutes >= total) {
        todayX = x(cumData[cumData.length - 1].id);
      } else {
        /* Walk with an implicit start at (x=0, minutes=0) */
        var prevX = 0;
        var prevM = 0;
        for (var i = 0; i < cumData.length; i++) {
          var curX = x(cumData[i].id);
          var curM = cumData[i].minutes;
          if (scheduledMinutes <= curM) {
            var frac = (curM - prevM) > 0
              ? (scheduledMinutes - prevM) / (curM - prevM)
              : 0;
            todayX = prevX + frac * (curX - prevX);
            break;
          }
          prevX = curX;
          prevM = curM;
        }
        if (todayX === null) todayX = x(cumData[cumData.length - 1].id);
      }

      /* Vertical dashed line */
      svg.append("line")
        .attr("x1", todayX)
        .attr("x2", todayX)
        .attr("y1", height)
        .attr("y2", todayY)
        .attr("stroke", "#999")
        .attr("stroke-dasharray", "4 3")
        .attr("stroke-width", 1);

      /* Dot at intersection */
      svg.append("circle")
        .attr("cx", todayX)
        .attr("cy", todayY)
        .attr("r", 3.5)
        .attr("fill", "#999");

      /* "today" label below x-axis */
      svg.append("text")
        .attr("x", todayX)
        .attr("y", height + 30)
        .attr("text-anchor", "middle")
        .attr("fill", "#999")
        .attr("font-size", "10px")
        .text("today");
    }

    /* 7. Axes */
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(10).tickFormat(function (d) { return "#" + d; }));

    svg.append("g")
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat(function (d) { return Math.round(d / 60) + "h"; })
      );

    /* Right axis: calendar months */
    var rightAxis = svg.append("g")
      .attr("transform", "translate(" + width + ",0)")
      .call(
        d3.axisRight(yDate)
          .ticks(d3.timeMonth.every(1))
          .tickFormat(d3.timeFormat("%b"))
          .tickSize(0)
      );
    rightAxis.selectAll("text").attr("fill", "#999");
    rightAxis.select(".domain").remove();

    svg.selectAll(".domain").remove();

    /* Summary */
    var summaryDiv = el("div", "rl-cumulative-summary");
    container.appendChild(summaryDiv);

    /* Save state for live updates */
    cumulativeState = {
      sorted: sorted,
      cumData: cumData,
      total: total,
      targetMinutes: targetMinutes,
      startDate: startDate,
      area: area,
      readAreaPath: readAreaPath,
      summaryDiv: summaryDiv
    };

    updateCumulativeSummary();
  }

  function updateCumulativeProgress() {
    if (!cumulativeState) return;
    var s = cumulativeState;

    /* Recalculate read cumulative data */
    var readSet = getReadSet();
    var readTotal = 0;
    var readCumData = [];
    s.sorted.forEach(function (w) {
      if (readSet[w.id]) readTotal += w.readingMinutes || 0;
      readCumData.push({ id: w.id, minutes: readTotal });
    });

    /* Update the read-area path */
    s.readAreaPath.datum(readCumData).attr("d", s.area);

    /* Update summary text */
    updateCumulativeSummary();
  }

  function updateCumulativeSummary() {
    if (!cumulativeState) return;
    var s = cumulativeState;
    var summaryDiv = s.summaryDiv;
    summaryDiv.innerHTML = "";

    var readSet = getReadSet();
    var readCount = 0;
    var readMinutes = 0;
    s.sorted.forEach(function (w) {
      if (readSet[w.id]) {
        readCount++;
        readMinutes += w.readingMinutes || 0;
      }
    });

    var totalCount = s.sorted.length;
    var pct = s.total > 0 ? (readMinutes / s.total * 100).toFixed(1) : "0.0";

    /* Line 1: Progress */
    var line1 = document.createElement("span");
    var b1 = document.createElement("strong");
    b1.textContent = readCount;
    line1.appendChild(b1);
    line1.appendChild(document.createTextNode(
      " of " + totalCount + " read  \u00b7  " +
      formatHours(readMinutes) + " of " + formatHours(s.total) +
      "  \u00b7  " + pct + "%"
    ));
    summaryDiv.appendChild(line1);

    /* Line 2: Schedule */
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    /* Use UTC to avoid DST off-by-one errors */
    var utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    var utcStart = Date.UTC(s.startDate.getFullYear(), s.startDate.getMonth(), s.startDate.getDate());
    var daysSinceStart = Math.floor((utcToday - utcStart) / 86400000);
    var yearEndDate = new Date(s.startDate.getTime() + 365 * 86400000);

    var line2 = document.createElement("span");
    line2.className = "rl-cum-schedule";

    if (daysSinceStart < 0) {
      line2.textContent = "Starts " + s.startDate.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
      });
      summaryDiv.appendChild(line2);
    } else if (today > yearEndDate) {
      line2.textContent = "Year complete";
      summaryDiv.appendChild(line2);
    } else {
      var scheduledMinutes = daysSinceStart * 150;
      var diff = readMinutes - scheduledMinutes;
      var diffStr;
      if (diff >= 0) {
        diffStr = formatHours(diff) + " ahead of schedule";
      } else {
        diffStr = formatHours(Math.abs(diff)) + " behind schedule";
      }

      var estStr = "";
      var elapsedDays = Math.max(daysSinceStart, 1);
      if (readMinutes > 0) {
        var rate = readMinutes / elapsedDays;
        var daysToComplete = Math.ceil(s.total / rate);
        var estDate = new Date(s.startDate.getTime() + daysToComplete * 86400000);
        estStr = "  \u00b7  est. completion " + estDate.toLocaleDateString("en-US", {
          month: "short", day: "numeric"
        });
      }

      line2.textContent = "Day " + (daysSinceStart + 1) + " of 365  \u00b7  " + diffStr + estStr;
      summaryDiv.appendChild(line2);
    }
  }

  /* ========== BACK TO TOP ========== */

  function initBackToTop() {
    var app = document.getElementById("reading-list-app");
    if (!app) return;

    var wrap = el("div", "rl-float-buttons");
    app.appendChild(wrap);

    var btn = el("button", "rl-float-btn");
    btn.setAttribute("aria-label", "Back to top");
    var btnArrow = el("span", "rl-float-arrow", "\u2191");
    btn.appendChild(btnArrow);
    btn.appendChild(document.createTextNode(" Top"));
    wrap.appendChild(btn);

    var nextBtn = el("button", "rl-float-btn");
    var nextArrow = el("span", "rl-float-arrow rl-float-arrow-right", "\u2191");
    nextBtn.appendChild(nextArrow);
    nextBtn.appendChild(document.createTextNode(" Next"));
    nextBtn.setAttribute("aria-label", "Next unread work");
    wrap.appendChild(nextBtn);

    var listHeading = document.getElementById("the-list");
    btn.addEventListener("click", function () {
      var header = document.querySelector(".site-header");
      var offset = header ? header.offsetHeight + 8 : 0;
      var top = listHeading.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: top, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", function () {
      var cards = document.querySelectorAll("#rl-list .rl-card:not(.rl-card-read)");
      if (!cards.length) return;
      cards[0].scrollIntoView({ behavior: "smooth", block: "center" });
      cards[0].classList.add("rl-card-highlight");
      setTimeout(function () { cards[0].classList.remove("rl-card-highlight"); }, 1500);
    });

    /* Show when scrolled past the list section */
    var listEl = document.getElementById("rl-list");
    if (!listEl) return;

    var visible = false;
    window.addEventListener("scroll", function () {
      var listTop = listEl.getBoundingClientRect().top;
      var shouldShow = listTop < 0;
      if (shouldShow !== visible) {
        visible = shouldShow;
        wrap.classList.toggle("rl-float-visible", visible);
      }
    }, { passive: true });
  }

})();
