type Pagination = { limit: number; offset: number };

export type QueryOf<T> = T & { pagination: Pagination };
