import wikidata from "./dataset/wikibase/import";
import base from "./dataset/base/import";

await base();
await wikidata();
