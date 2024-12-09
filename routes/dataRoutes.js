const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateTable = require('../middlewares/validateTable');
const nodemailer = require('nodemailer');
const redis = require('redis');
const client = redis.createClient();
const {
    getPaginatedData, deleteData, createRun, createExperiment, addComputer, addMinion, editRecord,
    createUser, findUserByEmail, getColumns, addParticipant, addSample, addBarcode, addLibrary_prep,
    addOperator, addSequencing_unit
} = require('../controllers/dbController');

const router = express.Router();

//=============================== Verification Code Management ===============================

// Handle Redis connection errors
client.on('error', (err) => {
    console.error('Redis Client Error', err);
});

// Automatically connect to Redis when the server starts
(async () => {
    try {
        if (!client.isOpen) {
            await client.connect();
            console.log("Redis connected successfully");
        }
    } catch (error) {
        console.error("Error connecting to Redis:", error);
    }
})();

/**
 * Send a verification email to the provided address.
 * 
 * @param {string} email - Recipient's email address.
 * @param {number} code - Verification code to be sent.
 */
const sendVerificationEmail = async (email, code) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER, 
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

/**
 * Endpoint to send a verification code to the user's email.
 * 
 * @route POST /register/send_email
 * @param {string} email - User's email address.
 * @returns {object} Success or failure message.
 */
router.post('/register/send_email', async (req, res, next) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000);  // Generate a six-digit code

    try {
        // Send the verification email
        await sendVerificationEmail(email, code);

        // Ensure Redis is connected before saving the code
        if (!client.isOpen) {
            await client.connect();
        }
        // Store the verification code in Redis with a 10-minute expiration
        await client.setEx(`email_code:${email}`, 600, code.toString());

        res.status(200).send({ success: true, message: 'Verification code sent successfully' });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).send({ success: false, message: 'Failed to send the verification code.' });
    }
});

/**
 * Gracefully disconnect Redis client when the server is shutting down.
 */
process.on('SIGINT', async () => {
    if (client.isOpen) {
        await client.quit();
        console.log('Redis client disconnected');
    }
    process.exit(0);
});

//================================ User Registration and Login Endpoints ===================================

// Register a new user by email and password
router.post('/register', async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // Check if the user already exists in the database
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).send({ success: false, message: 'User already exists' });
        }

        // Hash the user's password for secure storage
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the new user record in the database
        const result = await createUser(email, hashedPassword);

        res.status(201).send({
            success: true,
            message: 'Registered successfully',
            userId: result.insertId
        });
    } catch (error) {
        console.error("Registration error:", error);
        next(error);  // Forward the error to the global error handler
    }
});

// Authenticate a user and return a JWT token upon successful login
router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // Look up the user in the database by email
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(400).send({ success: false, message: 'User does not exist' });
        }

        // Compare the provided password with the stored hashed password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).send({ success: false, message: 'Incorrect password' });
        }

        // Generate a JWT token for the authenticated user
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }  // Token expires in 1 hour
        );

        res.status(200).send({
            success: true,
            message: 'Login successfully',
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        next(error);  // Forward the error to the global error handler
    }
});

//================================ Website Function Endpoints ===================================

// Fetch paginated data from a specified table
router.get('/:tableName', validateTable, getPaginatedData);

// Retrieve column names for search bar auto-completion
router.get('/columns/:tableName', validateTable, getColumns);

// Delete a record by its ID from a specified table
router.delete('/delete/:tableName/:id', validateTable, async (req, res, next) => {
    const { tableName, id } = req.params;

    // Validate that the provided ID is numeric
    if (isNaN(id)) {
        return res.status(400).send({ success: false, message: 'Invalid ID provided' });
    }

    try {
        // Attempt to delete the record from the database
        const result = await deleteData(tableName, id);

        if (result.affectedRows > 0) {
            res.status(200).send({
                success: true, 
                message: `Deleted ID ${id} from ${tableName}`
            });
        } else {
            res.status(404).send({
                success: false, 
                message: `Record with ID ${id} not found in ${tableName}`
            });
        }
    } catch (err) {
        console.error(`Error deleting data: ${err.message}`);
        res.status(500).send({
            success: false, 
            message: 'Internal Server Error'
        });
    }
});

/**
 * General function for data creation in the database.
 * Validates required fields and calls the provided creation function.
 * 
 * @async
 * @function createData
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {Function} createFunction - Function handling database insertion
 * @param {Array<string>} requiredFields - List of required fields for validation
 * @param {string} resourceName - Name of the resource being created (used in success messages)
 */
const createData = async (req, res, next, createFunction, requiredFields, resourceName) => {
    const data = req.body;

    // Validate presence of all required fields
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
        return res.status(400).send({
            success: false,
            message: `Missing required fields: ${missingFields.join(', ')}`,
        });
    }

    try {
        // Execute the creation function with the required data
        const result = await createFunction(...requiredFields.map(field => data[field]));
        
        res.status(201).send({
            success: true,
            message: `${resourceName} created successfully`,
            data: result,
        });
    } catch (error) {
        console.error(`Error creating ${resourceName}: ${error.message}`);
        next(error);  // Forward the error to the global error handler
    }
};

//=============================== Data Creation API Endpoints ===================================

// Create a new run entry in the database
router.post('/run', async (req, res, next) => {
    await createData(
        req, res, next, 
        createRun, 
        ['date_run_start', 'experiment_id', 'computer', 'minion', 'notes'], 
        'Run'  // Target table
    );
});

// Create a new experiment entry in the database
router.post('/experiment', async (req, res, next) => {
    await createData(
        req, res, next, 
        createExperiment, 
        ['name', 'protocol', 'metadata', 'date_started', 'description'], 
        'Experiment'  // Target table
    );
});

// Register a new computer in the database
router.post('/computer', async (req, res, next) => {
    await createData(
        req, res, next, 
        addComputer, 
        ['device_name'],  // Required field for computers
        'Computer'  // Target table
    );
});

// Add a minion entry associated with a computer
router.post('/minion', async (req, res, next) => {
    await createData(
        req, res, next, 
        addMinion, 
        ['name', 'computer_used', 'device_date', 'notes'], 
        'Minion'  // Target table
    );
});

// Register a new participant for an experiment
router.post('/participants', async (req, res, next) => {
    await createData(
        req, res, next, 
        addParticipant, 
        ['name', 'experiment_id'], 
        'Participant'  // Target table
    );
});

// Add a sample to a specific experiment
router.post('/samples', async (req, res, next) => {
    await createData(
        req, res, next, 
        addSample, 
        ['name', 'code', 'experiment_id'], 
        'Sample'  // Target table
    );
});

// Assign an operator to a specific run
router.post('/operator', async (req, res, next) => {
    await createData(
        req, res, next, 
        addOperator, 
        ['role', 'participant_id', 'run_id'], 
        'Operator'  // Target table
    );
});

// Register a barcode entry linked to a sample
router.post('/barcode', async (req, res, next) => {
    await createData(
        req, res, next, 
        addBarcode, 
        ['sample_name', 'barcode', 'run_id'], 
        'Barcode'  // Target table
    );
});

// Add a sequencing unit associated with a specific run
router.post('/sequencing_unit', async (req, res, next) => {
    await createData(
        req, res, next, 
        addSequencing_unit, 
        ['type', 'code', 'pores_start', 'pores_after', 'date', 'run_id'], 
        'Sequencing Unit'  // Target table
    );
});

// Register a library preparation record in the database
router.post('/library_prep', async (req, res, next) => {
    await createData(
        req, res, next, 
        addLibrary_prep, 
        ['prep_kit', 'date_opened', 'sample_num', 'owner', 'run_id'], 
        'Library Prep'  // Target table
    );
});



//==========================================================================

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
