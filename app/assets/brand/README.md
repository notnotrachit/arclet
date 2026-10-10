# Arclet brand assets

The interlocking arc monogram represents connection and shared movement. Blue ribbons carry the app's sky-to-navy palette; a gold connection adds warmth.

## Usage

- `arclet-mark.png`: transparent master symbol for splash screens and in-app branding.
- `arclet-icon.png`: opaque square launcher icon; operating systems apply the corner mask.
- `arclet-adaptive-foreground.png`: transparent Android foreground with safe-area padding.
- `arclet-monochrome.png`: Android themed-icon silhouette.
- `arclet-favicon.png`: browser icon.

Keep the symbol's proportions intact. Use the shared `Brand` component for in-app lockups. Native splash and launcher assets are configured in `app.json` and require rebuilding the native app.

## Generation

The concept was generated with the built-in imagegen tool, then rebuilt as clean vector geometry for consistent edges and transparent cutouts. SVG sources are the production masters. Run `python3 app/scripts/build-brand-assets.py` from the repository root to regenerate the PNG exports (requires `rsvg-convert`).

Master prompt:

Use case: logo-brand. Asset type: production logo symbol for Arclet, a modern mobile wallet for sending dollars and sharing expenses. Create ONE original, exceptionally clean geometric brand mark, no text: a distinctive lowercase-a / arch monogram constructed from two interlocking rounded ribbon arcs. Express connection and effortless movement, with a small warm gold segment where the arcs meet. Confident simple silhouette that stays recognizable at 24 pixels. Rich cobalt blue #487EB9 transitioning subtly to sky blue #8EC9F3, small gold #D9A65C accent. Crisp flat vector-like geometry, smooth consistent curved edges, restrained gradient within the ribbons only. Center mark large within square canvas, about 75% canvas width, generous transparent margin. Background must be genuinely transparent, including all negative space. No enclosing tile, no text, no wordmark, no mockup, no multiple alternatives, no 3D, no shadow, no glow, no grain, no intricate orbital lines. This is an original Arclet identity; do not copy the Arc brand logo or any existing company logo.
