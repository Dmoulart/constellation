import { parseArgs } from "util";
import { generateImports, runImport } from "./import";
import { graph } from "../graph/client";

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

const imports = await generateImports({
  directories,
});

await Promise.allSettled(imports.map(runImport));

await graph.close();
