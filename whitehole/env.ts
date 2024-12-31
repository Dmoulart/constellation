export function env(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`'${name}' environment variable not defined.`);
  }
  return value;
}

