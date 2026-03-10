---
title: "My Year-Long Reading List"
date: 2026-01-01
draft: false
d3: true
description: "A chronological journey through 4,300 years of world literature, calibrated to exactly one year of reading at 2.5 hours per day."
---

<div id="reading-list-app">

<div class="rl-hero">
<p class="rl-hero-subtitle">A year-long chronological journey through four millennia of literature, from Sumerian hymns to postmodern novels.</p>
<div class="rl-stats" id="rl-stats"></div>
</div>

<div class="rl-intro" markdown="1">

The following reading list intends to present a survey of the world's literature until 2000 that can be read in exactly one year given 2.5 hours of reading time every day. Also presented is an abridged list that can be read in one year given one hour a day.{{% sidenote %}}Simplistically, both lists assume an average word count of 300 words per page and an average reading speed of 300 words per minute. This will likely not be a sustainable pace.{{% /sidenote %}}

The goals of this list are to present an even picture of the world's major literary traditions across space and time; in other words, what are the core "tentpoles" that support the world literary canon? This selection philosophy has led to some seemingly curious inclusions and omissions; for example, though Charles Dickens remains one of the most influential writers in the English language, his *Great Expectations* was excluded for overlap with George Eliot's *Middlemarch*, which I deemed to be a better representative of the Victorian realist novel. Meanwhile, you may not have heard of the *huēhuetlahtōlli*, but they remain one of the few surviving bodies of pre-Columbian prose, wisdom literature, and philosophy that we have, and they are important to read for gaining a worlded understanding of literature.{{% sidenote %}}Note that I still do account for sheer importance, which partly explains why we have multiple Sanskrit epics, classic Chinese novels, and plays by William Shakespeare.{{% /sidenote %}}

I developed this list after completing my applications and interviews for MD-PhD programs and realizing how much empty time I had in my day; I spend easily upwards of 2.5 hours a day riding the bus, cooking, showering, doomscrolling social media, or what have you, and I decided I'd try doing something productive with that time this year.

I hope that you too find this list to be useful; even if you don't read the full list, I hope it can provide recommendations for a next read or provoke thinking on the meaning of literature as a millennia-long, global art form.

</div>

## Map and Timeline

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
