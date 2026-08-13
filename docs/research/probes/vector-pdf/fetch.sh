#!/usr/bin/env bash
# Re-download the vector-PDF probe corpus into the current directory.
# Scratch-only: docs/research/drawing-corpora.md bars committing these bytes.
set -euo pipefail

get() { curl -sSL --max-time 120 -o "$2" "$1" && printf '%8s  %s\n' "$(stat -c%s "$2")" "$2"; }

# City of Los Altos Hills standard details — CAD plot -> PostScript -> Distiller.
# Text is outlined; no OCGs. The "vector PDF with zero text" case.
base="https://www.losaltoshills.ca.gov/DocumentCenter/View"
get "$base/227" lah227.pdf
get "$base/232" lah232.pdf
get "$base/254" lah254.pdf
get "$base/226" lah226.pdf   # the complete 39-sheet set

# City of Seattle 2026 Standard Plans — 327 sheets, text-bearing,
# /OCProperties present with zero OCGs (the "shell" trap).
get "https://www.seattle.gov/documents/Departments/SPU/Construction-Resources/standards-guidelines/specifications-plans/2026-Standard-Plans.pdf" seattle.pdf

# Wikimedia Commons, CC BY-SA — vector architectural plans. level11/villa747 carry OCGs.
wm="https://upload.wikimedia.org/wikipedia/commons"
get "$wm/3/31/LEVEL_11_FLOOR_PLAN.pdf" level11.pdf
get "$wm/0/07/747_villa_Floor_plan.pdf" villa747.pdf
get "$wm/c/c1/Gottlieb_House_Ground_Floor_Plan.pdf" gottlieb.pdf
get "$wm/0/02/Plantegning_innend%C3%B8rs.pdf" plantegning.pdf   # a scan in a PDF
