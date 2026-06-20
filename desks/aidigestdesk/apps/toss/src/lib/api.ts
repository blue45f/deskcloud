import data from '../sample-data.json';

export interface Update {
  id: string; title: string; provider: string; date: string;
  summary: string; impact: string; tags: string[]; url: string;
}

const items: Update[] = ((data as { items?: Update[] }).items || [])
  .slice()
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

export function getUpdates(): Update[] { return items; }
export function getUpdate(id: string): Update | undefined { return items.find((u) => u.id === id); }
