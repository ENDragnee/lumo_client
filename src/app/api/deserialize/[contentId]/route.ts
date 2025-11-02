import connectDB from '@/lib/mongodb';
import Content, { IContent } from '@/models/Content';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

interface SelectedData {
  _id: string;
  data: string;
  title: string;
  tags: string[];
  thumbnail: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  description?: string;
  version?: number;
}

type RouteParams = {
  params: Promise<{
    contentId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    const { contentId } = await params;
    let data: SelectedData;

    if (contentId && Types.ObjectId.isValid(contentId)) {
      data = await Content.findById(contentId)
        .select('data title _id tags thumbnail difficulty description version')
        .lean()
        .exec();
    } else {
      data = await Content.findOne()
        .sort({ createdAt: -1 })
        .select('data title _id tags thumbnail difficulty description version')
        .lean()
        .exec();
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'No content found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        data: data.data,
        title: data.title,
        tags: data.tags,
        thumbnail: data.thumbnail,
        difficulty: data.difficulty,
        description: data.description,
        version: data.version,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
