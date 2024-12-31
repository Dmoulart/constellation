<template></template>

<script setup lang="ts">
import { FeatureCollection } from "geojson";

defineProps<{ data: FeatureCollection }>();

const map = inject("map");

onMounted(() => {
    console.log(map);
});
</script>
