import express, { type Request, Response, NextFunction } from "express";
import { createServer as createNetServer } from "node:net";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
//import { seedSampleData } from "./storage";

const app = express();
// Increase payload limit to handle base64 encoded images (up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // In development: automatically pick an available port starting from 5000
  // In production: honor PORT or default to 5000 (platform usually assigns)
  const basePort = parseInt(process.env.PORT || '5000', 10);

  async function getAvailablePort(start: number): Promise<number> {
    let port = start;
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const free = await new Promise<boolean>((resolve) => {
        const tester = createNetServer()
          .once('error', (err: any) => {
            if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) resolve(false);
            else resolve(false);
          })
          .once('listening', () => {
            tester.close(() => resolve(true));
          })
          .listen(port, '0.0.0.0');
      });
      if (free) return port;
      port += 1; // try next port
    }
  }

  const effectivePort = app.get('env') === 'development'
    ? await getAvailablePort(basePort)
    : basePort;

  // Use the standard listen() signature - works cross-platform
  server.listen(effectivePort, '0.0.0.0', async () => {
    const url = `http://localhost:${effectivePort}`;
    log(`serving on port ${effectivePort}`);
    console.log(`\nDev server ready → ${url}\n`);
    // Seed sample data on startup
    try {
      //await seedSampleData();
    } catch (error) {
      log(`Error seeding sample data: ${error}`);
    }
  });
})();