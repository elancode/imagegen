const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Replicate = require('replicate');
const archiver = require('archiver');
const FormData = require('form-data');

dotenv.config();

// Initialize Replicate client
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// User Model
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    models: [{
        modelId: String,
        name: String,
        createdAt: Date,
        status: String
    }],
    generatedImages: [{
        url: String,
        createdAt: Date
    }]
});

const User = mongoose.model('User', UserSchema);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
    origin: process.env.REACT_APP_CLIENT_URL,
    credentials: true
}));
app.use(express.json());

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(verified.userId);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Register endpoint
app.post('/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            email,
            password: hashedPassword,
            models: []
        });

        await user.save();

        // Create token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.json({ token, email: user.email });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Email not found' });
        }

        // Validate password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Fetch the latest status for each model from Replicate
        for (let model of user.models) {
            try {
                const training = await replicate.trainings.get(model.modelId);
                model.status = training.status; // Update the model's status
            } catch (error) {
                console.error(`Failed to fetch status for model ${model.modelId}:`, error.message);
            }
        }
        await user.save();

        // Automatically select the model if there's only one with status 'succeeded'
        const succeededModels = user.models.filter(model => model.status === 'succeeded');
        let autoSelectedModel = null;
        if (succeededModels.length === 1) {
            autoSelectedModel = succeededModels[0];
        }

        // Create token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

        // Include user's models with updated statuses and the auto-selected model in the response
        res.json({ token, email: user.email, models: user.models, autoSelectedModel });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get user's models
app.get('/models', authenticateToken, async (req, res) => {
    try {
        res.json({ models: req.user.models });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Endpoint to generate images with trained model
app.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { modelId, prompt } = req.body;

        // Retrieve the model from the user's account
        const model = req.user.models.find(m => m.modelId === modelId);
        if (!model) {
            return res.status(400).json({ error: 'Model not found' });
        }

        // Check if the model's status is 'succeeded'
        if (model.status !== 'succeeded') {
            return res.status(400).json({ error: 'Model is not ready for image generation' });
        }

        // Fetch the model details to get the version ID
        const modelDetailsResponse = await axios.get(
            `https://api.replicate.com/v1/models/elancode/${model.name}`,
            {
                headers: {
                    'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
                },
            }
        );

        const modelDetails = modelDetailsResponse.data;
        console.log('Model details:', modelDetails);

        // Use the latest_version object to get the version ID
        const latestVersionId = modelDetails.latest_version?.id;
        if (!latestVersionId) {
            return res.status(400).json({ error: 'No version found for the model' });
        }

        // Use the model version ID to create a prediction
        const prediction = await replicate.predictions.create({
            version: latestVersionId,
            input: {
                prompt: prompt,
                negative_prompt: "blurry, distorted, low quality, low resolution",
                num_inference_steps: 28,
                guidance_scale: 3.5,
            }
        });

        // Poll for the result
        let result = prediction;
        while (result.status !== 'succeeded' && result.status !== 'failed') {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds
            result = await replicate.predictions.get(result.id);
        }

        if (result.status === 'succeeded') {
            const imageUrl = result.output[0]; // Assuming the output is an array of URLs
            console.log('Generated image URL:', imageUrl); // Log the URL for verification

            // Save the generated image URL to the user's account
            req.user.generatedImages.push({
                url: imageUrl,
                createdAt: new Date()
            });
            await req.user.save();

            res.json({ output: result.output });
        } else {
            throw new Error('Image generation failed');
        }
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

// Endpoint to check training status
app.get('/training-status/:trainingId', authenticateToken, async (req, res) => {
    try {
        const training = await replicate.trainings.get(req.params.trainingId);

        // Extract the latest log line
        const logOutput = training.logs || '';
        const logLines = logOutput.split('\n');
        const latestLogLine = logLines[logLines.length - 2] || '';

        console.log('Latest training log line:', latestLogLine);

        // Parse the progress percentage from the latest log line
        const progressMatch = latestLogLine.match(/(\d+)%\|/);
        const progress = progressMatch ? parseInt(progressMatch[1], 10) : 0;

        // Update model status based on training status from Replicate
        const model = req.user.models.find(m => m.modelId === req.params.trainingId);
        if (model) {
            model.status = training.status; // Update the model's status with the status from Replicate
            await req.user.save();
        }

        res.json({
            status: training.status,
            metrics: training.metrics,
            progress, // Include parsed progress
            latestLogLine,
            completed_at: training.completed_at,
            error: training.error
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check training status' });
    }
});

// Endpoint to get all generated images
app.get('/generated-images', authenticateToken, async (req, res) => {
    try {
        const images = req.user.generatedImages || [];
        res.json({ images });
    } catch (error) {
        console.error('Error fetching generated images:', error);
        res.status(500).json({ error: 'Failed to fetch generated images' });
    }
});

// Add a function to create a model if it doesn't exist
async function createModelIfNotExists(modelName) {
    try {
        const response = await axios.post(
            'https://api.replicate.com/v1/models',
            {
                owner: 'elancode', // Ensure this matches your Replicate username or organization
                name: modelName,
                description: 'A fine-tuned FLUX model',
                visibility: 'public',
                hardware: 'gpu-a40-large'
            },
            {
                headers: {
                    'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log('Model created:', response.data);
    } catch (error) {
        if (error.response && error.response.status === 409) {
            console.log('Model already exists');
        } else {
            console.error('Error creating model:', error.response?.data || error.message);
            throw new Error('Failed to create model');
        }
    }
}

// Function to create a unique model name
function generateUniqueModelName(baseName) {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    return `${baseName}-${timestamp}`.toLowerCase();
}

// At the top of your file, define the base model information
const baseModelOwner = 'ostris';
const baseModelName = 'flux-dev-lora-trainer';
const baseModelVersionId = 'd995297071a44dcb72244e6c19462111649ec86a9646c32df56daa7f14801944'; // Version ID of the base model

// Update the `/train` endpoint
app.post('/train', authenticateToken, upload.array('images', 20), async (req, res) => {
    try {
        console.log('Starting training process...');
        const files = req.files;

        if (!files || files.length === 0) {
            console.error('No files uploaded');
            return res.status(400).json({ error: 'No files uploaded' });
        }

        console.log(`Processing ${files.length} files...`);

        // Generate a unique model name
        const modelName = generateUniqueModelName('fluxmodel');

        // Add this line to create the model if it doesn't exist
        await createModelIfNotExists(modelName);

        // Create a destination for the trained model
        const destinationModel = `elancode/${modelName}`;

        // Create a ZIP file of the uploaded images
        const zipFilePath = path.join(__dirname, 'uploads', `${modelName}.zip`);
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);

            files.forEach(file => {
                archive.append(fs.createReadStream(file.path), { name: file.originalname });
            });

            archive.finalize();
        });

        console.log('Zip file created successfully:', zipFilePath);

        // Upload the ZIP file to Replicate
        const formData = new FormData();
        formData.append('content', fs.createReadStream(zipFilePath), {
            filename: 'data.zip',
            contentType: 'application/zip',
        });

        const uploadResponse = await axios.post(
            'https://api.replicate.com/v1/files',
            formData,
            {
                headers: {
                    'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );

        console.log('Upload response:', uploadResponse.data);

        const trainingDataUrl = uploadResponse.data.urls.get;
        console.log('Training data URL:', trainingDataUrl);

        // Clean up files
        fs.unlinkSync(zipFilePath);
        files.forEach(file => fs.unlinkSync(file.path));

        // Start training process using Replicate client
        const training = await replicate.trainings.create(
            'ostris',
            'flux-dev-lora-trainer',
            'e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497',
            {
                destination: destinationModel,
                input: {
                    steps: 1000,
                    lora_rank: 16,
                    optimizer: 'adamw8bit',
                    batch_size: 1,
                    resolution: '512,768,1024',
                    autocaption: true,
                    input_images: trainingDataUrl,
                    trigger_word: 'USER', // Use your actual trigger word
                    learning_rate: 0.0004,
                    wandb_project: 'flux_train_replicate',
                    wandb_save_interval: 100,
                    caption_dropout_rate: 0.05,
                    cache_latents_to_disk: false,
                    wandb_sample_interval: 100
                }
            }
        );

        console.log('Training started successfully:', training);

        // Save training ID to user's account without setting status
        req.user.models.push({
            modelId: training.id, // This is the training ID
            name: modelName,
            createdAt: new Date()
        });
        await req.user.save();

        res.json({ modelId: training.id });

    } catch (error) {
        console.error('Training error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to start training', details: error.message });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}); 