const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.resolve(__dirname, "..", "..", "nodent.db");
const db = new sqlite3.Database(dbPath);

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function main() {
  const total = await get(`SELECT COUNT(*) AS c FROM english_prompts`);
  const dupGroups = await get(`
    SELECT COUNT(*) AS c FROM (
      SELECT
        lower(trim(prompt_text)) AS k,
        substr(trim(replace(upper(coalesce(section, '')), 'SECTION ', '')), 1, 1) AS s,
        CASE
          WHEN substr(trim(replace(upper(coalesce(section, '')), 'SECTION ', '')), 1, 1) = 'A'
          THEN book_id
          ELSE 0
        END AS b,
        COUNT(*) AS n
      FROM english_prompts
      GROUP BY s, b, k
      HAVING COUNT(*) > 1
    )
  `);
  const placeholders = await get(`
    SELECT COUNT(*) AS c
    FROM english_prompts
    WHERE lower(trim(prompt_text)) IN (
      'title: creative writing',
      'title: creative writing.',
      'creative writing',
      'creative writing.'
    )
  `);
  const sectionACount = await get(`
    SELECT COUNT(*) AS c
    FROM english_prompts
    WHERE substr(trim(replace(upper(coalesce(section, '')), 'SECTION ', '')), 1, 1) = 'A'
      AND (
        lower(trim(prompt_text)) LIKE 'i.%' OR
        lower(trim(prompt_text)) LIKE 'i)%' OR
        lower(trim(prompt_text)) LIKE '(i)%' OR
        lower(trim(prompt_text)) LIKE 'ii.%' OR
        lower(trim(prompt_text)) LIKE 'ii)%' OR
        lower(trim(prompt_text)) LIKE '(ii)%' OR
        lower(trim(prompt_text)) LIKE 'iii.%' OR
        lower(trim(prompt_text)) LIKE 'iii)%' OR
        lower(trim(prompt_text)) LIKE '(iii)%' OR
        lower(trim(prompt_text)) LIKE 'iv.%' OR
        lower(trim(prompt_text)) LIKE 'iv)%' OR
        lower(trim(prompt_text)) LIKE '(iv)%' OR
        lower(trim(prompt_text)) LIKE 'v.%' OR
        lower(trim(prompt_text)) LIKE 'v)%' OR
        lower(trim(prompt_text)) LIKE '(v)%' OR
        lower(trim(prompt_text)) LIKE 'vi.%' OR
        lower(trim(prompt_text)) LIKE 'vi)%' OR
        lower(trim(prompt_text)) LIKE '(vi)%' OR
        lower(trim(prompt_text)) LIKE 'vii.%' OR
        lower(trim(prompt_text)) LIKE 'vii)%' OR
        lower(trim(prompt_text)) LIKE '(vii)%' OR
        lower(trim(prompt_text)) LIKE 'viii.%' OR
        lower(trim(prompt_text)) LIKE 'viii)%' OR
        lower(trim(prompt_text)) LIKE '(viii)%' OR
        lower(trim(prompt_text)) LIKE 'ix.%' OR
        lower(trim(prompt_text)) LIKE 'ix)%' OR
        lower(trim(prompt_text)) LIKE '(ix)%' OR
        lower(trim(prompt_text)) LIKE 'x.%' OR
        lower(trim(prompt_text)) LIKE 'x)%' OR
        lower(trim(prompt_text)) LIKE '(x)%'
      )
  `);

  console.log(`total_prompts=${Number(total?.c || 0)}`);
  console.log(`duplicate_groups=${Number(dupGroups?.c || 0)}`);
  console.log(`creative_writing_placeholders=${Number(placeholders?.c || 0)}`);
  console.log(`section_a_leading_roman_candidates=${Number(sectionACount?.c || 0)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
