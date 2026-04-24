import { getUploadAuthParams } from "@imagekit/next/server";

export async function GET() {
  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;

    if (!privateKey || !publicKey) {
      return Response.json(
        {
          error:
            "ImageKit env is missing. Set IMAGEKIT_PRIVATE_KEY and NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY on the server.",
        },
        { status: 500 }
      );
    }

    const authenticationParameters = getUploadAuthParams({
      privateKey,
      publicKey,
    });

    return Response.json({
      authenticationParameters,
      publicKey,
    });
  } catch {
    return Response.json(
      {
        error: "Authentication for ImageKit failed",
      },
      { status: 500 }
    );
  }
}