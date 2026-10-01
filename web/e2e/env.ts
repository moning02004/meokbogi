import {existsSync} from "node:fs";
import path from "node:path";

export const API_PORT = 8100
export const WEB_PORT = 3100
export const API_HOST = `http://localhost:${API_PORT}`
export const API_DIR = path.resolve(__dirname, "../../api")

const localPython = path.join(API_DIR, "venv/bin/python")
export const PYTHON = process.env.E2E_PYTHON ?? (existsSync(localPython) ? localPython : "python")
