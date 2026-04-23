import { authOptions } from "@/utils/auth";
import Video from "@/models/Video";
import { connectToDatabase } from "@/utils/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    const ownerCandidates = [session?.user?.id, session?.user?.email].filter(
      Boolean
    ) as string[];

    if (ownerCandidates.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await connectToDatabase();

    const video = await Video.findById(id);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Legacy records may not have an owner; allow any authenticated user to clean them up.
    const isLegacyUnownedVideo = !video.createdBy;
    if (!isLegacyUnownedVideo && !ownerCandidates.includes(video.createdBy)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Video.findByIdAndDelete(id);

    return NextResponse.json({ message: "Video deleted" });
  } catch {
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
