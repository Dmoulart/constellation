import type { WDAttribute } from "../data/extract";
import type { QueryOf } from "./query";

type HistoricalEvents = {
  country: string;
};

const query = ({
  country,
  pagination: { limit, offset },
}: QueryOf<HistoricalEvents>) => `
  SELECT DISTINCT ?item ?itemLabel ?date WHERE {
    SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],fr". }
    {
      SELECT DISTINCT ?item ?date WHERE {
        ?item p:P17 ?statement0.
        ?statement0 (ps:P17/(wdt:P279*)) wd:${country}.
        ?item p:P31 ?statement1.
        ?statement1 (ps:P31/(wdt:P279*)) wd:Q13418847.
        OPTIONAL { ?item wdt:P585 ?date. }
      }
      LIMIT ${limit}
      OFFSET ${offset}
    }
  }
`;

export type HistoricalEventsItem = {
  item: WDAttribute;
  date: WDAttribute;
  itemLabel: WDAttribute;
};

export default query;
