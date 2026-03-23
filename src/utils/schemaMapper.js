
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
    "Traffic-Light",
    "Traffic-Sign",
    "Unknown"
];

const ANIMAL_CLASSES = new Set(['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);

export function mapCocoToSchema(cocoClass) {
    const c = cocoClass.toLowerCase();
    if (c === 'person') return 'Pedestrian';
    if (c === 'bicycle') return 'Cyclist';
    if (c === 'motorcycle') return 'Motorcycle';
    if (c === 'bus') return 'Bus';
    if (c === 'truck') return 'Truck';
    if (c === 'car') return 'Vehicle';
    if (c === 'traffic light') return 'Traffic-Light';
    if (c === 'stop sign') return 'Traffic-Sign';
    if (ANIMAL_CLASSES.has(c)) return 'Animal';
    return null;
}

export function refineSchemaTag(currentTag, detailClass) {
    if (!detailClass) return currentTag;
    const d = detailClass.toLowerCase();
    if (d.includes('ambulance') || d.includes('police') || d.includes('fire truck') || d.includes('fire engine')) return 'Emergency-Vehicle';
    if (d.includes('minivan') || d.includes('van') || d.includes('moving van')) return 'Van';
    if (d.includes('golf cart') || d.includes('golfcart')) return 'Golf-Cart';
    if (d.includes('scooter') || d.includes('moped') || d.includes('vespa')) return 'Scooter';
    return currentTag;
}
