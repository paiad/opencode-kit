import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(packageRoot, "..", "..");
const source = resolve(repositoryRoot, ".opencode", "lib", "peek");
const destination = resolve(packageRoot, "dist", "lib", "peek");

await rm(resolve(destination, "styles"), { recursive: true, force: true });
await rm(resolve(destination, "avatar"), { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(resolve(source, "styles"), resolve(destination, "styles"), { recursive: true });
await cp(resolve(source, "avatar"), resolve(destination, "avatar"), { recursive: true });
