import React from 'react';
import { Box, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function Help({ onClose }) {
    return (
        <Box sx={{ fontFamily: 'Roboto, sans-serif', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Back Button at the Top */}
            <Box sx={{ padding: '10px', marginBottom: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={onClose}
                >
                    Back
                </Button>
            </Box>



            {/* Container */}
            <Box className="container" sx={{ display: 'flex', flexDirection: 'row', flex: 1, width: '100%', backgroundColor: '#e9ecef', padding: '10px', boxSizing: 'border-box' }}>
                
                {/* Left Column */}
                <Box className="left-column" sx={{ width: '70%', backgroundColor: '#f4f4f4', padding: '10px', boxSizing: 'border-box' }}>
                    <h2>Help Topics</h2>
                    
                    {/* Help Content */}
                    <h2>What do we do?</h2>
                    <p>This site allows you to train a personalized AI image generation model by uploading multiple selfies (7-10, up to a maximum of 20) of the same person. Once trained, you can use this model to generate new images of the user in different settings, styles, or even historical periods.</p>

                    <h2>How does it work?</h2>
                    <p>After you upload the selfies, our system trains a model based on the provided images. You can then use prompts to create images where the user (the person in the selfies) appears in various imaginative or realistic scenarios.</p>

                    <h2>Can one model be used for multiple people?</h2>
                    <p>No, each model is trained for one person only. If you want to generate images of multiple people, you will need to train a separate model for each person.</p>

                    <h2>What kind of images should I upload?</h2>
                    <p>To get the best results, upload clear, well-lit selfies that show the user's face from various angles. Consistency in lighting and backgrounds is helpful but not required. Please ensure the images are appropriate and align with our community guidelines.</p>

                    <h2>How long does it take?</h2>
                    <p>Training a model takes around 20 minutes. Generating images takes around 10 seconds.</p>

                    <h2>What are some good prompts to use?</h2>
                    <p>After your model is trained, try these prompts:</p>
                    <ul>
                        <li>USER as a Renaissance noble attending a royal banquet, dressed in elaborate 16th-century attire.</li>
                        <li>USER as a cyberpunk hacker in a futuristic neon-lit cityscape, with cool tech accessories.</li>
                        <li>USER on an adventurous safari, standing beside a jeep in the savannah with wild animals in the background.</li>
                        <li>USER enjoying a serene moment as a 19th-century painter, in an artist's studio with an easel and paint palette.</li>
                        <li>USER as a dashing pirate captain on a tall ship, gazing out at the open ocean with a confident expression.</li>
                        <li>USER as a medieval knight in shining armor, standing before a grand castle under a stormy sky.</li>
                        <li>USER as a rockstar performing on stage with a guitar, vibrant lights, and a cheering crowd.</li>
                        <li>USER as an astronaut on Mars, wearing a space suit and standing proudly with a flag.</li>
                        <li>USER as an elegant Victorian gentleman or lady, strolling through a garden with a cane or parasol.</li>
                        <li>USER on a mystical quest as a fantasy hero, wearing armor with a magical sword in an enchanted forest.</li>
                    </ul>

                    <h2>Does it work with pets?</h2>
                    <p>Yes! You will have to modify the prompt, for example: USER as a dog..., or USER as a cat... For certain breeds, it's helpful to add the breed, e.g., USER as a pug dog...</p>

                    <h2>What if the generated image isn’t exactly what I wanted?</h2>
                    <p>You can refine your prompt or try new keywords to help the model produce closer results to your vision. Descriptive details, such as setting, mood, and specific clothing styles, can enhance the output. You can use an LLM like ChatGPT to help create your prompt.</p>

                    <h2>Can I download and share the images I create?</h2>
                    <p>Yes, all generated images are downloadable. Click on the image to see the full-size version. On a mobile phone, long-click on the image in order to save or share it. On a desktop computer, right-click or ctrl-click to save or share.</p>

                    <h2>Is there a limit to how many images I can generate?</h2>
                    <p>Training models and generating images uses expensive GPU hardware and resources. We have put in place a credit system. We have two types of credits: <strong>model credits</strong> and <strong>image credits</strong>. Each time you train a model, it uses 1 model credit, and each image generation uses 1 image credit. Once your credits run out, you will need to purchase more to continue training models or generating images.</p>
                
                    <h2>What if I have more questions?</h2>
                    <p>Email us at <strong>support@greatshots.art</strong></p>
                </Box>

                {/* Right Column */}
                <Box className="right-column" sx={{ flex: 1, padding: '10px', boxSizing: 'border-box' }}>
                    <Box className="image-grid" sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0px', width: '100%', marginBottom: '20px' }}>
                        {/* Example images */}
                        <img src={`${process.env.PUBLIC_URL}/img/8.png`} alt="Example Image 1" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        <img src={`${process.env.PUBLIC_URL}/img/14.webp`} alt="Example Image 2" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        <img src={`${process.env.PUBLIC_URL}/img/10.webp`} alt="Example Image 3" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        <img src={`${process.env.PUBLIC_URL}/img/11.webp`} alt="Example Image 4" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        <img src={`${process.env.PUBLIC_URL}/img/6.webp`} alt="Example Image 5" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        <img src={`${process.env.PUBLIC_URL}/img/5.webp`} alt="Example Image 6" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        <img src={`${process.env.PUBLIC_URL}/img/7.webp`} alt="Example Image 7" style={{ width: '100%', height: '400px', objectFit: 'cover' }} />
                        {/* Add more images as needed */}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

export default Help;
