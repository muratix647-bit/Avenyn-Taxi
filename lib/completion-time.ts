const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function completionLocalTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

// datetime-local has no timezone. Interpret it explicitly as Swedish local time.
export function completionUtcTime(value: unknown): string {
  const local = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local))
    throw new Error('Ange ett giltigt avslutsdatum och en tid.');
  const target = local.length === 16 ? `${local}:00` : local;
  const wall = Date.parse(`${target}Z`);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(`${completionLocalTime(new Date(instant).toISOString())}Z`);
    instant += wall - rendered;
  }
  if (!Number.isFinite(instant) || completionLocalTime(new Date(instant).toISOString()) !== target)
    throw new Error('Ange ett giltigt avslutsdatum och en tid (svensk tid).');
  return new Date(instant).toISOString();
}
