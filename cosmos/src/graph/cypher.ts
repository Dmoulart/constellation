import type { GraphNode } from "./node";

export function cypher(strings: TemplateStringsArray, ...values: GraphNode[]) {
  let query = "";

  for (let i = 0; i < strings.length; i++) {
    const string = strings[i];
    const value = values[i];

    query += string;

    query += value ? value.toSparql() : "";
  }

  return query;
}
