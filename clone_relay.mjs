import fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, 'cloned_bagacaya_relay');
const ASSETS_DIR = path.join(TARGET_DIR, 'assets');
const VENDOR_DIR = path.join(TARGET_DIR, 'vendor');

await fs.mkdir(ASSETS_DIR, { recursive: true });
await fs.mkdir(VENDOR_DIR, { recursive: true });
await fs.mkdir(path.join(VENDOR_DIR, 'postprocessing'), { recursive: true });
await fs.mkdir(path.join(VENDOR_DIR, 'shaders'), { recursive: true });

let html = await fs.readFile(path.join(__dirname, 'raw_page.html'), 'utf8');

// 1. Collect all storage.getlayers.ai URLs
const assetRegex = /https:\/\/storage\.getlayers\.ai\/assets\/relay-4ee0729d77\/([^\s"'()><]+)/g;
const assetMap = new Map();

let match;
while ((match = assetRegex.exec(html)) !== null) {
  const fullUrl = match[0];
  const relSubPath = match[1];
  if (!assetMap.has(fullUrl)) {
    assetMap.set(fullUrl, relSubPath);
  }
}

console.log(`Found ${assetMap.size} unique storage assets to download.`);

async function downloadFile(url, destPath) {
  try {
    const dir = path.dirname(destPath);
    await fs.mkdir(dir, { recursive: true });

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.warn(`[WARN] Failed to download ${url}: HTTP ${res.status}`);
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(destPath, buffer);
    return true;
  } catch (err) {
    console.error(`[ERROR] Error downloading ${url}:`, err.message);
    return false;
  }
}

// Download all storage assets
let downloadedCount = 0;
for (const [fullUrl, relSubPath] of assetMap.entries()) {
  const destPath = path.join(ASSETS_DIR, relSubPath);
  const ok = await downloadFile(fullUrl, destPath);
  if (ok) downloadedCount++;
  if (downloadedCount % 10 === 0 || downloadedCount === assetMap.size) {
    console.log(`Assets: ${downloadedCount}/${assetMap.size} downloaded.`);
  }
}

// 2. Download Vendor Libraries (Three.js & Lenis & Three Addons)
console.log('Downloading Three.js, Lenis and Three Addons postprocessing shaders...');

const vendorFiles = [
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js',
    dest: path.join(VENDOR_DIR, 'three.module.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.mjs',
    dest: path.join(VENDOR_DIR, 'lenis.mjs')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/postprocessing/EffectComposer.js',
    dest: path.join(VENDOR_DIR, 'postprocessing', 'EffectComposer.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/postprocessing/OutputPass.js',
    dest: path.join(VENDOR_DIR, 'postprocessing', 'OutputPass.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/postprocessing/RenderPass.js',
    dest: path.join(VENDOR_DIR, 'postprocessing', 'RenderPass.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/postprocessing/UnrealBloomPass.js',
    dest: path.join(VENDOR_DIR, 'postprocessing', 'UnrealBloomPass.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/postprocessing/Pass.js',
    dest: path.join(VENDOR_DIR, 'postprocessing', 'Pass.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/postprocessing/MaskPass.js',
    dest: path.join(VENDOR_DIR, 'postprocessing', 'MaskPass.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/shaders/CopyShader.js',
    dest: path.join(VENDOR_DIR, 'shaders', 'CopyShader.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/shaders/LuminosityHighPassShader.js',
    dest: path.join(VENDOR_DIR, 'shaders', 'LuminosityHighPassShader.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/shaders/OutputShader.js',
    dest: path.join(VENDOR_DIR, 'shaders', 'OutputShader.js')
  }
];

for (const vf of vendorFiles) {
  console.log(`Downloading vendor: ${path.basename(vf.dest)}...`);
  await downloadFile(vf.url, vf.dest);
}

// 3. Rewrite HTML to point to local assets and clean fonts
console.log('Rewriting HTML asset paths and font imports...');

// Replace storage assets with ./assets/
html = html.replace(/https:\/\/storage\.getlayers\.ai\/assets\/relay-4ee0729d77\//g, './assets/');

// Replace broken Cloudflare fonts block with clean Google Fonts & Fontshare
const fontReplacement = `
<!-- Typography: Inter, Instrument Serif, Fragment Mono -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
`;

html = html.replace(/<style type="text\/css">@font-face[\s\S]*?<\/style>/i, fontReplacement);

// Replace importmap to point directly to local vendor files with fallback
const newImportMap = `
<script type="importmap" data-cfasync="false">
{
  "imports": {
    "three": "./vendor/three.module.js",
    "three/addons/": "./vendor/",
    "lenis": "./vendor/lenis.mjs"
  }
}
</script>
`;

html = html.replace(/<script type="importmap"[\s\S]*?<\/script>/i, newImportMap);

// Replace modulepreload
html = html.replace(/<link rel="modulepreload"[^>]*>/gi, '<link rel="modulepreload" href="./vendor/three.module.js">');

// Save the finished index.html
const finalIndexPath = path.join(TARGET_DIR, 'index.html');
await fs.writeFile(finalIndexPath, html, 'utf8');

console.log('Successfully created cloned site!');
console.log('Location:', TARGET_DIR);
console.log('Main file:', finalIndexPath);

