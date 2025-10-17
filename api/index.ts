import express from "express";
import type { Request, Response } from "express";
import "../server/db"; // Initialize Firebase

// Import your routes and storage
import { registerRoutes } from "../server/routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize routes once
let initialized = false;

async function initialize() {
  if (!initialized) {
    await registerRoutes(app);
    initialized = true;
  }
}

// Main handler for Vercel
export default async function handler(req: Request, res: Response) {
  // Initialize on first request
  await initialize();
  
  // Let Express handle the request
  return app(req, res);
}