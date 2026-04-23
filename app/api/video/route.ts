import { authOptions } from "@/utils/auth";
import { connectToDatabase } from "@/utils/db";
import Video, { IVideo } from "@/models/Video";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 3000;

export async function GET() {
  try {
    await connectToDatabase();
    const videos = await Video.find({}).sort({ createdAt: -1 }).lean();

    if (!videos || videos.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(videos);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerIdentifier = session.user?.email || session.user?.id;
    if (!ownerIdentifier) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body: IVideo = await request.json();
    const normalizedTitle = body.title?.trim() ?? "";
    const normalizedDescription = body.description?.trim() ?? "";
    const normalizedVideoUrl = body.videoUrl?.trim() ?? "";

    if (!normalizedTitle || !normalizedDescription || !normalizedVideoUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (normalizedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    if (normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    try {
      const videoUrl = new URL(normalizedVideoUrl);
      if (videoUrl.protocol !== "http:" && videoUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Invalid video URL" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid video URL" }, { status: 400 });
    }

    const resolvedThumbnailUrl =
      body.thumbnailUrl && body.thumbnailUrl.trim().length > 0
        ? body.thumbnailUrl
        : `${normalizedVideoUrl}/ik-thumbnail.jpg`;

    const videoData = {
      ...body,
      title: normalizedTitle,
      description: normalizedDescription,
      videoUrl: normalizedVideoUrl,
      thumbnailUrl: resolvedThumbnailUrl,
      createdBy: ownerIdentifier,
      controls: body?.controls ?? true,
      transformation: {
        height: 1920,
        width: 1080,
        quality: body.transformation?.quality ?? 100,
      },
    };
    const newVideo = await Video.create(videoData);

    return NextResponse.json(newVideo);
  } catch {
    return NextResponse.json(
      { error: "Failed to create video" },
      { status: 500 }
    );
  }
}