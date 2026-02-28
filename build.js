#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const terser = require("terser");
const CleanCSS = require('clean-css');
const { exec, execSync } = require("child_process");

require('dotenv').config();

// Build config
const config = {
  srcDir: "./src",
  distDir: "./dist",
  libDir: "./lib",
  flags: {
    debug: false,
    platform: "all", // 'web', 'cordova', 'all', 'none'
    minify: false,
    zipalign: false
  }
};

// Default order of JavaScript files
const jsFileOrder = [
  'js/main.js',
  'js/SettingsManager.js',
  'js/SettingsUI.js',
  'js/GridManager.js',
  'js/HistoryManager.js',
  'js/CollabManager.js',
  'js/FileBrowser.js',
  'js/PixelArtEditor.js'
];

// Default order css files
const cssFileOrder = [
  "css/main.css",
  "css/icons.css",
  "css/menu-panel.css",
  "css/layers-panel.css",
  "css/animation-panel.css",
  "css/grids-panel.css",
  "css/popup.css",
  "css/file-browser.css",
  "css/color-picker.css",
  "css/settings.css",
  "css/collab.css",
  "css/keyframes.css"
];

let packageInfo = {};
let versionName = "1.0.0";
let copyright = "(C) RETORA";

function log(text, type, error = null) {
  // Colors
  const red = "\x1b[31m";
  const yellow = "\x1b[33m";
  const green = "\x1b[32m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";

  let color = type
    ? {
        info: cyan,
        success: green,
        warning: yellow,
        error: red
      }[type]
    : "";

  let icon = type
    ? {
        info: "→ ",
        success: "✓ ",
        warning: "⚠ ",
        error: "✗ "
      }[type]
    : "";

  if (type === "error" && error) {
    console.error(color + icon + text + reset, error);
  } else {
    console.log(color + icon + text + reset);
  }
}

function getPackageInfo() {
  try {
    const packagePath = "./package.json";
    if (fs.existsSync(packagePath)) {
      return JSON.parse(fs.readFileSync(packagePath, "utf8"));
    }
  } catch (error) {
    log("Could not read package.json, using defaults", "warning");
  }

  return {
    version: "1.0.0",
    name: "pixelite"
  };
}

function getLicenseHeader(platform) {
  return `/**
 * Pixelite: Real-time collaborative pixel art editor with animation support
 * Copyright ${copyright}
 * Licensed under the Pixelite License (see LICENSE file for full terms)
 * 
 * Source: https://github.com/RetoraDev/pixelite
 * Version: ${versionName}
 * Built: ${new Date().toLocaleString()}
 * Platform: ${getPlatformDisplayName(platform)}
 * Debug: ${config.flags.debug}
 * Minified: ${config.flags.minify}
 */`;
}

function getPlatformDisplayName(platform) {
  const platformMap = {
    none: "Development",
    web: "Web",
    cordova: "Android (Cordova)",
    all: "All Platforms"
  };
  return platformMap[platform] || platform;
}

function setInfo() {
  packageInfo = getPackageInfo();
  versionName = `v${packageInfo.version + (config.flags.platform === "none" ? " dev" : "")}`;
  copyright = `(C) RETORA ${new Date().getFullYear()}`;
}

function parseFlags(args) {
  if (!args) args = process.argv.slice(2);
  args.forEach(arg => {
    if (arg === "--debug") config.flags.debug = true;
    if (arg === "--dev") config.flags.platform = "none";
    if (arg === "--none") config.flags.platform = "none";
    if (arg === "--cordova") config.flags.platform = "cordova";
    if (arg === "--zipalign") config.flags.zipalign = true;
    if (arg === "--nwjs") config.flags.platform = "nwjs";
    if (arg === "--web") config.flags.platform = "web";
    if (arg === "--all") config.flags.platform = "all";
    if (arg === "--minify") config.flags.minify = true;
  });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest, exclude = []) {
  ensureDir(dest);
    
  const items = fs.readdirSync(src);
    
  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
      
    // Check if item should be excluded using wildcard matching
    let shouldExclude = false;
      
    for (const pattern of exclude) {
      if (pattern.includes('*')) {
        // Convert wildcard pattern to regex
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
          
        if (regex.test(item)) {
          shouldExclude = true;
          break;
        }
      } else {
        // Exact match
        if (item === pattern) {
          shouldExclude = true;
          break;
        }
      }
    }
    
    if (!shouldExclude) {
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath, exclude);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    log(`Could not read ${filePath}`, "warning");
    return "";
  }
}

function processFileContent(content, filePath) {
  // Dynamic replacements
  content = content
    .replace('const COPYRIGHT = "%";', `const COPYRIGHT = "${copyright}";`)
    .replace('const VERSION = "%";', `const VERSION = "${versionName}";`)
    .replace('const HOST = "%";', `const HOST = "${config.flags.debug ? process.env.LOCALHOST : process.env.HOST}";`)
    .replace('const DEBUG = "%";', `const DEBUG = ${config.flags.debug};`);

  return content;
}

async function mininyJSCode(code, platform) {
  if (!config.flags.minify) {
    return code;
  }

  try {
    const minified = await terser.minify(code, {
      mangle: {
        toplevel: false,
        properties: false,
        keep_fnames: false,
        keep_classnames: false
      }
    });

    if (minified.error) {
      log("Minification error:", "warning", minified.error);
      return getLicenseHeader(platform) + "\n\n" + code;
    }

    return getLicenseHeader(platform) + "\n\n" + minified.code;
  } catch (error) {
    log("Minification failed, using original code:", "warning", error.message);
    return getLicenseHeader(platform) + "\n\n" + code;
  }
}

async function minifyCSSCode(code, platform) {
  if (!config.flags.minify) {
    return code;
  }

  try {
    const cleanCSS = new CleanCSS({
      level: 2,
      format: false, // ← Cambia esto a false para minificar
      sourceMap: false,
      compatibility: '*'
    });

    const minified = cleanCSS.minify(code);

    if (minified.errors && minified.errors.length > 0) {
      log("CSS Minification errors:", "warning", minified.errors.join(', '));
      return getLicenseHeader(platform) + "\n\n" + code;
    }

    if (minified.warnings && minified.warnings.length > 0) {
      log("CSS Minification warnings:", "warning", minified.warnings.join(', '));
    }

    return getLicenseHeader(platform) + "\n\n" + minified.styles;
  } catch (error) {
    log("CSS Minification failed, using original code:", "warning", error.message);
    return getLicenseHeader(platform) + "\n\n" + code;
  }
}

function concatenate(files) {
  let output = "";

  // Process all files in order
  for (const relativePath of files) {
    let fullPath;

    // Check if file is in lib or src
    if (relativePath.startsWith("lib/")) {
      fullPath = path.join(config.libDir, relativePath.replace("lib/", ""));
    } else {
      fullPath = path.join(config.srcDir, relativePath);
    }

    if (fs.existsSync(fullPath)) {
      const content = readFile(fullPath);
      const processedContent = processFileContent(content, relativePath);
      const newLine = processedContent.endsWith("\n") ? "\n" : "\n\n";
      output += processedContent + newLine;
      log(`Processed ${relativePath}`, "success");
    } else {
      log(`File not found: ${fullPath}`, "warning");
    }
  }
  
  return output;
}

async function concatenateJSFiles(platform) {
  log(`Concatenating JavaScript files for ${getPlatformDisplayName(platform)}...`, "info");

  let output = await concatenate(jsFileOrder);
  
  if (config.flags.minify) {
    log("Minifying JavaScript code...", "info");
    return await mininyJSCode(output, platform);
  } else {
    return getLicenseHeader(platform) + "\n\n" + output;
  }
}

async function concatenateCSSFiles(platform) {
  log(`Concatenating CSS files`, "info");

  let output = await concatenate(cssFileOrder);
  
  if (config.flags.minify) {
    log("Minifying CSS code...", "info");
    return await minifyCSSCode(output, platform);
  } else {
    return getLicenseHeader(platform) + "\n\n" + output;
  }
}

function copyLibFiles() {
  log('Copying lib files...', 'info');
    
  const libDest = path.join(config.distDir);
  ensureDir(libDest);
  
  if (config.flags.debug) {
    // Copy eruda.js to lib folder
    const erudaSrc = path.join(config.libDir, 'eruda.js');
    const erudaDest = path.join(libDest, 'eruda.js');
    if (fs.existsSync(erudaSrc)) {
      fs.copyFileSync(erudaSrc, erudaDest);
      log('eruda.js copied', 'success');
    }
  }
}

function copyStaticFiles() {
  log('Copying static files...', 'info');
    
  // Copy favicon from src
  const faviconSrc = path.join(config.srcDir, 'favicon.png');
  const faviconDest = path.join(config.distDir, 'favicon.png');
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, faviconDest);
  }
    
  // Copy root favicon as fallback
  const rootFavicon = './favicon.png';
  if (fs.existsSync(rootFavicon) && !fs.existsSync(faviconDest)) {
    fs.copyFileSync(rootFavicon, faviconDest);
  }
    
  log('Static files copied', 'success');
}

function hasZip() {
  try {
    execSync('zip --help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasApkSigner() {
  try {
    execSync('apksigner --help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasZipAlign() {
  try {
    exec('zipalign', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function createZipArchive(sourceDir, outputFile) {
  log(`Creating zip: ${sourceDir} → ${outputFile}`, 'info');
  try {
    if (hasZip()) {
      execSync(`zip -r -9 "${outputFile}" .`, { cwd: sourceDir, stdio: 'inherit' });
      log(`Created ${outputFile}`, 'success');
      return true;
    } else {
      log('zip command not available', 'warning');
      return false;
    }
  } catch (error) {
    log(`Failed to create zip: ${error.message}`, 'warning');
    return false;
  }
}

function zipAlignAndroidAPK(apkPath, outputPath) {
  log(`Applying Zip alignment: ${apkPath} → ${outputPath}`, 'info');
  
  try {
    if (hasZipAlign()) {
      execSync(`zipalign -f '4' ${apkPath} ${outputPath}`, {
        stdio: 'inherit'
      });
      log(`Zip alignment success: ${outputPath}`, 'success');
      return true;
    } else {
      log('zipalign not available. Please install Android SDK Build Tools.', 'error');
      return false;
    }
  } catch (error) {
    log(`Failed to zipalign APK: ${error.message}`, 'error');
    return false;
  }
}

function signAndroidAPK(apkPath, outputPath) {
  log(`Signing Android APK: ${apkPath} → ${outputPath}`, 'info');
  
  const signkeyPath = path.join(config.srcDir, 'static/android_app/signkey.keystore');
  if (!fs.existsSync(signkeyPath)) {
    log('Signkey not found at: ' + signkeyPath, 'error');
    return false;
  }

  try {
    if (hasApkSigner()) {
      execSync(`apksigner sign --ks "${signkeyPath}" --ks-pass pass:ProjectHarmony --ks-key-alias retora --out "${outputPath}" "${apkPath}"`, {
        stdio: 'inherit'
      });
      log(`Signed APK: ${outputPath}`, 'success');
      return true;
    } else {
      log('apksigner not available. Please install Android SDK Build Tools.', 'error');
      return false;
    }
  } catch (error) {
    log(`Failed to sign APK: ${error.message}`, 'error');
    return false;
  }
}

async function buildWeb() {
  log('Building web platform...', 'info');
  
  // Create temporary web build directory
  const tempWebDir = path.join(config.distDir, 'temp', 'web');
  ensureDir(tempWebDir);
  
  // Copy only web files to temp directory excluding temporaries cordova and platform builds
  copyDir(config.distDir, tempWebDir, ['www.zip', 'pixelite-*.zip', '*.apk', 'temp', 'cordova']);
  
  // Create www.zip from temp web build
  const webZipPath = '../../www.zip';
  if (createZipArchive(tempWebDir, webZipPath)) {
    log('Web platform build complete', 'success');
  } else {
    log('Web platform build failed - zip command unavailable', 'warning');
  }
  
  // Clean up temp directory
  fs.rmSync(path.join(config.distDir, 'temp'), { recursive: true });
}

async function buildAndroid() {
  log('Building Android platform...', 'info');
  
  const androidStatic = path.join(config.srcDir, 'static/android_app');
  if (fs.existsSync(androidStatic)) {
    // Create temporary Android build directory
    const tempAndroidDir = path.join(config.distDir, 'temp', 'android');
    ensureDir(tempAndroidDir);
    
    // Copy Android app structure to temp directory
    copyDir(androidStatic, tempAndroidDir, [".placeholder", 'signkey.keystore']);
    
    // Create platform-specific game.js for Android
    const wwwDest = path.join(tempAndroidDir, 'assets/www');
    ensureDir(wwwDest);
    const jsDest = path.join(wwwDest, 'js');
    ensureDir(jsDest);
    
    const androidEditorJS = await concatenateJSFiles('cordova');
    fs.writeFileSync(path.join(jsDest, 'editor.js'), androidEditorJS);
    
    // Copy other web files to Android www folder
    copyDir(config.distDir, wwwDest, ['www.zip', 'pixelite-*.zip', '*.apk', 'temp', 'js']);
    
    // Copy cordova files specifically for Android
    const cordovaStatic = path.join(config.srcDir, 'static/cordova');
    const cordovaDest = path.join(wwwDest, 'cordova');
    if (fs.existsSync(cordovaStatic)) {
      copyDir(cordovaStatic, cordovaDest);
      log('Cordova files copied for Android build', 'success');
    }
    
    // First create unsigned APK using zip from temp directory
    const unsignedUnalignedApkName = `pixelite-v${packageInfo.version}-android-unsigned-unaligned.apk`;
    const unsignedUnalignedApkPath = path.join(config.distDir, unsignedUnalignedApkName);
    
    if (createZipArchive(tempAndroidDir, '../../' + unsignedUnalignedApkName)) {
      // Apply zipalign
      let unsignedApkName = `pixelite-v${packageInfo.version}-android-unsigned.apk`;
      let unsignedApkPath  = path.join(config.distDir, unsignedApkName);
      
      if (config.flags.zipalign) {
        if (zipAlignAndroidAPK(unsignedUnalignedApkPath, unsignedApkPath)) {
          // Clean up build artifacts
          fs.unlinkSync(unsignedUnalignedApkPath);
        } else {
          log('Could not apply zipalign to APK', 'warning');
        }
      } else {
        unsignedApkName = unsignedUnalignedApkName;
        unsignedApkPath = unsignedUnalignedApkPath;
      }
      
      // Sign the APK
      const signedApkName = `pixelite-v${packageInfo.version}-android.apk`;
      const signedApkPath = path.join(config.distDir, signedApkName);

      if (signAndroidAPK(unsignedApkPath, signedApkPath)) {
        // Clean up build artifacts
        fs.unlinkSync(unsignedApkPath);
      } else {
        log('Could not apply signature to APK', 'warning');
      }
      
      log('Android platform build complete', 'success');
    } else {
      log('Android platform build failed - zip command unavailable', 'warning');
    }
    
    // Clean up temp directory
    fs.rmSync(path.join(config.distDir, 'temp'), { recursive: true });
  } else {
    log('Android static files not found at: ' + androidStatic, 'warning');
  }
}

async function buildForPlatform() {
  const platform = config.flags.platform;
  
  if (platform === 'all') {
    // Build base files first
    await buildBaseFiles('web');
    
    // Then build each platform with their specific environment
    await buildWeb();
    await buildAndroid();
  } else if (platform === 'web') {
    await buildBaseFiles('web');
    await buildWeb();
  } else if (platform === 'cordova') {
    await buildBaseFiles('cordova');
    await buildAndroid();
  } else if (platform === 'none') {
    await buildBaseFiles('none');
    log('Development build complete', 'success');
  }
}

async function buildBaseFiles(platform) {
  log(`Building base files for ${getPlatformDisplayName(platform)}...`, 'info');
  
  // Concatenate all JavaScript files
  const concatenatedJS = await concatenateJSFiles(platform);
  fs.writeFileSync(path.join(config.distDir, 'editor.js'), concatenatedJS);
  
  // Concatenate all CSS files
  const concatenatedCSS = await concatenateCSSFiles(platform);
  fs.writeFileSync(path.join(config.distDir, 'style.css'), concatenatedCSS);
  
  fs.copyFileSync('src/index.html', path.join(config.distDir, 'index.html'));
  
  // Copy other files to base dist
  copyLibFiles();
  copyStaticFiles();
}

async function build(args) {
  parseFlags(args);
  
  setInfo();
  
  log('Starting build process...', 'info');
  log(`Platform: ${config.flags.platform}`, 'info');
  log(`Minify: ${config.flags.minify}`, 'info');
  log(`Debug: ${config.flags.debug}\n`, 'info');
  
  // Clean and create dist directory
  if (fs.existsSync(config.distDir)) {
    log(`Cleaning ${config.distDir} folder`, 'info');
    fs.rmSync(config.distDir, { recursive: true });
  }
  ensureDir(config.distDir);
  
  try {
    // Platform-specific builds
    await buildForPlatform();
    
    log('\nBuild completed successfully!', 'success');
    log(`Output directory: ${config.distDir}`, 'info');
    
    // List generated files
    const files = fs.readdirSync(config.distDir);
    const outputFiles = files.filter(file => 
      file.endsWith('.zip') || file.endsWith('.apk')
    );
    if (outputFiles.length > 0) {
      log('Generated files:', 'info');
      outputFiles.forEach(file => {
        const filePath = path.join(config.distDir, file);
        const stats = fs.statSync(filePath);
        log(`  - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
      });
    }
    
  } catch (error) {
    log('\nBuild failed:', 'error', error);
    exit(1);
  }
}
  
function exit(signal = 0) {
  process.exit(signal);
}

// Run build if this script is executed directly
if (require.main === module) {
  build();
}

module.exports = {
  config,
  buildBaseFiles,
  buildForPlatform,
  buildAndroid,
  buildWeb,
  build,
  execSync,
  buildProcess: process,
  processFileContent,
  jsFileOrder,
  cssFileOrder
};