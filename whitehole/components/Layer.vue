<template><div /></template>
<script setup lang="ts">
import { whenever } from "@vueuse/core";
const props = defineProps<{ layer: Record<string, any> }>();

const map = inject<Map>("map");

onMounted(() => {
    map.value.addLayer(props.layer);
});
</script>
