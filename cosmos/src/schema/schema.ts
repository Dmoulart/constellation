import schema from "./schema.json";

export type Attribute = {
  unique?: boolean;
  type?: string;
};

export type Attributes = Record<string, Attribute>;

export type NodeSchemaDefinition = {
  label: string;
  attributes: Array<string>;
  relations: Array<string>;
};

export type NodeSchema = {
  label: string;
  attributes: Attributes;
  relations: Array<string>;
};

export function buildNodeSchema(definition: NodeSchemaDefinition) {
  const nodeSchema: NodeSchema = {
    label: definition.label,
    attributes: {},
    relations: [],
  };

  for (const attributeName of definition.attributes) {
    if (attributeName in schema.attributes) {
      nodeSchema.attributes[attributeName] =
        schema.attributes[attributeName as keyof (typeof schema)["attributes"]];
    } else {
      throw new Error(`Unknown attribute ${attributeName}`);
    }
  }
  return nodeSchema;
}

export function collectSchemaUniqueAttributes(schema: NodeSchema) {
  return Object.values(schema.attributes).filter((attr) => attr.unique);
}
