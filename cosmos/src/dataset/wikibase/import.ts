import { graph } from "../../graph";
import { wikidata } from "./client/wikidata";
import {
  extractItems,
  type WDAttribute,
  type WDResponse,
} from "./data/extract";
import historicalEvents, {
  type HistoricalEventsItem,
} from "./query/historical-events";

export async function importData() {
  await graph.run(`MATCH (n) DETACH DELETE n`);

  await graph.run(`CREATE (france:Country { label: "France" })`);

  const pagination = { limit: 100, offset: 0 };

  const COUNTRY_FRANCE = "Q142";

  while (pagination.offset <= 200) {
    const result = await wikidata.query<HistoricalEventsItem>(
      historicalEvents({
        country: COUNTRY_FRANCE,
        pagination,
      }),
    );

    const items = extractItems(result);

    for (const item of items) {
      await graph.run(
        `
        MATCH (france: Country { label: "France" })
        CREATE (a:Event { label: $name1 })<-[:COUNTRY]-(france)
        `,
        { name1: item.itemLabel.value, name2: "France" },
      );
    }

    pagination.offset += 100;
  }
}
