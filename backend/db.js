const { Pool } = require('pg');

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
};

const isProd = process.env.NODE_ENV === 'production';
const useSsl = parseBoolean(process.env.DB_SSL, isProd);
const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL
    }
  : {
      host: process.env.DB_HOST,
      port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };

if (useSsl) {
  config.ssl = { rejectUnauthorized };
}

const pool = new Pool(config);

function convertPlaceholders(sql) {
  let index = 0;
  let output = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const prevChar = i > 0 ? sql[i - 1] : '';

    if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
      output += char;
      continue;
    }
    if (char === '"' && !inSingleQuote && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      output += char;
      continue;
    }

    if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      index += 1;
      output += `$${index}`;
      continue;
    }

    output += char;
  }

  return output;
}

async function execute(sql, params = []) {
  const normalizedSql = convertPlaceholders(sql);
  const result = await pool.query(normalizedSql, params);
  const command = normalizedSql.trim().split(/\s+/, 1)[0].toUpperCase();
  const meta = {
    affectedRows: result.rowCount,
    insertId: result.rows[0] && typeof result.rows[0].id !== 'undefined' ? result.rows[0].id : null
  };
  if (command === 'SELECT' || command === 'WITH') {
    return [result.rows, meta];
  }
  return [meta, result.rows];
}

module.exports = {
  execute,
  query: execute,
  end: () => pool.end()
};
