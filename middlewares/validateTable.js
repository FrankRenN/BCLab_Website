// white list for tables
const allowedTables = [
    'experiment', 'run', 'barcode', 'run_hardware',
    'experiment_hardware', 'library_prep', 'note',
    'operator', 'participants', 'sample', 'sequencing_unit'
];

const validateTable = (req, res, next) => {
    const { tableName } = req.params;
    if (!allowedTables.includes(tableName)) {
        return res.status(400).send({ error: 'Invalid table name' });
    }
    next();
};

module.exports = validateTable;
