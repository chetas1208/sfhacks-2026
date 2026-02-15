
export interface AiHint {
    labelGuess: string;
    confidence: number;
    extractedFields: Record<string, string>;
    warnings: string[];
}

export class AiService {
    /**
     * Extract hints from claim data.
     * This is a "lightweight" implementation using regex/heuristics on description and metadata.
     */
    static async analyzeClaim(
        actionCode: string,
        description: string,
        occurredAt: Date
    ): Promise<AiHint> {
        const hints: AiHint = {
            labelGuess: actionCode,
            confidence: 0.7, // Baseline confidence
            extractedFields: {},
            warnings: []
        };

        const descLower = description.toLowerCase();

        // 1. Basic Heuristics based on Action Type
        if (actionCode === 'BIKE_TO_CAMPUS') {
            if (descLower.includes('bike') || descLower.includes('cycling') || descLower.includes('ride')) {
                hints.confidence += 0.2;
            }
            if (descLower.includes('strava') || descLower.includes('map')) {
                hints.extractedFields['tracking_app'] = 'Possible Strava reference';
            }
        } else if (actionCode === 'PUBLIC_TRANSIT') {
            if (descLower.includes('bus') || descLower.includes('train') || descLower.includes('ticket')) {
                hints.confidence += 0.2;
            }
        } else if (actionCode === 'ENERGY_SCREENSHOT') {
            if (descLower.includes('kwh') || descLower.includes('bill') || descLower.includes('usage')) {
                hints.confidence += 0.2;
            }
        }

        // 2. Metadata / Time Checks
        const now = new Date();
        const ageHours = (now.getTime() - occurredAt.getTime()) / (1000 * 60 * 60);

        if (ageHours < 0) {
            hints.warnings.push('Date is in the future');
            hints.confidence -= 0.5;
        } else if (ageHours > 7 * 24) {
            hints.warnings.push('Claim is older than 7 days');
            hints.confidence -= 0.1;
        }

        // Cap confidence
        hints.confidence = Math.min(0.99, Math.max(0.1, hints.confidence));

        return hints;
    }
}
