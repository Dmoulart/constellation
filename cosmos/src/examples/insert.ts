import { driver, graph } from "../graph";

// Insert data with a relationship
const insertData = async () => {
  const writeResult = await graph.run(
    "CREATE (a:Person { name: $name1 })-[:FRIEND]->(b:Person { name: $name2 })",
    { name1: "Alice", name2: "Bob" },
  );
};

try {
  await insertData();
} catch (error) {
  console.error(error);
} finally {
  await graph.close();
  await driver.close();
}
