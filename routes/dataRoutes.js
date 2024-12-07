const express = require('express');
const { getPaginatedData, deleteData, createRun, createExperiment, addComputer, addMinion, editRecord} = require('../controllers/dbController');
const validateTable = require('../middlewares/validateTable');

const router = express.Router();

router.get('/:tableName', validateTable, getPaginatedData); // query by pages

router.delete('/delete/:tableName/:id', validateTable, async (req, res, next) => {
    const { tableName, id } = req.params;

    if (isNaN(id)) {
        return res.status(400).send({ success: false, message: 'Invalid ID provided' });
    }

    try {
        const result = await deleteData(tableName, id);

        if (result.affectedRows > 0) {
            res.status(200).send({ success: true, message: `Deleted ID ${id} from ${tableName}` });
        } else {
            res.status(404).send({ success: false, message: `Record with ID ${id} not found in ${tableName}` });
        }
    } catch (err) {
        console.error(`Error deleting data: ${err.message}`);
        res.status(500).send({ success: false, message: 'Internal Server Error' });
    }
});

//create router for run
router.post('/run', async (req, res, next) => {
    try {
        const { date_run_start, experiment_id, computer, minion, notes } = req.body;
        const result = await createRun(date_run_start, experiment_id, computer, minion, notes);
        res.status(201).send(result);
    } catch (error) {
        next(error);
    }
});

//create router for experiment
router.post('/experiment', async (req, res, next) => {
    try {
        const { name, protocol, metadata, date_started, description } = req.body;
        const result = await createExperiment(name, protocol, metadata, date_started, description);
        res.status(201).send(result);
    } catch (error) {
        next(error);
    }
});

//create router for computer
router.post('/computer', async (req, res, next) => {
    try {
        const { device_name } = req.body;
        const result = await addComputer(device_name);
        res.status(201).send(result);
    } catch (error) {
        console.error('Error adding computer:', error);
        next(error);
    }
});

// create router for minion
router.post('/minion', async (req, res, next) => {
    try {
        const { name, computer_used, device_date, notes } = req.body;
        const result = await addMinion(name, computer_used, device_date, notes);
        res.status(201).send(result);
    } catch (error) {
        console.error('Error in POST /minion:', error);
        next(error);
    }
});

router.put('/:tableName/:id', validateTable, async (req, res, next) => {
    try {
        const { tableName, id } = req.params;
        const fields = req.body;

        if (!fields || Object.keys(fields).length === 0) {
            return res.status(400).send({
                success: false,
                message: 'No fields provided for update',
            });
        }

        const result = await editRecord(tableName, id, fields);
        res.status(200).send(result);
    } catch (error) {
        console.error('Error updating record:', error);
        next(error);
    }
});

module.exports = router;
