import { sleep } from "bun";
import { graph } from "../../graph/client";
import { wikidata } from "./client/wikidata";
import { extractItems } from "./data/extract";
import historicalEvents, {
  type HistoricalEventsItem,
} from "./query/historical-events";

export default async () => {
  console.log(`---Start Wikibase import`);

  const pagination = { limit: 100, offset: 0 };

  await graph.run(
    `
    CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event) REQUIRE e.wd_id IS UNIQUE
    `,
  );

  const COUNTRY_FRANCE = "Q142";
  while (pagination.offset <= 500) {
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
      try {
        // await graph.run(
        //   `
        // MATCH (france: Country { label: "France" })
        // MERGE (a:Event { label: $name1, date: $date, wd_id: $wikidata_id })-[:COUNTRY]->(france)
        // `,
        //   {
        //     name1: item.itemLabel.value,
        //     date: item.date.value,
        //     wd_id: item.item.value.split("/").at(-1),
        //   },
        // );
        //
        await graph.run(
          `
          MATCH (france: Country { label: "France" })
          MERGE (event:Event {wd_id: $wd_id })
          SET event.wd_id = $wd_id
          SET event.label = $label
          SET event.date = $date
          MERGE (event)-[:COUNTRY]->(france)
          `,
          {
            label: item.itemLabel.value,
            date: item.date.value,
            wd_id: item.item.value.split("/").at(-1),
          },
        );
      } catch (e) {
        console.error(e);
      }
    }

    pagination.offset += 100;

    Bun.sleepSync(10);
  }

  console.log(`---End Wikibase import`);
};
