import type { Map } from "maplibre-gl";

export function useMapSource(sourceID: string, map: Map) {
  const source = shallowRef();

  map.on("sourcedata", () => {
    source.value = map.getSource(sourceID);
  });

  return source;
}

export function useMapIsLoaded(map: Map) {
  const loaded = shallowRef(false);

  map.on("styledata", () => {
    loaded.value = map.loaded();
  });

  return loaded;
}
