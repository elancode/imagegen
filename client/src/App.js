import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Box, 
    Button, 
    CircularProgress, 
    Typography,
    Paper,
    TextField,
    ImageList,
    ImageListItem,
    Alert,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function App() {
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [trainStatus, setTrainStatus] = useState(() => localStorage.getItem('trainStatus') || null);
    const [modelId, setModelId] = useState(() => localStorage.getItem('modelId') || null);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [error, setError] = useState(null);
    const [trainingProgress, setTrainingProgress] = useState('');
    const [showModelInput, setShowModelInput] = useState(false);
    const [modelInputValue, setModelInputValue] = useState('');
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail'));
    const [showAuth, setShowAuth] = useState(!localStorage.getItem('token'));
    const [isLogin, setIsLogin] = useState(true);
    const [authError, setAuthError] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [userModels, setUserModels] = useState([]);
    const [selectedModelId, setSelectedModelId] = useState(null);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [progress, setProgress] = useState(0);
    const [latestLogLine, setLatestLogLine] = useState('');
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3; // Set a maximum number of retries

    // Define your trigger word used during training
    const triggerWord = 'USER'; // Replace with your actual trigger word

    useEffect(() => {
        console.log('Server URL:', process.env.REACT_APP_SERVER_URL);
        // Request notification permission on app load
        if ("Notification" in window) {
            Notification.requestPermission();
        }

        // Fetch user models and generated images if token is present and not loading
        if (token && !loading) {
            fetchUserModels();
            fetchGeneratedImages();
        }

        // Resume polling if a model is in training
        if (modelId && trainStatus === 'training') {
            pollTrainingStatus(modelId);
        }
    }, [token, loading]);

    const fetchUserModels = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/models`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch models');
            }

            const data = await response.json();
            console.log('Fetched models:', data.models); // Log the models for debugging
            setUserModels(data.models); // Set all models, not just trained ones

            // Automatically select the model if there's only one with status 'succeeded'
            const succeededModels = data.models.filter(model => model.status === 'succeeded');
            if (succeededModels.length === 1) {
                setSelectedModelId(succeededModels[0].modelId);
            } else {
                setSelectedModelId(null); // Clear selection if conditions are not met
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            setError('Failed to load models');
        }
    };

    const fetchGeneratedImages = async () => {
        try {
            console.log('Token:', token); // Log the token for debugging
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/generated-images`, {
                headers: {
                    'Authorization': `Bearer ${token}`, // Ensure token is correctly set
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch generated images');
            }

            const data = await response.json();
            setGeneratedImages(data.images || []);
            setError(null); // Clear any previous error
        } catch (error) {
            console.error('Error fetching generated images:', error);
            setError('Failed to load generated images');
        }
    };

    const updateModelId = (id) => {
        setModelId(id);
        localStorage.setItem('modelId', id);
    };

    const updateTrainStatus = (status) => {
        setTrainStatus(status);
        localStorage.setItem('trainStatus', status);
    };

    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files);
        if (uploadedFiles.length + files.length > 20) {
            setError('Maximum 20 images allowed');
            return;
        }

        setUploadedFiles(prev => [...prev, ...files]);
        
        // Create preview URLs
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrls(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handleTrain = async () => {
        if (uploadedFiles.length < 1) {
            setError('Please upload at least one image');
            return;
        }

        setLoading(true);
        updateTrainStatus('training');
        setError(null);

        const formData = new FormData();
        uploadedFiles.forEach((file, index) => {
            formData.append('images', file);
        });

        try {
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/train`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Training failed to start');
            }

            const data = await response.json();
            updateModelId(data.modelId);
            
            // Start polling for training status
            pollTrainingStatus(data.modelId);
        } catch (error) {
            console.error('Error:', error);
            setError('Failed to start training');
            updateTrainStatus('failed');
        }
    };

    const pollTrainingStatus = async (modelId) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/training-status/${modelId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            const data = await response.json();

            console.log('Training status data:', data); // Log the data for debugging

            // Update the latest log line
            setLatestLogLine(data.latestLogLine || '');

            setTrainingProgress(
                `Status: ${data.status} | Progress: ${data.progress || 0}%`
            );

            if (data.status === 'succeeded') {
                updateTrainStatus('completed');
                setLoading(false);
                setTrainingProgress('Training completed successfully! You can now generate images.');

                if (Notification.permission === 'granted') {
                    new Notification('Training Complete', {
                        body: 'Your model training has completed successfully!',
                    });
                }

                setError(null);
            } else if (data.status === 'failed') {
                updateTrainStatus('failed');
                setLoading(false);
                setError('Training failed');
                setTrainingProgress('Training failed. Please try again.');
            } else {
                // Continue polling if training is still in progress
                setTimeout(() => pollTrainingStatus(modelId), 5000); // Poll every 5 seconds
            }
        } catch (error) {
            console.error('Error:', error);
            updateTrainStatus('failed');
            setLoading(false);
            setError('Failed to check training status');
            setTrainingProgress('Failed to check training status');
        }
    };

    useEffect(() => {
        if (modelId && trainStatus === 'training') {
            pollTrainingStatus(modelId);
        }
    }, [modelId, trainStatus]);

    const handleGenerate = async () => {
        if (!selectedModelId || !prompt) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    modelId: selectedModelId,
                    prompt: `${prompt}`,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Generation failed');
            }

            const data = await response.json();
            if (data.output && data.output[0]) {
                setGeneratedImages(prevImages => [...prevImages, { url: data.output[0], prompt, createdAt: new Date() }]);
            } else {
                setError('No output received from the server.');
            }
        } catch (error) {
            console.error('Error:', error);
            setError(error.message || 'Failed to generate image');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        localStorage.removeItem('modelId');
        localStorage.removeItem('trainStatus');
        setModelId(null);
        setTrainStatus(null);
        setGeneratedImage(null);
        setUploadedFiles([]);
        setPreviewUrls([]);
        setPrompt('');
        setError(null);
        setTrainingProgress('');
    };

    const handleLoadModel = () => {
        if (!modelInputValue) return;
        updateModelId(modelInputValue);
        updateTrainStatus('completed');
        setShowModelInput(false);
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setAuthError('');
        
        try {
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/auth/${isLogin ? 'login' : 'register'}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: authEmail,
                    password: authPassword,
                }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            // Update local storage and state with the new user's information
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.email);
            setToken(data.token);
            setUserEmail(data.email);
            setUserModels(data.models || []); // Initialize models if not provided
            setShowAuth(false);
            setAuthEmail('');
            setAuthPassword('');
            setGeneratedImage(null); // Clear the generated image from the previous session

            // Fetch generated images for the new user
            fetchGeneratedImages();

            // Resume polling if a model is in training
            if (modelId && trainStatus === 'training') {
                pollTrainingStatus(modelId);
            }
        } catch (error) {
            setAuthError(error.message);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('modelId');
        localStorage.removeItem('trainStatus');
        setToken(null);
        setUserEmail(null);
        setModelId(null);
        setTrainStatus(null);
        setGeneratedImages([]); // Clear generated images on logout
        setGeneratedImage(null); // Clear the last generated image
        setError(null); // Clear any error messages
        setShowAuth(true);
    };

    const handleImageClick = (image) => {
        setSelectedImage(image);
        setOverlayOpen(true);
    };

    const handleOverlayClose = () => {
        setOverlayOpen(false);
        setSelectedImage(null);
    };

    const handleImageError = (index) => {
        console.error(`Image at index ${index} failed to load.`);
        // Optionally, you can set an error state or remove the image from the list
    };

    return (
        <Container maxWidth="md">
            <Box sx={{ my: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4" component="h1">
                        GreatShots.art
                    </Typography>
                    {token && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2">
                                {userEmail}
                            </Typography>
                            <Button 
                                variant="outlined" 
                                color="secondary" 
                                onClick={handleLogout}
                            >
                                Logout
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* Auth Dialog */}
                <Dialog open={showAuth} maxWidth="xs" fullWidth>
                    <DialogTitle>
                        {isLogin ? 'Login' : 'Register'}
                    </DialogTitle>
                    <form onSubmit={handleAuth}>
                        <DialogContent>
                            {authError && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {authError}
                                </Alert>
                            )}
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                margin="normal"
                                required
                            />
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                margin="normal"
                                required
                            />
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2 }}>
                            <Button onClick={() => setIsLogin(!isLogin)}>
                                {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
                            </Button>
                            <Button type="submit" variant="contained">
                                {isLogin ? 'Login' : 'Register'}
                            </Button>
                        </DialogActions>
                    </form>
                </Dialog>

                {token && (
                    <>
                        {showModelInput && (
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Load Existing Model
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        fullWidth
                                        label="Enter Model ID"
                                        value={modelInputValue}
                                        onChange={(e) => setModelInputValue(e.target.value)}
                                    />
                                    <Button 
                                        variant="contained"
                                        onClick={handleLoadModel}
                                        disabled={!modelInputValue}
                                    >
                                        Load
                                    </Button>
                                    <Button 
                                        variant="outlined"
                                        onClick={() => {
                                            setShowModelInput(false);
                                            setModelInputValue('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                                    Note: You can find your Model ID in the URL of your training session or in the training completion message.
                                </Typography>
                            </Paper>
                        )}

                        {trainStatus === 'completed' && (
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Your Model ID
                                </Typography>
                                <TextField
                                    fullWidth
                                    value={modelId}
                                    InputProps={{
                                        readOnly: true,
                                    }}
                                    helperText="Save this ID to use your model later or on another device"
                                />
                            </Paper>
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                        )}
                        
                        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                            <input
                                accept="image/*"
                                type="file"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                                id="upload-button"
                                multiple
                            />
                            <label htmlFor="upload-button">
                                <Button variant="contained" component="span" fullWidth>
                                    Upload Photos ({uploadedFiles.length}/20)
                                </Button>
                            </label>

                            {previewUrls.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <ImageList cols={3} rowHeight={164}>
                                        {previewUrls.map((url, index) => (
                                            <ImageListItem key={index}>
                                                <img src={url} alt={`Upload ${index + 1}`} />
                                                <IconButton
                                                    sx={{ position: 'absolute', right: 0, top: 0 }}
                                                    onClick={() => removeImage(index)}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </ImageListItem>
                                        ))}
                                    </ImageList>
                                </Box>
                            )}

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleTrain}
                                disabled={loading || uploadedFiles.length === 0 || trainStatus === 'training'}
                                fullWidth
                                sx={{ mt: 2 }}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Train Model'}
                            </Button>
                        </Paper>

                        {trainStatus === 'training' && (
                            <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
                                <Typography variant="h6" gutterBottom>
                                    Training Status
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <CircularProgress size={24} />
                                    <Typography>
                                        {trainingProgress || 'Initializing training...'}
                                    </Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={progress} sx={{ mt: 2 }} />
                                <Typography variant="body2" sx={{ mt: 2 }}>
                                    {latestLogLine}
                                </Typography>
                            </Paper>
                        )}

                        {userModels.length > 0 && (
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Your Models
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Select a model to generate images
                                </Typography>
                                <ul>
                                    {userModels.map((model, index) => (
                                        <li key={index}>
                                            <Button
                                                variant={selectedModelId === model.modelId ? 'contained' : 'outlined'}
                                                onClick={() => setSelectedModelId(model.modelId)}
                                                disabled={model.status !== 'succeeded'} // Disable if not succeeded
                                            >
                                                {model.name} - {model.status} - Created on {new Date(model.createdAt).toLocaleDateString()}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </Paper>
                        )}

                        {selectedModelId && (
                            <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
                                <Typography variant="h6" gutterBottom>
                                    Generate Images
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Remember to include the hotword "USER" in your prompt, e.g. USER as a king
                                </Typography>
                                <TextField
                                    fullWidth
                                    label="Enter prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    margin="normal"
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleGenerate}
                                    disabled={loading || !prompt}
                                    fullWidth
                                    sx={{ mt: 2 }}
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Generate Image'}
                                </Button>
                            </Paper>
                        )}

                        {generatedImages.length > 0 ? (
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Your Generated Images
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Click to see full size image
                                </Typography>
                                <ImageList cols={3} gap={8}>
                                    {generatedImages.slice().reverse().map((image, index) => (
                                        <ImageListItem key={index} style={{ width: '150px', height: '150px' }}>
                                            <img 
                                                src={image.url} 
                                                alt={`Generated ${index + 1}`} 
                                                onError={() => handleImageError(index)} 
                                                onClick={() => handleImageClick(image)} 
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover', // Ensures the image covers the square
                                                }}
                                            />
                                        </ImageListItem>
                                    ))}
                                </ImageList>
                            </Paper>
                        ) : (
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                No generated images found.
                            </Typography>
                        )}

                        {/* Image Overlay */}
                        <Dialog open={overlayOpen} onClose={handleOverlayClose} maxWidth="lg">
                            <DialogContent sx={{ textAlign: 'center' }}>
                                {selectedImage && (
                                    <>
                                        <img 
                                            src={selectedImage.url} 
                                            alt="Full-size" 
                                            style={{ maxWidth: '100%', maxHeight: '80vh' }} 
                                            onClick={handleOverlayClose} 
                                        />
                                        <Typography variant="body2" sx={{ mt: 2 }}>
                                            {selectedImage.prompt}
                                        </Typography>
                                    </>
                                )}
                            </DialogContent>
                        </Dialog>
                    </>
                )}
            </Box>
        </Container>
    );
}

export default App;