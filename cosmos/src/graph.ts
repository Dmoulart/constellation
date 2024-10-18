import neo4j from "neo4j-driver";
import { env } from "./env";

export const driver = neo4j.driver(
  env("NEO4J_URL"),
  neo4j.auth.basic(env("NEO4J_USERNAME"), env("NEO4J_PASSWORD")),
);

export const graph = driver.session();
