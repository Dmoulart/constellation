import { graph } from "~/graph/client";

export default defineEventHandler(async (ev) => {
  const body = await readBody(ev);

  const nodes = await graph.run("MATCH (n: Hospitals) RETURN n");

  return nodes.records.map((r) => r.toObject().n).map((obj) => obj.properties);
});
