const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

function parseSqlStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = '';

  const lines = sql.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('--')) {
      continue;
    }

    const delimiterMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += `${line}\n`;
    const candidate = buffer.trimEnd();

    if (candidate.endsWith(delimiter)) {
      const statement = candidate.slice(0, -delimiter.length).trim();
      if (statement) statements.push(statement);
      buffer = '';
    }
  }

  const remaining = buffer.trim();
  if (remaining) statements.push(remaining);

  return statements;
}

async function runSqlFile(connection, filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const statements = parseSqlStatements(raw);

  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    try {
      await connection.query(statement);
    } catch (err) {
      err.message = `Failed at ${path.basename(filePath)} statement ${i + 1}: ${err.message}`;
      throw err;
    }
  }
}

async function verify() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
  });

  try {
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const migratePath = path.resolve(__dirname, '../../database/migrate.sql');

    console.log('Applying schema.sql...');
    await runSqlFile(connection, schemaPath);

    console.log('Applying migrate.sql (pass 1)...');
    await runSqlFile(connection, migratePath);

    console.log('Applying migrate.sql (pass 2/idempotency)...');
    await runSqlFile(connection, migratePath);

    console.log('Migration verification complete.');
  } finally {
    await connection.end();
  }
}

verify().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
