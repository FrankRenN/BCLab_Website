const db = require('./db');

//query table
const queryTable = async (tableName, limit, offset) => {
    const sql = `SELECT * FROM ?? LIMIT ? OFFSET ?`;
    const [results] = await db.query(sql, [tableName, limit, offset]);
    return results;
};

// delete data
const deleteFromTable = async (tableName, id) => {
    const sql = `DELETE FROM ?? WHERE id = ?`;
    const [results] = await db.query(sql, [tableName, id]);
    return results;
};

// create new run
const insertData = async (tableName, experiment_id) => {
    const sql = `INSERT INTO ?? (experiment_id) VALUES (?, ?)`;

    try {
        const [result] = await db.query(sql, [tableName, experiment_id]);
        return result;
    } catch (error) {
        console.error('Error inserting data:', error);
        throw error;
    }
};

module.exports = { queryTable, deleteFromTable, insertData};
