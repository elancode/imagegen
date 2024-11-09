import React, { useState } from 'react';
import {
  Typography,
  Button,
  Box,
  Dialog,
  DialogContent,
} from '@mui/material';

function SplashPage({ onLoginClick, onTryNowClick }) {
  const exampleImages = [
    { src: `${process.env.PUBLIC_URL}/img/11.webp`, title: 'Example Image 1' },
    { src: `${process.env.PUBLIC_URL}/img/5.webp`, title: 'Example Image 2' },
    { src: `${process.env.PUBLIC_URL}/img/8.png`, title: 'Example Image 3' },
    { src: `${process.env.PUBLIC_URL}/img/12.png`, title: 'Example Image 4' },
    { src: `${process.env.PUBLIC_URL}/img/14.webp`, title: 'Example Image 5' },
    { src: `${process.env.PUBLIC_URL}/img/10.webp`, title: 'Example Image 6' },
    { src: `${process.env.PUBLIC_URL}/img/6.webp`, title: 'Example Image 7' },
    { src: `${process.env.PUBLIC_URL}/img/7.webp`, title: 'Example Image 8' },
  ];

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setOverlayOpen(true);
  };

  const handleOverlayClose = () => {
    setOverlayOpen(false);
    setSelectedImage(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        overflowY: 'auto', // Allow the whole page to scroll
      }}
    >
      {/* Left Column - Explanatory Text */}
      <Box
        sx={{
          width: '30%',
          minWidth: '150px', // Increased minWidth to prevent text cutoff
          flexShrink: 0,
          p: 3, // Reverted padding to original value
          backgroundColor: '#ffffff',
        }}
      >
        <Typography
          component="div"
          sx={{
            wordBreak: 'break-word',
            hyphens: 'auto',
            fontSize: 'clamp(1rem, 2vw, 1.5rem)', // Adjusted max font size
            mt: 0,
            lineHeight: 1.6, // Increased line height for better readability
          }}
        >
          <Box sx={{ marginBottom: '1rem' }}>
          Create AI Art that Looks Just Like You
          </Box>
          <Box sx={{ marginBottom: '1rem' }}>
          Easily Train Your Own AI Model with Your Selfies
          </Box>
          <Box sx={{ marginBottom: '1rem' }}>
          Generate Unique, High-Quality Images with Your Personal AI Model
          </Box>
          <Box sx={{ marginBottom: '1rem' }}>
          Perfect for Pets Too!
          </Box>
          <Box sx={{ marginBottom: '1rem' }}>
          Ideal for Eye-Catching Social Media Posts
          </Box>
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            mt: 2,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={onTryNowClick}
            sx={{ m: 1 }}
          >
            Try Now
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={onLoginClick}
            sx={{ m: 1 }}
          >
            Login
          </Button>
        </Box>
      </Box>

      {/* Right Column - Images */}
      <Box
        sx={{
          width: '70%',
          flexGrow: 1,
          overflowY: 'auto', // Allow scrolling within the image column
          p: 2, // Reverted padding to original value
        }}
      >
        {/* Render images directly */}
        {exampleImages.map((image, index) => (
          <Box key={index} sx={{ marginBottom: '16px' }}>
            <img
              src={image.src}
              alt={image.title}
              loading="lazy"
              style={{
                width: '100%',    // Ensure image takes full width of container
                height: 'auto',    // Maintain aspect ratio
                display: 'block',
                cursor: 'pointer',
                borderRadius: '8px', // Added rounded corners
              }}
              onClick={() => handleImageClick(image)}
            />
          </Box>
        ))}

        {/* Image Overlay Dialog */}
        <Dialog open={overlayOpen} onClose={handleOverlayClose} maxWidth="lg">
          <DialogContent sx={{ textAlign: 'center' }}>
            {selectedImage && (
              <img
                src={selectedImage.src}
                alt={selectedImage.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  borderRadius: '8px', // Added rounded corners
                }}
                onClick={handleOverlayClose}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </Box>
  );
}

export default SplashPage;