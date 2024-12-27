import { readdir, readFile } from "node:fs/promises";
import { createStringTemplate } from "../string/template";
import { wikidata } from "../dataset/wikibase/client/wikidata";
import { graph } from "../graph/client";

type ImportParams = {
  args: Record<string, any>;
  limit: number;
  mapping: Mapping;
  load: Load;
};

type Load = {
  primary_id: Expression;
  node_label: string;
};

type Import = {
  createQuery(options: Record<string, any>): string;
  params: ImportParams;
};

type KeyMapping = {
  primary_id?: boolean;
  from: Expression;
  transform?: Expression[];
};

type Mapping = Record<string, KeyMapping>;

type Expression = string | SplitExpression | KeyExpression;

type SplitExpression = {
  split: string;
};

type KeyExpression = {
  key: string | number;
};

const functions = {
  key(input: Record<string, any>, args: string | number | string[]) {
    return extractFromPath(input, Array.isArray(args) ? args : [args]);
  },
  split(input: string, args: string) {
    return input.split(args);
  },
  at(input: string | Array<any>, index: number) {
    return input.at(index);
  },
};

const imports = await generateImports();

imports.map(runImport);

async function generateImports(): Promise<Import[]> {
  const files = await readdir(__dirname, { withFileTypes: true });

  const directories = files.filter((file) => file.isDirectory());

  const importDirs = await Promise.all(
    directories.map(async (dir) => {
      const path = `${dir.parentPath}/${dir.name}`;

      const files = await readdir(path, { withFileTypes: true });

      return { name: dir.name, files: files.filter((file) => file.isFile()) };
    }),
  );

  return await Promise.all(
    importDirs.map(async (importDir) => {
      const queryFile = importDir.files.find((files) =>
        files.name.endsWith(".sparql"),
      );

      if (queryFile === undefined) {
        throw new Error(`Expected query file in ${importDir.name}.`);
      }

      const queryPath = `${queryFile.parentPath}/${queryFile.name}`;

      const queryString = (await readFile(queryPath)).toString();

      const createQuery = createStringTemplate(queryString);

      const paramsPath = `${queryFile.parentPath}/params.json`;

      const params = JSON.parse((await readFile(paramsPath)).toString());

      return {
        createQuery,
        params,
      };
    }),
  );
}

export async function runImport(imp: Import) {
  try {
    const pagination = { limit: 100, offset: 0 };
    const limit = imp.params?.limit ?? 500;

    while (pagination.offset < limit) {
      const response = await wikidata.query<Record<string, any>>(
        imp.createQuery({ ...imp.params.args, ...pagination }),
      );

      await Promise.allSettled(
        response.results.bindings.map((result) => {
          let data = extract(result, imp.params.mapping);
          data = transform(data, imp.params.mapping);
          return load(data, imp.params.load);
        }),
      );

      pagination.offset += 100;

      Bun.sleepSync(10);
    }
  } catch (e) {
    console.error("LOAD_ERROR", e);
    throw e;
  }
}

function extract(input: Record<string, any>, mapping: Mapping) {
  const data: Record<string, any> = {};

  for (const [key, directives] of Object.entries(mapping)) {
    data[key] = evaluate(input, directives.from);
  }

  return data;
}

function transform(data: Record<string, any>, mapping: Mapping) {
  for (const [key, directives] of Object.entries(mapping)) {
    if (!directives.transform) continue;

    for (const expr of directives.transform) {
      data[key] = evaluate(data[key], expr);
    }
  }

  return data;
}

async function load(data: Record<string, any>, load: Load) {
  const idKey = evaluate(data, load.primary_id);

  if (typeof idKey !== "string") {
    throw new Error("Expected string type for primary id");
  }

  const primaryId = data[idKey];

  if (primaryId === undefined) {
    throw new Error("Expected primary id in data");
  }

  const label = evaluate(data, load.node_label);
  if (typeof label !== "string") {
    throw new Error("Expected string type for label");
  }

  const query = [
    `MERGE (node:${label} {${idKey}: $${primaryId}})`,
    ...Object.keys(data).map((key) => {
      return `SET node.${key} = $${key}`;
    }),
  ].join("\n");

  console.log({ query, data });
  return await graph.run(query, data);
}

function evaluate(input: Record<string, any>, expression: Expression) {
  if (typeof expression === "string") {
    return expression;
  }

  /*
  if (Array.isArray(expression)) {
    return expression.map((expr: Expression) => evaluate(input, expr)); as Array<Expression>
  }
 */

  if (typeof expression === "object") {
    let result = input;

    for (const key in expression) {
      if (key in functions) {
        result = (functions as any)[key](result, (expression as any)[key]);
      }
    }

    return result;
  }

  return expression;
}

function extractFromPath(
  input: Record<string, any>,
  path: (string | number)[],
) {
  let curr = input;

  for (const key of path) {
    if (curr[key] === undefined) break;

    curr = curr[key];
  }

  return curr;
}
