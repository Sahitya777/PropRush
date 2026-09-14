import app from "../server.ts";
import type { Request, Response } from "express";

export default function handler(req: Request, res: Response) {
  if (req.url && !req.url.startsWith("/api")) {
    const original = (req.headers && req.headers["x-matched-path"]) as string;
    if (original && original.startsWith("/api")) {
      req.url = original;
    } else {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
  }
  return app(req, res);
}
