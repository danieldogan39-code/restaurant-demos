import fs from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");

// In der Claude-Cloud-Umgebung ist Chromium vorinstalliert; lokal lädt Remotion sein eigenes.
const preinstalled = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (fs.existsSync(preinstalled)) Config.setBrowserExecutable(preinstalled);
