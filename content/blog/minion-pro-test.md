---
title: "Minion Pro Feature Test"
date: 2026-03-04
draft: true
---

A test page to see which OpenType features survive in Minion Pro's TTF files on the web.

## Small Caps

Regular: etc., nato, unicef, adhd, usa, phd

Small caps shortcode: {{< sc >}}etc.{{< /sc >}}, {{< sc >}}nato{{< /sc >}}, {{< sc >}}unicef{{< /sc >}}, {{< sc >}}adhd{{< /sc >}}, {{< sc >}}usa{{< /sc >}}, {{< sc >}}phd{{< /sc >}}

All small caps (both uppercase and lowercase become small caps): <span class="c2sc">NATO</span>, <span class="c2sc">UNICEF</span>, <span class="c2sc">USA</span>

## Figures

Default: 0123456789

<span class="onum">Old-style figures: 0123456789 — compare 1847 and 2026 in running text</span>

<span class="lnum">Lining figures: 0123456789 — uniform height for tables</span>

## Fractions

Default: 1/2, 1/4, 3/4, 1/3, 2/3, 7/8

<span class="frac">Fractions: 1/2, 1/4, 3/4, 1/3, 2/3, 7/8</span>

## Ligatures

Default: fi, fl, ff, ffi, ffl

<span class="liga">Discretionary ligatures: fi, fl, ff, ffi, ffl, ct, st, Th</span>

## Swash

Regular: A Beautiful Calligraphic Typeface

<span class="swsh">Swash: A Beautiful Calligraphic Typeface</span>

## Ordinals

Default: 1st, 2nd, 3rd, 4th

<span class="ordn">Ordinals: 1st, 2nd, 3rd, 4th</span>

## Diacritics & Latin Extended

**European:** àáâãäå æ ç èéêë ìíîï ð ñ òóôõö ø ùúûü ý þ ÿ ß œ ł ž š č ř ů ő ű ț ș ă

**Vietnamese:** ắ ằ ẳ ẵ ặ ấ ầ ẩ ẫ ậ ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự

**African Latin:** ɓ ɗ ɛ ɔ ŋ ƙ ɲ ẹ ọ ṣ

**Swahili:** Habari za asubuhi! Ninafuraha kukutana nawe.

**Turkish:** İstanbul güneşli, öğretmen çalışıyor.

**IPA (if supported):** ʃ ʒ θ ð ŋ ɲ ɣ ʔ ə ɛ ɔ ɪ ʊ ɑ

## Non-Latin Scripts (will need companion fonts)

**Arabic/Ajami:** بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ

**Tamil:** வணக்கம், நான் ஆஷிஷ்

**Telugu:** నమస్కారం

**Devanagari:** नमस्ते

**Javanese:** ꦲꦤꦕꦫꦏ

These will fall back to system fonts or display as missing glyphs — confirming where we need to add companion fonts.
