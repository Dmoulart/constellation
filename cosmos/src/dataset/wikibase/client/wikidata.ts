import { WBK, type InstanceConfig } from "wikibase-sdk";
import type { WDResponse } from "../data/extract";

const createWikidataClient = (config: InstanceConfig) => {
  const client = WBK(config);

  return {
    async query<T>(query: string): Promise<WDResponse<T>> {
      try {
        const url = client.sparqlQuery(query);
        const response = await fetch(url);
        const data = await response.json();
        return data;
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
  };
};

export const wikidata = createWikidataClient({
  instance: "https://www.wikidata.org",
  sparqlEndpoint: "https://query.wikidata.org/sparql",
});
