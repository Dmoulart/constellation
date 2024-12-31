<template>
    <slot v-if="addedSource" />
</template>

<script setup lang="ts">
import type { Map } from "maplibre-gl";
const props = defineProps<{ sourceId: string; source: any }>();
const map = inject<Map>("map");

const addedSource = computed(() => {
    if (map) {
        return useMapSource(props.sourceId, map.value);
    }
    return undefined;
});

onMounted(() => {
    map.value.addSource(props.sourceId, props.source);
});
</script>
