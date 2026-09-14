import express, { type Request, type Response } from "express";
import path from "path";
import app from "./src/server/app";

const PORT = (process.env.K_SERVICE || process.env.K_REVISION)
  ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080)
  : 3000;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err && !res.headersSent) {
          res.status(500).send("Error serving application entry point.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PropRush Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

if (!isServerless) {
  startServer();
}

export default app;
