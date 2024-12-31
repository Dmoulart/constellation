<template>
    <div id="map" class="map" />
    <slot v-if="loaded" />
</template>
<script setup lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";
const attrs = useAttrs();
const map = shallowRef();
const loaded = ref(false);
/*const loaded = computed(() => {
    if (map.value) {
        return useMapIsLoaded(map.value);
    }

    return false;
});
*/

provide("map", map);

onMounted(async () => {
    const maplibregl = await import("maplibre-gl");

    map.value = new maplibregl.Map({
        container: "map", // container id
        style: "https://demotiles.maplibre.org/style.json", // style URL
        center: [0, 0], // starting position [lng, lat]
        zoom: 1, // starting zoom
        ...(attrs ?? {}),
    });

    map.value.on("load", () => (loaded.value = true));
});
</script>

<style>
.map {
    height: 100vh;
    width: 100vw;
}
</style>
