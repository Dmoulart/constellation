import { WBK } from "wikibase-sdk";

export const wikidata = WBK({
  instance: "https://www.wikidata.org",
  sparqlEndpoint: "https://query.wikidata.org/sparql",
});

const url = wikidata.getEntities({
  ids: ["Q1", "Q5", "Q571"],
  languages: ["en", "fr", "de"], // returns all languages if not specified
  props: ["info", "claims"], // returns all props if not specified
  format: "json", // default: json
});
const { entities } = await fetch(url).then((res) => res.json());
console.log(entities);
