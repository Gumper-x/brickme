export const createBrickGreeting = (name: string) => `Hello from ${name}`

export const toBrickClassName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
