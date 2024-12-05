const express = require('express');
const { getPaginatedData, deleteData, addData} = require('../controllers/dbController');
const validateTable = require('../middlewares/validateTable');

const router = express.Router();

router.get('/:tableName', validateTable, getPaginatedData); // query by pages
router.delete('/delete/:tableName/:id', validateTable, deleteData); //delete data
router.post('/:tableName', validateTable, addData);

module.exports = router;
