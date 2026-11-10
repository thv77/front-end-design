# BAGACAYA (Proto-Relay) Frontend Clone

This is a complete, pixel-perfect frontend clone of **[bagacaya.com/files/proto-relay](https://bagacaya.com/files/proto-relay)** with all exact animations, motion graphics, and styling preserved.

---

## 🌟 Preserved Animations & Motion Graphics

- **Lime Particle Stream (Page-long WebGL canvas)**:
  - Custom Three.js shaders and Catmull-Rom curve simulation.
  - Multi-tier particle count with dynamic DPR scaling.
  - UnrealBloom postprocessing passes (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`).
- **Smooth Inertia Scrolling**:
  - Powered by Lenis (`lenis.mjs`) with wheel inertia and spring physics.
- **Ring-and-Fold Preloader**:
  - Custom spring constant timing, stage opacity transition, and fold-in hero reveal.
- **Lime Logo Fold System**:
  - Interactive plate expanding out of the logo glyph and folding back seamlessly.
- **52 Graphic & Media Assets**:
  - All SVG marks, UI icons, dot fields, bloom WebP/PNG maps, avatars, and signal indicators preserved locally under `./cloned_bagacaya_relay/assets/`.
- **Local Vendor Runtimes**:
  - Three.js (`three.module.js`) and Lenis smooth scrolling bundled locally in `./cloned_bagacaya_relay/vendor/`.

---

## 🚀 How to Run the Cloned Site

You can start the local preview server with one simple command:

```bash
node preview.mjs
```

Then open your browser to:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 📁 Directory Structure

```text
websiteecloner/
├── cloned_bagacaya_relay/
│   ├── index.html                   # Complete frontend with animations & shaders
│   ├── assets/                      # 52 local SVGs, PNGs, WebP blooms, dot fields
│   │   ├── backdrop/
│   │   ├── footer/
│   │   ├── hero/
│   │   ├── integrations/
│   │   ├── nav/
│   │   ├── pricing/
│   │   ├── product/
│   │   ├── proof/
│   │   ├── scale/
│   │   ├── signals/
│   │   └── statement/
│   └── vendor/                      # Three.js + Lenis + Postprocessing passes
│       ├── three.module.js
│       ├── lenis.mjs
│       ├── postprocessing/
│       │   ├── EffectComposer.js
│       │   ├── UnrealBloomPass.js
│       │   ├── RenderPass.js
│       │   ├── OutputPass.js
│       │   ├── Pass.js
│       │   ├── ShaderPass.js
│       │   └── MaskPass.js
│       └── shaders/
│           ├── CopyShader.js
│           ├── LuminosityHighPassShader.js
│           └── OutputShader.js
├── preview.mjs                      # Local HTTP preview server (port 8080)
├── clone_relay.mjs                  # Asset synchronization & clone pipeline script
└── README.md
```

