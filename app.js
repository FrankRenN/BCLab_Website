const express = require('express');
const cors = require('cors');
const mysql = require('mysql');

// initializing express
const app = express();
app.use(cors());
app.use(express.json());

// datapool configuration
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'labdatabase'
});

// testing connection
db.getConnection((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to the database');
    }
});

// general query data
const queryDatabase = (sql, res) => {
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send({
                warn: 'error',
                message: 'Error fetching data from the database',
            });
        } else {
            res.status(200).send(results);
        }
    });
};

// get data from each table
app.get('/experiment', (req, res) => {
    const sql = 'SELECT * FROM experiment';
    queryDatabase(sql, res);
});

app.get('/run', (req, res) => {
    const sql = 'SELECT * FROM run';
    queryDatabase(sql, res);
});

app.get('/barcode', (req, res) => {
    const sql = 'SELECT * FROM barcode';
    queryDatabase(sql, res);
});

app.get('/hardware', (req, res) => {
    const sql = 'SELECT * FROM hardware';
    queryDatabase(sql, res);
});

app.get('/library_prep', (req, res) => {
    const sql = 'SELECT * FROM library_prep';
    queryDatabase(sql, res);
});

app.get('/note', (req, res) => {
    const sql = 'SELECT * FROM note';
    queryDatabase(sql, res);
});

app.get('/operator', (req, res) => {
    const sql = 'SELECT * FROM operator';
    queryDatabase(sql, res);
});

app.get('/participants', (req, res) => {
    const sql = 'SELECT * FROM participants';
    queryDatabase(sql, res);
});

app.get('/sample', (req, res) => {
    const sql = 'SELECT * FROM sample';
    queryDatabase(sql, res);
});

app.get('/sequencing_unit', (req, res) => {
    const sql = 'SELECT * FROM sequencing_unit';
    queryDatabase(sql, res);
});


// query some tables
app.get('/:tableName', (req, res) => {
    const tableName = req.params.tableName;
    const sql = `SELECT * FROM ??`;
    db.query(sql, [tableName], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send({
                warn: 'error',
                message: `Error fetching data from table ${tableName}`,
            });
        } else {
            res.status(200).send(results);
        }
    });
});

// Delete data from a table by primary key ID
app.delete('/delete/:tableName/:id', (req, res) => {
    const tableName = req.params.tableName;
    const id = req.params.id;
    const sql = `DELETE FROM ?? WHERE id = ?`;
    db.query(sql, [tableName, id], (err, results) => {
        if (err) {
            console.error('Error executing delete query:', err);
            res.status(500).send({
                warn: 'error',
                message: `Error deleting data from table ${tableName} with id ${id}`,
            });
        } else {
            res.status(200).send({
                success: true,
                message: `Successfully deleted data from table ${tableName} with id ${id}`,
            });
        }
    });
});

// Start sever
const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
