import {
  buildNodeSchema,
  collectSchemaUniqueAttributes,
  type NodeSchemaDefinition,
} from "./schema";

export function generateNodeConstraintsQueries(
  definition: NodeSchemaDefinition,
) {
  const schema = buildNodeSchema(definition);
  const uniqueAttributes = collectSchemaUniqueAttributes(schema);

  return uniqueAttributes.map((attr) => {
    return `
    CREATE CONSTRAINT IF NOT EXISTS FOR (n:${schema.label}) REQUIRE n.${attr} IS UNIQUE
    `;
  });
}
