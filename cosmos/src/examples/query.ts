import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  `neo4j://localhost:7687`,
  neo4j.auth.basic("neo4j", "password"),
);

const session = driver.session();

// Query data with a relationship
const queryData = async () => {
  const readResult = await session.run(
    "MATCH (a:Person)-[r:FRIEND]->(b:Person) WHERE a.name = $name1 AND b.name = $name2 RETURN a, r, b",
    { name1: "Alice", name2: "Bob" },
  );
  readResult.records.forEach((record) => {
    console.log(
      `${record.get("a").properties.name} is friends with ${record.get("b").properties.name}`,
    );
    console.log(record.get("r"));
  });
};

try {
  await queryData();
} catch (error) {
  console.error(error);
} finally {
  await session.close();
  await driver.close();
}
