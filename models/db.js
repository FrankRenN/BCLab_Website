const mysql = require('mysql2/promise');
const { decrypt } = require('../utils/encryption');

const decryptedPassword = decrypt(process.env.DB_PASSWORD);

// initializing database pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: decryptedPassword,
    database: process.env.DB_NAME,
});

db.getConnection()
    .then(() => console.log('Connected to the database'))
    .catch((err) => console.error('Error connecting to the database:', err));

module.exports = db;
