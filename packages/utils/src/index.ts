export const createBrickGreeting = (name: string): string => `Hello from ${name}`

export const toBrickClassName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
