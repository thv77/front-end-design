# Front-End Motion & WebGL Design System

A high-performance, pixel-perfect frontend interactive design system featuring custom Three.js WebGL particle streams, bloom post-processing passes, spring-physics animations, and smooth inertia scrolling.

---

## 🌟 Key Features & Animations

- **WebGL Particle Stream (Page-Long Canvas)**:
  - Custom Three.js GLSL shaders along dynamic Catmull-Rom spline curves.
  - Multi-tier particle count scaling with adaptive device-pixel-ratio (DPR).
  - Post-processing bloom pipeline using `EffectComposer`, `UnrealBloomPass`, and custom output shaders.
- **Smooth Inertia Scrolling**:
  - Powered by the **Lenis** smooth wheel scrolling engine with spring constants and momentum physics.
- **Ring-and-Fold Preloader**:
  - Timed stage opacity transitions, paint performance observers, and fold-in hero reveal sequence.
- **Interactive Component Systems**:
  - Spring-driven navigation plate expansion and docking.
  - Interactive pricing knobs, live metric signals, SVG dot matrices, and glowing bloom cards.
- **100% Offline & Self-Contained**:
  - All 52 SVG graphics, WebP blooms, textures, and runtime modules (`Three.js`, `Lenis`) are bundled locally with relative asset paths.

---

## 🚀 Getting Started

### Local Preview
Run the included preview server:

```bash
npm start
```

Open your browser to:
👉 **[http://localhost:8080](http://localhost:8080)** (or the port shown in your terminal)

---

## 📁 Project Architecture

```text
front-end-design/
├── index.html                   # Complete single-page frontend application
├── assets/                      # 52 local SVG marks, PNGs, WebP blooms & textures
│   ├── backdrop/
│   ├── footer/
│   ├── hero/
│   ├── integrations/
│   ├── nav/
│   ├── pricing/
│   ├── product/
│   ├── proof/
│   ├── scale/
│   ├── signals/
│   └── statement/
├── vendor/                      # Bundled Three.js engine & Lenis smooth scroll
│   ├── three.core.js
│   ├── three.module.js
│   ├── lenis.mjs
│   ├── postprocessing/          # EffectComposer, UnrealBloomPass, RenderPass
│   └── shaders/                 # GLSL Shaders & Bloom passes
├── preview.mjs                  # Lightweight local HTTP preview server
├── package.json
└── README.md
```

---

## 🌐 Deployment

### GitHub Pages
1. In your GitHub repository, navigate to **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions** (the included workflow deploys automatically on every push) or choose **Deploy from a branch** (`main` / `/(root)`).

### Vercel / Netlify
Deploy directly by connecting your repository. No build step required — the site is ready to serve statically out of the box.
