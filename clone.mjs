import fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 150);
}

function resolveUrl(relativeOrAbsolute, baseUrl) {
  try {
    if (!relativeOrAbsolute || relativeOrAbsolute.startsWith('data:') || relativeOrAbsolute.startsWith('javascript:') || relativeOrAbsolute.startsWith('#') || relativeOrAbsolute.startsWith('blob:')) {
      return null;
    }
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return null;
  }
}

function getAssetLocalPath(targetUrl, outputDir, typeHint = 'assets') {
  try {
    const urlObj = new URL(targetUrl);
    let pathname = decodeURIComponent(urlObj.pathname);
    
    if (pathname.endsWith('/') || pathname === '') {
      pathname += 'index.html';
    }

    let ext = path.extname(pathname);
    let basename = path.basename(pathname, ext);
    let dir = path.dirname(pathname);

    // If query string exists, append a short hash to avoid collisions
    if (urlObj.search && urlObj.search.length > 1) {
      let hash = 0;
      for (let i = 0; i < urlObj.search.length; i++) {
        hash = ((hash << 5) - hash) + urlObj.search.charCodeAt(i);
        hash |= 0;
      }
      basename += '_' + Math.abs(hash).toString(36);
    }

    basename = sanitizeFilename(basename);
    if (!basename) basename = 'asset_' + Math.random().toString(36).substring(2, 8);

    // Deduce extension if missing
    if (!ext) {
      if (typeHint === 'css') ext = '.css';
      else if (typeHint === 'js') ext = '.js';
      else if (typeHint === 'image') ext = '.png';
      else if (typeHint === 'font') ext = '.woff2';
      else if (typeHint === 'video') ext = '.mp4';
      else ext = '.bin';
    }

    // Keep clean subdirectory structure based on hostname and path
    const safeSubDir = dir.split('/').filter(Boolean).map(sanitizeFilename).join('/');
    const relFolder = path.join(urlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, '_'), safeSubDir);
    const fullDirPath = path.join(outputDir, relFolder);
    const fullFilePath = path.join(fullDirPath, basename + ext);
    
    // Relative path from the root index.html
    const relFromRoot = path.relative(outputDir, fullFilePath).replace(/\\/g, '/');

    return { fullDirPath, fullFilePath, relFromRoot };
  } catch (err) {
    return null;
  }
}

export async function cloneWebsite(targetUrl, options = {}, onProgress = () => {}) {
  const startTime = Date.now();
  onProgress({ type: 'start', message: `Starting cloning for: ${targetUrl}` });

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    throw new Error(`Invalid URL: ${targetUrl}`);
  }

  const hostname = parsedUrl.hostname;
  const siteDirName = sanitizeFilename(hostname + '_' + Date.now().toString(36));
  const outputBaseDir = options.outputDir || path.join(__dirname, 'cloned_sites');
  const siteOutputDir = path.join(outputBaseDir, siteDirName);

  await fs.mkdir(siteOutputDir, { recursive: true });

  onProgress({ type: 'info', message: `Output directory: ${siteOutputDir}` });

  // 1. Fetch main HTML
  onProgress({ type: 'step', message: `Fetching primary document HTML...` });
  const response = await fetch(targetUrl, {
    headers: DEFAULT_HEADERS,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${targetUrl}: HTTP ${response.status} ${response.statusText}`);
  }

  const finalUrl = response.url || targetUrl;
  let html = await response.text();

  const downloadedAssets = new Map(); // originalUrl -> relFromRoot
  const downloadQueue = [];

  function queueAsset(rawUrl, typeHint) {
    const fullUrl = resolveUrl(rawUrl, finalUrl);
    if (!fullUrl) return rawUrl;
    if (downloadedAssets.has(fullUrl)) {
      return downloadedAssets.get(fullUrl);
    }
    const assetPath = getAssetLocalPath(fullUrl, siteOutputDir, typeHint);
    if (!assetPath) return rawUrl;

    downloadedAssets.set(fullUrl, assetPath.relFromRoot);
    downloadQueue.push({ url: fullUrl, ...assetPath, typeHint });
    return assetPath.relFromRoot;
  }

  // 2. Discover resources from HTML
  onProgress({ type: 'step', message: `Analyzing DOM, stylesheets, scripts, animations & media...` });

  // Stylesheets & Preloads
  html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
    const isStylesheet = /rel=["'](?:stylesheet|preload)["']/i.test(match);
    const isIcon = /rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i.test(match);
    const isFont = /as=["']font["']/i.test(match);

    let typeHint = 'assets';
    if (isStylesheet) typeHint = 'css';
    else if (isIcon) typeHint = 'image';
    else if (isFont) typeHint = 'font';

    const localRel = queueAsset(href, typeHint);
    return `<link${before}href="${localRel}"${after}>`;
  });

  // Scripts (GSAP, Framer, WebGL, custom animations, chunks)
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, before, src, after) => {
    const localRel = queueAsset(src, 'js');
    return `<script${before}src="${localRel}"${after}>`;
  });

  // Images & SVGs
  html = html.replace(/<img\b([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, before, src, after) => {
    const localRel = queueAsset(src, 'image');
    return `<img${before}src="${localRel}"${after}>`;
  });

  // Image srcset
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcsetVal) => {
    const parts = srcsetVal.split(',').map(part => {
      const trimmed = part.trim();
      const tokens = trimmed.split(/\s+/);
      if (tokens.length > 0 && tokens[0]) {
        const localRel = queueAsset(tokens[0], 'image');
        tokens[0] = localRel;
        return tokens.join(' ');
      }
      return trimmed;
    });
    return `srcset="${parts.join(', ')}"`;
  });

  // Source tags (video/audio/picture)
  html = html.replace(/<source\b([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, before, src, after) => {
    const localRel = queueAsset(src, 'media');
    return `<source${before}src="${localRel}"${after}>`;
  });

  // Video / Audio tags
  html = html.replace(/<(video|audio)\b([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, tag, before, src, after) => {
    const localRel = queueAsset(src, 'video');
    return `<${tag}${before}src="${localRel}"${after}>`;
  });

  html = html.replace(/<video\b([^>]*?)poster=["']([^"']+)["']([^>]*?)>/gi, (match, before, poster, after) => {
    const localRel = queueAsset(poster, 'image');
    return `<video${before}poster="${localRel}"${after}>`;
  });

  // Inline CSS background url(...) in style attributes or <style> tags
  html = html.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, rawUrl) => {
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('#')) return match;
    const localRel = queueAsset(rawUrl, 'assets');
    return `url("${localRel}")`;
  });

  // Remove <base> tag to prevent broken relative lookups in cloned site
  html = html.replace(/<base\b[^>]*>/gi, '<!-- removed base tag for local preview -->');

  onProgress({ type: 'info', message: `Found ${downloadQueue.length} assets to download.` });

  // 3. Download all assets concurrently with a pool
  const CONCURRENCY_LIMIT = 8;
  let completedCount = 0;

  async function processCssContent(cssText, cssUrl, cssFilePath) {
    const cssDir = path.dirname(cssFilePath);
    
    // Replace url(...) inside CSS
    const updatedCss = cssText.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, rawUrl) => {
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('#') || rawUrl.startsWith('blob:')) {
        return match;
      }
      const fullUrl = resolveUrl(rawUrl, cssUrl);
      if (!fullUrl) return match;

      let typeHint = 'assets';
      if (/\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(fullUrl)) typeHint = 'font';
      else if (/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i.test(fullUrl)) typeHint = 'image';

      const assetPath = getAssetLocalPath(fullUrl, siteOutputDir, typeHint);
      if (!assetPath) return match;

      if (!downloadedAssets.has(fullUrl)) {
        downloadedAssets.set(fullUrl, assetPath.relFromRoot);
        downloadQueue.push({ url: fullUrl, ...assetPath, typeHint });
      }

      // Calculate relative path from this CSS file to the asset
      const relFromCss = path.relative(cssDir, assetPath.fullFilePath).replace(/\\/g, '/');
      return `url("${relFromCss}")`;
    });

    return updatedCss;
  }

  async function downloadAsset(item) {
    try {
      await fs.mkdir(item.fullDirPath, { recursive: true });

      const assetHeaders = {
        ...DEFAULT_HEADERS,
        'Referer': finalUrl,
        'Sec-Fetch-Dest': item.typeHint === 'image' ? 'image' : item.typeHint === 'css' ? 'style' : item.typeHint === 'js' ? 'script' : 'empty'
      };

      const res = await fetch(item.url, { headers: assetHeaders });
      if (!res.ok) {
        onProgress({ type: 'warn', message: `Asset skipped (${res.status}): ${path.basename(item.fullFilePath)}` });
        return;
      }

      if (item.typeHint === 'css') {
        const text = await res.text();
        const rewrittenCss = await processCssContent(text, item.url, item.fullFilePath);
        await fs.writeFile(item.fullFilePath, rewrittenCss, 'utf-8');
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(item.fullFilePath, buffer);
      }

      completedCount++;
      if (completedCount % 5 === 0 || completedCount === downloadQueue.length) {
        onProgress({
          type: 'progress',
          completed: completedCount,
          total: downloadQueue.length,
          message: `Downloaded ${completedCount}/${downloadQueue.length} assets (${path.basename(item.fullFilePath)})`
        });
      }
    } catch (err) {
      onProgress({ type: 'warn', message: `Error downloading ${item.url}: ${err.message}` });
    }
  }

  // Pool execution
  let activeIndex = 0;
  async function worker() {
    while (activeIndex < downloadQueue.length) {
      const item = downloadQueue[activeIndex++];
      await downloadAsset(item);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, Math.max(1, downloadQueue.length)) }, () => worker());
  await Promise.all(workers);

  // Write index.html
  const indexPath = path.join(siteOutputDir, 'index.html');
  await fs.writeFile(indexPath, html, 'utf-8');

  // Write clone metadata
  const metadata = {
    targetUrl,
    finalUrl,
    hostname,
    siteDirName,
    siteOutputDir,
    clonedAt: new Date().toISOString(),
    assetCount: downloadedAssets.size,
    durationMs: Date.now() - startTime
  };

  await fs.writeFile(path.join(siteOutputDir, 'clone_metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  onProgress({
    type: 'success',
    message: `Website cloned successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s! (${downloadedAssets.size} assets preserved)`,
    metadata
  });

  return metadata;
}

// CLI usage support
if (process.argv[1] && process.argv[1].endsWith('clone.mjs')) {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.log('Usage: node clone.mjs <URL>');
    process.exit(1);
  }
  cloneWebsite(urlArg, {}, (evt) => {
    console.log(`[${evt.type.toUpperCase()}] ${evt.message}`);
  }).then(meta => {
    console.log('\nDone! Cloned files are in:', meta.siteOutputDir);
  }).catch(err => {
    console.error('Cloning failed:', err);
    process.exit(1);
  });
}

