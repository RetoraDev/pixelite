#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const net = require("net");

const build = require("./build.js");

let serverMode = "dist";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m"
};

function color(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function serveProject(mode) {
  const serveDir = mode === "src" ? "./" : "dist";
  const port = 3000;

  console.log(color(`Starting ${mode} development server...\n`, "yellow"));
  console.log(color("Server will be available at:", "cyan"), color(`http://localhost:${port}`, "bright"));
  console.log(color("Serving from:", "cyan"), color(serveDir, "bright"));

  if (mode === "src") {
    console.log(color("Development mode: Loading individual source files", "green"));
  } else {
    console.log(color("Production mode: Loading bundled files", "green"));
  }
  
  console.log(colors.green);
  
  await require('./server.js');
  
  console.log(colors.reset);

  console.log(color("Press Ctrl+C to stop the server", "dim"));
  console.log(color("─".repeat(50), "dim") + "\n");

  startNodeServer(serveDir, port, mode);
}

async function findAvailablePort(startPort = 3000, maxAttempts = 10) {
  for (let port = startPort; port <= startPort + maxAttempts; port++) {
    const isAvailable = await new Promise(resolve => {
      const tester = net
        .createServer()
        .once("error", err => {
          if (err.code === "EADDRINUSE") {
            resolve(false);
          } else {
            resolve(false); // Other errors also mean port is not available
          }
        })
        .once("listening", () => {
          tester.once("close", () => resolve(true)).close();
        })
        .listen(port);
    });

    if (isAvailable) {
      return port;
    }
  }

  throw new Error(`No available ports found between ${startPort} and ${startPort + maxAttempts}`);
}

async function startNodeServer(serveDir, preferredPort, mode) {
  try {
    // Check if preferred port is available, if not find another one
    const actualPort = await findAvailablePort(preferredPort);

    if (actualPort !== preferredPort) {
      console.log(color(`Port ${preferredPort} is busy, using port ${actualPort} instead`, "yellow"));
    }

    busy = true;

    const server = http.createServer((req, res) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substr(2, 9);

      // Log request details based on mode
      console.log(color(`${req.method} → ${req.url}`, "cyan"));

      // Parse the URL
      const parsedUrl = url.parse(req.url);
      let pathname = parsedUrl.pathname;

      // Default to index.html
      if (pathname === "/") {
        pathname = "/index.html";
        if (mode === "src") {
          console.log(color(`→ Rewrote / to /index.html`, "dim"));
        }
      }

      // Build the file path
      let filePath = path.join(process.cwd(), serveDir, pathname);

      // Special handling for src mode index.html
      if (mode === "src" && pathname === "/index.html") {
        try {
          const devHtml = generateDevIndexHtml();
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(devHtml);
          const duration = Date.now() - startTime;
          console.log(color(`200 OK (${duration}ms) - Generated dev index.html`, "green"));
          return;
        } catch (error) {
          console.log(color(`✗ Error generating dev index.html:`, "red"), error);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error generating development index.html");
          const duration = Date.now() - startTime;
          console.log(color(`500 Internal Server Error (${duration}ms)`, "red"));
          return;
        }
      }

      // Check if file exists
      fs.access(filePath, fs.constants.F_OK, err => {
        if (err) {
          // File not found
          const duration = Date.now() - startTime;
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
          console.log(color(`404 Not Found (${duration}ms) - ${filePath}`, "yellow"));
          return;
        }

        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
          const duration = Date.now() - startTime;

          if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("500 Internal Server Error");
            console.log(color(`500 Internal Server Error (${duration}ms)`, "red"));
            return;
          }

          let content = data;

          // For binary files (images, audio), don't convert to string
          const ext = path.extname(filePath).toLowerCase();
          const textExtensions = [".html", ".css", ".js", ".json", ".sm", ".lrc", ".txt"];

          if (textExtensions.includes(ext)) {
            content = data.toString();
            // Dynamic replacements based on file type for development mode
            content = processDynamicContent(filePath, content, mode);
          }

          // Set content type based on file extension
          const contentTypes = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".ogg": "audio/ogg",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".txt": "text/plain"
          };

          const contentType = contentTypes[ext] || "text/plain";
          res.writeHead(200, { "Content-Type": contentType });
          res.end(content);

          console.log(color(`200 OK (${duration}ms) - ${filePath}`, "green"));
        });
      });
    });

    // Store server reference for graceful shutdown
    currentServer = server;

    // Add comprehensive event listeners based on mode
    server.on("listening", () => {
      console.log(color(`✓ Server running!`, "green"));
    });

    server.on("connection", socket => {
      if (mode === "src") {
        console.log(color(`→ New connection from ${socket.remoteAddress}:${socket.remotePort}`, "blue"));
      }
    });

    server.on("close", () => {
      console.log(color(" → Server connection closed", "cyan"));
    });

    server.on("checkContinue", (request, response) => {
      if (mode === "src") {
        console.log(color(`→ Expect: 100-continue for ${request.url}`, "magenta"));
      }
    });

    // Handle server errors
    server.on("error", error => {
      if (error.code === "EADDRINUSE") {
        console.log(color(`✗ Port ${actualPort} is already in use!`, "red"));
        console.log(color("  Please close other servers or try a different port.", "yellow"));
      } else {
        console.log(color("✗ Server error:", "red"), error.message);
        if (mode === "src") {
          console.log(color(`  Error details: ${error.stack}`, "gray"));
        }
      }

      exit();
    });

    server.on("clientError", (error, socket) => {
      if (mode === "src") {
        console.log(color(`⚠ Client error: ${error.message}`, "yellow"));
      }

      if (socket.writable) {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      }
    });

    server.listen(actualPort, () => {
      // Listening message is handled by the 'listening' event
    });

    // Handle graceful shutdown
    const shutdownHandler = () => {
      server.close(() => {
        console.log(color("✓ Server stopped gracefully", "green"));
        currentServer = null;
        exit();
      });

      // Force close after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        console.log(color("⚠ Forcing server shutdown", "yellow"));
        exit();
      }, 5000);
    };

    process.on("SIGINT", shutdownHandler);
  } catch (error) {
    console.log(color("✗ Failed to start server:", "red"), error.message);
    if (mode === "src") {
      console.log(color(`  Error stack: ${error.stack}`, "gray"));
    }
    exit();
  }
}

function processDynamicContent(filePath, content, mode) {
  return build.processFileContent(content, filePath);
}

function generateDevIndexHtml() {
  let htmlContent = fs.readFileSync("./src/index.html", "utf8");

  // Replace stylesheet url
  htmlContent = htmlContent.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*>/gi, '<link rel="stylesheet" href="./src/css/style.css">');

  // Replace favicon url
  htmlContent = htmlContent.replace(/<link[^>]*href=["'][^"']*favicon\.png["'][^>]*>/gi, '<link rel="icon" href="./src/favicon.png">');

  // Remove existing script tags if any
  htmlContent = htmlContent.replace(/<script src="[^"]*"><\/script>\s*/g, "");

  // Build head content (libraries and CSS)
  let headContent = "";

  // Add lib files to head
  headContent += '<script src="./lib/eruda.js"></script>\n';

  // Add all source CSS files in order to head
  build.cssFileOrder.forEach(filePath => {
    headContent += `    <link rel="stylesheet" href="./src/${filePath}">\n`;
  });

  // Build body content (source code)
  let bodyContent = "\n";

  // Add all source JS files in order to body
  build.jsFileOrder.forEach(filePath => {
    if (filePath.startsWith("js/")) {
      bodyContent += `    <script src="./src/${filePath}"></script>\n`;
    }
  });

  // Insert libraries in head
  htmlContent = htmlContent.replace("</head>", headContent + "\n</head>");

  // Insert source code in body
  htmlContent = htmlContent.replace("<body>", "<body>" + bodyContent);

  return htmlContent;
}

function parseFlags(args) {
  if (!args) args = process.argv.slice(2);
  args.forEach(arg => {
    if (arg === "--src") {
      build.config.flags.debug = true;
      serverMode = "src";
    }
  });
}

function exit(signal = 0) {
  process.exit(signal);
}

parseFlags();

serveProject(serverMode);
