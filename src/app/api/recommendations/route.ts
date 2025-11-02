//@/app/api/recommendations/route.ts
import { NextResponse, NextRequest } from 'next/server';
import mongoose, { Document, Types } from 'mongoose';
import { getServerSession } from "next-auth/next";

// Libs & Helpers
import connectDB from '@/lib/mongodb';
import redis from '@/lib/redis';
import { authOptions } from "@/lib/auth";

// Models
import Content, { IContent } from '@/models/Content';
import Interaction from '@/models/Interaction';
import Subscribtion from '@/models/Subscribtion';
import Performance from '@/models/Performance';
import User from '@/models/User';
import { IMedia } from '@/models/Media'; // Import IMedia for type hints

// ===================================================================================
// CONFIGURATION & CONSTANTS
// ===================================================================================
const TAG_AFFINITY_WEIGHT = 0.7;
const INTERACTION_DURATION_WEIGHT = 0.3;
const COMPLETION_THRESHOLD = 95;
const CACHE_TTL_SECONDS = 900;
const DEFAULT_PAGE_LIMIT = 20;

// ===================================================================================
// TYPE DEFINITIONS
// ===================================================================================
interface UserContentEngagement {
    totalDuration: number;
    isCompleted: boolean;
    lastAccessedAt?: Date;
}

// Omit the original ObjectId `thumbnail` and add the new `string` version
type LeanIContent = Omit<IContent, 'thumbnail' | keyof Document | 'toJSON' | 'toObject'> & {
    _id: Types.ObjectId;
    thumbnail: string;
};

type EnrichedContent = LeanIContent & {
    relevance: number;
    performance?: {
        understandingLevel: 'needs-work' | 'foundational' | 'good' | 'mastered';
    };
    lastAccessedAt?: Date;
    createdBy: {
        _id: string;
        name: string;
    };
};

export async function GET(request: NextRequest) {
    // --- 1. AUTHENTICATION ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !mongoose.Types.ObjectId.isValid(session.user.id)) {
        return NextResponse.json({ error: 'Unauthorized or invalid user ID' }, { status: 401 });
    }
    const userId = session.user.id;
    const userIdObject = new mongoose.Types.ObjectId(userId);

    // --- PAGINATION PARAMS ---
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || `${DEFAULT_PAGE_LIMIT}`, 10);
    const skip = (page - 1) * limit;

    // --- 2. CACHING (GET) ---
    const cacheKey = `recommendations:v3:${userId}`;
    if (page === 1) {
        try {
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                const parsedData: EnrichedContent[] = JSON.parse(cachedData);
                console.log(`CACHE HIT: Returning v3 recommendations for user ${userId} from Redis.`);
                const paginatedResults = parsedData.slice(skip, skip + limit);
                return NextResponse.json(paginatedResults);
            }
        } catch (redisError) {
            console.error("Redis GET error in /recommendations:", redisError);
        }
    }
    console.log(`CACHE MISS or Page > 1: Generating fresh v3 recommendations for user ${userId}, page ${page}.`);

    try {
        await connectDB();

        // --- 3. FETCH SUBSCRIBED CREATORS ---
        const subscriptions = await Subscribtion.find({
            userId: userIdObject,
            isSubscribed: true
        }).select('creatorId').lean();

        const subscribedCreatorIds = subscriptions.map(sub => sub.creatorId);

        if (subscribedCreatorIds.length === 0) {
            return NextResponse.json([]);
        }

        // --- 4. BUILD USER PROFILE FROM INTERACTIONS ---
        const contentEngagementPipeline: mongoose.PipelineStage[] = [/* ... unchanged ... */];
        const tagAffinityPipeline: mongoose.PipelineStage[] = [/* ... unchanged ... */];

        const [tagAffinityResults, contentEngagementResults] = await Promise.all([
            Interaction.aggregate(tagAffinityPipeline),
            Interaction.aggregate(contentEngagementPipeline)
        ]);

        const tagAffinity = new Map<string, number>(tagAffinityResults.map(item => [item._id, item.totalDuration]));
        const userContentEngagement = new Map<string, UserContentEngagement>(
            contentEngagementResults.map(item => [
                item._id.toString(),
                {
                    totalDuration: item.totalDuration,
                    isCompleted: item.maxEndPosition >= COMPLETION_THRESHOLD,
                    lastAccessedAt: item.lastAccessedAt
                }
            ])
        );
        const completedContentIds = Array.from(userContentEngagement.entries())
            .filter(([, data]) => data.isCompleted)
            .map(([contentId]) => new mongoose.Types.ObjectId(contentId));
            
        // --- 5. MAIN AGGREGATION PIPELINE TO FETCH AND ENRICH CONTENT ---
        const mainPipeline: mongoose.PipelineStage[] = [
            // Stage 1: Filter for relevant content
            {
                $match: {
                    createdBy: { $in: subscribedCreatorIds },
                    _id: { $nin: completedContentIds },
                    isDraft: false,
                    isTrash: false,
                }
            },
            // UPDATE: Stage 2: Join with Media to get thumbnail path
            {
                $lookup: {
                    from: 'media', // The collection name of the Media model
                    localField: 'thumbnail',
                    foreignField: '_id',
                    as: 'thumbnailInfo'
                }
            },
            // Stage 3: Join with Users to get creator info
            {
                $lookup: {
                    from: User.collection.name,
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'creatorInfo'
                }
            },
            // Stage 4: Join with Performances to get performance data
            {
                $lookup: {
                    from: Performance.collection.name,
                    let: { contentId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$contentId', '$$contentId'] }, { $eq: ['$userId', userIdObject] }] } } },
                        { $limit: 1 }
                    ],
                    as: 'performanceData'
                }
            },
            // UPDATE: Stage 5: Reshape the data and prepare for scoring
            {
                $project: {
                    // All fields from IContent
                    title: 1, 
                    contentType: 1, 
                    data: 1, 
                    createdAt: 1, 
                    tags: 1, 
                    difficulty: 1, 
                    description: 1,
                    // Replace thumbnail ObjectId with the path string from the media document
                    thumbnail: { $arrayElemAt: ['$thumbnailInfo.path', 0] },
                    // Added fields
                    createdBy: {
                        _id: { $arrayElemAt: ['$creatorInfo._id', 0] },
                        name: { $arrayElemAt: ['$creatorInfo.name', 0] }
                    },
                    performance: {
                        understandingLevel: { $arrayElemAt: ['$performanceData.understandingLevel', 0] }
                    }
                }
            }
        ];

        const candidateContent: EnrichedContent[] = await Content.aggregate(mainPipeline);

        // --- 6. SCORE, RANK, AND PAGINATE IN-MEMORY ---
        const scoredContent: EnrichedContent[] = candidateContent.map((content) => {
            const contentIdStr = content._id.toString();
            
            const tagScore = (content.tags || []).reduce((acc: number, tag: string) => acc + (tagAffinity.get(tag) || 0), 0);
            const engagement = userContentEngagement.get(contentIdStr);
            const interactionDuration = engagement?.totalDuration || 0;
            const lastAccessedAt = engagement?.lastAccessedAt;

            const relevance = (TAG_AFFINITY_WEIGHT * tagScore) + (INTERACTION_DURATION_WEIGHT * interactionDuration);

            return {
                ...content,
                relevance,
                lastAccessedAt,
            };
        });

        scoredContent.sort((a, b) => b.relevance - a.relevance);

        // --- 7. CACHING (SET) ---
        if (page === 1) {
            try {
                await redis.set(cacheKey, JSON.stringify(scoredContent), 'EX', CACHE_TTL_SECONDS);
            } catch (redisError) {
                console.error("Redis SET error in /recommendations:", redisError);
            }
        }
        
        // --- 8. PAGINATE AND RETURN ---
        const paginatedResults = scoredContent.slice(skip, skip + limit);
        return NextResponse.json(paginatedResults);

    } catch (error: any) {
        console.error('API Recommendation Route Error:', error);
        return NextResponse.json({ message: 'Internal server error fetching recommendations.' }, { status: 500 });
    }
}
