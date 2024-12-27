import { readdir, readFile } from "node:fs/promises";
import { createStringTemplate } from "../string/template";
import { wikidata } from "../dataset/wikibase/client/wikidata";
import { graph } from "../graph/client";

type ImportParams = {
  args: Record<string, any>;
  limit: number;
  resultPerPage?: number;
  mapping: Mapping;
  load: Load;
};

type Load = {
  primary_id: Expression;
  node_label: string;
};

type Import = {
  name: string;
  createQuery?: (options: Record<string, any>) => string;
  staticData?: Array<Record<string, any>>;
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

export async function generateImports(options: {
  directories?: Array<string>;
}): Promise<Import[]> {
  const files = await readdir(__dirname, { withFileTypes: true });

  let directories = files.filter((file) => file.isDirectory());

  if (options.directories) {
    directories = directories.filter((file) =>
      options.directories!.includes(file.name),
    );
  }

  const importDirs = await Promise.all(
    directories.map(async (dir) => {
      const path = `${dir.parentPath}/${dir.name}`;

      const files = await readdir(path, { withFileTypes: true });

      return { name: dir.name, files: files.filter((file) => file.isFile()) };
    }),
  );

  return await Promise.all(
    importDirs.map(async (importDir) => {
      const imp: Import = { name: importDir.name } as Import;

      const dataFile = importDir.files.find(
        (files) => files.name === "data.json",
      );

      if (dataFile) {
        const dataPath = `${dataFile.parentPath}/data.json`;
        const data = (await readFile(dataPath)).toString();
        imp.staticData = JSON.parse(data);
      }

      const queryFile = importDir.files.find((files) =>
        files.name.endsWith(".sparql"),
      );

      if (queryFile) {
        const queryPath = `${queryFile.parentPath}/${queryFile.name}`;

        const queryString = (await readFile(queryPath)).toString();

        const createQuery = createStringTemplate(queryString);
        imp.createQuery = createQuery;
      }

      const paramsPath = `${__dirname}/${importDir.name}/params.json`;

      const params = JSON.parse((await readFile(paramsPath)).toString());
      imp.params = params;
      // easier for the rest of the process to have a non nullable object even if its not mandatory in config
      imp.params.mapping ??= {};

      return imp;
    }),
  );
}

export async function runImport(imp: Import) {
  console.info(`Starting import ${imp.name} 🌋`);
  try {
    if (imp.createQuery) {
      const limit = imp.params?.limit ?? 500;
      const resultsPerPage = imp.params?.resultPerPage ?? 50;
      const pagination = { limit: resultsPerPage, offset: 0 };

      while (pagination.offset < limit) {
        const response = await wikidata.query<Record<string, any>>(
          imp.createQuery({ ...imp.params.args, ...pagination }),
        );

        // @todo parallel not working for neo4J for now. session handling
        /*
        const results = await Promise.allSettled(
          response.results.bindings.map((result) => {
            let data = extract(result, imp.params.mapping);
            data = transform(data, imp.params.mapping);
            return load(data, imp.params.load);
          }),
        );
        */
        const results = [];
        for (const item of response.results.bindings) {
          try {
            let data = extract(item, imp.params.mapping);
            data = transform(data, imp.params.mapping);
            const result = await load(data, imp.params.load);
            results.push(result);
          } catch (e) {
            console.error(e);
          }
        }
        console.info(`${results.length} records successfully inserted 🍾`);

        pagination.offset += resultsPerPage;

        Bun.sleepSync(10);
      }
    } else if (imp.staticData) {
      const data = imp.staticData;

      const results = [];
      for (const item of data) {
        try {
          let data = extract(item, imp.params.mapping);
          data = transform(data, imp.params.mapping);
          const result = await load(data, imp.params.load);
          results.push(result);
        } catch (e) {
          console.error(e);
        }
      }

      console.info(`${results.length} records successfully inserted 🍾`);
    }
  } catch (e) {
    console.error("LOAD_ERROR", e);
    throw e;
  }
}

function extract(input: Record<string, any>, mapping: Mapping) {
  if (Object.keys(mapping).length === 0) return input;

  const data: Record<string, any> = {};

  for (const [key, directives] of Object.entries(mapping)) {
    data[key] = evaluate(input, directives.from);
  }

  return data;
}

function transform(input: Record<string, any>, mapping: Mapping) {
  if (Object.keys(mapping).length === 0) return input;

  for (const [key, directives] of Object.entries(mapping)) {
    if (!directives.transform) continue;

    for (const expr of directives.transform) {
      input[key] = evaluate(input[key], expr);
    }
  }

  return input;
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
    // allows us to get a reference to the node we're interested in
    `MERGE (node:${label} {${idKey}: $${idKey}})`,
    ...Object.keys(data).map((key) => {
      return `SET node.${key} = $${key}`;
    }),
  ].join("\n");

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
