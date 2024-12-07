const express = require('express');
const { getPaginatedData, deleteData, createRun, createExperiment} = require('../controllers/dbController');
const validateTable = require('../middlewares/validateTable');

const router = express.Router();

router.get('/:tableName', validateTable, getPaginatedData); // query by pages
router.delete('/delete/:tableName/:id', validateTable, deleteData); //delete data

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


module.exports = router;
