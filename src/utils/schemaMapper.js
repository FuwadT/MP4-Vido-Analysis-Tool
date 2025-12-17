
export const ALLOWED_TAGS = [
    "Animal",
    "Cyclist",
    "Golf-Cart",
    "Motorcycle",
    "Pedestrian",
    "Van",
    "Truck",
    "Vehicle",
    "Emergency-Vehicle",
    "Scooter",
    "Bus",
    "Unknown"
];

const ANIMAL_CLASSES = new Set(['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);

/**
 * Maps a COCO-SSD class to our allowed schema.
 * Returns null if the object should be filtered out.
 */
export function mapCocoToSchema(cocoClass) {
    const c = cocoClass.toLowerCase();

    if (c === 'person') return 'Pedestrian';
    if (c === 'bicycle') return 'Cyclist';
    if (c === 'motorcycle') return 'Motorcycle';
    if (c === 'bus') return 'Bus';
    if (c === 'truck') return 'Truck';
    if (c === 'car') return 'Vehicle'; // Can be refined later
    if (ANIMAL_CLASSES.has(c)) return 'Animal';

    return null; // Filter out everything else (e.g., Traffic Lights, Potted Plants)
}

/**
 * Refines a class based on MobileNet detailed classification.
 */
export function refineSchemaTag(currentTag, detailClass) {
    if (!detailClass) return currentTag;
    const d = detailClass.toLowerCase();

    // Check for Emergency Vehicles
    if (d.includes('ambulance') || d.includes('police') || d.includes('fire truck') || d.includes('fire engine')) {
        return 'Emergency-Vehicle';
    }

    // Check for Vans
    if (d.includes('minivan') || d.includes('van') || d.includes('moving van')) {
        return 'Van';
    }

    // Check for Golf Carts
    if (d.includes('golf cart') || d.includes('golfcart')) {
        return 'Golf-Cart';
    }

    // Check for Scooters
    if (d.includes('scooter') || d.includes('moped') || d.includes('vespa')) {
        return 'Scooter';
    }

    // Keep existing tag if no special refinement found
    return currentTag;
}
