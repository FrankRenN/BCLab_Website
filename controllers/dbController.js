const { queryTable, deleteFromTable, insertData, editTable } = require('../models/tableModel');

const db = require('../models/db');

// Create user
const createUser = async (email, hashedPassword) => {
    const sql = `INSERT INTO user (email, password) VALUES (?, ?)`;
    try {
        const [result] = await db.query(sql, [email, hashedPassword]);
        return { success: true, insertId: result.insertId };
    } catch (error) {
        console.error("Error creating user:", error);
        throw new Error("Failed to create user");
    }
};

// Find user by email
const findUserByEmail = async (email) => {
    const sql = `SELECT * FROM user WHERE email = ?`;
    try {
        const [rows] = await db.query(sql, [email]);
        return rows[0];
    } catch (error) {
        console.error("Error finding user by email:", error);
        throw new Error("Failed to find user");
    }
};

// query by pages
const getPaginatedData = async (req, res, next) => {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const searchColumn = req.query.searchColumn || null;

    try {
        let sql = `SELECT * FROM ?? LIMIT ? OFFSET ?`;
        let params = [tableName, limit, offset];

        if (search && searchColumn && searchColumn !== 'default') {
            sql = `SELECT * FROM ?? WHERE ?? LIKE ? LIMIT ? OFFSET ?`;
            params = [tableName, searchColumn, search, limit, offset];
        } else if (search) {
            sql = `SELECT * FROM ?? WHERE CONCAT_WS(' ', ${await getColumnNamesOnly(tableName)}) LIKE ? LIMIT ? OFFSET ?`;
            params = [tableName, search, limit, offset];
        }

        const [data] = await db.query(sql, params);
        res.status(200).send(data);
    } catch (err) {
        console.error("Error querying paginated data:", err.message);
        res.status(500).send({ error: "Failed to query", message: err.message });
    }
};

// get column names for search bar
const getColumns = async (req, res, next) => {
    const { tableName } = req.params;
    try {
        const [columns] = await db.query(`SHOW COLUMNS FROM ??`, [tableName]);
        const columnNames = columns.map((col) => col.Field);
        res.status(200).send(columnNames); 
    } catch (error) {
        console.error(`Error fetching columns for ${tableName}: ${error.message}`);
        res.status(500).send({ error: 'Failed to get column names' });
    }
};

// delete data
const deleteData = async (tableName, id) => {
    const sql = `DELETE FROM ?? WHERE id = ?`;

    try {
        const [results] = await db.query(sql, [tableName, id]);
        return results;
    } catch (error) {
        console.error(`SQL Error: ${error.message}`);
        throw new Error(`Failed to delete record from ${tableName}`);
    }
};

//create new run
const createRun = async (date_run_start, experiment_id, computer, minion, notes) => {
    return await insertData('run', {
        date_run_start,
        experiment_id,
        computer,
        minion,
        notes,
    });
};

//create new experiment
const createExperiment = async (name, protocol, metadata, date_started, description) => {
    return await insertData('experiment', {
        name,
        protocol,
        metadata,
        date_started,
        description,
    });
};

//add new computer to the list
const addComputer = async (device_name) => {
    return await insertData('computer', {
        device_name,
    });
};

//add new minion to the list
const addMinion = async (name, computer_used, device_date, notes) => {
    return await insertData('minion', {
        name,
        computer_used,
        device_date,
        notes,
    });
};

//add new participants
const addParticipant = async (name) => {
    return await insertData('participant', {
        name,
        experiment_id,
    });
};

//add new samples
const addSample = async (name, code) => {
    return await insertData('sample', {
        name,
        code,
        experiment_id,
    });
};

const addOperator = async (role, participant_id, run_id) => {
    return await insertData('operator', {
        role,
        participant_id,
        run_id,
    });
};

const addBarcode = async (sample_name, barcode, run_id) => {
    return await insertData('barcode', {
        sample_name,
        barcode,
        run_id,
    });
};

const addSequencing_unit = async (type, code, pores_start, pores_after, date, run_id) => {
    return await insertData('sequencing_unit', {
        type,
        code,
        pores_start,
        pores_after,
        date,
        run_id,
    });
};

const addLibrary_prep = async (prep_kit, date_opened, sample_num, owner, run_id) => {
    return await insertData('library_prep', {
        prep_kit,
        date_opened,
        sample_num,
        owner,
        run_id,
    });
};

//edit table record
const editRecord = async (tableName, id, fields) => {
    return await editTable(tableName, id, fields);
};


module.exports = {
    getPaginatedData, deleteData, createRun, createExperiment, addComputer, addMinion, editRecord,
    createUser, findUserByEmail, getColumns, addParticipant, addSample, addBarcode, addLibrary_prep,
    addOperator, addSequencing_unit
};
