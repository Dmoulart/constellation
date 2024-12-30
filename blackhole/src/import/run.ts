import { parseArgs } from "util";
import { parseImports, runImport } from "./import";
import { graph } from "../graph/client";
import { applyNodeConstraints } from "../schema/schema";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    dir: {
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
});

let directories: undefined | Array<string> = undefined;

if (values.dir) {
  directories = values.dir.split(" ");
}

await applyNodeConstraints();

const imports = await parseImports({
  directories,
});

await Promise.allSettled(imports.map(runImport));

await graph.close();

console.info("Imports end");
