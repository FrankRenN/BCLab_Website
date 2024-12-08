const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateTable = require('../middlewares/validateTable');
const nodemailer = require('nodemailer');
const redis = require('redis');
const client = redis.createClient();
const {
    getPaginatedData, deleteData, createRun, createExperiment, addComputer, addMinion, editRecord,
    createUser, findUserByEmail, getColumns, addParticipant, addSample
} = require('../controllers/dbController');

const router = express.Router();

//=============================== Verification code ================================
const sendVerificationEmail = async (email, code) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER, // default email
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification Code',
        text: `Your verification code is: ${code}`,
    };

    await transporter.sendMail(mailOptions);
};

router.post('/register/send_email', async (req, res, next) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000); // Six-digit verification code

    try {
        await sendVerificationEmail(email, code);
        client.setEx(`email_code:${email}`, 600, code.toString()); // save to redus for 600 seconds

        res.status(200).send({ success: true, message: 'Verification code sent successfully' });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).send({ success: false, message: 'Failed to send the verification code.' });
    }
});

//================================ User registration and login ===================================

router.post('/register', async (req, res, next) => {
    const { username, email, password, vercode } = req.body;

    // verify code
    const savedCode = await new Promise((resolve) =>
        client.get(`email_code:${email}`, (err, code) => resolve(code))
    );

    if (!savedCode || savedCode !== vercode) {
        return res.status(400).send({ success: false, message: 'incorrect code' });
    }

    try {
        // check if user exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).send({ success: false, message: 'User exists' });
        }

        // hash and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await createUser(username, email, hashedPassword);

        res.status(201).send({ success: true, message: 'Register successfully', userId: result.insertId });
    } catch (error) {
        console.error("Registration error:", error);
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // look up for user
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(400).send({ success: false, message: 'user does not exist' });
        }

        // check the password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).send({ success: false, message: 'password incorrect' });
        }

        // generate JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).send({
            success: true,
            message: 'login successfully',
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        next(error);
    }
});

//================================ Website function ===================================

// query by pages
router.get('/:tableName', validateTable, getPaginatedData);

//get column names for search bar
router.get('/columns/:tableName', validateTable, getColumns);

// delete by id
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

// General function for data creation
const createData = async (req, res, next, createFunction, requiredFields, resourceName) => {
    const data = req.body;

    // Check if all required fields are provided
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
        return res.status(400).send({
            success: false,
            message: `Missing required fields: ${missingFields.join(', ')}`,
        });
    }

    try {
        const result = await createFunction(...requiredFields.map(field => data[field]));
        res.status(201).send({
            success: true,
            message: `${resourceName} created successfully`,
            data: result,
        });
    } catch (error) {
        console.error(`Error creating ${resourceName}:`, error.message);
        next(error);
    }
};


// Route for creating a run
router.post('/run', async (req, res, next) => {
    await createData(
        req, res, next, 
        createRun, 
        ['date_run_start', 'experiment_id', 'computer', 'minion', 'notes'], 
        'Run'
    );
});

// Route for creating an experiment
router.post('/experiment', async (req, res, next) => {
    await createData(
        req, res, next, 
        createExperiment, 
        ['name', 'protocol', 'metadata', 'date_started', 'description'], 
        'Experiment'
    );
});

// Route for creating a computer
router.post('/computer', async (req, res, next) => {
    await createData(
        req, res, next, 
        addComputer, 
        ['device_name'], 
        'Computer'
    );
});

// Route for creating a minion
router.post('/minion', async (req, res, next) => {
    await createData(
        req, res, next, 
        addMinion, 
        ['name', 'computer_used', 'device_date', 'notes'], 
        'Minion'
    );
});

// Route for adding a participant
router.post('/participants', async (req, res, next) => {
    await createData(
        req, res, next, 
        addParticipant, 
        ['name', 'experiment_id'], 
        'Participant'
    );
});

// Route for adding a sample
router.post('/samples', async (req, res, next) => {
    await createData(
        req, res, next, 
        addSample, 
        ['name', 'code', 'experiment_id'], 
        'Sample'
    );
});



// create router for editing
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
