import { graph } from "../graph/client";
import { readdir, readFile } from "node:fs/promises";

export type Attribute = {
  unique?: boolean;
  type?: string;
};

export type Attributes = Record<string, Attribute>;

export type NodeSchemaDefinition = {
  label: string;
  attributes: Record<string, Attribute>;
};

export async function applyNodeConstraints() {
  const files = await readdir(`${__dirname}/nodes`);

  const schemas: Array<NodeSchemaDefinition> = await Promise.all(
    files.map(async (file) => {
      const content = (await readFile(`${__dirname}/nodes/${file}`)).toString();
      return JSON.parse(content);
    }),
  );

  const constraints = schemas.flatMap(generateConstraints);
  for (const query of constraints) {
    await graph.run(query);
  }
}

export function collectSchemaUniqueAttributes(schema: NodeSchemaDefinition) {
  return Object.entries(schema.attributes)
    .filter(([name, attr]) => attr.unique)
    .map(([name, attr]) => ({ name, attr }));
}

export function generateConstraints(schema: NodeSchemaDefinition) {
  const uniqueAttributes = collectSchemaUniqueAttributes(schema);

  return uniqueAttributes.map((attr) => {
    return `
    CREATE CONSTRAINT IF NOT EXISTS FOR (n:${schema.label}) REQUIRE n.${attr.name} IS UNIQUE
    `;
  });
}
