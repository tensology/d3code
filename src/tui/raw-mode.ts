export function canEnableRawMode(input: Pick<NodeJS.ReadStream, "isTTY">): boolean {
  return input.isTTY === true
}
