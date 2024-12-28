export type WDResponse<Data> = {
  head: { vars: string[] };
  results: {
    bindings: Array<Data>;
  };
};

export type WDAttribute = {
  datatype?: string;
  "xml:type"?: string;
  type: string;
  value: string;
};

export function extractItems<T>(response: WDResponse<T>): Array<T> {
  return response.results.bindings;
}
