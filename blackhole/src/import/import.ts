import { readdir, readFile } from "node:fs/promises";
import { createStringTemplate } from "../string/template";
import { wikidata } from "../dataset/wikibase/client/wikidata";
import { graph } from "../graph/client";
import { GraphNode } from "../graph/node";

type ImportParams = {
  args: Record<string, any>;
  limit: number;
  resultsPerPage?: number;
  mapping: Mapping;
  load: Load;
};

type Relation = {
  target: Record<string, any>;
  direction: "IN" | "OUT";
  type: string;
};

type Load = {
  primary_id: Expression;
  relations?: Array<Relation>;
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
  from_url_to_wd_id(input: string, args: string) {
    return input.split("/").at(-1);
  },
  from_wd_point_to_point(input: string, args: string) {
    const match = input.match(/^Point\(([^ ]+)\s+([^)]+)\)$/);
    if (!match) {
      throw new Error("Invalid point format. Expected 'Point(x y)'.");
    }

    const [_, x, y] = match;
    const lng = parseFloat(x.trim());
    const lat = parseFloat(y.trim());

    return { lng, lat };
  },
};

export async function parseImports(options: {
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
      const resultsPerPage = imp.params?.resultsPerPage ?? 50;
      const pagination = { limit: resultsPerPage, offset: 0 };

      while (pagination.offset < limit) {
        const response = await wikidata.query<Record<string, any>>(
          imp.createQuery({ ...imp.params.args, ...pagination }),
        );

        if (response.results.bindings.length === 0) break;

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
        console.info(
          `${imp.name} : ${results.length} records successfully inserted 🍾`,
        );

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

      console.info(
        `${imp.name} : ${results.length} records successfully inserted 🍾`,
      );
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

  let label: string;

  if (data["#node_label"]) {
    label = data["#node_label"];

    if (typeof label !== "string") {
      throw new Error("Node label must be of type string");
    }

    delete data["#node_label"];
  } else {
    throw new Error("Expected node label");
  }

  const getRelations: string[] = [];
  const setRelations: string[] = [];
  const paramsRelations: Record<string, any>[] = [];

  if (load.relations) {
    load.relations.forEach((relation, i) => {
      /*const target: Record<string, any> =
        typeof relation.target === "object"
          ? evaluateObject(data, relation.target)
          : (evaluate(data, relation.target) as Record<string, any>);
          */
      const target = relation.target;

      assert(target["#node_label"], "Expected node label");
      const nodeLabel = target["#node_label"];

      assert(target[idKey], "Expected relation target to have primary ID key");

      getRelations.push(
        `MATCH (r${i}: ${nodeLabel} { ${idKey}: $${idKey}_r${i} })`,
      );
      const type = evaluate(data, relation.type);

      const direction = evaluate(data, relation.direction);
      const setRelation =
        direction === "IN"
          ? `MERGE (node)-[:${type}]->(r${i})`
          : `MERGE (node)<-[:${type}]-(r${i})`;

      setRelations.push(setRelation);

      paramsRelations.push({
        [`${idKey}_r${i}`]: target[idKey],
      });
    });
  }

  const query = [
    ...getRelations,
    // allows us to get a reference to the node we're interested in
    `MERGE (node:${label} {${idKey}: $${idKey}})`,
    ...Object.keys(data).map((key) => {
      return `SET node.${key} = $${key}`;
    }),
    ...setRelations,
  ].join("\n");

  const parameters = data;
  for (const paramRelation of paramsRelations) {
    for (const key in paramRelation) {
      parameters[key] = paramRelation[key];
    }
  }

  return await graph.run(query, parameters);
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

function evaluateObject(
  data: Record<string, any>,
  object: Record<string, any>,
) {
  for (const key in object) {
    object[key] = evaluate(data, object[key]);
  }

  return object;
}

function extractFromPath(
  input: Record<string, any>,
  path: (string | number)[],
) {
  let curr = input;

  for (const key of path) {
    if (curr[key] === undefined) return undefined;

    curr = curr[key];
  }

  return curr;
}

function assert(ok: boolean, msg: string) {
  if (!ok) {
    throw new AssertionFailed(msg);
  }
}

class AssertionFailed extends Error {}
