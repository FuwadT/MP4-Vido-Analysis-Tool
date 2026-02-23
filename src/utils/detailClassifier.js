import * as mobilenet from '@tensorflow-models/mobilenet';

// Singleton model instance
let classifierModel = null;

export async function loadClassifier() {
    if (!classifierModel) {
        console.log("Loading MobileNet...");
        classifierModel = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log("MobileNet Loaded");
    }
    return classifierModel;
}

/**
 * Cropts the bounding box from the video and runs MobileNet classification.
 * @param {HTMLVideoElement} video 
 * @param {Array} bbox [x, y, w, h]
 * @returns {Promise<string|null>} Top class name or null
 */
export async function getDetailedClass(video, bbox) {
    if (!classifierModel) return null;

    const [x, y, w, h] = bbox;

    // Safety check for tiny boxes (noise)
    if (w < 20 || h < 20) return null;

    try {
        // Create a temp canvas to crop the image
        const canvas = document.createElement('canvas');
        canvas.width = 224; // MobileNet native resolution preference
        canvas.height = 224;
        const ctx = canvas.getContext('2d');

        // Draw matched crop scaled to 224x224
        ctx.drawImage(video, x, y, w, h, 0, 0, 224, 224);

        // Classify
        const predictions = await classifierModel.classify(canvas);

        if (predictions && predictions.length > 0) {
            // Return top 1
            // predictions[0] is { className: "sports car, sport car", probability: 0.9 }
            // We usually want the first term of the comma separated list
            return predictions[0].className.split(',')[0];
        }
    } catch (err) {
        console.error("Classification error:", err);
    }

    return null;
}
