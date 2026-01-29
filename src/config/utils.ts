
/**
 * Sets a value in a nested object using a dot-notation path.
 * 
 * @param obj The object to modify
 * @param path The path string (e.g. "channels.telegram.token")
 * @param value The value to set
 */
export function setByPath(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // Create nested object if it doesn't exist
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
}
