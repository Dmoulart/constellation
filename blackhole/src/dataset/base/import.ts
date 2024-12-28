import { graph } from "../../graph/client";
import { GraphNode } from "../../graph/node";
import { cypher } from "../../graph/cypher";

const BASE_NODES: GraphNode[] = [new GraphNode("Country", { label: "France" })];

export default async () => {
  for (const node of BASE_NODES) {
    await graph.run(cypher`MERGE ${node}`);
  }
};
