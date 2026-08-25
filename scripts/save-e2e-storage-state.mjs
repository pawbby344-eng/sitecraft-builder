import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { rm } from "node:fs/promises";
import childProcess from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(childProcess.execFile);

const sourceProfile = process.env.E2E_BROWSER_PROFILE ?? "/home/ubuntu/.browser_data_dir";
const clonedProfile = process.env.E2E_CLONED_PROFILE ?? "/tmp/sitecraft-e2e-browser-profile";
const output = process.env.E2E_STORAGE_STATE ?? ".auth/manus-storage-state.json";
await rm(clonedProfile, { recursive: true, force: true });
await execFile("bash", ["-lc", `mkdir -p "$2" && tar --exclude=SingletonLock --exclude=SingletonCookie --exclude=SingletonSocket -C "$1" -cf - . | tar -C "$2" -xf -`, "bash", sourceProfile, clonedProfile]);
for (const lockFile of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
  await rm(`${clonedProfile}/${lockFile}`, { force: true });
}
const context = await chromium.launchPersistentContext(clonedProfile, {
  headless: true,
  executablePath: process.env.E2E_CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login") || await page.getByRole("button", { name: "Sign in" }).count()) {
    throw new Error("Cloned Chromium profile is not authenticated for SiteCraft; no storage state exported.");
  }
  await mkdir(output.substring(0, output.lastIndexOf("/")) || ".", { recursive: true });
  await context.storageState({ path: output });
  console.log(`Saved authenticated Playwright storage state to ${output}`);
} finally {
  await context.close();
}
