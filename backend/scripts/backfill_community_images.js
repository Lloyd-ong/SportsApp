require('dotenv').config();
const db = require('../db');
const { getImageForQuery, GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID } = require('../utils/cse');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isMapImageUrl = (value = '') =>
  /maps\.googleapis\.com\/maps\/api\/staticmap|onemap\.gov\.sg\/maps\/service/i.test(value);

async function run() {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    console.error('Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID in backend/.env');
    process.exit(1);
  }

  const [rows] = await db.execute(
    'SELECT id, name, sport, image_url FROM communities'
  );

  let updated = 0;
  let skipped = 0;
  let missingSport = 0;

  for (const row of rows) {
    const imageUrl = (row.image_url || '').trim();
    const hasImage = imageUrl && !isMapImageUrl(imageUrl);
    if (hasImage) {
      skipped += 1;
      continue;
    }

    const sport = row.sport && String(row.sport).trim();
    if (!sport) {
      missingSport += 1;
      continue;
    }

    const query = `${sport} sport community`;
    try {
      const found = await getImageForQuery(query);
      if (found) {
        await db.execute('UPDATE communities SET image_url = ? WHERE id = ?', [found, row.id]);
        updated += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.warn(`Failed to fetch image for community ${row.id}: ${err.message}`);
      skipped += 1;
    }

    await sleep(300);
  }

  console.log(`Backfill complete. Updated: ${updated}, skipped: ${skipped}, missing sport: ${missingSport}`);
  await db.end();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  db.end();
  process.exit(1);
});
