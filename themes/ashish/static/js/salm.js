/**
 * Southern African Languages Map (SALM)
 *
 * Renders an interactive language network over a pre-rendered dot-density map.
 * The dot map PNG and the SVG overlay share Mercator projection parameters
 * defined in salm-centroids.json.
 */
(function () {
  "use strict";

  var container = document.getElementById("salm-map-container");
  if (!container) return;

  // Wait for D3 to load
  function waitForD3(cb) {
    if (typeof d3 !== "undefined" && typeof topojson !== "undefined") return cb();
    setTimeout(function () { waitForD3(cb); }, 50);
  }

  waitForD3(function () { init(); });

  function init() {
    Promise.all([
      d3.json("/data/salm-centroids.json"),
      d3.json("/data/salm-network.json"),
      d3.json("/data/countries-50m.json"),
      d3.json("/data/salm-mds.json"),
      d3.json("/data/salm-lang-slugs.json"),
    ]).then(function (data) {
      var centroidData = data[0];
      var networkData = data[1];
      var world = data[2];
      var mdsData = data[3];
      var langSlugs = data[4];
      renderMap(centroidData, networkData, world, langSlugs);
      renderMDS(mdsData);
      renderDendrogram(mdsData);
    });
  }

  function renderMap(centroidData, networkData, world, langSlugs) {
    var proj = centroidData.projection;
    var centroids = centroidData.centroids;
    var edges = networkData.edges;

    // --- Dimensions ---
    var svgW = proj.imgW;
    var svgH = proj.imgH;

    // --- D3 Mercator fitted to the geographic bounding box ---
    // Create a GeoJSON bbox to fit the projection to
    var bbox = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [proj.lonMin, proj.latMin],
          [proj.lonMax, proj.latMin],
          [proj.lonMax, proj.latMax],
          [proj.lonMin, proj.latMax],
          [proj.lonMin, proj.latMin],
        ]]
      }
    };

    // Mercator projection matching the Python build script exactly.
    // Uses uniform scale (min of x/y) with centering, same as D3 fitSize.
    var deg2rad = Math.PI / 180;
    var rx0 = proj.lonMin * deg2rad;
    var rx1 = proj.lonMax * deg2rad;
    var ry0 = Math.log(Math.tan(Math.PI / 4 + proj.latMin * deg2rad / 2));
    var ry1 = Math.log(Math.tan(Math.PI / 4 + proj.latMax * deg2rad / 2));

    var scaleX = svgW / (rx1 - rx0);
    var scaleY = svgH / (ry1 - ry0);
    var fitScale = Math.min(scaleX, scaleY);

    var projW = fitScale * (rx1 - rx0);
    var projH = fitScale * (ry1 - ry0);
    var tx = (svgW - projW) / 2 - fitScale * rx0;
    var ty = (svgH - projH) / 2 + fitScale * ry1;

    function projectPoint(lon, lat) {
      var mx = lon * deg2rad;
      var my = Math.log(Math.tan(Math.PI / 4 + lat * deg2rad / 2));
      return [fitScale * mx + tx, -fitScale * my + ty];
    }

    // Use geoTransform for exact pixel-level control
    var projection = d3.geoTransform({
      point: function (lon, lat) {
        var p = projectPoint(lon, lat);
        this.stream.point(p[0], p[1]);
      }
    });

    var path = d3.geoPath().projection(projection);

    // --- Create SVG ---
    var svg = d3.select(container)
      .append("svg")
      .attr("viewBox", "0 0 " + svgW + " " + svgH)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .classed("salm-svg", true);

    // --- Clip to bounding box ---
    var clipCorners = [
      projectPoint(proj.lonMin, proj.latMax),
      projectPoint(proj.lonMax, proj.latMax),
      projectPoint(proj.lonMax, proj.latMin),
      projectPoint(proj.lonMin, proj.latMin),
    ];
    var clipPoints = clipCorners.map(function (p) { return p[0] + "," + p[1]; }).join(" ");

    svg.append("defs").append("clipPath")
      .attr("id", "salm-clip")
      .append("polygon")
      .attr("points", clipPoints);

    // --- Dot map layers (per-family + sub-family, stacked) ---
    var allLayers = [
      { key: "all", label: "All", file: "salm-dotmap" },
      { key: "nigercongo", label: "Niger-Congo", file: "salm-nigercongo" },
      { key: "austronesian", label: "Austronesian", file: "salm-austronesian" },
      { key: "indoeuropean", label: "Indo-European", file: "salm-indoeuropean" },
      // Niger-Congo sub-families
      { key: "nguni", label: "Nguni", file: "salm-nguni", parent: "nigercongo" },
      { key: "sothotswana", label: "Sotho-Tswana", file: "salm-sothotswana", parent: "nigercongo" },
      { key: "shona", label: "Shona", file: "salm-shona", parent: "nigercongo" },
      { key: "makhuwa", label: "Makhuwa", file: "salm-makhuwa", parent: "nigercongo" },
      { key: "chichewasena", label: "Chichewa-Sena", file: "salm-chichewasena", parent: "nigercongo" },
      { key: "bemba", label: "Bemba", file: "salm-bemba", parent: "nigercongo" },
      { key: "angolan", label: "Angolan", file: "salm-angolan", parent: "nigercongo" },
      { key: "tsongainhambane", label: "Tsonga", file: "salm-tsongainhambane", parent: "nigercongo" },
      { key: "othernigercongo", label: "Other", file: "salm-othernigercongo", parent: "nigercongo" },
    ];

    var layerImages = {};
    allLayers.forEach(function (f) {
      layerImages[f.key] = svg.append("image")
        .attr("href", "/images/blog/" + f.file + ".png")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", svgW)
        .attr("height", svgH)
        .attr("preserveAspectRatio", "none")
        .style("opacity", f.key === "all" ? 1 : 0)
        .style("pointer-events", "none");
    });

    // --- Filter buttons ---
    var filterBar = d3.select(container)
      .insert("div", ":first-child")
      .attr("class", "salm-filters");

    var topRow = filterBar.append("div").attr("class", "salm-filter-row");
    var subRow = filterBar.append("div").attr("class", "salm-filter-row salm-filter-sub");

    var topFamilies = allLayers.filter(function (f) { return !f.parent; });
    var subFamilies = allLayers.filter(function (f) { return f.parent === "nigercongo"; });

    function setLayer(key) {
      allLayers.forEach(function (f) {
        layerImages[f.key].style("opacity", f.key === key ? 1 : 0);
      });
    }

    topFamilies.forEach(function (f) {
      topRow.append("button")
        .attr("class", "salm-filter-btn" + (f.key === "all" ? " active" : ""))
        .attr("data-key", f.key)
        .text(f.label)
        .on("click", function () {
          topRow.selectAll(".salm-filter-btn").classed("active", false);
          d3.select(this).classed("active", true);
          subRow.selectAll(".salm-filter-btn").classed("active", false);

          // Show/hide sub-row
          subRow.classed("visible", f.key === "nigercongo");

          setLayer(f.key);
        });
    });

    subFamilies.forEach(function (f) {
      subRow.append("button")
        .attr("class", "salm-filter-btn")
        .attr("data-key", f.key)
        .text(f.label)
        .on("click", function () {
          subRow.selectAll(".salm-filter-btn").classed("active", false);
          d3.select(this).classed("active", true);
          // Also mark Niger-Congo as active in top row
          topRow.selectAll(".salm-filter-btn").classed("active", false);
          topRow.select("[data-key=nigercongo]").classed("active", true);

          setLayer(f.key);
        });
    });

    // --- Country borders (clipped to region) ---
    var countries = topojson.feature(world, world.objects.countries);

    svg.append("g")
      .attr("class", "salm-countries")
      .attr("clip-path", "url(#salm-clip)")
      .selectAll("path")
      .data(countries.features)
      .enter().append("path")
      .attr("d", path);

    // --- Build centroid lookup ---
    var centroidMap = {};
    centroids.forEach(function (c) {
      var pos = projectPoint(c.lon, c.lat);
      c.x = pos[0];
      c.y = pos[1];
      centroidMap[c.lang] = c;
    });

    // --- For network languages without dot centroids, skip them ---
    var validEdges = edges.filter(function (e) {
      return centroidMap[e.source] && centroidMap[e.target];
    });

    // --- Scale for node radius ---
    var maxCount = d3.max(centroids, function (c) { return c.count; });
    var rScale = d3.scaleSqrt()
      .domain([0, maxCount])
      .range([2, 18]);

    // --- Draw edges ---
    var edgeGroup = svg.append("g").attr("class", "salm-edges");

    edgeGroup.selectAll("line")
      .data(validEdges)
      .enter().append("line")
      .attr("x1", function (e) { return centroidMap[e.source].x; })
      .attr("y1", function (e) { return centroidMap[e.source].y; })
      .attr("x2", function (e) { return centroidMap[e.target].x; })
      .attr("y2", function (e) { return centroidMap[e.target].y; })
      .attr("stroke-opacity", function (e) {
        // Closer languages = more opaque
        return Math.max(0.08, 1 - e.distance * 3);
      })
      .attr("stroke-width", function (e) {
        return e.mst ? 1.5 : 1;
      });

    // --- Per-language layer (loaded on click) ---
    var langLayer = svg.append("image")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", svgW)
      .attr("height", svgH)
      .attr("preserveAspectRatio", "none")
      .style("opacity", 0)
      .style("pointer-events", "none");

    var selectedLang = null;

    function selectLanguage(lang) {
      if (lang && langSlugs[lang]) {
        selectedLang = lang;
        // Hide all family layers, show the language layer
        allLayers.forEach(function (f) {
          layerImages[f.key].style("opacity", 0);
        });
        langLayer
          .attr("href", "/images/blog/salm-langs/" + langSlugs[lang] + ".png")
          .style("opacity", 1);
        // Update filter buttons
        topRow.selectAll(".salm-filter-btn").classed("active", false);
        subRow.selectAll(".salm-filter-btn").classed("active", false);
        subRow.classed("visible", false);
      }
    }

    function deselectLanguage() {
      selectedLang = null;
      langLayer.style("opacity", 0);
      // Restore "All" view
      setLayer("all");
      topRow.selectAll(".salm-filter-btn").classed("active", false);
      topRow.select("[data-key=all]").classed("active", true);
      subRow.classed("visible", false);
    }

    // Click on background to deselect
    svg.on("click", function (event) {
      if (event.target.tagName === "svg" || event.target.tagName === "image" ||
          event.target.closest(".salm-countries")) {
        deselectLanguage();
      }
    });

    // --- Draw nodes ---
    var nodeGroup = svg.append("g").attr("class", "salm-nodes");

    var nodes = nodeGroup.selectAll("g")
      .data(centroids.filter(function (c) { return c.lang !== "Other European"; }))
      .enter().append("g")
      .attr("transform", function (c) { return "translate(" + c.x + "," + c.y + ")"; })
      .attr("class", "salm-node");

    nodes.append("circle")
      .attr("r", function (c) { return rScale(c.count); })
      .attr("fill", function (c) { return c.color; })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    // --- Tooltip ---
    var tooltip = d3.select(container)
      .append("div")
      .attr("class", "salm-tooltip");

    nodes
      .on("click", function (event, c) {
        event.stopPropagation();
        if (selectedLang === c.lang) {
          deselectLanguage();
        } else {
          selectLanguage(c.lang);
        }
      })
      .on("mouseenter", function (event, c) {
        tooltip
          .html(
            "<strong>" + c.lang + "</strong><br>" +
            c.count.toLocaleString() + " speakers"
          )
          .style("display", "block");

        // Highlight connected edges
        edgeGroup.selectAll("line")
          .classed("salm-edge-dim", true)
          .filter(function (e) {
            return e.source === c.lang || e.target === c.lang;
          })
          .classed("salm-edge-dim", false)
          .classed("salm-edge-highlight", true);

        // Dim other nodes
        nodeGroup.selectAll(".salm-node")
          .classed("salm-node-dim", function (n) { return n.lang !== c.lang; });
      })
      .on("mousemove", function (event) {
        var rect = container.getBoundingClientRect();
        tooltip
          .style("left", (event.clientX - rect.left + 12) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseleave", function () {
        tooltip.style("display", "none");
        edgeGroup.selectAll("line")
          .classed("salm-edge-dim", false)
          .classed("salm-edge-highlight", false);
        nodeGroup.selectAll(".salm-node")
          .classed("salm-node-dim", false);
      });
  }

  // =========================================================================
  // MDS Scatter Plot
  // =========================================================================
  function renderMDS(mdsData) {
    var mdsContainer = document.getElementById("salm-mds-container");
    if (!mdsContainer) return;

    var points = mdsData.points;
    var familyColors = mdsData.familyColors;

    var margin = { top: 30, right: 30, bottom: 30, left: 30 };
    var width = 800;
    var height = 600;

    var xExtent = d3.extent(points, function (p) { return p.x; });
    var yExtent = d3.extent(points, function (p) { return p.y; });

    // Add padding
    var xPad = (xExtent[1] - xExtent[0]) * 0.08;
    var yPad = (yExtent[1] - yExtent[0]) * 0.08;

    var xScale = d3.scaleLinear()
      .domain([xExtent[0] - xPad, xExtent[1] + xPad])
      .range([margin.left, width - margin.right]);

    var yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([margin.top, height - margin.bottom]);

    var svg = d3.select(mdsContainer)
      .append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .classed("salm-mds-svg", true);

    // Tooltip
    var tooltip = d3.select(mdsContainer)
      .append("div")
      .attr("class", "salm-tooltip");

    // Draw points
    var dots = svg.selectAll("g.mds-point")
      .data(points)
      .enter().append("g")
      .attr("class", "mds-point")
      .attr("transform", function (p) {
        return "translate(" + xScale(p.x) + "," + yScale(p.y) + ")";
      });

    dots.append("circle")
      .attr("r", 4.5)
      .attr("fill", function (p) { return p.color; })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.8)
      .attr("opacity", 0.85);

    dots.append("text")
      .attr("class", "mds-label")
      .attr("dx", 6)
      .attr("dy", 3)
      .text(function (p) { return p.lang; });

    // Hover interactions
    dots
      .on("mouseenter", function (event, p) {
        var label = p.subfamily ? p.family + " · " + p.subfamily : p.family;
        tooltip
          .html("<strong>" + p.lang + "</strong><br>" + label)
          .style("display", "block");

        // Dim others, highlight same group
        var groupKey = p.subfamily || p.family;
        dots.selectAll("circle").attr("opacity", 0.15);
        dots.filter(function (d) {
          return (d.subfamily || d.family) === groupKey;
        }).selectAll("circle").attr("opacity", 1);

        d3.select(this).selectAll("circle").attr("opacity", 1).attr("r", 7);
      })
      .on("mousemove", function (event) {
        var rect = mdsContainer.getBoundingClientRect();
        tooltip
          .style("left", (event.clientX - rect.left + 12) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseleave", function () {
        tooltip.style("display", "none");
        dots.selectAll("circle").attr("opacity", 0.85).attr("r", 4.5);
      });

    // Legend — show top-level families only (sub-families visible on hover)
    var legendItems = [
      { label: "Austronesian", color: familyColors["Austronesian"] },
      { label: "Indo-European", color: familyColors["Indo-European"] },
      { label: "Khoisan", color: familyColors["Khoisan"] || "#9b59b6" },
      { label: "Niger-Congo", color: familyColors["Niger-Congo"] },
    ];

    var legend = svg.append("g")
      .attr("transform", "translate(" + (width - margin.right - 140) + "," + (margin.top + 10) + ")");

    legendItems.forEach(function (item, i) {
      var row = legend.append("g")
        .attr("transform", "translate(0," + (i * 20) + ")");
      row.append("circle")
        .attr("r", 5)
        .attr("fill", item.color);
      row.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .attr("class", "mds-legend-text")
        .text(item.label);
    });
  }

  // =========================================================================
  // Dendrogram
  // =========================================================================
  function renderDendrogram(mdsData) {
    var dendContainer = document.getElementById("salm-dendro-container");
    if (!dendContainer) return;

    var tree = mdsData.dendrogram;
    var familyColors = mdsData.familyColors;

    // Count leaves to size the chart
    function countLeaves(node) {
      if (!node.children) return 1;
      return countLeaves(node.children[0]) + countLeaves(node.children[1]);
    }
    var nLeaves = countLeaves(tree);

    var margin = { top: 20, right: 200, bottom: 20, left: 20 };
    var width = 900;
    var height = Math.max(400, nLeaves * 12);

    var svg = d3.select(dendContainer)
      .append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .classed("salm-dendro-svg", true);

    // Convert to d3 hierarchy
    var root = d3.hierarchy(tree);

    // Use cluster layout (leaves equally spaced)
    var cluster = d3.cluster()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    cluster(root);

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Scale x by distance (deeper = further right)
    function maxDist(node) {
      if (!node.children) return 0;
      return Math.max(node.data.dist || 0,
        maxDist(node.children[0]), maxDist(node.children[1]));
    }
    var dMax = maxDist(root);
    var xMax = width - margin.left - margin.right;

    function distX(node) {
      if (!node.data.dist && node.data.dist !== 0) return xMax; // leaf
      return xMax * (1 - (node.data.dist || 0) / dMax);
    }

    // Draw links (elbow connectors)
    g.selectAll("path.dendro-link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "dendro-link")
      .attr("d", function (d) {
        var sx = distX(d.source);
        var sy = d.source.x;
        var tx = distX(d.target);
        var ty = d.target.x;
        return "M" + sx + "," + sy +
               "H" + sx +
               "V" + ty +
               "H" + tx;
      });

    // Draw leaf labels
    var subfamColors = mdsData.subfamilyColors || {};
    var leaves = root.leaves();

    function leafColor(d) {
      if (d.data.subfamily && subfamColors[d.data.subfamily]) {
        return subfamColors[d.data.subfamily];
      }
      return familyColors[d.data.family] || "#666";
    }

    g.selectAll("text.dendro-label")
      .data(leaves)
      .enter().append("text")
      .attr("class", "dendro-label")
      .attr("x", function (d) { return distX(d) + 4; })
      .attr("y", function (d) { return d.x; })
      .attr("dy", "0.35em")
      .attr("fill", leafColor)
      .text(function (d) { return d.data.name; });

    // Draw leaf dots
    g.selectAll("circle.dendro-leaf")
      .data(leaves)
      .enter().append("circle")
      .attr("class", "dendro-leaf")
      .attr("cx", function (d) { return distX(d); })
      .attr("cy", function (d) { return d.x; })
      .attr("r", 3)
      .attr("fill", leafColor);
  }
})();
