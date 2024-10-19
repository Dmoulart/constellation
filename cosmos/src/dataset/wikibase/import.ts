import { graph } from "../../graph/client";
import { wikidata } from "./client/wikidata";
import { extractItems } from "./data/extract";
import historicalEvents, {
  type HistoricalEventsItem,
} from "./query/historical-events";

export default async () => {
  console.log(`---Start Wikibase import`);

  const pagination = { limit: 100, offset: 0 };

  const COUNTRY_FRANCE = "Q142";

  while (pagination.offset <= 10_000) {
    const result = await wikidata.query<HistoricalEventsItem>(
      historicalEvents({
        country: COUNTRY_FRANCE,
        pagination,
      }),
    );

    console.log(
      `---Wikibase import : ${result.results.bindings.length} results`,
    );

    const items = extractItems(result);

    for (const item of items) {
      await graph.run(
        `
        MATCH (france: Country { label: "France" })
        MERGE (a:Event { label: $name1, date: $date })<-[:COUNTRY]-(france)
        `,
        { name1: item.itemLabel.value, date: item.date.value, name2: "France" },
      );
    }

    pagination.offset += 100;
  }

  console.log(`---End Wikibase import`);
};
