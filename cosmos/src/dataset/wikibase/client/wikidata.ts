import { WBK, type InstanceConfig } from "wikibase-sdk";
import type { WDResponse } from "../data/extract";

const createWikidataClient = (config: InstanceConfig) => {
  const client = WBK(config);

  return {
    async query<T>(query: string): Promise<WDResponse<T>> {
      const url = client.sparqlQuery(query);
      return await fetch(url).then(async (value) => await value.json());
    },
  };
};

export const wikidata = createWikidataClient({
  instance: "https://www.wikidata.org",
  sparqlEndpoint: "https://query.wikidata.org/sparql",
});
