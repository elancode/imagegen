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
    LinearProgress,
    useMediaQuery,
    Menu,
    MenuItem,
    Divider
} from '@mui/material';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { loadStripe } from '@stripe/stripe-js';

function App() {
    const theme = useTheme();
    const isXs = useMediaQuery(theme.breakpoints.down('xs'));
    const isSm = useMediaQuery(theme.breakpoints.down('sm'));
    const isMd = useMediaQuery(theme.breakpoints.down('md'));

    const getImageListCols = () => {
        if (isXs) return 1;
        if (isSm) return 2;
        if (isMd) return 3;
        return 4;
    };

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
    const [imageGeneratedNotification, setImageGeneratedNotification] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [email, setEmail] = useState(() => localStorage.getItem('userEmail') || '');
    const [modelTrainingCredits, setModelTrainingCredits] = useState(0);
    const [imageGenerationCredits, setImageGenerationCredits] = useState(0);
    const [creditError, setCreditError] = useState(''); // State for credit error message
    const [trainingCreditError, setTrainingCreditError] = useState(''); // State for training credit error message
    const [imageLoading, setImageLoading] = useState(false); // New state for image generation loading
    const [editingModelId, setEditingModelId] = useState(null); // State to track which model is being renamed
    const [newCustomName, setNewCustomName] = useState(''); // State for new custom name input

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

    useEffect(() => {
        // Fetch user credits when the component mounts
        const fetchUserCredits = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/user-credits`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user credits');
                }

                const data = await response.json();
                console.log('Fetched credits:', data); // Debugging: Log the fetched data
                setModelTrainingCredits(data.modelTrainingCredits);
                setImageGenerationCredits(data.imageGenerationCredits);
            } catch (error) {
                console.error('Error fetching user credits:', error);
            }
        };

        if (token) {
            fetchUserCredits();
        }
    }, [token]);

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
        setTrainingCreditError(''); // Clear previous training credit error

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
                const errorData = await response.json();
                if (errorData.error === 'No model training credits available') {
                    setTrainingCreditError('You have used all of your model training credits');
                } else {
                    throw new Error(errorData.error || 'Training failed to start');
                }
                setLoading(false); // Ensure loading is set to false if training is blocked
                return;
            }

            const data = await response.json();
            updateModelId(data.modelId);
            
            // Start polling for training status
            pollTrainingStatus(data.modelId);
        } catch (error) {
            console.error('Error:', error);
            setError('Failed to start training');
            updateTrainStatus('failed');
            setLoading(false); // Ensure loading is set to false on error
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

        setImageLoading(true); // Set image loading state
        setError(null);
        setCreditError(''); // Clear previous credit error

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
                if (errorData.error === 'No image generation credits available') {
                    setCreditError('You have used all of your image generation credits');
                } else {
                    throw new Error(errorData.error || 'Generation failed');
                }
                return;
            }

            const data = await response.json();
            if (data.output && data.output[0]) {
                const modelName = userModels.find(model => model.modelId === selectedModelId)?.name || 'Unknown Model';
                setGeneratedImages(prevImages => [...prevImages, { url: data.output[0], prompt, modelName, createdAt: new Date() }]);
                setImageGeneratedNotification(true); // Show notification
            } else {
                setError('No output received from the server.');
            }
        } catch (error) {
            console.error('Error:', error);
            setError(error.message || 'Failed to generate image');
        } finally {
            setImageLoading(false); // Reset image loading state
        }
    };

    const handleUserAction = () => {
        setImageGeneratedNotification(false); // Hide notification on any user action
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
        setAnchorEl(null); // Ensure the menu is closed after logout

        // Clear the prompt and uploaded files
        setPrompt(''); // Clear the prompt in the image generation text field
        setUploadedFiles([]); // Clear any images selected in the training block
        setPreviewUrls([]); // Clear preview URLs
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

    useEffect(() => {
        // Automatically select the model if there's only one with status 'succeeded'
        const succeededModels = userModels.filter(model => model.status === 'succeeded');
        if (succeededModels.length === 1) {
            setSelectedModelId(succeededModels[0].modelId);
        } else {
            setSelectedModelId(null); // Clear selection if conditions are not met
        }
    }, [userModels]);

    const handleAccountClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogin = () => {
        // Logic to show login dialog or redirect to login page
        console.log("Login/Register button clicked");
        // Example: Redirect to login page
        window.location.href = '/login'; // Replace with your actual login page URL
        setAnchorEl(null); // Ensure the menu is closed after login
    };

    const handleUserInteraction = () => {
        setCreditError(''); // Clear the credit error on any user interaction
        setTrainingCreditError(''); // Clear the training credit error on any user interaction
    };

    const handleRename = (modelId) => {
        setEditingModelId(modelId);
        setNewCustomName('name'); // Set default text to "name"
    };

    const saveCustomName = async (modelId) => {
        try {
            await fetch(`${process.env.REACT_APP_SERVER_URL}/models/${modelId}/custom-name`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ customName: newCustomName }),
            });

            setUserModels(prevModels => prevModels.map(model => 
                model.modelId === modelId ? { ...model, customName: newCustomName } : model
            ));
            setEditingModelId(null);
        } catch (error) {
            console.error('Error saving custom name:', error);
        }
    };

    const handleOutsideClick = (event) => {
        if (editingModelId && !event.target.closest('.edit-box')) {
            setEditingModelId(null); // Close the edit box without saving changes
        }
    };

    useEffect(() => {
        if (editingModelId) {
            document.addEventListener('click', handleOutsideClick);
        } else {
            document.removeEventListener('click', handleOutsideClick);
        }

        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, [editingModelId]);

    const handleBuyCredits = () => {
        // Redirect to the buy credits HTML page
        window.location.href = '/buy-credits.html';
    };

    const handleHelp = () => {
        // Redirect to the help page
        window.location.href = '/help.html';
    };

    return (
        <Container maxWidth="md" onClick={handleUserInteraction}>
            <Box sx={{ my: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Logo */}
                        <img src={`${process.env.PUBLIC_URL}/greatshotslogo.png`} alt="GreatShots Logo" style={{ maxWidth: '50px', height: 'auto', marginRight: '10px' }} />
                        {/* New Title Logo */}
                        <img src={`${process.env.PUBLIC_URL}/greatshotstextlogo.png`} alt="New Logo" style={{ maxWidth: '150px', height: 'auto' }} />
                    </Box>
                    <IconButton
                        edge="end"
                        color="inherit"
                        onClick={handleAccountClick}
                    >
                        <AccountCircle sx={{ fontSize: '2.5rem' }} />
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                    >
                        <MenuItem disabled>{userEmail}</MenuItem>
                        <Divider />
                        <MenuItem disabled sx={{ padding: '4px 16px', minHeight: '32px' }}>Model Credits: {modelTrainingCredits}</MenuItem>
                        <MenuItem disabled sx={{ padding: '4px 16px', minHeight: '32px' }}>Image Credits: {imageGenerationCredits}</MenuItem>
                        <Divider />
                        <MenuItem onClick={handleBuyCredits} sx={{ padding: '4px 16px', minHeight: '32px' }}>Buy Credits</MenuItem>
                        <MenuItem onClick={handleHelp} sx={{ padding: '4px 16px', minHeight: '32px' }}>Help</MenuItem>
                        <MenuItem onClick={handleLogout} sx={{ padding: '4px 16px', minHeight: '32px' }}>Logout</MenuItem>
                    </Menu>
                </Box>
            </Box>

            {token && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
                    {/* Account menu logic remains here */}
                </Box>
            )}

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
                            autoComplete="email" // Ensure correct autocomplete attribute
                            InputLabelProps={{
                                shrink: true, // Force label to shrink
                            }}
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type="password"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            margin="normal"
                            required
                            autoComplete="current-password" // Ensure correct autocomplete attribute
                            InputLabelProps={{
                                shrink: true, // Force label to shrink
                            }}
                        />
                        {!isLogin && (
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                By registering, you agree to our <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
                            </Typography>
                        )}
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

            {/* Main Content */}
            {token && (
                <>
                    {generatedImages.length > 0 && (
                        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Your Generated Images
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Click to see full size image
                            </Typography>
                            <ImageList cols={getImageListCols()} gap={8}>
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
                    )}

                    {userModels.length > 0 && (
                        <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Generate Images
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Remember to include the hotword "USER" in your prompt, e.g. USER as a king
                            </Typography>
                            {creditError && (
                                <Alert severity="error" sx={{ mb: 2 }}>{creditError}</Alert>
                            )}
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
                                disabled={imageLoading || !prompt || !selectedModelId}
                                fullWidth
                                sx={{ mt: 2 }}
                            >
                                {imageLoading ? <CircularProgress size={24} /> : 'Generate Image'}
                            </Button>
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
                                    <li key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                        <Button
                                            variant={selectedModelId === model.modelId ? 'contained' : 'outlined'}
                                            onClick={() => setSelectedModelId(model.modelId)}
                                            disabled={model.status !== 'succeeded'} // Disable if not succeeded
                                            sx={{ marginRight: '8px', width: '300px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                                        >
                                            {model.customName || model.name}
                                        </Button>
                                        {editingModelId === model.modelId ? (
                                            <div className="edit-box" style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                <TextField
                                                    value={newCustomName}
                                                    onChange={(e) => setNewCustomName(e.target.value)}
                                                    size="small"
                                                    sx={{ marginRight: '8px' }}
                                                    autoFocus // Automatically focus the input when opened
                                                />
                                                <Button onClick={() => saveCustomName(model.modelId)} size="small">
                                                    Save
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button onClick={(e) => { e.stopPropagation(); handleRename(model.modelId); }} size="small">
                                                Rename
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Paper>
                    )}

                    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Train a Model
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            Train a model with images of the subject from different directions. 7-12 images will work well. The training process will take about 20 minutes.
                        </Typography>
                        {trainingCreditError && (
                            <Alert severity="error" sx={{ mb: 2 }}>{trainingCreditError}</Alert>
                        )}
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
                                Select Photos ({uploadedFiles.length}/20)
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
                            disabled={loading || uploadedFiles.length === 0}
                            fullWidth
                            sx={{ mt: 2 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Train Model'}
                        </Button>
                    </Paper>

                    {trainStatus === 'training' && loading && (
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

                    {/* {creditError && (
                        <Alert severity="error" sx={{ mb: 2 }}>{creditError}</Alert>
                    )} */}

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
                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                        Model: {selectedImage.modelName}
                                    </Typography>
                                </>
                            )}
                        </DialogContent>
                    </Dialog>
                </>
            )}

            {/* Footer with Terms of Service and Privacy Policy links */}
            <Box sx={{ mt: 4, textAlign: 'center', pb: 4 }}>
                <Typography variant="body2">
                    <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer">Terms of Service</a> | 
                    <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px' }}>Privacy Policy</a>
                </Typography>
            </Box>
        </Container>
    );
}

const theme = createTheme();

function AppWrapper() {
    return (
        <ThemeProvider theme={theme}>
            <App />
        </ThemeProvider>
    );
}

export default AppWrapper;