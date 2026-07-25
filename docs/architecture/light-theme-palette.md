# Light Theme Palette — Wanderlog Architecture Diagrams

Reference palette for the light-theme diagrams in [`assets/`](assets/). Reuse these values to keep new diagrams consistent. The draw.io style strings below are kept because the palette started there; the current diagrams are hand-written SVG and map the same roles onto CSS classes.

Canvas: white `#ffffff`. Node names dark `#0f172a`, sublabels slate `#475569`.

## Semantic roles

| Role | Fill | Stroke | Applies to |
|---|---|---|---|
| UI / input | `#cdeff7` | `#0e7490` | user-facing, inputs, human review UIs |
| Service / pipeline | `#d6f0e0` | `#15803d` | backend services, pipeline stages, parsing tools |
| Stage output | `#dbeafe` | `#2563eb` | stage result / hand-off boxes (blue accent) |
| Storage | `#ebe1fb` | `#7c3aed` | database, persistence |
| LLM / connector / provenance | `#ffe6d1` | `#c2410c` | LLM adapter, Bedrock connector, Decision Trail |
| Decision | `#fff2cc` | `#b7860b` | flowchart diamonds |
| Correction / alert | `#fde0e4` | `#be123c` | edit/rollback, error paths |
| Neutral / out of scope | `#eef1f5` | `#64748b` | external, alternatives, deferred integration |
| Region boundary (AWS) | none | `#d97706` | cloud/region dashed outline |

## Text

| Use | Color |
|---|---|
| Title | `#0f172a` (size 18, bold) |
| Subtitle | `#475569` (size 11) |
| Node name | `#0f172a` (bold) |
| Sublabel | `#475569` |
| Decision label | `#5c3a0f` |
| LLM badge (`● LLM`) | `#b45309` |
| Edge label | `#64748b` (label background `#ffffff`) |

## Edges

| Type | Stroke | Notes |
|---|---|---|
| UI / input flow | `#0e7490` | solid |
| Pipeline data flow | `#15803d` | solid, weight 2 |
| LLM call | `#c2410c` | solid |
| Storage write | `#7c3aed` | solid |
| Internal step | `#64748b` | solid |
| Stage hand-off | `#94a3b8` | solid, thin |
| Yes / happy path | `#15803d` | label bold |
| No / correction | `#be123c` | label bold |
| Logged event → trail | `#c2410c` | dashed `5 4` |
| Future / out-of-scope link | `#64748b` | dashed `5 4` |

## Boundaries (dashed, no fill)

| Boundary | Stroke + font | Dash |
|---|---|---|
| AWS region | `#d97706` (font `#b45309`) | `12 4` |
| Presentation | `#2563eb` | `6 4` |
| Pipeline / parsing | `#15803d` | `6 4` |
| LLM access | `#c2410c` | `6 4` |
| Storage | `#7c3aed` | `6 4` |
| Integration (out of scope) | `#64748b` | `10 5` |
| Swim lanes (per stage) | cyan `#0e7490` · green `#15803d` · violet `#7c3aed` · blue `#2563eb` | `8 4` |

Legend box: fill `#f5f7fa`, stroke `#cbd5e1`, text `#475569`.

## draw.io style strings

Paste into an `mxCell` `style=` attribute. Node names use HTML labels: `<b>Title</b><br><font color="#475569">sublabel</font>`.

```
UI / input      rounded=1;whiteSpace=wrap;html=1;fillColor=#cdeff7;strokeColor=#0e7490;fontColor=#0f172a;strokeWidth=1.5;
Service         rounded=1;whiteSpace=wrap;html=1;fillColor=#d6f0e0;strokeColor=#15803d;fontColor=#0f172a;strokeWidth=1.5;
Stage output    rounded=1;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#0f172a;strokeWidth=1.8;
Storage         shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#ebe1fb;strokeColor=#7c3aed;fontColor=#0f172a;strokeWidth=1.5;
LLM / connector rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6d1;strokeColor=#c2410c;fontColor=#0f172a;
Decision        rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#b7860b;fontColor=#5c3a0f;fontStyle=1;
Alert / edit    rounded=1;whiteSpace=wrap;html=1;fillColor=#fde0e4;strokeColor=#be123c;fontColor=#0f172a;
Neutral / alt   rounded=1;whiteSpace=wrap;html=1;fillColor=#eef1f5;strokeColor=#64748b;fontColor=#0f172a;dashed=1;dashPattern=4 3;
Region boundary rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#d97706;dashed=1;dashPattern=12 4;verticalAlign=top;align=left;fontColor=#b45309;
Data-flow edge  edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#15803d;strokeWidth=2;fontColor=#64748b;labelBackgroundColor=#ffffff;
Logged-event    edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#c2410c;dashed=1;dashPattern=5 4;
```

## Dark-theme mapping

The earlier dark versions used the same roles. Light equivalents:

| Role | Dark fill / stroke | Light fill / stroke |
|---|---|---|
| Canvas | `#0f172a` | `#ffffff` |
| UI / input | `#0b3a4a` / `#22d3ee` | `#cdeff7` / `#0e7490` |
| Service | `#0a4a39` / `#34d399` | `#d6f0e0` / `#15803d` |
| Stage output | `#16324f` / `#60a5fa` | `#dbeafe` / `#2563eb` |
| Storage | `#3b1d6b` / `#a78bfa` | `#ebe1fb` / `#7c3aed` |
| LLM / trail | `#5c2a12` / `#fb923c` | `#ffe6d1` / `#c2410c` |
| Decision | `#5c3a0f` / `#fbbf24` | `#fff2cc` / `#b7860b` |
| Alert | `#6b1330` / `#fb7185` | `#fde0e4` / `#be123c` |
| Neutral | `#1e293b` / `#94a3b8` | `#eef1f5` / `#64748b` |
| Node text | `#ffffff` / `#cbd5e1` | `#0f172a` / `#475569` |
