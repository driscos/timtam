import pg from 'pg';

export const CHOICES = ['penguin', 'timtam'];

// Each store records at most one vote per voter id (the value of the `voter` cookie).
// vote() returns true if the vote was recorded, or false if this voter had already voted.

export function createMemoryStore() {
  const votes = new Map();
  return {
    async init() {},
    async vote(voterId, choice) {
      if (votes.has(voterId)) return false;
      votes.set(voterId, choice);
      return true;
    },
    async choiceFor(voterId) {
      return votes.get(voterId) ?? null;
    },
    async counts() {
      const counts = Object.fromEntries(CHOICES.map((c) => [c, 0]));
      for (const choice of votes.values()) counts[choice]++;
      return counts;
    },
    async close() {},
  };
}

export function createPgStore(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5 });
  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS votes (
          id         BIGSERIAL PRIMARY KEY,
          voter_id   UUID NOT NULL UNIQUE,
          choice     TEXT NOT NULL CHECK (choice IN ('penguin', 'timtam')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    },
    async vote(voterId, choice) {
      const { rowCount } = await pool.query(
        'INSERT INTO votes (voter_id, choice) VALUES ($1, $2) ON CONFLICT (voter_id) DO NOTHING',
        [voterId, choice],
      );
      return rowCount === 1;
    },
    async choiceFor(voterId) {
      const { rows } = await pool.query('SELECT choice FROM votes WHERE voter_id = $1', [voterId]);
      return rows[0]?.choice ?? null;
    },
    async counts() {
      const { rows } = await pool.query('SELECT choice, count(*)::int AS n FROM votes GROUP BY choice');
      const counts = Object.fromEntries(CHOICES.map((c) => [c, 0]));
      for (const { choice, n } of rows) counts[choice] = n;
      return counts;
    },
    close: () => pool.end(),
  };
}
