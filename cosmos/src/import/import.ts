import { readdir, readFile } from "node:fs/promises";
import { createStringTemplate } from "../string/template";
import { wikidata } from "../dataset/wikibase/client/wikidata";
type ImportParams = {
  args: Record<string, any>;
  limit: number;
};

type Import = {
  createQuery(options: Record<string, any>): string;
  params: ImportParams;
};

const imports = await generateImports();

imports.map(load);

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

export async function load(imp: Import) {
  try {
    const pagination = { limit: 100, offset: 0 };
    const limit = imp.params?.limit ?? 500;

    while (pagination.offset <= limit) {
      const result = await wikidata.query(
        imp.createQuery({ ...imp.params.args, ...pagination }),
      );

      console.log({ result });

      pagination.offset += 100;

      Bun.sleepSync(10);
    }
  } catch (e) {
    console.error("LOAD_ERROR", e);
    throw e;
  }
}
