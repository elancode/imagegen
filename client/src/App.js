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
import BuyCredits from './BuyCredits';
import Help from './Help';
import SplashPage from './SplashPage';

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
    const [prompt, setPrompt] = useState('');
    const [error, setError] = useState(null);
    const [trainingProgress, setTrainingProgress] = useState('');
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail'));
    const [showAuth, setShowAuth] = useState(false);
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
    const [imageGeneratedNotification, setImageGeneratedNotification] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [modelTrainingCredits, setModelTrainingCredits] = useState(0);
    const [imageGenerationCredits, setImageGenerationCredits] = useState(0);
    const [creditError, setCreditError] = useState('');
    const [trainingCreditError, setTrainingCreditError] = useState('');
    const [imageLoading, setImageLoading] = useState(false);
    const [editingModelId, setEditingModelId] = useState(null);
    const [newCustomName, setNewCustomName] = useState('');
    const [showBuyCredits, setShowBuyCredits] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        console.log('Server URL:', process.env.REACT_APP_SERVER_URL);
        if ("Notification" in window) {
            Notification.requestPermission();
        }

        if (token && !loading) {
            fetchUserModels();
            fetchGeneratedImages();
            fetchUserCredits();
        }

        if (modelId && trainStatus === 'training') {
            pollTrainingStatus(modelId);
        }
    }, [token, loading]);

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
            console.log('Fetched credits:', data);
                setModelTrainingCredits(data.modelTrainingCredits);
                setImageGenerationCredits(data.imageGenerationCredits);
            } catch (error) {
                console.error('Error fetching user credits:', error);
            }
        };

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
            console.log('Fetched models:', data.models);
            setUserModels(data.models);

            const succeededModels = data.models.filter(model => model.status === 'succeeded');
            if (succeededModels.length === 1) {
                setSelectedModelId(succeededModels[0].modelId);
            } else {
                setSelectedModelId(null);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            setError('Failed to load models');
        }
    };

    const fetchGeneratedImages = async () => {
        try {
            console.log('Token:', token);
            const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/generated-images`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch generated images');
            }

            const data = await response.json();
            setGeneratedImages(data.images || []);
            setError(null);
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
        setTrainingCreditError('');

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
                setLoading(false);
                return;
            }

            const data = await response.json();
            updateModelId(data.modelId);
            pollTrainingStatus(data.modelId);
        } catch (error) {
            console.error('Error:', error);
            setError('Failed to start training');
            updateTrainStatus('failed');
            setLoading(false);
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

            console.log('Training status data:', data);
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
                setTimeout(() => pollTrainingStatus(modelId), 5000);
            }
        } catch (error) {
            console.error('Error:', error);
            updateTrainStatus('failed');
            setLoading(false);
            setError('Failed to check training status');
            setTrainingProgress('Failed to check training status');
        }
    };

    const handleGenerate = async () => {
        if (!selectedModelId || !prompt) return;

        setImageLoading(true);
        setError(null);
        setCreditError('');

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
                setImageGeneratedNotification(true);
            } else {
                setError('No output received from the server.');
            }
        } catch (error) {
            console.error('Error:', error);
            setError(error.message || 'Failed to generate image');
        } finally {
            setImageLoading(false);
        }
    };

    const handleUserAction = () => {
        setImageGeneratedNotification(false);
    };

    const handleReset = () => {
        localStorage.removeItem('modelId');
        localStorage.removeItem('trainStatus');
        setModelId(null);
        setTrainStatus(null);
        setUploadedFiles([]);
        setPreviewUrls([]);
        setPrompt('');
        setError(null);
        setTrainingProgress('');
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

            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.email);
            setToken(data.token);
            setUserEmail(data.email);
            setUserModels(data.models || []);
            setShowAuth(false);
            setAuthEmail('');
            setAuthPassword('');
            setGeneratedImages([]);
            fetchGeneratedImages();

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
        setUserModels([]);
        setGeneratedImages([]);
        setError(null);
        setShowAuth(true);
        setAnchorEl(null);
        setPrompt('');
        setUploadedFiles([]);
        setPreviewUrls([]);
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
    };

    useEffect(() => {
        const succeededModels = userModels.filter(model => model.status === 'succeeded');
        if (succeededModels.length === 1) {
            setSelectedModelId(succeededModels[0].modelId);
        } else {
            setSelectedModelId(null);
        }
    }, [userModels]);

    const handleAccountClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleUserInteraction = () => {
        setCreditError('');
        setTrainingCreditError('');
    };

    const handleRename = (modelId) => {
        setEditingModelId(modelId);
        setNewCustomName('name');
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
            setEditingModelId(null);
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
        console.log('Buy Credits clicked');
        setShowBuyCredits(true);
        handleMenuClose();
    };

    const handleCloseBuyCredits = () => {
        setShowBuyCredits(false);
    };

    const handleHelp = () => {
        setShowHelp(true);
    };

    const handleCloseHelp = () => {
        setShowHelp(false);
    };

    return (
        <Container maxWidth="md" onClick={handleUserInteraction}>
            {/* Header */}
            <Box sx={{ my: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Logo */}
                        <img
                            src={`${process.env.PUBLIC_URL}/greatshotslogo.png`}
                            alt="GreatShots Logo"
                            style={{ maxWidth: '50px', height: 'auto', marginRight: '10px' }}
                        />
                        {/* Title Logo */}
                        <img
                            src={`${process.env.PUBLIC_URL}/greatshotstextlogo.png`}
                            alt="New Logo"
                            style={{ maxWidth: '150px', height: 'auto' }}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Help button accessible to all users */}
                        <Button
                            variant="text"
                            color="inherit"
                            onClick={handleHelp}
                        >
                            Help
                        </Button>
                        {token && (
                            <>
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
                                    <MenuItem disabled sx={{ padding: '4px 16px', minHeight: '32px'  }}>
                                        Model Credits: {modelTrainingCredits}
                                    </MenuItem>
                                    <MenuItem disabled sx={{ padding: '4px 16px', minHeight: '32px' }}>
                                        Image Credits: {imageGenerationCredits}
                                    </MenuItem>
                                    <Divider />
                                    <MenuItem onClick={handleBuyCredits} sx={{ padding: '4px 16px', minHeight: '32px' }}>
                                        Buy Credits
                                    </MenuItem>
                                    <MenuItem onClick={handleLogout} sx={{ padding: '4px 16px', minHeight: '32px' }}>
                                        Logout
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </Box>
                </Box>
            </Box>

            {showHelp ? (
                <Help onClose={handleCloseHelp} />
            ) : showBuyCredits ? (
                <BuyCredits onClose={handleCloseBuyCredits} />
            ) : token ? (
                <>
                    {/* Main App Content */}
                    {token && (
                        <>
                            {/* Generated Images Section */}
                            {generatedImages.length > 0 && (
                                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Your Generated Images
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                        Click to see full-size image
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
                                                        objectFit: 'cover',
                                                    }}
                                                />
                                            </ImageListItem>
                                        ))}
                                    </ImageList>
                                </Paper>
                            )}

                            {/* Generate Images Section */}
                            {userModels.length > 0 && (
                                <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Generate Images
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

                            {/* Models List */}
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
                                                    disabled={model.status !== 'succeeded'}
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
                                                            autoFocus
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

                            {/* Train Model Section */}
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

                            {/* Training Status */}
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

                            {/* Image Overlay Dialog */}
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
                </>
            ) : (
                <>
                    {/* Show SplashPage when user is not logged in */}
                    <SplashPage
                        onLoginClick={() => { setIsLogin(true); setShowAuth(true); }}
                        onTryNowClick={() => { setIsLogin(false); setShowAuth(true); }}
                    />

                    {/* Auth Dialog */}
                    {showAuth && (
                        <Dialog
                            open={showAuth}
                            onClose={() => setShowAuth(false)}
                            maxWidth="xs"
                            fullWidth
                        >
                            <DialogTitle>
                                {isLogin ? 'Login' : 'Sign Up'}
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
                                        autoComplete="email"
                                        InputLabelProps={{
                                            shrink: true,
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
                                        autoComplete="current-password"
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                    {!isLogin && (
                                        <Typography variant="body2" sx={{ mt: 2 }}>
                                            By signing up, you agree to our <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
                                        </Typography>
                                    )}
                                </DialogContent>
                                <DialogActions sx={{ px: 3, pb: 2 }}>
                                    <Button onClick={() => setIsLogin(!isLogin)}>
                                        {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
                                    </Button>
                                    <Button type="submit" variant="contained">
                                        {isLogin ? 'Login' : 'Sign Up'}
                                    </Button>
                                </DialogActions>
                            </form>
                        </Dialog>
                    )}
                </>
            )}

            {/* Footer */}
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