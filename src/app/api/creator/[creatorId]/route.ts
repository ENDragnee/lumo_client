// @/app/api/creator/[creatorId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { IUser } from '@/models/User'; // Keep IUser for type assertion
import Content from '@/models/Content';
import Book from '@/models/Book';
import mongoose from 'mongoose';
import { IMedia } from '@/models/Media';

// Note: The local IBook interface is removed as it was unused and could conflict with an actual Book model import.
//
type RouteParams = {
  params: Promise<{
    creatorId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { creatorId } = await params;

    if (!creatorId || !mongoose.Types.ObjectId.isValid(creatorId)) {
      return NextResponse.json(
        { message: 'A valid Creator ID is required.' },
        { status: 400 },
      );
    }

    const [creatorResult, contentResult, booksResult] = await Promise.all([
      // FIX: Add a specific type assertion to the result of the lean query.
      // This tells TypeScript the exact shape of the object, including the populated `profileImage`.
      User.findById(creatorId)
        .select('-password_hash -email')
        .populate<{ profileImage?: IMedia }>('profileImage')
        .lean() as Promise<(IUser & { profileImage?: IMedia }) | null>,

      Content.find({ createdBy: creatorId, isDraft: false, isTrash: false })
        .sort({ createdAt: -1 })
        .populate<{ thumbnail: IMedia }>('thumbnail')
        .populate('createdBy', 'name _id')
        .lean(),

      Book.find({ createdBy: creatorId, isDraft: false, isTrash: false })
        .sort({ createdAt: -1 })
        .populate<{ thumbnail?: IMedia }>('thumbnail')
        .populate('createdBy', 'name _id')
        .lean(),
    ]);

    if (!creatorResult) {
      return NextResponse.json(
        { message: 'Creator not found' },
        { status: 404 },
      );
    }

    // Now that `creatorResult` is properly typed, these operations are safe.
    const creator = {
      ...creatorResult,
      profileImage: creatorResult.profileImage?.path || null,
    };

    const content = contentResult.map((item) => ({
      ...item,
      thumbnail: item.thumbnail?.path || null,
    }));

    const books = booksResult.map((item) => ({
      ...item,
      thumbnail: (item as any).thumbnail?.path || null, // Using 'any' for safety if Book model isn't strictly typed
    }));

    const allPublishedItems = [...content, ...books];

    const stats = {
      totalViews: allPublishedItems.reduce(
        (sum, item) => sum + (item.views || 0),
        0,
      ),
      rating:
        content.length > 0
          ? content.reduce(
              (sum, c: any) => sum + (c.userEngagement.rating || 0),
              0,
            ) / content.length
          : 0,
      ratingCount: content.length,
      // This property access is now type-safe because of the assertion above.
      subscriberCount: creator.subscribersCount || 0,
    };

    return NextResponse.json(
      { creator, content, books, stats },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching creator data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
