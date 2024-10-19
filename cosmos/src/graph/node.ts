export class GraphNode {
  constructor(
    public label: string,
    public properties: Record<string, any> = {},
  ) {}

  toSparql() {
    const props = [];

    for (const [key, val] of Object.entries(this.properties)) {
      let property = `${key}: `;

      if (typeof val === "string") {
        property += `'${val}'`;
      } else if (typeof val === "number") {
        property += `${val}`;
      } else {
        throw new Error("not implemented");
      }

      props.push(property);
    }

    return `(item: ${this.label} {${props.join(",")}})`;
  }
}

export function to({ label, properties }: GraphNode) {
  const props = [];

  for (const [key, val] of Object.entries(properties)) {
    let property = `${key}: `;

    if (typeof val === "string") {
      property += `'${val}'`;
    } else if (typeof val === "number") {
      property += `${val}`;
    } else {
      throw new Error("not implemented");
    }

    props.push(property);
  }

  return `(item: ${label} {${props.join(",")}})`;
}
