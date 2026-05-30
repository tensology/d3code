const snapPattern = /[\s.,!?;:)\]]/

export function pacedStep(remaining: number): number {
  if (remaining <= 12) return 2
  if (remaining <= 48) return 4
  if (remaining <= 96) return 8
  return Math.min(24, Math.ceil(remaining / 8))
}

export function nextPacedText(text: string, shownLength: number): string {
  if (shownLength >= text.length) return text
  const end = Math.min(text.length, shownLength + pacedStep(text.length - shownLength))
  const max = Math.min(text.length, end + 8)
  for (let index = end; index < max; index++) {
    if (snapPattern.test(text[index] ?? "")) return text.slice(0, index + 1)
  }
  return text.slice(0, end)
}
