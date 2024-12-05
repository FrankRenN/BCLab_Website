const { queryTable, deleteFromTable, insertData } = require('../models/tableModel');

const db = require('../models/db');

// query by pages
const getPaginatedData = async (req, res, next) => {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    try {
        let sql = `SELECT * FROM ?? LIMIT ? OFFSET ?`;
        let params = [tableName, limit, offset];

        if (search) {
            sql = `SELECT * FROM ?? WHERE CONCAT_WS(' ', ${await getColumnNames(tableName)}) LIKE ? LIMIT ? OFFSET ?`;
            params = [tableName, search, limit, offset];
        }

        const [data] = await db.query(sql, params);
        res.status(200).send(data);
    } catch (err) {
        next(err);
    }
};

const getColumnNames = async (tableName) => {
    const [columns] = await db.query(`SHOW COLUMNS FROM ??`, [tableName]);
    return columns.map(col => col.Field).join(', ');
};

// delete data
const deleteData = async (req, res, next) => {
    const { tableName, id } = req.params;

    try {
        const result = await deleteFromTable(tableName, id);
        res.status(200).send({ success: true, message: `Deleted ID ${id} from ${tableName}` });
    } catch (err) {
        next(err);
    }
};

const addData = async (req, res, next) => {
    const { tableName } = req.params; // 获取表名
    const { experiment_id } = req.body; // 获取请求体中的 experiment_id

    try {
        await insertData(tableName, experiment_id); // 调用 tableModel 中的 insertData 函数
        res.status(201).send({
            success: true,
            message: 'Data inserted successfully'
        });
    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).send({
            success: false,
            message: 'Error inserting data into the database'
        });
    }
};


module.exports = { getPaginatedData, deleteData, addData};
