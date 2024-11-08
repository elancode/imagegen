const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Replicate = require('replicate');
const archiver = require('archiver');
const FormData = require('form-data');
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;


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
    modelTrainingCredits: { type: Number, default: 3 }, // Start with 1 credit
    imageGenerationCredits: { type: Number, default: 50 }, // Start with 5 credits
    models: [{
        modelId: String,
        name: String,
        customName: String,
        createdAt: Date,
        status: String
    }],
    generatedImages: [{
        url: String,
        createdAt: Date,
        prompt: String,
        modelName: String
    }]
});

const User = mongoose.model('User', UserSchema);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Allow all origins
app.use(cors({
    origin: '*', // This allows all origins
    credentials: true // If you need to include credentials like cookies, set this to true
}));
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log('Received Stripe event:', event.type);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Checkout session completed:', session);

        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

            for (const item of lineItems.data) {
                const productId = item.price.product;
                const product = await stripe.products.retrieve(productId);

                console.log(`Product Name: ${product.name}`);
                console.log(`Product Description: ${product.description}`);
            }

            // Retrieve the user from your database
            const user = await User.findById(session.client_reference_id);
            if (!user) {
                console.error('User not found for session:', session.client_reference_id);
                return res.status(404).send('User not found');
            }

            // Update user credits
            user.modelTrainingCredits += 1; // Example: Add 1 model credit
            user.imageGenerationCredits += 10; // Example: Add 10 image credits
            await user.save();

            // Log the transaction
            const transaction = new Transaction({
                userId: user._id,
                amount: session.amount_total,
                currency: session.currency,
                createdAt: new Date(),
            });
            await transaction.save();
            console.log('Transaction recorded:', transaction);
        } catch (error) {
            console.error('Error processing checkout session:', error);
            return res.status(500).send('Error processing checkout session');
        }
    }

    res.json({ received: true });
});


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
app.post('/api/auth/register', async (req, res) => {
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
app.post('/api/auth/login', async (req, res) => {
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

        // Create token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

        // Include user's models with updated statuses
        res.json({ token, email: user.email, models: user.models });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get user's models
app.get('/api/models', authenticateToken, async (req, res) => {
    try {
        res.json({ models: req.user.models });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Endpoint to generate images with trained model
app.post('/api/generate', authenticateToken, async (req, res) => {
    try {
        // Check if the user has image generation credits
        if (req.user.imageGenerationCredits <= 0) {
            return res.status(400).json({ error: 'No image generation credits available' });
        }

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
            const imageUrl = result.output[0];
            const gcsDestination = `generated-images/${req.user._id}/${new Date().toISOString()}.png`;

            // Ensure the temp directory exists
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generate a unique filename for the temporary file
            const uniqueFilename = `${uuidv4()}.png`;
            const localPath = path.join(tempDir, uniqueFilename);

            // Download the image and upload to GCS
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');

            // Convert the image to a different format, e.g., PNG
            const convertedBuffer = await sharp(buffer)
                .toFormat('png') // Change 'png' to your desired format
                .toBuffer();

            // Save the converted image to a temporary file
            fs.writeFileSync(localPath, convertedBuffer);

            await uploadToGCS(localPath, gcsDestination);
            fs.unlinkSync(localPath); // Clean up local file

            const gcsUrl = `https://storage.googleapis.com/${bucketName}/${gcsDestination}`;
            req.user.generatedImages.push({
                url: gcsUrl,
                createdAt: new Date(),
                prompt,
                modelName: model.name
            });
            await req.user.save();

            // Deduct an image generation credit
            req.user.imageGenerationCredits -= 1;
            await req.user.save();

            res.json({ output: [gcsUrl] });
        } else {
            throw new Error('Image generation failed');
        }
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

// Endpoint to check training status
app.get('/api/training-status/:trainingId', authenticateToken, async (req, res) => {
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
app.get('/api/generated-images', authenticateToken, async (req, res) => {
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
app.post('/api/train', authenticateToken, upload.array('images', 20), async (req, res) => {
    try {
        // Check if the user has model training credits
        if (req.user.modelTrainingCredits <= 0) {
            return res.status(400).json({ error: 'No model training credits available' });
        }

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

        // Deduct a model training credit
        req.user.modelTrainingCredits -= 1;
        await req.user.save();

        res.json({ modelId: training.id });

    } catch (error) {
        console.error('Training error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to start training', details: error.message });
    }
});

// Endpoint to get user credits
app.get('/api/user-credits', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            modelTrainingCredits: user.modelTrainingCredits,
            imageGenerationCredits: user.imageGenerationCredits
        });
    } catch (error) {
        console.error('Error fetching user credits:', error);
        res.status(500).json({ error: 'Failed to fetch user credits' });
    }
});

// Endpoint to update model custom name
app.put('/api/models/:modelId/custom-name', authenticateToken, async (req, res) => {
    try {
        const { customName } = req.body;
        const model = req.user.models.find(m => m.modelId === req.params.modelId);

        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }

        model.customName = customName;
        await req.user.save();

        res.json({ message: 'Custom name updated successfully' });
    } catch (error) {
        console.error('Error updating custom name:', error);
        res.status(500).json({ error: 'Failed to update custom name' });
    }
});

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Credit Pack',
                    },
                    unit_amount: 2000, // $20.00
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});



const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

async function uploadToGCS(filePath, destination) {
    await storage.bucket(bucketName).upload(filePath, {
        destination,
        gzip: true,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    });
    console.log(`${filePath} uploaded to ${bucketName}/${destination}`);
}

console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY);
console.log('Stripe Webhook Key:', endpointSecret);

// Transaction Model
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', TransactionSchema);
