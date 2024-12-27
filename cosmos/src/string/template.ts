export function createStringTemplate(
  template: string,
): (variables: Record<string, any>) => string {
  return function (variables: Record<string, any>): string {
    return template.replace(/\$([a-zA-Z_]\w*)/g, (match, key) => {
      if (key in variables) {
        return variables[key];
      }
      return match; // If the key is not in the object, keep the placeholder
    });
  };
}
