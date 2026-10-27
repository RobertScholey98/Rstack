import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// True when the module at `url` is the script node was asked to run.
export function isMain(url) {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url));
  } catch {
    return false;
  }
}
