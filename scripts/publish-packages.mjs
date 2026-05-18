import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const packageDirs = collectPackageDirs(["packages", "apps"]);
const packages = packageDirs
  .map((dir) => readPackage(dir))
  .filter((pkg) => pkg && !pkg.private);

if (packages.length === 0) {
  console.log("No publishable packages found.");
  process.exit(0);
}

for (const pkg of packages) {
  const spec = `${pkg.name}@${pkg.version}`;

  if (dryRun) {
    console.log(`[dry-run] Would publish ${spec} from ${pkg.dir}`);
    continue;
  }

  if (isPublished(spec)) {
    console.log(`Skipping ${spec}: already published.`);
    continue;
  }

  console.log(`Publishing ${spec} from ${pkg.dir}`);

  const access = pkg.publishConfig?.access;
  const args = ["publish"];

  if (access) {
    args.push("--access", access);
  }

  const result = spawnSync("npm", args, {
    cwd: pkg.dir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function collectPackageDirs(roots) {
  return roots.flatMap((root) => {
    const absRoot = resolve(workspaceRoot, root);
    if (!existsSync(absRoot)) return [];

    return readdirSync(absRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(absRoot, entry.name))
      .filter((dir) => existsSync(join(dir, "package.json")));
  });
}

function readPackage(dir) {
  const packageJsonPath = join(dir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (!packageJson.name || !packageJson.version) {
    return null;
  }

  return {
    dir,
    name: packageJson.name,
    version: packageJson.version,
    private: packageJson.private === true,
    publishConfig: packageJson.publishConfig ?? null,
  };
}

function isPublished(spec) {
  const result = spawnSync("npm", ["view", spec, "version", "--json"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: process.env,
  });

  if (result.status === 0) {
    return true;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (
    output.includes("E404") ||
    output.includes("404 Not Found") ||
    output.includes("npm ERR! code E404")
  ) {
    return false;
  }

  process.stderr.write(output);
  process.exit(result.status ?? 1);
}
