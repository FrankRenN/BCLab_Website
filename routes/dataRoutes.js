const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateTable = require('../middlewares/validateTable');
const nodemailer = require('nodemailer');
const redis = require('redis');
const client = redis.createClient();
const {
    getPaginatedData, deleteData, createRun, createExperiment, addComputer, addMinion, editRecord,
    createUser, findUserByEmail} = require('../controllers/dbController');

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

// create router for run
router.post('/run', async (req, res, next) => {
    try {
        const { date_run_start, experiment_id, computer, minion, notes } = req.body;
        const result = await createRun(date_run_start, experiment_id, computer, minion, notes);
        res.status(201).send(result);
    } catch (error) {
        next(error);
    }
});

// create router for experiment
router.post('/experiment', async (req, res, next) => {
    try {
        const { name, protocol, metadata, date_started, description } = req.body;
        const result = await createExperiment(name, protocol, metadata, date_started, description);
        res.status(201).send(result);
    } catch (error) {
        next(error);
    }
});

// create router for computer
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
