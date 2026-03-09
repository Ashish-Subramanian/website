---
title: "My Year-Long Reading List"
date: 2026-01-01
draft: false
d3: true
description: "A chronological journey through 4,300 years of world literature, calibrated to exactly one year of reading at 2.5 hours per day."
---

<div id="reading-list-app">

<div class="rl-hero">
<p class="rl-hero-subtitle">A chronological journey through four millennia of literature, from Sumerian hymns to postmodern novels, calibrated to exactly one year of reading.</p>
<div class="rl-stats" id="rl-stats"></div>
</div>

<div class="rl-intro">

What would it look like to read a survey of the world's literature in a single year? Not a Western canon, but a genuinely global one — Sumerian hymns and Sanskrit epics alongside Greek tragedy, Tang Dynasty poetry alongside the Prose Edda, Swahili *utenzi* alongside Shakespeare?

This is a reading list designed to be completed in exactly 365 days at 2.5 hours per day: the time I spend commuting, cooking, showering, and in the margins of daily life. The works are ordered chronologically by composition date, beginning around 2300 BCE and arriving at the turn of the 21st century. The result is a journey not just through literature but through human civilization itself.

</div>

<div id="rl-map" style="height: 500px; margin: 1rem 0 0; position: relative;"></div>

<div id="rl-timeline"></div>

## The List

<div class="rl-controls">
  <div class="rl-filters">
    <select id="rl-filter-period"><option value="all">All periods</option></select>
    <select id="rl-filter-region"><option value="all">All regions</option></select>
  </div>
  <div class="rl-sort">
    <button class="rl-sort-btn active" data-sort="order">Year</button>
    <button class="rl-sort-btn" data-sort="time">Reading time</button>
    <button class="rl-sort-btn" data-sort="alpha">Title</button>
    <span class="rl-sort-sep"></span>
    <button class="rl-lite-btn" id="rl-lite-toggle">Abridged</button>
  </div>
</div>

<div id="rl-list"></div>

<div class="rl-cumulative" id="rl-cumulative"></div>

<p class="rl-disclaimer">Dates and places of composition are approximations, especially for older works with uncertain provenance. Reading times are estimates based on my personal reading speed and published page counts. Connections between works are necessarily selective and will never be complete.</p>

</div>

<script defer src="/js/reading-list.js"></script>
